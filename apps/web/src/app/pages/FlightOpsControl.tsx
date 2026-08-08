/**
 * Module 10 Phase 10C — Flight Operations Control.
 * Live operational VISIBILITY over the Phase 10B OperationalFlight. Read-only:
 * status mutation stays in the 10B Flight Schedule screen (one status API, one
 * audit path). No new table, enum, permission or shared component.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Radar, PlaneLanding, PlaneTakeoff, RefreshCw, Clock, CheckCircle2, AlertTriangle, XCircle, Plane, Timer } from "lucide-react";
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

type View = "dashboard" | "arrivals" | "departures";

interface Master { id: string; flightNumber: string; airline?: { code: string; name: string }; origin?: { iata: string; city: string }; destination?: { iata: string; city: string } }
interface OpFlight {
  id: string; flightDate: string; direction: "ARRIVAL" | "DEPARTURE";
  scheduledTime: string; estimatedTime: string | null; actualTime: string | null;
  gate: string | null; status: string; remarks: string | null; isTestData: boolean;
  flightMaster: Master; terminal: { id: string; name: string } | null;
}
interface Dash {
  date: string | null; total: number; arrivals: number; departures: number;
  scheduled: number; checkIn: number; boarding: number; enRoute: number;
  atGate: number; delayed: number; cancelled: number; completed: number;
}
interface Timeline {
  direction: string; current: string;
  steps: { status: string; reached: boolean; current: boolean }[];
  offPath: string | null;
  history: { operation: string; from?: string; to?: string; at: string; actor: string }[];
}

const STATUSES = ["SCHEDULED", "CHECK_IN", "BOARDING", "DEPARTED", "EN_ROUTE", "LANDING", "AT_GATE", "ARRIVED", "DELIVERED", "DELAYED", "CANCELLED"];
const statusKind = (s: string): ErpStatusKind =>
  ["DELIVERED", "ARRIVED", "AT_GATE"].includes(s) ? "approved"
    : s === "CANCELLED" ? "rejected"
      : ["DELAYED", "RESCHEDULED"].includes(s) ? "warning"
        : s === "SCHEDULED" ? "pending" : "info";

const hhmm = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(11, 16) : "—");
const day = (iso: string) => iso.slice(0, 10);
const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * Delay from REAL timestamps only: (actual ?? estimated) − scheduled.
 * Returns null when no reliable timestamp exists — the caller renders "—".
 */
function delayMinutes(f: OpFlight): number | null {
  const ref = f.actualTime ?? f.estimatedTime;
  if (!ref || !f.scheduledTime) return null;
  const d = new Date(ref).getTime() - new Date(f.scheduledTime).getTime();
  if (isNaN(d)) return null;
  return Math.round(d / 60000);
}

export default function FlightOpsControl() {
  const { lang } = useLang();
  const [view, setView] = useState<View>("dashboard");
  const [date, setDate] = useState(todayIso());
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [airlineId, setAirlineId] = useState("all");
  const [airportId, setAirportId] = useState("all");
  const [terminalId, setTerminalId] = useState("all");
  const [page, setPage] = useState(1);
  const PAGE = 15;

  const [dash, setDash] = useState<Dash | null>(null);
  const [rows, setRows] = useState<OpFlight[]>([]);
  const [total, setTotal] = useState(0);
  const [airlines, setAirlines] = useState<{ id: string; code: string; name: string }[]>([]);
  const [airports, setAirports] = useState<{ id: string; iata: string; name: string }[]>([]);
  const [terminals, setTerminals] = useState<{ id: string; name: string; airport?: { iata: string } }[]>([]);
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [detail, setDetail] = useState<OpFlight | null>(null);
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const inFlight = useRef(false);

  const direction = view === "arrivals" ? "ARRIVAL" : view === "departures" ? "DEPARTURE" : null;

  // one loader for both the board and the dashboard; guarded against overlap
  const load = useCallback(async (silent = false) => {
    if (inFlight.current) return;            // no duplicate requests
    inFlight.current = true;
    if (!silent) setState("loading");
    try {
      if (!direction) {
        setDash(await api.get<Dash>(`/flight-ops/dashboard${date ? `?date=${date}` : ""}`));
      } else {
        const p = new URLSearchParams({ direction, page: String(page), pageSize: String(PAGE) });
        if (date) p.set("date", date);
        if (status !== "all") p.set("status", status);
        if (airlineId !== "all") p.set("airlineId", airlineId);
        if (airportId !== "all") p.set("airportId", airportId);
        if (terminalId !== "all") p.set("terminalId", terminalId);
        if (q.trim()) p.set("search", q.trim());
        const [list, d] = await Promise.all([
          api.get<{ rows: OpFlight[]; total: number }>(`/flight-ops?${p}`),
          api.get<Dash>(`/flight-ops/dashboard${date ? `?date=${date}` : ""}`),
        ]);
        setRows(list.rows); setTotal(list.total); setDash(d);
      }
      setState("ready");
    } catch { setState("error"); }
    finally { inFlight.current = false; }
  }, [direction, date, status, airlineId, airportId, terminalId, q, page]);

  useEffect(() => { void load(); }, [load]);

  // filter option lists (small reference sets, loaded once)
  useEffect(() => {
    Promise.all([
      api.get<{ id: string; code: string; name: string }[]>("/flight-master/airlines"),
      api.get<{ id: string; iata: string; name: string }[]>("/flight-master/airports"),
      api.get<{ id: string; name: string; airport?: { iata: string } }[]>("/flight-master/terminals"),
    ]).then(([al, ap, tm]) => { setAirlines(al); setAirports(ap); setTerminals(tm); }).catch(() => { /* filters degrade to All */ });
  }, []);

  // lightweight polling — 30s, preserves filters/page, cleaned up on unmount.
  // NOTE: a Socket.io ops gateway already exists (ops.gateway.ts / lib/opsSocket.ts);
  // it is intentionally NOT wired here — see the phase report.
  useEffect(() => {
    const t = setInterval(() => { void load(true); }, 30_000);
    return () => clearInterval(t);
  }, [load]);

  const openDetail = async (row: OpFlight) => {
    setDetail(row); setTimeline(null);
    try { setTimeline(await api.get<Timeline>(`/flight-ops/${row.id}/timeline`)); } catch { /* record still shown */ }
  };

  const delayCell = (f: OpFlight) => {
    const m = delayMinutes(f);
    if (m === null) return <span className="text-[11px]" style={{ color: ERP.mutedSoft }}>—</span>;
    if (m > 0) return <span className="text-[11px] font-bold tabular-nums" style={{ color: m >= 30 ? ERP.destructive : ERP.warning, fontFamily: "var(--font-mono)" }}>+{m}m</span>;
    if (m < 0) return <span className="text-[11px] tabular-nums" style={{ color: ERP.success, fontFamily: "var(--font-mono)" }}>{m}m</span>;
    return <span className="text-[11px]" style={{ color: ERP.success }}>{lang === "bn" ? "সময়মতো" : "On time"}</span>;
  };

  const cols: ErpColumn<OpFlight>[] = [
    { id: "status", header: lang === "bn" ? "স্ট্যাটাস" : "Status", cell: (r) => <ErpStatusChip status={statusKind(r.status)} label={r.status.replace(/_/g, " ")} /> },
    { id: "est", header: direction === "ARRIVAL" ? "ETA" : "ETD", align: "center", cell: (r) => <span className="text-[11px] tabular-nums" style={{ color: ERP.navy, fontFamily: "var(--font-mono)" }}>{hhmm(r.estimatedTime ?? r.scheduledTime)}</span> },
    { id: "fn", header: lang === "bn" ? "ফ্লাইট" : "Flight", cell: (r) => (
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-bold" style={{ color: ERP.accent, fontFamily: "var(--font-mono)" }}>{r.flightMaster.flightNumber}</span>
        {r.isTestData && <span className="text-[9px] px-1 py-0.5 rounded" style={{ backgroundColor: erpAlpha(ERP.warning, 12), color: ERP.warning }}>TEST</span>}
      </div>
    ) },
    { id: "airline", header: lang === "bn" ? "এয়ারলাইন" : "Airline", cell: (r) => <span className="text-[11px]" style={{ color: ERP.muted }}>{r.flightMaster.airline?.code}</span> },
    { id: "origin", header: lang === "bn" ? "উৎস" : "Origin", cell: (r) => <span className="text-[11px]" style={{ color: ERP.muted, fontFamily: "var(--font-mono)" }}>{r.flightMaster.origin?.iata}</span> },
    { id: "dest", header: lang === "bn" ? "গন্তব্য" : "Destination", cell: (r) => <span className="text-[11px]" style={{ color: ERP.muted, fontFamily: "var(--font-mono)" }}>{r.flightMaster.destination?.iata}</span> },
    { id: "term", header: lang === "bn" ? "টার্মিনাল" : "Terminal", cell: (r) => <span className="text-[11px]" style={{ color: ERP.muted }}>{r.terminal?.name ?? "—"}</span> },
    { id: "gate", header: lang === "bn" ? "গেট" : "Gate", align: "center", cell: (r) => <span className="text-[11px]" style={{ color: ERP.navy }}>{r.gate ?? "—"}</span> },
    { id: "actual", header: lang === "bn" ? "প্রকৃত" : "Actual", align: "center", cell: (r) => <span className="text-[11px] tabular-nums" style={{ color: ERP.muted, fontFamily: "var(--font-mono)" }}>{hhmm(r.actualTime)}</span> },
    { id: "delay", header: lang === "bn" ? "বিলম্ব" : "Delay", align: "center", cell: delayCell },
  ];

  const kpi = (label: string, value: number | undefined, accent: string, icon?: React.ReactNode) => (
    <ErpStatCard label={label} value={String(value ?? 0)} accent={accent} icon={icon} />
  );

  const dashboardView = (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {kpi(lang === "bn" ? "আজকের ফ্লাইট" : "Today's Flights", dash?.total, ERP.accent, <Plane size={16} style={{ color: ERP.accent }} />)}
        {kpi(lang === "bn" ? "আগমন" : "Arrivals", dash?.arrivals, ERP.info, <PlaneLanding size={16} style={{ color: ERP.info }} />)}
        {kpi(lang === "bn" ? "প্রস্থান" : "Departures", dash?.departures, ERP.success, <PlaneTakeoff size={16} style={{ color: ERP.success }} />)}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpi(lang === "bn" ? "নির্ধারিত" : "Scheduled", dash?.scheduled, ERP.muted, <Clock size={16} style={{ color: ERP.muted }} />)}
        {kpi(lang === "bn" ? "বোর্ডিং" : "Boarding", dash?.boarding, ERP.info)}
        {kpi(lang === "bn" ? "এন রুট" : "En Route", dash?.enRoute, ERP.info)}
        {kpi(lang === "bn" ? "অ্যাট গেট" : "At Gate", dash?.atGate, ERP.success)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {kpi(lang === "bn" ? "বিলম্বিত" : "Delayed", dash?.delayed, ERP.warning, <AlertTriangle size={16} style={{ color: ERP.warning }} />)}
        {kpi(lang === "bn" ? "বাতিল" : "Cancelled", dash?.cancelled, ERP.destructive, <XCircle size={16} style={{ color: ERP.destructive }} />)}
        {kpi(lang === "bn" ? "সম্পন্ন" : "Completed", dash?.completed, ERP.success, <CheckCircle2 size={16} style={{ color: ERP.success }} />)}
      </div>
      {dash && dash.total === 0 && (
        <EmptyState tone="light"
          title={lang === "bn" ? "এই তারিখে কোনো ফ্লাইট নেই" : "No flights on this date"}
          hint={lang === "bn" ? "উপরের তারিখ পরিবর্তন করুন। সংখ্যাগুলো লাইভ অ্যাগ্রিগেশন থেকে আসে।" : "Change the date above. All counts come from live server-side aggregation."} />
      )}
    </div>
  );

  const boardView = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpi(lang === "bn" ? "মোট" : direction === "ARRIVAL" ? "Arrivals" : "Departures", direction === "ARRIVAL" ? dash?.arrivals : dash?.departures, ERP.accent)}
        {kpi(lang === "bn" ? "চলমান" : "En Route", dash?.enRoute, ERP.info)}
        {kpi(lang === "bn" ? "বিলম্বিত" : "Delayed", dash?.delayed, ERP.warning)}
        {kpi(lang === "bn" ? "সম্পন্ন" : "Completed", dash?.completed, ERP.success)}
      </div>
      <ErpDataTable
        columns={cols} rows={state === "loading" ? [] : rows} rowKey={(r) => r.id} loading={state === "loading"} lang={lang}
        onRowClick={(r) => void openDetail(r)}
        emptyTitle={lang === "bn" ? "কোনো ফ্লাইট নেই" : "No flights match these filters"}
        emptyHint={lang === "bn" ? "তারিখ বা ফিল্টার পরিবর্তন করুন।" : "Adjust the date or filters above."}
      />
      <ErpPagination page={page} pageSize={PAGE} total={total} onPageChange={setPage} lang={lang} />
    </div>
  );

  const NAV: NavItem[] = [{ id: "ops-control", label: "Flight Ops Control", labelBn: "ফ্লাইট অপস কন্ট্রোল", icon: Radar as IconFC }];

  const body = state === "error" ? <div className="p-7"><ErrorState tone="light" onRetry={() => void load()} /></div> : (
    <div className="p-7 space-y-4">
      <ErpTabs
        active={view}
        onChange={(id) => { setView(id as View); setPage(1); }}
        ariaLabel={lang === "bn" ? "অপারেশন ভিউ" : "Operations views"}
        tabs={[
          { id: "dashboard", label: lang === "bn" ? "ড্যাশবোর্ড" : "Dashboard", icon: Radar },
          { id: "arrivals", label: lang === "bn" ? "আগমন বোর্ড" : "Arrival Board", icon: PlaneLanding },
          { id: "departures", label: lang === "bn" ? "প্রস্থান বোর্ড" : "Departure Board", icon: PlaneTakeoff },
        ]}
      />

      <div className="flex flex-wrap gap-3 items-end">
        <div className="w-40"><ErpField label={lang === "bn" ? "তারিখ" : "Date"}>
          <ErpInput type="date" value={date} onChange={(e) => { setDate(e.target.value); setPage(1); }} />
        </ErpField></div>
        {direction && (<>
          <div className="flex-1 min-w-[13rem]">
            <ErpSearchBar lang={lang} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} onClear={() => { setQ(""); setPage(1); }} placeholder={lang === "bn" ? "ফ্লাইট, এয়ারলাইন…" : "Flight, airline, airport…"} />
          </div>
          <div className="w-40"><ErpField label={lang === "bn" ? "স্ট্যাটাস" : "Status"}>
            <ErpSelect value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="all">{lang === "bn" ? "সব" : "All"}</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
            </ErpSelect>
          </ErpField></div>
          <div className="w-36"><ErpField label={lang === "bn" ? "এয়ারলাইন" : "Airline"}>
            <ErpSelect value={airlineId} onChange={(e) => { setAirlineId(e.target.value); setPage(1); }}>
              <option value="all">{lang === "bn" ? "সব" : "All"}</option>
              {airlines.map((a) => <option key={a.id} value={a.id}>{a.code}</option>)}
            </ErpSelect>
          </ErpField></div>
          <div className="w-36"><ErpField label={lang === "bn" ? "বিমানবন্দর" : "Airport"}>
            <ErpSelect value={airportId} onChange={(e) => { setAirportId(e.target.value); setPage(1); }}>
              <option value="all">{lang === "bn" ? "সব" : "All"}</option>
              {airports.map((a) => <option key={a.id} value={a.id}>{a.iata}</option>)}
            </ErpSelect>
          </ErpField></div>
          <div className="w-44"><ErpField label={lang === "bn" ? "টার্মিনাল" : "Terminal"}>
            <ErpSelect value={terminalId} onChange={(e) => { setTerminalId(e.target.value); setPage(1); }}>
              <option value="all">{lang === "bn" ? "সব" : "All"}</option>
              {terminals.map((t) => <option key={t.id} value={t.id}>{t.airport?.iata} · {t.name}</option>)}
            </ErpSelect>
          </ErpField></div>
        </>)}
        <ErpButton variant="secondary" icon={<RefreshCw size={14} />} onClick={() => void load()}>{lang === "bn" ? "রিফ্রেশ" : "Refresh"}</ErpButton>
      </div>

      {view === "dashboard" ? dashboardView : boardView}

      <div className="flex items-center gap-1.5 text-[10px]" style={{ color: ERP.mutedSoft }}>
        <Timer size={11} /> {lang === "bn" ? "প্রতি ৩০ সেকেন্ডে স্বয়ংক্রিয় রিফ্রেশ" : "Auto-refreshes every 30s"}
      </div>
    </div>
  );

  return (
    <ErpThemeProvider theme="ds"><ERPShell
      moduleId="flight-ops-control"
      moduleName={lang === "bn" ? "ফ্লাইট অপস কন্ট্রোল" : "Flight Ops Control"}
      moduleColor={ERP.accent}
      moduleIcon={Radar as IconFC}
      navItems={NAV}
      activeItem="ops-control"
      onItemClick={() => { /* single-item module nav */ }}
      breadcrumb={[lang === "bn" ? "ফ্লাইট অপস কন্ট্রোল" : "Flight Ops Control"]}
      notificationCount={0}
    >
      <div className="flex flex-col h-full overflow-hidden" style={{ fontFamily: fontFor(lang) }}>
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>{body}</div>
      </div>

      <ErpDrawer open={!!detail} onClose={() => { setDetail(null); setTimeline(null); }} lang={lang}
        title={detail?.flightMaster.flightNumber ?? ""} subtitle={detail ? `${detail.flightMaster.airline?.name} · ${detail.direction}` : undefined}>
        {detail && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <ErpStatusChip status={statusKind(detail.status)} label={detail.status.replace(/_/g, " ")} />
              {(() => { const m = delayMinutes(detail); return m === null
                ? <span className="text-[11px]" style={{ color: ERP.mutedSoft }}>{lang === "bn" ? "বিলম্ব তথ্য নেই" : "No delay data"}</span>
                : <span className="text-[11px] font-bold" style={{ color: m > 0 ? ERP.warning : ERP.success }}>{m > 0 ? `+${m}m` : m < 0 ? `${m}m` : (lang === "bn" ? "সময়মতো" : "On time")}</span>; })()}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {([
                [lang === "bn" ? "ফ্লাইট নম্বর" : "Flight Number", detail.flightMaster.flightNumber],
                [lang === "bn" ? "এয়ারলাইন" : "Airline", `${detail.flightMaster.airline?.code} · ${detail.flightMaster.airline?.name}`],
                [lang === "bn" ? "উৎস" : "Origin", `${detail.flightMaster.origin?.iata} — ${detail.flightMaster.origin?.city}`],
                [lang === "bn" ? "গন্তব্য" : "Destination", `${detail.flightMaster.destination?.iata} — ${detail.flightMaster.destination?.city}`],
                [lang === "bn" ? "তারিখ" : "Date", day(detail.flightDate)],
                [lang === "bn" ? "ধরন" : "Direction", detail.direction],
                [lang === "bn" ? "টার্মিনাল" : "Terminal", detail.terminal?.name ?? "—"],
                [lang === "bn" ? "গেট" : "Gate", detail.gate ?? "—"],
                [detail.direction === "ARRIVAL" ? "STA" : "STD", hhmm(detail.scheduledTime)],
                [detail.direction === "ARRIVAL" ? "ETA" : "ETD", hhmm(detail.estimatedTime)],
                [lang === "bn" ? "প্রকৃত সময়" : "Actual Time", hhmm(detail.actualTime)],
                [lang === "bn" ? "বর্তমান স্ট্যাটাস" : "Current Status", detail.status.replace(/_/g, " ")],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k} className="rounded-xl px-3 py-2" style={{ backgroundColor: ERP.surfaceSoft, border: `1px solid ${ERP.border}` }}>
                  <div className="text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color: ERP.muted }}>{k}</div>
                  <div className="text-xs font-semibold text-[color:var(--erp-text-strong)]">{v}</div>
                </div>
              ))}
            </div>

            {/* Timeline reuses the 10B API — no duplicate timeline storage. */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: ERP.muted }}>{lang === "bn" ? "অপারেশনাল টাইমলাইন" : "Operational Timeline"}</div>
              {!timeline ? <div className="text-[11px]" style={{ color: ERP.mutedSoft }}>…</div> : (
                <div className="relative pl-5">
                  <div className="absolute left-[9px] top-2 bottom-2 w-px" style={{ backgroundColor: ERP.border }} />
                  <div className="space-y-3">
                    {timeline.steps.map((s) => (
                      <div key={s.status} className="flex items-start gap-3">
                        <div className="z-10 w-[18px] h-[18px] rounded-full shrink-0 flex items-center justify-center"
                          style={s.reached ? { backgroundColor: erpAlpha(ERP.success, 13), border: `1px solid ${erpAlpha(ERP.success, 38)}` } : { backgroundColor: ERP.surfaceSoft, border: `1px solid ${ERP.border}` }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.current ? ERP.accent : s.reached ? ERP.success : ERP.border }} />
                        </div>
                        <span className="text-xs font-semibold" style={{ color: s.current ? ERP.accent : s.reached ? ERP.navy : ERP.muted }}>
                          {s.status.replace(/_/g, " ")}{s.current ? (lang === "bn" ? " — বর্তমান" : " — current") : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {timeline?.history?.length ? (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: ERP.muted }}>{lang === "bn" ? "ইতিহাস" : "History"}</div>
                <div className="space-y-1.5">
                  {timeline.history.map((h, i) => (
                    <div key={i} className="flex justify-between gap-2 text-[11px] px-3 py-1.5 rounded-lg" style={{ backgroundColor: ERP.surfaceSoft }}>
                      <span style={{ color: ERP.navy }}>{h.from ? `${h.from} → ` : ""}{h.to ?? h.operation}</span>
                      <span style={{ color: ERP.mutedSoft }}>{h.actor} · {new Date(h.at).toISOString().slice(0, 16).replace("T", " ")}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </ErpDrawer>
    </ERPShell></ErpThemeProvider>
  );
}
