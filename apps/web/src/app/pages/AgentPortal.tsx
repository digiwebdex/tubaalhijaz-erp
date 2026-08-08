import { useState, useEffect, useRef, lazy, Suspense, type ChangeEvent } from "react";
import { toast } from "sonner";
import {
  LayoutDashboard, Building2, FileText, Users, FileCheck, Building, Bus,
  Wallet, AlertCircle,
  Clock, RefreshCw, Eye, Upload,
  Plus, Download, LayoutGrid, List,
  Search,
} from "lucide-react";
import { ERPShell, type NavItem, type IconFC } from "../components/ERPShell";
import { RouteFallback } from "../components/RouteFallback";
import { api, ApiError, isLoggedIn, getStoredUser, type UploadKind } from "../lib/api";
import {
  ErpThemeProvider, ERP, CAT, erpAlpha, ErpButton, ErpBadge, ErpDataTable,
  type ErpColumn, type ErpStatusKind,
} from "../components/erp";
import { EmptyState, LoadingSkeleton, ErrorState } from "../components/States";
import { useLang } from "../lib/LangContext";
import { fontFor } from "@tuba/shared";

type AccentName = "gold" | "success" | "warning" | "danger" | "info" | "purple";
const DS_ACCENT: Record<AccentName, string> = { gold: ERP.accent, success: ERP.success, warning: ERP.warning, danger: ERP.destructive, info: ERP.info, purple: ERP.purple };
function dsStatusColor(s: string): AccentName { const u=(s||"").toUpperCase(); if(/APPROV|VERIFIED|ISSUED|CREDIT|ACTIVE|DELIVER|PAID|COMPLET/.test(u))return"success"; if(/REJECT|FAIL|OVERDUE|CANCEL|SUSPEND/.test(u))return"danger"; if(/PENDING|REQUEST|REVIEW|DEBIT|ASSIGN|RETURN/.test(u))return"warning"; return"info"; }

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

const AGENT = CAT.sky; // agent portal accent (categorical, themed)

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
  // DS re-theme: colors mapped to Design-System danger/warning/success tokens.
  if (severity !== undefined) {
    if (severity === null || daysLeft == null)
      return <span style={{ fontSize: ERP.text.size[10], color: ERP.muted }}>No Expiry</span>;
    const color = severity === "EXPIRED" || severity === "CRITICAL" ? ERP.destructive : severity === "WARNING" ? ERP.warning : ERP.success;
    const label = severity === "EXPIRED" ? "Expired" : severity === "CRITICAL" ? `Expires in ${daysLeft}d` : severity === "WARNING" ? `${daysLeft}d remaining` : `Valid · ${daysLeft}d`;
    return (
      <span className="inline-flex items-center gap-1" style={{ fontSize: ERP.text.size[10], fontWeight: ERP.text.weight.semibold, padding: `${ERP.space[0.5]}px ${ERP.space[2]}px`, borderRadius: ERP.radius.full, background: `${erpAlpha(color, 13)}`, color }}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
        {label}
      </span>
    );
  }
  if (!expiry) return <span style={{ fontSize: ERP.text.size[10], color: ERP.muted }}>No Expiry</span>;
  const d = daysUntil(expiry);
  const color = d < 0 ? ERP.destructive : d < 30 ? ERP.destructive : d < 90 ? ERP.warning : ERP.success;
  const label = d < 0 ? "Expired" : d < 30 ? `Expires in ${d}d` : d < 90 ? `${d}d remaining` : `Valid · ${d}d`;
  return (
    <span className="inline-flex items-center gap-1" style={{ fontSize: ERP.text.size[10], fontWeight: ERP.text.weight.semibold, padding: `${ERP.space[0.5]}px ${ERP.space[2]}px`, borderRadius: ERP.radius.full, background: `${erpAlpha(color, 13)}`, color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

// DS badge for vault scan/document status — maps the legacy status keys onto the
// Design-System Badge component (dot variant), preserving the exact labels.
function SBadge({ status }: { status: string }) {
  const MAP: Record<string, { color: AccentName; label: string }> = {
    verified:    { color: "success", label: "Verified" },
    pending:     { color: "warning", label: "Pending" },
    review:      { color: "info",    label: "Under Review" },
    rejected:    { color: "danger",  label: "Rejected" },
    in_progress: { color: "info",    label: "In Progress" },
    completed:   { color: "success", label: "Completed" },
    inactive:    { color: "info",    label: "Inactive" },
  };
  const s = MAP[status] ?? MAP.pending;
  return <ErpBadge color={DS_ACCENT[s.color]} size="sm" dot>{s.label}</ErpBadge>;
}

// ─── Screen 1: Dashboard ─────────────────────────────────────────────────────

type DashGroup = { id: string; code: string; name: string; status?: string; paxCount?: number; createdAt?: string };
type DashVisa = { id: string; code: string; status: string; createdAt: string; group?: { code: string; name: string } };
type DashWallet = { balance: number; pendingCharges: number; afterPending: number; currency: string };
type DashTxn = { id: string; direction: string; amount: number; description: string; createdAt: string };

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

  /** Counts from existing list payloads only — no new aggregations, no invented stats. */
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
    { id: "when", header: lang === "bn" ? "তারিখ" : "Date", cell: (r) => <span style={{ fontFamily: ERP.font.data, fontSize: ERP.text.size[11], color: ERP.muted }}>{r.when}</span> },
    { id: "kind", header: lang === "bn" ? "ধরন" : "Type", cell: (r) => <span style={{ fontSize: ERP.text.size[11], color: ERP.fgDim }}>{r.kind}</span> },
    { id: "label", header: lang === "bn" ? "বিবরণ" : "Detail", cell: (r) => <span style={{ fontSize: ERP.text.size[12], fontWeight: ERP.text.weight.semibold, color: ERP.navy }} className="truncate max-w-[220px] block">{r.label}</span> },
    { id: "st", header: lang === "bn" ? "স্ট্যাটাস" : "Status", cell: (r) => <ErpBadge color={DS_ACCENT[dsStatusColor(r.status)]} size="sm" dot>{r.status}</ErpBadge> },
  ];

  // KPI tiles — every value derived from real API payloads above (never hardcoded).
  const tiles: { id: string; labelBn: string; labelEn: string; value: string; color: AccentName; icon: string; go: string }[] = [
    { id: "work", labelBn: "আজকের কাজ", labelEn: "Today's Work", value: String(pendingVisa + (pendingPay > 0 ? 1 : 0)), color: "info", icon: "📋", go: "visas" },
    { id: "groups", labelBn: "আমার গ্রুপ", labelEn: "My Groups", value: String(activeGroups), color: "success", icon: "📦", go: "groups" },
    { id: "visa", labelBn: "পেন্ডিং ভিসা", labelEn: "Pending Visa", value: String(pendingVisa), color: "warning", icon: "🛂", go: "visas" },
    { id: "pay", labelBn: "পেমেন্ট / ওয়ালেট", labelEn: "Payments", value: wallet ? fmtSar(balance) : "—", color: "success", icon: "💰", go: "finance" },
  ];

  const quick: { label: string; labelBn: string; go: string }[] = [
    { label: "My Groups", labelBn: "গ্রুপ", go: "groups" },
    { label: "Visa Status", labelBn: "ভিসা স্ট্যাটাস", go: "visas" },
    { label: "Payments", labelBn: "পেমেন্ট", go: "finance" },
    { label: "Profile", labelBn: "প্রোফাইল", go: "profile" },
  ];

  return (
    <div style={{ padding: `${ERP.space[5]}px ${ERP.space[6]}px ${ERP.space[14]}px`, fontFamily: fontFor(lang) }}>
      {/* Welcome */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: ERP.space[4], marginBottom: ERP.space[5] }}>
        <div>
          <div style={{ fontFamily: ERP.font.heading, fontSize: ERP.text.size[20], fontWeight: ERP.text.weight.bold, color: ERP.navy, marginBottom: ERP.space[0.5] }}>
            {lang === "bn" ? `স্বাগতম, ${name}` : `Welcome, ${name}`}
          </div>
          <div style={{ fontFamily: ERP.font.body, fontSize: ERP.text.size[12], color: ERP.muted }}>
            {[company, code].filter(Boolean).join(" · ") || (lang === "bn" ? "এজেন্ট অ্যাকাউন্ট" : "Agent account")}
          </div>
        </div>
        <ErpButton variant="secondary" size="sm" icon={<RefreshCw size={13} />} onClick={refresh}>
          {lang === "bn" ? "রিফ্রেশ" : "Refresh"}
        </ErpButton>
      </div>

      {/* KPI stats — real API data */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: ERP.space[3], marginBottom: ERP.space[5] }}>
        {tiles.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onGo(t.go)}
            style={{ textAlign: "left", background: ERP.surface, border: `1px solid ${ERP.border}`, borderTop: `2px solid ${DS_ACCENT[t.color]}`, borderRadius: ERP.radius.md, padding: `${ERP.space[3.5]}px ${ERP.space[4]}px`, cursor: "pointer" }}
          >
            <div style={{ fontSize: ERP.text.size[18], marginBottom: ERP.space[1.5] }}>{t.icon}</div>
            <div style={{ fontFamily: ERP.font.data, fontSize: ERP.text.size[20], fontWeight: ERP.text.weight.bold, color: DS_ACCENT[t.color], lineHeight: ERP.text.leading.none }}>
              {loading ? "…" : t.value}
            </div>
            <div style={{ fontFamily: ERP.font.body, fontSize: ERP.text.size[9], color: ERP.muted, marginTop: ERP.space[1.5], letterSpacing: "0.02em" }}>{lang === "bn" ? t.labelBn : t.labelEn}</div>
          </button>
        ))}
      </div>

      {/* Quick actions */}
      <div style={{ marginBottom: ERP.space[5] }}>
        <div style={{ fontFamily: ERP.font.heading, fontSize: ERP.text.size[10], fontWeight: ERP.text.weight.bold, color: ERP.muted, letterSpacing: "0.1em", marginBottom: ERP.space[3] }}>
          {lang === "bn" ? "দ্রুত কাজ" : "QUICK ACTIONS"}
        </div>
        <div style={{ display: "flex", gap: ERP.space[2.5], flexWrap: "wrap" }}>
          {quick.map((q) => (
            <ErpButton key={q.go} variant="outline" size="md" onClick={() => onGo(q.go)}>
              {lang === "bn" ? q.labelBn : q.label}
            </ErpButton>
          ))}
        </div>
      </div>

      {/* Recent activity — real data / states */}
      <div style={{ fontFamily: ERP.font.heading, fontSize: ERP.text.size[10], fontWeight: ERP.text.weight.bold, color: ERP.muted, letterSpacing: "0.1em", marginBottom: ERP.space[3] }}>
        {lang === "bn" ? "সাম্প্রতিক কার্যকলাপ" : "RECENT ACTIVITY"}
      </div>
      {error && !loading ? (
        <ErrorState
          message={lang === "bn" ? "ডেটা আনা যায়নি। আবার চেষ্টা করুন।" : "The data could not be loaded. Please try again."}
          onRetry={refresh}
          lang={lang}
        />
      ) : loading ? (
        <LoadingSkeleton rows={5} variant="table" />
      ) : (
        <ErpDataTable
          columns={activityCols}
          rows={activity}
          rowKey={(r) => r.id}
          emptyTitle={lang === "bn" ? "কোনো সাম্প্রতিক কাজ নেই" : "No recent activity"}
        />
      )}
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
  const stColor: AccentName = st ? (st.kind === "approved" ? "success" : st.kind === "rejected" || st.kind === "cancelled" ? "danger" : st.kind === "info" ? "info" : "warning") : "info";

  return (
    <div style={{ padding: `${ERP.space[5]}px ${ERP.space[6]}px ${ERP.space[14]}px`, fontFamily: fontFor(lang) }}>
      <div style={{ marginBottom: ERP.space[5] }}>
        <div style={{ fontFamily: ERP.font.heading, fontSize: ERP.text.size[20], fontWeight: ERP.text.weight.bold, color: ERP.navy, marginBottom: ERP.space[0.5] }}>
          {c?.name ?? (lang === "bn" ? "কোম্পানি প্রোফাইল" : "Company Profile")}
        </div>
        <div style={{ fontFamily: ERP.font.body, fontSize: ERP.text.size[12], color: ERP.muted }}>
          {lang === "bn" ? "সেশন থেকে পরিচয় · বিদ্যমান অ্যাকাউন্ট" : "Identity from session · existing account"}
        </div>
      </div>
      <div>
        <div className="flex items-start gap-4" style={{ background: ERP.surface, border: `1px solid ${ERP.border}`, borderRadius: ERP.radius.lg, padding: ERP.space[5], marginBottom: ERP.space[4] }}>
          <div className="flex items-center justify-center shrink-0" style={{ width: 48, height: 48, borderRadius: ERP.radius.md, background: ERP.goldDim, border: `1px solid ${ERP.goldBrd}` }}>
            <Building2 size={20} style={{ color: ERP.accent }} />
          </div>
          <div className="flex-1 min-w-0" style={{ display: "flex", flexDirection: "column", gap: ERP.space[2.5] }}>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate" style={{ fontFamily: ERP.font.heading, fontSize: ERP.text.size[14], fontWeight: ERP.text.weight.bold, color: ERP.navy }}>{c?.name ?? (lang === "bn" ? "আপনার এজেন্সি" : "Your agency")}</h2>
              {st && <ErpBadge color={DS_ACCENT[stColor]} size="sm" dot>{lang === "bn" ? st.labelBn : st.labelEn}</ErpBadge>}
            </div>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                [lang === "bn" ? "কোড" : "Code", c?.code ?? "—"],
                [lang === "bn" ? "ধরন" : "Type", c?.type === "AGENT" ? (lang === "bn" ? "ট্রাভেল এজেন্ট" : "Travel Agent") : (c?.type ?? "—")],
                [lang === "bn" ? "ইমেইল" : "Email", user?.email ?? "—"],
                [lang === "bn" ? "নাম" : "User", user?.name ?? "—"],
              ].map(([k, v]) => (
                <div key={String(k)} className="flex justify-between gap-3" style={{ padding: "6px 0", borderBottom: `1px solid ${ERP.border}` }}>
                  <dt style={{ fontSize: ERP.text.size[13], color: ERP.muted }}>{k}</dt>
                  <dd className="text-right truncate" style={{ fontSize: ERP.text.size[13], fontWeight: ERP.text.weight.semibold, color: ERP.navy }}>{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
        <EmptyState
          title={lang === "bn" ?"পূর্ণ প্রোফাইল" : "Full company profile"}
          hint="এই মডিউল এখনও কনফিগার করা হয়নি। উপরের পরিচয় লাইভ।"
        />
      </div>
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
  identity:   ERP.purple,
  business:   ERP.info,
  financial:  ERP.success,
  operations: ERP.accent,
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
    : loading ? <LoadingSkeleton rows={5} variant="table" />
    : error ? <ErrorState onRetry={refresh} />
    : filtered.length === 0 ? (
        <EmptyState
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
    <div style={{ padding: `${ERP.space[5]}px ${ERP.space[6]}px ${ERP.space[14]}px` }}>
      <input ref={fileRef} type="file" className="hidden" onChange={onFileChosen} />
      {/* Alert banner for expiring docs */}
      {expiring.length > 0 && (
        <div className="flex items-center gap-3" style={{ padding: `${ERP.space[2.5]}px ${ERP.space[4]}px`, borderRadius: ERP.radius.md, marginBottom: ERP.space[5], background: ERP.destructiveDim, border: `1px solid ${erpAlpha(ERP.destructive, 33)}` }}>
          <AlertCircle size={14} className="shrink-0" style={{ color: ERP.destructive }} />
          <div className="flex-1 min-w-0 truncate" title={expiring.map((d) => d.type).join(", ")}>
            <span style={{ fontSize: ERP.text.size[12], fontWeight: ERP.text.weight.bold, color: ERP.destructive }}>
              {expiring.length} document{expiring.length > 1 ? "s" : ""} expiring soon:
            </span>
            <span style={{ fontSize: ERP.text.size[12], marginLeft: ERP.space[2], color: ERP.fgDim }}>
              {expiring.map((d) => d.type).join(", ")}
            </span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between" style={{ marginBottom: ERP.space[5] }}>
        <div>
          <h2 style={{ fontFamily: ERP.font.heading, fontSize: ERP.text.size[18], fontWeight: ERP.text.weight.bold, color: ERP.navy }}>Documents Vault</h2>
          <p style={{ fontSize: ERP.text.size[12], marginTop: ERP.space[0.5], color: ERP.muted }}>
            {rows.length} documents · {rows.filter((d) => d.status === "verified").length} verified
          </p>
        </div>
        <ErpButton variant="primary" size="sm" icon={<Plus size={13} />} disabled={uploading} onClick={() => triggerUpload(CAT_DEFAULT_KIND[cat] ?? "OTHER")}>
          Upload Document
        </ErpButton>
      </div>

      {/* Controls row */}
      <div className="flex items-center gap-3" style={{ marginBottom: ERP.space[4] }}>
        {/* Category filter tabs */}
        <div className="flex gap-1" style={{ padding: ERP.space[1], borderRadius: ERP.radius.md, background: ERP.surfaceSoft, border: `1px solid ${ERP.border}` }}>
          {Object.entries(CAT_LABELS).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setCat(k)}
              style={{ padding: `${ERP.space[1.5]}px ${ERP.space[3]}px`, borderRadius: ERP.radius.sm, fontSize: ERP.text.size[12], fontWeight: ERP.text.weight.semibold, border: "none", cursor: "pointer",
                background: cat === k ? ERP.accent : "transparent", color: cat === k ? ERP.canvas : ERP.muted, transition: "background 0.15s, color 0.15s" }}
            >
              {label}
              {k !== "all" && (
                <span style={{ marginLeft: ERP.space[1.5], fontSize: ERP.text.size[9], color: cat === k ? erpAlpha(ERP.primaryFg, 70) : ERP.muted }}>
                  {rows.filter((d) => d.cat === k).length}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex-1 relative">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: ERP.muted }} />
          <input
            placeholder="Search documents…"
            style={{ width: "100%", padding: `${ERP.space[2]}px ${ERP.space[4]}px ${ERP.space[2]}px ${ERP.space[8]}px`, fontSize: ERP.text.size[12], borderRadius: ERP.radius.md, outline: "none", background: ERP.surfaceSoft, border: `1px solid ${ERP.border}`, color: ERP.navy }}
            onFocus={(e) => (e.currentTarget.style.borderColor = ERP.accent)}
            onBlur={(e) => (e.currentTarget.style.borderColor = ERP.border)}
          />
        </div>

        {/* View toggle */}
        <div className="flex gap-0.5" style={{ padding: ERP.space[1], borderRadius: ERP.radius.sm, background: ERP.surfaceSoft, border: `1px solid ${ERP.border}` }}>
          <button onClick={() => setView("list")} className="flex items-center justify-center"
            style={{ width: 28, height: 28, borderRadius: ERP.radius.xs, border: "none", cursor: "pointer", background: view === "list" ? ERP.accent : "transparent" }}>
            <List size={13} style={{ color: view === "list" ? ERP.canvas : ERP.muted }} />
          </button>
          <button onClick={() => setView("grid")} className="flex items-center justify-center"
            style={{ width: 28, height: 28, borderRadius: ERP.radius.xs, border: "none", cursor: "pointer", background: view === "grid" ? ERP.accent : "transparent" }}>
            <LayoutGrid size={13} style={{ color: view === "grid" ? ERP.canvas : ERP.muted }} />
          </button>
        </div>
      </div>

      {/* List view */}
      {view === "list" && (vaultState ?? (
        <ErpDataTable
          rows={filtered}
          rowKey={(doc) => doc.id}
          columns={[
            { id: "doc", header: "Document", cell: (doc) => { const catColor = DOC_TYPE_COLORS[doc.cat] ?? ERP.accent; return (<div className="flex items-center gap-2.5"><div className="flex items-center justify-center shrink-0" style={{ width: 28, height: 28, borderRadius: ERP.radius.sm, background: erpAlpha(catColor, 13) }}><FileText size={12} style={{ color: catColor }} /></div><div className="min-w-0"><div className="truncate" style={{ fontSize: ERP.text.size[12], fontWeight: ERP.text.weight.semibold, color: ERP.navy }} title={doc.type}>{doc.type}</div><div className="truncate max-w-[180px]" style={{ fontSize: ERP.text.size[10], color: ERP.muted }} title={doc.filename}>{doc.filename}</div></div></div>); } },
            { id: "cat", header: "Category", cell: (doc) => { const catColor = DOC_TYPE_COLORS[doc.cat] ?? ERP.accent; return <span className="uppercase inline-block px-1.5 py-0.5 rounded-full" style={{ fontSize: ERP.text.size[9], fontWeight: ERP.text.weight.bold, letterSpacing: "0.04em", background: erpAlpha(catColor, 13), color: catColor }}>{doc.cat}</span>; } },
            { id: "ref", header: "Reference", cell: (doc) => <span style={{ fontSize: ERP.text.size[10], color: ERP.fgDim, fontFamily: ERP.font.data }}>{doc.ref}</span> },
            { id: "uploaded", header: "Uploaded", cell: (doc) => <span style={{ fontSize: ERP.text.size[10], color: ERP.muted }}>{doc.uploaded}</span> },
            { id: "expiry", header: "Expiry", cell: (doc) => <ExpiryTag expiry={doc.expiry} severity={doc.severity} daysLeft={doc.daysLeft} /> },
            { id: "status", header: "Status", cell: (doc) => <SBadge status={doc.status} /> },
            { id: "actions", header: "", align: "right", cell: (doc) => <div className="flex items-center gap-1 justify-end"><ErpButton variant="outline" size="sm" icon={<Eye size={10} />} onClick={() => openDoc(doc)}>Preview</ErpButton><ErpButton variant="ghost" size="sm" icon={<Upload size={10} />} disabled={uploading} onClick={() => triggerUpload(doc.kind ?? CAT_DEFAULT_KIND[doc.cat] ?? "OTHER")}>Replace</ErpButton><button onClick={() => openDoc(doc)} className="flex items-center justify-center" style={{ width: 28, height: 28, borderRadius: ERP.radius.sm, border: "none", background: "transparent", cursor: "pointer", color: ERP.muted }}><Download size={11} /></button></div> },
          ]}
        />
      ))}

      {/* Grid view */}
      {view === "grid" && (vaultState ?? (
        <div className="grid grid-cols-4 gap-4">
          {filtered.map((doc) => {
            const catColor = DOC_TYPE_COLORS[doc.cat] ?? ERP.accent;
            const expDays = doc.daysLeft !== undefined ? doc.daysLeft : doc.expiry ? daysUntil(doc.expiry) : null;
            const expColor = expDays === null ? null : expDays < 0 ? ERP.destructive : expDays < 30 ? ERP.destructive : expDays < 90 ? ERP.warning : ERP.success;
            return (
              <div key={doc.id} className="flex flex-col gap-3"
                style={{ borderRadius: ERP.radius.lg, padding: ERP.space[4], background: ERP.surface, border: `1px solid ${expColor && expDays! < 30 ? expColor + "55" : ERP.border}` }}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center justify-center" style={{ width: 40, height: 40, borderRadius: ERP.radius.md, background: `${erpAlpha(catColor, 13)}` }}>
                    <FileText size={18} style={{ color: catColor }} />
                  </div>
                  <SBadge status={doc.status} />
                </div>
                <div className="min-w-0">
                  <div className="truncate" style={{ fontSize: ERP.text.size[12], fontWeight: ERP.text.weight.bold, marginBottom: ERP.space[0.5], color: ERP.navy }} title={doc.type}>{doc.type}</div>
                  <div className="truncate" style={{ fontSize: ERP.text.size[10], color: ERP.muted }} title={doc.filename}>{doc.filename}</div>
                </div>
                <div className="flex items-center justify-between mt-auto">
                  <ExpiryTag expiry={doc.expiry} severity={doc.severity} daysLeft={doc.daysLeft} />
                  <span style={{ fontSize: ERP.text.size[9], color: ERP.muted }}>{doc.size}</span>
                </div>
                <div className="flex gap-1.5" style={{ paddingTop: ERP.space[2], borderTop: `1px solid ${ERP.border}` }}>
                  <div className="flex-1"><ErpButton variant="outline" size="sm" icon={<Eye size={10} />} onClick={() => openDoc(doc)}>View</ErpButton></div>
                  <div className="flex-1"><ErpButton variant="ghost" size="sm" icon={<Upload size={10} />} disabled={uploading} onClick={() => triggerUpload(doc.kind ?? CAT_DEFAULT_KIND[doc.cat] ?? "OTHER")}>Replace</ErpButton></div>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ─── Not configured (no support backend yet) ─────────────────────────────────

function SupportNotConfigured({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center" style={{ padding: `${ERP.space[24]}px ${ERP.space[6]}px` }}>
      <div className="flex items-center justify-center" style={{ width: 56, height: 56, borderRadius: ERP.radius.lg, marginBottom: ERP.space[4], background: ERP.goldDim, border: `1px solid ${ERP.goldBrd}` }}>
        <Clock size={22} style={{ color: ERP.accent }} />
      </div>
      <h3 style={{ fontFamily: ERP.font.heading, fontSize: ERP.text.size[14], fontWeight: ERP.text.weight.bold, marginBottom: ERP.space[1.5], color: ERP.navy }}>{label}</h3>
      <p className="max-w-xs" style={{ fontSize: ERP.text.size[12], color: ERP.muted }}>
        এই মডিউল এখনও কনফিগার করা হয়নি।
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
                    : screen === "support" ? <SupportNotConfigured label={lang === "bn" ? "সাপোর্ট" : "Support"} />
                      : null;

  const lazyDesk =
    screen === "groups" ||
    screen === "visas" ||
    screen === "hotels" ||
    screen === "transport" ||
    screen === "finance";

  // The whole Agent Portal — shell + body — renders in the Design System theme.
  // Every other module stays on the Legacy theme (root default) until approved.
  return (
    <ErpThemeProvider theme="ds">
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
    </ErpThemeProvider>
  );
}
