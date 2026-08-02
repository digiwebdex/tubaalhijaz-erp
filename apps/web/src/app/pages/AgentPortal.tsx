import { useState, useEffect, useRef, lazy, Suspense, type ChangeEvent } from "react";
import { toast } from "sonner";
import {
  LayoutDashboard, Building2, FileText, Users, FileCheck, Building, Bus,
  Wallet, MessageCircle, AlertCircle,
  Clock, RefreshCw, Eye, Upload,
  Plus, Download, LayoutGrid, List,
  Search,
} from "lucide-react";
import { ERPShell, type NavItem, type IconFC } from "../components/ERPShell";
import { EmptyState, LoadingSkeleton, ErrorState } from "../components/States";
import { RouteFallback } from "../components/RouteFallback";
import { api, ApiError, isLoggedIn, getStoredUser, type UploadKind } from "../lib/api";
import {
  ErpPageTemplate, ErpButton, ErpDataTable, ErpStatusChip,
  type ErpColumn, type ErpStatusKind,
} from "../components/erp";
import { useLang } from "../lib/LangContext";
import { fontFor } from "@tuba/shared";

/** ESP-03 — load heavy agent desks only when selected (same modules / props). */
const GroupsModule = lazy(() =>
  import("./AgentPortalGroups").then((m) => ({ default: m.GroupsModule })),
);
const FinanceModule = lazy(() =>
  import("./AgentPortalFinance").then((m) => ({ default: m.FinanceModule })),
);
const ServicesModule = lazy(() =>
  import("./AgentPortalServices").then((m) => ({ default: m.ServicesModule })),
);

const AGENT = "#0EA5E9"; // sky-500 — agent portal accent
const GOLD = "#C9A24B";

// ─── Nav items ────────────────────────────────────────────────────────────────

const AGENT_NAV: NavItem[] = [
  { id: "dashboard",  label: "Dashboard",         icon: LayoutDashboard as IconFC },
  { id: "profile",    label: "Company Profile",    icon: Building2 as IconFC },
  { id: "documents",  label: "Documents Vault",    icon: FileText as IconFC },
  { id: "groups",     label: "My Groups",          icon: Users as IconFC },
  { id: "visas",      label: "Visa Applications",  icon: FileCheck as IconFC },
  { id: "hotels",     label: "Hotel Bookings",     icon: Building as IconFC },
  { id: "transport",  label: "Transport",          icon: Bus as IconFC },
  { id: "finance",    label: "Finance & Billing",  icon: Wallet as IconFC },
  { id: "support",    label: "Support",            icon: MessageCircle as IconFC },
];

const SCREEN_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  profile:   "Company Profile",
  documents: "Documents Vault",
  groups:    "My Groups",
  visas:     "Visa Applications",
  hotels:    "Hotel Bookings",
  transport: "Transport",
  finance:   "Finance & Billing",
  support:   "Support",
};

// ─── (prototype dashboard feeds & vault demo removed — screens are live/empty) ─

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysUntil(iso: string): number {
  const today = new Date("2025-07-16");
  const exp = new Date(iso);
  return Math.ceil((exp.getTime() - today.getTime()) / 86400000);
}

function ExpiryTag({ expiry, severity, daysLeft }: { expiry: string | null; severity?: string | null; daysLeft?: number | null }) {
  // Live vault rows carry the backend-computed severity/daysLeft (evaluated against
  // the real "today"); mock rows omit them and fall back to the pinned date math
  // below. Both paths render byte-identical markup — only the values differ.
  if (severity !== undefined) {
    if (severity === null || daysLeft == null)
      return <span className="text-[10px]" style={{ color: "rgba(11,30,63,0.50)" }}>No Expiry</span>;
    const color = severity === "EXPIRED" || severity === "CRITICAL" ? "#DC2626" : severity === "WARNING" ? "#B45309" : "#16A34A";
    const label = severity === "EXPIRED" ? "Expired" : severity === "CRITICAL" ? `Expires in ${daysLeft}d` : severity === "WARNING" ? `${daysLeft}d remaining` : `Valid · ${daysLeft}d`;
    return (
      <span
        className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
        style={{ backgroundColor: `${color}18`, color }}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
        {label}
      </span>
    );
  }
  if (!expiry) return <span className="text-[10px]" style={{ color: "rgba(11,30,63,0.50)" }}>No Expiry</span>;
  const d = daysUntil(expiry);
  const color = d < 0 ? "#DC2626" : d < 30 ? "#DC2626" : d < 90 ? "#B45309" : "#16A34A";
  const label = d < 0 ? "Expired" : d < 30 ? `Expires in ${d}d` : d < 90 ? `${d}d remaining` : `Valid · ${d}d`;
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
      style={{ backgroundColor: `${color}18`, color }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function SBadge({ status }: { status: string }) {
  const MAP: Record<string, { bg: string; color: string; label: string }> = {
    verified:    { bg: "#16A34A15", color: "#16A34A",               label: "Verified" },
    pending:     { bg: "#D9770618", color: "#B45309",               label: "Pending" },
    review:      { bg: "#2563EB15", color: "#2563EB",               label: "Under Review" },
    rejected:    { bg: "#DC262615", color: "#DC2626",               label: "Rejected" },
    in_progress: { bg: "#2563EB15", color: "#2563EB",               label: "In Progress" },
    completed:   { bg: "#0D988815", color: "#0D9488",               label: "Completed" },
    inactive:    { bg: "rgba(11,30,63,0.38)", color: "rgba(11,30,63,0.50)", label: "Inactive" },
  };
  const s = MAP[status] ?? MAP.pending;
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ backgroundColor: s.bg, color: s.color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />
      {s.label}
    </span>
  );
}

// ─── Screen 1: Dashboard ─────────────────────────────────────────────────────

type DashGroup = { id: string; code: string; name: string; status?: string; paxCount?: number; createdAt?: string };
type DashVisa = { id: string; code: string; status: string; createdAt: string; group?: { code: string; name: string } };
type DashWallet = { balance: number; pendingCharges: number; afterPending: number; currency: string };
type DashTxn = { id: string; direction: string; amount: number; description: string; createdAt: string };

function agentStatusKind(s?: string): ErpStatusKind {
  const u = (s ?? "").toUpperCase();
  if (u === "COMPLETED" || u === "CONFIRMED" || u === "APPROVED" || u === "VOUCHER_ISSUED" || u === "ACTIVE") return "approved";
  if (u === "REJECTED" || u === "CANCELLED") return "rejected";
  if (u === "REQUESTED" || u === "PENDING" || u === "ASSIGNED") return "warning";
  if (u === "DRAFT") return "pending";
  return "info";
}

function fmtSar(n: number): string {
  if (Math.abs(n) >= 1e6) return `SAR ${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `SAR ${(n / 1e3).toFixed(1)}K`;
  return `SAR ${n.toLocaleString()}`;
}

function DashboardScreen({ onGo }: { onGo: (id: string) => void }) {
  const { lang } = useLang();
  const user = getStoredUser();
  const name = user?.name ?? (lang === "bn" ? "এজেন্ট" : "Agent");
  const company = user?.company?.name ?? null;
  const code = user?.company?.code ?? null;
  const initials =
    name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "AG";

  const [groups, setGroups] = useState<DashGroup[]>([]);
  const [visas, setVisas] = useState<DashVisa[]>([]);
  const [wallet, setWallet] = useState<DashWallet | null>(null);
  const [txns, setTxns] = useState<DashTxn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const refresh = () => {
    if (!isLoggedIn()) {
      setLoading(false);
      setGroups([]); setVisas([]); setWallet(null); setTxns([]);
      return;
    }
    setLoading(true);
    setError(false);
    Promise.all([
      api.get<DashGroup[]>("/groups").catch(() => null),
      api.get<DashVisa[]>("/services/visa").catch(() => null),
      api.get<DashWallet>("/agent-finance/wallet").catch(() => null),
      api.get<DashTxn[]>("/agent-finance/wallet/transactions").catch(() => null),
    ])
      .then(([g, v, w, t]) => {
        if (g === null && v === null && w === null) setError(true);
        setGroups(g ?? []);
        setVisas(v ?? []);
        setWallet(w);
        setTxns(t ?? []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const t = setTimeout(refresh, 0);
    return () => clearTimeout(t);
  }, []);

  /** Counts from existing list payloads only — no new aggregations. */
  const pendingVisa = visas.filter((v) => {
    const u = v.status.toUpperCase();
    return u === "REQUESTED" || u === "ASSIGNED" || u === "PENDING";
  }).length;
  const activeGroups = groups.length;
  const balance = wallet?.balance ?? 0;
  const pendingPay = wallet?.pendingCharges ?? 0;

  type ActivityRow = { id: string; when: string; label: string; status: string; kind: string };
  const activity: ActivityRow[] = [
    ...groups.slice(0, 5).map((g) => ({
      id: `g-${g.id}`,
      when: g.createdAt ? new Date(g.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "—",
      label: `${g.code} · ${g.name}`,
      status: g.status ?? "ACTIVE",
      kind: lang === "bn" ? "গ্রুপ" : "Group",
    })),
    ...visas.slice(0, 5).map((v) => ({
      id: `v-${v.id}`,
      when: v.createdAt ? new Date(v.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "—",
      label: `${v.code}${v.group?.code ? ` · ${v.group.code}` : ""}`,
      status: v.status,
      kind: lang === "bn" ? "ভিসা" : "Visa",
    })),
    ...txns.slice(0, 5).map((t) => ({
      id: `t-${t.id}`,
      when: t.createdAt ? new Date(t.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "—",
      label: t.description || (t.direction === "CREDIT" ? "Credit" : "Debit"),
      status: t.direction,
      kind: lang === "bn" ? "পেমেন্ট" : "Payment",
    })),
  ].slice(0, 8);

  const activityCols: ErpColumn<ActivityRow>[] = [
    { id: "when", header: lang === "bn" ? "তারিখ" : "Date", cell: (r) => <span className="text-[11px] font-mono">{r.when}</span> },
    { id: "kind", header: lang === "bn" ? "ধরন" : "Type", cell: (r) => <span className="text-[11px]">{r.kind}</span> },
    { id: "label", header: lang === "bn" ? "বিবরণ" : "Detail", cell: (r) => <span className="text-xs font-semibold truncate max-w-[200px] block">{r.label}</span> },
    { id: "st", header: lang === "bn" ? "স্ট্যাটাস" : "Status", cell: (r) => <ErpStatusChip status={agentStatusKind(r.status)} label={r.status} lang={lang} /> },
  ];

  const tiles = [
    { id: "work", labelBn: "আজকের কাজ", labelEn: "Today's Work", value: String(pendingVisa + (pendingPay > 0 ? 1 : 0)), tone: AGENT, go: "visas" },
    { id: "groups", labelBn: "আমার গ্রুপ", labelEn: "My Groups", value: String(activeGroups), tone: "#0D9488", go: "groups" },
    { id: "visa", labelBn: "পেন্ডিং ভিসা", labelEn: "Pending Visa", value: String(pendingVisa), tone: "#B45309", go: "visas" },
    { id: "pay", labelBn: "পেমেন্ট / ওয়ালেট", labelEn: "Payments", value: wallet ? fmtSar(balance) : "—", tone: "#16A34A", go: "finance" },
  ];

  return (
    <div style={{ fontFamily: fontFor(lang) }}>
      <ErpPageTemplate
        title={lang === "bn" ? `স্বাগতম, ${name}` : `Welcome, ${name}`}
        subtitle={[company, code].filter(Boolean).join(" · ") || (lang === "bn" ? "এজেন্ট অ্যাকাউন্ট" : "Agent account")}
        primaryAction={
          <ErpButton variant="secondary" icon={<RefreshCw size={14} />} onClick={refresh}>
            {lang === "bn" ? "রিফ্রেশ" : "Refresh"}
          </ErpButton>
        }
        toolbar={
          <div className="flex flex-col gap-3 w-full">
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
                style={{ backgroundColor: `${AGENT}20`, color: AGENT }}
                aria-hidden
              >
                {initials}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 flex-1 w-full">
                {tiles.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onGo(t.go)}
                    className="text-left rounded-xl px-3 py-2.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                    style={{
                      backgroundColor: "#FFFFFF",
                      border: "1px solid rgba(11,30,63,0.11)",
                      outlineColor: GOLD,
                    }}
                  >
                    <div className="text-base font-bold tabular-nums" style={{ color: t.tone, fontFamily: "var(--font-mono)" }}>{t.value}</div>
                    <div className="text-[10px] mt-0.5" style={{ color: "rgba(11,30,63,0.55)" }}>{lang === "bn" ? t.labelBn : t.labelEn}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <ErpButton size="sm" variant="primary" icon={<Users size={14} />} onClick={() => onGo("groups")}>
                {lang === "bn" ? "গ্রুপ" : "Groups"}
              </ErpButton>
              <ErpButton size="sm" variant="secondary" icon={<FileCheck size={14} />} onClick={() => onGo("visas")}>
                {lang === "bn" ? "ভিসা স্ট্যাটাস" : "Visa Status"}
              </ErpButton>
              <ErpButton size="sm" variant="outline" icon={<Wallet size={14} />} onClick={() => onGo("finance")}>
                {lang === "bn" ? "পেমেন্ট" : "Payments"}
              </ErpButton>
              <ErpButton size="sm" variant="outline" icon={<Building2 size={14} />} onClick={() => onGo("profile")}>
                {lang === "bn" ? "প্রোফাইল" : "Profile"}
              </ErpButton>
            </div>
          </div>
        }
      >
        {error && !loading ? (
          <ErrorState tone="light" lang={lang} onRetry={refresh} />
        ) : (
          <ErpDataTable
            columns={activityCols}
            rows={loading ? [] : activity}
            rowKey={(r) => r.id}
            loading={loading}
            lang={lang}
            emptyTitle={lang === "bn" ? "কোনো সাম্প্রতিক কাজ নেই" : "No recent activity"}
            emptyHint={lang === "bn" ? "গ্রুপ, ভিসা ও পেমেন্ট এখানে দেখা যাবে।" : "Groups, visas, and payments appear here."}
            emptyAction={
              <ErpButton variant="primary" icon={<Plus size={14} />} onClick={() => onGo("groups")}>
                {lang === "bn" ? "গ্রুপ খুলুন" : "Open Groups"}
              </ErpButton>
            }
          />
        )}
      </ErpPageTemplate>
    </div>
  );
}

function CompanyProfileScreen() {
  const { lang } = useLang();
  const user = getStoredUser();
  const c = user?.company ?? null;
  const STATUS: Record<string, { labelBn: string; labelEn: string; kind: ErpStatusKind }> = {
    VERIFIED: { labelBn: "যাচাইকৃত", labelEn: "Verified", kind: "approved" },
    PENDING: { labelBn: "পর্যালোচনাধীন", labelEn: "Pending Review", kind: "warning" },
    UNDER_REVIEW: { labelBn: "রিভিউতে", labelEn: "Under Review", kind: "info" },
    REJECTED: { labelBn: "প্রত্যাখ্যাত", labelEn: "Rejected", kind: "rejected" },
    SUSPENDED: { labelBn: "স্থগিত", labelEn: "Suspended", kind: "cancelled" },
  };
  const st = c?.verificationStatus ? STATUS[c.verificationStatus] : null;

  return (
    <div style={{ fontFamily: fontFor(lang) }}>
      <ErpPageTemplate
        title={c?.name ?? (lang === "bn" ? "কোম্পানি প্রোফাইল" : "Company Profile")}
        subtitle={lang === "bn" ? "সেশন থেকে পরিচয় · বিদ্যমান অ্যাকাউন্ট" : "Identity from session · existing account"}
      >
        <div className="rounded-xl p-5 mb-4 flex items-start gap-4" style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(11,30,63,0.11)" }}>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${AGENT}18` }}>
            <Building2 size={20} style={{ color: AGENT }} />
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-bold text-[#0B1E3F] truncate">{c?.name ?? (lang === "bn" ? "আপনার এজেন্সি" : "Your agency")}</h2>
              {st && (
                <ErpStatusChip
                  status={st.kind}
                  label={lang === "bn" ? st.labelBn : st.labelEn}
                  lang={lang}
                />
              )}
            </div>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              {[
                [lang === "bn" ? "কোড" : "Code", c?.code ?? "—"],
                [lang === "bn" ? "ধরন" : "Type", c?.type === "AGENT" ? (lang === "bn" ? "ট্রাভেল এজেন্ট" : "Travel Agent") : (c?.type ?? "—")],
                [lang === "bn" ? "ইমেইল" : "Email", user?.email ?? "—"],
                [lang === "bn" ? "নাম" : "User", user?.name ?? "—"],
              ].map(([k, v]) => (
                <div key={String(k)} className="flex justify-between gap-3 py-1.5" style={{ borderBottom: "1px solid rgba(11,30,63,0.06)" }}>
                  <dt style={{ color: "rgba(11,30,63,0.50)" }}>{k}</dt>
                  <dd className="font-semibold text-[#0B1E3F] text-right truncate">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
        <EmptyState
          tone="light"
          title={lang === "bn" ? "পূর্ণ প্রোফাইল শীঘ্রই আসছে" : "Full company profile coming soon"}
          hint={lang === "bn"
            ? "নিবন্ধন নথি, মালিক প্রোফাইল ও ব্যাংকিং বিবরণ পরবর্তী রিলিজে এখানে সম্পাদনাযোগ্য হবে। উপরের পরিচয় লাইভ।"
            : "Registration documents, owner profile and banking details will be editable here in a later release. Identity above is live."}
        />
      </ErpPageTemplate>
    </div>
  );
}


const CAT_LABELS: Record<string, string> = {
  all:        "All Documents",
  identity:   "Identity",
  business:   "Business",
  financial:  "Financial",
  operations: "Operations",
};
const DOC_TYPE_COLORS: Record<string, string> = {
  identity:   "#7C3AED",
  business:   AGENT,
  financial:  "#16A34A",
  operations: GOLD,
};

// ── Phase-13 Documents backend wiring ────────────────────────────────────────
// Shape returned by GET /documents (latest version of each document type).
interface ApiVaultDoc {
  id: string;
  kind: UploadKind;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  version: number;
  versionCount: number;
  scanStatus: string;
  company: { code: string; name: string } | null;
  uploadedBy: string | null;
  createdAt: string;
  expiryDate: string | null;
  daysLeft: number | null;
  severity: "EXPIRED" | "CRITICAL" | "WARNING" | "OK" | null;
}

// Unified vault-row shape: the frozen mock array conforms to this; live rows add
// the optional fields (fileId/kind/severity/daysLeft/version) used for actions.
type VaultRow = {
  id: string; type: string; cat: string; filename: string;
  uploaded: string; expiry: string | null; status: string; size: string; ref: string;
  fileId?: string | null; kind?: UploadKind; severity?: string | null;
  daysLeft?: number | null; version?: number; versionCount?: number;
};

// Backend upload kind → the vault's display label + category bucket.
const KIND_META: Record<UploadKind, { type: string; cat: string }> = {
  TRADE_LICENSE: { type: "Trade License (CR)",     cat: "business" },
  OWNER_ID:      { type: "Owner NID / Passport",   cat: "identity" },
  OFFICE_PHOTO:  { type: "Office Photo",           cat: "business" },
  COMPANY_LOGO:  { type: "Company Logo",           cat: "business" },
  SIGNED_CHEQUE: { type: "Signed Cheque",          cat: "financial" },
  DEPOSIT_PROOF: { type: "Security Deposit",       cat: "financial" },
  SUPPLIER_CERT: { type: "Supplier Certificate",   cat: "operations" },
  OTHER:         { type: "Other Document",         cat: "operations" },
};

// content-scan result → the mock status key SBadge understands.
const SCAN_STATUS: Record<string, string> = { CLEAN: "verified", PENDING: "pending", INFECTED: "rejected" };

// A sensible default upload kind for the currently-selected category filter.
const CAT_DEFAULT_KIND: Record<string, UploadKind> = {
  all: "OTHER", identity: "OWNER_ID", business: "TRADE_LICENSE", financial: "DEPOSIT_PROOF", operations: "OTHER",
};

const fmtVaultDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

function fmtBytes(n: number): string {
  const kb = n / 1024;
  const mb = kb / 1024;
  return mb >= 0.1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(kb))} KB`;
}

const vaultErr = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

function mapVaultDoc(d: ApiVaultDoc): VaultRow {
  const meta = KIND_META[d.kind] ?? { type: d.kind, cat: "operations" };
  return {
    id: d.id,
    type: meta.type,
    cat: meta.cat,
    filename: d.fileName,
    uploaded: fmtVaultDate(d.createdAt),
    expiry: d.expiryDate,
    status: SCAN_STATUS[d.scanStatus] ?? "pending",
    size: fmtBytes(d.sizeBytes),
    ref: d.company?.code ?? "—",
    fileId: d.id,
    kind: d.kind,
    severity: d.severity,
    daysLeft: d.daysLeft,
    version: d.version,
    versionCount: d.versionCount,
  };
}

function DocumentsVaultScreen() {
  const [cat, setCat] = useState("all");
  const [view, setView] = useState<"list" | "grid">("list");
  const [live, setLive] = useState<ApiVaultDoc[] | null>(null);
  const authed = isLoggedIn();
  const [loading, setLoading] = useState(authed);
  const [error, setError] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingKind = useRef<UploadKind>("OTHER");

  const refresh = () => {
    if (!isLoggedIn()) return;
    setLoading(true);
    setError(false);
    api
      .get<ApiVaultDoc[]>("/documents")
      .then((d) => { setLive(d); setError(false); })
      .catch(() => { setLive(null); setError(true); })
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    const t = setTimeout(refresh, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Signed in → only ever real rows (never the demo array, not even on failure).
  // Signed out → the frozen prototype data, exactly as designed.
  const rows: VaultRow[] = authed ? (live ?? []).map(mapVaultDoc) : [];

  // A row is "expiring soon" from backend severity for live rows, or from the
  // pinned date math for mock rows.
  const isExpiring = (d: VaultRow) =>
    d.severity !== undefined
      ? d.severity != null && d.severity !== "OK"
      : !!d.expiry && daysUntil(d.expiry) < 30;

  const filtered = rows.filter((d) => cat === "all" || d.cat === cat);
  const expiring = rows.filter(isExpiring);

  // Canonical loading / error / empty state for the vault list (signed-in only —
  // the signed-out prototype always has rows and keeps its designed appearance).
  const vaultState = !authed ? null
    : loading ? <LoadingSkeleton tone="light" rows={5} />
    : error ? <ErrorState tone="light" onRetry={refresh} />
    : filtered.length === 0 ? (
        <EmptyState
          tone="light"
          title={cat === "all" ? "No documents yet" : `No ${CAT_LABELS[cat] ?? cat} documents`}
          hint="Upload a document to start building your vault."
        />
      )
    : null;

  const openDoc = async (row: VaultRow) => {
    if (!row.fileId) { toast.info("Document preview is available after sign-in (demo mode)."); return; }
    try {
      const url = await api.fileBlobUrl(row.fileId);
      window.open(url, "_blank");
    } catch (e) {
      toast.error(vaultErr(e, "Could not open document"));
    }
  };

  const triggerUpload = (kind: UploadKind) => {
    if (!isLoggedIn()) { toast.info("Sign in to upload documents (demo mode)."); return; }
    pendingKind.current = kind;
    fileRef.current?.click();
  };

  const onFileChosen = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      await api.uploadWithFields("/documents", file, { kind: pendingKind.current });
      toast.success("Document uploaded");
      refresh();
    } catch (err) {
      toast.error(vaultErr(err, "Could not upload document"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-7">
      <input ref={fileRef} type="file" className="hidden" onChange={onFileChosen} />
      {/* Alert banner for expiring docs */}
      {expiring.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl mb-5" style={{ backgroundColor: "#EF444410", border: "1px solid #EF444430" }}>
          <AlertCircle size={14} className="shrink-0" style={{ color: "#DC2626" }} />
          <div className="flex-1 min-w-0 truncate" title={expiring.map((d) => d.type).join(", ")}>
            <span className="text-xs font-bold" style={{ color: "#DC2626" }}>
              {expiring.length} document{expiring.length > 1 ? "s" : ""} expiring soon:
            </span>
            <span className="text-xs ml-2" style={{ color: "rgba(11,30,63,0.66)" }}>
              {expiring.map((d) => d.type).join(", ")}
            </span>
          </div>
          <button className="text-xs font-semibold shrink-0" style={{ color: "#DC2626" }}>Review →</button>
        </div>
      )}

      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-bold text-[#0B1E3F]">Documents Vault</h2>
          <p className="text-xs mt-0.5" style={{ color: "rgba(11,30,63,0.58)" }}>
            {rows.length} documents · {rows.filter((d) => d.status === "verified").length} verified
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => triggerUpload(CAT_DEFAULT_KIND[cat] ?? "OTHER")}
            disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold disabled:opacity-50"
            style={{ backgroundColor: AGENT, color: "#0B1E3F" }}
          >
            <Plus size={12} /> Upload Document
          </button>
        </div>
      </div>

      {/* Controls row */}
      <div className="flex items-center gap-3 mb-4">
        {/* Category filter tabs */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ backgroundColor: "#FBFCFD", border: "1px solid rgba(11,30,63,0.11)" }}>
          {Object.entries(CAT_LABELS).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setCat(k)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={cat === k ? { backgroundColor: AGENT, color: "#0B1E3F" } : { color: "rgba(11,30,63,0.58)" }}
            >
              {label}
              {k !== "all" && (
                <span className="ml-1.5 text-[9px]" style={{ color: cat === k ? "rgba(11,30,63,0.86)" : "rgba(11,30,63,0.50)" }}>
                  {rows.filter((d) => d.cat === k).length}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex-1 relative">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(11,30,63,0.50)" }} />
          <input
            placeholder="Search documents…"
            className="w-full pl-8 pr-4 py-2 text-xs rounded-xl focus:outline-none"
            style={{ backgroundColor: "#FBFCFD", border: "1px solid rgba(11,30,63,0.11)", color: "#0B1E3F" }}
          />
        </div>

        {/* View toggle */}
        <div className="flex gap-0.5 p-1 rounded-lg" style={{ backgroundColor: "#FBFCFD", border: "1px solid rgba(11,30,63,0.11)" }}>
          <button
            onClick={() => setView("list")}
            className="w-7 h-7 rounded-md flex items-center justify-center transition-all"
            style={{ backgroundColor: view === "list" ? AGENT : "transparent" }}
          >
            <List size={13} style={{ color: view === "list" ? "white" : "rgba(11,30,63,0.58)" }} />
          </button>
          <button
            onClick={() => setView("grid")}
            className="w-7 h-7 rounded-md flex items-center justify-center transition-all"
            style={{ backgroundColor: view === "grid" ? AGENT : "transparent" }}
          >
            <LayoutGrid size={13} style={{ color: view === "grid" ? "white" : "rgba(11,30,63,0.58)" }} />
          </button>
        </div>
      </div>

      {/* List view */}
      {view === "list" && (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(11,30,63,0.11)" }}>
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: "#FBFCFD", borderBottom: "1px solid rgba(11,30,63,0.11)" }}>
                {["Document", "Category", "Reference", "Uploaded", "Expiry", "Status", ""].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-[9px] font-bold uppercase tracking-widest" style={{ color: "rgba(11,30,63,0.50)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vaultState ? (
                <tr><td colSpan={7} className="px-4">{vaultState}</td></tr>
              ) : filtered.map((doc, i) => {
                const catColor = DOC_TYPE_COLORS[doc.cat] ?? AGENT;
                return (
                  <tr
                    key={doc.id}
                    style={{ borderBottom: i < filtered.length - 1 ? "1px solid rgba(11,30,63,0.08)" : undefined }}
                    className="hover:bg-white/2 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${catColor}18` }}>
                          <FileText size={12} style={{ color: catColor }} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-[#0B1E3F] truncate" title={doc.type}>{doc.type}</div>
                          <div className="text-[10px] truncate max-w-[180px]" style={{ color: "rgba(11,30,63,0.50)" }} title={doc.filename}>{doc.filename}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                        style={{ backgroundColor: `${catColor}18`, color: catColor }}
                      >
                        {doc.cat}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[10px]" style={{ color: "rgba(11,30,63,0.66)", fontFamily: "var(--font-mono)" }}>{doc.ref}</td>
                    <td className="px-4 py-3 text-[10px]" style={{ color: "rgba(11,30,63,0.58)" }}>{doc.uploaded}</td>
                    <td className="px-4 py-3"><ExpiryTag expiry={doc.expiry} severity={doc.severity} daysLeft={doc.daysLeft} /></td>
                    <td className="px-4 py-3"><SBadge status={doc.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openDoc(doc)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all"
                          style={{ backgroundColor: `${AGENT}18`, color: AGENT }}
                        >
                          <Eye size={10} /> Preview
                        </button>
                        <button
                          onClick={() => triggerUpload(doc.kind ?? CAT_DEFAULT_KIND[doc.cat] ?? "OTHER")}
                          disabled={uploading}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] transition-all disabled:opacity-50"
                          style={{ border: "1px solid rgba(11,30,63,0.15)", color: "rgba(11,30,63,0.58)" }}
                        >
                          <Upload size={10} /> Replace
                        </button>
                        <button
                          onClick={() => openDoc(doc)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                          style={{ color: "rgba(11,30,63,0.50)" }}
                        >
                          <Download size={11} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Grid view */}
      {view === "grid" && (vaultState ?? (
        <div className="grid grid-cols-4 gap-4">
          {filtered.map((doc) => {
            const catColor = DOC_TYPE_COLORS[doc.cat] ?? AGENT;
            const expDays = doc.daysLeft !== undefined ? doc.daysLeft : doc.expiry ? daysUntil(doc.expiry) : null;
            const expColor = expDays === null ? null : expDays < 0 ? "#DC2626" : expDays < 30 ? "#DC2626" : expDays < 90 ? "#B45309" : "#16A34A";
            return (
              <div
                key={doc.id}
                className="rounded-2xl p-4 flex flex-col gap-3 transition-all hover:scale-[1.01]"
                style={{ backgroundColor: "#FBFCFD", border: `1px solid ${expColor && expDays! < 30 ? expColor + "35" : "rgba(11,30,63,0.38)"}` }}
              >
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${catColor}18` }}>
                    <FileText size={18} style={{ color: catColor }} />
                  </div>
                  <SBadge status={doc.status} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[#0B1E3F] mb-0.5 truncate" title={doc.type}>{doc.type}</div>
                  <div className="text-[10px] truncate" style={{ color: "rgba(11,30,63,0.50)" }} title={doc.filename}>{doc.filename}</div>
                </div>
                <div className="flex items-center justify-between mt-auto">
                  <ExpiryTag expiry={doc.expiry} severity={doc.severity} daysLeft={doc.daysLeft} />
                  <span className="text-[9px]" style={{ color: "rgba(11,30,63,0.50)" }}>{doc.size}</span>
                </div>
                <div className="flex gap-1.5 pt-2" style={{ borderTop: "1px solid rgba(11,30,63,0.11)" }}>
                  <button onClick={() => openDoc(doc)} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-semibold" style={{ backgroundColor: `${AGENT}18`, color: AGENT }}>
                    <Eye size={10} /> View
                  </button>
                  <button onClick={() => triggerUpload(doc.kind ?? CAT_DEFAULT_KIND[doc.cat] ?? "OTHER")} disabled={uploading} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] disabled:opacity-50" style={{ border: "1px solid rgba(11,30,63,0.15)", color: "rgba(11,30,63,0.58)" }}>
                    <Upload size={10} /> Replace
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ─── Coming Soon placeholder ──────────────────────────────────────────────────

function ComingSoon({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{ backgroundColor: `${AGENT}12`, border: `1px solid ${AGENT}25` }}
      >
        <Clock size={22} style={{ color: AGENT }} />
      </div>
      <h3 className="text-sm font-bold text-[#0B1E3F] mb-1.5">{label}</h3>
      <p className="text-xs max-w-xs" style={{ color: "rgba(11,30,63,0.58)" }}>
        This module will be designed in a future prompt. The shell and navigation are already wired.
      </p>
    </div>
  );
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export default function AgentPortal() {
  const { lang } = useLang();
  const [screen, setScreen] = useState("dashboard");

  const labelsBn: Record<string, string> = {
    dashboard: "ড্যাশবোর্ড",
    profile: "কোম্পানি প্রোফাইল",
    documents: "নথিপত্র",
    groups: "আমার গ্রুপ",
    visas: "ভিসা স্ট্যাটাস",
    hotels: "হোটেল",
    transport: "পরিবহন",
    finance: "পেমেন্ট",
    support: "সাপোর্ট",
  };

  const body =
    screen === "dashboard" ? <DashboardScreen onGo={setScreen} />
      : screen === "profile" ? <CompanyProfileScreen />
        : screen === "documents" ? <DocumentsVaultScreen />
          : screen === "groups" ? <GroupsModule />
            : screen === "visas" ? <ServicesModule initial="visa" />
              : screen === "hotels" ? <ServicesModule initial="hotel" />
                : screen === "transport" ? <ServicesModule initial="transport" />
                  : screen === "finance" ? <FinanceModule />
                    : screen === "support" ? <ComingSoon label={lang === "bn" ? "সাপোর্ট" : "Support"} />
                      : null;

  const lazyDesk =
    screen === "groups" ||
    screen === "visas" ||
    screen === "hotels" ||
    screen === "transport" ||
    screen === "finance";

  return (
    <ERPShell
      moduleId="agent-portal"
      moduleName={lang === "bn" ? "এজেন্ট পোর্টাল" : "Agent Portal"}
      moduleColor={AGENT}
      moduleIcon={Building2 as IconFC}
      navItems={AGENT_NAV}
      activeItem={screen}
      onItemClick={setScreen}
      breadcrumb={[lang === "bn" ? (labelsBn[screen] ?? screen) : (SCREEN_LABELS[screen] ?? screen)]}
      notificationCount={0}
      userName={getStoredUser()?.name ?? "Agent"}
      userRole={getStoredUser()?.company?.code ? `Travel Agent · ${getStoredUser()?.company?.code}` : "Travel Agent"}
    >
      {lazyDesk ? <Suspense fallback={<RouteFallback />}>{body}</Suspense> : body}
    </ERPShell>
  );
}
