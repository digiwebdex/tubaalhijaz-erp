/**
 * UI-02 — Global operations navigation (UX only).
 * Visibility uses existing `canAccessPath` / permissions — no new RBAC.
 */
import type { CSSProperties } from "react";
import {
  LayoutDashboard, Users, Building2, UserRound, FileCheck, CalendarDays,
  Wallet, BarChart3, ScanLine, Zap, ClipboardCheck,
  Bell, Truck, Navigation, Building, Bus, UtensilsCrossed, Shield,
  FileText, LayoutGrid, Plane, UserCog, ScrollText, ShieldCheck, Gauge, MessageCircle, BellRing, FileCode, Inbox, Workflow, SlidersHorizontal, type LucideIcon,
} from "lucide-react";
import {
  canAccessPath,
  hasAnyPermission,
  isAgentCompany,
  isSupplierCompany,
  isPlatformStaff,
  P,
  sessionUser,
} from "./rbac";
import type { ApiUser } from "./api";
import type { Lang } from "@tuba/shared";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type NavIcon = (props: { size?: number; style?: CSSProperties; className?: string }) => any;

export type GlobalNavItem = {
  id: string;
  labelBn: string;
  labelEn: string;
  icon: NavIcon;
  /** React Router path (may include ?tab=). */
  path: string;
  /** Pathname used for active matching (defaults to path without query). */
  matchPath?: string;
  /** When set, active only if ?tab= matches (or absent when matchTab is default). */
  matchTab?: string;
  /** Any-of permissions; if omitted, `canAccessPath(matchPath || path)` is used. */
  anyOf?: readonly string[];
  /** Portal-only: fire shell onItemClick with this id instead of routing. */
  portalTab?: string;
  advanced?: boolean;
};

export type GlobalNavGroup = {
  id: string;
  labelBn?: string;
  labelEn?: string;
  items: GlobalNavItem[];
};

function asIcon(icon: LucideIcon): NavIcon {
  return icon as unknown as NavIcon;
}

/** Staff — operations-first primary rail. */
export const STAFF_NAV_GROUPS: GlobalNavGroup[] = [
  {
    id: "home",
    items: [
      { id: "inbox", labelBn: "ইনবক্স", labelEn: "Inbox", icon: asIcon(Inbox), path: "/inbox" },
      {
        id: "dashboard",
        labelBn: "ড্যাশবোর্ড",
        labelEn: "Dashboard",
        icon: asIcon(LayoutDashboard),
        path: "/dashboards",
        anyOf: [P.VIEW_DASHBOARD],
      },
    ],
  },
  {
    id: "parties",
    items: [
      {
        id: "agents",
        labelBn: "এজেন্ট",
        labelEn: "Agents",
        icon: asIcon(Users),
        path: "/super-admin?tab=companies",
        matchPath: "/super-admin",
        matchTab: "companies",
        anyOf: [P.APPROVE_COMPANIES],
      },
      {
        id: "suppliers",
        labelBn: "সাপ্লায়ার",
        labelEn: "Suppliers",
        icon: asIcon(Building2),
        path: "/super-admin?tab=companies",
        matchPath: "/super-admin",
        matchTab: "companies",
        anyOf: [P.APPROVE_COMPANIES],
      },
    ],
  },
  {
    id: "ops-core",
    items: [
      { id: "my-workflow", labelBn: "আমার ওয়ার্কফ্লো", labelEn: "My Workflow", icon: asIcon(Workflow), path: "/my-workflow" },
      {
        id: "groups",
        labelBn: "গ্রুপ",
        labelEn: "Groups",
        icon: asIcon(Users),
        path: "/ops-control?tab=groups",
        matchPath: "/ops-control",
        matchTab: "groups",
        anyOf: [P.VIEW_DASHBOARD],
      },
      {
        id: "passengers",
        labelBn: "যাত্রী",
        labelEn: "Passengers",
        icon: asIcon(UserRound),
        path: "/ops-control?tab=groups",
        matchPath: "/ops-control",
        matchTab: "groups",
        anyOf: [P.VIEW_DASHBOARD],
      },
      {
        id: "flight-management",
        labelBn: "ফ্লাইট ব্যবস্থাপনা",
        labelEn: "Flight Management",
        icon: asIcon(Plane),
        path: "/flight-management",
        anyOf: [P.MANAGE_OPS],
      },
    ],
  },
  {
    id: "desks",
    items: [
      {
        id: "visa-desk",
        labelBn: "ভিসা ডেস্ক",
        labelEn: "Visa Desk",
        icon: asIcon(FileCheck),
        path: "/ops-departments",
        anyOf: [P.VIEW_DASHBOARD],
      },
      {
        id: "long-stay",
        labelBn: "লং স্টে",
        labelEn: "Long Stay",
        icon: asIcon(CalendarDays),
        path: "/ops-control?tab=longstay",
        matchPath: "/ops-control",
        matchTab: "longstay",
        anyOf: [P.VIEW_DASHBOARD],
      },
      {
        id: "hotel",
        labelBn: "হোটেল",
        labelEn: "Hotel",
        icon: asIcon(Building),
        path: "/ops-departments",
        anyOf: [P.VIEW_DASHBOARD],
      },
      {
        id: "transport",
        labelBn: "পরিবহন",
        labelEn: "Transport",
        icon: asIcon(Bus),
        path: "/ops-departments",
        anyOf: [P.VIEW_DASHBOARD],
      },
      {
        id: "catering",
        labelBn: "খাদ্য সেবা",
        labelEn: "Catering",
        icon: asIcon(UtensilsCrossed),
        path: "/ops-departments",
        anyOf: [P.VIEW_DASHBOARD],
      },
      {
        id: "dispatch",
        labelBn: "ডিসপ্যাচ",
        labelEn: "Dispatch",
        icon: asIcon(Navigation),
        path: "/ops-control?tab=dispatch",
        matchPath: "/ops-control",
        matchTab: "dispatch",
        anyOf: [P.VIEW_DASHBOARD],
      },
      {
        id: "fleet",
        labelBn: "ফ্লিট",
        labelEn: "Fleet",
        icon: asIcon(Truck),
        path: "/fleet-erp",
        anyOf: [P.MANAGE_FLEET],
      },
    ],
  },
  {
    id: "finance",
    items: [
      {
        id: "finance",
        labelBn: "হিসাব",
        labelEn: "Finance",
        icon: asIcon(Wallet),
        path: "/finance-erp",
        anyOf: [P.FINANCIAL_REPORTS],
      },
    ],
  },
  {
    id: "reports",
    items: [
      {
        id: "reports",
        labelBn: "রিপোর্ট",
        labelEn: "Reports",
        icon: asIcon(BarChart3),
        path: "/dashboards",
        anyOf: [P.VIEW_DASHBOARD, P.FINANCIAL_REPORTS],
      },
    ],
  },
  {
    id: "settings",
    labelBn: "সেটিংস",
    labelEn: "Settings",
    items: [
      {
        id: "settings-hub",
        labelBn: "সিস্টেম প্রশাসন",
        labelEn: "System Administration",
        icon: asIcon(SlidersHorizontal),
        path: "/settings",
        anyOf: [P.MANAGE_SYSTEM_SETTINGS, P.APPROVE_COMPANIES, P.MANAGE_USERS],
      },
      {
        id: "users",
        labelBn: "ব্যবহারকারী",
        labelEn: "Users & Roles",
        icon: asIcon(Shield),
        path: "/super-admin?tab=users",
        matchPath: "/super-admin",
        matchTab: "users",
        anyOf: [P.MANAGE_USERS],
      },
      {
        id: "sa-dashboard",
        labelBn: "অ্যাডমিন ড্যাশবোর্ড",
        labelEn: "Admin Dashboard",
        icon: asIcon(LayoutDashboard),
        path: "/super-admin?tab=dashboard",
        matchPath: "/super-admin",
        matchTab: "dashboard",
        anyOf: [P.MANAGE_USERS, P.APPROVE_COMPANIES, P.MANAGE_SYSTEM_SETTINGS],
      },
      // System Settings / AI / Workflow engines have no production backend UI yet —
      // SA ?tab=settings|ai-engine|workflows still renders an honest Bangla empty state.
    ],
  },
  {
    id: "administration",
    labelBn: "প্রশাসন",
    labelEn: "Administration",
    items: [
      { id: "agent-operations", labelBn: "এজেন্ট অপারেশনস", labelEn: "Agent Operations", icon: asIcon(UserCog), path: "/agent-operations", anyOf: [P.AGENT_IMPERSONATION] },
      { id: "audit-center", labelBn: "অডিট কেন্দ্র", labelEn: "Audit Center", icon: asIcon(ScrollText), path: "/audit-center", anyOf: [P.ACCESS_AUDIT_LOGS] },
      { id: "approvals", labelBn: "অনুমোদন", labelEn: "Approvals", icon: asIcon(ShieldCheck), path: "/approvals", anyOf: [P.MANAGE_OPS] },
      { id: "sla-dashboard", labelBn: "এসএলএ", labelEn: "SLA Dashboard", icon: asIcon(Gauge), path: "/sla-dashboard", anyOf: [P.VIEW_DASHBOARD] },
      { id: "wasender-config", labelBn: "ওয়াসেন্ডার", labelEn: "WaSender", icon: asIcon(MessageCircle), path: "/wasender-config", anyOf: [P.MANAGE_SYSTEM_SETTINGS] },
      { id: "notification-center", labelBn: "নোটিফিকেশন সেন্টার", labelEn: "Notification Center", icon: asIcon(BellRing), path: "/notification-center", anyOf: [P.MANAGE_SYSTEM_SETTINGS] },
      { id: "template-manager", labelBn: "টেমপ্লেট", labelEn: "Template Manager", icon: asIcon(FileCode), path: "/template-manager", anyOf: [P.MANAGE_SYSTEM_SETTINGS] },
    ],
  },
];

/** Settings → Advanced Tools (not top-level). */
export const ADVANCED_TOOLS: GlobalNavItem[] = [
  {
    id: "adv-ocr",
    labelBn: "ওসিআর কেন্দ্র",
    labelEn: "OCR Center",
    icon: asIcon(ScanLine),
    path: "/ocr-center",
    anyOf: [P.REVIEW_OCR_QUEUE],
    advanced: true,
  },
  {
    id: "adv-automation",
    labelBn: "অটোমেশন",
    labelEn: "Automation Engine",
    icon: asIcon(Zap),
    path: "/automation",
    anyOf: [P.CONFIGURE_WORKFLOWS],
    advanced: true,
  },
  {
    id: "adv-audit",
    labelBn: "অডিট লগ",
    labelEn: "Audit Logs",
    icon: asIcon(ClipboardCheck),
    path: "/super-admin?tab=audit",
    matchPath: "/super-admin",
    matchTab: "audit",
    anyOf: [P.ACCESS_AUDIT_LOGS],
    advanced: true,
  },
  {
    id: "adv-notifications",
    labelBn: "বিজ্ঞপ্তি কেন্দ্র",
    labelEn: "Notification Center",
    icon: asIcon(Bell),
    path: "/automation?tab=notifications",
    matchPath: "/automation",
    matchTab: "notifications",
    anyOf: [P.CONFIGURE_WORKFLOWS, P.MANAGE_SYSTEM_SETTINGS],
    advanced: true,
  },
];

/** Agent portal primary items (same route — tab via onItemClick). */
export const AGENT_NAV_GROUPS: GlobalNavGroup[] = [
  {
    id: "agent-main",
    items: [
      { id: "a-dash", labelBn: "ড্যাশবোর্ড", labelEn: "Dashboard", icon: asIcon(LayoutDashboard), path: "/agent-portal", portalTab: "dashboard" },
      { id: "a-groups", labelBn: "আমার গ্রুপ", labelEn: "My Groups", icon: asIcon(Users), path: "/agent-portal", portalTab: "groups" },
      { id: "a-pax", labelBn: "যাত্রী", labelEn: "Passengers", icon: asIcon(UserRound), path: "/agent-portal", portalTab: "groups" },
      { id: "a-visa", labelBn: "ভিসা স্ট্যাটাস", labelEn: "Visa Status", icon: asIcon(FileCheck), path: "/agent-portal", portalTab: "visas" },
      { id: "a-pay", labelBn: "পেমেন্ট", labelEn: "Payments", icon: asIcon(Wallet), path: "/agent-portal", portalTab: "finance" },
    ],
  },
  {
    id: "agent-more",
    labelBn: "আরও",
    labelEn: "More",
    items: [
      { id: "a-profile", labelBn: "কোম্পানি প্রোফাইল", labelEn: "Company Profile", icon: asIcon(Building2), path: "/agent-portal", portalTab: "profile" },
      { id: "a-docs", labelBn: "নথিপত্র", labelEn: "Documents", icon: asIcon(FileText), path: "/agent-portal", portalTab: "documents" },
      { id: "a-hotel", labelBn: "হোটেল", labelEn: "Hotels", icon: asIcon(Building), path: "/agent-portal", portalTab: "hotels" },
      { id: "a-transport", labelBn: "পরিবহন", labelEn: "Transport", icon: asIcon(Bus), path: "/agent-portal", portalTab: "transport" },
      // Support desk has no backend — removed from production nav (screen still safe if deep-linked).
    ],
  },
];

/** Supplier portal primary items. */
export const SUPPLIER_NAV_GROUPS: GlobalNavGroup[] = [
  {
    id: "sup-main",
    items: [
      { id: "s-dash", labelBn: "ড্যাশবোর্ড", labelEn: "Dashboard", icon: asIcon(LayoutDashboard), path: "/supplier-portal", portalTab: "dashboard" },
      { id: "s-book", labelBn: "বুকিং", labelEn: "Bookings", icon: asIcon(LayoutGrid), path: "/supplier-portal", portalTab: "bookings" },
      { id: "s-vouch", labelBn: "ভাউচার", labelEn: "Vouchers", icon: asIcon(FileText), path: "/supplier-portal", portalTab: "vouchers" },
      { id: "s-inv", labelBn: "চালান", labelEn: "Invoices", icon: asIcon(Wallet), path: "/supplier-portal", portalTab: "invoices" },
      // Statement / payouts deferred — no supplier ledger API in this release.
    ],
  },
];

export function navLabel(item: { labelBn: string; labelEn: string }, lang: Lang): string {
  return lang === "bn" ? item.labelBn : item.labelEn;
}

export function itemVisible(item: GlobalNavItem, user: ApiUser | null = sessionUser()): boolean {
  if (!user) return false;
  if (item.portalTab) {
    if (item.path === "/agent-portal") return isAgentCompany(user);
    if (item.path === "/supplier-portal") return isSupplierCompany(user);
    return false;
  }
  if (item.anyOf?.length) return hasAnyPermission(item.anyOf, user);
  const base = (item.matchPath ?? item.path).split("?")[0];
  return canAccessPath(base, user);
}

export function filterNavGroups(
  groups: GlobalNavGroup[],
  user: ApiUser | null = sessionUser(),
): GlobalNavGroup[] {
  return groups
    .map((g) => ({ ...g, items: g.items.filter((i) => itemVisible(i, user)) }))
    .filter((g) => g.items.length > 0);
}

export function filterAdvancedTools(user: ApiUser | null = sessionUser()): GlobalNavItem[] {
  return ADVANCED_TOOLS.filter((i) => itemVisible(i, user));
}

export function resolveNavAudience(user: ApiUser | null = sessionUser()): "staff" | "agent" | "supplier" | null {
  if (!user) return null;
  if (isAgentCompany(user)) return "agent";
  if (isSupplierCompany(user)) return "supplier";
  if (isPlatformStaff(user)) return "staff";
  return null;
}

export function groupsForUser(user: ApiUser | null = sessionUser()): GlobalNavGroup[] {
  const audience = resolveNavAudience(user);
  if (audience === "agent") return filterNavGroups(AGENT_NAV_GROUPS, user);
  if (audience === "supplier") return filterNavGroups(SUPPLIER_NAV_GROUPS, user);
  if (audience === "staff") return filterNavGroups(STAFF_NAV_GROUPS, user);
  return [];
}

/** Module title for breadcrumb (by ERPShell moduleId). */
export const MODULE_TITLE: Record<string, { bn: string; en: string }> = {
  dashboards: { bn: "ড্যাশবোর্ড", en: "Dashboards" },
  departments: { bn: "ডিপার্টমেন্ট", en: "Departments" },
  ops: { bn: "অপারেশন", en: "Operations" },
  finance: { bn: "হিসাব", en: "Finance" },
  fleet: { bn: "ফ্লিট", en: "Fleet" },
  "super-admin": { bn: "সুপার অ্যাডমিন", en: "Super Admin" },
  "agent-portal": { bn: "এজেন্ট পোর্টাল", en: "Agent Portal" },
  supplier: { bn: "সাপ্লায়ার পোর্টাল", en: "Supplier Portal" },
  automation: { bn: "অটোমেশন", en: "Automation" },
  ocr: { bn: "ওসিআর কেন্দ্র", en: "OCR Center" },
  mobile: { bn: "মোবাইল", en: "Mobile Apps" },
};

export function moduleTitle(moduleId: string, lang: Lang, fallback: string): string {
  const m = MODULE_TITLE[moduleId];
  if (!m) return fallback;
  return lang === "bn" ? m.bn : m.en;
}

export function isNavItemActive(
  item: GlobalNavItem,
  pathname: string,
  tab: string | null,
  portalActive?: string,
): boolean {
  if (item.portalTab) {
    return portalActive === item.portalTab;
  }
  const base = (item.matchPath ?? item.path.split("?")[0]).replace(/\/$/, "") || "/";
  const here = pathname.replace(/\/$/, "") || "/";
  if (here !== base) return false;
  if (item.matchTab) {
    // When tab query absent, treat first screen of that module as inactive for tabbed links
    return tab === item.matchTab;
  }
  return true;
}
