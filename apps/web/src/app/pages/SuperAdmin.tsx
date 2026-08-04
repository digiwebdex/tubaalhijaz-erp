import { useState, useEffect, useMemo, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Navigate, useSearchParams } from "react-router";
import { api, ApiError, isLoggedIn, getStoredUser } from "../lib/api";
import { filterNavByPerms, hasAnyPermission, hasPermission, SA_NAV_PERMS } from "../lib/rbac";
import {
  LayoutDashboard, Building2, Users, Shield,
  TrendingUp, ArrowUp, ArrowDown, CheckCircle, AlertCircle, XCircle, Clock,
  MoreHorizontal, Eye, Trash2, Plus, Filter,
  RefreshCw, Check, X, FileText, Wallet, Building,
  ClipboardCheck, Download, Activity, Users2,
} from "lucide-react";
import { ERPShell, type NavItem, type IconFC } from "../components/ERPShell";
import { EmptyState, LoadingSkeleton, ErrorState } from "../components/States";
import {
  ErpButton, ErpSearchBar, ErpStatusChip, type ErpStatusKind,
} from "../components/erp";

/**
 * Turns a thrown request error into designed copy.
 * A 401 here means the api client already tried its single refresh and cleared
 * the session, so the only honest message is "sign in again".
 */
function failMessage(e: unknown, fallback: string): string {
  if (e instanceof ApiError && e.status === 401) return "Your session has expired — please sign in again.";
  if (e instanceof ApiError) return e.message;
  return fallback;
}

const NAVY = "#0B1E3F";
const GOLD = "#C9A24B";
const DARK = "#F0F2F7";
const ADMIN = "#6D28D9";

// ─── Data ────────────────────────────────────────────────────────────────────













const SCREEN_LABELS: Record<string, string> = {
  dashboard:     "Dashboard",
  companies:     "Company Management",
  users:         "Users & Roles",
  workflows:     "Workflow Engine",
  automation:    "Automation Engine",
  "ai-engine":   "AI Engine",
  ocr:           "OCR Center",
  notifications: "Notification Center",
  audit:         "Audit Logs",
  settings:      "System Settings",
};

/** UI-02 — primary Super Admin tabs only. Engines live under Settings → Advanced Tools. */
const SA_NAV: NavItem[] = [
  { id: "dashboard", label: "Dashboard",          labelBn: "ড্যাশবোর্ড",           icon: LayoutDashboard as IconFC },
  { id: "companies", label: "Company Management", labelBn: "কোম্পানি ব্যবস্থাপনা", icon: Building2 as IconFC },
  { id: "users",     label: "Users & Roles",      labelBn: "ব্যবহারকারী ও রোল",   icon: Users as IconFC },
  // settings reachable via ?tab=settings — honest empty state (no production settings API UI yet)
];

/** Still reachable via Advanced Tools / ?tab= — not top-level nav. */
const SA_ADVANCED_IDS = new Set([
  "settings", "workflows", "automation", "ai-engine", "ocr", "notifications", "audit",
]);

// ─── Reusable helpers ────────────────────────────────────────────────────────

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="relative w-9 h-5 rounded-full transition-colors shrink-0"
      style={{ backgroundColor: on ? GOLD : "#EEF1F6" }}
    >
      <span
        className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform"
        style={{ transform: on ? "translateX(18px)" : "translateX(2px)" }}
      />
    </button>
  );
}

function saStatusKind(status: string): ErpStatusKind {
  if (status === "verified" || status === "active") return "approved";
  if (status === "suspended" || status === "rejected") return "rejected";
  if (status === "review") return "info";
  if (status === "inactive") return "cancelled";
  return "pending";
}

function SBadge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    verified: "Verified", active: "Active", pending: "Pending", review: "Under Review",
    paused: "Paused", suspended: "Suspended", rejected: "Rejected", inactive: "Inactive",
  };
  return <ErpStatusChip status={saStatusKind(status)} label={labels[status] ?? status} />;
}

interface KPIProps {
  label: string;
  value: string;
  delta?: { val: string; up: boolean };
  icon: IconFC;
  color: string;
  note?: string;
}
// Real platform analytics — fetched from the CEO dashboard aggregation. Replaces
// the old "Analytics coming soon" placeholder now that the backend supports it.
interface SACeoData { kpis: { ytdRevenue: number; netProfit: number; netMargin: number; activeGroups: number; arOutstanding: number; overdueInvoices: number; activeAgents: number } }
function saMoney(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e6) return `SAR ${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `SAR ${(n / 1e3).toFixed(1)}K`;
  return `SAR ${n.toLocaleString()}`;
}
function SAAnalytics() {
  const [data, setData] = useState<SACeoData | null>(null);
  const [loading, setLoading] = useState<boolean>(isLoggedIn());
  const [error, setError] = useState<string | null>(null);
  const load = () => {
    if (!isLoggedIn()) { setData(null); setLoading(false); return; }
    setLoading(true); setError(null);
    api.get<SACeoData>("/dashboards/ceo")
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(e instanceof ApiError ? e.message : "Failed to load analytics"); setLoading(false); });
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t); }, []);
  if (loading) return <LoadingSkeleton tone="light" rows={2} />;
  if (error) return <ErrorState message={error} onRetry={load} tone="light" />;
  if (!data) return <EmptyState title="Analytics" hint="Revenue and activity analytics load for signed-in admins." />;
  const k = data.kpis;
  return (
    <div className="grid grid-cols-4 gap-4">
      <KPICard label="YTD Revenue"   value={saMoney(k.ytdRevenue)}   icon={TrendingUp as IconFC} color={ADMIN}     note="Season 1446H" />
      <KPICard label="Net Profit"    value={saMoney(k.netProfit)}    icon={Activity as IconFC}   color="#16A34A"   note={`Margin ${k.netMargin.toFixed(1)}%`} />
      <KPICard label="Active Groups" value={String(k.activeGroups)}  icon={Building as IconFC}   color="#2563EB"   note={`${k.activeAgents} active agents`} />
      <KPICard label="AR Outstanding"value={saMoney(k.arOutstanding)}icon={Wallet as IconFC}     color="#B45309"   note={`${k.overdueInvoices} overdue`} />
    </div>
  );
}

function KPICard({ label, value, delta, icon: Icon, color, note }: KPIProps) {
  return (
    <div
      className="rounded-2xl p-5"
      style={{ backgroundColor: "#FBFCFD", border: "1px solid rgba(11,30,63,0.11)" }}
    >
      <div className="flex items-start justify-between mb-4">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${color}18` }}
        >
          <Icon size={16} style={{ color }} />
        </div>
        {delta && (
          <div
            className="flex items-center gap-1 text-xs font-semibold"
            style={{ color: delta.up ? "#16A34A" : "#DC2626" }}
          >
            {delta.up ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
            {delta.val}
          </div>
        )}
      </div>
      <div
        className="text-2xl font-bold text-[#0B1E3F] mb-1"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {value}
      </div>
      <div className="text-xs font-medium" style={{ color: "rgba(11,30,63,0.58)" }}>{label}</div>
      {note && <div className="text-[10px] mt-0.5" style={{ color: "rgba(11,30,63,0.50)" }}>{note}</div>}
    </div>
  );
}

function SectionHead({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-6 gap-3 flex-wrap">
      <div>
        <h2 className="text-base font-bold text-[#0B1E3F]">{title}</h2>
        {subtitle && <p className="text-xs mt-0.5" style={{ color: "rgba(11,30,63,0.58)" }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/** ESP-01 — FilterBar → ErpSearchBar + ErpButton adapter (uncontrolled search chrome). */
function FilterBar({ placeholder = "Search…", children }: { placeholder?: string; children?: ReactNode }) {
  const [q, setQ] = useState("");
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 mb-5">
      <div className="flex-1 min-w-0">
        <ErpSearchBar value={q} onChange={(e) => setQ(e.target.value)} onClear={() => setQ("")} placeholder={placeholder} lang="en" />
      </div>
      {children}
      <ErpButton size="sm" variant="outline" icon={<Filter size={11} />}>Filter</ErpButton>
      <ErpButton size="sm" variant="outline" icon={<Download size={11} />}>Export</ErpButton>
    </div>
  );
}

function THead({ cols }: { cols: string[] }) {
  return (
    <thead>
      <tr style={{ backgroundColor: "#FBFCFD", borderBottom: "1px solid rgba(11,30,63,0.11)" }}>
        {cols.map((c) => (
          <th key={c} className="px-4 py-2.5 text-left text-[9px] font-bold uppercase tracking-widest" style={{ color: "rgba(11,30,63,0.50)" }}>
            {c}
          </th>
        ))}
      </tr>
    </thead>
  );
}

// ─── Screens ─────────────────────────────────────────────────────────────────

function DashboardScreen() {
  const [companies, setCompanies] = useState<ApiCompanyListItem[] | null>(null);
  const [userCount, setUserCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = () => {
    setLoading(true);
    setError("");
    Promise.all([
      hasPermission("APPROVE_COMPANIES") ? api.get<ApiCompanyListItem[]>("/companies") : Promise.resolve([] as ApiCompanyListItem[]),
      hasPermission("MANAGE_USERS") ? api.get<{ id: string }[]>("/users") : Promise.resolve([] as { id: string }[]),
    ])
      .then(([c, u]) => { setCompanies(c); setUserCount(u.length); })
      .catch((e) => { setCompanies(null); setUserCount(null); setError(failMessage(e, "Could not load the overview")); })
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const agents = companies?.filter((c) => c.type === "AGENT").length ?? 0;
  const suppliers = companies?.filter((c) => c.type === "SUPPLIER").length ?? 0;
  const pending = companies?.filter((c) => c.verificationStatus === "PENDING" || c.verificationStatus === "UNDER_REVIEW").length ?? 0;
  const verified = companies?.filter((c) => c.verificationStatus === "VERIFIED").length ?? 0;

  return (
    <div className="p-7 space-y-6">
      <SectionHead
        title="Overview"
        subtitle="Platform summary"
        action={
          <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs" style={{ border: `1px solid ${GOLD}30`, color: GOLD }}>
            <RefreshCw size={11} /> Refresh
          </button>
        }
      />
      {loading ? (
        <LoadingSkeleton rows={2} tone="light" />
      ) : error ? (
        <ErrorState message={error} onRetry={load} tone="light" />
      ) : (
        <div className="grid grid-cols-4 gap-4">
          <KPICard label="Agents" value={String(agents)} icon={Users as IconFC} color={ADMIN} note={`${verified} verified`} />
          <KPICard label="Suppliers" value={String(suppliers)} icon={Building as IconFC} color="#2563EB" note="registered" />
          <KPICard label="Pending Verification" value={String(pending)} icon={Clock as IconFC} color="#D97706" note="awaiting review" />
          <KPICard label="Portal Users" value={userCount == null ? "\u2014" : String(userCount)} icon={Users2 as IconFC} color="#16A34A" note="staff accounts" />
        </div>
      )}
      <div className="rounded-2xl p-6" style={{ backgroundColor: "#FBFCFD", border: "1px solid rgba(11,30,63,0.11)" }}>
        <div className="text-xs font-black uppercase tracking-widest mb-4" style={{ color: "rgba(11,30,63,0.50)" }}>Platform Analytics — Season 1446H</div>
        <SAAnalytics />
      </div>
    </div>
  );
}

// ── Live Company Management (falls back to mock rows when not signed in) ─────

interface CompanyRow {
  key: string;
  realId: string | null; // DB id when live
  name: string;
  code: string;
  typeLabel: "Agent" | "Supplier";
  city: string;
  statusKey: string; // SBadge key (lowercase)
  status: string; // raw verificationStatus (drives the row action menu)
  groups: number;
  joined: string;
}

/** Kebab quick-actions for a row, by current verification status. Reject routes
 *  to the review modal because the API requires a reason for rejection. */
function rowActions(
  status: string,
): Array<{ key: "view" | "approve" | "reject" | "suspend" | "reactivate"; label: string; danger?: boolean }> {
  const view = { key: "view" as const, label: "View details" };
  switch (status) {
    case "PENDING":
    case "UNDER_REVIEW":
      return [view, { key: "approve", label: "Approve" }, { key: "reject", label: "Reject", danger: true }];
    case "VERIFIED":
      return [view, { key: "suspend", label: "Suspend", danger: true }];
    case "SUSPENDED":
      return [view, { key: "reactivate", label: "Reactivate" }];
    default: // REJECTED — resubmission is handled inside the review modal
      return [view];
  }
}

/** The legal PATCH sequence to move a company from its current status to a target,
 *  mirroring the API state machine (PENDING → UNDER_REVIEW → VERIFIED). */
function verifyPath(current: string, target: "VERIFIED" | "SUSPENDED"): string[] {
  if (target === "SUSPENDED") return ["SUSPENDED"]; // VERIFIED → SUSPENDED
  if (current === "PENDING") return ["UNDER_REVIEW", "VERIFIED"]; // chain through review
  return ["VERIFIED"]; // UNDER_REVIEW or SUSPENDED → VERIFIED
}

const STATUS_TO_BADGE: Record<string, string> = {
  VERIFIED: "verified",
  PENDING: "pending",
  UNDER_REVIEW: "review",
  REJECTED: "rejected",
  SUSPENDED: "suspended",
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

interface ApiCompanyListItem {
  id: string;
  code: string;
  type: "AGENT" | "SUPPLIER";
  name: string;
  city: string | null;
  verificationStatus: string;
  joinedAt: string;
  _count: { groups: number; users: number };
}

interface ApiCompanyDetail extends ApiCompanyListItem {
  email: string | null;
  phone: string | null;
  rejectionReason: string | null;
  agentProfile: {
    crNumber: string | null;
    ownerName: string | null;
    ownerIdNumber: string | null;
    businessEmail: string | null;
    website: string | null;
    referenceAgencyName: string | null;
    referenceAgentCode: string | null;
    guarantors: Array<{ position: number; name: string; nationalId: string; phone: string | null }>;
  } | null;
  supplierProfile: { type: string } | null;
  bankAccounts: Array<{ bankName: string; accountNumber: string; iban: string | null }>;
  uploadedFiles: Array<{ id: string; kind: string; fileName: string; sizeBytes: number }>;
  users: Array<{ id: string; email: string; name: string; status: string }>;
}

/** Next legal verification transitions (mirrors the API state machine). */
const NEXT_TRANSITIONS: Record<string, Array<{ to: string; label: string; danger?: boolean; needsReason?: boolean }>> = {
  PENDING: [
    { to: "UNDER_REVIEW", label: "Start Review" },
    { to: "REJECTED", label: "Reject", danger: true, needsReason: true },
  ],
  UNDER_REVIEW: [
    { to: "VERIFIED", label: "Approve" },
    { to: "REJECTED", label: "Reject", danger: true, needsReason: true },
  ],
  REJECTED: [{ to: "UNDER_REVIEW", label: "Reopen Review" }],
  VERIFIED: [{ to: "SUSPENDED", label: "Suspend", danger: true }],
  SUSPENDED: [{ to: "VERIFIED", label: "Reactivate" }],
};

function CompanyReviewModal({
  companyId,
  onClose,
  onChanged,
}: {
  companyId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<ApiCompanyDetail | null>(null);
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [openingDoc, setOpeningDoc] = useState<string | null>(null);

  const load = () => {
    setError("");
    api
      .get<ApiCompanyDetail>(`/companies/${companyId}`)
      .then(setDetail)
      .catch((e) => setError(failMessage(e, "Failed to load company")));
  };
  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const transition = async (to: string, needsReason?: boolean) => {
    if (needsReason && !reason.trim()) {
      setError("A reason is required to reject this application.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api.patch(`/companies/${companyId}/verification`, {
        status: to,
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      });
      setReason("");
      load();
      onChanged();
    } catch (e) {
      setError(failMessage(e, "Transition failed"));
    } finally {
      setBusy(false);
    }
  };

  // Uses the shared api helper so the request carries the live access token and
  // benefits from the client's 401-refresh, instead of reading sessionStorage raw.
  const viewDoc = async (docId: string, fileName: string) => {
    if (openingDoc) return;
    setOpeningDoc(docId);
    setError("");
    try {
      const url = await api.fileBlobUrl(docId);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      setError(failMessage(e, `Could not open ${fileName}`));
    } finally {
      setOpeningDoc(null);
    }
  };

  const Row = ({ label, value }: { label: string; value: ReactNode }) => (
    <div className="flex items-start justify-between gap-4 px-4 py-2" style={{ borderBottom: "1px solid rgba(11,30,63,0.08)" }}>
      <span className="text-[10px] uppercase tracking-widest shrink-0 pt-0.5" style={{ color: "rgba(11,30,63,0.50)" }}>{label}</span>
      {/* min-w-0 + truncate: real agency/owner/guarantor names and IBANs overflow this
          fixed-width modal; the full value stays available on hover. */}
      <span
        className="text-xs font-semibold text-right min-w-0 truncate"
        style={{ color: "rgba(11,30,63,0.86)" }}
        title={typeof value === "string" ? value : undefined}
      >
        {value ?? "—"}
      </span>
    </div>
  );

  const actions = detail ? (NEXT_TRANSITIONS[detail.verificationStatus] ?? []) : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ backgroundColor: "rgba(3,8,18,0.75)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl"
        style={{ backgroundColor: "#F0F3F7", border: "1px solid rgba(11,30,63,0.15)", scrollbarWidth: "thin" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 flex items-center gap-3 sticky top-0" style={{ backgroundColor: "#F0F3F7", borderBottom: "1px solid rgba(11,30,63,0.11)" }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${ADMIN}20` }}>
            <Building2 size={16} style={{ color: "#7C3AED" }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-[#0B1E3F] truncate" title={detail?.name}>{detail?.name ?? "Loading…"}</div>
            <div className="text-[10px]" style={{ color: "rgba(11,30,63,0.58)", fontFamily: "var(--font-mono)" }}>{detail?.code}</div>
          </div>
          {detail && <SBadge status={STATUS_TO_BADGE[detail.verificationStatus] ?? "pending"} />}
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/8" style={{ color: "rgba(11,30,63,0.58)" }}>
            <X size={14} />
          </button>
        </div>

        {detail && (
          <div className="p-6 space-y-5">
            {/* Profile */}
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(11,30,63,0.11)" }}>
              <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest" style={{ backgroundColor: `${GOLD}10`, color: GOLD }}>Submitted Profile</div>
              <Row label="Type" value={detail.type === "AGENT" ? "Agent" : `Supplier · ${detail.supplierProfile?.type ?? ""}`} />
              <Row label="City" value={detail.city} />
              <Row label="Email" value={detail.email} />
              <Row label="Phone" value={detail.phone} />
              {detail.agentProfile && (
                <>
                  <Row label="CR Number" value={detail.agentProfile.crNumber} />
                  <Row label="Owner" value={detail.agentProfile.ownerName} />
                  <Row label="Owner ID" value={detail.agentProfile.ownerIdNumber} />
                  <Row label="Website" value={detail.agentProfile.website} />
                  <Row
                    label="Reference Agent"
                    value={
                      detail.agentProfile.referenceAgencyName
                        ? `${detail.agentProfile.referenceAgencyName} (${detail.agentProfile.referenceAgentCode ?? "—"})`
                        : "—"
                    }
                  />
                  {detail.agentProfile.guarantors.map((g) => (
                    <Row key={g.position} label={`Guarantor ${g.position}`} value={`${g.name} · ${g.nationalId}${g.phone ? ` · ${g.phone}` : ""}`} />
                  ))}
                </>
              )}
              {detail.bankAccounts.map((b, i) => (
                <Row key={i} label="Bank" value={`${b.bankName} · ${b.iban ?? b.accountNumber}`} />
              ))}
              <Row label="Joined" value={fmtDate(detail.joinedAt)} />
              {detail.rejectionReason && <Row label="Rejection Reason" value={<span style={{ color: "#DC2626" }}>{detail.rejectionReason}</span>} />}
            </div>

            {/* Documents */}
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(11,30,63,0.11)" }}>
              <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest" style={{ backgroundColor: `${GOLD}10`, color: GOLD }}>
                Documents ({detail.uploadedFiles.length})
              </div>
              {detail.uploadedFiles.length === 0 && (
                <div className="px-4 py-3 text-xs" style={{ color: "rgba(11,30,63,0.50)" }}>No documents uploaded</div>
              )}
              {detail.uploadedFiles.map((f) => (
                <div key={f.id} className="flex items-center gap-3 px-4 py-2.5" style={{ borderBottom: "1px solid rgba(11,30,63,0.08)" }}>
                  <FileText size={13} style={{ color: "rgba(11,30,63,0.58)" }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-[#0B1E3F] truncate" title={f.fileName}>{f.fileName}</div>
                    <div className="text-[9px]" style={{ color: "rgba(11,30,63,0.50)" }}>
                      {f.kind.replace(/_/g, " ")} · {(f.sizeBytes / 1024).toFixed(0)} KB
                    </div>
                  </div>
                  <button
                    onClick={() => void viewDoc(f.id, f.fileName)}
                    disabled={openingDoc !== null}
                    className="text-[10px] font-bold px-2.5 py-1 rounded-lg hover:opacity-80 shrink-0 disabled:opacity-50"
                    style={{ backgroundColor: `${GOLD}15`, color: GOLD, border: `1px solid ${GOLD}30` }}
                  >
                    {openingDoc === f.id ? "Opening…" : "View"}
                  </button>
                </div>
              ))}
            </div>

            {/* Decision */}
            {actions.length > 0 && (
              <div className="rounded-xl p-4 space-y-3" style={{ border: "1px solid rgba(11,30,63,0.11)", backgroundColor: "#FFFFFF" }}>
                {actions.some((a) => a.needsReason) && (
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                    placeholder="Reason (required when rejecting)…"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl focus:outline-none"
                    style={{ backgroundColor: "#FBFCFD", border: "1px solid rgba(11,30,63,0.15)", color: "#0B1E3F" }}
                  />
                )}
                <div className="flex gap-2">
                  {actions.map((a) => (
                    <button
                      key={a.to}
                      disabled={busy}
                      onClick={() => void transition(a.to, a.needsReason)}
                      className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                      style={
                        a.danger
                          ? { backgroundColor: "rgba(239,68,68,0.12)", color: "#DC2626", border: "1px solid rgba(239,68,68,0.3)" }
                          : { backgroundColor: GOLD, color: NAVY }
                      }
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {error && (
              <div className="p-3 rounded-xl text-xs" style={{ backgroundColor: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", color: "#DC2626" }}>
                {error}
              </div>
            )}
          </div>
        )}
        {/* Failed to load at all → designed error with retry, not a blank sheet. */}
        {!detail && error && (
          <div className="p-6">
            <ErrorState message={error} onRetry={load} tone="light" />
          </div>
        )}
        {/* Still loading → designed skeleton, not an empty modal body. */}
        {!detail && !error && (
          <div className="px-6 py-5">
            <LoadingSkeleton rows={6} tone="light" />
          </div>
        )}
      </div>
    </div>
  );
}

function CompanyScreen() {
  const [filter, setFilter] = useState<"all" | "agents" | "suppliers" | "suspended">("all");
  const tabs = ["all", "agents", "suppliers", "suspended"] as const;

  // Signed out → prototype rows (demo behaviour, intentionally kept).
  // Signed in → real data ONLY: a failed fetch shows the designed error rather
  // than silently reverting to mock rows that look like real companies.
  const demo = !isLoggedIn();
  const [live, setLive] = useState<ApiCompanyListItem[] | null>(null);
  const [loading, setLoading] = useState(!demo);
  const [error, setError] = useState("");
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null); // row whose "…" menu is open
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null); // viewport coords for the portalled menu
  const [acting, setActing] = useState<string | null>(null); // company id mid-transition
  const [rowErr, setRowErr] = useState("");

  const refresh = () => {
    if (demo) return;
    setLoading(true);
    setError("");
    api
      .get<ApiCompanyListItem[]>("/companies")
      .then((d) => setLive(d))
      .catch((e) => {
        setLive(null);
        setError(failMessage(e, "Could not load companies"));
      })
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    const t = setTimeout(refresh, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // One-click verification actions from the row "…" menu. Approve chains through
  // the legal state machine (PENDING → UNDER_REVIEW → VERIFIED) so a pending
  // application can be approved in a single click; each step hits the real
  // PATCH /companies/:id/verification endpoint.
  const runQuick = async (companyId: string, current: string, kind: "approve" | "suspend" | "reactivate") => {
    setMenuFor(null);
    setActing(companyId);
    setRowErr("");
    const path = kind === "suspend" ? verifyPath(current, "SUSPENDED") : verifyPath(current, "VERIFIED");
    try {
      for (const step of path) {
        await api.patch(`/companies/${companyId}/verification`, { status: step });
      }
      refresh();
    } catch (e) {
      setRowErr(failMessage(e, "Action failed"));
    } finally {
      setActing(null);
    }
  };

  const rows: CompanyRow[] = live
    ? live.map((c) => ({
        key: c.id,
        realId: c.id,
        name: c.name,
        code: c.code,
        typeLabel: c.type === "AGENT" ? "Agent" : "Supplier",
        city: c.city ?? "—",
        statusKey: STATUS_TO_BADGE[c.verificationStatus] ?? "pending",
        status: c.verificationStatus,
        groups: c._count.groups,
        joined: fmtDate(c.joinedAt),
      }))
    : []; // live-only (Super Admin is auth-guarded)

  const filtered = rows.filter((c) => {
    if (filter === "agents") return c.typeLabel === "Agent";
    if (filter === "suppliers") return c.typeLabel === "Supplier";
    if (filter === "suspended") return c.statusKey === "suspended" || c.statusKey === "rejected";
    return true;
  });

  const agents = rows.filter((r) => r.typeLabel === "Agent").length;
  const suppliers = rows.filter((r) => r.typeLabel === "Supplier").length;

  return (
    <div className="p-7">
      <SectionHead
        title="Company Management"
        subtitle={
          loading || error
            ? "— registered companies" // counts are unknown until the fetch settles
            : `${rows.length} registered companies · ${agents} agents · ${suppliers} suppliers`
        }
        action={
          <button
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold"
            style={{ backgroundColor: GOLD, color: NAVY }}
          >
            <Plus size={12} /> Add Company
          </button>
        }
      />

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 p-1 rounded-xl w-fit" style={{ backgroundColor: "#FBFCFD", border: "1px solid rgba(11,30,63,0.11)" }}>
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all"
            style={filter === t ? { backgroundColor: GOLD, color: NAVY } : { color: "rgba(11,30,63,0.58)" }}
          >
            {t === "all" ? "All Companies" : t === "agents" ? "Agents" : t === "suppliers" ? "Suppliers" : "Suspended"}
          </button>
        ))}
      </div>

      <FilterBar placeholder="Search company name, ID, city…" />

      {rowErr && (
        <div className="mb-3 px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", color: "#DC2626" }}>
          {rowErr}
        </div>
      )}

      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(11,30,63,0.11)" }}>
        {loading ? (
          <div className="px-4 py-3">
            <LoadingSkeleton rows={5} tone="light" />
          </div>
        ) : error ? (
          <div className="p-4">
            <ErrorState message={error} onRetry={refresh} tone="light" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            tone="light"
            icon={<Building2 size={32} className="opacity-25" style={{ color: "rgba(11,30,63,0.66)" }} />}
            title={filter === "all" ? "No companies registered yet" : "No companies match this filter"}
            hint={
              filter === "all"
                ? "New agent and supplier applications appear here for review."
                : "Switch tabs to see the rest of the register."
            }
          />
        ) : (
        <table className="w-full">
          <THead cols={["Company", "Type", "City", "Status", "Active Groups", "Joined", ""]} />
          <tbody>
            {filtered.map((c, i) => (
              <tr
                key={c.key}
                style={{ borderBottom: i < filtered.length - 1 ? "1px solid rgba(11,30,63,0.08)" : undefined }}
                className="hover:bg-white/2 transition-colors"
              >
                <td className="px-4 py-3">
                  <div className="text-xs font-semibold text-[#0B1E3F]">{c.name}</div>
                  <div className="text-[10px] mt-0.5" style={{ color: "rgba(11,30,63,0.50)", fontFamily: "var(--font-mono)" }}>{c.code}</div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: c.typeLabel === "Agent" ? `${ADMIN}18` : "#2563EB18",
                      color: c.typeLabel === "Agent" ? "#7C3AED" : "#2563EB",
                    }}
                  >
                    {c.typeLabel}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs" style={{ color: "rgba(11,30,63,0.76)" }}>{c.city}</td>
                <td className="px-4 py-3"><SBadge status={c.statusKey} /></td>
                <td className="px-4 py-3 text-xs font-mono text-center" style={{ color: c.groups > 0 ? GOLD : "rgba(11,30,63,0.50)", fontFamily: "var(--font-mono)" }}>
                  {c.groups}
                </td>
                <td className="px-4 py-3 text-[10px]" style={{ color: "rgba(11,30,63,0.58)" }}>{c.joined}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => c.realId && setReviewId(c.realId)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/8 transition-all"
                      style={{ color: c.realId ? "rgba(11,30,63,0.58)" : "rgba(11,30,63,0.38)" }}
                      title={c.realId ? "View application & documents" : "Sign in as Super Admin to review"}
                    >
                      <Eye size={12} />
                    </button>
                    <button
                      onClick={(e) => {
                        if (!c.realId) return;
                        if (menuFor === c.key) { setMenuFor(null); return; }
                        // Capture the button's viewport rect so the menu can be portalled to
                        // <body> with position:fixed — escaping the table's overflow-hidden clip.
                        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        setMenuPos({ top: r.bottom + 4, right: Math.max(8, window.innerWidth - r.right) });
                        setMenuFor(c.key);
                      }}
                      disabled={acting === c.realId}
                      className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/8 transition-all disabled:opacity-50"
                      style={{ color: c.realId ? "rgba(11,30,63,0.58)" : "rgba(11,30,63,0.38)" }}
                      title={c.realId ? "Approve / Reject / Suspend" : "Sign in as Super Admin"}
                    >
                      {acting === c.realId ? <RefreshCw size={12} className="animate-spin" /> : <MoreHorizontal size={12} />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </div>

      {reviewId && (
        <CompanyReviewModal companyId={reviewId} onClose={() => setReviewId(null)} onChanged={refresh} />
      )}

      {/* Row "…" action menu — portalled to <body> with position:fixed so it is not
          clipped by the table's rounded-2xl overflow-hidden wrapper. */}
      {menuFor && menuPos && (() => {
        const active = filtered.find((r) => r.key === menuFor);
        if (!active || !active.realId) return null;
        return createPortal(
          <>
            <div className="fixed inset-0 z-[60]" onClick={() => setMenuFor(null)} />
            <div
              className="fixed z-[61] w-44 rounded-xl py-1 overflow-hidden"
              style={{ top: menuPos.top, right: menuPos.right, backgroundColor: "#FFFFFF", border: "1px solid rgba(11,30,63,0.12)", boxShadow: "0 10px 30px rgba(3,8,18,0.18)" }}
            >
              {rowActions(active.status).map((a) => (
                <button
                  key={a.key}
                  onClick={() => {
                    if (a.key === "view" || a.key === "reject") {
                      setMenuFor(null);
                      setReviewId(active.realId); // Reject needs a reason → review modal
                    } else {
                      void runQuick(active.realId as string, active.status, a.key);
                    }
                  }}
                  className="w-full text-left px-3.5 py-2 text-xs font-medium flex items-center gap-2 hover:bg-black/[0.04] transition-colors"
                  style={{ color: a.danger ? "#DC2626" : "rgba(11,30,63,0.86)" }}
                >
                  {a.key === "view" ? (
                    <Eye size={12} />
                  ) : a.key === "reject" ? (
                    <XCircle size={12} />
                  ) : a.key === "suspend" ? (
                    <AlertCircle size={12} />
                  ) : (
                    <CheckCircle size={12} />
                  )}
                  {a.label}
                </button>
              ))}
            </div>
          </>,
          document.body,
        );
      })()}
    </div>
  );
}

interface ApiUserRow {
  id: string;
  email: string;
  name: string;
  status: string;
  lastLoginAt: string | null;
  role: { key: string; name: string };
  company: { code: string; name: string } | null;
}
interface ApiRole {
  key: string;
  name: string;
  users: number;
  permissions: string[];
}
interface ApiPermission {
  key: string;
  name: string;
}

function AddUserModal({ roles, onClose, onCreated }: { roles: ApiRole[]; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [roleKey, setRoleKey] = useState(roles.find((r) => r.key !== "SUPER_ADMIN")?.key ?? "OPS_STAFF");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ email: string; tempPassword?: string } | null>(null);

  const submit = async () => {
    setError("");
    if (!name || !email) { setError("Name and email are required."); return; }
    setBusy(true);
    try {
      const res = await api.post<{ email: string; tempPassword?: string }>("/users", { name, email, roleKey });
      setCreated(res);
      onCreated();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to create user");
    } finally {
      setBusy(false);
    }
  };

  const field = { backgroundColor: "#FBFCFD", border: "1px solid rgba(11,30,63,0.15)", color: "#0B1E3F" } as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ backgroundColor: "rgba(3,8,18,0.75)" }} onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl p-6" style={{ backgroundColor: "#F0F3F7", border: "1px solid rgba(11,30,63,0.15)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div className="text-sm font-bold text-[#0B1E3F]">Add User</div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/8" style={{ color: "rgba(11,30,63,0.58)" }}>
            <X size={14} />
          </button>
        </div>
        {created ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl text-xs" style={{ backgroundColor: "#16A34A10", border: "1px solid #16A34A30", color: "rgba(11,30,63,0.86)" }}>
              User <span style={{ color: GOLD }}>{created.email}</span> created.
              {created.tempPassword && (
                <div className="mt-2">
                  Temporary password:{" "}
                  <span className="font-bold" style={{ color: GOLD, fontFamily: "var(--font-mono)" }}>{created.tempPassword}</span>
                </div>
              )}
            </div>
            <button onClick={onClose} className="w-full py-2.5 rounded-xl text-xs font-bold" style={{ backgroundColor: GOLD, color: NAVY }}>Done</button>
          </div>
        ) : (
          <div className="space-y-4">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="w-full px-3.5 py-2.5 text-xs rounded-xl focus:outline-none" style={field} />
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email address" className="w-full px-3.5 py-2.5 text-xs rounded-xl focus:outline-none" style={field} />
            <select value={roleKey} onChange={(e) => setRoleKey(e.target.value)} className="w-full px-3.5 py-2.5 text-xs rounded-xl focus:outline-none" style={field}>
              {roles.map((r) => (
                <option key={r.key} value={r.key} style={{ color: "black" }}>{r.name}</option>
              ))}
            </select>
            {error && <div className="p-3 rounded-xl text-xs" style={{ backgroundColor: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", color: "#DC2626" }}>{error}</div>}
            <button disabled={busy} onClick={() => void submit()} className="w-full py-2.5 rounded-xl text-xs font-bold disabled:opacity-50" style={{ backgroundColor: GOLD, color: NAVY }}>
              Create User
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function UserRoleScreen() {
  const [tab, setTab] = useState<"users" | "roles">("users");

  const [liveUsers, setLiveUsers] = useState<ApiUserRow[] | null>(null);
  const [liveRoles, setLiveRoles] = useState<ApiRole[] | null>(null);
  const [livePerms, setLivePerms] = useState<ApiPermission[] | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [matrixError, setMatrixError] = useState("");

  // Signed out → prototype rows (demo behaviour, intentionally kept).
  // Signed in → real data ONLY; a failure surfaces the designed error state.
  const demo = !isLoggedIn();
  const [loading, setLoading] = useState(!demo);
  const [loadError, setLoadError] = useState("");

  const refresh = () => {
    if (demo) return;
    setLoading(true);
    setLoadError("");
    Promise.all([
      api.get<ApiUserRow[]>("/users"),
      api.get<ApiRole[]>("/roles"),
      api.get<ApiPermission[]>("/permissions"),
    ])
      .then(([u, r, p]) => {
        setLiveUsers(u);
        setLiveRoles(r);
        setLivePerms(p);
      })
      .catch((e) => {
        setLiveUsers(null);
        setLiveRoles(null);
        setLivePerms(null);
        setLoadError(failMessage(e, "Could not load users and roles"));
      })
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    const t = setTimeout(refresh, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isLive = !!(liveUsers && liveRoles && livePerms);

  const togglePermission = async (roleKey: string, permKey: string) => {
    if (!liveRoles) return;
    if (roleKey === "SUPER_ADMIN") { setMatrixError("SUPER_ADMIN permissions are fixed (lock-out protection)."); return; }
    setMatrixError("");
    const role = liveRoles.find((r) => r.key === roleKey)!;
    const next = role.permissions.includes(permKey)
      ? role.permissions.filter((p) => p !== permKey)
      : [...role.permissions, permKey];
    // optimistic update
    setLiveRoles((rs) => rs!.map((r) => (r.key === roleKey ? { ...r, permissions: next } : r)));
    try {
      await api.patch(`/roles/${roleKey}/permissions`, { permissions: next });
    } catch (e) {
      setMatrixError(e instanceof ApiError ? e.message : "Failed to save permissions");
      refresh(); // revert to server truth
    }
  };

  const deactivateUser = async (u: ApiUserRow) => {
    if (!window.confirm(`Deactivate ${u.email}?`)) return;
    try {
      await api.patch(`/users/${u.id}`, { status: "INACTIVE" });
      refresh();
    } catch (e) {
      setMatrixError(e instanceof ApiError ? e.message : "Failed to deactivate user");
    }
  };

  const fmtLast = (iso: string | null) => {
    if (!iso) return "Never";
    const d = new Date(iso);
    const today = new Date();
    const sameDay = d.toDateString() === today.toDateString();
    return sameDay
      ? `Today ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
      : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  };

  const userRows = liveUsers
    ? liveUsers.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role.name, last: fmtLast(u.lastLoginAt), status: u.status.toLowerCase(), live: u }))
    : []; // live-only (Super Admin is auth-guarded)

  return (
    <div className="p-7">
      <SectionHead
        title="Users & Role Management"
        subtitle="Manage portal users and configure role-based access controls"
        action={
          <button
            onClick={() => isLive && setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold"
            style={{ backgroundColor: GOLD, color: NAVY, opacity: isLive ? 1 : 0.5 }}
            title={isLive ? "Add a portal user" : "Sign in as Super Admin to manage users"}
          >
            <Plus size={12} /> Add User
          </button>
        }
      />

      <div className="flex gap-1 mb-5 p-1 rounded-xl w-fit" style={{ backgroundColor: "#FBFCFD", border: "1px solid rgba(11,30,63,0.11)" }}>
        {(["users", "roles"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all"
            style={tab === t ? { backgroundColor: GOLD, color: NAVY } : { color: "rgba(11,30,63,0.58)" }}
          >
            {t === "users" ? "Users" : "Roles & Permissions"}
          </button>
        ))}
      </div>

      {tab === "users" && (
        <>
          <FilterBar placeholder="Search by name, email, role…" />
          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(11,30,63,0.11)" }}>
            {loading ? (
              <div className="px-4 py-3">
                <LoadingSkeleton rows={5} tone="light" />
              </div>
            ) : loadError ? (
              <div className="p-4">
                <ErrorState message={loadError} onRetry={refresh} tone="light" />
              </div>
            ) : userRows.length === 0 ? (
              <EmptyState
                tone="light"
                icon={<Users2 size={32} className="opacity-25" style={{ color: "rgba(11,30,63,0.66)" }} />}
                title="No portal users yet"
                hint="Use Add User to invite the first operations account."
              />
            ) : (
            <table className="w-full">
              <THead cols={["User", "Role", "Last Login", "Status", ""]} />
              <tbody>
                {userRows.map((u, i) => (
                  <tr
                    key={u.id}
                    style={{ borderBottom: i < userRows.length - 1 ? "1px solid rgba(11,30,63,0.08)" : undefined }}
                    className="hover:bg-white/2 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0"
                          style={{ backgroundColor: `${ADMIN}20`, color: "#7C3AED" }}
                        >
                          {u.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-[#0B1E3F] truncate" title={u.name}>{u.name}</div>
                          <div className="text-[10px] truncate" style={{ color: "rgba(11,30,63,0.50)" }} title={u.email}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#F5F7FA", color: "rgba(11,30,63,0.76)" }}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[10px]" style={{ color: "rgba(11,30,63,0.58)", fontFamily: "var(--font-mono)" }}>{u.last}</td>
                    <td className="px-4 py-3"><SBadge status={u.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/8" style={{ color: "rgba(11,30,63,0.58)" }}><Eye size={12} /></button>
                        <button
                          onClick={() => u.live && void deactivateUser(u.live)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/8"
                          style={{ color: u.live ? "#DC2626" : "rgba(248,113,113,0.3)" }}
                          title={u.live ? "Deactivate user" : "Sign in as Super Admin to manage"}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            )}
          </div>
        </>
      )}

      {tab === "roles" && (
        <>
          {matrixError && (
            <div className="mb-3 p-3 rounded-xl text-xs" style={{ backgroundColor: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", color: "#DC2626" }}>
              {matrixError}
            </div>
          )}
          <div className="rounded-2xl overflow-auto" style={{ border: "1px solid rgba(11,30,63,0.11)" }}>
            {loading ? (
              <div className="px-4 py-3">
                <LoadingSkeleton rows={6} tone="light" />
              </div>
            ) : loadError ? (
              <div className="p-4">
                <ErrorState message={loadError} onRetry={refresh} tone="light" />
              </div>
            ) : isLive && (liveRoles!.length === 0 || livePerms!.length === 0) ? (
              <EmptyState
                tone="light"
                icon={<Shield size={32} className="opacity-25" style={{ color: "rgba(11,30,63,0.66)" }} />}
                title="No roles configured"
                hint="Roles and permissions are seeded by the platform — contact the operator."
              />
            ) : isLive ? (
              <table className="w-full">
                <thead>
                  <tr style={{ backgroundColor: "#FBFCFD", borderBottom: "1px solid rgba(11,30,63,0.11)" }}>
                    <th className="px-4 py-2.5 text-left text-[9px] font-bold uppercase tracking-widest w-52" style={{ color: "rgba(11,30,63,0.50)" }}>Permission</th>
                    {liveRoles!.map((role) => (
                      <th key={role.key} className="px-4 py-2.5 text-center text-[9px] font-bold uppercase tracking-widest whitespace-nowrap" style={{ color: "rgba(11,30,63,0.50)" }}>
                        {role.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {livePerms!.map((perm, pi) => (
                    <tr
                      key={perm.key}
                      style={{ borderBottom: pi < livePerms!.length - 1 ? "1px solid rgba(11,30,63,0.08)" : undefined }}
                      className="hover:bg-white/2"
                    >
                      <td className="px-4 py-2.5 text-xs text-[#0B1E3F]">{perm.name}</td>
                      {liveRoles!.map((role) => {
                        const has = role.permissions.includes(perm.key);
                        const locked = role.key === "SUPER_ADMIN";
                        return (
                          <td key={role.key} className="px-4 py-2.5 text-center">
                            <button
                              onClick={() => void togglePermission(role.key, perm.key)}
                              disabled={locked}
                              title={locked ? "SUPER_ADMIN is locked" : `Toggle ${perm.name} for ${role.name}`}
                              className="w-5 h-5 rounded-md flex items-center justify-center mx-auto transition-all disabled:cursor-not-allowed"
                              style={{ backgroundColor: has ? "#16A34A20" : "#EEF1F6", opacity: locked ? 0.6 : 1 }}
                            >
                              {has ? <Check size={10} style={{ color: "#16A34A" }} /> : <X size={9} style={{ color: "rgba(11,30,63,0.38)" }} />}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </div>
        </>
      )}

      {showAdd && liveRoles && (
        <AddUserModal roles={liveRoles} onClose={() => setShowAdd(false)} onCreated={refresh} />
      )}
    </div>
  );
}

function SAComingSoon({ label }: { label: string }) {
  return (
    <div className="p-7">
      <EmptyState
        tone="light"
        title={label}
        hint="এই মডিউল এখনও কনফিগার করা হয়নি।"
      />
    </div>
  );
}
function WorkflowScreen() { return <SAComingSoon label="ওয়ার্কফ্লো ইঞ্জিন" />; }
/** S2-05: land on the dedicated Automation Admin module (do not nest ERPShell). */
function AutomationScreen() { return <Navigate to="/automation" replace />; }
function AIEngineScreen() { return <SAComingSoon label="এআই ইঞ্জিন" />; }
/** UI-02 — Advanced Tools OCR opens the live OCR Center route. */
function OCRCenterScreen() { return <Navigate to="/ocr-center" replace />; }
function NotifCenterScreen() { return <Navigate to="/automation?tab=notifications" replace />; }
function SystemSettingsScreen() { return <SAComingSoon label="সিস্টেম সেটিংস" />; }

// ── Audit Logs (S2-01) — read-only list over GET /audit-logs ─────────────────

interface AuditLogRow {
  id: string;
  actorUserId: string | null;
  actorLabel: string | null;
  actorEmail: string | null;
  actorName: string | null;
  action: string;
  module: string;
  entityType: string;
  entityId: string | null;
  ip: string | null;
  createdAt: string;
}

interface AuditLogPage {
  items: AuditLogRow[];
  total: number;
  page: number;
  pageSize: number;
  sort: string;
}

const AUDIT_ACTIONS = [
  "CREATE", "UPDATE", "DELETE", "APPROVE", "REJECT", "EXPORT",
  "RUN", "VIEW", "PROCESS", "TOGGLE", "REVIEW", "LOGIN",
] as const;

function AuditLogsScreen() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const [module, setModule] = useState("");
  const [entity, setEntity] = useState("");
  const [user, setUser] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState<"createdAt:desc" | "createdAt:asc">("createdAt:desc");
  const [data, setData] = useState<AuditLogPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    setError("");
    const q = new URLSearchParams();
    q.set("page", String(page));
    q.set("pageSize", "25");
    q.set("sort", sort);
    if (action) q.set("action", action);
    if (module.trim()) q.set("module", module.trim());
    if (entity.trim()) q.set("entity", entity.trim());
    if (user.trim()) q.set("user", user.trim());
    if (from) q.set("from", new Date(from).toISOString());
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      q.set("to", end.toISOString());
    }
    api
      .get<AuditLogPage>(`/audit-logs?${q.toString()}`)
      .then(setData)
      .catch((e) => {
        setData(null);
        setError(failMessage(e, "Could not load audit logs"));
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, action, sort]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="p-7">
      <SectionHead
        title="Audit Logs"
        subtitle={data ? `${data.total} events · page ${data.page} of ${totalPages}` : "Platform activity trail"}
        action={
          <button
            onClick={load}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
            style={{ border: `1px solid ${GOLD}30`, color: GOLD }}
          >
            <RefreshCw size={11} /> Refresh
          </button>
        }
      />

      <div
        className="flex flex-wrap items-end gap-2.5 mb-5 p-3 rounded-xl"
        style={{ backgroundColor: "#FBFCFD", border: "1px solid rgba(11,30,63,0.11)" }}
      >
        <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(11,30,63,0.50)" }}>
          From
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 block px-2 py-1.5 text-xs rounded-lg"
            style={{ border: "1px solid rgba(11,30,63,0.15)", color: NAVY }}
          />
        </label>
        <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(11,30,63,0.50)" }}>
          To
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 block px-2 py-1.5 text-xs rounded-lg"
            style={{ border: "1px solid rgba(11,30,63,0.15)", color: NAVY }}
          />
        </label>
        <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(11,30,63,0.50)" }}>
          Action
          <select
            value={action}
            onChange={(e) => { setPage(1); setAction(e.target.value); }}
            className="mt-1 block px-2 py-1.5 text-xs rounded-lg min-w-[8rem]"
            style={{ border: "1px solid rgba(11,30,63,0.15)", color: NAVY }}
          >
            <option value="">All</option>
            {AUDIT_ACTIONS.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </label>
        <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(11,30,63,0.50)" }}>
          Module
          <input
            value={module}
            onChange={(e) => setModule(e.target.value)}
            placeholder="Finance, OCR…"
            className="mt-1 block px-2 py-1.5 text-xs rounded-lg"
            style={{ border: "1px solid rgba(11,30,63,0.15)", color: NAVY }}
          />
        </label>
        <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(11,30,63,0.50)" }}>
          Entity
          <input
            value={entity}
            onChange={(e) => setEntity(e.target.value)}
            placeholder="Invoice, User…"
            className="mt-1 block px-2 py-1.5 text-xs rounded-lg"
            style={{ border: "1px solid rgba(11,30,63,0.15)", color: NAVY }}
          />
        </label>
        <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(11,30,63,0.50)" }}>
          User id
          <input
            value={user}
            onChange={(e) => setUser(e.target.value)}
            placeholder="actor user id"
            className="mt-1 block px-2 py-1.5 text-xs rounded-lg font-mono"
            style={{ border: "1px solid rgba(11,30,63,0.15)", color: NAVY }}
          />
        </label>
        <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(11,30,63,0.50)" }}>
          Sort
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as "createdAt:desc" | "createdAt:asc")}
            className="mt-1 block px-2 py-1.5 text-xs rounded-lg"
            style={{ border: "1px solid rgba(11,30,63,0.15)", color: NAVY }}
          >
            <option value="createdAt:desc">Newest first</option>
            <option value="createdAt:asc">Oldest first</option>
          </select>
        </label>
        <button
          onClick={() => { setPage(1); load(); }}
          className="px-3 py-2 rounded-xl text-xs font-semibold"
          style={{ backgroundColor: GOLD, color: NAVY }}
        >
          Apply filters
        </button>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(11,30,63,0.11)" }}>
        {loading ? (
          <div className="px-4 py-3"><LoadingSkeleton rows={6} tone="light" /></div>
        ) : error ? (
          <div className="p-4"><ErrorState message={error} onRetry={load} tone="light" /></div>
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            tone="light"
            icon={<ClipboardCheck size={32} className="opacity-25" style={{ color: "rgba(11,30,63,0.66)" }} />}
            title="No audit events match"
            hint="Try widening the date range or clearing filters."
          />
        ) : (
          <table className="w-full">
            <THead cols={["When", "Actor", "Action", "Module", "Entity", "IP"]} />
            <tbody>
              {data.items.map((row, i) => (
                <tr
                  key={row.id}
                  style={{ borderBottom: i < data.items.length - 1 ? "1px solid rgba(11,30,63,0.08)" : undefined }}
                >
                  <td className="px-4 py-3 text-[10px] whitespace-nowrap" style={{ color: "rgba(11,30,63,0.66)", fontFamily: "var(--font-mono)" }}>
                    {new Date(row.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs font-semibold" style={{ color: NAVY }}>
                      {row.actorName ?? row.actorLabel ?? "—"}
                    </div>
                    <div className="text-[10px]" style={{ color: "rgba(11,30,63,0.50)" }}>
                      {row.actorEmail ?? row.actorUserId ?? "system"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: `${ADMIN}18`, color: "#7C3AED" }}
                    >
                      {row.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: "rgba(11,30,63,0.76)" }}>{row.module}</td>
                  <td className="px-4 py-3">
                    <div className="text-xs" style={{ color: NAVY }}>{row.entityType}</div>
                    <div className="text-[10px] font-mono" style={{ color: "rgba(11,30,63,0.50)" }}>
                      {row.entityId ?? "—"}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[10px] font-mono" style={{ color: "rgba(11,30,63,0.58)" }}>
                    {row.ip ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {data && data.total > data.pageSize && (
        <div className="flex items-center justify-between mt-4">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-3 py-1.5 rounded-lg text-xs disabled:opacity-40"
            style={{ border: "1px solid rgba(11,30,63,0.15)", color: NAVY }}
          >
            Previous
          </button>
          <span className="text-xs" style={{ color: "rgba(11,30,63,0.58)" }}>
            Page {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 rounded-lg text-xs disabled:opacity-40"
            style={{ border: "1px solid rgba(11,30,63,0.15)", color: NAVY }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export default function SuperAdmin() {
  const [params, setParams] = useSearchParams();
  const navItems = useMemo(() => filterNavByPerms(SA_NAV, SA_NAV_PERMS), []);

  const canOpenScreen = (id: string) => {
    const need = SA_NAV_PERMS[id];
    if (!need) return false;
    return hasAnyPermission(need);
  };

  const tabFromUrl = params.get("tab");
  const [screen, setScreen] = useState(() => {
    if (tabFromUrl && canOpenScreen(tabFromUrl)) return tabFromUrl;
    return navItems[0]?.id ?? "dashboard";
  });

  useEffect(() => {
    const t = params.get("tab");
    if (t && canOpenScreen(t) && t !== screen) setScreen(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  useEffect(() => {
    if (SA_ADVANCED_IDS.has(screen)) {
      if (!canOpenScreen(screen)) setScreen(navItems[0]?.id ?? "dashboard");
      return;
    }
    if (navItems.length && !navItems.some((n) => n.id === screen)) {
      setScreen(navItems[0].id);
    }
  }, [navItems, screen]);

  const onItemClick = (id: string) => {
    setScreen(id);
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", id);
        return next;
      },
      { replace: true },
    );
  };

  const screenMap: Record<string, () => ReactNode> = {
    dashboard:     () => <DashboardScreen />,
    companies:     () => <CompanyScreen />,
    users:         () => <UserRoleScreen />,
    workflows:     () => <WorkflowScreen />,
    automation:    () => <AutomationScreen />,
    "ai-engine":   () => <AIEngineScreen />,
    ocr:           () => <OCRCenterScreen />,
    notifications: () => <NotifCenterScreen />,
    audit:         () => <AuditLogsScreen />,
    settings:      () => <SystemSettingsScreen />,
  };

  return (
    <ERPShell
      moduleId="super-admin"
      moduleName="Super Admin"
      moduleColor={ADMIN}
      moduleIcon={Shield as IconFC}
      navItems={navItems}
      activeItem={screen}
      onItemClick={onItemClick}
      breadcrumb={[SCREEN_LABELS[screen] ?? screen]}
      notificationCount={0}
      userName={getStoredUser()?.name ?? "Super Admin"}
      userRole={getStoredUser()?.roleName ?? "Administrator"}
    >
      {screenMap[screen]?.() ?? null}
    </ERPShell>
  );
}
