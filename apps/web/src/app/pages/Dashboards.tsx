import { useState, useEffect, useMemo, lazy, Suspense, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { isLoggedIn } from "../lib/api";
import { canAccessPath, DASH_NAV_PERMS, filterNavByPerms } from "../lib/rbac";
import { useDash } from "../lib/useDash";
import { EmptyState, LoadingSkeleton, ErrorState, SampleDataBanner } from "../components/States";
import { RouteFallback } from "../components/RouteFallback";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  TrendingUp, TrendingDown, LayoutGrid, DollarSign, Truck,
  ArrowDownLeft, ArrowUpRight, Users, Building2, UserCheck,
  CheckCircle, AlertTriangle, Clock, Activity, Plane,
  CreditCard, ClipboardList, RefreshCw, Wallet, Package,
  FileCheck, ShieldAlert, CalendarCheck2,
} from "lucide-react";
import { ERPShell, type NavItem, type IconFC } from "../components/ERPShell";
import { ERP, CAT, erpAlpha, ErpThemeProvider, ErpStatCard } from "../components/erp";

/** ESP-03 — defer Ops Today / Executive / Reports until those tabs are opened. */
const OpsTodayDashboard = lazy(() =>
  import("./OpsTodayDashboard").then((m) => ({ default: m.OpsTodayDashboard })),
);
const ExecutiveDashboard = lazy(() =>
  import("./ExecutiveReportsDashboard").then((m) => ({ default: m.ExecutiveDashboard })),
);
const ReportsManagementView = lazy(() =>
  import("./ExecutiveReportsDashboard").then((m) => ({ default: m.ReportsManagementView })),
);

// ─── Module constant ──────────────────────────────────────────────────────────

const DASH = ERP.info;

// ─── Live-data helpers (Phase 12) ──────────────────────────────────────────────
// Money formatter matching the frozen KPI style: SAR 8.45M / SAR 323.7K / SAR n
function fmtSAR(n: number, cur = "SAR"): string {
  const a = Math.abs(n);
  if (a >= 1e6) return `${cur} ${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${cur} ${(n / 1e3).toFixed(1)}K`;
  return `${cur} ${n.toLocaleString()}`;
}
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
// "YYYY-MM" → short month label (e.g. "Jul") to match the mock x-axis
const monthLabel = (ym: string): string => MONTHS[Number(ym.slice(5, 7)) - 1] ?? ym;
// ISO datetime → "HH:MM"
const hhmm = (iso: string): string => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toTimeString().slice(0, 5);
};

// Page-level loading / error frames — reuse the design-system states, keeping
// DashFrame's own p-6 gutter so nothing shifts when data arrives.
function DashLoading() {
  return <div className="p-6"><LoadingSkeleton tone="light" rows={6} /></div>;
}
function DashError({ onRetry }: { onRetry: () => void }) {
  return <div className="p-6"><ErrorState tone="light" onRetry={onRetry} /></div>;
}

interface CeoDashData {
  kpis: { ytdRevenue:number; netProfit:number; netMargin:number; activeGroups:number; pax:number; airlines:number; arOutstanding:number; overdueInvoices:number; activeAgents:number };
  revenueTrend: { month:string; total:number }[];
  topAgents: { name:string; total:number }[];
}
interface OpsDashData {
  kpis: { groupsActive:number; arrivalsToday:number; departuresToday:number; completedToday:number; delayedDispatch:number; pendingTasks:number };
  hourly: { hour:number; arr:number; dep:number }[];
  departments: [string, number][];
}
interface FinDashData {
  kpis: { cashPosition:number; accountsReceivable:number; accountsPayable:number; netProfit:number; netMargin:number; totalRevenue:number };
  arAging: { bucket:string; amount:number }[];
  cashTrend: { month:string; total:number }[];
  arEntities: { entity:string; cur:number; d30:number; d60:number; d90:number; total:number }[];
}
interface DispatchDashData {
  kpis: { activeDispatches:number; deliveredToday:number; totalPaxMoving:number; delayed:number };
  orders: { code:string; status:string; routeFrom:string; routeTo:string; pax:number; progressPct:number; scheduledAt:string; vehicle:{code:string}|null; driver:{name:string}|null; group:{code:string}|null }[];
}
interface FlightBoardData {
  kpis: { flights:number; totalPax:number; processedPax:number; pendingPax:number; landed:number };
  flights: { flightNo:string; airline:string; scheduledAt:string; paxCount:number; status:string; group:{code:string; tenant:{name:string}}|null }[];
}
interface AgentDashData {
  kpis: { walletBalance:number; currency:string; activeGroups:number; seasonGroups:number; outstandingAmount:number; outstandingCount:number };
  paxTrend: { month:string; pax:number }[];
  groups: { code:string; paxCount:number; status:string; opsStatus:string }[];
  invoices: { code:string; total:number; status:string }[];
  /** T002-09 §12 — scoped Visa Status card (tenant pipeline + MOFA %). */
  visa?: {
    pipeline: Record<string, number>;
    notIssued: number;
    mofaCompletePercent: number;
  };
}
/** T002-09 — architecture §12 Visa / MOFA / Long-Stay backlog widgets. */
interface VisaDashData {
  pipeline: Record<string, number>;
  mofa: {
    issuedTotal: number;
    issuedWithMofa: number;
    completePercent: number;
    pendingPercent: number;
    note: string;
  };
  backlog: {
    notIssued: number;
    biometricNotIssued: number;
    rejectedOpen: number;
    arrivingSoon: { days: number; mutamersNotIssued: number; groups: number };
  };
  longStay: {
    total: number;
    tracking: number;
    approaching: number;
    due: number;
    escalated: number;
    resolved: number;
    redCards: number;
    hostComplete: number;
    hostCompletePercent: number;
  };
  gates: {
    activeGroups: number;
    ready: number;
    waitingVisa: number;
    waitingPackage: number;
    waitingPayment: number;
    waitingBill: number;
  };
}
interface SupplierDashData {
  kpis: { pendingBookings:number; invoicesOutstanding:number; seasonRevenue:number; upcomingServices:number; qualityScore:number };
}

type DashScreen = "today"|"ceo"|"reports"|"ops"|"visa"|"finance"|"dispatch"|"arrival"|"departure"|"agent"|"supplier";

/** UI-03 Today first; UI-08 Executive + Reports; legacy boards remain secondary. */
const DASH_NAV: NavItem[] = [
  { id:"today",     label:"Today's Work",         labelBn:"আজকের কাজ",           icon: CalendarCheck2 as IconFC },
  { id:"ceo",       label:"Executive",            labelBn:"নির্বাহী",            icon: TrendingUp    as IconFC },
  { id:"reports",   label:"Reports",              labelBn:"রিপোর্ট",             icon: ClipboardList as IconFC },
  { id:"visa",      label:"Visa & Compliance",    labelBn:"ভিসা ও কমপ্লায়েন্স", icon: FileCheck     as IconFC },
  { id:"finance",   label:"Finance Dashboard",    labelBn:"হিসাব",               icon: DollarSign    as IconFC },
  { id:"ops",       label:"Operations Board",     labelBn:"অপারেশন বোর্ড",       icon: LayoutGrid    as IconFC },
  { id:"dispatch",  label:"Dispatch",             labelBn:"ডিসপ্যাচ",            icon: Truck         as IconFC },
  { id:"arrival",   label:"Arrival Board",        labelBn:"আগমন বোর্ড",          icon: ArrowDownLeft as IconFC },
  { id:"departure", label:"Departure Board",      labelBn:"প্রস্থান বোর্ড",      icon: ArrowUpRight  as IconFC },
  { id:"agent",     label:"Agent View",           labelBn:"এজেন্ট ভিউ",          icon: Users         as IconFC },
  { id:"supplier",  label:"Supplier View",        labelBn:"সাপ্লায়ার ভিউ",      icon: Building2     as IconFC },
];

/** Canonical mutamer visa pipeline order (T002-03). */
const VISA_PIPELINE_ORDER = [
  "NEW", "MOFA", "EMBASSY", "BIOMETRIC", "SUBMITTED", "PROCESSING",
  "ISSUED", "REJECTED", "PASSPORT_RETURNED", "COMPLETED", "REJECTED_CLOSED",
] as const;
const VISA_C = CAT.teal;

// ─── Chart data ───────────────────────────────────────────────────────────────

const OPS_HRLY = [
  { h:"07", arr:1,dep:0 }, { h:"08", arr:2,dep:1 }, { h:"09", arr:3,dep:1 },
  { h:"10", arr:2,dep:2 }, { h:"11", arr:1,dep:3 }, { h:"12", arr:0,dep:2 },
  { h:"13", arr:2,dep:1 }, { h:"14", arr:2,dep:0 }, { h:"15", arr:0,dep:1 },
  { h:"16", arr:1,dep:0 }, { h:"17", arr:0,dep:1 }, { h:"18", arr:0,dep:0 },
];
const FIN_CASH = [
  { m:"Jan", cash:1200 }, { m:"Feb", cash:1450 }, { m:"Mar", cash:1820 },
  { m:"Apr", cash:1680 }, { m:"May", cash:2100 }, { m:"Jun", cash:2750 }, { m:"Jul", cash:3200 },
];
const AGT_TREND = [
  { m:"Feb", pax:89 }, { m:"Mar", pax:134 }, { m:"Apr", pax:96 },
  { m:"May", pax:47 }, { m:"Jun", pax:168 }, { m:"Jul", pax:124 },
];
const SUP_FCST = [
  { m:"Aug", hotel:4, transport:3, catering:2 }, { m:"Sep", hotel:6, transport:5, catering:3 },
  { m:"Oct", hotel:5, transport:4, catering:4 }, { m:"Nov", hotel:3, transport:3, catering:2 },
];

// ─── Shared components ────────────────────────────────────────────────────────

// Uniform tooltip for all recharts
function CTip({ active, payload, label, prefix = "" }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="px-3 py-2 rounded-xl text-[10px]" style={{ backgroundColor:ERP.surface, border:`1px solid ${ERP.border}` }}>
      <div className="font-bold text-[color:var(--erp-text-strong)] mb-1">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ color: p.color }}>{p.name}: {prefix}{typeof p.value==="number"?p.value.toLocaleString():p.value}</div>
      ))}
    </div>
  );
}

// KPI card — identical across all 7 dashboards
function DKpi({ label, value, sub, color, trend, up, icon: Icon }: {
  label: string; value: string; sub?: string; color: string;
  trend?: string; up?: boolean; icon: typeof TrendingUp;
}) {
  return (
    <ErpStatCard
      label={label}
      value={value}
      hint={sub}
      accent={color}
      icon={<Icon size={16} style={{ color }} />}
      delta={trend ? { val: trend, up: !!up } : undefined}
    />
  );
}

// Chart/widget card wrapper — identical across all dashboards
const ACTION_ROUTES: Record<string, string> = {
  "Full P&L":        "/finance-erp",
  "Ops":             "/ops-control",
  "Ops Control":     "/ops-control",
  "Finance ERP":     "/finance-erp",
  "AR Desk":         "/finance-erp",
  "All Tasks":       "/ops-departments",
  "Live Board":      "/ops-control",
  "All Groups":      "/agent-portal",
  "Full Log":        "/agent-portal",
  "Supplier Portal": "/supplier-portal",
  "Full Schedule":   "/supplier-portal",
  "Workflow Map":    "/workflow-map",
  // T002-09 — drill into existing desks (no dashboard business actions).
  "Visa Desk":       "/ops-departments",
  "Long Stay":       "/ops-control",
  "Group Master":    "/ops-control",
};

function DCard({ title, sub, action, children, color, minH }: {
  title: string; sub?: string; action?: string; children: ReactNode; color?: string; minH?: number;
}) {
  const navigate = useNavigate();
  const dest = action ? ACTION_ROUTES[action] : undefined;
  // UX: hide card deep-links the session cannot access (API still enforces).
  const showAction = !!(dest && canAccessPath(dest));
  return (
    <div className="rounded-xl overflow-hidden h-full flex flex-col" style={{ backgroundColor:ERP.surface, border:`1px solid ${ERP.border}`, minHeight:minH }}>
      <div className="flex items-center justify-between px-5 py-3.5 shrink-0" style={{ borderBottom:`1px solid ${ERP.border}`, backgroundColor:ERP.surface }}>
        <div>
          <div className="text-xs font-bold text-[color:var(--erp-text-strong)]">{title}</div>
          {sub && <div className="text-[9px] mt-0.5" style={{ color:ERP.muted }}>{sub}</div>}
        </div>
        {showAction && (
          <button
            className="text-[9px] font-bold transition-opacity hover:opacity-70 active:scale-95"
            style={{ color: color??DASH }}
            onClick={() => { if (dest) { toast.info(`Opening ${action}`, { duration:1500 }); navigate(dest); } }}
          >
            {action} →
          </button>
        )}
      </div>
      <div className="p-4 flex-1">{children}</div>
    </div>
  );
}

// Identical 3-zone grid layout for all dashboards.
// bodyBanner / widgetsBanner are optional seams for a SampleDataBanner scoped to a
// whole row — they render nothing when omitted, so the layout is unchanged without them.
function DashFrame({ kpis, main, side, widgets, bodyBanner, widgetsBanner }: {
  kpis: ReactNode[]; main: ReactNode; side: ReactNode; widgets: ReactNode[];
  bodyBanner?: ReactNode; widgetsBanner?: ReactNode;
}) {
  return (
    <div className="p-6 h-full overflow-y-auto space-y-4" style={{ scrollbarWidth:"thin", scrollbarColor:"${ERP.mutedSoft} transparent" }}>
      <div className="grid grid-cols-4 gap-4">{kpis.map((k,i) => <div key={i}>{k}</div>)}</div>
      {bodyBanner}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2"><div style={{ minHeight:260 }}>{main}</div></div>
        <div><div style={{ minHeight:260 }}>{side}</div></div>
      </div>
      {widgetsBanner}
      <div className="grid grid-cols-3 gap-4">{widgets.map((w,i) => <div key={i}>{w}</div>)}</div>
    </div>
  );
}

// Horizontal mini-bar for compact comparisons
function MBar({ label, value, max, color, fmt }: { label:string; value:number; max:number; color:string; fmt?:(v:number)=>string }) {
  const pct = Math.min(100, Math.round(value / max * 100));
  return (
    <div className="mb-2.5">
      <div className="flex justify-between mb-1">
        <span className="text-[10px] min-w-0 truncate" title={label} style={{ color:ERP.navy }}>{label}</span>
        <span className="text-[10px] font-bold font-mono shrink-0 whitespace-nowrap tabular-nums" style={{ color, fontFamily:"var(--font-mono)" }}>{fmt ? fmt(value) : value.toLocaleString()}</span>
      </div>
      <div className="h-1.5 rounded-full" style={{ backgroundColor:ERP.surfaceSoft }}>
        <div className="h-full rounded-full" style={{ width:`${pct}%`, backgroundColor:color }} />
      </div>
    </div>
  );
}

// Status pill
function SPill({ s, map }: { s:string; map:Record<string,[string,string]> }) {
  const [c, l] = map[s] ?? [DASH, s];
  return <span className="inline-flex px-2 py-0.5 rounded-full text-[8px] font-black" style={{ backgroundColor:`${erpAlpha(c, 9)}`, color:c }}>{l}</span>;
}

// Activity list item for sidebar panels
function ALi({ label, sub, time, urgent }: { label:string; sub?:string; time?:string; urgent?:boolean }) {
  return (
    <div className="px-4 py-2.5 flex items-start gap-3" style={{ borderBottom:`1px solid ${ERP.border}`, borderLeft:`3px solid ${urgent?ERP.destructive:"transparent"}` }}>
      {urgent && <AlertTriangle size={11} className="mt-0.5 shrink-0" style={{ color:ERP.destructive }} />}
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-semibold truncate" style={{ color: urgent?ERP.destructive:ERP.navy }}>{label}</div>
        {sub && <div className="text-[9px] mt-0.5 truncate" style={{ color:ERP.muted }}>{sub}</div>}
      </div>
      {time && <span className="text-[9px] shrink-0" style={{ color:ERP.muted, fontFamily:"var(--font-mono)" }}>{time}</span>}
    </div>
  );
}

// ─── 1. CEO / Executive — UI-08 (`ExecutiveDashboard`) ─────────────────────────

// ─── 2. Operations Dashboard ──────────────────────────────────────────────────

const OPS_PENDING = [
  { label:"GRP-2990 transport rebooking",  sub:"Flight delay · 47 pax",   time:"5m",  urgent:true  },
  { label:"Passport OCR recheck — GRP-2612",sub:"3 pax flagged by system", time:"18m", urgent:true  },
  { label:"GRP-2891 hotel check-in",        sub:"47 pax · Jabal Omar",     time:"34m", urgent:false },
  { label:"Voucher approval — GRP-2744",    sub:"Hotel desk pending",       time:"1h",  urgent:false },
  { label:"Excel import — GRP-3301",        sub:"67 pax list received",     time:"2h",  urgent:false },
  { label:"Finance sign-off — INV-0091",    sub:"SAR 323,725 outstanding",  time:"3h",  urgent:false },
];
const OPS_DEPTS = [["Visa",6],["Hotel",4],["Transport",9],["Catering",3],["Finance",5],["HR",2]];

function OpsDash() {
  const { data: live, loading, error, refetch } = useDash<OpsDashData>("/dashboards/ops");
  // T002-09 — compact §12 visa backlog strip on Ops (full board is Visa & Compliance).
  const visa = useDash<VisaDashData>("/dashboards/visa");
  if (loading) return <DashLoading />;
  if (error) return <DashError onRetry={refetch} />;
  const k = live?.kpis;
  const hrlyData = live
    ? live.hourly.map(h => ({ h: String(h.hour).padStart(2, "0"), arr: h.arr, dep: h.dep }))
    : OPS_HRLY;
  const deptData: [string, number][] = live ? live.departments : OPS_DEPTS as [string, number][];
  const deptMax = deptData.length ? Math.max(...deptData.map(d => d[1])) : 9;
  const v = visa.data;
  const pipeMax = v ? Math.max(1, ...VISA_PIPELINE_ORDER.map((s) => v.pipeline[s] ?? 0)) : 1;
  return (
    <DashFrame
      kpis={[
        <DKpi label="Groups Active"    value={k ? String(k.groupsActive) : "8"}   sub={k ? `Today: ${k.arrivalsToday} arr, ${k.departuresToday} dep` : "Today: 3 arr, 2 dep"}    color={CAT.orange} icon={Users}         />,
        <DKpi label="Pending Tasks"    value={k ? String(k.pendingTasks) : "12"}  sub={k ? "—" : "2 urgent · 10 normal"}   color={ERP.warning}    icon={ClipboardList}   />,
        <DKpi label="Completed Today"  value={k ? String(k.completedToday) : "4"}   sub={k ? "—" : "—"}        color={ERP.success} icon={CheckCircle}   />,
        <DKpi label="Delayed Dispatch" value={k ? String(k.delayedDispatch) : "1"}   sub={k ? "—" : "GRP-2990 · 3h delay"}    color={ERP.destructive}                     icon={AlertTriangle}   />,
      ]}
      main={
        <DCard title="Hourly Activity — Today" sub="Arrivals vs Departures" action="Ops Control" color={CAT.orange}>
          {hrlyData.length === 0 ? (
            <EmptyState tone="light" title="No movements today" hint="Arrivals and departures appear here as flights are scheduled." />
          ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={hrlyData} margin={{ top:4, right:4, bottom:0, left:0 }} barGap={3}>
              <CartesianGrid strokeDasharray="3 3" stroke={ERP.mutedSoft} />
              <XAxis dataKey="h" tick={{ fill:ERP.muted, fontSize:9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill:ERP.muted, fontSize:9 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CTip />} />
              <Bar dataKey="arr" name="Arrivals"   fill={DASH}      radius={[3,3,0,0]} />
              <Bar dataKey="dep" name="Departures" fill={ERP.warning}   radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
          )}
        </DCard>
      }
      side={
        <DCard title="Pending Action Queue" color={CAT.orange}>
          <EmptyState tone="light" title="প্রস্তুত নয়" hint="এই মডিউল এখনও কনফিগার করা হয়নি।" />
        </DCard>
      }
      widgets={[
        <DCard title="Department Queue Depths" color={CAT.orange}>
          {deptData.length === 0
            ? <EmptyState tone="light" title="No queued work" hint="Department queues fill as tasks are raised." />
            : deptData.map(([n,v]) => <MBar key={n as string} label={n as string} value={v as number} max={deptMax} color={CAT.orange} fmt={v=>`${v} tasks`} />)}
        </DCard>,
        <DCard title="Today's Flight Schedule" color={CAT.orange}>
          <EmptyState tone="light" title="প্রস্তুত নয়" hint="এই মডিউল এখনও কনফিগার করা হয়নি।" />
        </DCard>,
        <DCard title="Visa Pipeline Backlog" sub="Mutamer states · drill to Visa Desk" action="Visa Desk" color={VISA_C}>
          {visa.loading ? <LoadingSkeleton tone="light" rows={4} /> :
           visa.error || !v ? (
             <EmptyState tone="light" title="Visa board unavailable" hint="Open Visa & Compliance for the full backlog, or retry." />
           ) : (
             <>
               {VISA_PIPELINE_ORDER.filter((s) => (v.pipeline[s] ?? 0) > 0 || ["NEW","PROCESSING","ISSUED","REJECTED"].includes(s))
                 .slice(0, 6)
                 .map((s) => (
                   <MBar key={s} label={s} value={v.pipeline[s] ?? 0} max={pipeMax} color={VISA_C} />
                 ))}
               <div className="text-[9px] mt-2" style={{ color:ERP.muted }}>
                 Not issued {v.backlog.notIssued} · Bio backlog {v.backlog.biometricNotIssued} · LS red {v.longStay.redCards}
               </div>
             </>
           )}
        </DCard>,
      ]}
    />
  );
}

// ─── 2b. Visa & Compliance (T002-09, architecture §12) ─────────────────────────

function VisaDash() {
  const { data: live, loading, error, refetch } = useDash<VisaDashData>("/dashboards/visa");
  if (loading) return <DashLoading />;
  if (error) return <DashError onRetry={refetch} />;
  const demo = !isLoggedIn();
  // Logged-out shell keeps the layout; live figures never invent numbers.
  const v = live;
  const pipeMax = v ? Math.max(1, ...VISA_PIPELINE_ORDER.map((s) => v.pipeline[s] ?? 0)) : 1;
  const gateMax = v ? Math.max(1, v.gates.activeGroups, v.gates.waitingVisa, v.gates.waitingPackage, v.gates.waitingPayment, v.gates.waitingBill) : 1;
  return (
    <DashFrame
      kpis={[
        <DKpi label="Not Issued" value={v ? String(v.backlog.notIssued) : "—"} sub="Mutamers still open" color={VISA_C} icon={FileCheck} />,
        <DKpi label="Biometric Backlog" value={v ? String(v.backlog.biometricNotIssued) : "—"} sub="Registered · visa not issued" color={ERP.warning} icon={UserCheck} />,
        <DKpi
          label={`Arriving ≤${v?.backlog.arrivingSoon.days ?? 7}d`}
          value={v ? String(v.backlog.arrivingSoon.groups) : "—"}
          sub={v ? `${v.backlog.arrivingSoon.mutamersNotIssued} mutamers not issued` : "Groups still not issued"}
          color={CAT.orange}
          icon={Plane}
        />,
        <DKpi label="Long Stay Red Cards" value={v ? String(v.longStay.redCards) : "—"} sub={v ? `DUE ${v.longStay.due} · ESC ${v.longStay.escalated}` : "Day-85 / day-90"} color={ERP.destructive} icon={ShieldAlert} />,
      ]}
      main={
        <DCard title="Active Visa Pipeline" sub="Mutamer counts by pipeline state" action="Visa Desk" color={VISA_C}>
          {!v && demo ? (
            <EmptyState tone="light" title="Sign in for live visa KPIs" hint="Pipeline counts come from the Visa Desk Passenger aggregate." />
          ) : !v ? (
            <EmptyState tone="light" title="No visa data" hint="Mutamer pipeline counts appear once passengers are on the desk." />
          ) : (
            VISA_PIPELINE_ORDER.map((s) => (
              <MBar key={s} label={s.replace(/_/g, " ")} value={v.pipeline[s] ?? 0} max={pipeMax} color={s === "REJECTED" || s === "REJECTED_CLOSED" ? ERP.destructive : VISA_C} />
            ))
          )}
        </DCard>
      }
      side={
        <DCard title="MOFA Number Completeness" sub="Issued mutamers with MOFA No" action="Visa Desk" color={VISA_C}>
          {!v ? (
            <EmptyState tone="light" title="No MOFA figures" hint="Completeness is issuedWithMofa / issuedTotal from the Visa Desk." />
          ) : (
            <>
              <div className="text-3xl font-black mb-1" style={{ color:VISA_C, fontFamily:"var(--font-mono)" }}>
                {v.mofa.completePercent}%
              </div>
              <div className="text-[10px] mb-3" style={{ color:ERP.muted }}>
                {v.mofa.issuedWithMofa} of {v.mofa.issuedTotal} issued · pending {v.mofa.pendingPercent}%
              </div>
              <MBar label="Complete" value={v.mofa.issuedWithMofa} max={Math.max(1, v.mofa.issuedTotal)} color={ERP.success} />
              <MBar label="Pending" value={Math.max(0, v.mofa.issuedTotal - v.mofa.issuedWithMofa)} max={Math.max(1, v.mofa.issuedTotal)} color={ERP.warning} />
              <p className="text-[9px] mt-3" style={{ color:ERP.muted }}>{v.mofa.note}</p>
            </>
          )}
        </DCard>
      }
      widgets={[
        <DCard title="Long Stay Red Cards" sub="Day-85 due · Day-90 escalated" action="Long Stay" color={ERP.destructive}>
          {!v ? (
            <EmptyState tone="light" title="No Long Stay figures" hint="Red cards come from the Day-85 compliance pack on LongStay." />
          ) : (
            <>
              <MBar label="Day-85 Due" value={v.longStay.due} max={Math.max(1, v.longStay.total)} color={ERP.destructive} />
              <MBar label="Day-90 Escalated" value={v.longStay.escalated} max={Math.max(1, v.longStay.total)} color={ERP.destructive} />
              <MBar label="Approaching" value={v.longStay.approaching} max={Math.max(1, v.longStay.total)} color={ERP.warning} />
              <MBar label="Resolved" value={v.longStay.resolved} max={Math.max(1, v.longStay.total)} color={ERP.success} />
              <div className="text-[9px] mt-2" style={{ color:ERP.muted }}>
                Host complete {v.longStay.hostCompletePercent}% ({v.longStay.hostComplete}/{v.longStay.total}) · red cards {v.longStay.redCards}
              </div>
            </>
          )}
        </DCard>,
        <DCard title="Gate Readiness" sub="Active groups · T001-09 gates" action="Group Master" color={CAT.orange}>
          {!v ? (
            <EmptyState tone="light" title="No gate figures" hint="gateVisa / package / payment / bill rollup over active groups." />
          ) : (
            <>
              <MBar label="Ready (all gates)" value={v.gates.ready} max={gateMax} color={ERP.success} />
              <MBar label="Waiting Visa" value={v.gates.waitingVisa} max={gateMax} color={VISA_C} />
              <MBar label="Waiting Package" value={v.gates.waitingPackage} max={gateMax} color={ERP.info} />
              <MBar label="Waiting Payment" value={v.gates.waitingPayment} max={gateMax} color={ERP.warning} />
              <MBar label="Waiting Bill" value={v.gates.waitingBill} max={gateMax} color={CAT.purple} />
              <div className="text-[9px] mt-2" style={{ color:ERP.muted }}>
                {v.gates.activeGroups} active groups
              </div>
            </>
          )}
        </DCard>,
        <DCard title="Biometric & Arrival Risk" sub="Ops Command backlog" action="Visa Desk" color={ERP.warning}>
          {!v ? (
            <EmptyState tone="light" title="No backlog figures" hint="Biometric registered / arriving ≤7d not issued." />
          ) : (
            <>
              <div className="rounded-xl p-3 mb-2" style={{ backgroundColor:ERP.surfaceSoft, border:`1px solid ${erpAlpha(ERP.warning, 20)}` }}>
                <div className="text-[10px]" style={{ color:ERP.muted }}>Biometric registered, visa not issued</div>
                <div className="text-xl font-black" style={{ color:ERP.warning, fontFamily:"var(--font-mono)" }}>{v.backlog.biometricNotIssued}</div>
              </div>
              <div className="rounded-xl p-3 mb-2" style={{ backgroundColor:ERP.surfaceSoft, border:`1px solid ${erpAlpha(CAT.orange, 20)}` }}>
                <div className="text-[10px]" style={{ color:ERP.muted }}>Groups arriving ≤{v.backlog.arrivingSoon.days}d still not issued</div>
                <div className="text-xl font-black" style={{ color:CAT.orange, fontFamily:"var(--font-mono)" }}>{v.backlog.arrivingSoon.groups}</div>
                <div className="text-[9px] mt-0.5" style={{ color:ERP.muted }}>{v.backlog.arrivingSoon.mutamersNotIssued} mutamers</div>
              </div>
              <div className="rounded-xl p-3" style={{ backgroundColor:ERP.surfaceSoft, border:`1px solid ${erpAlpha(ERP.destructive, 20)}` }}>
                <div className="text-[10px]" style={{ color:ERP.muted }}>Rejected (open)</div>
                <div className="text-xl font-black" style={{ color:ERP.destructive, fontFamily:"var(--font-mono)" }}>{v.backlog.rejectedOpen}</div>
              </div>
            </>
          )}
        </DCard>,
      ]}
    />
  );
}

// ─── 3. Finance Dashboard ─────────────────────────────────────────────────────

const FIN_AR = [["0–30 days",850,ERP.success],["31–60 days",620,ERP.warning],["61–90 days",450,CAT.orange],["90+ days",220,ERP.destructive]];

function FinanceDash() {
  const { data: live, loading, error, refetch } = useDash<FinDashData>("/dashboards/finance");
  const demo = !isLoggedIn();
  if (loading) return <DashLoading />;
  if (error) return <DashError onRetry={refetch} />;
  const k = live?.kpis;
  const cashData = live
    ? live.cashTrend.map(c => ({ m: monthLabel(c.month), cash: Math.round(c.total / 1000) }))
    : FIN_CASH;
  const AR_COLORS = [ERP.success,ERP.warning,CAT.orange,ERP.destructive];
  const finAr: [string, number, string][] = live
    ? live.arAging.map((a, i) => [a.bucket, Math.round(a.amount / 1000), AR_COLORS[i] ?? DASH])
    : FIN_AR as [string, number, string][];
  const finArTotalRaw = live ? live.arAging.reduce((s, a) => s + a.amount, 0) : 2140000;
  const finArTotalK = Math.round(finArTotalRaw / 1000);
  return (
    <DashFrame
      kpis={[
        <DKpi label="Cash Position"        value={k ? fmtSAR(k.cashPosition) : "—"} sub={k ? "—" : "—"}      color={ERP.success} icon={CreditCard}   />,
        <DKpi label="Accounts Receivable"  value={k ? fmtSAR(k.accountsReceivable) : "—"} sub={k ? "—" : "—"} color={ERP.warning}     icon={ArrowDownLeft} />,
        <DKpi label="Accounts Payable"     value={k ? fmtSAR(k.accountsPayable) : "—"}  sub={k ? "—" : "—"} color={ERP.destructive}                   icon={ArrowUpRight}  />,
        <DKpi label="YTD Net Profit"       value={k ? fmtSAR(k.netProfit) : "—"} sub={k ? `Margin: ${k.netMargin.toFixed(1)}%` : "Margin: 19.3%"}         color={ERP.success} icon={TrendingUp}   />,
      ]}
      main={
        <DCard title="Cash Position — 2025" sub="Monthly closing balance (SAR K)" action="Finance ERP" color={ERP.success}>
          {cashData.length === 0 ? (
            <EmptyState tone="light" title="No cash movement yet" hint="Closing balances appear once payments are recorded." />
          ) : (
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={cashData} margin={{ top:4, right:4, bottom:0, left:0 }}>
              <defs>
                <linearGradient id="cashGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={ERP.success} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={ERP.success} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={ERP.mutedSoft} />
              <XAxis dataKey="m" tick={{ fill:ERP.muted, fontSize:9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill:ERP.muted, fontSize:9 }} axisLine={false} tickLine={false} tickFormatter={v=>`${v}K`} />
              <Tooltip content={<CTip prefix="SAR " />} />
              <Area type="monotone" dataKey="cash" name="Cash (SAR K)" stroke={ERP.success} strokeWidth={2.5} fill="url(#cashGrad)" />
            </AreaChart>
          </ResponsiveContainer>
          )}
        </DCard>
      }
      side={
        <DCard title="AR Aging Summary" sub={`Total: SAR ${finArTotalRaw.toLocaleString()}`} action="AR Desk" color={ERP.success}>
          <div className="space-y-3 pt-1">
            {finAr.length === 0 && (
              <EmptyState tone="light" title="Nothing outstanding" hint="Unpaid invoices are bucketed here by age." />
            )}
            {finAr.map(([l,v,c]) => {
              // finArTotalK is 0 for a tenant with no receivables — avoid a NaN bar width
              const pct = finArTotalK ? Math.round((v as number)/finArTotalK*100) : 0;
              return (
                <div key={l as string}>
                  <div className="flex justify-between mb-1.5 text-[10px]">
                    <span style={{ color:ERP.navy }}>{l}</span>
                    <span className="font-bold font-mono" style={{ color:c as string, fontFamily:"var(--font-mono)" }}>SAR {(v as number).toLocaleString()}</span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ backgroundColor:ERP.surfaceSoft }}>
                    <div className="h-full rounded-full" style={{ width:`${pct}%`, backgroundColor:c as string }} />
                  </div>
                </div>
              );
            })}
          </div>
        </DCard>
      }
      widgets={[
        <DCard title="Revenue by Category" color={ERP.success}>
          <EmptyState tone="light" title="প্রস্তুত নয়" hint="এই মডিউল এখনও কনফিগার করা হয়নি।" />
        </DCard>,
        <DCard title="AP Aging" color={ERP.success}>
          <EmptyState tone="light" title="প্রস্তুত নয়" hint="এই মডিউল এখনও কনফিগার করা হয়নি।" />
        </DCard>,
        <DCard title="Recent Transactions" color={ERP.success}>
          <EmptyState tone="light" title="প্রস্তুত নয়" hint="এই মডিউল এখনও কনফিগার করা হয়নি।" />
        </DCard>,
      ]}
    />
  );
}

// ─── 4. Dispatch Dashboard ────────────────────────────────────────────────────

const DSP_MAP: Record<string,[string,string]> = {
  ASSIGNED:  [ERP.warning,"ASSIGNED"], EN_ROUTE: [DASH,"EN ROUTE"],
  DELIVERED: [ERP.success,"DELIVERED"], DELAYED: [ERP.destructive,"DELAYED"],
};
const DISPATCHES = [
  { id:"DSP-001", from:"KAIA T1", to:"Jabal Omar Hyatt",  driver:"Ahmed Hassan",  pax:47, status:"EN_ROUTE",  eta:"14m", pct:65 },
  { id:"DSP-002", from:"KAIA T2", to:"Makkah Towers",     driver:"Khalid Salem",  pax:32, status:"DELIVERED", eta:"—",   pct:100},
  { id:"DSP-003", from:"Grand Mosque", to:"KAIA T1",      driver:"Omar Faisal",   pax:38, status:"EN_ROUTE",  eta:"22m", pct:40 },
  { id:"DSP-004", from:"Madinah Hlt.", to:"KAIA T2",      driver:"Sami Al-Din",   pax:26, status:"ASSIGNED",  eta:"~1h", pct:0  },
  { id:"DSP-005", from:"KAIA T1", to:"Marriott Makkah",   driver:"Tariq Nassir",  pax:52, status:"EN_ROUTE",  eta:"8m",  pct:85 },
  { id:"DSP-006", from:"Hilton Makkah", to:"KAIA T2",     driver:"Bassem Khalil", pax:31, status:"DELAYED",   eta:"45m", pct:20 },
];

function DispatchDash() {
  const { data: live, loading, error, refetch } = useDash<DispatchDashData>("/dashboards/dispatch");
  const demo = !isLoggedIn();
  if (loading) return <DashLoading />;
  if (error) return <DashError onRetry={refetch} />;
  const k = live?.kpis;
  const dispatches = live
    ? live.orders.map(o => ({
        id: o.code,
        from: o.routeFrom,
        to: o.routeTo,
        driver: o.driver?.name ?? "—",
        pax: o.pax,
        status: o.status,
        eta: "—",
        pct: o.progressPct,
      }))
    : DISPATCHES;
  return (
    <DashFrame
      kpis={[
        <DKpi label="Active Dispatches"  value={k ? String(k.activeDispatches) : "6"}   sub={k ? "—" : "3 en route · 1 assigned"}  color={CAT.orange} icon={Truck}       />,
        <DKpi label="Delivered Today"    value={k ? String(k.deliveredToday) : "2"}   sub={k ? "—" : "—"}          color={ERP.success} icon={CheckCircle} />,
        <DKpi label="Total Pax Moving"   value={k ? String(k.totalPaxMoving) : "194"} sub={k ? "—" : "Across 6 vehicles"}         color={DASH} icon={Users}       />,
        <DKpi label="Delayed"            value={k ? String(k.delayed) : "1"}   sub={k ? "—" : "DSP-006 · +25m SLA breach"} color={ERP.destructive}                        icon={AlertTriangle} />,
      ]}
      main={
        <DCard title="Live Dispatch Status" sub="All active vehicles" action="Ops Control" color={CAT.orange}>
          <div className="space-y-3">
            {dispatches.length === 0 && (
              <EmptyState tone="light" title="No active dispatches" hint="Vehicles appear here once a transport order is assigned." />
            )}
            {dispatches.map(d => {
              const [sc] = DSP_MAP[d.status] ?? [DASH];
              return (
                <div key={d.id} className="rounded-xl p-3" style={{ backgroundColor:ERP.surfaceSoft, border:`1px solid ${ERP.border}`, borderLeft:`3px solid ${sc}` }}>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-[9px] font-black" style={{ color:CAT.orange, fontFamily:"var(--font-mono)" }}>{d.id}</span>
                    <span className="flex-1 min-w-0 truncate text-[10px] font-semibold text-[color:var(--erp-text-strong)]" title={`${d.from} → ${d.to}`}>{d.from} → {d.to}</span>
                    <SPill s={d.status} map={DSP_MAP} />
                    <span className="text-[9px] font-bold font-mono" style={{ color:sc, fontFamily:"var(--font-mono)" }}>ETA {d.eta}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[9px] min-w-0 truncate" title={`${d.driver} · ${d.pax} pax`} style={{ color:ERP.muted }}>{d.driver} · {d.pax} pax</span>
                    <div className="flex-1 h-1.5 rounded-full" style={{ backgroundColor:ERP.surfaceSoft }}>
                      <div className="h-full rounded-full" style={{ width:`${d.pct}%`, backgroundColor:sc }} />
                    </div>
                    <span className="text-[9px] font-bold" style={{ color:sc }}>{d.pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </DCard>
      }
      side={
        <DCard title="Driver Status" color={CAT.orange}>
          <EmptyState tone="light" title="প্রস্তুত নয়" hint="এই মডিউল এখনও কনফিগার করা হয়নি।" />
        </DCard>
      }
      widgets={[
        <DCard title="Vehicle Utilization" color={CAT.orange}>
          <EmptyState tone="light" title="প্রস্তুত নয়" hint="এই মডিউল এখনও কনফিগার করা হয়নি।" />
        </DCard>,
        <DCard title="SLA Compliance — Today" color={CAT.orange}>
          <EmptyState tone="light" title="প্রস্তুত নয়" hint="এই মডিউল এখনও কনফিগার করা হয়নি।" />
        </DCard>,
        <DCard title="Route Performance" color={CAT.orange}>
          <EmptyState tone="light" title="প্রস্তুত নয়" hint="এই মডিউল এখনও কনফিগার করা হয়নি।" />
        </DCard>,
      ]}
    />
  );
}

// ─── 5. Arrival Board Summary ─────────────────────────────────────────────────

const ARRIVALS = [
  { flight:"SV-802", airline:"Saudia",   from:"DAC", pax:47, status:"AT_GATE",   time:"08:45", grp:"GRP-2891", bus:"Bus A", cleared:47 },
  { flight:"BG-088", airline:"Biman BD", from:"DAC", pax:32, status:"EN_ROUTE",  time:"11:20", grp:"GRP-2744", bus:"—",     cleared:0  },
  { flight:"PK-901", airline:"PIA",      from:"KHI", pax:67, status:"SCHEDULED", time:"15:40", grp:"GRP-3301", bus:"—",     cleared:0  },
];
const ARR_MAP: Record<string,[string,string]> = {
  AT_GATE:[ERP.success,"AT GATE"], EN_ROUTE:[DASH,"EN ROUTE"], SCHEDULED:[ERP.muted,"SCHEDULED"],
  IMMIGRATION:[ERP.warning,"IMMIGRATION"], BAGGAGE:[ERP.warning,"BAGGAGE"], DELIVERED:[ERP.success,"DELIVERED"],
};

function ArrivalDash() {
  const { data: live, loading, error, refetch } = useDash<FlightBoardData>("/dashboards/arrivals");
  const demo = !isLoggedIn();
  if (loading) return <DashLoading />;
  if (error) return <DashError onRetry={refetch} />;
  const k = live?.kpis;
  const arrivals = live
    ? live.flights.map(f => ({
        flight: f.flightNo,
        airline: f.airline,
        from: "—",
        pax: f.paxCount,
        status: f.status,
        time: hhmm(f.scheduledAt),
        grp: f.group?.code ?? "—",
        bus: "—",
        cleared: f.status === "DELIVERED" ? f.paxCount : 0,
      }))
    : ARRIVALS;
  const totalPax = k ? k.totalPax : arrivals.reduce((s,a)=>s+a.pax,0);
  const cleared  = k ? k.processedPax : arrivals.reduce((s,a)=>s+a.cleared,0);
  return (
    <DashFrame
      kpis={[
        <DKpi label="Flights Today"    value={k ? String(k.flights) : "3"}          sub={k ? "—" : "1 landed · 1 inbound · 1 later"} color={DASH}      icon={Plane}         />,
        <DKpi label="Total Inbound Pax"value={String(totalPax)} sub={k ? "—" : "Across 3 flights"}         color={ERP.info} icon={Users}      />,
        <DKpi label="Cleared & Bussed" value={String(cleared)}  sub={`${totalPax ? Math.round(cleared/totalPax*100) : 0}% of today`} color={ERP.success} icon={CheckCircle} />,
        <DKpi label="Pending Clearance"value={k ? String(k.pendingPax) : String(totalPax-cleared)} sub={k ? "—" : "2 flights not yet landed"} color={ERP.warning} icon={Clock} />,
      ]}
      main={
        <DCard title="Today's Arrivals" sub="16 Jul 2025 · KAIA Jeddah" action="Live Board" color={DASH}>
          <div className="space-y-3">
            {arrivals.length === 0 && (
              <EmptyState tone="light" title="No arrivals scheduled" hint="Inbound flights appear here once groups are booked." />
            )}
            {arrivals.map(a => {
              const [sc,sl] = ARR_MAP[a.status] ?? [DASH, a.status];
              return (
                <div key={a.flight} className="rounded-xl p-4" style={{ backgroundColor:ERP.surfaceSoft, border:`1px solid ${ERP.border}`, borderLeft:`3px solid ${sc}` }}>
                  <div className="flex items-center gap-3 mb-2">
                    <Plane size={14} style={{ color:sc }} />
                    <span className="text-base font-black text-[color:var(--erp-text-strong)]">{a.flight}</span>
                    <span className="text-xs min-w-0 truncate" title={`${a.airline} · ${a.from}`} style={{ color:ERP.muted }}>{a.airline} · {a.from}</span>
                    <span className="ml-auto shrink-0 text-xl font-black tabular-nums" style={{ color:sc, fontFamily:"var(--font-mono)" }}>{a.pax}</span>
                    <span className="text-xs shrink-0" style={{ color:ERP.muted }}>pax</span>
                    <SPill s={a.status} map={ARR_MAP} />
                  </div>
                  <div className="flex items-center gap-4 text-[10px]">
                    <span style={{ color:ERP.muted }}>ETD {a.time}</span>
                    <span style={{ color:ERP.muted }}>Group: <span className="text-[color:var(--erp-text-strong)] font-bold">{a.grp}</span></span>
                    <span style={{ color:ERP.muted }}>Bus: <span className="text-[color:var(--erp-text-strong)] font-bold">{a.bus}</span></span>
                    {a.cleared > 0 && a.pax > 0 && (
                      <div className="flex-1 flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full" style={{ backgroundColor:ERP.surfaceSoft }}>
                          <div className="h-full rounded-full" style={{ width:`${a.cleared/a.pax*100}%`, backgroundColor:ERP.success }} />
                        </div>
                        <span className="font-bold" style={{ color:ERP.success }}>{a.cleared}/{a.pax} cleared</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </DCard>
      }
      side={
        <DCard title="Ground Services Queue" color={DASH}>
          <EmptyState tone="light" title="প্রস্তুত নয়" hint="এই মডিউল এখনও কনফিগার করা হয়নি।" />
        </DCard>
      }
      widgets={[
        <DCard title="Immigration Queue" color={DASH}>
          <EmptyState tone="light" title="প্রস্তুত নয়" hint="এই মডিউল এখনও কনফিগার করা হয়নি।" />
        </DCard>,
        <DCard title="Bus Assignments" color={DASH}>
          <EmptyState tone="light" title="প্রস্তুত নয়" hint="এই মডিউল এখনও কনফিগার করা হয়নি।" />
        </DCard>,
        <DCard title="Today's Summary" color={DASH}>
          <EmptyState tone="light" title="প্রস্তুত নয়" hint="এই মডিউল এখনও কনফিগার করা হয়নি।" />
        </DCard>,
      ]}
    />
  );
}

// ─── 6. Departure Board Summary ───────────────────────────────────────────────

const DEPARTURES = [
  { flight:"SV-801", airline:"Saudia",   to:"DAC", pax:38, status:"BOARDING",  time:"13:30", grp:"GRP-2203", gate:"G12", checkedIn:38 },
  { flight:"BG-089", airline:"Biman BD", to:"CGP", pax:26, status:"CHECK_IN",  time:"17:15", grp:"GRP-2101", gate:"H04", checkedIn:14 },
];
const DEP_MAP: Record<string,[string,string]> = {
  CHECK_IN:[ERP.warning,"CHECK-IN"], BOARDING:[DASH,"BOARDING"],
  DEPARTED:[ERP.success,"DEPARTED"], STANDBY:[ERP.muted,"STANDBY"], DELAYED:[ERP.destructive,"DELAYED"],
};

function DepartureDash() {
  const { data: live, loading, error, refetch } = useDash<FlightBoardData>("/dashboards/departures");
  const demo = !isLoggedIn();
  if (loading) return <DashLoading />;
  if (error) return <DashError onRetry={refetch} />;
  const k = live?.kpis;
  const departures = live
    ? live.flights.map(f => ({
        flight: f.flightNo,
        airline: f.airline,
        to: "—",
        pax: f.paxCount,
        status: f.status,
        time: hhmm(f.scheduledAt),
        grp: f.group?.code ?? "—",
        gate: "—",
        checkedIn: (f.status === "BOARDING" || f.status === "DEPARTED") ? f.paxCount : 0,
      }))
    : DEPARTURES;
  return (
    <DashFrame
      kpis={[
        <DKpi label="Flights Departing"  value={k ? String(k.flights) : "2"}   sub={k ? "—" : "1 boarding · 1 check-in"}    color={DASH}    icon={Plane}       />,
        <DKpi label="Total Outbound Pax" value={k ? String(k.totalPax) : "64"}  sub={k ? "—" : "Across 2 groups"}            color={CAT.teal} icon={Users}       />,
        <DKpi label="Check-In Completed" value={k ? String(k.processedPax) : "52"}  sub={k ? "—" : "81% of today's departures"}  color={ERP.success} icon={CheckCircle} />,
        <DKpi label="Gates Open"         value="2"   sub="G12 (SV-801) · H04 (BG-089)" color={ERP.warning}                   icon={ArrowUpRight}  />,
      ]}
      main={
        <DCard title="Today's Departures" sub="16 Jul 2025 · KAIA Jeddah" action="Live Board" color={DASH}>
          <div className="space-y-3">
            {departures.length === 0 && (
              <EmptyState tone="light" title="No departures scheduled" hint="Outbound flights appear here once groups are booked." />
            )}
            {departures.map(d => {
              const [sc] = DEP_MAP[d.status] ?? [DASH];
              return (
                <div key={d.flight} className="rounded-xl p-4" style={{ backgroundColor:ERP.surfaceSoft, border:`1px solid ${ERP.border}`, borderLeft:`3px solid ${sc}` }}>
                  <div className="flex items-center gap-3 mb-2">
                    <Plane size={14} style={{ color:sc, transform:"rotate(45deg)" }} />
                    <span className="text-base font-black text-[color:var(--erp-text-strong)]">{d.flight}</span>
                    <span className="text-xs min-w-0 truncate" title={`${d.airline} → ${d.to}`} style={{ color:ERP.muted }}>{d.airline} → {d.to}</span>
                    <span className="ml-auto shrink-0 text-xl font-black tabular-nums" style={{ color:sc, fontFamily:"var(--font-mono)" }}>{d.pax}</span>
                    <span className="text-xs shrink-0" style={{ color:ERP.muted }}>pax</span>
                    <SPill s={d.status} map={DEP_MAP} />
                  </div>
                  <div className="flex items-center gap-4 text-[10px] mb-2">
                    <span style={{ color:ERP.muted }}>STD {d.time}</span>
                    <span style={{ color:ERP.muted }}>Gate: <span className="font-bold text-[color:var(--erp-text-strong)]">{d.gate}</span></span>
                    <span style={{ color:ERP.muted }}>Group: <span className="font-bold text-[color:var(--erp-text-strong)]">{d.grp}</span></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px]" style={{ color:ERP.muted }}>Check-In</span>
                    <div className="flex-1 h-1.5 rounded-full" style={{ backgroundColor:ERP.surfaceSoft }}>
                      <div className="h-full rounded-full" style={{ width:`${d.pax ? d.checkedIn/d.pax*100 : 0}%`, backgroundColor:sc }} />
                    </div>
                    <span className="text-[9px] font-bold shrink-0 tabular-nums" style={{ color:sc }}>{d.checkedIn}/{d.pax}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </DCard>
      }
      side={
        <DCard title="Departure Actions Queue" color={DASH}>
          <EmptyState tone="light" title="প্রস্তুত নয়" hint="এই মডিউল এখনও কনফিগার করা হয়নি।" />
        </DCard>
      }
      widgets={[
        <DCard title="Baggage Status" color={DASH}>
          <EmptyState tone="light" title="প্রস্তুত নয়" hint="এই মডিউল এখনও কনফিগার করা হয়নি।" />
        </DCard>,
        <DCard title="Gate Information" color={DASH}>
          <EmptyState tone="light" title="প্রস্তুত নয়" hint="এই মডিউল এখনও কনফিগার করা হয়নি।" />
        </DCard>,
        <DCard title="Today's Summary" color={DASH}>
          <EmptyState tone="light" title="প্রস্তুত নয়" hint="এই মডিউল এখনও কনফিগার করা হয়নি।" />
        </DCard>,
      ]}
    />
  );
}

// ─── 7. Agent Dashboard ───────────────────────────────────────────────────────

const AGT_C = CAT.purple;

function AgentDash() {
  const { data: live, loading, error, refetch } = useDash<AgentDashData>("/dashboards/agent");
  if (loading) return <DashLoading />;
  if (error) return <DashError onRetry={refetch} />;
  const k = live?.kpis;
  const paxData = live
    ? live.paxTrend.map(p => ({ m: monthLabel(p.month), pax: p.pax }))
    : AGT_TREND;
  const agentGroups: [string,string,string,string][] = live
    ? live.groups.map(g => [g.code, `${g.paxCount} pax`, g.opsStatus || g.status, g.status === "COMPLETED" ? ERP.success : ERP.warning] as [string,string,string,string])
    : [["GRP-2891","47 pax · Jabal Omar","In Progress",ERP.success],["GRP-2401","28 pax · Makkah Towers","In Progress",ERP.warning]];
  const agentInvoices: [string,string,string,string][] = live
    ? live.invoices.map(v => [v.code, `SAR ${v.total.toLocaleString()}`, v.status === "PAID" ? "Paid" : "Outstanding", v.status === "PAID" ? ERP.success : ERP.warning] as [string,string,string,string])
    : [["INV-1446-0091","SAR 323,725","Outstanding",ERP.warning],["INV-1446-0087","SAR 202,400","Paid",ERP.success],["INV-1446-0082","SAR 448,500","Paid",ERP.success]];
  // T002-09 §12 — Agent Visa Status card (tenant-scoped pipeline from /dashboards/agent).
  const visa = live?.visa;
  const visaMax = visa ? Math.max(1, ...VISA_PIPELINE_ORDER.map((s) => visa.pipeline[s] ?? 0)) : 1;
  return (
    <DashFrame
      kpis={[
        <DKpi label="Wallet Balance"     value={k ? fmtSAR(k.walletBalance, k.currency) : "—"}  sub={k ? "—" : "Rashidi Travel Co."}         color={AGT_C}    icon={Wallet}      />,
        <DKpi label="Active Groups"      value={k ? String(k.activeGroups) : "2"}           sub={k ? "—" : "GRP-2891 · GRP-2401"}        color={DASH} icon={Users}      />,
        <DKpi label="Season Groups"      value={k ? String(k.seasonGroups) : "5"}           sub="Season 1446H total"          color={ERP.success} icon={Activity}   />,
        <DKpi label="Outstanding Inv."   value={k ? fmtSAR(k.outstandingAmount) : "—"}  sub={k ? "—" : "INV-1446-0091 · Net 30d"}    color={ERP.warning}                      icon={ClipboardList}/>,
      ]}
      main={
        <DCard title="Monthly Pax Volume — 2025" sub="Season 1446H bookings" action="All Groups" color={AGT_C}>
          {paxData.length === 0 ? (
            <EmptyState tone="light" title="No passenger volume yet" hint="Monthly pax counts appear once groups are booked." />
          ) : (
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={paxData} margin={{ top:4, right:4, bottom:0, left:0 }}>
              <defs>
                <linearGradient id="agtGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={AGT_C} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={AGT_C} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={ERP.mutedSoft} />
              <XAxis dataKey="m" tick={{ fill:ERP.muted, fontSize:9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill:ERP.muted, fontSize:9 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CTip />} />
              <Area type="monotone" dataKey="pax" name="Passengers" stroke={AGT_C} strokeWidth={2.5} fill="url(#agtGrad)" />
            </AreaChart>
          </ResponsiveContainer>
          )}
        </DCard>
      }
      side={
        <DCard title="Recent Activity" color={AGT_C}>
          <EmptyState tone="light" title="প্রস্তুত নয়" hint="এই মডিউল এখনও কনফিগার করা হয়নি।" />
        </DCard>
      }
      widgets={[
        <DCard title="Active Groups" color={AGT_C}>
          {agentGroups.length === 0
            ? <EmptyState tone="light" title="No groups yet" hint="Your booked groups will be listed here." />
            : agentGroups.map(([g,d,s,c]) => (
              <div key={g as string} className="rounded-xl p-3 mb-2" style={{ backgroundColor:ERP.surfaceSoft, border:`1px solid ${erpAlpha(c as string, 13)}` }}>
                <div className="flex justify-between mb-1"><span className="text-xs font-bold text-[color:var(--erp-text-strong)] min-w-0 truncate" title={g as string}>{g}</span><span className="text-[9px] font-black shrink-0 whitespace-nowrap" style={{ color:c as string }}>{s}</span></div>
                <div className="text-[9px] truncate" title={d as string} style={{ color:ERP.muted }}>{d}</div>
              </div>
            ))}
        </DCard>,
        <DCard title="Visa Status — Season 1446H" sub="Tenant-scoped mutamer pipeline" action="Visa Desk" color={AGT_C}>
          {!visa ? (
            <EmptyState tone="light" title="No visa figures" hint="Scoped pipeline counts appear once the agent has mutamers on the desk." />
          ) : (
            <>
              {VISA_PIPELINE_ORDER
                .filter((s) => (visa.pipeline[s] ?? 0) > 0 || ["NEW", "PROCESSING", "ISSUED", "REJECTED"].includes(s))
                .slice(0, 7)
                .map((s) => (
                  <MBar key={s} label={s.replace(/_/g, " ")} value={visa.pipeline[s] ?? 0} max={visaMax} color={AGT_C} />
                ))}
              <div className="text-[9px] mt-2" style={{ color:ERP.muted }}>
                Not issued {visa.notIssued} · MOFA complete {visa.mofaCompletePercent}%
              </div>
            </>
          )}
        </DCard>,
        <DCard title="Invoice Summary" color={AGT_C}>
          {agentInvoices.length === 0
            ? <EmptyState tone="light" title="No invoices yet" hint="Invoices are listed here once they are issued." />
            : agentInvoices.map(([id,amt,s,c]) => (
              <div key={id as string} className="py-2" style={{ borderBottom:`1px solid ${ERP.border}` }}>
                <div className="flex justify-between text-[10px]"><span className="font-bold text-[color:var(--erp-text-strong)] min-w-0 truncate" title={id as string}>{id}</span><span className="font-black shrink-0 whitespace-nowrap" style={{ color:c as string }}>{s}</span></div>
                <div className="text-[9px] mt-0.5 whitespace-nowrap tabular-nums" style={{ color:ERP.muted }}>{amt}</div>
              </div>
            ))}
        </DCard>,
      ]}
    />
  );
}

// ─── 8. Supplier Dashboard ────────────────────────────────────────────────────

const SUP_C = ERP.warning;

function SupplierDash() {
  const { data: live, loading, error, refetch } = useDash<SupplierDashData>("/dashboards/supplier");
  const demo = !isLoggedIn();
  if (loading) return <DashLoading />;
  if (error) return <DashError onRetry={refetch} />;
  const k = live?.kpis;
  return (
    <DashFrame
      kpis={[
        <DKpi label="Pending Bookings"   value={k ? String(k.pendingBookings) : "3"}          sub={k ? "—" : "GRP-2891, GRP-2744, GRP-3301"}  color={SUP_C}  icon={Package}     />,
        <DKpi label="Invoices Outstanding"value={k ? fmtSAR(k.invoicesOutstanding) : "—"} sub={k ? "—" : "Jabal Omar Hyatt — 1 invoice"}  color={ERP.warning}   icon={ClipboardList}/>,
        <DKpi label="This Season Revenue" value={k ? fmtSAR(k.seasonRevenue) : "—"}  sub="Hotel contract value 1446H"    color={ERP.success} icon={TrendingUp}  />,
        <DKpi label="Upcoming Services"   value={k ? String(k.upcomingServices) : "5"}         sub={k ? "—" : "—"}        color={DASH} icon={CheckCircle} />,
      ]}
      main={
        <DCard title="Booking Forecast — Aug–Nov 2025" color={SUP_C}>
          <EmptyState tone="light" title="প্রস্তুত নয়" hint="এই মডিউল এখনও কনফিগার করা হয়নি।" />
        </DCard>
      }
      side={
        <DCard title="Booking Acceptance Queue" color={SUP_C}>
          <EmptyState tone="light" title="প্রস্তুত নয়" hint="এই মডিউল এখনও কনফিগার করা হয়নি।" />
        </DCard>
      }
      widgets={[
        <DCard title="Upcoming Services" color={SUP_C}>
          <EmptyState tone="light" title="প্রস্তুত নয়" hint="এই মডিউল এখনও কনফিগার করা হয়নি।" />
        </DCard>,
        <DCard title="Payment Schedule" color={SUP_C}>
          <EmptyState tone="light" title="প্রস্তুত নয়" hint="এই মডিউল এখনও কনফিগার করা হয়নি।" />
        </DCard>,
        <DCard title="Performance Metrics" color={SUP_C}>
          <EmptyState tone="light" title="প্রস্তুত নয়" hint="এই মডিউল এখনও কনফিগার করা হয়নি।" />
        </DCard>,
      ]}
    />
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const LABELS: Record<DashScreen, string> = {
  today: "আজকের কাজ",
  ceo: "নির্বাহী",
  reports: "রিপোর্ট",
  ops: "Operations",
  visa: "Visa & Compliance",
  finance: "Finance",
  dispatch: "Dispatch",
  arrival: "Arrival Board",
  departure: "Departure Board",
  agent: "Agent View",
  supplier: "Supplier View",
};

export default function Dashboards() {
  const navItems = useMemo(() => filterNavByPerms(DASH_NAV, DASH_NAV_PERMS), []);
  const [screen, setScreen] = useState<DashScreen>(() => {
    if (navItems.some((n) => n.id === "today")) return "today";
    return (navItems[0]?.id as DashScreen) ?? "today";
  });

  useEffect(() => {
    if (navItems.length && !navItems.some((n) => n.id === screen)) {
      setScreen((navItems[0].id as DashScreen) ?? "today");
    }
  }, [navItems, screen]);

  const body =
    screen === "today" ? <OpsTodayDashboard />
      : screen === "ceo" ? <ExecutiveDashboard onOpenReports={() => setScreen("reports")} />
        : screen === "reports" ? <ReportsManagementView onOpenExecutive={() => setScreen("ceo")} />
          : screen === "ops" ? <OpsDash />
            : screen === "visa" ? <VisaDash />
              : screen === "finance" ? <FinanceDash />
                : screen === "dispatch" ? <DispatchDash />
                  : screen === "arrival" ? <ArrivalDash />
                    : screen === "departure" ? <DepartureDash />
                      : screen === "agent" ? <AgentDash />
                        : screen === "supplier" ? <SupplierDash />
                          : null;

  const lazyTab = screen === "today" || screen === "ceo" || screen === "reports";

  return (
    <ErpThemeProvider theme="ds"><ERPShell
      moduleId="dashboards"
      moduleName="Dashboards"
      moduleColor={DASH}
      moduleIcon={CalendarCheck2 as IconFC}
      navItems={navItems}
      activeItem={screen}
      onItemClick={(id) => setScreen(id as DashScreen)}
      breadcrumb={[LABELS[screen] ?? screen]}
      notificationCount={0}
    >
      <div className="h-full overflow-hidden">
        {lazyTab ? <Suspense fallback={<RouteFallback />}>{body}</Suspense> : body}
      </div>
    </ERPShell></ErpThemeProvider>
  );
}
