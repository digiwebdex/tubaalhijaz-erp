import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import {
  LayoutDashboard, Calendar, Upload, FileText, Wallet,
  Building, Bus, UtensilsCrossed, Check, X, Clock,
  CheckCircle, AlertCircle, Info, Star, TrendingUp,
} from "lucide-react";
import { ERPShell, type NavItem, type IconFC } from "../components/ERPShell";
import { EmptyState, LoadingSkeleton, ErrorState } from "../components/States";
import {
  ERP, CAT, erpAlpha, ErpThemeProvider, ErpStatCard, ErpTabs,
  ErpButton, ErpDataTable, type ErpColumn,
  ErpField, ErpInput, ErpTextarea, ErpSelect, ErpStatusChip, erpToast, type ErpStatusKind,
} from "../components/erp";
import { api, ApiError, getStoredUser, isLoggedIn } from "../lib/api";
import { useLang } from "../lib/LangContext";
import { fontFor } from "@tuba/shared";

// ─── Constants & types ────────────────────────────────────────────────────────

type SupplierType = "hotel" | "transport" | "catering";
type BookingStatus = "pending_acceptance" | "confirmed" | "rejected" | "completed";

const C: Record<SupplierType, string> = {
  hotel:     CAT.blue,
  transport: CAT.orange,
  catering:  CAT.purple,
};

const GOLD = ERP.accent;

// ─── Mock data ────────────────────────────────────────────────────────────────

interface BookingRec {
  id: string; group: string; agent: string;
  pax: number; detail: string; dates: string;
  nights?: number; amount: number; status: BookingStatus;
  // present on live API rows only — needed to address the backend record
  service?: SupplierType; apiId?: string;
}

// Recent-upload row shapes (voucher / invoice tables)
type VoucherRow = { id: string; ref: string; bkg: string; date: string; type: string; status: string };
type InvoiceRow = { id: string; ref: string; bkg: string; amount: number; date: string; status: string };

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

// (prototype supplier ledger/payment demo data removed)

const SUPPLIER_META: Record<SupplierType, { name: string; code: string; icon: IconFC }> = {
  hotel:     { name: "Jabal Omar Hyatt Regency",    code: "SUP-HTL-4291", icon: Building as IconFC },
  transport: { name: "Al-Naqil Transport Co.",       code: "SUP-TRN-1847", icon: Bus as IconFC },
  catering:  { name: "Al-Barakah Catering Services", code: "SUP-CAT-0392", icon: UtensilsCrossed as IconFC },
};

// ─── Navigation ───────────────────────────────────────────────────────────────

const SUPPLIER_NAV: NavItem[] = [
  { id: "dashboard",  label: "Dashboard",          labelBn: "ড্যাশবোর্ড",           icon: LayoutDashboard as IconFC, badge: 5 },
  { id: "bookings",   label: "Booking Acceptance", labelBn: "বুকিং গ্রহণ",          icon: Calendar as IconFC,        badge: 3 },
  { id: "vouchers",   label: "Voucher Upload",     labelBn: "ভাউচার আপলোড",         icon: Upload as IconFC },
  { id: "invoices",   label: "Invoice Upload",     labelBn: "ইনভয়েস আপলোড",        icon: FileText as IconFC },
  // Statement / payouts have no supplier ledger API yet — removed from production nav.
];

const SCREEN_LABELS: Record<string, { en: string; bn: string }> = {
  dashboard: { en: "Dashboard", bn: "ড্যাশবোর্ড" },
  bookings:  { en: "Booking Acceptance", bn: "বুকিং গ্রহণ" },
  vouchers:  { en: "Voucher Upload", bn: "ভাউচার আপলোড" },
  invoices:  { en: "Invoice Upload", bn: "ইনভয়েস আপলোড" },
  statement: { en: "Statement", bn: "স্টেটমেন্ট" },
  payments:  { en: "Payments", bn: "পেমেন্ট" },
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

function Amt({ value, type }: { value: number; type?: "credit" | "debit" }) {
  const color = type === "credit" ? ERP.success : type === "debit" ? ERP.destructive : ERP.navy;
  const prefix = type === "credit" ? "+" : type === "debit" ? "−" : "";
  return <span className="font-mono font-semibold text-xs whitespace-nowrap tabular-nums" style={{ color, fontFamily: "var(--font-mono)" }}>{prefix}SAR {value.toLocaleString()}</span>;
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl overflow-hidden ${className}`} style={{ backgroundColor: ERP.surface, border: `1px solid ${ERP.border}` }}>{children}</div>;
}

function CardHead({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: `1px solid ${ERP.border}`, backgroundColor: ERP.surface }}>
      <span className="text-xs font-bold text-[color:var(--erp-text-strong)]">{title}</span>
      {action}
    </div>
  );
}

function FF({ label, children }: { label: string; children: ReactNode }) {
  return <ErpField label={label}>{children}</ErpField>;
}

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
    <div className="flex items-center gap-3 px-7 shrink-0" style={{ backgroundColor: ERP.surface }}>
      <span className="text-[9px] font-bold uppercase tracking-widest shrink-0" style={{ color: ERP.muted }}>Viewing as:</span>
      <ErpTabs
        active={type}
        onChange={(id) => onChange(id as SupplierType)}
        ariaLabel="Supplier type"
        className="flex-1"
        tabs={TYPES.map((t) => ({ id: t.id, label: t.label, icon: t.icon, accent: C[t.id] }))}
      />
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

  const idCol: ErpColumn<BookingRec> = { id: "id", header: "ID", cell: (b) => <span className="text-[9px] font-mono whitespace-nowrap" style={{ color, fontFamily: "var(--font-mono)" }}>{b.id}</span> };
  const groupCol: ErpColumn<BookingRec> = { id: "group", header: "Group", cell: (b) => <span className="text-[9px] whitespace-nowrap" style={{ color: ERP.muted, fontFamily: "var(--font-mono)" }}>{b.group}</span> };
  const agentCol: ErpColumn<BookingRec> = { id: "agent", header: "Agent", cell: (b) => <div className="truncate max-w-[14rem] text-xs text-[color:var(--erp-text-strong)]" title={b.agent}>{b.agent}</div> };
  const paxCol: ErpColumn<BookingRec> = { id: "pax", header: "Pax", align: "center", cell: (b) => <span className="text-xs font-bold tabular-nums" style={{ color: ERP.navy, fontFamily: "var(--font-mono)" }}>{b.pax}</span> };
  const amountCol: ErpColumn<BookingRec> = { id: "amount", header: "Amount", cell: (b) => <Amt value={b.amount} type="credit" /> };
  const statusCol: ErpColumn<BookingRec> = { id: "status", header: "Status", cell: (b) => <SBadge status={b.status} /> };
  const pendingCols: ErpColumn<BookingRec>[] = [
    { ...idCol, header: "Booking ID" }, groupCol, agentCol, paxCol,
    { id: "detail", header: "Details", cell: (b) => <div className="truncate max-w-[18rem] text-[10px]" title={b.detail} style={{ color: ERP.muted }}>{b.detail}</div> },
    amountCol, { id: "status", header: "Status", cell: (b) => <SBadge status="pending_acceptance" /> },
  ];
  const allCols: ErpColumn<BookingRec>[] = [
    idCol, groupCol, agentCol, paxCol,
    { id: "dates", header: "Dates", cell: (b) => <span className="text-[10px] whitespace-nowrap" style={{ color: ERP.muted }}>{b.dates}</span> },
    amountCol, statusCol,
  ];
  const pendingRows = bookings.filter((b) => b.status === "pending_acceptance");

  return (
    <div className="p-7 space-y-5">
      {/* Supplier identity */}
      <div className="flex items-center gap-4 rounded-xl px-5 py-4" style={{ backgroundColor: `${erpAlpha(color, 6)}`, border: `1px solid ${erpAlpha(color, 15)}` }}>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${erpAlpha(color, 13)}` }}>
          <Icon size={22} style={{ color }} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2.5 mb-0.5">
            <h1 className="text-sm font-bold text-[color:var(--erp-text-strong)]">{name}</h1>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: erpAlpha(ERP.success, 8), color: ERP.success }}>Active Supplier</span>
          </div>
          <div className="text-[10px]" style={{ color: ERP.muted }}>
            Code: <span style={{ color, fontFamily: "var(--font-mono)" }}>{code}</span>
            {" · "}Umrah Season 1446H
            {" · "}Contracted since: <span style={{ color: ERP.navy }}>{since}</span>
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
          { label: "Pending Acceptance", value: ready ? String(pending) : "—",              accent: color,       icon: Clock,       note: "Require your action" },
          { label: "Confirmed Bookings", value: ready ? String(confirmed) : "—",             accent: ERP.success, icon: CheckCircle, note: "Upcoming season" },
          { label: "Season Revenue",     value: ready ? `SAR ${revenue.toLocaleString()}` : "—", accent: ERP.success, icon: TrendingUp, note: "Confirmed bookings" },
          { label: "Total Bookings",     value: ready ? String(bookings.length) : "—",        accent: GOLD,        icon: Wallet,      note: "This season" },
        ].map((k) => {
          const KIcon = k.icon;
          return (
            <ErpStatCard
              key={k.label}
              label={k.label}
              value={k.value}
              accent={k.accent}
              hint={k.note}
              icon={<KIcon size={16} style={{ color: k.accent }} />}
            />
          );
        })}
      </div>

      {/* Pending bookings action required */}
      {ready && pending > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${erpAlpha(color, 15)}` }}>
          <div className="flex items-center gap-2.5 px-5 py-3" style={{ backgroundColor: `${erpAlpha(color, 5)}`, borderBottom: `1px solid ${erpAlpha(color, 13)}` }}>
            <AlertCircle size={13} style={{ color }} />
            <span className="text-xs font-bold text-[color:var(--erp-text-strong)]">Action Required — {pending} booking{pending > 1 ? "s" : ""} awaiting your acceptance</span>
          </div>
          <ErpDataTable flush columns={pendingCols} rows={pendingRows} rowKey={(b) => b.id} />
        </div>
      )}

      {/* All bookings */}
      <Card>
        <CardHead title="All Bookings — Season 1446H" action={
          <span className="text-[10px]" style={{ color: ERP.muted }}>{ready ? `${bookings.length} total` : "—"}</span>
        } />
        {!demo && state === "error"
          ? <div className="p-4"><ErrorState tone="light" onRetry={onRetry} /></div>
          : <ErpDataTable
              flush columns={allCols} rows={ready ? bookings : []} rowKey={(b) => b.id}
              loading={!demo && state === "loading"}
              emptyTitle="No bookings yet"
              emptyHint="Bookings assigned to you by TUBA operations appear here."
            />}
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
        <div className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: ERP.muted }}>Pending Acceptance</div>
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
            className="w-full text-left p-4 rounded-xl transition-all"
            style={{ border: `1px solid ${sel === b.id ? color : ERP.mutedSoft}`, backgroundColor: sel === b.id ? `${erpAlpha(color, 4)}` : ERP.mutedSoft }}
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-[9px] font-mono truncate" style={{ color, fontFamily: "var(--font-mono)" }}>{b.id}</span>
              <SBadge status="pending_acceptance" />
            </div>
            <div className="text-xs font-semibold text-[color:var(--erp-text-strong)] mb-0.5 truncate" title={b.agent}>{b.agent}</div>
            <div className="text-[10px] truncate" title={`${b.group} · ${b.pax} pax`} style={{ color: ERP.muted }}>{b.group} · {b.pax} pax</div>
            <div className="flex items-center justify-between gap-2 mt-2">
              <span className="text-[10px] truncate" style={{ color: ERP.muted }}>{b.dates}</span>
              <span className="shrink-0"><Amt value={b.amount} type="credit" /></span>
            </div>
          </button>
        ))}

        {/* Resolved bookings */}
        {ready && bookings.filter((b) => b.status !== "pending_acceptance" || accepted.has(b.id) || rejected.has(b.id)).length > 0 && (
          <>
            <div className="text-[9px] font-bold uppercase tracking-widest mt-4 mb-2" style={{ color: ERP.muted }}>All Bookings</div>
            {bookings.filter((b) => b.status !== "pending_acceptance" || accepted.has(b.id) || rejected.has(b.id)).map((b) => (
              <button
                key={b.id}
                onClick={() => { setSel(b.id); setAction("idle"); }}
                className="w-full text-left p-3.5 rounded-xl transition-all opacity-70"
                style={{ border: `1px solid ${sel === b.id ? color : ERP.mutedSoft}`, backgroundColor: sel === b.id ? `${erpAlpha(color, 3)}` : ERP.mutedSoft }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[9px] font-mono truncate" style={{ color: ERP.muted, fontFamily: "var(--font-mono)" }}>{b.id}</span>
                  <SBadge status={statusOf(b)} />
                </div>
                <div className="text-[10px] mt-1 text-[color:var(--erp-text-strong)] truncate" title={`${b.agent} · ${b.pax} pax`}>{b.agent} · {b.pax} pax</div>
              </button>
            ))}
          </>
        )}
      </div>

      {/* RIGHT: Detail + actions */}
      {selected ? (
        <div className="col-span-3 space-y-4">
          {/* Booking detail card */}
          <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${erpAlpha(color, 19)}` }}>
            <div className="flex items-center justify-between px-5 py-3.5" style={{ backgroundColor: `${erpAlpha(color, 5)}`, borderBottom: `1px solid ${erpAlpha(color, 13)}` }}>
              <div>
                <div className="text-[9px] font-bold uppercase tracking-widest mb-0.5" style={{ color }}>Booking Detail</div>
                <div className="text-sm font-bold text-[color:var(--erp-text-strong)]" style={{ fontFamily: "var(--font-mono)" }}>{selected.id}</div>
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
                <div key={l} className="px-5 py-3 min-w-0" style={{ borderBottom: i < 4 ? `1px solid ${ERP.border}` : undefined, borderRight: i % 2 === 0 ? `1px solid ${ERP.border}` : undefined }}>
                  <div className="text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color: ERP.muted }}>{l}</div>
                  <div className="text-xs font-semibold text-[color:var(--erp-text-strong)] truncate" title={v}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Action panel */}
          {!accepted.has(selected.id) && !rejected.has(selected.id) && selected.status === "pending_acceptance" && (
            <div className="rounded-xl p-5" style={{ backgroundColor: ERP.surface, border: `1px solid ${ERP.border}` }}>
              <div className="text-xs font-bold text-[color:var(--erp-text-strong)] mb-3">Your Response</div>
              {action === "idle" && (
                <div className="flex gap-3">
                  <ErpButton variant="primary" icon={<Check size={14} />} onClick={() => setAction("accepting")} style={{ flex: 1, backgroundColor: ERP.success, color: ERP.navy }}>Accept Booking</ErpButton>
                  <ErpButton variant="outline" icon={<X size={14} />} onClick={() => setAction("rejecting")} style={{ flex: 1, backgroundColor: erpAlpha(ERP.destructive, 12), color: ERP.destructive, border: `1px solid ${erpAlpha(ERP.destructive, 30)}` }}>Reject Booking</ErpButton>
                </div>
              )}
              {action === "accepting" && (
                <div>
                  <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl mb-4" style={{ backgroundColor: erpAlpha(ERP.success, 6), border: `1px solid ${erpAlpha(ERP.success, 15)}` }}>
                    <Info size={12} style={{ color: ERP.success }} className="mt-0.5 shrink-0" />
                    <p className="text-[11px]" style={{ color: ERP.navy }}>
                      By accepting, you confirm availability and agree to deliver the service as described. A booking confirmation will be sent to the agent.
                    </p>
                  </div>
                  <div className="flex gap-2.5">
                    <ErpButton variant="secondary" onClick={() => setAction("idle")} disabled={busy}>Cancel</ErpButton>
                    <ErpButton variant="primary" onClick={() => void confirm("accept")} disabled={busy} style={{ flex: 1, backgroundColor: ERP.success, color: ERP.navy }}>✓ Confirm Acceptance</ErpButton>
                  </div>
                </div>
              )}
              {action === "rejecting" && (
                <div className="space-y-3">
                  <FF label="Rejection Reason (required)">
                    <ErpTextarea
                      rows={3} value={reason} onChange={(e) => setReason(e.target.value)}
                      placeholder="e.g. No availability for the requested dates. Please contact us for alternative dates."
                    />
                  </FF>
                  <div className="flex gap-2.5">
                    <ErpButton variant="secondary" onClick={() => setAction("idle")} disabled={busy}>Cancel</ErpButton>
                    <ErpButton variant="danger" onClick={() => void confirm("reject")} disabled={!reason.trim() || busy} style={{ flex: 1 }}>Submit Rejection</ErpButton>
                  </div>
                </div>
              )}
            </div>
          )}

          {(accepted.has(selected.id) || rejected.has(selected.id)) && (
            <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl" style={{ backgroundColor: accepted.has(selected.id) ? erpAlpha(ERP.success, 6) : erpAlpha(ERP.destructive, 6), border: `1px solid ${accepted.has(selected.id) ? erpAlpha(ERP.success, 19) : erpAlpha(ERP.destructive, 19)}` }}>
              {accepted.has(selected.id) ? <CheckCircle size={16} style={{ color: ERP.success }} /> : <X size={16} style={{ color: ERP.destructive }} />}
              <span className="text-xs font-semibold" style={{ color: accepted.has(selected.id) ? ERP.success : ERP.destructive }}>
                {accepted.has(selected.id) ? "Booking accepted — confirmation sent to agent" : "Booking rejected — reason submitted"}
              </span>
            </div>
          )}

          {/* Status tracker */}
          <div className="rounded-xl p-5" style={{ backgroundColor: ERP.surface, border: `1px solid ${ERP.border}` }}>
            <div className="text-xs font-bold text-[color:var(--erp-text-strong)] mb-4">Booking Lifecycle</div>
            <div className="relative pl-5">
              <div className="absolute left-[9px] top-2 bottom-2 w-px" style={{ backgroundColor: ERP.surfaceSoft }} />
              <div className="space-y-4">
                {STEPS.map((step, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <div className="z-10 w-[18px] h-[18px] rounded-full shrink-0 flex items-center justify-center" style={step.done ? { backgroundColor: `${erpAlpha(color, 13)}`, border: `1px solid ${erpAlpha(color, 38)}` } : { backgroundColor: ERP.surfaceSoft, border: `1px solid ${ERP.border}` }}>
                      {step.done ? <Check size={9} style={{ color }} /> : <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: ERP.border }} />}
                    </div>
                    <span className="text-xs font-semibold" style={{ color: step.done ? color : ERP.muted }}>{step.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="col-span-3 flex items-center justify-center text-center">
          <div>
            <Calendar size={32} style={{ color: ERP.mutedSoft, marginBottom: ERP.space[3] }} />
            <div className="text-xs font-semibold" style={{ color: ERP.muted }}>Select a booking to review</div>
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
  const RECENT: VoucherRow[] = (liveUploads ?? []).map((u, i) => ({
        id: String(i),
        ref: u.meta?.voucherType || u.fileName,
        bkg: u.meta?.bookingCode ?? "—",
        date: fmtDate(u.createdAt),
        type: u.fileName,
        status: "verified",
      }));
  const voucherCols: ErpColumn<VoucherRow>[] = [
    { id: "ref", header: "Ref", cell: (r) => <div className="truncate max-w-[8rem] text-[9px] font-mono" title={r.ref} style={{ color, fontFamily: "var(--font-mono)" }}>{r.ref}</div> },
    { id: "bkg", header: "Booking", cell: (r) => <span className="text-[9px] whitespace-nowrap" style={{ color: ERP.muted, fontFamily: "var(--font-mono)" }}>{r.bkg}</span> },
    { id: "type", header: "Type", cell: (r) => <div className="truncate max-w-[10rem] text-[10px] text-[color:var(--erp-text-strong)]" title={r.type}>{r.type}</div> },
    { id: "date", header: "Date", cell: (r) => <span className="text-[10px] whitespace-nowrap" style={{ color: ERP.muted }}>{r.date}</span> },
    { id: "status", header: "Status", cell: (r) => <SBadge status={r.status} /> },
  ];

  return (
    <div className="p-7 grid grid-cols-5 gap-6">
      <div className="col-span-3 space-y-4">
        <div>
          <h2 className="text-sm font-bold text-[color:var(--erp-text-strong)]">Voucher Upload</h2>
          <p className="text-xs mt-0.5" style={{ color: ERP.muted }}>Upload service vouchers and permits for confirmed bookings</p>
        </div>
        <div className="rounded-xl p-5 space-y-4" style={{ backgroundColor: ERP.surface, border: `1px solid ${ERP.border}` }}>
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
        <div className="rounded-xl p-5" style={{ backgroundColor: ERP.surface, border: `1px solid ${ERP.border}` }}>
          <div className="text-[9px] font-bold uppercase tracking-widest mb-3" style={{ color: ERP.muted }}>Attach Voucher Document</div>
          <input
            ref={fileInput} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) setFile(f); e.target.value = ""; }}
          />
          {!file ? (
            <div onClick={() => fileInput.current?.click()} className="flex flex-col items-center gap-3 p-6 rounded-xl cursor-pointer" style={{ border: `2px dashed ${erpAlpha(color, 21)}`, backgroundColor: `${erpAlpha(color, 2)}` }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${erpAlpha(color, 9)}` }}><Upload size={18} style={{ color }} /></div>
              <div className="text-center">
                <div className="text-xs font-semibold text-[color:var(--erp-text-strong)]">Drop voucher PDF or image</div>
                <div className="text-[10px] mt-0.5" style={{ color: ERP.muted }}>PDF, JPG, PNG · Max 10 MB</div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ backgroundColor: `${erpAlpha(color, 6)}`, border: `1px solid ${erpAlpha(color, 19)}` }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: erpAlpha(ERP.success, 9) }}><FileText size={14} style={{ color: ERP.success }} /></div>
              <div className="flex-1"><div className="text-xs font-semibold text-[color:var(--erp-text-strong)]">{file.name}</div><div className="text-[10px]" style={{ color: ERP.muted }}>Attached · {fmtMB(file.size)}</div></div>
              <CheckCircle size={15} style={{ color: ERP.success }} />
              <ErpButton variant="ghost" size="sm" onClick={() => setFile(null)} icon={<X size={13} />} style={{ color: ERP.muted, padding: 4, minHeight: 0 }} />
            </div>
          )}
        </div>
        <ErpButton variant="primary" onClick={() => void submit()} disabled={busy || (live && !bookingSel)} style={{ width: "100%", backgroundColor: color, color: ERP.navy }}>Submit Voucher</ErpButton>
      </div>
      <div className="col-span-2">
        <Card>
          <CardHead title="Recent Uploads" />
          {!demo && upState === "error"
            ? <div className="p-4"><ErrorState tone="light" onRetry={refreshUploads} /></div>
            : <ErpDataTable
                flush columns={voucherCols} rows={upReady ? RECENT : []} rowKey={(r) => r.id}
                loading={!demo && upState === "loading"}
                emptyTitle="No vouchers uploaded"
                emptyHint="Documents you submit to TUBA operations appear here."
              />}
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
  const RECENT_INV: InvoiceRow[] = (liveUploads ?? []).map((u, i) => ({
        id: String(i),
        ref: u.meta?.invoiceNo || u.fileName,
        bkg: u.meta?.bookingCode ?? "—",
        amount: u.meta?.total ?? 0,
        date: fmtDate(u.createdAt),
        status: "confirmed",
      }));
  const invoiceCols: ErpColumn<InvoiceRow>[] = [
    { id: "ref", header: "Ref", cell: (r) => <div className="truncate max-w-[8rem] text-[9px] font-mono" title={r.ref} style={{ color, fontFamily: "var(--font-mono)" }}>{r.ref}</div> },
    { id: "bkg", header: "Booking", cell: (r) => <span className="text-[9px] whitespace-nowrap" style={{ color: ERP.muted, fontFamily: "var(--font-mono)" }}>{r.bkg}</span> },
    { id: "amount", header: "Amount", cell: (r) => <Amt value={r.amount} type="credit" /> },
    { id: "date", header: "Date", cell: (r) => <span className="text-[10px] whitespace-nowrap" style={{ color: ERP.muted }}>{r.date}</span> },
    { id: "status", header: "Status", cell: (r) => <SBadge status={r.status} /> },
  ];

  return (
    <div className="p-7 grid grid-cols-5 gap-6">
      <div className="col-span-3 space-y-4">
        <div>
          <h2 className="text-sm font-bold text-[color:var(--erp-text-strong)]">Invoice Upload</h2>
          <p className="text-xs mt-0.5" style={{ color: ERP.muted }}>Submit invoices for confirmed bookings — includes VAT (15%) calculation</p>
        </div>
        <div className="rounded-xl p-5 space-y-4" style={{ backgroundColor: ERP.surface, border: `1px solid ${ERP.border}` }}>
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
              <ErpInput type="text" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </FF>
            <FF label="Currency"><FSelect><option>SAR — Saudi Riyal</option></FSelect></FF>
          </div>
          {/* VAT breakdown */}
          <div className="rounded-xl p-4 space-y-2" style={{ backgroundColor: `${erpAlpha(color, 3)}`, border: `1px solid ${erpAlpha(color, 13)}` }}>
            {[
              ["Sub-total (excl. VAT)", `SAR ${parseFloat(amount.replace(/,/g, "") || "0").toLocaleString()}`, ERP.navy],
              ["VAT 15%",               `SAR ${vat.toLocaleString()}`,                                          ERP.muted],
              ["Total Invoice Amount",  `SAR ${total.toLocaleString()}`,                                         ERP.navy],
            ].map(([l, v, c]) => (
              <div key={l} className="flex justify-between items-center">
                <span className="text-xs" style={{ color: ERP.muted }}>{l}</span>
                <span className="text-sm font-bold" style={{ color: c as string, fontFamily: "var(--font-mono)" }}>{v}</span>
              </div>
            ))}
          </div>
          <FF label="Notes (optional)"><FInput placeholder="Any additional notes…" value={notes} onChange={(e) => setNotes(e.target.value)} /></FF>
        </div>
        <div className="rounded-xl p-5" style={{ backgroundColor: ERP.surface, border: `1px solid ${ERP.border}` }}>
          <div className="text-[9px] font-bold uppercase tracking-widest mb-3" style={{ color: ERP.muted }}>Attach Invoice PDF</div>
          <input
            ref={fileInput} type="file" accept=".pdf,application/pdf" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) setFile(f); e.target.value = ""; }}
          />
          {!file ? (
            <div onClick={() => fileInput.current?.click()} className="flex flex-col items-center gap-3 p-6 rounded-xl cursor-pointer" style={{ border: `2px dashed ${erpAlpha(color, 21)}`, backgroundColor: `${erpAlpha(color, 2)}` }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${erpAlpha(color, 9)}` }}><Upload size={18} style={{ color }} /></div>
              <div className="text-center"><div className="text-xs font-semibold text-[color:var(--erp-text-strong)]">Upload signed invoice PDF</div><div className="text-[10px] mt-0.5" style={{ color: ERP.muted }}>PDF only · Max 10 MB</div></div>
            </div>
          ) : (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ backgroundColor: `${erpAlpha(color, 6)}`, border: `1px solid ${erpAlpha(color, 19)}` }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: erpAlpha(ERP.success, 9) }}><FileText size={14} style={{ color: ERP.success }} /></div>
              <div className="flex-1"><div className="text-xs font-semibold text-[color:var(--erp-text-strong)]">{file.name}</div><div className="text-[10px]" style={{ color: ERP.muted }}>Attached · {fmtMB(file.size)}</div></div>
              <CheckCircle size={15} style={{ color: ERP.success }} />
              <ErpButton variant="ghost" size="sm" onClick={() => setFile(null)} icon={<X size={13} />} style={{ color: ERP.muted, padding: 4, minHeight: 0 }} />
            </div>
          )}
        </div>
        <ErpButton variant="primary" onClick={() => void submit()} disabled={busy || (live && !bookingSel)} style={{ width: "100%", backgroundColor: color, color: ERP.navy }}>Submit Invoice</ErpButton>
      </div>
      <div className="col-span-2 space-y-4">
        <Card>
          <CardHead title="Submitted Invoices" />
          {!demo && upState === "error"
            ? <div className="p-4"><ErrorState tone="light" onRetry={refreshUploads} /></div>
            : <ErpDataTable
                flush columns={invoiceCols} rows={upReady ? RECENT_INV : []} rowKey={(r) => r.id}
                loading={!demo && upState === "loading"}
                emptyTitle="No invoices submitted"
                emptyHint="Invoices you submit for review appear here."
              />}
        </Card>
        <div className="flex items-start gap-2.5 px-4 py-3.5 rounded-xl" style={{ backgroundColor: `${erpAlpha(color, 4)}`, border: `1px solid ${erpAlpha(color, 13)}` }}>
          <Info size={12} style={{ color }} className="mt-0.5 shrink-0" />
          <div className="text-[10px]" style={{ color: ERP.muted }}>
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
      <div className="mb-5"><h2 className="text-sm font-bold text-[color:var(--erp-text-strong)]">Statement — Supplier View</h2><p className="text-xs mt-0.5" style={{ color: ERP.muted }}>Running balance of booking settlements and platform fees</p></div>
      <div className="rounded-xl p-8" style={{ backgroundColor: ERP.surfaceSoft, border: `1px solid ${ERP.border}` }}>
        <EmptyState title="সাপ্লায়ার স্টেটমেন্ট" hint="এই মডিউল এখনও কনফিগার করা হয়নি। বুকিং, ভাউচার ও চালান অন্য ট্যাবে লাইভ।" />
      </div>
    </div>
  );
}

function PaymentsScreen(_p: { type: SupplierType; demo: boolean }) {
  return (
    <div className="p-7">
      <div className="mb-5"><h2 className="text-sm font-bold text-[color:var(--erp-text-strong)]">Payments &amp; Payouts</h2><p className="text-xs mt-0.5" style={{ color: ERP.muted }}>Disbursements and bank-settlement details</p></div>
      <div className="rounded-xl p-8" style={{ backgroundColor: ERP.surfaceSoft, border: `1px solid ${ERP.border}` }}>
        <EmptyState title="পেমেন্ট ও পেআউট" hint="এই মডিউল এখনও কনফিগার করা হয়নি।" />
      </div>
    </div>
  );
}

export default function SupplierPortal() {
  const { lang } = useLang();
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

  const screenLabel = SCREEN_LABELS[screen]
    ? (lang === "bn" ? SCREEN_LABELS[screen].bn : SCREEN_LABELS[screen].en)
    : screen;

  return (
    <ErpThemeProvider theme="ds"><ERPShell
      moduleId="supplier"
      moduleName={lang === "bn" ? "সাপ্লায়ার পোর্টাল" : "Supplier Portal"}
      moduleColor={color}
      moduleIcon={meta.icon}
      navItems={SUPPLIER_NAV}
      activeItem={screen}
      onItemClick={setScreen}
      breadcrumb={[companyName, screenLabel]}
      notificationCount={3}
      userName={companyName}
      userRole={`${lang === "bn" ? "সাপ্লায়ার" : "Supplier"} · ${companyCode}`}
    >
      <div className="flex flex-col h-full overflow-hidden" style={{ fontFamily: fontFor(lang) }}>
        <TypeSwitcher type={supType} onChange={(t) => { setSupType(t); setScreen("dashboard"); }} />
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: `${ERP.mutedSoft} transparent` }}>
          {content[screen]}
        </div>
      </div>
    </ERPShell></ErpThemeProvider>
  );
}
