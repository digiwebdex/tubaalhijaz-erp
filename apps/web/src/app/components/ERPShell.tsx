import { useState, useRef, useEffect, useMemo, type ReactNode, type CSSProperties } from "react";
import { Link, useLocation } from "react-router";
import { toast } from "sonner";
import { api, isLoggedIn, getStoredUser } from "../lib/api";
import { canAccessPath, sessionUser } from "../lib/rbac";
import {
  groupsForUser,
  filterAdvancedTools,
  navLabel,
  moduleTitle,
  isNavItemActive,
  resolveNavAudience,
  type GlobalNavItem,
  type GlobalNavGroup,
} from "../lib/navConfig";
import { useNotifyEvents } from "../lib/notifySocket";
import { EmptyState } from "./States";
import { useLang } from "../lib/LangContext";
import { fontFor } from "@tuba/shared";
import { useViewport } from "./ui/use-mobile";
import { ERP } from "./erp";
import {
  Search, Bell, Globe2, ChevronDown, ChevronRight, ChevronLeft,
  User, LogOut, Settings, AlertTriangle, Menu, X, Wrench,
} from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type IconFC = (props: { size?: number; style?: CSSProperties; className?: string }) => any;

interface BellItem { id: string | number; urgent: boolean; title: string; sub: string; time: string }

interface NotifLog {
  id: string;
  channel: "WHATSAPP" | "EMAIL" | "IN_APP";
  priority: "LOW" | "NORMAL" | "EMERGENCY";
  title: string;
  body: string;
  status: "PENDING" | "DELIVERED" | "READ" | "FAILED";
  readAt: string | null;
  createdAt: string;
  event: { key: string; labelEn: string } | null;
}

const BELL_NOTIFS: BellItem[] = [
  { id: 1, urgent: true, title: "Transport SLA breach — DSP-006", sub: "Dispatch · Bassem Khalil · 3h delay", time: "2m" },
  { id: 2, urgent: false, title: "GRP-2891 visa issued (47 pax)", sub: "Visa Desk · staff-updated pipeline status", time: "18m" },
  { id: 3, urgent: false, title: "Overdue: INV-1446-0091 SAR 323.7K", sub: "Finance · Rashidi Travel · Net +30 days", time: "1h" },
];

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function mapBell(n: NotifLog): BellItem {
  return {
    id: n.id,
    urgent: n.priority === "EMERGENCY" || n.status === "FAILED",
    title: n.title,
    sub: n.body || n.event?.labelEn || "",
    time: timeAgo(n.createdAt),
  };
}

export interface NavItem {
  id: string;
  label: string;
  /** Bangla label — preferred when lang=bn */
  labelBn?: string;
  icon: IconFC;
  badge?: number | string;
}

export interface ERPShellProps {
  moduleId: string;
  moduleName: string;
  moduleColor: string;
  moduleIcon: IconFC;
  navItems: NavItem[];
  activeItem: string;
  onItemClick: (id: string) => void;
  breadcrumb: string[];
  notificationCount?: number;
  userName?: string;
  userRole?: string;
  children: ReactNode;
}

function secondaryLabel(item: NavItem, lang: "bn" | "en"): string {
  if (lang === "bn") return item.labelBn ?? item.label;
  return item.label;
}

// Small brand glyph (TUBA tower) — matches the DS gold-on-navy mark.
function BrandGlyph({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden>
      <path d="M13 15H35V19H27V34H21V19H13V15Z" fill={ERP.accent} />
      <circle cx="37" cy="11" r="4" fill="none" stroke={ERP.accent} strokeWidth="1.5" opacity="0.75" />
      <circle cx="38.5" cy="9.8" r="3.2" fill={ERP.canvas} />
    </svg>
  );
}

function NavLinkButton({
  item,
  active,
  collapsed,
  onPortal,
  onNavigate,
}: {
  item: GlobalNavItem;
  active: boolean;
  collapsed: boolean;
  onPortal?: (tab: string) => void;
  onNavigate?: () => void;
}) {
  const { lang } = useLang();
  const Icon = item.icon;
  const label = navLabel(item, lang);
  const className =
    "w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg transition-all relative active:scale-[0.98] min-h-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";
  const style: CSSProperties = {
    backgroundColor: active ? ERP.goldDim : "transparent",
    border: `1px solid ${active ? ERP.goldBrd : "transparent"}`,
    outlineColor: ERP.accent,
  };

  const inner = (
    <>
      <Icon size={18} style={{ color: active ? ERP.accent : ERP.muted, flexShrink: 0 }} />
      {!collapsed && (
        <span
          className="text-[13px] font-semibold flex-1 truncate text-left"
          style={{ color: active ? ERP.accent : ERP.fgDim, fontFamily: fontFor(lang) }}
        >
          {label}
        </span>
      )}
    </>
  );

  if (item.portalTab && onPortal) {
    return (
      <button
        type="button"
        title={collapsed ? label : undefined}
        onClick={() => { onPortal(item.portalTab!); onNavigate?.(); }}
        className={className}
        style={style}
        onMouseEnter={(e) => { if (!active) e.currentTarget.style.backgroundColor = ERP.goldDim; }}
        onMouseLeave={(e) => { if (!active) e.currentTarget.style.backgroundColor = "transparent"; }}
      >
        {inner}
      </button>
    );
  }

  return (
    <Link
      to={item.path}
      title={collapsed ? label : undefined}
      onClick={() => onNavigate?.()}
      className={className}
      style={style}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.backgroundColor = ERP.goldDim; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.backgroundColor = "transparent"; }}
    >
      {inner}
    </Link>
  );
}

function SidebarNav({
  groups,
  advanced,
  collapsed,
  pathname,
  tab,
  portalActive,
  onPortal,
  onNavigate,
  showAdvanced,
  setShowAdvanced,
}: {
  groups: GlobalNavGroup[];
  advanced: GlobalNavItem[];
  collapsed: boolean;
  pathname: string;
  tab: string | null;
  portalActive?: string;
  onPortal?: (tab: string) => void;
  onNavigate?: () => void;
  showAdvanced: boolean;
  setShowAdvanced: (v: boolean) => void;
}) {
  const { lang } = useLang();
  const advActive = advanced.some((i) => isNavItemActive(i, pathname, tab, portalActive));

  useEffect(() => {
    if (advActive) setShowAdvanced(true);
  }, [advActive, setShowAdvanced]);

  return (
    <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-3" style={{ scrollbarWidth: "thin" }}>
      {groups.map((group) => (
        <div key={group.id}>
          {!collapsed && group.labelBn && (
            <div
              className="text-[10px] font-bold uppercase tracking-wider px-2.5 mb-1.5"
              style={{ color: ERP.muted, fontFamily: fontFor(lang) }}
            >
              {lang === "bn" ? group.labelBn : (group.labelEn ?? group.labelBn)}
            </div>
          )}
          {!collapsed && !group.labelBn && group.id !== "home" && (
            <div className="mx-2.5 mb-1.5 border-t" style={{ borderColor: ERP.border }} />
          )}
          <div className="space-y-0.5">
            {group.items.map((item) => (
              <NavLinkButton
                key={item.id}
                item={item}
                active={isNavItemActive(item, pathname, tab, portalActive)}
                collapsed={collapsed}
                onPortal={onPortal}
                onNavigate={onNavigate}
              />
            ))}
          </div>

          {group.id === "settings" && advanced.length > 0 && (
            <AdvancedToolsBlock
              advanced={advanced}
              collapsed={collapsed}
              pathname={pathname}
              tab={tab}
              portalActive={portalActive}
              onNavigate={onNavigate}
              showAdvanced={showAdvanced}
              setShowAdvanced={setShowAdvanced}
              advActive={advActive}
            />
          )}
        </div>
      ))}

      {/* Advanced Tools when Settings group is hidden (e.g. audit-only roles) */}
      {advanced.length > 0 && !groups.some((g) => g.id === "settings") && (
        <div>
          {!collapsed && (
            <div
              className="text-[10px] font-bold uppercase tracking-wider px-2.5 mb-1.5"
              style={{ color: ERP.muted, fontFamily: fontFor(lang) }}
            >
              {lang === "bn" ? "সেটিংস" : "Settings"}
            </div>
          )}
          <AdvancedToolsBlock
            advanced={advanced}
            collapsed={collapsed}
            pathname={pathname}
            tab={tab}
            portalActive={portalActive}
            onNavigate={onNavigate}
            showAdvanced={showAdvanced}
            setShowAdvanced={setShowAdvanced}
            advActive={advActive}
          />
        </div>
      )}
    </nav>
  );
}

function AdvancedToolsBlock({
  advanced,
  collapsed,
  pathname,
  tab,
  portalActive,
  onNavigate,
  showAdvanced,
  setShowAdvanced,
  advActive,
}: {
  advanced: GlobalNavItem[];
  collapsed: boolean;
  pathname: string;
  tab: string | null;
  portalActive?: string;
  onNavigate?: () => void;
  showAdvanced: boolean;
  setShowAdvanced: (v: boolean) => void;
  advActive: boolean;
}) {
  const { lang } = useLang();
  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        title={collapsed ? (lang === "bn" ? "অ্যাডভান্সড টুলস" : "Advanced Tools") : undefined}
        className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg min-h-[44px] transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{
          backgroundColor: advActive || showAdvanced ? ERP.goldDim : "transparent",
          color: ERP.fgDim,
          outlineColor: ERP.accent,
        }}
      >
        <Wrench size={18} style={{ color: ERP.muted, flexShrink: 0 }} />
        {!collapsed && (
          <>
            <span className="text-[13px] font-semibold flex-1 text-left" style={{ fontFamily: fontFor(lang) }}>
              {lang === "bn" ? "অ্যাডভান্সড টুলস" : "Advanced Tools"}
            </span>
            <ChevronDown
              size={14}
              className={`transition-transform ${showAdvanced ? "rotate-180" : ""}`}
              style={{ color: ERP.muted }}
            />
          </>
        )}
      </button>
      {(showAdvanced || collapsed) && (
        <div className={`space-y-0.5 ${collapsed ? "" : "ml-2 pl-2 border-l"}`} style={{ borderColor: ERP.border }}>
          {advanced.map((item) => (
            <NavLinkButton
              key={item.id}
              item={item}
              active={isNavItemActive(item, pathname, tab, portalActive)}
              collapsed={collapsed}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function ERPShell({
  moduleId,
  moduleName,
  moduleColor,
  moduleIcon: ModIcon,
  navItems,
  activeItem,
  onItemClick,
  breadcrumb,
  notificationCount = 0,
  userName,
  userRole,
  children,
}: ERPShellProps) {
  const location = useLocation();
  const viewport = useViewport();
  const isMobile = viewport === "mobile";
  const isTablet = viewport === "tablet";
  /** Desktop expanded by default; tablet starts collapsed (icon rail). */
  const [collapsed, setCollapsed] = useState(isTablet);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showBell, setShowBell] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchVal, setSearchVal] = useState("");
  const [liveFeed, setLiveFeed] = useState<BellItem[] | null>(null);
  const [liveUnread, setLiveUnread] = useState<number | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const { lang, toggleLang } = useLang();
  const profileRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);

  const user = sessionUser() ?? getStoredUser();
  const displayName = userName ?? user?.name ?? "User";
  const displayRole = userRole ?? user?.roleName ?? "";
  const audience = resolveNavAudience(user);
  const navGroups = useMemo(() => groupsForUser(user), [user]);
  const advanced = useMemo(
    () => (audience === "staff" ? filterAdvancedTools(user) : []),
    [audience, user],
  );

  const tab = new URLSearchParams(location.search).get("tab");
  const sidebarCollapsed = isMobile ? false : collapsed;

  // Staff: in-module screens as horizontal tabs. Portals use the primary rail only.
  const showSecondaryTabs = audience === "staff" && navItems.length > 0;

  // Keep tablet collapsed when entering tablet band; desktop restores expansion preference.
  useEffect(() => {
    if (viewport === "tablet") setCollapsed(true);
    if (viewport === "desktop") setCollapsed(false);
    if (viewport !== "mobile") setMobileOpen(false);
  }, [viewport]);

  const loadBell = () => {
    if (!isLoggedIn()) return;
    api.get<NotifLog[]>("/notifications?limit=8").then((rows) => setLiveFeed(rows.map(mapBell))).catch(() => setLiveFeed(null));
    api.get<{ count: number }>("/notifications/unread-count").then((r) => setLiveUnread(r.count)).catch(() => setLiveUnread(null));
  };
  useEffect(() => {
    const t = setTimeout(loadBell, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useNotifyEvents(() => { loadBell(); }, () => { loadBell(); });

  const authed = isLoggedIn();
  const showAutomationLink = canAccessPath("/automation");
  const bellItems = authed ? (liveFeed ?? []) : BELL_NOTIFS;
  const badgeCount = liveUnread ?? notificationCount;

  const markAllRead = () => {
    if (!isLoggedIn()) { toast.success(lang === "bn" ? "সব বিজ্ঞপ্তি পঠিত" : "All notifications marked read", { duration: 2000 }); return; }
    api.post("/notifications/read-all", {}).then(loadBell).catch(() => undefined);
  };
  const markOneRead = (id: string | number) => {
    if (!isLoggedIn() || typeof id !== "string") return;
    api.patch(`/notifications/${id}/read`, {}).then(loadBell).catch(() => undefined);
  };

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setShowProfile(false);
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setShowBell(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  useEffect(() => {
    if (!mobileOpen || !isMobile) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [mobileOpen, isMobile]);

  const initials = displayName.split(" ").map((n) => n[0]).filter(Boolean).slice(0, 2).join("") || "U";
  const modTitle = moduleTitle(moduleId, lang, moduleName);
  const homeLabel = lang === "bn" ? "হোম" : "Home";

  const onPortal = (portalTab: string) => onItemClick(portalTab);
  const closeMobile = () => setMobileOpen(false);

  const iconBtn: CSSProperties = { backgroundColor: ERP.surfaceSoft, border: `1px solid ${ERP.border}`, outlineColor: ERP.accent };

  const sidebarInner = (
    <>
      <div
        className="flex items-center gap-2.5 px-3 h-14 shrink-0"
        style={{ borderBottom: `1px solid ${ERP.border}` }}
      >
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: ERP.goldDim, border: `1px solid ${ERP.goldBrd}` }}
        >
          {sidebarCollapsed ? <ModIcon size={16} style={{ color: moduleColor }} /> : <BrandGlyph size={18} />}
        </div>
        {!sidebarCollapsed && (
          <div className="overflow-hidden min-w-0 flex-1">
            <div className="text-[11px] font-bold truncate leading-tight" style={{ color: ERP.navy, fontFamily: ERP.font.heading, letterSpacing: "0.04em" }}>
              TUBA AL-HIJAZ
            </div>
            <div className="text-[9px] truncate leading-tight" style={{ color: ERP.accent, fontFamily: ERP.font.data, letterSpacing: "0.06em" }}>
              {modTitle}
            </div>
          </div>
        )}
        {isMobile && (
          <button
            type="button"
            onClick={closeMobile}
            className="ml-auto w-11 h-11 rounded-lg flex items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            aria-label={lang === "bn" ? "মেনু বন্ধ" : "Close menu"}
            style={{ outlineColor: ERP.accent }}
          >
            <X size={18} style={{ color: ERP.muted }} />
          </button>
        )}
      </div>

      <SidebarNav
        groups={navGroups}
        advanced={advanced}
        collapsed={sidebarCollapsed}
        pathname={location.pathname}
        tab={tab}
        portalActive={audience === "agent" || audience === "supplier" ? activeItem : undefined}
        onPortal={audience === "agent" || audience === "supplier" ? onPortal : undefined}
        onNavigate={closeMobile}
        showAdvanced={showAdvanced}
        setShowAdvanced={setShowAdvanced}
      />

      {/* Sidebar footer — signed-in user */}
      {!isMobile && (
        <div className="flex items-center gap-2.5 px-3 py-2.5 shrink-0" style={{ borderTop: `1px solid ${ERP.border}` }}>
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
            style={{ backgroundColor: ERP.goldDim, border: `1px solid ${ERP.goldBrd}`, color: ERP.accent }}
          >
            {initials}
          </div>
          {!sidebarCollapsed && (
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold truncate" style={{ color: ERP.navy, fontFamily: fontFor(lang) }}>{displayName}</div>
              <div className="text-[9px] truncate" style={{ color: ERP.accent, fontFamily: ERP.font.data }}>{displayRole}</div>
            </div>
          )}
        </div>
      )}

      {!isMobile && (
        <div className="px-2 py-2.5" style={{ borderTop: `1px solid ${ERP.border}` }}>
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg transition-all min-h-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ color: ERP.muted, outlineColor: ERP.accent }}
            title={collapsed ? (lang === "bn" ? "প্রসারিত" : "Expand") : (lang === "bn" ? "সংকুচিত" : "Collapse")}
            aria-expanded={!collapsed}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = ERP.goldDim; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
          >
            {collapsed ? (
              <ChevronRight size={16} />
            ) : (
              <>
                <ChevronLeft size={16} />
                <span className="text-xs" style={{ fontFamily: fontFor(lang) }}>
                  {lang === "bn" ? "সংকুচিত" : "Collapse"}
                </span>
              </>
            )}
          </button>
        </div>
      )}
    </>
  );

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ fontFamily: fontFor(lang), backgroundColor: ERP.canvas, color: ERP.navy }}
    >
      {/* Desktop + tablet permanent sidebar */}
      {!isMobile && (
        <aside
          className="flex flex-col shrink-0 transition-all duration-200 overflow-hidden"
          style={{
            width: collapsed ? 64 : 240,
            backgroundColor: ERP.surfaceSoft,
            borderRight: `1px solid ${ERP.border}`,
          }}
          aria-label={lang === "bn" ? "প্রাথমিক নেভিগেশন" : "Primary navigation"}
        >
          {sidebarInner}
        </aside>
      )}

      {/* Mobile overlay drawer */}
      {isMobile && mobileOpen && (
        <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label={lang === "bn" ? "নেভিগেশন" : "Navigation"}>
          <button
            type="button"
            className="absolute inset-0"
            style={{ backgroundColor: ERP.scrim }}
            aria-label={lang === "bn" ? "ওভারলে বন্ধ" : "Close overlay"}
            onClick={closeMobile}
          />
          <aside
            className="relative flex flex-col h-full z-10"
            style={{ width: "min(280px, 100vw)", maxWidth: "100vw", backgroundColor: ERP.surfaceSoft, borderRight: `1px solid ${ERP.border}`, boxShadow: ERP.shadow.xl }}
          >
            {sidebarInner}
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header
          className="flex items-center gap-2 sm:gap-3 px-3 sm:px-5 h-14 shrink-0"
          style={{ backgroundColor: ERP.surfaceSoft, borderBottom: `1px solid ${ERP.border}` }}
        >
          {isMobile && (
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={iconBtn}
              aria-label={lang === "bn" ? "মেনু খুলুন" : "Open menu"}
            >
              <Menu size={18} style={{ color: ERP.navy }} />
            </button>
          )}

          {/* Breadcrumb: Home → Module → Current */}
          <div className="flex items-center gap-1.5 flex-1 min-w-0 text-xs">
            <Link to="/" style={{ color: ERP.muted, fontFamily: fontFor(lang) }}>
              {homeLabel}
            </Link>
            <ChevronRight size={12} style={{ color: ERP.muted, flexShrink: 0 }} />
            <span className="font-semibold shrink-0" style={{ color: moduleColor, fontFamily: fontFor(lang) }}>
              {modTitle}
            </span>
            {breadcrumb.map((c, i) => (
              <span key={`${c}-${i}`} className="flex items-center gap-1.5 min-w-0">
                <ChevronRight size={12} style={{ color: ERP.muted, flexShrink: 0 }} />
                <span
                  className="truncate"
                  style={{
                    color: i === breadcrumb.length - 1 ? ERP.navy : ERP.fgDim,
                    fontWeight: i === breadcrumb.length - 1 ? 600 : 400,
                    fontFamily: fontFor(lang),
                  }}
                >
                  {c}
                </span>
              </span>
            ))}
          </div>

          {/* LIVE indicator */}
          <div className="hidden md:flex items-center gap-1.5 shrink-0 mr-1">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: ERP.success, boxShadow: `0 0 6px ${ERP.success}` }} />
            <span className="text-[9px] font-bold" style={{ color: ERP.success, fontFamily: ERP.font.data, letterSpacing: "0.08em" }}>LIVE</span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {searchOpen ? (
              <input
                autoFocus
                value={searchVal}
                onChange={(e) => setSearchVal(e.target.value)}
                onBlur={() => { setSearchOpen(false); setSearchVal(""); }}
                placeholder={lang === "bn" ? "অনুসন্ধান…" : "Search…"}
                className="w-40 sm:w-52 px-3 py-2 rounded-lg text-xs focus:outline-none"
                style={{
                  backgroundColor: ERP.surfaceSoft,
                  border: `1px solid ${ERP.goldBrd}`,
                  color: ERP.navy,
                  fontFamily: fontFor(lang),
                }}
              />
            ) : (
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="w-11 h-11 rounded-lg flex items-center justify-center transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={iconBtn}
                aria-label={lang === "bn" ? "অনুসন্ধান" : "Search"}
              >
                <Search size={16} style={{ color: ERP.muted }} />
              </button>
            )}

            <div ref={bellRef} className="relative">
              <button
                type="button"
                onClick={() => { const next = !showBell; setShowBell(next); if (next) loadBell(); }}
                className="w-11 h-11 rounded-lg flex items-center justify-center relative transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ backgroundColor: showBell ? ERP.goldDim : ERP.surfaceSoft, border: `1px solid ${showBell ? ERP.goldBrd : ERP.border}`, outlineColor: ERP.accent }}
                aria-label={lang === "bn" ? "বিজ্ঞপ্তি" : "Notifications"}
              >
                <Bell size={16} style={{ color: showBell ? ERP.accent : ERP.muted }} />
                {badgeCount > 0 && (
                  <span
                    className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 rounded-full text-[9px] font-bold flex items-center justify-center"
                    style={{ backgroundColor: ERP.accent, color: ERP.canvas }}
                  >
                    {badgeCount > 9 ? "9+" : badgeCount}
                  </span>
                )}
              </button>

              {showBell && (
                <div
                  className="absolute right-0 top-12 w-[min(20rem,calc(100vw-1rem))] rounded-xl overflow-hidden z-50"
                  style={{ backgroundColor: ERP.surface, border: `1px solid ${ERP.border}`, boxShadow: ERP.shadow.lg }}
                >
                  <div
                    className="flex items-center justify-between px-4 py-3"
                    style={{ borderBottom: `1px solid ${ERP.border}` }}
                  >
                    <span className="text-xs font-bold" style={{ color: ERP.navy, fontFamily: fontFor(lang) }}>
                      {lang === "bn" ? "বিজ্ঞপ্তি" : "Notifications"}
                    </span>
                    <button
                      type="button"
                      onClick={markAllRead}
                      className="text-[10px] font-bold transition-opacity hover:opacity-70"
                      style={{ color: ERP.accent, fontFamily: fontFor(lang) }}
                    >
                      {lang === "bn" ? "সব পঠিত" : "Mark all read"}
                    </button>
                  </div>
                  {authed && bellItems.length === 0 ? (
                    <EmptyState
                      title={lang === "bn" ? "কোনো বিজ্ঞপ্তি নেই" : "No notifications"}
                      hint={lang === "bn" ? "আপনি আপ টু ডেট।" : "You're all caught up."}
                    />
                  ) : bellItems.map((n, i) => (
                    <div
                      key={n.id}
                      onClick={() => markOneRead(n.id)}
                      className="flex items-start gap-3 px-4 py-3 cursor-pointer"
                      style={{
                        borderBottom: i < bellItems.length - 1 ? `1px solid ${ERP.border}` : undefined,
                        borderLeft: `3px solid ${n.urgent ? ERP.destructive : "transparent"}`,
                        backgroundColor: n.urgent ? ERP.destructiveDim : "transparent",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = ERP.surfaceSoft; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = n.urgent ? ERP.destructiveDim : "transparent"; }}
                    >
                      {n.urgent
                        ? <AlertTriangle size={12} className="mt-0.5 shrink-0" style={{ color: ERP.destructive }} />
                        : <div className="w-1.5 h-1.5 rounded-full mt-2 shrink-0" style={{ backgroundColor: ERP.accent }} />}
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-semibold" style={{ color: n.urgent ? ERP.destructive : ERP.navy }}>{n.title}</div>
                        <div className="text-[10px] mt-0.5 truncate" style={{ color: ERP.fgDim }}>{n.sub}</div>
                      </div>
                      <span className="text-[10px] shrink-0 mt-0.5" style={{ color: ERP.muted, fontFamily: ERP.font.data }}>{n.time}</span>
                    </div>
                  ))}
                  {showAutomationLink && (
                    <div className="px-4 py-2.5 text-center" style={{ borderTop: `1px solid ${ERP.border}` }}>
                      <Link
                        to="/automation?tab=notifications"
                        className="text-[10px] font-bold transition-opacity hover:opacity-75"
                        style={{ color: ERP.accent, fontFamily: fontFor(lang) }}
                        onClick={() => setShowBell(false)}
                      >
                        {lang === "bn" ? "বিজ্ঞপ্তি কেন্দ্র →" : "Notification Center →"}
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={toggleLang}
              className="h-11 min-h-[44px] px-3 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ backgroundColor: ERP.surfaceSoft, color: ERP.fgDim, border: `1px solid ${ERP.border}`, outlineColor: ERP.accent }}
              aria-label={lang === "bn" ? "ভাষা পরিবর্তন" : "Change language"}
            >
              <Globe2 size={14} />
              <span style={{ fontFamily: lang === "bn" ? "var(--font-bengali)" : ERP.font.heading }}>
                {lang === "bn" ? "বাং" : "EN"}
              </span>
            </button>

            <div ref={profileRef} className="relative">
              <button
                type="button"
                onClick={() => setShowProfile(!showProfile)}
                className="flex items-center gap-2 h-11 min-h-[44px] pl-1 pr-2.5 rounded-lg transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ backgroundColor: ERP.surfaceSoft, border: `1px solid ${ERP.border}`, outlineColor: ERP.accent }}
                aria-expanded={showProfile}
                aria-label={lang === "bn" ? "প্রোফাইল মেনু" : "Profile menu"}
              >
                <div
                  className="w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold"
                  style={{ backgroundColor: ERP.goldDim, border: `1px solid ${ERP.goldBrd}`, color: moduleColor }}
                >
                  {initials}
                </div>
                <span className="text-xs font-semibold hidden sm:block" style={{ color: ERP.navy }}>
                  {displayName.split(" ")[0]}
                </span>
                <ChevronDown
                  size={12}
                  style={{ color: ERP.muted }}
                  className={`transition-transform ${showProfile ? "rotate-180" : ""}`}
                />
              </button>

              {showProfile && (
                <div
                  className="absolute right-0 top-12 w-52 rounded-xl overflow-hidden z-50"
                  style={{ backgroundColor: ERP.surface, border: `1px solid ${ERP.border}`, boxShadow: ERP.shadow.lg }}
                >
                  <div className="px-4 py-3" style={{ borderBottom: `1px solid ${ERP.border}` }}>
                    <div className="text-xs font-bold" style={{ color: ERP.navy }}>{displayName}</div>
                    <div className="text-[10px] mt-0.5" style={{ color: moduleColor }}>{displayRole}</div>
                  </div>
                  {([
                    { icon: User, label: lang === "bn" ? "প্রোফাইল" : "My Profile" },
                    { icon: Settings, label: lang === "bn" ? "পছন্দসমূহ" : "Preferences" },
                  ] as { icon: IconFC; label: string }[]).map(({ icon: Icon, label }) => (
                    <button
                      key={label}
                      type="button"
                      className="w-full flex items-center gap-3 px-4 py-2.5 transition-all"
                      style={{ color: ERP.fgDim }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = ERP.surfaceSoft; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                    >
                      <Icon size={14} />
                      <span className="text-xs" style={{ fontFamily: fontFor(lang) }}>{label}</span>
                    </button>
                  ))}
                  <div style={{ borderTop: `1px solid ${ERP.border}` }}>
                    <Link
                      to="/login"
                      className="flex items-center gap-3 px-4 py-2.5 transition-all"
                      style={{ color: ERP.destructive }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = ERP.destructiveDim; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                      onClick={() => {
                        void api.logout().catch(() => undefined);
                        toast.info(lang === "bn" ? "সাইন আউট হয়েছে" : "Signed out of TUBA portal", { duration: 2500 });
                      }}
                    >
                      <LogOut size={14} />
                      <span className="text-xs font-medium" style={{ fontFamily: fontFor(lang) }}>
                        {lang === "bn" ? "সাইন আউট" : "Sign Out"}
                      </span>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Secondary module tabs (staff in-module screens) */}
        {showSecondaryTabs && (
          <div
            className="flex items-center gap-1 px-3 sm:px-5 py-2 overflow-x-auto shrink-0"
            style={{
              backgroundColor: ERP.surfaceSoft,
              borderBottom: `1px solid ${ERP.border}`,
              WebkitOverflowScrolling: "touch",
            }}
            role="tablist"
            aria-label={lang === "bn" ? "মডিউল ট্যাব" : "Module tabs"}
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const isA = item.id === activeItem;
              const label = secondaryLabel(item, lang);
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={isA}
                  onClick={() => onItemClick(item.id)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap min-h-[44px] transition-all active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{
                    backgroundColor: isA ? ERP.goldDim : "transparent",
                    color: isA ? moduleColor : ERP.fgDim,
                    border: `1px solid ${isA ? ERP.goldBrd : "transparent"}`,
                    fontFamily: fontFor(lang),
                    outlineColor: ERP.accent,
                  }}
                >
                  <Icon size={14} style={{ color: isA ? moduleColor : ERP.muted }} />
                  {label}
                  {item.badge !== undefined && (
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{
                        backgroundColor: typeof item.badge === "number" && item.badge > 0 ? ERP.goldDim : ERP.surfaceSoft,
                        color: typeof item.badge === "number" && item.badge > 0 ? ERP.accent : ERP.muted,
                      }}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <main
          id="erp-main"
          className="flex-1 overflow-y-auto overflow-x-hidden min-w-0"
          style={{ backgroundColor: ERP.canvas, scrollbarWidth: "thin", scrollbarColor: `${ERP.border} transparent` }}
          tabIndex={-1}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
