/**
 * Module 10 Phase 10F — Flight Operations Command Center.
 * Pure orchestration over 10A–10E: no new model, table, status system, timeline
 * store or permission. Cross-domain values that cannot be resolved from existing
 * APIs render "—" — never inferred.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  Radar, Plane, PlaneLanding, PlaneTakeoff, Truck, Users, AlertTriangle,
  RefreshCw, Timer, ExternalLink, CheckCircle2, Clock, XCircle,
} from "lucide-react";
import { ERPShell, type NavItem, type IconFC } from "../components/ERPShell";
import { ErrorState, EmptyState } from "../components/States";
import {
  ERP, erpAlpha, ErpThemeProvider, ErpTabs, ErpDataTable, type ErpColumn, ErpStatCard,
  ErpSearchBar, ErpButton, ErpDrawer, ErpSelect, ErpStatusChip, ErpPagination,
  ErpField, ErpInput, type ErpStatusKind,
} from "../components/erp";
import { api } from "../lib/api";
import { useLang } from "../lib/LangContext";
import { fontFor } from "@tuba/shared";

type View = "all" | "arrivals" | "departures" | "ground" | "meet" | "exceptions";

interface Row {
  id: string; flightDate: string; direction: "ARRIVAL" | "DEPARTURE"; status: string;
  scheduledTime: string; estimatedTime: string | null; actualTime: string | null;
  gate: string | null; terminal: { id: string; name: string } | null; isTestData: boolean;
  flightMaster: { flightNumber: string; airline?: { code: string; name: string }; origin?: { iata: string; city: string }; destination?: { iata: string; city: string } };
  delayMinutes: number | null; groundStatus: string | null; meetAssistStatus: string | null; dispatchCount: number;
}
interface Overview {
  date: string | null; todaysFlights: number; arrivals: number; departures: number;
  delayed: number; cancelled: number; atGate: number; enRoute: number;
  groundDispatches: number; meetAssistPending: number; exceptions: number;
}
interface Exc { id: string; kind: string; severity: "high" | "medium"; subject: string; reason: string; at: string | null }
interface Detail {
  flight: Row;
  operations: { id: string; code: string; status: string; vehicle: string | null; driver: string | null; scheduledAt: string; group: string | null }[];
  meetAssist: { resolved: boolean; status: string | null; completed: number; total: number; current: string | null; exceptions: number; checklist: { id: string; stepNo: number; task: string; status: string }[] };
  timeline: { direction: string; current: string; steps: { status: string; reached: boolean; current: boolean }[]; history: { operation: string; from?: string; to?: string; at: string; actor: string }[] };
}

const FLIGHT_STATUSES = ["SCHEDULED", "CHECK_IN", "BOARDING", "DEPARTED", "EN_ROUTE", "LANDING", "AT_GATE", "ARRIVED", "DELIVERED", "DELAYED", "RESCHEDULED", "CANCELLED"];
const flightKind = (s: string): ErpStatusKind =>
  ["DELIVERED", "ARRIVED", "AT_GATE"].includes(s) ? "approved" : s === "CANCELLED" ? "rejected"
    : ["DELAYED", "RESCHEDULED"].includes(s) ? "warning" : s === "SCHEDULED" ? "pending" : "info";
const groundKind = (s: string): ErpStatusKind =>
  s === "COMPLETED" ? "approved" : s === "CANCELLED" ? "rejected" : s === "DELAYED" || s === "UNASSIGNED" ? "warning" : "info";
const maKind = (s: string): ErpStatusKind =>
  s === "COMPLETED" ? "approved" : s === "EXCEPTION" ? "rejected" : s === "SKIPPED" ? "warning" : s === "PENDING" ? "pending" : "info";

const hhmm = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(11, 16) : "—");
const dmy = (iso: string | null) => (iso ? iso.slice(0, 10) : "—");
const stamp = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 16).replace("T", " ") : "—");
const dash = (v: string | null | undefined) => (v == null || v === "" ? "—" : v);

export default function CommandCenter() {
  const { lang } = useLang();
  const navigate = useNavigate();
  const [view, setView] = useState<View>("all");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [direction, setDirection] = useState("all");
  const [airlineId, setAirlineId] = useState("all");
  const [airportId, setAirportId] = useState("all");
  const [terminalId, setTerminalId] = useState("all");
  const [page, setPage] = useState(1);
  const PAGE = 15;

  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [ov, setOv] = useState<Overview | null>(null);
  const [excs, setExcs] = useState<Exc[]>([]);
  const [opts, setOpts] = useState<{ airlines: { id: string; code: string }[]; airports: { id: string; iata: string }[]; terminals: { id: string; name: string; airport?: { iata: string } }[] } | null>(null);
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [detail, setDetail] = useState<Detail | null>(null);
  const inFlight = useRef(false);

  const dirFor = view === "arrivals" ? "ARRIVAL" : view === "departures" ? "DEPARTURE" : direction;

  const load = useCallback(async (silent = false) => {
    if (inFlight.current) return;
    inFlight.current = true;
    if (!silent) setState("loading");
    try {
      const p = new URLSearchParams({ page: String(page), pageSize: String(PAGE) });
      if (date) p.set("date", date);
      if (dirFor !== "all") p.set("direction", dirFor);
      if (status !== "all") p.set("status", status);
      if (airlineId !== "all") p.set("airlineId", airlineId);
      if (airportId !== "all") p.set("airportId", airportId);
      if (terminalId !== "all") p.set("terminalId", terminalId);
      if (q.trim()) p.set("search", q.trim());
      if (view === "ground") p.set("ground", "has");
      if (view === "meet") p.set("meetAssist", "has");
      const calls: Promise<unknown>[] = [
        api.get<{ rows: Row[]; total: number }>(`/command-center/board?${p}`),
        api.get<Overview>(`/command-center/overview${date ? `?date=${date}` : ""}`),
      ];
      if (view === "exceptions") calls.push(api.get<Exc[]>(`/command-center/exceptions${date ? `?date=${date}` : ""}`));
      const res = await Promise.all(calls);
      const board = res[0] as { rows: Row[]; total: number };
      setRows(board.rows); setTotal(board.total); setOv(res[1] as Overview);
      if (view === "exceptions") setExcs(res[2] as Exc[]);
      setState("ready");
    } catch { setState("error"); }
    finally { inFlight.current = false; }
  }, [page, date, dirFor, status, airlineId, airportId, terminalId, q, view]);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => { api.get<typeof opts>("/command-center/options").then(setOpts).catch(() => setOpts(null)); }, []);

  // Polling only — ops.gateway.ts remains the single real-time infrastructure (see report).
  useEffect(() => { const t = setInterval(() => { void load(true); }, 30_000); return () => clearInterval(t); }, [load]);

  const openDetail = async (row: Row) => {
    setDetail(null);
    try { setDetail(await api.get<Detail>(`/command-center/flights/${row.id}`)); } catch { /* silently keep board */ }
  };

  const delayCell = (r: Row) => {
    if (r.delayMinutes === null) return <span className="text-[11px]" style={{ color: ERP.mutedSoft }}>—</span>;
    const m = r.delayMinutes;
    if (m > 0) return <span className="text-[11px] font-bold tabular-nums" style={{ color: m >= 30 ? ERP.destructive : ERP.warning, fontFamily: "var(--font-mono)" }}>+{m}m</span>;
    if (m < 0) return <span className="text-[11px] tabular-nums" style={{ color: ERP.success, fontFamily: "var(--font-mono)" }}>{m}m</span>;
    return <span className="text-[11px]" style={{ color: ERP.success }}>{lang === "bn" ? "সময়মতো" : "On time"}</span>;
  };

  const cols: ErpColumn<Row>[] = [
    { id: "status", header: lang === "bn" ? "স্ট্যাটাস" : "Status", cell: (r) => <ErpStatusChip status={flightKind(r.status)} label={r.status.replace(/_/g, " ")} /> },
    { id: "fn", header: lang === "bn" ? "ফ্লাইট" : "Flight", cell: (r) => (
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-bold" style={{ color: ERP.accent, fontFamily: "var(--font-mono)" }}>{r.flightMaster.flightNumber}</span>
        {r.isTestData && <span className="text-[9px] px-1 py-0.5 rounded" style={{ backgroundColor: erpAlpha(ERP.warning, 12), color: ERP.warning }}>TEST</span>}
      </div>
    ) },
    { id: "airline", header: lang === "bn" ? "এয়ারলাইন" : "Airline", cell: (r) => <span className="text-[11px]" style={{ color: ERP.muted }}>{dash(r.flightMaster.airline?.code)}</span> },
    { id: "dir", header: lang === "bn" ? "ধরন" : "Direction", cell: (r) => <span className="text-[11px] font-semibold" style={{ color: r.direction === "ARRIVAL" ? ERP.info : ERP.success }}>{r.direction}</span> },
    { id: "org", header: lang === "bn" ? "উৎস" : "Origin", cell: (r) => <span className="text-[11px]" style={{ color: ERP.muted, fontFamily: "var(--font-mono)" }}>{dash(r.flightMaster.origin?.iata)}</span> },
    { id: "dst", header: lang === "bn" ? "গন্তব্য" : "Destination", cell: (r) => <span className="text-[11px]" style={{ color: ERP.muted, fontFamily: "var(--font-mono)" }}>{dash(r.flightMaster.destination?.iata)}</span> },
    { id: "term", header: lang === "bn" ? "টার্মিনাল" : "Terminal", cell: (r) => <span className="text-[11px]" style={{ color: ERP.muted }}>{dash(r.terminal?.name)}</span> },
    { id: "gate", header: lang === "bn" ? "গেট" : "Gate", align: "center", cell: (r) => <span className="text-[11px]" style={{ color: ERP.navy }}>{dash(r.gate)}</span> },
    { id: "sched", header: lang === "bn" ? "নির্ধারিত" : "Scheduled", align: "center", cell: (r) => <span className="text-[11px] tabular-nums" style={{ color: ERP.navy, fontFamily: "var(--font-mono)" }}>{hhmm(r.scheduledTime)}</span> },
    { id: "est", header: lang === "bn" ? "আনুমানিক" : "Estimated", align: "center", cell: (r) => <span className="text-[11px] tabular-nums" style={{ color: ERP.muted, fontFamily: "var(--font-mono)" }}>{hhmm(r.estimatedTime)}</span> },
    { id: "act", header: lang === "bn" ? "প্রকৃত" : "Actual", align: "center", cell: (r) => <span className="text-[11px] tabular-nums" style={{ color: ERP.muted, fontFamily: "var(--font-mono)" }}>{hhmm(r.actualTime)}</span> },
    { id: "delay", header: lang === "bn" ? "বিলম্ব" : "Delay", align: "center", cell: delayCell },
    { id: "ground", header: lang === "bn" ? "গ্রাউন্ড" : "Ground Status", cell: (r) => r.groundStatus
      ? <ErpStatusChip status={groundKind(r.groundStatus)} label={r.groundStatus.replace(/_/g, " ")} />
      : <span className="text-[11px]" style={{ color: ERP.mutedSoft }}>—</span> },
    { id: "ma", header: lang === "bn" ? "মিট অ্যান্ড অ্যাসিস্ট" : "Meet & Assist", cell: (r) => r.meetAssistStatus
      ? <ErpStatusChip status={maKind(r.meetAssistStatus)} label={r.meetAssistStatus.replace(/_/g, " ")} />
      : <span className="text-[11px]" style={{ color: ERP.mutedSoft }}>—</span> },
  ];

  const excCols: ErpColumn<Exc>[] = [
    { id: "sev", header: lang === "bn" ? "গুরুত্ব" : "Severity", cell: (e) => <ErpStatusChip status={(e.severity === "high" ? "rejected" : "warning") as ErpStatusKind} label={e.severity.toUpperCase()} /> },
    { id: "kind", header: lang === "bn" ? "ধরন" : "Type", cell: (e) => <span className="text-[11px] font-semibold" style={{ color: ERP.navy, fontFamily: "var(--font-mono)" }}>{e.kind.replace(/_/g, " ")}</span> },
    { id: "subj", header: lang === "bn" ? "বিষয়" : "Subject", cell: (e) => <span className="text-xs font-bold" style={{ color: ERP.accent }}>{e.subject}</span> },
    { id: "why", header: lang === "bn" ? "কারণ" : "Why it is exceptional", cell: (e) => <span className="text-[11px]" style={{ color: ERP.muted }}>{e.reason}</span> },
    { id: "at", header: lang === "bn" ? "সময়" : "At", cell: (e) => <span className="text-[10px]" style={{ color: ERP.mutedSoft, fontFamily: "var(--font-mono)" }}>{stamp(e.at)}</span> },
  ];

  const kpi = (label: string, v: number | undefined, accent: string, icon?: React.ReactNode) => <ErpStatCard label={label} value={String(v ?? 0)} accent={accent} icon={icon} />;

  const kpis = (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {kpi(lang === "bn" ? "আজকের ফ্লাইট" : "Today's Flights", ov?.todaysFlights, ERP.accent, <Plane size={16} style={{ color: ERP.accent }} />)}
        {kpi(lang === "bn" ? "আগমন" : "Arrivals", ov?.arrivals, ERP.info, <PlaneLanding size={16} style={{ color: ERP.info }} />)}
        {kpi(lang === "bn" ? "প্রস্থান" : "Departures", ov?.departures, ERP.success, <PlaneTakeoff size={16} style={{ color: ERP.success }} />)}
        {kpi(lang === "bn" ? "বিলম্বিত" : "Delayed", ov?.delayed, ERP.warning, <Clock size={16} style={{ color: ERP.warning }} />)}
        {kpi(lang === "bn" ? "বাতিল" : "Cancelled", ov?.cancelled, ERP.destructive, <XCircle size={16} style={{ color: ERP.destructive }} />)}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {kpi(lang === "bn" ? "অ্যাট গেট" : "At Gate", ov?.atGate, ERP.success, <CheckCircle2 size={16} style={{ color: ERP.success }} />)}
        {kpi(lang === "bn" ? "এন রুট" : "En Route", ov?.enRoute, ERP.info)}
        {kpi(lang === "bn" ? "গ্রাউন্ড ডিসপ্যাচ" : "Ground Dispatches", ov?.groundDispatches, ERP.accent, <Truck size={16} style={{ color: ERP.accent }} />)}
        {kpi(lang === "bn" ? "মিট অ্যান্ড অ্যাসিস্ট পেন্ডিং" : "Meet & Assist Pending", ov?.meetAssistPending, ERP.warning, <Users size={16} style={{ color: ERP.warning }} />)}
        {kpi(lang === "bn" ? "ব্যতিক্রম" : "Exceptions", ov?.exceptions, ERP.destructive, <AlertTriangle size={16} style={{ color: ERP.destructive }} />)}
      </div>
    </div>
  );

  const deepLink = (label: string, path: string) => (
    <ErpButton size="sm" variant="outline" icon={<ExternalLink size={13} />} onClick={() => navigate(path)}>{label}</ErpButton>
  );

  const body = state === "error" ? <div className="p-7"><ErrorState tone="light" onRetry={() => void load()} /></div> : (
    <div className="p-7 space-y-4">
      <ErpTabs active={view} onChange={(id) => { setView(id as View); setPage(1); }} ariaLabel={lang === "bn" ? "কমান্ড সেন্টার" : "Command center views"}
        tabs={[
          { id: "all", label: lang === "bn" ? "সব ফ্লাইট" : "All Flights", icon: Plane },
          { id: "arrivals", label: lang === "bn" ? "আগমন" : "Arrivals", icon: PlaneLanding },
          { id: "departures", label: lang === "bn" ? "প্রস্থান" : "Departures", icon: PlaneTakeoff },
          { id: "ground", label: lang === "bn" ? "গ্রাউন্ড অপারেশনস" : "Ground Operations", icon: Truck },
          { id: "meet", label: lang === "bn" ? "মিট অ্যান্ড অ্যাসিস্ট" : "Meet & Assist", icon: Users },
          { id: "exceptions", label: lang === "bn" ? "ব্যতিক্রম" : "Exceptions", icon: AlertTriangle },
        ]} />

      {kpis}

      <div className="flex flex-wrap gap-3 items-end">
        <div className="w-40"><ErpField label={lang === "bn" ? "তারিখ" : "Date"}><ErpInput type="date" value={date} onChange={(e) => { setDate(e.target.value); setPage(1); }} /></ErpField></div>
        {view !== "exceptions" && (<>
          <div className="flex-1 min-w-[12rem]"><ErpSearchBar lang={lang} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} onClear={() => { setQ(""); setPage(1); }} placeholder={lang === "bn" ? "ফ্লাইট নম্বর…" : "Flight number…"} /></div>
          {view === "all" && <div className="w-32"><ErpField label={lang === "bn" ? "ধরন" : "Direction"}><ErpSelect value={direction} onChange={(e) => { setDirection(e.target.value); setPage(1); }}><option value="all">{lang === "bn" ? "সব" : "All"}</option><option value="ARRIVAL">ARRIVAL</option><option value="DEPARTURE">DEPARTURE</option></ErpSelect></ErpField></div>}
          <div className="w-40"><ErpField label={lang === "bn" ? "স্ট্যাটাস" : "Status"}><ErpSelect value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="all">{lang === "bn" ? "সব" : "All"}</option>{FLIGHT_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}</ErpSelect></ErpField></div>
          <div className="w-28"><ErpField label={lang === "bn" ? "এয়ারলাইন" : "Airline"}><ErpSelect value={airlineId} onChange={(e) => { setAirlineId(e.target.value); setPage(1); }}><option value="all">{lang === "bn" ? "সব" : "All"}</option>{(opts?.airlines ?? []).map((a) => <option key={a.id} value={a.id}>{a.code}</option>)}</ErpSelect></ErpField></div>
          <div className="w-28"><ErpField label={lang === "bn" ? "বিমানবন্দর" : "Airport"}><ErpSelect value={airportId} onChange={(e) => { setAirportId(e.target.value); setPage(1); }}><option value="all">{lang === "bn" ? "সব" : "All"}</option>{(opts?.airports ?? []).map((a) => <option key={a.id} value={a.id}>{a.iata}</option>)}</ErpSelect></ErpField></div>
          <div className="w-40"><ErpField label={lang === "bn" ? "টার্মিনাল" : "Terminal"}><ErpSelect value={terminalId} onChange={(e) => { setTerminalId(e.target.value); setPage(1); }}><option value="all">{lang === "bn" ? "সব" : "All"}</option>{(opts?.terminals ?? []).map((t) => <option key={t.id} value={t.id}>{t.airport?.iata} · {t.name}</option>)}</ErpSelect></ErpField></div>
        </>)}
        <ErpButton variant="secondary" icon={<RefreshCw size={14} />} onClick={() => void load()}>{lang === "bn" ? "রিফ্রেশ" : "Refresh"}</ErpButton>
        {view === "ground" && deepLink(lang === "bn" ? "গ্রাউন্ড অপস" : "Open Ground Ops", "/ground-ops")}
        {view === "meet" && deepLink(lang === "bn" ? "মিট অ্যান্ড অ্যাসিস্ট" : "Open Meet & Assist", "/meet-assist")}
      </div>

      {view === "exceptions" ? (
        excs.length === 0
          ? <EmptyState tone="light" title={lang === "bn" ? "কোনো ব্যতিক্রম নেই" : "No operational exceptions"} hint={lang === "bn" ? "সব ফ্লাইট, ডিসপ্যাচ ও চেকলিস্ট স্বাভাবিক।" : "All flights, dispatches and checklists are within normal state for this date."} />
          : <ErpDataTable columns={excCols} rows={excs} rowKey={(e) => e.id} lang={lang} emptyTitle="" />
      ) : (
        <>
          <ErpDataTable
            columns={cols} rows={state === "loading" ? [] : rows} rowKey={(r) => r.id} loading={state === "loading"} lang={lang}
            onRowClick={(r) => void openDetail(r)}
            emptyTitle={lang === "bn" ? "কোনো ফ্লাইট নেই" : "No flights match these filters"}
            emptyHint={view === "meet"
              ? (lang === "bn" ? "মিট অ্যান্ড অ্যাসিস্ট শুধু তখনই দেখা যায় যখন ডিসপ্যাচ ফ্লাইট ও গ্রুপ সেগমেন্ট দুটোই যুক্ত করে।" : "Meet & Assist resolves only where a dispatch links both the operational flight and the group segment.")
              : (lang === "bn" ? "তারিখ বা ফিল্টার পরিবর্তন করুন।" : "Adjust the date or filters above.")}
          />
          <ErpPagination page={page} pageSize={PAGE} total={total} onPageChange={setPage} lang={lang} />
        </>
      )}
      <div className="flex items-center gap-1.5 text-[10px]" style={{ color: ERP.mutedSoft }}><Timer size={11} /> {lang === "bn" ? "প্রতি ৩০ সেকেন্ডে রিফ্রেশ" : "Auto-refreshes every 30s"}</div>
    </div>
  );

  const NAV: NavItem[] = [{ id: "command-center", label: "Command Center", labelBn: "কমান্ড সেন্টার", icon: Radar as IconFC }];

  return (
    <ErpThemeProvider theme="ds"><ERPShell
      moduleId="command-center" moduleName={lang === "bn" ? "ফ্লাইট কমান্ড সেন্টার" : "Flight Ops Command Center"}
      moduleColor={ERP.accent} moduleIcon={Radar as IconFC} navItems={NAV} activeItem="command-center"
      onItemClick={() => { /* single-item module nav */ }}
      breadcrumb={[lang === "bn" ? "কমান্ড সেন্টার" : "Command Center"]} notificationCount={0}
    >
      <div className="flex flex-col h-full overflow-hidden" style={{ fontFamily: fontFor(lang) }}>
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>{body}</div>
      </div>

      <ErpDrawer open={!!detail} onClose={() => setDetail(null)} lang={lang}
        title={detail?.flight.flightMaster.flightNumber ?? ""}
        subtitle={detail ? `${detail.flight.flightMaster.airline?.name ?? ""} · ${detail.flight.direction}` : undefined}>
        {detail && (
          <div className="space-y-5">
            {/* FLIGHT */}
            <Section title={lang === "bn" ? "ফ্লাইট" : "Flight"}>
              <div className="grid grid-cols-2 gap-3">
                {([
                  [lang === "bn" ? "ফ্লাইট নম্বর" : "Flight Number", detail.flight.flightMaster.flightNumber],
                  [lang === "bn" ? "এয়ারলাইন" : "Airline", dash(detail.flight.flightMaster.airline?.name)],
                  [lang === "bn" ? "উৎস" : "Origin", dash(detail.flight.flightMaster.origin?.iata)],
                  [lang === "bn" ? "গন্তব্য" : "Destination", dash(detail.flight.flightMaster.destination?.iata)],
                  [lang === "bn" ? "তারিখ" : "Date", dmy(detail.flight.flightDate)],
                  [lang === "bn" ? "ধরন" : "Direction", detail.flight.direction],
                  [lang === "bn" ? "টার্মিনাল" : "Terminal", dash(detail.flight.terminal?.name)],
                  [lang === "bn" ? "গেট" : "Gate", dash(detail.flight.gate)],
                  [detail.flight.direction === "ARRIVAL" ? "STA" : "STD", hhmm(detail.flight.scheduledTime)],
                  [detail.flight.direction === "ARRIVAL" ? "ETA" : "ETD", hhmm(detail.flight.estimatedTime)],
                  [lang === "bn" ? "প্রকৃত" : "Actual", hhmm(detail.flight.actualTime)],
                  [lang === "bn" ? "বিলম্ব" : "Delay", detail.flight.delayMinutes === null ? "—" : `${detail.flight.delayMinutes > 0 ? "+" : ""}${detail.flight.delayMinutes}m`],
                ] as [string, string][]).map(([k, v]) => <Cell key={k} k={k} v={v} />)}
              </div>
              <div className="mt-2"><ErpStatusChip status={flightKind(detail.flight.status)} label={detail.flight.status.replace(/_/g, " ")} /></div>
            </Section>

            {/* OPERATIONS */}
            <Section title={lang === "bn" ? "অপারেশনস" : "Operations"}>
              {detail.operations.length === 0
                ? <div className="text-[11px]" style={{ color: ERP.mutedSoft }}>{lang === "bn" ? "কোনো ডিসপ্যাচ নেই — «—»" : "No dispatch linked to this flight — “—”"}</div>
                : <div className="space-y-2">{detail.operations.map((o) => (
                    <div key={o.id} className="rounded-xl px-3 py-2 flex flex-wrap items-center gap-2" style={{ backgroundColor: ERP.surfaceSoft, border: `1px solid ${ERP.border}` }}>
                      <span className="text-xs font-bold" style={{ color: ERP.accent, fontFamily: "var(--font-mono)" }}>{o.code}</span>
                      <ErpStatusChip status={groundKind(o.status)} label={o.status.replace(/_/g, " ")} />
                      <span className="text-[11px]" style={{ color: ERP.muted }}>{lang === "bn" ? "যানবাহন" : "Vehicle"}: {dash(o.vehicle)}</span>
                      <span className="text-[11px]" style={{ color: ERP.muted }}>{lang === "bn" ? "চালক" : "Driver"}: {dash(o.driver)}</span>
                    </div>))}
                  </div>}
            </Section>

            {/* MEET & ASSIST */}
            <Section title={lang === "bn" ? "মিট অ্যান্ড অ্যাসিস্ট" : "Meet & Assist"}>
              {!detail.meetAssist.resolved
                ? <div className="rounded-xl px-3 py-2 text-[11px]" style={{ backgroundColor: erpAlpha(ERP.info, 6), border: `1px solid ${erpAlpha(ERP.info, 15)}`, color: ERP.muted }}>
                    {lang === "bn"
                      ? "এই ফ্লাইটের জন্য মিট অ্যান্ড অ্যাসিস্ট রিজলভ করা যায়নি — «—»।"
                      : "Not resolvable for this flight — “—”. Meet & Assist attaches to the group segment (FlightInfo); it appears here only when a dispatch links both."}
                  </div>
                : <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {detail.meetAssist.status && <ErpStatusChip status={maKind(detail.meetAssist.status)} label={detail.meetAssist.status.replace(/_/g, " ")} />}
                      <span className="text-[11px]" style={{ color: ERP.muted }}>{detail.meetAssist.completed}/{detail.meetAssist.total} {lang === "bn" ? "সম্পন্ন" : "complete"}</span>
                      {detail.meetAssist.current && <span className="text-[11px]" style={{ color: ERP.navy }}>{lang === "bn" ? "চলমান" : "Current"}: {detail.meetAssist.current}</span>}
                      {detail.meetAssist.exceptions > 0 && <span className="text-[11px] font-bold" style={{ color: ERP.destructive }}>{detail.meetAssist.exceptions} {lang === "bn" ? "ব্যতিক্রম" : "exception(s)"}</span>}
                    </div>
                    <div className="space-y-1">{detail.meetAssist.checklist.map((c) => (
                      <div key={c.id} className="flex justify-between gap-2 px-3 py-1.5 rounded-lg text-[11px]" style={{ backgroundColor: ERP.surfaceSoft }}>
                        <span style={{ color: ERP.navy }}>{c.stepNo}. {c.task}</span>
                        <ErpStatusChip status={maKind(c.status)} label={c.status.replace(/_/g, " ")} />
                      </div>))}
                    </div>
                  </div>}
            </Section>

            {/* TIMELINE — reuses the 10B operational-flight timeline */}
            <Section title={lang === "bn" ? "টাইমলাইন" : "Timeline"}>
              <div className="relative pl-5">
                <div className="absolute left-[9px] top-2 bottom-2 w-px" style={{ backgroundColor: ERP.border }} />
                <div className="space-y-3">
                  {detail.timeline.steps.map((s) => (
                    <div key={s.status} className="flex items-start gap-3">
                      <div className="z-10 w-[18px] h-[18px] rounded-full shrink-0 flex items-center justify-center"
                        style={s.reached ? { backgroundColor: erpAlpha(ERP.success, 13), border: `1px solid ${erpAlpha(ERP.success, 38)}` } : { backgroundColor: ERP.surfaceSoft, border: `1px solid ${ERP.border}` }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.current ? ERP.accent : s.reached ? ERP.success : ERP.border }} />
                      </div>
                      <span className="text-xs font-semibold" style={{ color: s.current ? ERP.accent : s.reached ? ERP.navy : ERP.muted }}>
                        {s.status.replace(/_/g, " ")}{s.current ? (lang === "bn" ? " — বর্তমান" : " — current") : ""}
                      </span>
                    </div>))}
                </div>
              </div>
              {detail.timeline.history.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {detail.timeline.history.map((h, i) => (
                    <div key={i} className="flex justify-between gap-2 text-[11px] px-3 py-1.5 rounded-lg" style={{ backgroundColor: ERP.surfaceSoft }}>
                      <span style={{ color: ERP.navy }}>{h.from ? `${h.from} → ` : ""}{h.to ?? h.operation}</span>
                      <span style={{ color: ERP.mutedSoft }}>{h.actor} · {stamp(h.at)}</span>
                    </div>))}
                </div>
              )}
            </Section>
          </div>
        )}
      </ErpDrawer>
    </ERPShell></ErpThemeProvider>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: ERP.muted }}>{title}</div>
      {children}
    </div>
  );
}
function Cell({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-xl px-3 py-2" style={{ backgroundColor: ERP.surfaceSoft, border: `1px solid ${ERP.border}` }}>
      <div className="text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color: ERP.muted }}>{k}</div>
      <div className="text-xs font-semibold text-[color:var(--erp-text-strong)]">{v}</div>
    </div>
  );
}
