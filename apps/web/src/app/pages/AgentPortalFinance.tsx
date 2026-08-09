import { useState, useEffect, useRef, type ReactNode } from "react";
import {
  Wallet, List, Upload, FileText, TrendingUp, Archive,
  CheckCircle, AlertCircle, ArrowUp, ArrowDown, Calendar,
  Download, Printer, Search, X, Check, Eye,
  MoreHorizontal, Plus, ChevronDown, LayoutGrid,
  Building, Bus, FileCheck, Plane, Info, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState, LoadingSkeleton, ErrorState } from "../components/States";
import {
  ERP, CAT, erpAlpha, ErpInput, ErpSelect, ErpField, ErpTabs, ErpBadge,
  ErpDataTable, type ErpColumn,
} from "../components/erp";
import { api, ApiError, getStoredUser, isLoggedIn } from "../lib/api";
import { useLang } from "../lib/LangContext";
import { fontFor } from "@tuba/shared";
import { downloadCsv } from "../lib/exportCsv";

const FIN   = CAT.green;   // Finance module accent (categorical, themed)

// Input surface style for the few raw <input>/<textarea> not on ErpInput.
const IS = { backgroundColor: ERP.surface, border: `1px solid ${ERP.border}`, color: ERP.navy } as const;

// ─── Mock data ────────────────────────────────────────────────────────────────

interface LedgerEntry {
  date: string; type: "credit" | "debit"; desc: string;
  ref: string; amount: number; balance: number;
}

// (prototype finance demo data removed - the agent portal is auth-guarded and live)

const DOC_COLORS: Record<string, string> = {
  invoice: ERP.destructive, receipt: FIN, hotel: CAT.blue,
  transport: CAT.orange, visa: CAT.teal, ticket: CAT.sky, other: CAT.slate,
};
const DOC_ICONS: Record<string, typeof FileText> = {
  invoice: FileText, receipt: CheckCircle, hotel: Building,
  transport: Bus, visa: FileCheck, ticket: Plane, other: Archive,
};

// ─── Live-data wiring (falls back to the frozen prototype data when logged out) ─

const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const errMsg = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);
const daysUntil = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);

// payment-slip type enum (backend: BANK_TRANSFER|CHEQUE|SADAD|WIRE|ONLINE_BANKING)
const SLIP_TYPE_LABEL: Record<string, string> = {
  BANK_TRANSFER: "Bank Transfer", CHEQUE: "Cheque", SADAD: "SADAD Payment", WIRE: "Wire Transfer", ONLINE_BANKING: "Online Banking",
};
const PAYMENT_TYPE_ENUM: Record<string, string> = {
  "Bank Transfer": "BANK_TRANSFER", "Cheque": "CHEQUE", "SADAD Payment": "SADAD", "Wire Transfer": "WIRE", "Online Banking": "ONLINE_BANKING",
};
const TOPUP_METHOD_ENUM: Record<string, string> = {
  "Al Rajhi Bank Transfer": "BANK_TRANSFER", "Alinma Bank Transfer": "BANK_TRANSFER", "Cheque": "CHEQUE",
};

interface ApiWallet { companyId: string; balance: number; currency: string; pendingCharges: number; afterPending: number; updatedAt: string }
interface ApiPending { ref: string; desc: string; amount: number; due: string; category: string }
interface ApiTxn { id: string; direction: "CREDIT" | "DEBIT"; amount: number; balanceAfter: number; description: string; refType: string | null; refId: string | null; createdAt: string }
interface ApiSlip { id: string; ref: string; date: string; type: string; amount: number; bank: string | null; transferRef: string | null; status: string }
interface ApiStmtEntry { id: string; date: string; description: string; ref: string | null; debit: number; credit: number; balance: number }
interface ApiStatement { openingBalance: number; totalDebits: number; totalCredits: number; closingBalance: number; entries: ApiStmtEntry[] }
interface ApiDoc { id: string; type: string; label: string; ref: string; amount: string | null; date: string; due: string | null; status: string; fileId: string | null; size: string }
interface DocRow { id: string; type: string; label: string; ref: string; amount: string | null; date: string; due: string | null; status: string; size: string; fileId: string | null }

// ─── Shared helpers ───────────────────────────────────────────────────────────

// Field label wrapper — shared ERP field label.
function FF({ label, children }: { label: string; children: ReactNode }) {
  return <ErpField label={label}>{children}</ErpField>;
}

// Thin adapters onto the shared ERP controls (string onChange; controlled or not).
function FInput({ placeholder, type = "text", defaultValue, value, onChange }: { placeholder?: string; type?: string; defaultValue?: string; value?: string; onChange?: (v: string) => void }) {
  const controlled = value !== undefined;
  return <ErpInput type={type} placeholder={placeholder} {...(controlled ? { value } : { defaultValue })} onChange={onChange ? (e) => onChange(e.target.value) : undefined} />;
}

function FSelect({ children, defaultValue, value, onChange }: { children: ReactNode; defaultValue?: string; value?: string; onChange?: (v: string) => void }) {
  const controlled = value !== undefined;
  return (
    <ErpSelect {...(controlled ? { value } : { defaultValue })} onChange={onChange ? (e) => onChange(e.target.value) : undefined}>
      {children}
    </ErpSelect>
  );
}

// Status pill — shared ErpBadge with a semantic theme colour.
function SBadge({ status }: { status: string }) {
  const M: Record<string, string> = {
    paid: ERP.success, confirmed: ERP.success, verified: ERP.success,
    pending: ERP.warning, processing: ERP.info, overdue: ERP.destructive,
  };
  const c = M[status] ?? ERP.warning;
  return <ErpBadge color={c} size="sm" dot>{status}</ErpBadge>;
}

function Amt({ value, type }: { value: number; type?: "credit" | "debit" | "neutral" }) {
  const color = type === "credit" ? ERP.success : type === "debit" ? ERP.destructive : ERP.navy;
  const prefix = type === "credit" ? "+" : type === "debit" ? "−" : "";
  return (
    <span className="font-semibold text-xs" style={{ color, fontFamily: ERP.font.data }}>
      {prefix}SAR {value.toLocaleString()}
    </span>
  );
}

// Surface wrapper (no auto-padding — screens control inner padding).
function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl ${className}`} style={{ backgroundColor: ERP.surface, border: `1px solid ${ERP.border}` }}>
      {children}
    </div>
  );
}

function CardHead({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: `1px solid ${ERP.border}`, backgroundColor: ERP.surface }}>
      <span className="text-xs font-bold" style={{ color: ERP.navy }}>{title}</span>
      {action}
    </div>
  );
}

// Category colour dot for pending charges — categorical theme accents.
function CatDot({ cat }: { cat: string }) {
  const map: Record<string, string> = { hotel: CAT.blue, visa: CAT.teal, transport: CAT.orange, catering: CAT.purple };
  return <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: map[cat] ?? CAT.slate }} />;
}

// ─── Wallet Screen ────────────────────────────────────────────────────────────

function WalletScreen() {
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [wallet, setWallet] = useState<ApiWallet | null>(null);
  const [pending, setPending] = useState<ApiPending[] | null>(null);

  // top-up form (submitted as a no-file payment slip → wallet credit on staff confirm)
  const [tuAmount, setTuAmount] = useState("");
  const [tuMethod, setTuMethod] = useState("Al Rajhi Bank Transfer");
  const [tuRef, setTuRef] = useState("");
  const [tuDate, setTuDate] = useState("2025-07-16");
  const [tuNotes, setTuNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const authed = isLoggedIn();
  const [wLoading, setWLoading] = useState(authed);
  const [wError, setWError] = useState(false);
  const [pLoading, setPLoading] = useState(authed);
  const [pError, setPError] = useState(false);
  const [slips, setSlips] = useState<ApiSlip[] | null>(null);
  const [sLoading, setSLoading] = useState(authed);
  const [sError, setSError] = useState(false);

  const refresh = () => {
    if (!isLoggedIn()) return;
    setWLoading(true); setWError(false);
    setPLoading(true); setPError(false);
    api.get<ApiWallet>("/agent-finance/wallet")
      .then((w) => { setWallet(w); setWError(false); })
      .catch(() => { setWallet(null); setWError(true); })
      .finally(() => setWLoading(false));
    api.get<ApiPending[]>("/agent-finance/wallet/pending")
      .then((p) => { setPending(p); setPError(false); })
      .catch(() => { setPending(null); setPError(true); })
      .finally(() => setPLoading(false));
    setSLoading(true); setSError(false);
    api.get<ApiSlip[]>("/agent-finance/payment-slips")
      .then((d) => { setSlips(d); setSError(false); })
      .catch(() => { setSlips(null); setSError(true); })
      .finally(() => setSLoading(false));
  };
  useEffect(() => {
    const t = setTimeout(refresh, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Signed in → only real figures (a failed fetch must never render demo money).
  const pendingRows = (pending ?? []).map((c) => ({ ref: c.ref, desc: c.desc, amount: c.amount, due: fmtDate(c.due), category: c.category, days: daysUntil(c.due) }));

  const balance     = wallet?.balance ?? 0;
  const pending_out = wallet?.pendingCharges ?? 0;
  const after       = wallet?.afterPending ?? 0;

  // Canonical state for the pending-charges card body.
  const pendingState = !authed ? null
    : pLoading ? <div className="px-5 py-2"><LoadingSkeleton tone="light" rows={3} /></div>
    : pError ? <div className="px-5 py-4"><ErrorState tone="light" onRetry={refresh} /></div>
    : pendingRows.length === 0 ? <EmptyState tone="light" title="No pending charges" hint="Confirmed service charges will appear here." />
    : null;

  const topupRows = (slips ?? []).slice(0, 5).map((sl) => ({ ref: sl.ref, date: fmtDate(sl.date), method: SLIP_TYPE_LABEL[sl.type] ?? sl.type, amount: sl.amount, status: sl.status }));
  const topupState: ReactNode = sLoading ? <LoadingSkeleton tone="light" rows={4} />
    : sError ? <ErrorState tone="light" onRetry={refresh} />
    : (slips ?? []).length === 0 ? <EmptyState tone="light" title="No top-ups yet" hint="Submitted top-up requests appear here." />
    : null;

  const submitTopUp = async () => {
    const amt = Number(tuAmount.replace(/[^\d.]/g, ""));
    if (!amt || amt <= 0) { toast.error("Enter a valid amount"); return; }
    setBusy(true);
    try {
      await api.post("/agent-finance/payment-slips", {
        type: TOPUP_METHOD_ENUM[tuMethod] ?? "BANK_TRANSFER",
        amount: amt,
        transferRef: tuRef || undefined,
        paymentDate: tuDate || undefined,
        notes: tuNotes || undefined,
      });
      toast.success("Top-up request submitted for review");
      setTopUpOpen(false);
      setTuAmount(""); setTuRef(""); setTuNotes("");
      refresh();
    } catch (e) {
      toast.error(errMsg(e, "Could not submit top-up"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-7 space-y-5">
      {/* Balance hero */}
      <div
        className="rounded-xl p-6 relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${erpAlpha(FIN, 13)} 0%, ${ERP.surfaceSoft} 100%)`, border: `1px solid ${erpAlpha(FIN, 21)}` }}
      >
        {/* Background orb */}
        <div className="absolute -right-12 -top-12 w-40 h-40 rounded-full" style={{ backgroundColor: `${erpAlpha(FIN, 7)}` }} />
        <div className="relative">
          <div className="text-[9px] font-bold uppercase tracking-[0.2em] mb-2" style={{ color: `${erpAlpha(FIN, 80)}` }}>Available Balance</div>
          {authed && wLoading ? (
            <div className="mb-4"><LoadingSkeleton tone="light" rows={2} /></div>
          ) : authed && wError ? (
            <div className="mb-4"><ErrorState tone="light" onRetry={refresh} /></div>
          ) : (
            <>
              <div className="flex items-end gap-2 mb-3">
                <span className="text-4xl font-bold text-[color:var(--erp-text-strong)]" style={{ fontFamily: "var(--font-mono)" }}>
                  SAR {balance.toLocaleString()}
                </span>
                <span className="text-sm mb-1.5" style={{ color: ERP.muted }}>.00</span>
              </div>
              <div className="flex items-center gap-4 text-[10px] mb-4" style={{ color: ERP.muted }}>
                <span>Pending charges: <span style={{ color: ERP.destructive }}>−SAR {pending_out.toLocaleString()}</span></span>
                <span>·</span>
                <span>After pending: <span style={{ color: after >= 0 ? ERP.success : ERP.destructive }}>SAR {after.toLocaleString()}</span></span>
              </div>
            </>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTopUpOpen(!topUpOpen)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold"
              style={{ backgroundColor: FIN, color: ERP.navy }}
            >
              <Plus size={13} /> Top Up Wallet
            </button>
            <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold" style={{ backgroundColor: ERP.surfaceSoft, color: ERP.muted }}>
              <Download size={13} /> Statement
            </button>
          </div>
        </div>
      </div>

      {/* Top-up form (collapsible) */}
      {topUpOpen && (
        <Card>
          <CardHead title="Request Wallet Top-up" action={<button onClick={() => setTopUpOpen(false)} style={{ color: ERP.muted }}><X size={13} /></button>} />
          <div className="p-5 grid grid-cols-3 gap-3">
            <FF label="Amount (SAR)"><FInput placeholder="e.g. 50,000" value={tuAmount} onChange={setTuAmount} /></FF>
            <FF label="Payment Method">
              <FSelect value={tuMethod} onChange={setTuMethod}><option>Al Rajhi Bank Transfer</option><option>Alinma Bank Transfer</option><option>Cheque</option></FSelect>
            </FF>
            <FF label="Transfer Reference"><FInput placeholder="TXN-XXXXXXXXXX" value={tuRef} onChange={setTuRef} /></FF>
            <FF label="Payment Date"><FInput type="date" value={tuDate} onChange={setTuDate} /></FF>
            <FF label="Notes (optional)"><FInput placeholder="Any remarks…" value={tuNotes} onChange={setTuNotes} /></FF>
            <div className="flex items-end">
              <button disabled={busy} onClick={() => void submitTopUp()} className="w-full py-2.5 rounded-xl text-xs font-bold disabled:opacity-50" style={{ backgroundColor: FIN, color: ERP.navy }}>Submit Top-up</button>
            </div>
          </div>
        </Card>
      )}

      {/* Two-column: pending + history */}
      <div className="grid grid-cols-2 gap-5">
        {/* Pending charges */}
        <Card>
          <CardHead title="Pending Charges" action={pendingState ? undefined : <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: erpAlpha(ERP.destructive, 8), color: ERP.destructive }}>{pendingRows.length} items</span>} />
          <div>
            {pendingState ?? (<>
            {pendingRows.map((c, i) => {
              const urgent = c.days <= 5;
              return (
                <div key={c.ref + i} className="flex items-start gap-3 px-5 py-3.5" style={{ borderBottom: i < pendingRows.length - 1 ? `1px solid ${ERP.border}` : undefined }}>
                  <CatDot cat={c.category} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-[color:var(--erp-text-strong)] truncate" title={c.desc}>{c.desc}</div>
                    <div className="flex items-center gap-2 mt-0.5 text-[9px]" style={{ color: ERP.muted }}>
                      <span className="truncate" style={{ fontFamily: "var(--font-mono)" }} title={c.ref}>{c.ref}</span>
                      <span className="shrink-0">· Due {c.due}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <Amt value={c.amount} type="debit" />
                    <div className="text-[9px] mt-0.5" style={{ color: urgent ? ERP.destructive : ERP.muted }}>
                      {urgent ? `⚠ ${c.days}d left` : `${c.days}d`}
                    </div>
                  </div>
                </div>
              );
            })}
            {/* Totals row */}
            <div className="flex justify-between px-5 py-3" style={{ backgroundColor: ERP.surfaceSoft, borderTop: `1px solid ${ERP.border}` }}>
              <span className="text-xs font-bold text-[color:var(--erp-text-strong)]">Total Pending</span>
              <Amt value={pending_out} type="debit" />
            </div>
            </>)}
          </div>
        </Card>

        {/* Top-up history */}
        <Card>
          <CardHead title="Top-up History" />
          {topupState ?? (
            <ErpDataTable
              flush
              rows={topupRows}
              rowKey={(t) => t.ref}
              columns={[
                { id: "date", header: "Date", cell: (t) => <span style={{ fontSize: ERP.text.size[10], color: ERP.muted }}>{t.date}</span> },
                { id: "ref", header: "Ref", cell: (t) => <span style={{ fontSize: ERP.text.size[9], color: FIN, fontFamily: ERP.font.data }}>{t.ref}</span> },
                { id: "method", header: "Method", cell: (t) => <span style={{ fontSize: ERP.text.size[10], color: ERP.navy }}>{t.method}</span> },
                { id: "amount", header: "Amount", align: "right", cell: (t) => <Amt value={t.amount} type="credit" /> },
                { id: "status", header: "Status", cell: (t) => <SBadge status={t.status} /> },
              ]}
            />
          )}
        </Card>
      </div>
    </div>
  );
}

// ─── Ledger Screen ────────────────────────────────────────────────────────────

function LedgerScreen() {
  const [typeFilter, setTypeFilter] = useState<"all" | "credit" | "debit">("all");
  const [q, setQ] = useState("");
  const [live, setLive] = useState<ApiTxn[] | null>(null);
  const authed = isLoggedIn();
  const [loading, setLoading] = useState(authed);
  const [error, setError] = useState(false);

  const refresh = () => {
    if (!isLoggedIn()) return;
    setLoading(true);
    setError(false);
    api.get<ApiTxn[]>("/agent-finance/wallet/transactions")
      .then((d) => { setLive(d); setError(false); })
      .catch(() => { setLive(null); setError(true); })
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    const t = setTimeout(refresh, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows: LedgerEntry[] = [...(live ?? [])]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .map((t) => ({
          date: fmtDate(t.createdAt),
          type: t.direction === "CREDIT" ? "credit" : "debit",
          desc: t.description,
          ref: t.refType && t.refId ? `${t.refType}/${t.refId}` : (t.refType || t.description),
          amount: t.amount,
          balance: t.balanceAfter,
        }));

  const shown = rows.filter((e) => {
    const mt = typeFilter === "all" || e.type === typeFilter;
    const mq = !q || e.desc.toLowerCase().includes(q.toLowerCase()) || e.ref.toLowerCase().includes(q.toLowerCase());
    return mt && mq;
  });

  const closing     = rows.length ? rows[0].balance : 0;
  const totalCredit = rows.filter(e => e.type === "credit").reduce((s, e) => s + e.amount, 0);
  const totalDebit  = rows.filter(e => e.type === "debit").reduce((s, e) => s + e.amount, 0);

  // Canonical state for the ledger table. The summary KPIs are suppressed while
  // loading/erroring so they can never present an unloaded "SAR 0" as a real balance.
  const unresolved = authed && (loading || error);
  const ledgerState = !authed ? null
    : loading ? <LoadingSkeleton tone="light" rows={6} />
    : error ? <ErrorState tone="light" onRetry={refresh} />
    : shown.length === 0 ? (
        <EmptyState
          tone="light"
          title={rows.length === 0 ? "No transactions yet" : "No matching entries"}
          hint={rows.length === 0 ? "Wallet credits and service charges will appear here." : "Try a different filter or search term."}
        />
      )
    : null;

  return (
    <div className="p-7">
      {/* Summary KPIs */}
      {!unresolved && (
      <div className="grid grid-cols-3 gap-4 mb-5">
        {[
          { label: "Closing Balance", value: `SAR ${closing.toLocaleString()}`, color: FIN,       icon: Wallet },
          { label: "Total Credits",   value: `SAR ${totalCredit.toLocaleString()}`,       color: ERP.success,  icon: ArrowUp },
          { label: "Total Debits",    value: `SAR ${totalDebit.toLocaleString()}`,         color: ERP.destructive,  icon: ArrowDown },
        ].map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="rounded-xl p-4 flex items-center gap-4" style={{ backgroundColor: ERP.surfaceSoft, border: `1px solid ${ERP.border}` }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${erpAlpha(k.color, 9)}` }}>
                <Icon size={16} style={{ color: k.color }} />
              </div>
              <div>
                <div className="text-sm font-bold text-[color:var(--erp-text-strong)]" style={{ fontFamily: "var(--font-mono)" }}>{k.value}</div>
                <div className="text-[10px] mt-0.5" style={{ color: ERP.muted }}>{k.label}</div>
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex gap-0.5 p-0.5 rounded-xl" style={{ backgroundColor: ERP.surfaceSoft, border: `1px solid ${ERP.border}` }}>
          {(["all", "credit", "debit"] as const).map((f) => (
            <button key={f} onClick={() => setTypeFilter(f)} className="px-3 py-1.5 rounded-lg text-xs font-semibold capitalize" style={typeFilter === f ? { backgroundColor: FIN, color: ERP.navy } : { color: ERP.muted }}>{f === "all" ? "All Entries" : f === "credit" ? "Credits" : "Debits"}</button>
          ))}
        </div>
        <div className="flex-1 relative">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: ERP.muted }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by description or reference…" className="w-full pl-8 pr-4 py-2 text-xs rounded-xl focus:outline-none" style={{ backgroundColor: ERP.surfaceSoft, border: `1px solid ${ERP.border}`, color: ERP.navy }} />
        </div>
        <button
          type="button"
          disabled={!shown.length}
          onClick={() => {
            downloadCsv(
              `wallet-ledger-${new Date().toISOString().slice(0, 10)}.csv`,
              ["Date", "Type", "Description", "Reference", "Amount", "Balance"],
              shown.map((e) => [e.date, e.type, e.desc, e.ref, e.amount, e.balance]),
            );
            toast.success("CSV downloaded");
          }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs disabled:opacity-50"
          style={{ border: `1px solid ${ERP.border}`, color: ERP.muted }}
        >
          <Download size={12} /> Export CSV
        </button>
      </div>

      {/* Ledger table */}
      {ledgerState ?? (
        <ErpDataTable
          rows={shown}
          rowKey={(e) => `${e.ref}-${e.date}-${e.balance}`}
          columns={[
            { id: "date", header: "Date", cell: (e) => <span className="whitespace-nowrap" style={{ fontSize: ERP.text.size[10], color: ERP.muted }}>{e.date}</span> },
            { id: "type", header: "Type", cell: (e) => { const col = e.type === "credit" ? ERP.success : ERP.destructive; return <span className="capitalize inline-block px-1.5 py-0.5 rounded-full" style={{ fontSize: ERP.text.size[9], fontWeight: ERP.text.weight.bold, backgroundColor: erpAlpha(col, 9), color: col }}>{e.type}</span>; } },
            { id: "desc", header: "Description", cell: (e) => <span className="max-w-[240px] truncate block" style={{ fontSize: ERP.text.size[12], color: ERP.navy }} title={e.desc}>{e.desc}</span> },
            { id: "ref", header: "Reference", cell: (e) => <span className="max-w-[160px] truncate block" style={{ fontSize: ERP.text.size[9], color: ERP.muted, fontFamily: ERP.font.data }} title={e.ref}>{e.ref}</span> },
            { id: "debit", header: "Debit", align: "right", cell: (e) => e.type === "debit" ? <Amt value={e.amount} type="debit" /> : <span style={{ fontSize: ERP.text.size[10], color: ERP.mutedSoft }}>—</span> },
            { id: "credit", header: "Credit", align: "right", cell: (e) => e.type === "credit" ? <Amt value={e.amount} type="credit" /> : <span style={{ fontSize: ERP.text.size[10], color: ERP.mutedSoft }}>—</span> },
            { id: "balance", header: "Balance", align: "right", cell: (e) => <span style={{ fontSize: ERP.text.size[12], fontWeight: ERP.text.weight.bold, color: e.balance >= 0 ? ERP.navy : ERP.destructive, fontFamily: ERP.font.data }}>SAR {e.balance.toLocaleString()}</span> },
          ]}
        />
      )}
    </div>
  );
}

// ─── Payment Slip Upload ──────────────────────────────────────────────────────

function PaymentSlipScreen() {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [slips, setSlips] = useState<ApiSlip[] | null>(null);

  // form fields
  const [slipType, setSlipType] = useState("Bank Transfer");
  const [amount, setAmount] = useState("");
  const [bank, setBank] = useState("Al Rajhi Bank");
  const [transferRef, setTransferRef] = useState("");
  const [paymentDate, setPaymentDate] = useState("2025-07-16");
  const [group, setGroup] = useState("");
  const [notes, setNotes] = useState("");

  const authed = isLoggedIn();
  const [loading, setLoading] = useState(authed);
  const [error, setError] = useState(false);
  const [groups, setGroups] = useState<{ id: string; code: string; name: string }[]>([]);

  const refresh = () => {
    if (!isLoggedIn()) return;
    setLoading(true);
    setError(false);
    api.get<{ id: string; code: string; name: string }[]>("/groups").then(setGroups).catch(() => setGroups([]));
    api.get<ApiSlip[]>("/agent-finance/payment-slips")
      .then((d) => { setSlips(d); setError(false); })
      .catch(() => { setSlips(null); setError(true); })
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    const t = setTimeout(refresh, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const uploads = (slips ?? []).map((s) => ({ ref: s.ref, date: fmtDate(s.date), type: SLIP_TYPE_LABEL[s.type] ?? s.type, amount: s.amount, status: s.status }));

  const uploadsState = !authed ? null
    : loading ? <LoadingSkeleton tone="light" rows={4} />
    : error ? <ErrorState tone="light" onRetry={refresh} />
    : uploads.length === 0 ? <EmptyState tone="light" title="No payment slips yet" hint="Submitted slips and their review status appear here." />
    : null;

  const submitSlip = async () => {
    if (!file) { toast.error("Attach a payment slip file first"); return; }
    const amt = Number(amount.replace(/[^\d.]/g, ""));
    if (!amt || amt <= 0) { toast.error("Enter a valid amount"); return; }
    setBusy(true);
    try {
      await api.uploadWithFields("/agent-finance/payment-slips", file, {
        type: PAYMENT_TYPE_ENUM[slipType] ?? "BANK_TRANSFER",
        amount: String(amt),
        bank,
        transferRef: transferRef || undefined,
        paymentDate: paymentDate || undefined,
        groupId: group || undefined,
        notes: notes || undefined,
      });
      toast.success("Payment slip submitted for review");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      setAmount(""); setTransferRef(""); setNotes("");
      refresh();
    } catch (e) {
      toast.error(errMsg(e, "Could not submit payment slip"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-7 grid grid-cols-5 gap-6">
      {/* Form */}
      <div className="col-span-3 space-y-4">
        <div>
          <h2 className="text-sm font-bold text-[color:var(--erp-text-strong)]">Payment Slip Upload</h2>
          <p className="text-xs mt-0.5" style={{ color: ERP.muted }}>Upload a bank transfer receipt or cheque scan to credit your wallet</p>
        </div>

        <div className="rounded-xl p-5 space-y-4" style={{ backgroundColor: ERP.surface, border: `1px solid ${ERP.border}` }}>
          <div className="grid grid-cols-2 gap-3">
            <FF label="Payment Type">
              <FSelect value={slipType} onChange={setSlipType}>
                {["Bank Transfer","Cheque","SADAD Payment","Wire Transfer","Online Banking"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </FSelect>
            </FF>
            <FF label="Amount (SAR)"><FInput placeholder="e.g. 50,000.00" value={amount} onChange={setAmount} /></FF>
            <FF label="Bank / Source"><FSelect value={bank} onChange={setBank}><option>Al Rajhi Bank</option><option>Alinma Bank</option><option>SNB</option><option>Riyad Bank</option></FSelect></FF>
            <FF label="Transfer Reference"><FInput placeholder="TXN-XXXXXXXXXX" value={transferRef} onChange={setTransferRef} /></FF>
            <FF label="Payment Date"><FInput type="date" value={paymentDate} onChange={setPaymentDate} /></FF>
            <FF label="Group (optional)">
              <FSelect value={group} onChange={setGroup}>
                <option value="">— Not group-specific —</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.code} — {g.name}</option>)}
              </FSelect>
            </FF>
            <div className="col-span-2">
              <FF label="Notes (optional)"><FInput placeholder="Any remarks for the finance team…" value={notes} onChange={setNotes} /></FF>
            </div>
          </div>
        </div>

        {/* File Upload */}
        <div className="rounded-xl p-5 space-y-3" style={{ backgroundColor: ERP.surface, border: `1px solid ${ERP.border}` }}>
          <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: ERP.muted }}>Attach Payment Slip</div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {!file ? (
            <div
              onClick={() => fileRef.current?.click()}
              className="flex flex-col items-center gap-3 p-6 rounded-xl cursor-pointer transition-all"
              style={{ border: `2px dashed ${erpAlpha(FIN, 21)}`, backgroundColor: `${erpAlpha(FIN, 2)}` }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${erpAlpha(FIN, 9)}` }}>
                <Upload size={18} style={{ color: FIN }} />
              </div>
              <div className="text-center">
                <div className="text-xs font-semibold text-[color:var(--erp-text-strong)]">Drop slip image or PDF here</div>
                <div className="text-[10px] mt-0.5" style={{ color: ERP.muted }}>JPG, PNG, PDF · Max 10 MB</div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ backgroundColor: `${erpAlpha(FIN, 6)}`, border: `1px solid ${erpAlpha(FIN, 19)}` }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: erpAlpha(ERP.success, 9) }}>
                <FileText size={14} style={{ color: ERP.success }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-[color:var(--erp-text-strong)] truncate">{file.name}</div>
                <div className="text-[10px]" style={{ color: ERP.muted }}>Attached · {(file.size / 1024 / 1024).toFixed(1)} MB</div>
              </div>
              <CheckCircle size={15} style={{ color: ERP.success }} />
              <button onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ""; }} style={{ color: ERP.muted }}><X size={13} /></button>
            </div>
          )}
        </div>

        <button disabled={busy} onClick={() => void submitSlip()} className="w-full py-3 rounded-xl text-xs font-bold disabled:opacity-50" style={{ backgroundColor: FIN, color: ERP.navy }}>
          Submit Payment Slip
        </button>
      </div>

      {/* Right: recent uploads */}
      <div className="col-span-2">
        <Card>
          <CardHead title="Recent Uploads" />
          {uploadsState ?? (
            <ErpDataTable
              flush
              rows={uploads}
              rowKey={(r) => r.ref}
              columns={[
                { id: "ref", header: "Ref", cell: (r) => <span style={{ fontSize: ERP.text.size[9], color: FIN, fontFamily: ERP.font.data }}>{r.ref}</span> },
                { id: "date", header: "Date", cell: (r) => <span style={{ fontSize: ERP.text.size[10], color: ERP.muted }}>{r.date}</span> },
                { id: "type", header: "Type", cell: (r) => <span style={{ fontSize: ERP.text.size[10], color: ERP.navy }}>{r.type}</span> },
                { id: "amount", header: "Amount", align: "right", cell: (r) => <Amt value={r.amount} type="credit" /> },
                { id: "status", header: "Status", cell: (r) => <SBadge status={r.status} /> },
              ]}
            />
          )}
        </Card>

        {/* Info box */}
        <div className="flex items-start gap-2.5 px-4 py-3.5 rounded-xl mt-4" style={{ backgroundColor: `${erpAlpha(FIN, 4)}`, border: `1px solid ${erpAlpha(FIN, 15)}` }}>
          <Info size={13} style={{ color: FIN }} className="mt-0.5 shrink-0" />
          <div className="text-[10px]" style={{ color: ERP.muted }}>
            Payment slips are reviewed within 1–2 business days. Wallet balance updates automatically once confirmed by the finance team.
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Statements Screen ────────────────────────────────────────────────────────

function StatementsScreen() {
  const [generated, setGenerated] = useState(false);
  const [stmt, setStmt] = useState<ApiStatement | null>(null);

  const authed = isLoggedIn();
  const [loading, setLoading] = useState(authed);
  const [error, setError] = useState(false);

  const load = () => {
    if (!isLoggedIn()) return;
    setLoading(true);
    setError(false);
    api.get<ApiStatement>("/agent-finance/statement")
      .then((d) => { setStmt(d); setError(false); })
      .catch(() => { setStmt(null); setError(true); })
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generate = () => { setGenerated(true); load(); };

  const statRows = (stmt?.entries ?? []).map((e) => ({ date: fmtDate(e.date), desc: e.description, ref: e.ref ?? "—", debit: e.debit, credit: e.credit, balance: e.balance })).slice(0, 8);

  const opening      = stmt?.openingBalance ?? 0;
  const totalCredits = stmt?.totalCredits ?? 0;
  const closing      = stmt?.closingBalance ?? 0;

  // Signed-in identity for the statement letterhead (the frozen prototype name is
  // demo-only copy and must not appear on a real tenant's statement).
  const stmtParty = [getStoredUser()?.company?.name, getStoredUser()?.company?.code].filter(Boolean).join(" · ") || "—";

  const stmtState = !authed ? null
    : loading ? <LoadingSkeleton tone="light" rows={6} />
    : error ? <ErrorState tone="light" onRetry={load} />
    : statRows.length === 0 ? <EmptyState tone="light" title="No transactions in this period" hint="Adjust the date range and generate again." />
    : null;

  return (
    <div className="p-7 grid grid-cols-5 gap-6">
      {/* Filters */}
      <div className="col-span-2 space-y-4">
        <div>
          <h2 className="text-sm font-bold text-[color:var(--erp-text-strong)]">Generate Statement</h2>
          <p className="text-xs mt-0.5" style={{ color: ERP.muted }}>Export a period statement for your records or for submission</p>
        </div>
        <div className="rounded-xl p-5 space-y-4" style={{ backgroundColor: ERP.surface, border: `1px solid ${ERP.border}` }}>
          <FF label="Date From"><FInput type="date" defaultValue="2025-01-01" /></FF>
          <FF label="Date To"><FInput type="date" defaultValue="2025-07-16" /></FF>
          <FF label="Statement Type">
            <FSelect>
              <option>Full Statement</option>
              <option>Summary Only</option>
              <option>Credits Only</option>
              <option>Debits Only</option>
            </FSelect>
          </FF>
          <FF label="Group Filter">
            <FSelect>
              <option value="">All Groups</option>
            </FSelect>
          </FF>
          <FF label="Currency"><FSelect><option>SAR — Saudi Riyal</option><option>USD — US Dollar</option></FSelect></FF>
          <button onClick={generate} disabled={authed && loading} className="w-full py-3 rounded-xl text-xs font-bold disabled:opacity-50" style={{ backgroundColor: FIN, color: ERP.navy }}>
            Generate Statement
          </button>
        </div>
      </div>

      {/* Preview + download */}
      <div className="col-span-3 space-y-4">
        {!generated ? (
          <div className="flex flex-col items-center justify-center h-64 text-center" style={{ border: `2px dashed ${ERP.border}`, borderRadius: ERP.radius.lg }}>
            <FileText size={28} style={{ color: ERP.mutedSoft, marginBottom: ERP.space[3] }} />
            <div className="text-xs font-semibold" style={{ color: ERP.muted }}>Set date range and click Generate</div>
          </div>
        ) : (
          <div>
            {/* Statement header */}
            <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${erpAlpha(FIN, 19)}` }}>
              <div className="px-5 py-4 flex items-center justify-between" style={{ backgroundColor: `${erpAlpha(FIN, 7)}` }}>
                <div className="min-w-0">
                  <div className="text-[9px] font-bold uppercase tracking-widest mb-0.5" style={{ color: FIN }}>TUBA AL HIJAZ · AGENT STATEMENT</div>
                  <div className="text-sm font-bold text-[color:var(--erp-text-strong)] truncate" title={stmtParty}>{stmtParty}</div>
                  <div className="text-[10px] mt-0.5" style={{ color: ERP.muted }}>Period: 01 Jan 2025 – 16 Jul 2025</div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold"
                    style={{ backgroundColor: `${erpAlpha(FIN, 13)}`, color: FIN }}
                    title="Print / Save as PDF"
                  >
                    <Download size={12} /> PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const all = (stmt?.entries ?? []).map((e) => ({
                        date: fmtDate(e.date), desc: e.description, ref: e.ref ?? "—",
                        debit: e.debit, credit: e.credit, balance: e.balance,
                      }));
                      downloadCsv(
                        `agent-statement-${new Date().toISOString().slice(0, 10)}.csv`,
                        ["Date", "Description", "Ref", "Debit", "Credit", "Balance"],
                        all.map((e) => [e.date, e.desc, e.ref, e.debit, e.credit, e.balance]),
                      );
                      toast.success("Statement CSV downloaded");
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold"
                    style={{ backgroundColor: ERP.surfaceSoft, color: ERP.muted }}
                  >
                    <Download size={12} /> Excel
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: ERP.surfaceSoft, color: ERP.muted }}
                  >
                    <Printer size={14} />
                  </button>
                </div>
              </div>
              {stmtState ? <div className="px-5 py-4">{stmtState}</div> : (<>
              {/* Summary row */}
              <div className="grid grid-cols-3 px-5 py-3 gap-4" style={{ backgroundColor: ERP.surface, borderBottom: `1px solid ${ERP.border}` }}>
                {[
                  { label: "Opening Balance", value: `SAR ${opening.toLocaleString()}`,      color: ERP.muted },
                  { label: "Total Credits",    value: `SAR ${totalCredits.toLocaleString()}`, color: ERP.success },
                  { label: "Closing Balance",  value: `SAR ${closing.toLocaleString()}`,  color: FIN },
                ].map((s) => (
                  <div key={s.label}>
                    <div className="text-[9px]" style={{ color: ERP.muted }}>{s.label}</div>
                    <div className="text-sm font-bold mt-0.5" style={{ color: s.color, fontFamily: "var(--font-mono)" }}>{s.value}</div>
                  </div>
                ))}
              </div>
              {/* Transactions preview */}
              <ErpDataTable
                flush
                rows={statRows}
                rowKey={(e) => `${e.ref}-${e.date}-${e.balance}`}
                columns={[
                  { id: "date", header: "Date", cell: (e) => <span style={{ fontSize: ERP.text.size[10], color: ERP.muted }}>{e.date}</span> },
                  { id: "desc", header: "Description", cell: (e) => <span className="max-w-[180px] truncate block" style={{ fontSize: ERP.text.size[10], color: ERP.navy }} title={e.desc}>{e.desc}</span> },
                  { id: "ref", header: "Ref", cell: (e) => <span className="max-w-[140px] truncate block" style={{ fontSize: ERP.text.size[9], color: ERP.muted, fontFamily: ERP.font.data }} title={e.ref}>{e.ref}</span> },
                  { id: "debit", header: "Debit", align: "right", cell: (e) => e.debit > 0 ? <Amt value={e.debit} type="debit" /> : <span style={{ color: ERP.mutedSoft }}>—</span> },
                  { id: "credit", header: "Credit", align: "right", cell: (e) => e.credit > 0 ? <Amt value={e.credit} type="credit" /> : <span style={{ color: ERP.mutedSoft }}>—</span> },
                  { id: "balance", header: "Balance", align: "right", cell: (e) => <span style={{ fontSize: ERP.text.size[10], fontWeight: ERP.text.weight.bold, color: ERP.navy, fontFamily: ERP.font.data }}>SAR {e.balance.toLocaleString()}</span> },
                ]}
              />
              <div className="px-5 py-2 text-[9px] text-center" style={{ backgroundColor: ERP.surface, color: ERP.mutedSoft, borderTop: `1px solid ${ERP.border}` }}>
                Showing first 8 transactions · Full statement available in downloaded PDF
              </div>
              </>)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Reports Screen ───────────────────────────────────────────────────────────

function ReportsScreen() {
  return (
    <div className="p-7">
      <div className="mb-5">
        <h2 className="text-sm font-bold text-[color:var(--erp-text-strong)]">Reports</h2>
        <p className="text-xs mt-0.5" style={{ color: ERP.muted }}>Generate, filter, and export financial reports</p>
      </div>
      <div className="rounded-xl p-8" style={{ backgroundColor: ERP.surfaceSoft, border: `1px solid ${ERP.border}` }}>
        <EmptyState
          title="আর্থিক রিপোর্ট"
          hint="এই মডিউল এখনও কনফিগার করা হয়নি। ওয়ালেট, লেজার ও স্টেটমেন্ট অন্য ট্যাবে লাইভ।"
        />
      </div>
    </div>
  );
}

// ─── Documents Hub ────────────────────────────────────────────────────────────

function DocumentsScreen() {
  const [docType, setDocType] = useState("all");
  const [view, setView] = useState<"list" | "grid">("list");
  const [q, setQ] = useState("");
  const [live, setLive] = useState<ApiDoc[] | null>(null);

  const authed = isLoggedIn();
  const [loading, setLoading] = useState(authed);
  const [error, setError] = useState(false);

  const refresh = () => {
    if (!isLoggedIn()) return;
    setLoading(true);
    setError(false);
    api.get<ApiDoc[]>("/agent-finance/documents")
      .then((d) => { setLive(d); setError(false); })
      .catch(() => { setLive(null); setError(true); })
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    const t = setTimeout(refresh, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const docs: DocRow[] = (live ?? []).map((d) => ({ id: d.id, type: d.type, label: d.label, ref: d.ref, amount: d.amount, date: fmtDate(d.date), due: d.due ? fmtDate(d.due) : null, status: d.status, size: d.size, fileId: d.fileId }));

  const openDoc = async (fileId: string) => {
    try {
      const url = await api.fileBlobUrl(fileId);
      window.open(url, "_blank");
    } catch (e) {
      toast.error(errMsg(e, "Could not open document"));
    }
  };

  const ALL_TYPES = ["all", "invoice", "receipt", "hotel", "transport", "visa", "ticket", "other"];
  const TYPE_LABELS: Record<string, string> = {
    all: "All", invoice: "Invoice", receipt: "Receipt", hotel: "Hotel Voucher",
    transport: "Transport Voucher", visa: "Visa", ticket: "Ticket", other: "Other",
  };

  const filtered = docs.filter((d) => {
    const mt = docType === "all" || d.type === docType;
    const mq = !q || d.label.toLowerCase().includes(q.toLowerCase()) || d.ref.toLowerCase().includes(q.toLowerCase());
    return mt && mq;
  });

  const docsState = !authed ? null
    : loading ? <LoadingSkeleton tone="light" rows={5} />
    : error ? <ErrorState tone="light" onRetry={refresh} />
    : filtered.length === 0 ? (
        <EmptyState
          tone="light"
          title={docs.length === 0 ? "No documents yet" : "No matching documents"}
          hint={docs.length === 0 ? "Invoices, receipts and vouchers appear here as services are confirmed." : "Try a different filter or search term."}
        />
      )
    : null;

  const StatusDot = ({ status }: { status: string }) => {
    const c = status === "paid" || status === "confirmed" || status === "verified" ? ERP.success : status === "pending" ? ERP.warning : status === "processing" ? ERP.info : ERP.destructive;
    return <span className="inline-flex items-center gap-1 text-[9px] font-bold" style={{ color: c }}><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c }} />{status}</span>;
  };

  return (
    <div className="p-7">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-sm font-bold text-[color:var(--erp-text-strong)]">Documents Hub</h2>
          <p className="text-xs mt-0.5" style={{ color: ERP.muted }}>All financial and service documents in one place</p>
        </div>
        <button className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold" style={{ backgroundColor: FIN, color: ERP.navy }}>
          <Plus size={12} /> Upload Document
        </button>
      </div>

      {/* Filter chips + search + view toggle */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {ALL_TYPES.map((t) => {
          const count = t === "all" ? docs.length : docs.filter((d) => d.type === t).length;
          const color = DOC_COLORS[t] ?? ERP.muted;
          const active = docType === t;
          return (
            <button
              key={t}
              onClick={() => setDocType(t)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all"
              style={active ? { backgroundColor: color, color: ERP.navy } : { backgroundColor: `${erpAlpha(color, 8)}`, color, border: `1px solid ${erpAlpha(color, 19)}` }}
            >
              {TYPE_LABELS[t]}
              <span className="text-[8px] opacity-70">{count}</span>
            </button>
          );
        })}
        <div className="flex-1 min-w-[180px] relative ml-auto">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: ERP.muted }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="w-full pl-8 pr-4 py-2 text-xs rounded-xl focus:outline-none" style={{ backgroundColor: ERP.surfaceSoft, border: `1px solid ${ERP.border}`, color: ERP.navy }} />
        </div>
        {/* View toggle */}
        <div className="flex gap-0.5 p-0.5 rounded-lg" style={{ backgroundColor: ERP.surfaceSoft, border: `1px solid ${ERP.border}` }}>
          {([["list", List], ["grid", LayoutGrid]] as const).map(([v, Icon]) => (
            <button key={v} onClick={() => setView(v)} className="w-7 h-7 rounded-md flex items-center justify-center" style={{ backgroundColor: view === v ? FIN : "transparent" }}>
              <Icon size={12} style={{ color: view === v ? "white" : ERP.muted }} />
            </button>
          ))}
        </div>
      </div>

      {/* List view */}
      {view === "list" && (docsState ?? (
          <ErpDataTable
            rows={filtered}
            rowKey={(doc) => doc.id}
            columns={[
              { id: "doc", header: "Document", cell: (doc) => { const DIcon = DOC_ICONS[doc.type] ?? FileText; const c = DOC_COLORS[doc.type] ?? CAT.slate; return (<div className="flex items-center gap-2.5"><div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: erpAlpha(c, 9) }}><DIcon size={12} style={{ color: c }} /></div><div className="min-w-0"><div className="font-semibold text-[color:var(--erp-text-strong)] leading-tight truncate" style={{ fontSize: ERP.text.size[12] }} title={doc.label}>{doc.label}</div><div style={{ fontSize: ERP.text.size[9], color: ERP.muted }}>{doc.size}</div></div></div>); } },
              { id: "type", header: "Type", cell: (doc) => { const c = DOC_COLORS[doc.type] ?? CAT.slate; return <span className="capitalize inline-block px-1.5 py-0.5 rounded-full" style={{ fontSize: ERP.text.size[9], fontWeight: ERP.text.weight.bold, backgroundColor: erpAlpha(c, 9), color: c }}>{TYPE_LABELS[doc.type]}</span>; } },
              { id: "ref", header: "Reference", cell: (doc) => <span className="max-w-[140px] truncate block" style={{ fontSize: ERP.text.size[9], color: ERP.muted, fontFamily: ERP.font.data }} title={doc.ref}>{doc.ref}</span> },
              { id: "amount", header: "Amount", cell: (doc) => doc.amount ? <span style={{ fontSize: ERP.text.size[12], fontWeight: ERP.text.weight.semibold, color: ERP.navy, fontFamily: ERP.font.data }}>{doc.amount}</span> : <span style={{ fontSize: ERP.text.size[10], color: ERP.mutedSoft }}>—</span> },
              { id: "date", header: "Date", cell: (doc) => <span style={{ fontSize: ERP.text.size[10], color: ERP.muted }}>{doc.date}</span> },
              { id: "due", header: "Due / Expiry", cell: (doc) => doc.due ? <span style={{ fontSize: ERP.text.size[9], fontWeight: ERP.text.weight.bold, color: ERP.warning }}>{doc.due}</span> : <span style={{ fontSize: ERP.text.size[10], color: ERP.mutedSoft }}>—</span> },
              { id: "status", header: "Status", cell: (doc) => <StatusDot status={doc.status} /> },
              { id: "actions", header: "", align: "right", cell: (doc) => <div className="flex gap-1 justify-end"><button onClick={() => doc.fileId && void openDoc(doc.fileId)} className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-white/8" style={{ color: ERP.muted }}><Eye size={11} /></button><button onClick={() => doc.fileId && void openDoc(doc.fileId)} className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-white/8" style={{ color: ERP.muted }}><Download size={11} /></button></div> },
            ]}
          />
        ))}

      {/* Grid view */}
      {view === "grid" && (docsState ?? (
        <div className="grid grid-cols-4 gap-4">
          {filtered.map((doc) => {
            const DIcon = DOC_ICONS[doc.type] ?? FileText;
            const c     = DOC_COLORS[doc.type] ?? CAT.slate;
            return (
              <div key={doc.id} className="rounded-xl p-4 flex flex-col gap-3 transition-all hover:scale-[1.01]" style={{ backgroundColor: ERP.surface, border: `1px solid ${ERP.border}` }}>
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${erpAlpha(c, 9)}` }}><DIcon size={18} style={{ color: c }} /></div>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full capitalize" style={{ backgroundColor: `${erpAlpha(c, 9)}`, color: c }}>{TYPE_LABELS[doc.type]}</span>
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[color:var(--erp-text-strong)] mb-0.5 leading-snug" title={doc.label}>{doc.label}</div>
                  <div className="text-[9px] truncate" style={{ color: ERP.muted, fontFamily: "var(--font-mono)" }} title={doc.ref}>{doc.ref}</div>
                </div>
                {doc.amount && <div className="text-sm font-bold" style={{ color: c, fontFamily: "var(--font-mono)" }}>{doc.amount}</div>}
                <div className="flex items-center justify-between mt-auto">
                  <StatusDot status={doc.status} />
                  <span className="text-[9px]" style={{ color: ERP.mutedSoft }}>{doc.size}</span>
                </div>
                <div className="flex gap-1.5 pt-2" style={{ borderTop: `1px solid ${ERP.border}` }}>
                  <button onClick={() => doc.fileId && void openDoc(doc.fileId)} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[9px] font-semibold" style={{ backgroundColor: `${erpAlpha(c, 9)}`, color: c }}><Eye size={10} /> View</button>
                  <button onClick={() => doc.fileId && void openDoc(doc.fileId)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ border: `1px solid ${ERP.border}`, color: ERP.muted }}><Download size={10} /></button>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ─── Finance Module: tab router ───────────────────────────────────────────────

type FinTab = "wallet" | "ledger" | "payment" | "statements" | "reports" | "documents";

const FIN_TABS: { id: FinTab; labelEn: string; labelBn: string; icon: typeof Wallet }[] = [
  { id: "wallet",     labelEn: "Wallet",       labelBn: "ওয়ালেট",     icon: Wallet     },
  { id: "ledger",     labelEn: "Ledger",       labelBn: "লেজার",       icon: List       },
  { id: "payment",    labelEn: "Payment Slip", labelBn: "পেমেন্ট স্লিপ", icon: Upload     },
  { id: "statements", labelEn: "Statements",   labelBn: "স্টেটমেন্ট",  icon: FileText   },
  { id: "reports",    labelEn: "Reports",      labelBn: "রিপোর্ট",     icon: TrendingUp },
  { id: "documents",  labelEn: "Documents",    labelBn: "নথি",         icon: Archive    },
];

export function FinanceModule() {
  const { lang } = useLang();
  const [tab, setTab] = useState<FinTab>("wallet");

  const screens: Record<FinTab, ReactNode> = {
    wallet:     <WalletScreen />,
    ledger:     <LedgerScreen />,
    payment:    <PaymentSlipScreen />,
    statements: <StatementsScreen />,
    reports:    <ReportsScreen />,
    documents:  <DocumentsScreen />,
  };

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ fontFamily: fontFor(lang) }}>
      <div className="px-4 sm:px-7 pt-4 shrink-0">
        <ErpTabs
          ariaLabel={lang === "bn" ? "পেমেন্ট" : "Payments"}
          active={tab}
          onChange={(id) => setTab(id as FinTab)}
          tabs={FIN_TABS.map((t) => ({
            id: t.id,
            label: lang === "bn" ? t.labelBn : t.labelEn,
            icon: t.icon,
            accent: FIN,
          }))}
        />
      </div>

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: `${ERP.mutedSoft} transparent` }}>
        {screens[tab]}
      </div>
    </div>
  );
}
