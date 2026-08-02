import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import {
  LayoutDashboard, Calendar, Upload, FileText, List, Wallet,
  Building, Bus, UtensilsCrossed, Check, X, Clock,
  CheckCircle, AlertCircle, Info, Star, TrendingUp,
} from "lucide-react";
import { ERPShell, type NavItem, type IconFC } from "../components/ERPShell";
import { EmptyState, LoadingSkeleton, ErrorState } from "../components/States";
import {
  ErpField, ErpInput, ErpSelect, ErpStatusChip, erpToast, type ErpStatusKind,
} from "../components/erp";
import { api, ApiError, getStoredUser, isLoggedIn } from "../lib/api";

// ─── Constants & types ────────────────────────────────────────────────────────

type SupplierType = "hotel" | "transport" | "catering";
type BookingStatus = "pending_acceptance" | "confirmed" | "rejected" | "completed";

const C: Record<SupplierType, string> = {
  hotel:     "#2563EB",
  transport: "#EA580C",
  catering:  "#9333EA",
};

const GOLD = "#C9A24B";

// ─── Mock data ────────────────────────────────────────────────────────────────

interface BookingRec {
  id: string; group: string; agent: string;
  pax: number; detail: string; dates: string;
  nights?: number; amount: number; status: BookingStatus;
  // present on live API rows only — needed to address the backend record
  service?: SupplierType; apiId?: string;
}

interface LedgerEntry {
  date: string; type: "credit" | "debit"; desc: string;
  ref: string; amount: number; balance: number;
}

interface PaymentRec {
  id: string; date: string; amount: number;
  bank: string; ref: string; status: "paid" | "pending" | "processing";
}

// (prototype supplier demo bookings removed — portal is auth-guarded and live)

type ApiBookingStatus =
  | "REQUESTED" | "ASSIGNED" | "CONFIRMED" | "VOUCHER_ISSUED"
  | "COMPLETED" | "REJECTED" | "CANCELLED";

interface ApiSupplierBooking {
  service: SupplierType;
  id: string;
  code: string;
  status: ApiBookingStatus;
  statusReason: string | null;
  group: string;
  groupName: string;
  agent: string;
  pax: number;
  detail: string;
  dateFrom: string | null;
  dateTo: string | null;
  nights: number | null;
  amount: number | null;
  createdAt: string;
}

interface ApiSupplierUpload {
  id: string;
  fileName: string;
  kind: string;
  sizeBytes: number;
  createdAt: string;
  meta: { bookingCode?: string; invoiceNo?: string; total?: number; voucherType?: string } | null;
}

const API_STATUS_TO_UI: Partial<Record<ApiBookingStatus, BookingStatus>> = {
  ASSIGNED:       "pending_acceptance",
  CONFIRMED:      "confirmed",
  VOUCHER_ISSUED: "confirmed",
  COMPLETED:      "completed",
  REJECTED:       "rejected",
};

function toBookingRec(r: ApiSupplierBooking): BookingRec | null {
  const status = API_STATUS_TO_UI[r.status];
  if (!status) return null; // REQUESTED / CANCELLED — not shown to the supplier
  const dates = r.dateFrom
    ? (r.dateTo && r.dateTo !== r.dateFrom ? `${r.dateFrom} – ${r.dateTo}` : r.dateFrom)
    : "—";
  return {
    id: r.code, apiId: r.id, service: r.service,
    group: r.group, agent: r.agent, pax: r.pax, detail: r.detail,
    dates, nights: r.nights ?? undefined, amount: r.amount ?? 0, status,
  };
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtMB(bytes: number): string {
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

/** <option> value for a booking row — carries service+id for live rows. */
function bookingKey(b: BookingRec): string {
  return b.service && b.apiId ? `${b.service}|${b.apiId}` : b.id;
}

// Supplier ledgers — from platform to supplier perspective
function buildLedger(entries: { date: string; type: "credit" | "debit"; desc: string; ref: string; amount: number }[]): LedgerEntry[] {
  let bal = 0;
  return entries.map((e) => {
    bal += e.type === "credit" ? e.amount : -e.amount;
    return { ...e, balance: bal };
  });
}

// (prototype supplier ledger/payment demo data removed)

const SUPPLIER_META: Record<SupplierType, { name: string; code: string; icon: IconFC }> = {
  hotel:     { name: "Jabal Omar Hyatt Regency",    code: "SUP-HTL-4291", icon: Building as IconFC },
  transport: { name: "Al-Naqil Transport Co.",       code: "SUP-TRN-1847", icon: Bus as IconFC },
  catering:  { name: "Al-Barakah Catering Services", code: "SUP-CAT-0392", icon: UtensilsCrossed as IconFC },
};

// ─── Navigation ───────────────────────────────────────────────────────────────

const SUPPLIER_NAV: NavItem[] = [
  { id: "dashboard",  label: "Dashboard",          icon: LayoutDashboard as IconFC, badge: 5 },
  { id: "bookings",   label: "Booking Acceptance", icon: Calendar as IconFC,        badge: 3 },
  { id: "vouchers",   label: "Voucher Upload",     icon: Upload as IconFC },
  { id: "invoices",   label: "Invoice Upload",     icon: FileText as IconFC },
  { id: "statement",  label: "Statement",          icon: List as IconFC },
  { id: "payments",   label: "Payments",           icon: Wallet as IconFC },
];

const SCREEN_LABELS: Record<string, string> = {
  dashboard: "Dashboard", bookings: "Booking Acceptance",
  vouchers:  "Voucher Upload", invoices: "Invoice Upload",
  statement: "Statement", payments: "Payments",
};

// ─── Shared helpers ───────────────────────────────────────────────────────────

function supplierStatusKind(status: string): ErpStatusKind {
  if (status === "confirmed" || status === "paid" || status === "completed") return "approved";
  if (status === "rejected") return "rejected";
  if (status === "processing") return "info";
  return "pending";
}

function SBadge({ status }: { status: string }) {
  return <ErpStatusChip status={supplierStatusKind(status)} label={status.replace(/_/g, " ")} />;
}

// ─── Live-feed state ──────────────────────────────────────────────────────────
// Logged OUT → demo mode: screens keep rendering their mock rows (unchanged).
// Logged IN  → loading / error / empty / data. A failed /supplier fetch must
// NEVER fall through to the mocks — a supplier would act on fabricated bookings.
type FeedState = "loading" | "error" | "ready";

/** Full-width loading / error / empty cell that keeps a table's column layout. */
function TableState({ cols, demo, state, onRetry, title, hint }: {
  cols: number; demo: boolean; state: FeedState; onRetry: () => void; title: string; hint?: string;
}) {
  return (
    <tr>
      <td colSpan={cols} className="px-4 py-2">
        {!demo && state === "loading" ? <LoadingSkeleton tone="light" rows={4} />
          : !demo && state === "error" ? <ErrorState tone="light" onRetry={onRetry} />
          : <EmptyState tone="light" title={title} hint={hint} />}
      </td>
    </tr>
  );
}

function THead({ cols }: { cols: string[] }) {
  return (
    <thead>
      <tr style={{ backgroundColor: "#FBFCFD", borderBottom: "1px solid rgba(11,30,63,0.11)" }}>
        {cols.map((c) => (
          <th key={c} className="px-4 py-2.5 text-left text-[9px] font-bold uppercase tracking-widest whitespace-nowrap" style={{ color: "rgba(11,30,63,0.50)" }}>{c}</th>
        ))}
      </tr>
    </thead>
  );
}

function Amt({ value, type }: { value: number; type?: "credit" | "debit" }) {
  const color = type === "credit" ? "#16A34A" : type === "debit" ? "#DC2626" : "rgba(11,30,63,0.86)";
  const prefix = type === "credit" ? "+" : type === "debit" ? "−" : "";
  return <span className="font-mono font-semibold text-xs whitespace-nowrap tabular-nums" style={{ color, fontFamily: "var(--font-mono)" }}>{prefix}SAR {value.toLocaleString()}</span>;
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl overflow-hidden ${className}`} style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(11,30,63,0.11)" }}>{children}</div>;
}

function CardHead({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid rgba(11,30,63,0.11)", backgroundColor: "#FFFFFF" }}>
      <span className="text-xs font-bold text-[#0B1E3F]">{title}</span>
      {action}
    </div>
  );
}

function FF({ label, children }: { label: string; children: ReactNode }) {
  return <ErpField label={label}>{children}</ErpField>;
}

const IS = { backgroundColor: "#F5F7FA", border: "1px solid rgba(11,30,63,0.15)", color: "#0B1E3F" } as const;
function FInput({ placeholder, type = "text", defaultValue, value, onChange }: { placeholder?: string; type?: string; defaultValue?: string; value?: string; onChange?: (e: ChangeEvent<HTMLInputElement>) => void }) {
  return <ErpInput type={type} placeholder={placeholder} defaultValue={defaultValue} value={value} onChange={onChange} />;
}
function FSelect({ children, defaultValue, value, onChange }: { children: ReactNode; defaultValue?: string; value?: string; onChange?: (e: ChangeEvent<HTMLSelectElement>) => void }) {
  return <ErpSelect defaultValue={defaultValue} value={value} onChange={onChange}>{children}</ErpSelect>;
}

// Supplier type tab bar
function TypeSwitcher({ type, onChange }: { type: SupplierType; onChange: (t: SupplierType) => void }) {
  const TYPES: { id: SupplierType; label: string; icon: typeof Building }[] = [
    { id: "hotel",     label: "Hotel",     icon: Building      },
    { id: "transport", label: "Transport", icon: Bus           },
    { id: "catering",  label: "Catering",  icon: UtensilsCrossed },
  ];
  return (
    <div className="flex items-center gap-0.5 px-7 py-3 shrink-0" style={{ backgroundColor: "#FFFFFF", borderBottom: "1px solid rgba(11,30,63,0.11)" }}>
      <span className="text-[9px] font-bold uppercase tracking-widest mr-3" style={{ color: "rgba(11,30,63,0.50)" }}>Viewing as:</span>
      {TYPES.map((t) => {
        const Icon = t.icon;
        const active = t.id === type;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className="flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-semibold transition-all"
            style={{ backgroundColor: active ? `${C[t.id]}18` : "transparent", border: `1px solid ${active ? C[t.id] + "40" : "transparent"}`, color: active ? C[t.id] : "rgba(11,30,63,0.58)" }}
          >
            <Icon size={12} style={{ color: active ? C[t.id] : "rgba(11,30,63,0.50)" }} />
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Dashboard Screen ─────────────────────────────────────────────────────────

function DashboardScreen({ type, bookings, name, code, since, demo, state, onRetry }: { type: SupplierType; bookings: BookingRec[]; name: string; code: string; since: string; demo: boolean; state: FeedState; onRetry: () => void }) {
  const meta   = SUPPLIER_META[type];
  const color  = C[type];
  const ready      = demo || state === "ready";
  const pending    = bookings.filter((b) => b.status === "pending_acceptance").length;
  const confirmed  = bookings.filter((b) => b.status === "confirmed").length;
  const revenue    = bookings.filter((b) => b.status === "confirmed" || b.status === "completed").reduce((s, b) => s + b.amount, 0);

  const Icon = meta.icon;

  return (
    <div className="p-7 space-y-5">
      {/* Supplier identity */}
      <div className="flex items-center gap-4 rounded-2xl px-5 py-4" style={{ backgroundColor: `${color}10`, border: `1px solid ${color}25` }}>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}20` }}>
          <Icon size={22} style={{ color }} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2.5 mb-0.5">
            <h1 className="text-sm font-bold text-[#0B1E3F]">{name}</h1>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#4ADE8015", color: "#16A34A" }}>Active Supplier</span>
          </div>
          <div className="text-[10px]" style={{ color: "rgba(11,30,63,0.58)" }}>
            Code: <span style={{ color, fontFamily: "var(--font-mono)" }}>{code}</span>
            {" · "}Umrah Season 1446H
            {" · "}Contracted since: <span style={{ color: "rgba(11,30,63,0.76)" }}>{since}</span>
          </div>
        </div>
        {type === "hotel" && (
          <div className="flex items-center gap-0.5 shrink-0">
            {[1,2,3,4,5].map((s) => <Star key={s} size={12} style={{ color: GOLD }} className="fill-current" />)}
          </div>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Pending Acceptance", value: ready ? String(pending) : "—",              color,              icon: Clock,       note: "Require your action" },
          { label: "Confirmed Bookings", value: ready ? String(confirmed) : "—",             color: "#16A34A",   icon: CheckCircle, note: "Upcoming season" },
          { label: "Season Revenue",     value: ready ? `SAR ${revenue.toLocaleString()}` : "—", color: "#16A34A", icon: TrendingUp,  note: "Confirmed bookings" },
          { label: "Total Bookings",     value: ready ? String(bookings.length) : "—", color: GOLD, icon: Wallet, note: "This season" },
        ].map((k) => {
          const KIcon = k.icon;
          return (
            <div key={k.label} className="rounded-2xl p-5" style={{ backgroundColor: "#FBFCFD", border: "1px solid rgba(11,30,63,0.11)" }}>
              <div className="flex items-start justify-between mb-4">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${k.color}18` }}>
                  <KIcon size={16} style={{ color: k.color }} />
                </div>
              </div>
              <div className="text-xl font-bold text-[#0B1E3F] mb-1 truncate tabular-nums" title={k.value} style={{ fontFamily: "var(--font-mono)" }}>{k.value}</div>
              <div className="text-xs font-medium truncate" style={{ color: "rgba(11,30,63,0.58)" }}>{k.label}</div>
              <div className="text-[10px] mt-0.5 truncate" style={{ color: "rgba(11,30,63,0.50)" }}>{k.note}</div>
            </div>
          );
        })}
      </div>

      {/* Pending bookings action required */}
      {ready && pending > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${color}25` }}>
          <div className="flex items-center gap-2.5 px-5 py-3" style={{ backgroundColor: `${color}0D`, borderBottom: `1px solid ${color}20` }}>
            <AlertCircle size={13} style={{ color }} />
            <span className="text-xs font-bold text-[#0B1E3F]">Action Required — {pending} booking{pending > 1 ? "s" : ""} awaiting your acceptance</span>
          </div>
          <table className="w-full">
            <THead cols={["Booking ID", "Group", "Agent", "Pax", "Details", "Amount", "Status"]} />
            <tbody>
              {bookings.filter((b) => b.status === "pending_acceptance").map((b, i, arr) => (
                <tr key={b.id} style={{ borderBottom: i < arr.length - 1 ? "1px solid rgba(11,30,63,0.08)" : undefined }} className="hover:bg-white/2">
                  <td className="px-4 py-3 text-[9px] font-mono whitespace-nowrap" style={{ color, fontFamily: "var(--font-mono)" }}>{b.id}</td>
                  <td className="px-4 py-3 text-[10px] whitespace-nowrap" style={{ color: "rgba(11,30,63,0.76)", fontFamily: "var(--font-mono)" }}>{b.group}</td>
                  <td className="px-4 py-3 text-xs text-[#0B1E3F]"><div className="truncate max-w-[14rem]" title={b.agent}>{b.agent}</div></td>
                  <td className="px-4 py-3 text-center text-xs font-bold tabular-nums" style={{ color: "rgba(11,30,63,0.86)", fontFamily: "var(--font-mono)" }}>{b.pax}</td>
                  <td className="px-4 py-3 text-[10px]" style={{ color: "rgba(11,30,63,0.66)" }}><div className="truncate max-w-[18rem]" title={b.detail}>{b.detail}</div></td>
                  <td className="px-4 py-3"><Amt value={b.amount} type="credit" /></td>
                  <td className="px-4 py-3"><SBadge status={b.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* All bookings */}
      <Card>
        <CardHead title="All Bookings — Season 1446H" action={
          <span className="text-[10px]" style={{ color: "rgba(11,30,63,0.58)" }}>{ready ? `${bookings.length} total` : "—"}</span>
        } />
        <table className="w-full">
          <THead cols={["ID", "Group", "Agent", "Pax", "Dates", "Amount", "Status"]} />
          <tbody>
            {ready && bookings.map((b, i) => (
              <tr key={b.id} style={{ borderBottom: i < bookings.length - 1 ? "1px solid rgba(11,30,63,0.08)" : undefined }} className="hover:bg-white/2">
                <td className="px-4 py-2.5 text-[9px] font-mono whitespace-nowrap" style={{ color, fontFamily: "var(--font-mono)" }}>{b.id}</td>
                <td className="px-4 py-2.5 text-[9px] whitespace-nowrap" style={{ color: "rgba(11,30,63,0.66)", fontFamily: "var(--font-mono)" }}>{b.group}</td>
                <td className="px-4 py-2.5 text-xs text-[#0B1E3F]"><div className="truncate max-w-[14rem]" title={b.agent}>{b.agent}</div></td>
                <td className="px-4 py-2.5 text-center text-xs font-bold tabular-nums" style={{ color: "rgba(11,30,63,0.76)", fontFamily: "var(--font-mono)" }}>{b.pax}</td>
                <td className="px-4 py-2.5 text-[10px] whitespace-nowrap" style={{ color: "rgba(11,30,63,0.58)" }}>{b.dates}</td>
                <td className="px-4 py-2.5"><Amt value={b.amount} type="credit" /></td>
                <td className="px-4 py-2.5"><SBadge status={b.status} /></td>
              </tr>
            ))}
            {(!ready || bookings.length === 0) && (
              <TableState cols={7} demo={demo} state={state} onRetry={onRetry}
                title="No bookings yet" hint="Bookings assigned to you by TUBA operations appear here." />
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ─── Booking Acceptance Screen ────────────────────────────────────────────────

function BookingsScreen({ type, bookings, live, onRefresh, demo, state }: { type: SupplierType; bookings: BookingRec[]; live: boolean; onRefresh: () => void; demo: boolean; state: FeedState }) {
  const color   = C[type];
  const ready   = demo || state === "ready";
  const [sel, setSel]       = useState<string | null>(bookings.find((b) => b.status === "pending_acceptance")?.id ?? null);
  const [action, setAction] = useState<"idle" | "accepting" | "rejecting">("idle");
  const [reason, setReason] = useState("");
  const [busy, setBusy]     = useState(false);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [rejected, setRejected] = useState<Set<string>>(new Set());

  const selected = bookings.find((b) => b.id === sel);

  // when live rows replace the mocks (or a refresh drops the row), re-default the selection
  useEffect(() => {
    if (sel && bookings.some((b) => b.id === sel)) return;
    setSel(bookings.find((b) => b.status === "pending_acceptance")?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings]);

  const confirm = async (act: "accept" | "reject") => {
    if (!sel || busy) return;
    const b = bookings.find((x) => x.id === sel);
    if (live && b?.service && b.apiId) {
      setBusy(true);
      try {
        if (act === "accept") {
          const res = await api.post<{ status: string; voucher: { id: string; code: string; fileId: string } }>(
            `/supplier/bookings/${b.service}/${b.apiId}/accept`, {},
          );
          setAccepted((s) => new Set(s).add(sel));
          erpToast.success([("Booking accepted"), (`${sel} confirmed — voucher ${res.voucher.code} ready.`)].filter(Boolean).join(" — "));
        } else {
          await api.post(`/supplier/bookings/${b.service}/${b.apiId}/reject`, { reason: reason.trim() });
          setRejected((s) => new Set(s).add(sel));
          erpToast.error([("Booking rejected"), (reason.trim() || "Booking declined.")].filter(Boolean).join(" — "));
        }
        onRefresh();
      } catch (e) {
        erpToast.error(
          (act === "accept" ? "Could not accept booking" : "Could not reject booking")
            + " — "
            + (e instanceof ApiError ? e.message : "Request failed"),
        );
        setAction("idle");
        setReason("");
        return;
      } finally {
        setBusy(false);
      }
    } else if (act === "accept") {
      setAccepted((s) => new Set(s).add(sel));
      erpToast.success([("Booking accepted"), (`${sel} confirmed — voucher will be issued by TUBA within 24h.`)].filter(Boolean).join(" — "));
    } else {
      setRejected((s) => new Set(s).add(sel));
      erpToast.error([("Booking rejected"), (reason.trim() || "Booking declined.")].filter(Boolean).join(" — "));
    }
    setAction("idle");
    setReason("");
  };

  const statusOf = (b: BookingRec) => accepted.has(b.id) ? "confirmed" : rejected.has(b.id) ? "rejected" : b.status;

  const STEPS = [
    { label: "Booking Request Received",  done: true },
    { label: "Reviewed by Supplier",       done: selected ? (accepted.has(selected.id) || rejected.has(selected.id)) : false },
    { label: "Accepted & Confirmed",       done: selected ? accepted.has(selected.id) : false },
    { label: "Service Delivered",          done: selected?.status === "completed" },
  ];

  return (
    <div className="p-7 grid grid-cols-5 gap-5 h-full">
      {/* LEFT: Booking list */}
      <div className="col-span-2 space-y-2 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        <div className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: "rgba(11,30,63,0.50)" }}>Pending Acceptance</div>
        {!ready && (
          state === "loading"
            ? <LoadingSkeleton tone="light" rows={4} />
            : <ErrorState tone="light" onRetry={onRefresh} />
        )}
        {ready && bookings.length === 0 && (
          <EmptyState tone="light" title="No bookings yet" hint="Bookings assigned to you by TUBA operations appear here." />
        )}
        {ready && bookings.filter((b) => b.status === "pending_acceptance" && !accepted.has(b.id) && !rejected.has(b.id)).map((b) => (
          <button
            key={b.id}
            onClick={() => { setSel(b.id); setAction("idle"); }}
            className="w-full text-left p-4 rounded-2xl transition-all"
            style={{ border: `1px solid ${sel === b.id ? color : "rgba(11,30,63,0.38)"}`, backgroundColor: sel === b.id ? `${color}0A` : "rgba(11,30,63,0.38)" }}
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-[9px] font-mono truncate" style={{ color, fontFamily: "var(--font-mono)" }}>{b.id}</span>
              <SBadge status="pending_acceptance" />
            </div>
            <div className="text-xs font-semibold text-[#0B1E3F] mb-0.5 truncate" title={b.agent}>{b.agent}</div>
            <div className="text-[10px] truncate" title={`${b.group} · ${b.pax} pax`} style={{ color: "rgba(11,30,63,0.58)" }}>{b.group} · {b.pax} pax</div>
            <div className="flex items-center justify-between gap-2 mt-2">
              <span className="text-[10px] truncate" style={{ color: "rgba(11,30,63,0.58)" }}>{b.dates}</span>
              <span className="shrink-0"><Amt value={b.amount} type="credit" /></span>
            </div>
          </button>
        ))}

        {/* Resolved bookings */}
        {ready && bookings.filter((b) => b.status !== "pending_acceptance" || accepted.has(b.id) || rejected.has(b.id)).length > 0 && (
          <>
            <div className="text-[9px] font-bold uppercase tracking-widest mt-4 mb-2" style={{ color: "rgba(11,30,63,0.50)" }}>All Bookings</div>
            {bookings.filter((b) => b.status !== "pending_acceptance" || accepted.has(b.id) || rejected.has(b.id)).map((b) => (
              <button
                key={b.id}
                onClick={() => { setSel(b.id); setAction("idle"); }}
                className="w-full text-left p-3.5 rounded-2xl transition-all opacity-70"
                style={{ border: `1px solid ${sel === b.id ? color : "rgba(11,30,63,0.38)"}`, backgroundColor: sel === b.id ? `${color}08` : "rgba(11,30,63,0.38)" }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[9px] font-mono truncate" style={{ color: "rgba(11,30,63,0.58)", fontFamily: "var(--font-mono)" }}>{b.id}</span>
                  <SBadge status={statusOf(b)} />
                </div>
                <div className="text-[10px] mt-1 text-[#0B1E3F] truncate" title={`${b.agent} · ${b.pax} pax`}>{b.agent} · {b.pax} pax</div>
              </button>
            ))}
          </>
        )}
      </div>

      {/* RIGHT: Detail + actions */}
      {selected ? (
        <div className="col-span-3 space-y-4">
          {/* Booking detail card */}
          <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${color}30` }}>
            <div className="flex items-center justify-between px-5 py-3.5" style={{ backgroundColor: `${color}0D`, borderBottom: `1px solid ${color}20` }}>
              <div>
                <div className="text-[9px] font-bold uppercase tracking-widest mb-0.5" style={{ color }}>Booking Detail</div>
                <div className="text-sm font-bold text-[#0B1E3F]" style={{ fontFamily: "var(--font-mono)" }}>{selected.id}</div>
              </div>
              <SBadge status={statusOf(selected)} />
            </div>
            <div className="grid grid-cols-2 gap-0">
              {[
                ["Agent",          selected.agent],
                ["Group",          selected.group],
                ["Passengers",     `${selected.pax} pax`],
                ["Service Detail", selected.detail],
                ["Travel Dates",   selected.dates],
                ["Settlement",     `SAR ${selected.amount.toLocaleString()}`],
              ].map(([l, v], i) => (
                <div key={l} className="px-5 py-3 min-w-0" style={{ borderBottom: i < 4 ? "1px solid rgba(11,30,63,0.08)" : undefined, borderRight: i % 2 === 0 ? "1px solid rgba(11,30,63,0.08)" : undefined }}>
                  <div className="text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color: "rgba(11,30,63,0.50)" }}>{l}</div>
                  <div className="text-xs font-semibold text-[#0B1E3F] truncate" title={v}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Action panel */}
          {!accepted.has(selected.id) && !rejected.has(selected.id) && selected.status === "pending_acceptance" && (
            <div className="rounded-2xl p-5" style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(11,30,63,0.11)" }}>
              <div className="text-xs font-bold text-[#0B1E3F] mb-3">Your Response</div>
              {action === "idle" && (
                <div className="flex gap-3">
                  <button onClick={() => setAction("accepting")} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all" style={{ backgroundColor: "#16A34A", color: "#0B1E3F" }}>
                    <Check size={14} /> Accept Booking
                  </button>
                  <button onClick={() => setAction("rejecting")} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all" style={{ backgroundColor: "rgba(239,68,68,0.12)", color: "#DC2626", border: "1px solid rgba(239,68,68,0.3)" }}>
                    <X size={14} /> Reject Booking
                  </button>
                </div>
              )}
              {action === "accepting" && (
                <div>
                  <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl mb-4" style={{ backgroundColor: "#16A34A10", border: "1px solid #16A34A25" }}>
                    <Info size={12} style={{ color: "#16A34A" }} className="mt-0.5 shrink-0" />
                    <p className="text-[11px]" style={{ color: "rgba(11,30,63,0.76)" }}>
                      By accepting, you confirm availability and agree to deliver the service as described. A booking confirmation will be sent to the agent.
                    </p>
                  </div>
                  <div className="flex gap-2.5">
                    <button onClick={() => setAction("idle")} disabled={busy} className="px-4 py-2.5 rounded-xl text-xs disabled:opacity-60" style={{ border: "1px solid rgba(11,30,63,0.15)", color: "rgba(11,30,63,0.58)" }}>Cancel</button>
                    <button onClick={() => void confirm("accept")} disabled={busy} className="flex-1 py-2.5 rounded-xl text-xs font-bold disabled:opacity-60" style={{ backgroundColor: "#16A34A", color: "#0B1E3F" }}>
                      ✓ Confirm Acceptance
                    </button>
                  </div>
                </div>
              )}
              {action === "rejecting" && (
                <div className="space-y-3">
                  <FF label="Rejection Reason (required)">
                    <textarea
                      rows={3} value={reason} onChange={(e) => setReason(e.target.value)}
                      placeholder="e.g. No availability for the requested dates. Please contact us for alternative dates."
                      className="w-full px-3 py-2.5 text-xs rounded-xl focus:outline-none resize-none"
                      style={IS}
                    />
                  </FF>
                  <div className="flex gap-2.5">
                    <button onClick={() => setAction("idle")} disabled={busy} className="px-4 py-2.5 rounded-xl text-xs disabled:opacity-60" style={{ border: "1px solid rgba(11,30,63,0.15)", color: "rgba(11,30,63,0.58)" }}>Cancel</button>
                    <button onClick={() => void confirm("reject")} disabled={!reason.trim() || busy} className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-60" style={{ backgroundColor: reason.trim() ? "#DC2626" : "#EEF1F6", color: reason.trim() ? "white" : "rgba(11,30,63,0.50)", cursor: reason.trim() ? "pointer" : "not-allowed" }}>
                      Submit Rejection
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {(accepted.has(selected.id) || rejected.has(selected.id)) && (
            <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl" style={{ backgroundColor: accepted.has(selected.id) ? "#16A34A10" : "#DC262610", border: `1px solid ${accepted.has(selected.id) ? "#16A34A30" : "#DC262630"}` }}>
              {accepted.has(selected.id) ? <CheckCircle size={16} style={{ color: "#16A34A" }} /> : <X size={16} style={{ color: "#DC2626" }} />}
              <span className="text-xs font-semibold" style={{ color: accepted.has(selected.id) ? "#16A34A" : "#DC2626" }}>
                {accepted.has(selected.id) ? "Booking accepted — confirmation sent to agent" : "Booking rejected — reason submitted"}
              </span>
            </div>
          )}

          {/* Status tracker */}
          <div className="rounded-2xl p-5" style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(11,30,63,0.11)" }}>
            <div className="text-xs font-bold text-[#0B1E3F] mb-4">Booking Lifecycle</div>
            <div className="relative pl-5">
              <div className="absolute left-[9px] top-2 bottom-2 w-px" style={{ backgroundColor: "#F5F7FA" }} />
              <div className="space-y-4">
                {STEPS.map((step, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <div className="z-10 w-[18px] h-[18px] rounded-full shrink-0 flex items-center justify-center" style={step.done ? { backgroundColor: `${color}22`, border: `1px solid ${color}60` } : { backgroundColor: "#F5F7FA", border: "1px solid rgba(11,30,63,0.15)" }}>
                      {step.done ? <Check size={9} style={{ color }} /> : <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#E4E9F0" }} />}
                    </div>
                    <span className="text-xs font-semibold" style={{ color: step.done ? color : "rgba(11,30,63,0.50)" }}>{step.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="col-span-3 flex items-center justify-center text-center">
          <div>
            <Calendar size={32} style={{ color: "rgba(11,30,63,0.38)", marginBottom: 12 }} />
            <div className="text-xs font-semibold" style={{ color: "rgba(11,30,63,0.50)" }}>Select a booking to review</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Voucher Upload Screen ────────────────────────────────────────────────────

function VouchersScreen({ type, bookings, live, demo, state }: { type: SupplierType; bookings: BookingRec[]; live: boolean; demo: boolean; state: FeedState }) {
  const color = C[type];
  const noBookingLabel = demo || state === "ready" ? "No confirmed bookings" : state === "error" ? "Could not load bookings" : "Loading…";
  const voucherTypes = type === "hotel" ? ["Hotel Voucher", "Hotel Confirmation Letter"] : type === "transport" ? ["Bus Permit", "Driver Licence Copy", "Vehicle Registration"] : ["Catering Licence", "Meal Schedule", "Health Certificate"];

  const eligible = bookings.filter((b) => b.status === "confirmed" || b.status === "completed");

  const [bookingSel, setBookingSel]   = useState("");
  const [voucherType, setVoucherType] = useState(voucherTypes[0] ?? "");
  const [issueDate, setIssueDate]     = useState("2025-07-16");
  const [expiry, setExpiry]           = useState("2025-08-29");
  const [notes, setNotes]             = useState("");
  const [file, setFile]               = useState<File | null>(null);
  const [busy, setBusy]               = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const [liveUploads, setLiveUploads] = useState<ApiSupplierUpload[] | null>(null);
  const [upState, setUpState] = useState<FeedState>(demo ? "ready" : "loading");
  const refreshUploads = () => {
    if (!isLoggedIn()) { setLiveUploads(null); setUpState("ready"); return; }
    setUpState("loading");
    api
      .get<ApiSupplierUpload[]>("/supplier/uploads?kind=VOUCHER")
      .then((r) => { setLiveUploads(r); setUpState("ready"); })
      .catch(() => { setLiveUploads(null); setUpState("error"); }); // signed in → show the error, never demo uploads
  };
  useEffect(() => {
    const t = setTimeout(refreshUploads, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // keep the select pointed at a valid row when live rows replace the mocks
  useEffect(() => {
    if (bookingSel && eligible.some((b) => bookingKey(b) === bookingSel)) return;
    setBookingSel(eligible[0] ? bookingKey(eligible[0]) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings]);

  const submit = async () => {
    if (busy) return;
    if (!live) {
      erpToast.success([("Voucher submitted"), (`${voucherType} sent to TUBA operations for verification.`)].filter(Boolean).join(" — "));
      setFile(null);
      return;
    }
    const [service, id] = bookingSel.split("|");
    if (!service || !id) { erpToast.error("Select a related booking first"); return; }
    if (!file) { erpToast.error("Attach a voucher document first"); return; }
    setBusy(true);
    try {
      await api.uploadWithFields(`/supplier/bookings/${service}/${id}/upload?type=voucher`, file, { voucherType, issueDate, expiry, notes });
      erpToast.success([("Voucher submitted"), (`${voucherType} sent to TUBA operations for verification.`)].filter(Boolean).join(" — "));
      setFile(null);
      setNotes("");
      refreshUploads();
    } catch (e) {
      erpToast.error([("Voucher upload failed"), (e instanceof ApiError ? e.message : "Upload failed")].filter(Boolean).join(" — "));
    } finally {
      setBusy(false);
    }
  };

  const upReady = demo || upState === "ready";
  const RECENT = (liveUploads ?? []).map((u) => ({
        ref: u.meta?.voucherType || u.fileName,
        bkg: u.meta?.bookingCode ?? "—",
        date: fmtDate(u.createdAt),
        type: u.fileName,
        status: "verified",
      }));

  return (
    <div className="p-7 grid grid-cols-5 gap-6">
      <div className="col-span-3 space-y-4">
        <div>
          <h2 className="text-sm font-bold text-[#0B1E3F]">Voucher Upload</h2>
          <p className="text-xs mt-0.5" style={{ color: "rgba(11,30,63,0.58)" }}>Upload service vouchers and permits for confirmed bookings</p>
        </div>
        <div className="rounded-2xl p-5 space-y-4" style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(11,30,63,0.11)" }}>
          <div className="grid grid-cols-2 gap-3">
            <FF label="Related Booking">
              <FSelect value={bookingSel} onChange={(e) => setBookingSel(e.target.value)}>
                {eligible.length === 0
                  ? <option value="">{noBookingLabel}</option>
                  : eligible.map((b) => (
                      <option key={bookingKey(b)} value={bookingKey(b)}>{b.id} — {b.group}</option>
                    ))}
              </FSelect>
            </FF>
            <FF label="Voucher Type">
              <FSelect value={voucherType} onChange={(e) => setVoucherType(e.target.value)}>{voucherTypes.map((v) => <option key={v} value={v}>{v}</option>)}</FSelect>
            </FF>
            <FF label="Issue Date"><FInput type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} /></FF>
            <FF label="Expiry / Valid Until"><FInput type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} /></FF>
            <div className="col-span-2">
              <FF label="Notes (optional)"><FInput placeholder="Any notes for the agent or TUBA operations…" value={notes} onChange={(e) => setNotes(e.target.value)} /></FF>
            </div>
          </div>
        </div>
        <div className="rounded-2xl p-5" style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(11,30,63,0.11)" }}>
          <div className="text-[9px] font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(11,30,63,0.50)" }}>Attach Voucher Document</div>
          <input
            ref={fileInput} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) setFile(f); e.target.value = ""; }}
          />
          {!file ? (
            <div onClick={() => fileInput.current?.click()} className="flex flex-col items-center gap-3 p-6 rounded-xl cursor-pointer" style={{ border: `2px dashed ${color}35`, backgroundColor: `${color}06` }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}18` }}><Upload size={18} style={{ color }} /></div>
              <div className="text-center">
                <div className="text-xs font-semibold text-[#0B1E3F]">Drop voucher PDF or image</div>
                <div className="text-[10px] mt-0.5" style={{ color: "rgba(11,30,63,0.58)" }}>PDF, JPG, PNG · Max 10 MB</div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ backgroundColor: `${color}10`, border: `1px solid ${color}30` }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#4ADE8018" }}><FileText size={14} style={{ color: "#16A34A" }} /></div>
              <div className="flex-1"><div className="text-xs font-semibold text-[#0B1E3F]">{file.name}</div><div className="text-[10px]" style={{ color: "rgba(11,30,63,0.50)" }}>Attached · {fmtMB(file.size)}</div></div>
              <CheckCircle size={15} style={{ color: "#16A34A" }} />
              <button onClick={() => setFile(null)} style={{ color: "rgba(11,30,63,0.50)" }}><X size={13} /></button>
            </div>
          )}
        </div>
        <button onClick={() => void submit()} disabled={busy || (live && !bookingSel)} className="w-full py-3 rounded-xl text-xs font-bold disabled:opacity-60" style={{ backgroundColor: color, color: "#0B1E3F" }}>Submit Voucher</button>
      </div>
      <div className="col-span-2">
        <Card>
          <CardHead title="Recent Uploads" />
          <table className="w-full">
            <THead cols={["Ref", "Booking", "Type", "Date", "Status"]} />
            <tbody>
              {upReady && RECENT.map((r, i) => (
                <tr key={`${r.ref}-${i}`} style={{ borderBottom: i < RECENT.length - 1 ? "1px solid rgba(11,30,63,0.08)" : undefined }}>
                  <td className="px-4 py-2.5 text-[9px] font-mono"><div className="truncate max-w-[8rem]" title={r.ref} style={{ color, fontFamily: "var(--font-mono)" }}>{r.ref}</div></td>
                  <td className="px-4 py-2.5 text-[9px] whitespace-nowrap" style={{ color: "rgba(11,30,63,0.66)", fontFamily: "var(--font-mono)" }}>{r.bkg}</td>
                  <td className="px-4 py-2.5 text-[10px] text-[#0B1E3F]"><div className="truncate max-w-[10rem]" title={r.type}>{r.type}</div></td>
                  <td className="px-4 py-2.5 text-[10px] whitespace-nowrap" style={{ color: "rgba(11,30,63,0.58)" }}>{r.date}</td>
                  <td className="px-4 py-2.5"><SBadge status={r.status} /></td>
                </tr>
              ))}
              {(!upReady || RECENT.length === 0) && (
                <TableState cols={5} demo={demo} state={upState} onRetry={refreshUploads}
                  title="No vouchers uploaded" hint="Documents you submit to TUBA operations appear here." />
              )}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}

// ─── Invoice Upload Screen ────────────────────────────────────────────────────

function InvoicesScreen({ type, bookings, live, demo, state }: { type: SupplierType; bookings: BookingRec[]; live: boolean; demo: boolean; state: FeedState }) {
  const color = C[type];
  const noBookingLabel = demo || state === "ready" ? "No confirmed bookings" : state === "error" ? "Could not load bookings" : "Loading…";
  const [amount, setAmount] = useState("0");
  const vat   = Math.round(parseFloat(amount.replace(/,/g, "") || "0") * 0.15);
  const total = Math.round(parseFloat(amount.replace(/,/g, "") || "0") * 1.15);

  const eligible = bookings.filter((b) => b.status === "confirmed");

  const [invoiceNo, setInvoiceNo]         = useState("INV-2025-0091");
  const [bookingSel, setBookingSel]       = useState("");
  const [servicePeriod, setServicePeriod] = useState("");
  const [notes, setNotes]                 = useState("");
  const [file, setFile]                   = useState<File | null>(null);
  const [busy, setBusy]                   = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const [liveUploads, setLiveUploads] = useState<ApiSupplierUpload[] | null>(null);
  const [upState, setUpState] = useState<FeedState>(demo ? "ready" : "loading");
  const refreshUploads = () => {
    if (!isLoggedIn()) { setLiveUploads(null); setUpState("ready"); return; }
    setUpState("loading");
    api
      .get<ApiSupplierUpload[]>("/supplier/uploads?kind=INVOICE")
      .then((r) => { setLiveUploads(r); setUpState("ready"); })
      .catch(() => { setLiveUploads(null); setUpState("error"); }); // signed in → show the error, never demo invoices
  };
  useEffect(() => {
    const t = setTimeout(refreshUploads, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // keep the select pointed at a valid row when live rows replace the mocks
  useEffect(() => {
    if (bookingSel && eligible.some((b) => bookingKey(b) === bookingSel)) return;
    setBookingSel(eligible[0] ? bookingKey(eligible[0]) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings]);

  const submit = async () => {
    if (busy) return;
    if (!live) {
      erpToast.success([("Invoice submitted"), (`${invoiceNo} — SAR ${total.toLocaleString()} sent for review.`)].filter(Boolean).join(" — "));
      setFile(null);
      return;
    }
    const [service, id] = bookingSel.split("|");
    if (!service || !id) { erpToast.error("Select a related booking first"); return; }
    if (!file) { erpToast.error("Attach an invoice PDF first"); return; }
    setBusy(true);
    try {
      await api.uploadWithFields(`/supplier/bookings/${service}/${id}/upload?type=invoice`, file, {
        invoiceNo, amountExVat: amount.replace(/,/g, ""), servicePeriod, notes,
      });
      erpToast.success([("Invoice submitted"), (`${invoiceNo} — SAR ${total.toLocaleString()} sent for review.`)].filter(Boolean).join(" — "));
      setFile(null);
      setNotes("");
      refreshUploads();
    } catch (e) {
      erpToast.error([("Invoice upload failed"), (e instanceof ApiError ? e.message : "Upload failed")].filter(Boolean).join(" — "));
    } finally {
      setBusy(false);
    }
  };

  const upReady = demo || upState === "ready";
  const RECENT_INV = (liveUploads ?? []).map((u) => ({
        ref: u.meta?.invoiceNo || u.fileName,
        bkg: u.meta?.bookingCode ?? "—",
        amount: u.meta?.total ?? 0,
        date: fmtDate(u.createdAt),
        status: "confirmed",
      }));

  return (
    <div className="p-7 grid grid-cols-5 gap-6">
      <div className="col-span-3 space-y-4">
        <div>
          <h2 className="text-sm font-bold text-[#0B1E3F]">Invoice Upload</h2>
          <p className="text-xs mt-0.5" style={{ color: "rgba(11,30,63,0.58)" }}>Submit invoices for confirmed bookings — includes VAT (15%) calculation</p>
        </div>
        <div className="rounded-2xl p-5 space-y-4" style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(11,30,63,0.11)" }}>
          <div className="grid grid-cols-2 gap-3">
            <FF label="Invoice Number"><FInput placeholder="INV-XXXX-XXXXXX" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} /></FF>
            <FF label="Related Booking">
              <FSelect value={bookingSel} onChange={(e) => setBookingSel(e.target.value)}>
                {eligible.length === 0
                  ? <option value="">{noBookingLabel}</option>
                  : eligible.map((b) => (
                      <option key={bookingKey(b)} value={bookingKey(b)}>{b.id} — {b.group}</option>
                    ))}
              </FSelect>
            </FF>
            <FF label="Invoice Date"><FInput type="date" defaultValue="2025-07-16" /></FF>
            <FF label="Service Period"><FInput placeholder="e.g. 15 Aug – 29 Aug 2025" value={servicePeriod} onChange={(e) => setServicePeriod(e.target.value)} /></FF>
            <FF label="Amount Excl. VAT (SAR)">
              <input
                type="text" placeholder="0.00" value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2.5 text-xs rounded-xl focus:outline-none"
                style={IS}
              />
            </FF>
            <FF label="Currency"><FSelect><option>SAR — Saudi Riyal</option></FSelect></FF>
          </div>
          {/* VAT breakdown */}
          <div className="rounded-xl p-4 space-y-2" style={{ backgroundColor: `${color}08`, border: `1px solid ${color}20` }}>
            {[
              ["Sub-total (excl. VAT)", `SAR ${parseFloat(amount.replace(/,/g, "") || "0").toLocaleString()}`, "rgba(11,30,63,0.76)"],
              ["VAT 15%",               `SAR ${vat.toLocaleString()}`,                                          "rgba(11,30,63,0.66)"],
              ["Total Invoice Amount",  `SAR ${total.toLocaleString()}`,                                         "#0B1E3F"],
            ].map(([l, v, c]) => (
              <div key={l} className="flex justify-between items-center">
                <span className="text-xs" style={{ color: "rgba(11,30,63,0.58)" }}>{l}</span>
                <span className="text-sm font-bold" style={{ color: c as string, fontFamily: "var(--font-mono)" }}>{v}</span>
              </div>
            ))}
          </div>
          <FF label="Notes (optional)"><FInput placeholder="Any additional notes…" value={notes} onChange={(e) => setNotes(e.target.value)} /></FF>
        </div>
        <div className="rounded-2xl p-5" style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(11,30,63,0.11)" }}>
          <div className="text-[9px] font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(11,30,63,0.50)" }}>Attach Invoice PDF</div>
          <input
            ref={fileInput} type="file" accept=".pdf,application/pdf" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) setFile(f); e.target.value = ""; }}
          />
          {!file ? (
            <div onClick={() => fileInput.current?.click()} className="flex flex-col items-center gap-3 p-6 rounded-xl cursor-pointer" style={{ border: `2px dashed ${color}35`, backgroundColor: `${color}06` }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}18` }}><Upload size={18} style={{ color }} /></div>
              <div className="text-center"><div className="text-xs font-semibold text-[#0B1E3F]">Upload signed invoice PDF</div><div className="text-[10px] mt-0.5" style={{ color: "rgba(11,30,63,0.58)" }}>PDF only · Max 10 MB</div></div>
            </div>
          ) : (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ backgroundColor: `${color}10`, border: `1px solid ${color}30` }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#4ADE8018" }}><FileText size={14} style={{ color: "#16A34A" }} /></div>
              <div className="flex-1"><div className="text-xs font-semibold text-[#0B1E3F]">{file.name}</div><div className="text-[10px]" style={{ color: "rgba(11,30,63,0.50)" }}>Attached · {fmtMB(file.size)}</div></div>
              <CheckCircle size={15} style={{ color: "#16A34A" }} />
              <button onClick={() => setFile(null)} style={{ color: "rgba(11,30,63,0.50)" }}><X size={13} /></button>
            </div>
          )}
        </div>
        <button onClick={() => void submit()} disabled={busy || (live && !bookingSel)} className="w-full py-3 rounded-xl text-xs font-bold disabled:opacity-60" style={{ backgroundColor: color, color: "#0B1E3F" }}>Submit Invoice</button>
      </div>
      <div className="col-span-2 space-y-4">
        <Card>
          <CardHead title="Submitted Invoices" />
          <table className="w-full">
            <THead cols={["Ref", "Booking", "Amount", "Date", "Status"]} />
            <tbody>
              {upReady && RECENT_INV.map((r, i) => (
                <tr key={`${r.ref}-${i}`} style={{ borderBottom: i < RECENT_INV.length - 1 ? "1px solid rgba(11,30,63,0.08)" : "none" }}>
                  <td className="px-4 py-2.5 text-[9px] font-mono"><div className="truncate max-w-[8rem]" title={r.ref} style={{ color, fontFamily: "var(--font-mono)" }}>{r.ref}</div></td>
                  <td className="px-4 py-2.5 text-[9px] whitespace-nowrap" style={{ color: "rgba(11,30,63,0.58)", fontFamily: "var(--font-mono)" }}>{r.bkg}</td>
                  <td className="px-4 py-2.5"><Amt value={r.amount} type="credit" /></td>
                  <td className="px-4 py-2.5 text-[10px] whitespace-nowrap" style={{ color: "rgba(11,30,63,0.58)" }}>{r.date}</td>
                  <td className="px-4 py-2.5"><SBadge status={r.status} /></td>
                </tr>
              ))}
              {(!upReady || RECENT_INV.length === 0) && (
                <TableState cols={5} demo={demo} state={upState} onRetry={refreshUploads}
                  title="No invoices submitted" hint="Invoices you submit for review appear here." />
              )}
            </tbody>
          </table>
        </Card>
        <div className="flex items-start gap-2.5 px-4 py-3.5 rounded-xl" style={{ backgroundColor: `${color}0A`, border: `1px solid ${color}20` }}>
          <Info size={12} style={{ color }} className="mt-0.5 shrink-0" />
          <div className="text-[10px]" style={{ color: "rgba(11,30,63,0.66)" }}>
            Invoices are reviewed within 3–5 business days. Payment is disbursed after service delivery confirmation by the agent.
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Statement Screen ─────────────────────────────────────────────────────────

function StatementScreen(_p: { type: SupplierType; demo: boolean }) {
  return (
    <div className="p-7">
      <div className="mb-5"><h2 className="text-sm font-bold text-[#0B1E3F]">Statement — Supplier View</h2><p className="text-xs mt-0.5" style={{ color: "rgba(11,30,63,0.58)" }}>Running balance of booking settlements and platform fees</p></div>
      <div className="rounded-2xl p-8" style={{ backgroundColor: "#FBFCFD", border: "1px solid rgba(11,30,63,0.11)" }}>
        <EmptyState title="Supplier statement coming soon" hint="Your running-balance ledger of settlements and platform fees will appear here in a later release. Bookings, vouchers and invoices are live in the other tabs." />
      </div>
    </div>
  );
}

function PaymentsScreen(_p: { type: SupplierType; demo: boolean }) {
  return (
    <div className="p-7">
      <div className="mb-5"><h2 className="text-sm font-bold text-[#0B1E3F]">Payments &amp; Payouts</h2><p className="text-xs mt-0.5" style={{ color: "rgba(11,30,63,0.58)" }}>Disbursements and bank-settlement details</p></div>
      <div className="rounded-2xl p-8" style={{ backgroundColor: "#FBFCFD", border: "1px solid rgba(11,30,63,0.11)" }}>
        <EmptyState title="Payouts coming soon" hint="Your disbursement history and bank-settlement details will appear here once payouts go live. We never show bank-settlement details that aren't your own." />
      </div>
    </div>
  );
}

export default function SupplierPortal() {
  const [screen, setScreen]   = useState("dashboard");
  const [supType, setSupType] = useState<SupplierType>(() => {
    const st = getStoredUser()?.company?.supplierType?.toLowerCase();
    return st === "hotel" || st === "transport" || st === "catering" ? st : "hotel";
  });
  const [liveCompany, setLiveCompany]   = useState<{ name: string; code: string; joinedAt: string | null } | null>(null);
  const [liveBookings, setLiveBookings] = useState<BookingRec[] | null>(null);

  const demo = !isLoggedIn();
  const [bookingsState, setBookingsState] = useState<FeedState>(demo ? "ready" : "loading");
  const refreshBookings = () => {
    if (!isLoggedIn()) { setLiveBookings(null); setBookingsState("ready"); return; }
    setBookingsState("loading");
    api
      .get<ApiSupplierBooking[]>("/supplier/bookings")
      .then((rows) => { setLiveBookings(rows.map(toBookingRec).filter((b): b is BookingRec => b !== null)); setBookingsState("ready"); })
      .catch(() => { setLiveBookings(null); setBookingsState("error"); }); // signed in → show the error, never demo bookings
  };
  useEffect(() => {
    const t = setTimeout(() => {
      if (!isLoggedIn()) return;
      api
        .me()
        .then((u) => {
          if (u.company?.type !== "SUPPLIER") return;
          const st = u.company.supplierType?.toLowerCase();
          if (st === "hotel" || st === "transport" || st === "catering") setSupType(st);
          setLiveCompany({ name: u.company.name, code: u.company.code, joinedAt: u.company.joinedAt ?? null });
        })
        .catch(() => setLiveCompany(null));
      refreshBookings();
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const color = C[supType];
  const meta  = SUPPLIER_META[supType];
  const live  = !demo;
  // live rows come pre-scoped from the server — the type switcher stays cosmetic when live
  const bkgs  = liveBookings ?? [];
  const companyName = liveCompany?.name ?? meta.name;
  const companyCode = liveCompany?.code ?? meta.code;
  const since = liveCompany?.joinedAt ? fmtDate(liveCompany.joinedAt) : "01 Jan 2025";

  const content: Record<string, ReactNode> = {
    dashboard: <DashboardScreen type={supType} bookings={bkgs} name={companyName} code={companyCode} since={since} demo={demo} state={bookingsState} onRetry={refreshBookings} />,
    bookings:  <BookingsScreen  type={supType} bookings={bkgs} live={live} onRefresh={refreshBookings} demo={demo} state={bookingsState} />,
    vouchers:  <VouchersScreen  type={supType} bookings={bkgs} live={live} demo={demo} state={bookingsState} />,
    invoices:  <InvoicesScreen  type={supType} bookings={bkgs} live={live} demo={demo} state={bookingsState} />,
    statement: <StatementScreen type={supType} demo={demo} />,
    payments:  <PaymentsScreen  type={supType} demo={demo} />,
  };

  return (
    <ERPShell
      moduleId="supplier"
      moduleName="Supplier Portal"
      moduleColor={color}
      moduleIcon={meta.icon}
      navItems={SUPPLIER_NAV}
      activeItem={screen}
      onItemClick={setScreen}
      breadcrumb={[companyName, SCREEN_LABELS[screen] ?? screen]}
      notificationCount={3}
      userName={companyName}
      userRole={`Supplier · ${companyCode}`}
    >
      <div className="flex flex-col h-full overflow-hidden">
        <TypeSwitcher type={supType} onChange={(t) => { setSupType(t); setScreen("dashboard"); }} />
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(11,30,63,0.38) transparent" }}>
          {content[screen]}
        </div>
      </div>
    </ERPShell>
  );
}
