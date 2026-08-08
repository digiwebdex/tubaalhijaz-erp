import { useState, useEffect, useCallback, type ReactNode, type CSSProperties } from "react";
import {
  FileCheck, Building2, Bus, UtensilsCrossed, DollarSign,
  ShoppingCart, Users, MessageCircle, Clock, AlertTriangle,
  CheckCircle, XCircle, Check, ChevronRight, Search, Plus,
  Download, AlertCircle, MoreHorizontal, ExternalLink, Eye,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { ERPShell, type NavItem, type IconFC } from "../components/ERPShell";
import { EmptyState, LoadingSkeleton, ErrorState } from "../components/States";
import {
  ErpPageTemplate, ErpButton, ErpSearchBar, ErpFilterPanel, ErpDataTable,
  ErpPagination, ErpDrawer, ErpDrawerFooterActions, ErpForm, ErpFormRow, ErpField,
  ErpInput, ErpSelect, ErpStatusChip, erpToast, type ErpColumn, type ErpStatusKind,
} from "../components/erp";
import { ERP, CAT, erpAlpha, ErpThemeProvider } from "../components/erp";
import { api, isLoggedIn, getStoredUser } from "../lib/api";
import { useLang } from "../lib/LangContext";
import { fontFor } from "@tuba/shared";

// ─── Department config ────────────────────────────────────────────────────────

type DeptId = "visa"|"hotel"|"transport"|"catering"|"finance"|"procurement"|"hr"|"crm";

const C: Record<DeptId, string> = {
  visa:        CAT.teal,
  hotel:       ERP.info,
  transport:   CAT.orange,
  catering:    CAT.purple,
  finance:     ERP.success,
  procurement: ERP.warning,
  hr:          CAT.purple,
  crm:         CAT.sky,
};

const DEPT_ICONS: Record<DeptId, IconFC> = {
  visa:        FileCheck     as IconFC,
  hotel:       Building2     as IconFC,
  transport:   Bus           as IconFC,
  catering:    UtensilsCrossed as IconFC,
  finance:     DollarSign    as IconFC,
  procurement: ShoppingCart  as IconFC,
  hr:          Users         as IconFC,
  crm:         MessageCircle as IconFC,
};

const DEPT_NAV: NavItem[] = [
  { id:"visa",        label:"Visa",         icon: FileCheck      as IconFC },
  { id:"hotel",       label:"Hotel",        icon: Building2      as IconFC },
  { id:"transport",   label:"Transport",    icon: Bus            as IconFC },
  { id:"catering",    label:"Catering",     icon: UtensilsCrossed as IconFC },
  { id:"finance",     label:"Finance",      icon: DollarSign     as IconFC },
  // Procurement / HR / CRM have no backend — removed from production nav.
];

// ─── Live data types, colours & helpers ───────────────────────────────────────
// Only the fields the /services and /finance APIs actually return are modelled
// here. No embassy / agent / passport-count / rate-breakdown fields — those are
// NOT in the response and are never fabricated.

type SvcStatus =
  | "REQUESTED" | "ASSIGNED" | "CONFIRMED" | "VOUCHER_ISSUED"
  | "COMPLETED" | "REJECTED" | "CANCELLED";

interface SvcGroup { id:string; code:string; name:string; paxCount:number }
interface SvcRow {
  id: string;
  code: string;
  status: string;
  createdAt: string;
  group: SvcGroup | null;
  supplier?: { id:string; code:string; name:string } | null;
  hotel?: { id:string; name:string; stars:number } | null;
  voucher?: { id:string; code:string; status:string; fileId:string|null } | null;
}

interface ApiInvoice {
  id:string; code:string; tenant:string; group:string|null;
  issueDate:string; dueDate:string; total:number; status:string; fileId:string|null;
}

// Static config — service-request state machine colours (real Prisma enum).
const SVC_STATUS_C: Record<string,string> = {
  REQUESTED:ERP.info, ASSIGNED:ERP.warning, CONFIRMED:ERP.success,
  VOUCHER_ISSUED:CAT.teal, COMPLETED:ERP.success, REJECTED:ERP.destructive, CANCELLED:ERP.muted,
};
// Static config — invoice status colours (real InvoiceStatus enum).
const INV_STATUS_C: Record<string,string> = {
  DRAFT:ERP.muted, OUTSTANDING:ERP.warning, PAID:ERP.success, OVERDUE:ERP.destructive, CANCELLED:ERP.muted,
};

const isActive = (s:string) => s !== "COMPLETED" && s !== "CANCELLED" && s !== "REJECTED";

const hoursSince = (iso?:string|null) =>
  iso ? Math.max(0, (Date.now() - new Date(iso).getTime()) / 3_600_000) : 0;

function fmtDate(iso?:string|null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-GB", { day:"2-digit", month:"short" });
}

// Signed-in-only queue fetch — this page lives behind RequireAuth, so there is no
// signed-out demo: a failed request shows the error state, never mock data.
function useQueue<T>(path:string) {
  const [data, setData]       = useState<T[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);
  const [nonce, setNonce]     = useState(0);
  const reload = () => setNonce((n) => n + 1);

  useEffect(() => {
    if (!isLoggedIn()) { setData([]); setLoading(false); setError(false); return; }
    let cancelled = false;
    setLoading(true); setError(false);
    api.get<T[]>(path)
      .then((v) => { if (!cancelled) { setData(v ?? []); setError(false); } })
      .catch(() => { if (!cancelled) { setData(null); setError(true); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [path, nonce]);

  return { data, loading, error, reload };
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function SLABar({ hoursAgo, slaHours, compact }: { hoursAgo:number; slaHours:number; compact?:boolean }) {
  const remaining  = slaHours - hoursAgo;
  const pct        = Math.max(0, Math.min(100, (remaining / slaHours) * 100));
  const overdue    = remaining < 0;
  const barColor   = pct > 60 ? ERP.success : pct > 30 ? ERP.warning : pct > 0 ? CAT.orange : ERP.destructive;
  const label      = overdue ? `${Math.round(-remaining)}h overdue` : `${Math.round(remaining)}h left`;
  return (
    <div>
      {!compact && (
        <div className="flex justify-between text-[9px] mb-1">
          <span style={{ color:ERP.muted }}>SLA · {slaHours}h target</span>
          <span style={{ color:barColor }}>{label}</span>
        </div>
      )}
      <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor:ERP.surfaceSoft }}>
        <div className="h-full rounded-full" style={{ width:`${pct}%`, backgroundColor:barColor }} />
      </div>
      {compact && <div className="text-[9px] mt-0.5" style={{ color:barColor }}>{label}</div>}
    </div>
  );
}

function Chip({ label, color }: { label:string; color:string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide shrink-0"
          style={{ backgroundColor:`${erpAlpha(color, 9)}`, color }}>
      {label.replace("_"," ")}
    </span>
  );
}

const IS: CSSProperties = { backgroundColor:ERP.surfaceSoft, border:`1px solid ${ERP.border}`, color:ERP.navy };

function QCard({ id, title, sub, status, statusColor, hoursAgo, slaHours, selected, color, onClick }:
  { id:string; title:string; sub:string; status:string; statusColor:string; hoursAgo:number; slaHours:number; selected:boolean; color:string; onClick():void }) {
  return (
    <button onClick={onClick} className="w-full text-left p-3.5 rounded-xl transition-all"
      style={{ border:`1px solid ${selected ? color : ERP.mutedSoft}`, backgroundColor: selected ? `${erpAlpha(color, 4)}` : ERP.surfaceSoft }}>
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="text-[9px] font-black truncate min-w-0" style={{ color, fontFamily:"var(--font-mono)" }}>{id}</span>
        <Chip label={status} color={statusColor} />
      </div>
      <div className="text-xs font-semibold text-[color:var(--erp-text-strong)] truncate mb-0.5">{title}</div>
      <div className="text-[10px] mb-2.5 truncate" style={{ color:ERP.muted }}>{sub}</div>
      <SLABar hoursAgo={hoursAgo} slaHours={slaHours} />
    </button>
  );
}

function DetailRow({ label, value, mono }: { label:string; value:ReactNode; mono?:boolean }) {
  return (
    <div className="px-4 py-3 min-w-0" style={{ borderBottom:`1px solid ${ERP.border}` }}>
      <div className="text-[9px] font-black uppercase tracking-widest mb-0.5" style={{ color:ERP.muted }}>{label}</div>
      <div className={`text-xs font-semibold text-[color:var(--erp-text-strong)] truncate${mono?" font-mono":""}`} style={mono?{fontFamily:"var(--font-mono)"}:{}}>{value}</div>
    </div>
  );
}

function ActionBtn({ label, color, icon: Icon, onClick }: { label:string; color?:string; icon?:typeof Check; onClick?():void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold transition-all whitespace-nowrap"
      style={{ backgroundColor: color ? `${erpAlpha(color, 9)}` : ERP.surfaceSoft, color: color ?? ERP.muted, border:`1px solid ${color ? color+"30" : ERP.mutedSoft}` }}>
      {Icon && <Icon size={11} />}{label}
    </button>
  );
}

function QueuePanel({ color, children }: { color:string; children:ReactNode }) {
  const [q, setQ] = useState("");
  return (
    <div className="col-span-2 flex flex-col overflow-hidden" style={{ borderRight:`1px solid ${ERP.border}` }}>
      <div className="px-4 py-3 shrink-0" style={{ borderBottom:`1px solid ${ERP.border}` }}>
        <div className="relative">
          <Search size={11} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color:ERP.muted }} />
          <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Search queue…"
            className="w-full pl-8 pr-3 py-2 rounded-xl text-[10px] focus:outline-none"
            style={IS} />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2" style={{ scrollbarWidth:"none" }}>
        {children}
      </div>
    </div>
  );
}

function KPIStrip({ items }: { items: { label:string; value:number|string; color:string; icon:typeof Clock }[] }) {
  return (
    <div className="grid grid-cols-4 gap-3 px-6 py-4 shrink-0" style={{ borderBottom:`1px solid ${ERP.border}`, backgroundColor:ERP.surface }}>
      {items.map((k) => {
        const Icon = k.icon;
        return (
          <div key={k.label} className="flex items-center gap-3 px-3 py-2 rounded-xl" style={{ backgroundColor:ERP.surface, border:`1px solid ${ERP.border}` }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor:`${erpAlpha(k.color, 9)}` }}>
              <Icon size={13} style={{ color:k.color }} />
            </div>
            <div>
              <div className="text-base font-black text-[color:var(--erp-text-strong)]" style={{ fontFamily:"var(--font-mono)" }}>{k.value}</div>
              <div className="text-[9px]" style={{ color:ERP.muted }}>{k.label}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Full-height frame that hosts a loading / error / empty state for a desk. */
function DeskFrame({ children }: { children:ReactNode }) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto px-6 py-8">{children}</div>
    </div>
  );
}

// ─── Ops state-machine transitions ────────────────────────────────────────────
// Mirror of the backend SERVICE_TRANSITIONS map (static config, not data). Ops
// staff advance the pipeline via PATCH /services/:service/:id/status { status }.

const SVC_TRANSITIONS: Record<string, SvcStatus[]> = {
  REQUESTED:      ["ASSIGNED", "CANCELLED"],
  ASSIGNED:       ["CONFIRMED", "REJECTED", "CANCELLED"],
  CONFIRMED:      ["VOUCHER_ISSUED", "COMPLETED", "CANCELLED"],
  VOUCHER_ISSUED: ["COMPLETED", "CANCELLED"],
  REJECTED:       ["ASSIGNED", "CANCELLED"],
  COMPLETED:      [],
  CANCELLED:      [],
};

const ACTION_META: Record<string, { label:string; color:string; icon:typeof Check }> = {
  ASSIGNED:       { label:"Mark Assigned",  color:ERP.warning, icon:ChevronRight },
  CONFIRMED:      { label:"Confirm",        color:ERP.success, icon:CheckCircle },
  VOUCHER_ISSUED: { label:"Issue Voucher",  color:ERP.accent, icon:Download },
  COMPLETED:      { label:"Mark Completed", color:ERP.success, icon:Check },
  REJECTED:       { label:"Reject",         color:ERP.destructive, icon:XCircle },
  CANCELLED:      { label:"Cancel Request", color:ERP.destructive, icon:AlertCircle },
};

function TransitionActions({ service, row, onDone }: { service:string; row:SvcRow; onDone():void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const next = SVC_TRANSITIONS[row.status] ?? [];

  const run = async (status:string) => {
    let reason: string | undefined;
    if (status === "REJECTED") {
      reason = window.prompt("Reason for rejection (required):")?.trim() || undefined;
      if (!reason) return;
    }
    setBusy(status);
    try {
      await api.patch(`/services/${service}/${row.id}/status`, { status, ...(reason ? { reason } : {}) });
      toast.success(`${row.code} → ${status.replace("_"," ").toLowerCase()}`);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update status");
    } finally {
      setBusy(null);
    }
  };

  if (!next.length) {
    return (
      <span className="text-[10px]" style={{ color:ERP.muted }}>
        No further actions — request is {row.status.replace("_"," ").toLowerCase()}.
      </span>
    );
  }
  return (
    <>
      {next.map((s) => {
        const m = ACTION_META[s];
        return <ActionBtn key={s} label={busy === s ? "Working…" : m.label} color={m.color} icon={m.icon} onClick={() => run(s)} />;
      })}
    </>
  );
}

// ─── VISA DESK (T002-02 Mutamer worklist) ─────────────────────────────────────
// Primary: GET /ops/visa/mutamers (Passenger SoT). Batch VisaRequest queue remains
// available as a secondary view. No pipeline processing (T002-03).

type DeskVisaState =
  | "NEW" | "MOFA" | "EMBASSY" | "BIOMETRIC" | "SUBMITTED" | "PROCESSING"
  | "ISSUED" | "REJECTED" | "PASSPORT_RETURNED" | "COMPLETED" | "REJECTED_CLOSED";

interface MutamerDeskRow {
  id: string;
  code: string;
  name: string;
  passportNo: string;
  biometricStatus: string | null;
  visaNumber: string | null;
  mofaNumber: string | null;
  visaStatus: string;
  visaStatusLabel: string | null;
  visaPipelineStatus?: DeskVisaState;
  visaState: DeskVisaState;
  visaRejectReason?: string | null;
  allowedNext?: DeskVisaState[];
  updatedAt: string;
  assignedOfficer: string | null;
  dueDate: string | null;
  embassy: string | null;
  embassyRef?: string | null;
  embassySubmittedAt?: string | null;
  passportReturnedAt?: string | null;
  longStayHost?: {
    id: string;
    code: string;
    hostName: string | null;
    hostWhatsapp: string | null;
    hostIqama: string | null;
    absher: string | null;
    hostComplete: boolean;
    /** T002-08 — derived Day-85 compliance view (read-only). */
    day85?: {
      stage: string;
      dayCount: number | null;
      dueAt: string | null;
      redCard: boolean;
      resolved: boolean;
      notifiedAt: string | null;
    } | null;
  } | null;
  priority: string | null;
  visaRequest: { id: string; code: string; status: string } | null;
  group: {
    id: string;
    code: string;
    name: string;
    visaType: string;
    nusukGroupNumber: string | null;
    consulate: string | null;
    departDate: string | null;
    gateVisa?: boolean;
    umrahCompanyId: string | null;
    umrahCompany: { id: string; code: string; name: string } | null;
  };
}

interface MutamerDeskPage {
  items: MutamerDeskRow[];
  total: number;
  page: number;
  pageSize: number;
  counts: Record<string, number>;
  sop?: { requirePassportReturn: boolean; flag: string };
  mofaCompleteness?: {
    issuedTotal: number;
    issuedWithMofa: number;
    percent: number;
    note?: string;
  };
}

interface UmrahCoOpt { id: string; code: string; name: string }

const VISA_STATE_C: Record<string, string> = {
  NEW: ERP.info,
  MOFA: CAT.sky,
  EMBASSY: CAT.purple,
  BIOMETRIC: ERP.warning,
  SUBMITTED: ERP.info,
  PROCESSING: ERP.warning,
  ISSUED: ERP.success,
  REJECTED: ERP.destructive,
  PASSPORT_RETURNED: ERP.success,
  COMPLETED: CAT.teal,
  REJECTED_CLOSED: ERP.muted,
};

function fmtWhen(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

const PIPELINE_STEPS: DeskVisaState[] = [
  "NEW", "MOFA", "EMBASSY", "BIOMETRIC", "SUBMITTED", "PROCESSING",
  "ISSUED", "PASSPORT_RETURNED", "COMPLETED",
];

function visaStateKind(state: string): ErpStatusKind {
  if (state === "ISSUED" || state === "PASSPORT_RETURNED" || state === "COMPLETED") return "approved";
  if (state === "REJECTED" || state === "REJECTED_CLOSED") return "rejected";
  if (state === "BIOMETRIC" || state === "PROCESSING") return "warning";
  if (state === "NEW" || state === "MOFA" || state === "EMBASSY" || state === "SUBMITTED") return "info";
  return "pending";
}

function VisaPipelineChips({ current, lang }: { current: string; lang: "bn" | "en" }) {
  const rejected = current === "REJECTED" || current === "REJECTED_CLOSED";
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {PIPELINE_STEPS.map((step, i) => {
        const idx = PIPELINE_STEPS.indexOf(current as DeskVisaState);
        const active = step === current;
        const done = !rejected && idx >= 0 && i < idx;
        return (
          <span key={step} className="inline-flex items-center gap-1">
            {i > 0 && <ChevronRight size={10} style={{ color: ERP.border }} />}
            <ErpStatusChip
              status={active ? visaStateKind(step) : done ? "completed" : "pending"}
              label={step.replace(/_/g, " ")}
              lang={lang}
            />
          </span>
        );
      })}
      {rejected && (
        <ErpStatusChip status="rejected" label={current.replace(/_/g, " ")} lang={lang} />
      )}
    </div>
  );
}

function VisaDesk() {
  const color = C.visa;
  const { lang } = useLang();
  const [mode, setMode] = useState<"mutamers" | "batches">("mutamers");

  if (mode === "batches") {
    return (
      <div className="flex flex-col h-full overflow-hidden" style={{ fontFamily: fontFor(lang) }}>
        <div className="flex flex-wrap items-center gap-2 px-6 py-3 shrink-0" style={{ borderBottom: `1px solid ${ERP.border}`, backgroundColor: ERP.surface }}>
          <ErpButton size="sm" variant="outline" onClick={() => setMode("mutamers")}>
            {lang === "bn" ? "মুতামির বোর্ড" : "Mutamer Board"}
          </ErpButton>
          <ErpButton size="sm" variant="primary">{lang === "bn" ? "ব্যাচ অনুরোধ" : "Batch Requests"}</ErpButton>
          <span className="text-[10px] ml-1" style={{ color: ERP.muted }}>
            {lang === "bn" ? "VisaRequest এনভেলপ কিউ" : "VisaRequest envelope queue (batch status only)"}
          </span>
        </div>
        <VisaBatchDesk />
      </div>
    );
  }

  return <MutamerVisaBoard color={color} onShowBatches={() => setMode("batches")} />;
}

function MutamerVisaDrawer({
  row,
  open,
  onClose,
  onReload,
  onShowBatches,
  requirePassportReturn,
}: {
  row: MutamerDeskRow | null;
  open: boolean;
  onClose: () => void;
  onReload: () => void;
  onShowBatches: () => void;
  requirePassportReturn?: boolean;
}) {
  const { lang } = useLang();
  const color = C.visa;
  const [tab, setTab] = useState<"summary" | "pipeline" | "details">("summary");
  const [mofaNumber, setMofaNumber] = useState("");
  const [visaNumber, setVisaNumber] = useState("");
  const [embassyRef, setEmbassyRef] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!row) return;
    setMofaNumber(row.mofaNumber ?? "");
    setVisaNumber(row.visaNumber ?? "");
    setEmbassyRef(row.embassyRef ?? row.embassy ?? "");
    setRejectReason("");
    setTab("summary");
  }, [row]);

  const saveMofa = async () => {
    if (!row) return;
    const mofa = mofaNumber.trim();
    if (!mofa) {
      erpToast.error(lang === "bn" ? "MOFA নম্বর প্রয়োজন" : "MOFA Number is required to complete MOFA information", lang);
      return;
    }
    setBusy(true);
    try {
      await api.post(`/passengers/${row.id}/visa-transition`, {
        to: row.visaPipelineStatus || row.visaState,
        mofaNumber: mofa,
        completeMofa: true,
      });
      erpToast.success(lang === "bn" ? `${row.code} — MOFA সংরক্ষিত` : `MOFA No saved for ${row.code}`, lang);
      onClose();
      onReload();
    } catch (e) {
      erpToast.error(e instanceof Error ? e.message : (lang === "bn" ? "MOFA আপডেট ব্যর্থ" : "MOFA update failed"), lang);
    } finally {
      setBusy(false);
    }
  };

  const runTransition = async (next: DeskVisaState) => {
    if (!row) return;
    const body: Record<string, unknown> = { to: next };
    if (next === "REJECTED") {
      const reason = rejectReason.trim();
      if (!reason) {
        erpToast.error(lang === "bn" ? "প্রত্যাখ্যানের কারণ লিখুন" : "Rejection reason is required", lang);
        setTab("pipeline");
        return;
      }
      body.reason = reason;
    }
    if (next === "ISSUED") {
      const vn = visaNumber.trim();
      if (!vn) {
        erpToast.error(lang === "bn" ? "ভিসা নম্বর প্রয়োজন" : "Visa Number is required", lang);
        setTab("details");
        return;
      }
      body.visaNumber = vn;
    }
    if (next === "EMBASSY") {
      const ref = embassyRef.trim();
      if (ref) body.embassyRef = ref;
      if (!ref && !row.embassy && !row.embassyRef) {
        erpToast.error(lang === "bn" ? "Embassy বা embassyRef প্রয়োজন" : "Embassy context or embassyRef is required", lang);
        setTab("details");
        return;
      }
    }
    if (next === "BIOMETRIC" && !row.biometricStatus) {
      body.biometricStatus = "Registered";
    }
    if (next === "PASSPORT_RETURNED") {
      if (!window.confirm(lang === "bn"
        ? "পাসপোর্ট এজেন্ট/তুবা কাস্টডিতে ফেরত নিশ্চিত?"
        : "Confirm passport returned to Agent/Tuba custody?")) return;
      body.custodyConfirmed = true;
    }
    setBusy(true);
    try {
      const res = await api.post<{
        to: string;
        gateAssist?: { suggestGateVisa: boolean; ready: number; total: number };
      }>(`/passengers/${row.id}/visa-transition`, body);
      erpToast.success(`${row.code} → ${res.to}`, lang);
      if (res.gateAssist?.suggestGateVisa) {
        erpToast.info(
          lang === "bn"
            ? `${res.gateAssist.ready}/${res.gateAssist.total} ISSUED+ — ${row.group.code}-এ gateVisa বিবেচনা করুন`
            : `${res.gateAssist.ready}/${res.gateAssist.total} mutamers ISSUED+ — consider flipping gateVisa on ${row.group.code}`,
        );
      }
      onClose();
      onReload();
    } catch (e) {
      erpToast.error(e instanceof Error ? e.message : (lang === "bn" ? "ট্রানজিশন ব্যর্থ" : "Transition failed"), lang);
    } finally {
      setBusy(false);
    }
  };

  const tabs = (
    <div className="flex flex-wrap gap-1">
      {([
        ["summary", lang === "bn" ? "সারাংশ" : "Summary"],
        ["pipeline", lang === "bn" ? "পাইপলাইন" : "Pipeline"],
        ["details", lang === "bn" ? "বিবরণ" : "Details"],
      ] as const).map(([id, label]) => (
        <ErpButton key={id} size="sm" variant={tab === id ? "primary" : "ghost"} onClick={() => setTab(id)}>
          {label}
        </ErpButton>
      ))}
    </div>
  );

  return (
    <ErpDrawer
      open={open && !!row}
      onClose={onClose}
      title={row?.name ?? (lang === "bn" ? "যাত্রীর বিবরণ" : "Passenger")}
      subtitle={row ? `${row.code} · ${row.passportNo}` : undefined}
      lang={lang}
      maxWidth={720}
      tabs={tabs}
      footer={
        <ErpDrawerFooterActions
          lang={lang}
          onCancel={onClose}
          onSave={saveMofa}
          saving={busy}
          saveLabel={lang === "bn" ? "MOFA সংরক্ষণ" : "Save MOFA No"}
        />
      }
    >
      {row && tab === "summary" && (
        <div className="space-y-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: ERP.muted }}>
              {lang === "bn" ? "যাত্রী সারাংশ" : "Passenger Summary"}
            </div>
            <dl className="space-y-2 text-sm">
              {[
                [lang === "bn" ? "গ্রুপ" : "Group", `${row.group.code} · ${row.group.name}`],
                ["Nusuk", row.group.nusukGroupNumber ?? "—"],
                [lang === "bn" ? "ভিসার ধরন" : "Visa Type", row.group.visaType.replace(/_/g, " ")],
                ["Umrah Co", row.group.umrahCompany?.name ?? "—"],
                [lang === "bn" ? "অগ্রাধিকার" : "Priority", row.priority ?? "—"],
                [lang === "bn" ? "স্ট্যাটাস" : "State", row.visaState.replace(/_/g, " ")],
                [lang === "bn" ? "লেবেল" : "Label", row.visaStatusLabel ?? "—"],
              ].map(([k, v]) => (
                <div key={String(k)} className="flex justify-between gap-3 py-1.5" style={{ borderBottom: `1px solid ${ERP.border}` }}>
                  <dt style={{ color: ERP.muted }}>{k}</dt>
                  <dd className="font-semibold text-[color:var(--erp-text-strong)] text-right">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: ERP.muted }}>
              {lang === "bn" ? "পাসপোর্ট" : "Passport"}
            </div>
            <dl className="space-y-2 text-sm">
              {[
                [lang === "bn" ? "নম্বর" : "Number", row.passportNo],
                ["Biometric", row.biometricStatus ?? "—"],
                [lang === "bn" ? "ফেরত" : "Returned", row.passportReturnedAt ? fmtWhen(row.passportReturnedAt) : "—"],
              ].map(([k, v]) => (
                <div key={String(k)} className="flex justify-between gap-3 py-1.5" style={{ borderBottom: `1px solid ${ERP.border}` }}>
                  <dt style={{ color: ERP.muted }}>{k}</dt>
                  <dd className="font-semibold font-mono text-[color:var(--erp-text-strong)]">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="flex flex-wrap gap-2">
            <ErpButton size="sm" variant="outline" icon={<ExternalLink size={13} />} onClick={() => { window.location.href = "/ops-control"; }}>
              {lang === "bn" ? "গ্রুপ খুলুন" : "Open Group"}
            </ErpButton>
            {row.visaRequest && (
              <ErpButton
                size="sm"
                variant="outline"
                icon={<FileCheck size={13} />}
                onClick={() => {
                  erpToast.info(`${row.visaRequest!.code} · ${row.visaRequest!.status}`);
                  onShowBatches();
                }}
              >
                {lang === "bn" ? "ভিসা রিকোয়েস্ট" : "Open Visa Request"}
              </ErpButton>
            )}
          </div>
        </div>
      )}

      {row && tab === "pipeline" && (
        <div className="space-y-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: ERP.muted }}>
              {lang === "bn" ? "ভিসা পাইপলাইন" : "Visa Pipeline"}
            </div>
            <VisaPipelineChips current={row.visaState} lang={lang} />
          </div>
          <ErpForm columns={1}>
            <ErpField label={lang === "bn" ? "প্রত্যাখ্যানের কারণ" : "Rejection reason"} hint={lang === "bn" ? "REJECTED-এ যাওয়ার আগে" : "Required before → REJECTED"}>
              <ErpInput value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
            </ErpField>
          </ErpForm>
          <div className="flex flex-wrap gap-2">
            {(row.allowedNext ?? []).map((next) => (
              <ErpButton
                key={next}
                size="sm"
                variant={next === "REJECTED" ? "danger" : "secondary"}
                icon={<ChevronRight size={13} />}
                disabled={busy}
                onClick={() => runTransition(next)}
              >
                → {next.replace(/_/g, " ")}
              </ErpButton>
            ))}
          </div>
          <p className="text-[10px]" style={{ color: ERP.muted }}>
            {lang === "bn"
              ? "শুধু অনুমোদিত ট্রানজিশন। অবৈধ এজ প্রত্যাখ্যাত ও অডিট হয়।"
              : "Allowed transitions only. Invalid edges are rejected and audited."}
          </p>
          {requirePassportReturn && (
            <p className="text-[10px] px-3 py-2 rounded-lg" style={{ backgroundColor: "erpAlpha(ERP.warning, 8)", color: ERP.warning }}>
              SOP: passport return required before COMPLETED (VISA_REQUIRE_PASSPORT_RETURN).
            </p>
          )}
        </div>
      )}

      {row && tab === "details" && (
        <div className="space-y-5">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: ERP.muted }}>MOFA</div>
            <ErpForm columns={1}>
              <ErpField label={lang === "bn" ? "MOFA নম্বর" : "MOFA Number"} hint={lang === "bn" ? "পরিচয় — বিল ফাইন্যান্সে" : "Identity only — bill is Finance MOFA Processing"}>
                <ErpInput value={mofaNumber} onChange={(e) => setMofaNumber(e.target.value)} style={{ fontFamily: "var(--font-mono)" }} />
              </ErpField>
            </ErpForm>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: ERP.muted }}>
              {lang === "bn" ? "এম্বাসি" : "Embassy"}
            </div>
            <ErpForm columns={1}>
              <ErpField label={lang === "bn" ? "এম্বাসি" : "Embassy"}>
                <ErpInput value={row.embassy ?? ""} readOnly />
              </ErpField>
              <ErpField label={lang === "bn" ? "এম্বাসি রেফ" : "Embassy Ref"}>
                <ErpInput value={embassyRef} onChange={(e) => setEmbassyRef(e.target.value)} style={{ fontFamily: "var(--font-mono)" }} />
              </ErpField>
              <ErpField label={lang === "bn" ? "ভিসা নম্বর" : "Visa Number"}>
                <ErpInput value={visaNumber} onChange={(e) => setVisaNumber(e.target.value)} style={{ fontFamily: "var(--font-mono)" }} />
              </ErpField>
            </ErpForm>
            <p className="text-[11px] mt-2" style={{ color: ERP.muted }}>
              {lang === "bn" ? "জমা" : "Submitted"}: {row.embassySubmittedAt ? fmtWhen(row.embassySubmittedAt) : "—"}
            </p>
          </div>
          {row.group.visaType === "LONG_STAY" && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: ERP.muted }}>
                {lang === "bn" ? "লং স্টে (শুধু দেখা)" : "Long Stay (read-only)"}
              </div>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-3 py-1.5" style={{ borderBottom: `1px solid ${ERP.border}` }}>
                  <dt style={{ color: ERP.muted }}>Host</dt>
                  <dd className="font-semibold text-right text-[color:var(--erp-text-strong)]">
                    {row.longStayHost
                      ? `${row.longStayHost.hostName ?? "—"} · ${row.longStayHost.hostComplete ? "complete" : "incomplete"}`
                      : (lang === "bn" ? "রেকর্ড নেই — Ops → Long Stay" : "No LongStay record — Ops Control → Long Stay")}
                  </dd>
                </div>
                <div className="flex justify-between gap-3 py-1.5" style={{ borderBottom: `1px solid ${ERP.border}` }}>
                  <dt style={{ color: ERP.muted }}>WhatsApp</dt>
                  <dd className="font-mono text-[color:var(--erp-text-strong)]">{row.longStayHost?.hostWhatsapp ?? "—"}</dd>
                </div>
                <div className="flex justify-between gap-3 py-1.5" style={{ borderBottom: `1px solid ${ERP.border}` }}>
                  <dt style={{ color: ERP.muted }}>Absher</dt>
                  <dd className="font-semibold text-[color:var(--erp-text-strong)]">{row.longStayHost?.absher ?? "—"}</dd>
                </div>
                <div className="flex justify-between gap-3 py-1.5" style={{ borderBottom: `1px solid ${ERP.border}` }}>
                  <dt style={{ color: ERP.muted }}>Day-85</dt>
                  <dd className="font-semibold text-[color:var(--erp-text-strong)]">
                    {!row.longStayHost?.day85 || row.longStayHost.day85.stage === "NOT_TRACKED"
                      ? "—"
                      : `day ${row.longStayHost.day85.dayCount ?? 0} · ${row.longStayHost.day85.stage}${row.longStayHost.day85.redCard ? " · RED" : ""}`}
                  </dd>
                </div>
              </dl>
              {row.longStayHost?.day85?.redCard && (
                <p className="text-[10px] mt-2 px-3 py-2 rounded-lg" style={{ backgroundColor: erpAlpha(ERP.destructive, 8), color: ERP.destructive }}>
                  Day-85 red card — resolve in Ops Control → Long Stay.
                </p>
              )}
            </div>
          )}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: ERP.muted }}>
              {lang === "bn" ? "ইতিহাস" : "History"}
            </div>
            <dl className="space-y-2 text-sm">
              {[
                [lang === "bn" ? "আপডেট" : "Updated", fmtWhen(row.updatedAt)],
                [lang === "bn" ? "প্রস্থান (ডিউ)" : "Due (depart)", fmtDate(row.dueDate)],
                [lang === "bn" ? "এম্বাসি জমা" : "Embassy submitted", row.embassySubmittedAt ? fmtWhen(row.embassySubmittedAt) : "—"],
                [lang === "bn" ? "পাসপোর্ট ফেরত" : "Passport returned", row.passportReturnedAt ? fmtWhen(row.passportReturnedAt) : "—"],
                [lang === "bn" ? "অফিসার" : "Officer", row.assignedOfficer ?? "—"],
                ["Visa Request", row.visaRequest?.code ?? "—"],
              ].map(([k, v]) => (
                <div key={String(k)} className="flex justify-between gap-3 py-1.5" style={{ borderBottom: `1px solid ${ERP.border}` }}>
                  <dt style={{ color: ERP.muted }}>{k}</dt>
                  <dd className="font-semibold text-[color:var(--erp-text-strong)]">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}
    </ErpDrawer>
  );
}

function MutamerVisaBoard({ color, onShowBatches }: { color: string; onShowBatches: () => void }) {
  const { lang } = useLang();
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [visaState, setVisaState] = useState<string>("ALL");
  const [embassy, setEmbassy] = useState("");
  const [visaType, setVisaType] = useState("");
  const [umrahCompanyId, setUmrahCompanyId] = useState("");
  const [priority, setPriority] = useState("");
  const [arriving7, setArriving7] = useState(false);
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [umrahCos, setUmrahCos] = useState<UmrahCoOpt[]>([]);
  const [data, setData] = useState<MutamerDeskPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [sel, setSel] = useState<MutamerDeskRow | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (!isLoggedIn()) return;
    api.get<UmrahCoOpt[]>("/services/umrah-companies")
      .then(setUmrahCos)
      .catch(() => setUmrahCos([]));
  }, []);

  const load = useCallback(() => {
    if (!isLoggedIn()) { setData({ items: [], total: 0, page: 1, pageSize, counts: {} }); setLoading(false); return; }
    setLoading(true); setError(false);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    if (visaState && visaState !== "ALL") params.set("visaState", visaState);
    if (embassy.trim()) params.set("embassy", embassy.trim());
    if (visaType) params.set("visaType", visaType);
    if (umrahCompanyId) params.set("umrahCompanyId", umrahCompanyId);
    if (priority) params.set("priority", priority);
    if (arriving7) params.set("arrivingWithinDays", "7");
    if (qDebounced) params.set("q", qDebounced);
    api.get<MutamerDeskPage>(`/ops/visa/mutamers?${params}`)
      .then((v) => { setData(v); setError(false); })
      .catch(() => { setData(null); setError(true); })
      .finally(() => setLoading(false));
  }, [page, pageSize, visaState, embassy, visaType, umrahCompanyId, priority, arriving7, qDebounced]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [visaState, embassy, visaType, umrahCompanyId, priority, arriving7, qDebounced]);

  const counts = data?.counts ?? {};
  const rows = data?.items ?? [];
  const total = data?.total ?? 0;

  const filterActive =
    (embassy.trim() ? 1 : 0) +
    (visaType ? 1 : 0) +
    (umrahCompanyId ? 1 : 0) +
    (priority ? 1 : 0) +
    (arriving7 ? 1 : 0);

  /** Existing API counts only — no new calculations. */
  const summary = [
    { id: "NEW", labelBn: "আজকের পেন্ডিং", labelEn: "Today's Pending", value: counts.NEW ?? 0 },
    { id: "MOFA", labelBn: "MOFA", labelEn: "MOFA", value: counts.MOFA ?? 0 },
    { id: "EMBASSY", labelBn: "এম্বাসি", labelEn: "Embassy", value: counts.EMBASSY ?? 0 },
    { id: "PASSPORT_RETURNED", labelBn: "পাসপোর্ট", labelEn: "Passport", value: counts.PASSPORT_RETURNED ?? 0 },
    { id: "ISSUED", labelBn: "ইস্যুড", labelEn: "Issued", value: counts.ISSUED ?? 0 },
    { id: "REJECTED", labelBn: "প্রত্যাখ্যাত", labelEn: "Rejected", value: counts.REJECTED ?? 0 },
  ];

  const quickFilters: { id: string; label: string }[] = [
    { id: "ALL", label: lang === "bn" ? `সব (${counts.ALL ?? 0})` : `All (${counts.ALL ?? 0})` },
    { id: "NEW", label: `New (${counts.NEW ?? 0})` },
    { id: "MOFA", label: `MOFA (${counts.MOFA ?? 0})` },
    { id: "EMBASSY", label: `Embassy (${counts.EMBASSY ?? 0})` },
    { id: "BIOMETRIC", label: `Biometric (${counts.BIOMETRIC ?? 0})` },
    { id: "SUBMITTED", label: `Submitted (${counts.SUBMITTED ?? 0})` },
    { id: "PROCESSING", label: `Processing (${counts.PROCESSING ?? 0})` },
    { id: "ISSUED", label: `Issued (${counts.ISSUED ?? 0})` },
    { id: "REJECTED", label: `Rejected (${counts.REJECTED ?? 0})` },
    { id: "PASSPORT_RETURNED", label: `Passport (${counts.PASSPORT_RETURNED ?? 0})` },
    { id: "COMPLETED", label: `Done (${counts.COMPLETED ?? 0})` },
  ];

  const columns: ErpColumn<MutamerDeskRow>[] = [
    {
      id: "group",
      header: lang === "bn" ? "গ্রুপ" : "Group",
      cell: (r) => (
        <div>
          <div className="text-[11px] font-semibold" style={{ fontFamily: "var(--font-mono)", color }}>{r.group.code}</div>
          <div className="text-[10px] truncate max-w-[120px]" style={{ color: ERP.muted }}>{r.group.name}</div>
        </div>
      ),
    },
    {
      id: "pax",
      header: lang === "bn" ? "যাত্রী" : "Passenger",
      cell: (r) => (
        <div>
          <div className="text-xs font-semibold text-[color:var(--erp-text-strong)] truncate max-w-[140px]" title={r.name}>{r.name}</div>
          <div className="text-[10px] font-mono" style={{ color: ERP.muted }}>{r.passportNo}</div>
        </div>
      ),
    },
    {
      id: "type",
      header: lang === "bn" ? "ভিসা" : "Visa",
      cell: (r) => <span className="text-[11px]">{r.group.visaType.replace(/_/g, " ")}</span>,
    },
    {
      id: "embassy",
      header: lang === "bn" ? "এম্বাসি" : "Embassy",
      cell: (r) => <span className="text-[11px] truncate max-w-[90px] block">{r.embassy ?? "—"}</span>,
    },
    {
      id: "state",
      header: lang === "bn" ? "স্ট্যাটাস" : "State",
      cell: (r) => <ErpStatusChip status={visaStateKind(r.visaState)} label={r.visaState.replace(/_/g, " ")} lang={lang} />,
    },
    {
      id: "priority",
      header: lang === "bn" ? "অগ্রাধিকার" : "Priority",
      cell: (r) => <span className="text-[11px]">{r.priority ?? "—"}</span>,
    },
    {
      id: "updated",
      header: lang === "bn" ? "আপডেট" : "Updated",
      cell: (r) => <span className="text-[11px] whitespace-nowrap">{fmtWhen(r.updatedAt)}</span>,
    },
  ];

  if (error) {
    return (
      <div className="p-7" style={{ fontFamily: fontFor(lang) }}>
        <ErrorState
          tone="light"
          lang={lang}
          message={lang === "bn" ? "ভিসা ডেস্ক লোড হয়নি" : "Could not load Mutamer Visa Desk"}
          onRetry={load}
        />
      </div>
    );
  }

  return (
    <div style={{ fontFamily: fontFor(lang) }}>
      <ErpPageTemplate
        title={lang === "bn" ? "ভিসা ডেস্ক" : "Visa Desk"}
        subtitle={lang === "bn" ? "মুতামির পাইপলাইন · স্টাফ আপডেট" : "Mutamer pipeline · staff-updated"}
        primaryAction={
          <div className="flex flex-wrap gap-2">
            <ErpButton variant="secondary" icon={<RefreshCw size={14} />} onClick={load}>
              {lang === "bn" ? "রিফ্রেশ" : "Refresh"}
            </ErpButton>
            <ErpButton variant="outline" onClick={onShowBatches}>
              {lang === "bn" ? "ব্যাচ অনুরোধ" : "Batch Requests"}
            </ErpButton>
          </div>
        }
        toolbar={
          <div className="flex flex-col gap-3 w-full">
            {/* Today's Visa Summary — existing counts only */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {summary.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setVisaState(s.id)}
                  className="text-left rounded-xl px-3 py-2.5 transition-colors"
                  style={{
                    backgroundColor: visaState === s.id ? `${erpAlpha(color, 7)}` : ERP.surface,
                    border: `1px solid ${visaState === s.id ? color : ERP.border}`,
                  }}
                >
                  <div className="text-lg font-bold tabular-nums text-[color:var(--erp-text-strong)]" style={{ fontFamily: "var(--font-mono)" }}>
                    {s.value}
                  </div>
                  <div className="text-[10px]" style={{ color: ERP.muted }}>
                    {lang === "bn" ? s.labelBn : s.labelEn}
                  </div>
                </button>
              ))}
            </div>
            {data?.mofaCompleteness && (
              <p className="text-[10px]" style={{ color: ERP.muted }}>
                MOFA No: {data.mofaCompleteness.issuedWithMofa}/{data.mofaCompleteness.issuedTotal} issued
                ({data.mofaCompleteness.percent}%) — {lang === "bn" ? "বিল নয়" : "not the Finance bill"}
              </p>
            )}

            {/* Quick Filters (pipeline) */}
            <div className="flex flex-wrap gap-1.5">
              {quickFilters.map((c) => (
                <ErpButton
                  key={c.id}
                  size="sm"
                  variant={visaState === c.id ? "primary" : "outline"}
                  onClick={() => setVisaState(c.id)}
                >
                  {c.label}
                </ErpButton>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full">
              <div className="flex-1 min-w-0">
                <ErpSearchBar
                  lang={lang}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onClear={() => setQ("")}
                  placeholder={lang === "bn"
                    ? "যাত্রীর নাম, পাসপোর্ট নম্বর বা গ্রুপ নম্বর লিখুন..."
                    : "Search passenger name, passport, or group number…"}
                />
              </div>
              <ErpFilterPanel
                open={filtersOpen}
                onOpenChange={setFiltersOpen}
                lang={lang}
                activeCount={filterActive}
              >
                <ErpForm columns={2}>
                  <ErpField label={lang === "bn" ? "এম্বাসি" : "Embassy"}>
                    <ErpInput value={embassy} onChange={(e) => setEmbassy(e.target.value)} placeholder="Dhaka…" />
                  </ErpField>
                  <ErpField label={lang === "bn" ? "ভিসার ধরন" : "Visa Type"}>
                    <ErpSelect value={visaType} onChange={(e) => setVisaType(e.target.value)}>
                      <option value="">{lang === "bn" ? "সব" : "All"}</option>
                      <option value="UMRAH">Umrah</option>
                      <option value="HAJJ">Hajj</option>
                      <option value="LONG_STAY">Long Stay</option>
                    </ErpSelect>
                  </ErpField>
                  <ErpField label="Umrah Co">
                    <ErpSelect value={umrahCompanyId} onChange={(e) => setUmrahCompanyId(e.target.value)}>
                      <option value="">{lang === "bn" ? "সব" : "All"}</option>
                      {umrahCos.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </ErpSelect>
                  </ErpField>
                  <ErpField label={lang === "bn" ? "অগ্রাধিকার" : "Priority"}>
                    <ErpSelect value={priority} onChange={(e) => setPriority(e.target.value)}>
                      <option value="">{lang === "bn" ? "সব" : "All"}</option>
                      <option value="URGENT">Urgent</option>
                      <option value="HIGH">High</option>
                      <option value="NORMAL">Normal</option>
                      <option value="LOW">Low</option>
                    </ErpSelect>
                  </ErpField>
                  <ErpFormRow span={2}>
                    <label className="flex items-center gap-2 text-xs font-semibold text-[color:var(--erp-text-strong)] cursor-pointer">
                      <input type="checkbox" checked={arriving7} onChange={(e) => setArriving7(e.target.checked)} />
                      {lang === "bn" ? "আগমন ≤৭ দিন" : "Arrival ≤7 days"}
                    </label>
                  </ErpFormRow>
                </ErpForm>
              </ErpFilterPanel>
            </div>
          </div>
        }
        footer={
          <ErpPagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} lang={lang} />
        }
      >
        <ErpDataTable
          columns={columns}
          rows={loading ? [] : rows}
          rowKey={(r) => r.id}
          loading={loading}
          lang={lang}
          selectable
          selectedKeys={selected}
          onSelectedKeysChange={setSelected}
          onRowClick={(r) => setSel(r)}
          emptyTitle={lang === "bn" ? "কোনো তথ্য পাওয়া যায়নি" : "No mutamers match these filters"}
          emptyHint={lang === "bn" ? "ফিল্টার পরিবর্তন করুন অথবা যাত্রী ইনটেকের অপেক্ষা করুন।" : "Adjust filters or wait for agent passenger intake."}
          emptyAction={
            <ErpButton variant="primary" icon={<RefreshCw size={14} />} onClick={load}>
              {lang === "bn" ? "রিফ্রেশ" : "Refresh"}
            </ErpButton>
          }
          rowActions={(r) => (
            <ErpButton
              size="sm"
              variant="ghost"
              icon={<Eye size={13} />}
              onClick={(e) => { e.stopPropagation(); setSel(r); }}
              aria-label={lang === "bn" ? "খুলুন" : "Open"}
            >
              {lang === "bn" ? "খুলুন" : "Open"}
            </ErpButton>
          )}
        />
      </ErpPageTemplate>

      <MutamerVisaDrawer
        row={sel}
        open={!!sel}
        onClose={() => setSel(null)}
        onReload={load}
        onShowBatches={onShowBatches}
        requirePassportReturn={data?.sop?.requirePassportReturn}
      />
    </div>
  );
}

/** Legacy batch VisaRequest queue (envelope) — kept for ops continuity. */
function VisaBatchDesk() {
  const color = C.visa;
  const slaHours = 72;
  const { data, loading, error, reload } = useQueue<SvcRow>("/services/visa");
  const rows = data ?? [];
  const [sel, setSel] = useState<string | null>(null);

  if (loading) return <DeskFrame><LoadingSkeleton tone="light" rows={6} /></DeskFrame>;
  if (error)   return <DeskFrame><ErrorState tone="light" message="Could not load visa requests" onRetry={reload} /></DeskFrame>;
  if (!rows.length) return <DeskFrame><EmptyState tone="light" title="No visa requests in the queue" hint="New visa requests from agents will appear here." /></DeskFrame>;

  const item = rows.find((r) => r.id === sel) ?? rows[0];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <KPIStrip items={[
        { label:"Total Requests", value:rows.length,                                                 color,           icon:FileCheck },
        { label:"In Progress",    value:rows.filter((r)=>isActive(r.status)).length,                 color:ERP.warning, icon:Clock },
        { label:"Overdue",        value:rows.filter((r)=>hoursSince(r.createdAt)>slaHours).length,   color:ERP.destructive, icon:AlertTriangle },
        { label:"Completed",      value:rows.filter((r)=>r.status==="COMPLETED").length,             color:ERP.success, icon:CheckCircle },
      ]} />

      <div className="flex-1 overflow-hidden grid grid-cols-5">
        <QueuePanel color={color}>
          {rows.map((r) => (
            <QCard key={r.id} id={r.code}
              title={`${r.group?.paxCount ?? "—"} pax · ${r.group?.name ?? "—"}`}
              sub={r.group?.code ?? "—"}
              status={r.status} statusColor={SVC_STATUS_C[r.status] ?? color}
              hoursAgo={hoursSince(r.createdAt)} slaHours={slaHours}
              selected={item.id === r.id} color={color} onClick={() => setSel(r.id)} />
          ))}
        </QueuePanel>

        <div className="col-span-3 flex flex-col overflow-hidden">
          <div className="flex items-start justify-between gap-3 px-5 py-4 shrink-0" style={{ borderBottom:`1px solid ${ERP.border}` }}>
            <div className="min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <span className="text-sm font-black" style={{ color, fontFamily:"var(--font-mono)" }}>{item.code}</span>
                <Chip label={item.status} color={SVC_STATUS_C[item.status] ?? color} />
              </div>
              <div className="text-xs text-[color:var(--erp-text-strong)] font-semibold truncate">{item.group?.paxCount ?? "—"} passengers · {item.group?.name ?? "—"}</div>
              <div className="text-[10px] mt-0.5 truncate" style={{ color:ERP.muted }}>{item.group?.code ?? "—"}</div>
            </div>
            <div className="w-40 shrink-0"><SLABar hoursAgo={hoursSince(item.createdAt)} slaHours={slaHours} /></div>
          </div>

          <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth:"thin", scrollbarColor:`${ERP.mutedSoft} transparent` }}>
            <div className="grid grid-cols-2">
              <DetailRow label="Booking Group" value={item.group?.code ?? "—"} mono />
              <DetailRow label="Group Name"     value={item.group?.name ?? "—"} />
              <DetailRow label="Pax Count"      value={item.group?.paxCount != null ? `${item.group.paxCount} passengers` : "—"} />
              <DetailRow label="Request Code"   value={item.code} mono />
              <DetailRow label="Voucher"        value={item.voucher?.code ?? "—"} mono />
              <DetailRow label="Submitted"      value={`${Math.round(hoursSince(item.createdAt))}h ago`} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 px-5 py-3 shrink-0" style={{ borderTop:`1px solid ${ERP.border}` }}>
            <TransitionActions service="visa" row={item} onDone={reload} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── HOTEL DESK ───────────────────────────────────────────────────────────────
// Wired to GET /services/hotel. Real fields: code, group{code,name,paxCount},
// status, createdAt, hotel{name,stars}, supplier{name}, voucher.code. The old
// rate breakdown / room allocation / meal plan / hotel contact / special-request
// blocks were 100% fabricated and are removed (not "—"-padded).

function HotelDesk() {
  const color = C.hotel;
  const slaHours = 24;
  const { data, loading, error, reload } = useQueue<SvcRow>("/services/hotel");
  const rows = data ?? [];
  const [sel, setSel] = useState<string | null>(null);

  if (loading) return <DeskFrame><LoadingSkeleton tone="light" rows={6} /></DeskFrame>;
  if (error)   return <DeskFrame><ErrorState tone="light" message="Could not load hotel requests" onRetry={reload} /></DeskFrame>;
  if (!rows.length) return <DeskFrame><EmptyState tone="light" title="No hotel requests in the queue" hint="New hotel bookings from agents will appear here." /></DeskFrame>;

  const item = rows.find((r) => r.id === sel) ?? rows[0];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <KPIStrip items={[
        { label:"Total Requests", value:rows.length,                                                 color,           icon:Building2 },
        { label:"In Progress",    value:rows.filter((r)=>isActive(r.status)).length,                 color:ERP.warning, icon:Clock },
        { label:"Overdue",        value:rows.filter((r)=>hoursSince(r.createdAt)>slaHours).length,   color:ERP.destructive, icon:AlertTriangle },
        { label:"Confirmed",      value:rows.filter((r)=>r.status==="CONFIRMED").length,             color:ERP.success, icon:CheckCircle },
      ]} />

      <div className="flex-1 overflow-hidden grid grid-cols-5">
        <QueuePanel color={color}>
          {rows.map((r) => (
            <QCard key={r.id} id={r.code}
              title={r.hotel?.name ?? r.group?.name ?? "—"}
              sub={`${r.group?.paxCount ?? "—"} pax · ${r.group?.code ?? "—"}`}
              status={r.status} statusColor={SVC_STATUS_C[r.status] ?? color}
              hoursAgo={hoursSince(r.createdAt)} slaHours={slaHours}
              selected={item.id === r.id} color={color} onClick={() => setSel(r.id)} />
          ))}
        </QueuePanel>

        <div className="col-span-3 flex flex-col overflow-hidden">
          <div className="flex items-start justify-between gap-3 px-5 py-4 shrink-0" style={{ borderBottom:`1px solid ${ERP.border}` }}>
            <div className="min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <span className="text-sm font-black" style={{ color, fontFamily:"var(--font-mono)" }}>{item.code}</span>
                <Chip label={item.status} color={SVC_STATUS_C[item.status] ?? color} />
              </div>
              <div className="text-sm font-bold text-[color:var(--erp-text-strong)] truncate">{item.hotel?.name ?? "—"}</div>
              <div className="text-[10px] mt-0.5 truncate" style={{ color:ERP.muted }}>{item.group?.code ?? "—"} · {item.group?.paxCount ?? "—"} pax</div>
            </div>
            <div className="w-40 shrink-0"><SLABar hoursAgo={hoursSince(item.createdAt)} slaHours={slaHours} /></div>
          </div>

          <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth:"thin", scrollbarColor:`${ERP.mutedSoft} transparent` }}>
            <div className="grid grid-cols-2">
              <DetailRow label="Group"     value={item.group?.code ?? "—"} mono />
              <DetailRow label="Pax Count" value={item.group?.paxCount != null ? `${item.group.paxCount} pax` : "—"} />
              <DetailRow label="Hotel"     value={item.hotel?.name ?? "—"} />
              <DetailRow label="Stars"     value={item.hotel?.stars != null ? `${item.hotel.stars}★` : "—"} />
              <DetailRow label="Supplier"  value={item.supplier?.name ?? "—"} />
              <DetailRow label="Voucher"   value={item.voucher?.code ?? "—"} mono />
              <DetailRow label="Submitted" value={`${Math.round(hoursSince(item.createdAt))}h ago`} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 px-5 py-3 shrink-0" style={{ borderTop:`1px solid ${ERP.border}` }}>
            <TransitionActions service="hotel" row={item} onDone={reload} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── LIGHT DESK TEMPLATE ──────────────────────────────────────────────────────

interface LightRow {
  id: string;
  status: string;
  hoursAgo: number;
  [key: string]: string | number;
}

function LightDesk({ color, slaHours, cols, rows, statusColors, kpiItems }: {
  color:string; slaHours:number;
  cols: { key:string; label:string; mono?:boolean; center?:boolean; render?:(row:LightRow)=>ReactNode }[];
  rows: LightRow[];
  statusColors: Record<string,string>;
  kpiItems: { label:string; value:number|string; color:string; icon:typeof Clock }[];
}) {
  const [filter, setFilter] = useState("ALL");
  const [q, setQ] = useState("");

  const statuses = [...new Set(rows.map((r) => r.status))];
  const filtered = rows.filter((r) => {
    const st = filter === "ALL" || r.status === filter;
    const sq = !q || Object.values(r).some((v) => String(v).toLowerCase().includes(q.toLowerCase()));
    return st && sq;
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <KPIStrip items={kpiItems} />
      <div className="flex items-center gap-2 px-5 py-3 shrink-0" style={{ borderBottom:`1px solid ${ERP.border}` }}>
        {["ALL", ...statuses].map((s) => (
          <button key={s} onClick={() => setFilter(s)} className="px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all"
            style={{ backgroundColor: filter===s ? `${erpAlpha(color, 9)}` : ERP.surfaceSoft, color: filter===s ? color : ERP.muted, border:`1px solid ${filter===s ? color+"30" : "transparent"}` }}>
            {s.replace("_"," ")}
          </button>
        ))}
        <div className="relative ml-auto">
          <Search size={11} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color:ERP.muted }} />
          <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Search…"
            className="pl-8 pr-3 py-1.5 rounded-xl text-[10px] focus:outline-none w-48"
            style={IS} />
        </div>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold ml-1"
          style={{ backgroundColor:`${erpAlpha(color, 9)}`, color, border:`1px solid ${erpAlpha(color, 19)}` }}>
          <Plus size={11} /> New
        </button>
      </div>
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth:"thin", scrollbarColor:`${ERP.mutedSoft} transparent` }}>
        <table className="w-full">
          <thead>
            <tr style={{ backgroundColor:ERP.surfaceSoft, borderBottom:`1px solid ${ERP.border}` }}>
              {cols.map((c) => (
                <th key={c.key} className={`px-4 py-2.5 text-left text-[9px] font-black uppercase tracking-widest${c.center?" text-center":""}`}
                    style={{ color:ERP.muted }}>{c.label}</th>
              ))}
              <th className="px-4 py-2.5 text-left text-[9px] font-black uppercase tracking-widest" style={{ color:ERP.muted }}>SLA</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, i) => {
              const sc  = statusColors[row.status] ?? ERP.muted;
              const sla = slaHours - row.hoursAgo;
              const slaColor = sla > slaHours * 0.6 ? ERP.success : sla > slaHours * 0.3 ? ERP.warning : sla > 0 ? CAT.orange : ERP.destructive;
              const overdue  = sla < 0;
              return (
                <tr key={row.id} style={{ borderBottom: i < filtered.length-1 ? `1px solid ${ERP.border}` : undefined }} className="hover:bg-white/2 group">
                  {cols.map((c) => (
                    <td key={c.key} className={`px-4 py-3${c.center?" text-center":""}`}>
                      {c.key === "status" ? (
                        <Chip label={row.status} color={sc} />
                      ) : c.render ? c.render(row) : (
                        <span className={`text-xs${c.mono?" font-mono font-semibold":""} text-[color:var(--erp-text-strong)]`}
                              style={c.mono ? { fontFamily:"var(--font-mono)", color } : { color:ERP.navy }}>
                          {row[c.key]}
                        </span>
                      )}
                    </td>
                  ))}
                  <td className="px-4 py-3 w-32">
                    <div className="h-1 rounded-full overflow-hidden mb-1" style={{ backgroundColor:ERP.surfaceSoft }}>
                      <div className="h-full rounded-full" style={{ width:`${Math.max(0,Math.min(100,((slaHours-row.hoursAgo)/slaHours)*100))}%`, backgroundColor:slaColor }} />
                    </div>
                    <div className="text-[9px]" style={{ color:slaColor }}>{overdue ? `${Math.round(-sla)}h over` : `${Math.round(sla)}h left`}</div>
                  </td>
                  <td className="px-3 py-3">
                    <button className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor:ERP.surfaceSoft }}>
                      <MoreHorizontal size={11} style={{ color:ERP.muted }} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Service-backed light desks (Transport, Catering) ─────────────────────────
// Wired to GET /services/:service. Real columns only: request code, group code,
// pax (group.paxCount), supplier name (present once ASSIGNED, else "—"), status,
// and SLA age from createdAt. No vehicle / driver / route / departure / meal-plan
// / delivery-date columns — the API does not provide them, so they are omitted.

function SvcQueueDesk({ service, color, icon, slaHours, supplierLabel }: {
  service:"transport"|"catering"; color:string; icon:typeof Clock; slaHours:number; supplierLabel:string;
}) {
  const { data, loading, error, reload } = useQueue<SvcRow>(`/services/${service}`);
  const svc = data ?? [];

  if (loading) return <DeskFrame><LoadingSkeleton tone="light" rows={6} /></DeskFrame>;
  if (error)   return <DeskFrame><ErrorState tone="light" message={`Could not load ${service} requests`} onRetry={reload} /></DeskFrame>;
  if (!svc.length) return <DeskFrame><EmptyState tone="light" title={`No ${service} requests in the queue`} hint="New requests from agents will appear here." /></DeskFrame>;

  const rows: LightRow[] = svc.map((r) => ({
    id: r.code,
    group: r.group?.code ?? "—",
    pax: r.group?.paxCount ?? "—",
    supplier: r.supplier?.name ?? "—",
    status: r.status,
    hoursAgo: hoursSince(r.createdAt),
  }));

  return <LightDesk color={color} slaHours={slaHours}
    cols={[
      { key:"id",       label:"Request",  mono:true },
      { key:"group",    label:"Group",    mono:true },
      { key:"pax",      label:"Pax",      center:true, render:(r)=><span className="text-base font-black text-[color:var(--erp-text-strong)]" style={{ fontFamily:"var(--font-mono)" }}>{r.pax}</span> },
      { key:"supplier", label:supplierLabel },
      { key:"status",   label:"Status" },
    ]}
    rows={rows}
    statusColors={SVC_STATUS_C}
    kpiItems={[
      { label:"Total Orders", value:svc.length,                                                color,           icon },
      { label:"In Progress",  value:svc.filter((r)=>isActive(r.status)).length,                color:ERP.warning, icon:Clock },
      { label:"Overdue",      value:svc.filter((r)=>hoursSince(r.createdAt)>slaHours).length,  color:ERP.destructive, icon:AlertTriangle },
      { label:"Completed",    value:svc.filter((r)=>r.status==="COMPLETED").length,            color:ERP.success, icon:CheckCircle },
    ]}
  />;
}

function TransportDesk() {
  return <SvcQueueDesk service="transport" color={C.transport} icon={Bus} slaHours={12} supplierLabel="Supplier" />;
}
function CateringDesk() {
  return <SvcQueueDesk service="catering" color={C.catering} icon={UtensilsCrossed} slaHours={24} supplierLabel="Caterer" />;
}

// ─── Finance desk (real invoices) ─────────────────────────────────────────────
// Wired to GET /finance/invoices (requires FINANCIAL_REPORTS — a 403 surfaces as
// the error state). All columns are real invoice fields: code, group, tenant,
// total, issue/due dates, status. SLA age is derived from issueDate.

function FinanceDesk() {
  const color = C.finance;
  const slaHours = 48;
  const { data, loading, error, reload } = useQueue<ApiInvoice>("/finance/invoices");
  const inv = data ?? [];

  if (loading) return <DeskFrame><LoadingSkeleton tone="light" rows={6} /></DeskFrame>;
  if (error)   return <DeskFrame><ErrorState tone="light" message="Could not load invoices — finance access required" onRetry={reload} /></DeskFrame>;
  if (!inv.length) return <DeskFrame><EmptyState tone="light" title="No invoices in the queue" hint="Issued invoices will appear here." /></DeskFrame>;

  const rows: LightRow[] = inv.map((v) => ({
    id: v.code,
    group: v.group ?? "—",
    entity: v.tenant || "—",
    amount: v.total ?? 0,
    issued: fmtDate(v.issueDate),
    due: fmtDate(v.dueDate),
    status: v.status,
    hoursAgo: hoursSince(v.issueDate),
  }));

  return <LightDesk color={color} slaHours={slaHours}
    cols={[
      { key:"id",     label:"Invoice",  mono:true },
      { key:"group",  label:"Group",    mono:true },
      { key:"entity", label:"Bill To" },
      { key:"amount", label:"Amount",   render:(r)=><span className="text-xs font-bold font-mono" style={{ color:ERP.success, fontFamily:"var(--font-mono)" }}>SAR {Number(r.amount).toLocaleString()}</span> },
      { key:"issued", label:"Issued",   mono:true },
      { key:"due",    label:"Due",      mono:true },
      { key:"status", label:"Status" },
    ]}
    rows={rows}
    statusColors={INV_STATUS_C}
    kpiItems={[
      { label:"Total Invoices", value:inv.length,                                       color,           icon:DollarSign },
      { label:"Outstanding",    value:inv.filter((v)=>v.status==="OUTSTANDING").length, color:ERP.warning, icon:Clock },
      { label:"Overdue",        value:inv.filter((v)=>v.status==="OVERDUE").length,     color:ERP.destructive, icon:AlertTriangle },
      { label:"Paid",           value:inv.filter((v)=>v.status==="PAID").length,        color:ERP.success, icon:CheckCircle },
    ]}
  />;
}

// ─── Deferred desks (no backend) ──────────────────────────────────────────────
// Procurement, HR and CRM have NO backend controller. Rather than fabricate a
// queue, each shows a designed "coming soon" placeholder.

function ProcurementDesk() {
  return (
    <DeskFrame>
      <EmptyState tone="light" title="ক্রয় ডেস্ক" hint="এই মডিউল এখনও কনফিগার করা হয়নি।"
        icon={<ShoppingCart size={32} className="opacity-20" style={{ color:ERP.navy }} />} />
    </DeskFrame>
  );
}
function HRDesk() {
  return (
    <DeskFrame>
      <EmptyState tone="light" title="এইচআর ডেস্ক" hint="এই মডিউল এখনও কনফিগার করা হয়নি।"
        icon={<Users size={32} className="opacity-20" style={{ color:ERP.navy }} />} />
    </DeskFrame>
  );
}
function CRMDesk() {
  return (
    <DeskFrame>
      <EmptyState tone="light" title="সিআরএম ডেস্ক" hint="এই মডিউল এখনও কনফিগার করা হয়নি।"
        icon={<MessageCircle size={32} className="opacity-20" style={{ color:ERP.navy }} />} />
    </DeskFrame>
  );
}

// ─── Main OpsDepartments ──────────────────────────────────────────────────────

const DEPT_SCREENS: Record<DeptId, () => ReactNode> = {
  visa:        () => <VisaDesk />,
  hotel:       () => <HotelDesk />,
  transport:   () => <TransportDesk />,
  catering:    () => <CateringDesk />,
  finance:     () => <FinanceDesk />,
  procurement: () => <ProcurementDesk />,
  hr:          () => <HRDesk />,
  crm:         () => <CRMDesk />,
};

const DEPT_LABELS: Record<DeptId, string> = {
  visa:"Visa", hotel:"Hotel", transport:"Transport", catering:"Catering",
  finance:"Finance", procurement:"Procurement", hr:"HR", crm:"CRM",
};

export default function OpsDepartments() {
  const [dept, setDept] = useState<DeptId>("visa");
  const color = C[dept];
  const Icon  = DEPT_ICONS[dept];

  return (
    <ErpThemeProvider theme="ds"><ERPShell
      moduleId="departments"
      moduleName="Departments"
      moduleColor={color}
      moduleIcon={Icon}
      navItems={DEPT_NAV}
      activeItem={dept}
      onItemClick={(id) => setDept(id as DeptId)}
      breadcrumb={["Operations", "Departments", DEPT_LABELS[dept]]}
      notificationCount={0}
      userName={getStoredUser()?.name ?? "Ops Desk"}
      userRole="TUBA AL HIJAZ · Season 1446H"
    >
      <div className="flex flex-col h-full overflow-hidden">
        {DEPT_SCREENS[dept]()}
      </div>
    </ERPShell></ErpThemeProvider>
  );
}
