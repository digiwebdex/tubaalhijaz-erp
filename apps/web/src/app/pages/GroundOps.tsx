/**
 * Module 10 Phase 10D — Ground Operations / Dispatch.
 * Built on the EXISTING DispatchOrder + DispatchStatus + Vehicle/Driver fleet.
 * No new model, enum, permission or shared component.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Truck, LayoutDashboard, Plus, RefreshCw, UserCog, Activity, Timer, Bus, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { ERPShell, type NavItem, type IconFC } from "../components/ERPShell";
import { ErrorState } from "../components/States";
import {
  ERP, erpAlpha, ErpThemeProvider, ErpTabs, ErpDataTable, type ErpColumn, ErpStatCard,
  ErpSearchBar, ErpButton, ErpModal, ErpDrawer, ErpSelect, ErpStatusChip, ErpPagination,
  ErpForm, ErpFormRow, ErpField, ErpInput, erpToast, type ErpStatusKind,
} from "../components/erp";
import { api, ApiError } from "../lib/api";
import { useLang } from "../lib/LangContext";
import { fontFor } from "@tuba/shared";

type View = "dashboard" | "board";
const DISPATCH_STATUSES = ["ASSIGNED", "EN_ROUTE", "COMPLETED", "DELAYED", "CANCELLED"];

interface Vehicle { id: string; code: string; type: string; plateNo: string | null; seats: number; status: string }
interface Driver { id: string; name: string; phone: string | null; status: string }
interface FlightRef {
  id: string; flightDate: string; direction: "ARRIVAL" | "DEPARTURE"; scheduledTime: string; status: string;
  terminal: { id: string; name: string } | null;
  flightMaster: { flightNumber: string; airline?: { code: string }; origin?: { id: string; iata: string }; destination?: { id: string; iata: string } };
}
interface Dispatch {
  id: string; code: string; status: string; routeFrom: string; routeTo: string; pax: number;
  scheduledAt: string; updatedAt: string; progressPct: number; note: string | null;
  operationalFlight: FlightRef | null; vehicle: Vehicle | null; driver: Driver | null; group: { id: string; code: string } | null;
}
interface Dash {
  date: string; todaysDispatches: number; unassigned: number; assigned: number; enRoute: number;
  completed: number; delayed: number; cancelled: number; unassignedFlights: number; availableVehicles: number;
}

const kind = (s: string): ErpStatusKind =>
  s === "COMPLETED" ? "approved" : s === "CANCELLED" ? "rejected" : s === "DELAYED" ? "warning" : s === "EN_ROUTE" ? "info" : "pending";
const hhmm = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(11, 16) : "—");
const dmy = (iso: string | null) => (iso ? iso.slice(0, 10) : "—");
const stamp = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 16).replace("T", " ") : "—");
/** Operating airport: where the ground team actually works. */
const opAirport = (f: FlightRef | null) => !f ? "—" : (f.direction === "ARRIVAL" ? f.flightMaster.destination?.iata : f.flightMaster.origin?.iata) ?? "—";

export default function GroundOps() {
  const { lang } = useLang();
  const [view, setView] = useState<View>("dashboard");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [direction, setDirection] = useState("all");
  const [airportId, setAirportId] = useState("all");
  const [terminalId, setTerminalId] = useState("all");
  const [vehicleId, setVehicleId] = useState("all");
  const [driverId, setDriverId] = useState("all");
  const [page, setPage] = useState(1);
  const PAGE = 15;

  const [rows, setRows] = useState<Dispatch[]>([]);
  const [total, setTotal] = useState(0);
  const [dash, setDash] = useState<Dash | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [airports, setAirports] = useState<{ id: string; iata: string }[]>([]);
  const [terminals, setTerminals] = useState<{ id: string; name: string; airport?: { iata: string } }[]>([]);
  const [flights, setFlights] = useState<FlightRef[]>([]);
  const [groups, setGroups] = useState<{ id: string; code: string }[]>([]);
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  const [detail, setDetail] = useState<Dispatch | null>(null);
  const [history, setHistory] = useState<{ operation: string; from?: string; to?: string; at: string; actor: string }[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [assignFor, setAssignFor] = useState<Dispatch | null>(null);
  const [assign, setAssign] = useState<{ vehicleId: string; driverId: string }>({ vehicleId: "", driverId: "" });
  const [statusFor, setStatusFor] = useState<Dispatch | null>(null);
  const [nextStatus, setNextStatus] = useState("");

  const load = useCallback(async (silent = false) => {
    if (inFlight.current) return;
    inFlight.current = true;
    if (!silent) setState("loading");
    try {
      const p = new URLSearchParams({ page: String(page), pageSize: String(PAGE) });
      if (date) p.set("date", date);
      if (status !== "all") p.set("status", status);
      if (direction !== "all") p.set("direction", direction);
      if (airportId !== "all") p.set("airportId", airportId);
      if (terminalId !== "all") p.set("terminalId", terminalId);
      if (vehicleId !== "all") p.set("vehicleId", vehicleId);
      if (driverId !== "all") p.set("driverId", driverId);
      if (q.trim()) p.set("search", q.trim());
      const [list, d] = await Promise.all([
        api.get<{ rows: Dispatch[]; total: number }>(`/ground-ops/dispatches?${p}`),
        api.get<Dash>(`/ground-ops/dashboard${date ? `?date=${date}` : ""}`),
      ]);
      setRows(list.rows); setTotal(list.total); setDash(d); setState("ready");
    } catch { setState("error"); }
    finally { inFlight.current = false; }
  }, [page, date, status, direction, airportId, terminalId, vehicleId, driverId, q]);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    Promise.all([
      api.get<{ vehicles: Vehicle[]; drivers: Driver[] }>("/ground-ops/resources"),
      api.get<{ id: string; iata: string }[]>("/flight-master/airports"),
      api.get<{ id: string; name: string; airport?: { iata: string } }[]>("/flight-master/terminals"),
      api.get<{ rows: FlightRef[] }>("/flight-ops?pageSize=100"),
    ]).then(([res, ap, tm, fl]) => { setVehicles(res.vehicles); setDrivers(res.drivers); setAirports(ap); setTerminals(tm); setFlights(fl.rows); })
      .catch(() => { /* filters degrade to All */ });
    api.get<{ id: string; code: string }[] | { rows: { id: string; code: string }[] }>("/groups")
      .then((g) => setGroups(Array.isArray(g) ? g : g.rows ?? [])).catch(() => setGroups([]));
  }, []);

  // Lightweight polling. NOTE: ops.gateway.ts already broadcasts dispatch.created/dispatch.status
  // for the legacy ops path — reusing it here is the documented later-phase integration point.
  useEffect(() => { const t = setInterval(() => { void load(true); }, 30_000); return () => clearInterval(t); }, [load]);

  const openDetail = async (row: Dispatch) => {
    setDetail(row); setHistory(null);
    try { setHistory(await api.get<typeof history extends null ? never : { operation: string; from?: string; to?: string; at: string; actor: string }[]>(`/ground-ops/dispatches/${row.id}/history`)); }
    catch { /* record still shown */ }
  };
  const doAssign = async () => {
    if (!assignFor || busy) return;
    setBusy(true);
    const body: Record<string, unknown> = {};
    if (assign.vehicleId !== "") body.vehicleId = assign.vehicleId === "none" ? null : assign.vehicleId;
    if (assign.driverId !== "") body.driverId = assign.driverId === "none" ? null : assign.driverId;
    try {
      await api.patch(`/ground-ops/dispatches/${assignFor.id}/assign`, body);
      erpToast.success(lang === "bn" ? "অ্যাসাইনমেন্ট আপডেট" : "Assignment updated", lang);
      setAssignFor(null); load();
    } catch (e) { erpToast.error(e instanceof ApiError ? e.message : "Assignment failed", lang); }
    finally { setBusy(false); }
  };
  const doStatus = async () => {
    if (!statusFor || !nextStatus || busy) return;
    setBusy(true);
    try {
      await api.patch(`/ground-ops/dispatches/${statusFor.id}/status`, { status: nextStatus });
      erpToast.success(lang === "bn" ? "স্ট্যাটাস আপডেট" : "Status updated", lang);
      setStatusFor(null); setNextStatus(""); load();
    } catch (e) { erpToast.error(e instanceof ApiError ? e.message : "Status change failed", lang); }
    finally { setBusy(false); }
  };

  const cols: ErpColumn<Dispatch>[] = [
    { id: "status", header: lang === "bn" ? "স্ট্যাটাস" : "Status", cell: (r) => <ErpStatusChip status={kind(r.status)} label={r.status.replace(/_/g, " ")} /> },
    { id: "flight", header: lang === "bn" ? "ফ্লাইট" : "Flight", cell: (r) => <span className="text-xs font-bold" style={{ color: ERP.accent, fontFamily: "var(--font-mono)" }}>{r.operationalFlight?.flightMaster.flightNumber ?? "—"}</span> },
    { id: "date", header: lang === "bn" ? "তারিখ" : "Date", cell: (r) => <span className="text-[11px] whitespace-nowrap" style={{ color: ERP.navy, fontFamily: "var(--font-mono)" }}>{dmy(r.operationalFlight?.flightDate ?? null)}</span> },
    { id: "dir", header: lang === "bn" ? "ধরন" : "Direction", cell: (r) => <span className="text-[11px] font-semibold" style={{ color: r.operationalFlight?.direction === "ARRIVAL" ? ERP.info : ERP.success }}>{r.operationalFlight?.direction ?? "—"}</span> },
    { id: "airport", header: lang === "bn" ? "বিমানবন্দর" : "Airport", cell: (r) => <span className="text-[11px]" style={{ color: ERP.muted, fontFamily: "var(--font-mono)" }}>{opAirport(r.operationalFlight)}</span> },
    { id: "terminal", header: lang === "bn" ? "টার্মিনাল" : "Terminal", cell: (r) => <span className="text-[11px]" style={{ color: ERP.muted }}>{r.operationalFlight?.terminal?.name ?? "—"}</span> },
    { id: "vehicle", header: lang === "bn" ? "যানবাহন" : "Vehicle", cell: (r) => r.vehicle
      ? <span className="text-[11px]" style={{ color: ERP.navy }}>{r.vehicle.code} <span style={{ color: ERP.mutedSoft }}>({r.vehicle.seats})</span></span>
      : <span className="text-[11px]" style={{ color: ERP.warning }}>{lang === "bn" ? "অ্যাসাইন নেই" : "unassigned"}</span> },
    { id: "driver", header: lang === "bn" ? "চালক" : "Driver", cell: (r) => r.driver
      ? <span className="text-[11px]" style={{ color: ERP.navy }}>{r.driver.name}</span>
      : <span className="text-[11px]" style={{ color: ERP.warning }}>{lang === "bn" ? "অ্যাসাইন নেই" : "unassigned"}</span> },
    { id: "when", header: lang === "bn" ? "ডিসপ্যাচ সময়" : "Dispatch Time", align: "center", cell: (r) => <span className="text-[11px] tabular-nums" style={{ color: ERP.navy, fontFamily: "var(--font-mono)" }}>{hhmm(r.scheduledAt)}</span> },
    { id: "upd", header: lang === "bn" ? "শেষ আপডেট" : "Last Update", cell: (r) => <span className="text-[10px]" style={{ color: ERP.mutedSoft, fontFamily: "var(--font-mono)" }}>{stamp(r.updatedAt)}</span> },
    { id: "act", header: lang === "bn" ? "অ্যাকশন" : "Actions", cell: (r) => (
      <div className="flex gap-1">
        <ErpButton size="sm" variant="ghost" icon={<UserCog size={13} />} onClick={(e) => { e.stopPropagation(); setAssignFor(r); setAssign({ vehicleId: r.vehicle?.id ?? "", driverId: r.driver?.id ?? "" }); }} />
        <ErpButton size="sm" variant="ghost" icon={<Activity size={13} />} onClick={(e) => { e.stopPropagation(); setStatusFor(r); setNextStatus(""); }} />
      </div>
    ) },
  ];

  const kpi = (label: string, v: number | undefined, accent: string, icon?: React.ReactNode) => <ErpStatCard label={label} value={String(v ?? 0)} accent={accent} icon={icon} />;

  const dashboardView = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpi(lang === "bn" ? "আজকের ডিসপ্যাচ" : "Today's Dispatches", dash?.todaysDispatches, ERP.accent, <Truck size={16} style={{ color: ERP.accent }} />)}
        {kpi(lang === "bn" ? "পেন্ডিং (অ্যাসাইন নেই)" : "Pending (Unassigned)", dash?.unassigned, ERP.warning, <Clock size={16} style={{ color: ERP.warning }} />)}
        {kpi(lang === "bn" ? "অ্যাসাইনড" : "Assigned", dash?.assigned, ERP.info, <UserCog size={16} style={{ color: ERP.info }} />)}
        {kpi(lang === "bn" ? "এন রুট" : "En Route", dash?.enRoute, ERP.info)}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpi(lang === "bn" ? "সম্পন্ন" : "Completed", dash?.completed, ERP.success, <CheckCircle2 size={16} style={{ color: ERP.success }} />)}
        {kpi(lang === "bn" ? "বিলম্বিত" : "Delayed", dash?.delayed, ERP.destructive, <AlertTriangle size={16} style={{ color: ERP.destructive }} />)}
        {kpi(lang === "bn" ? "ডিসপ্যাচ ছাড়া ফ্লাইট" : "Unassigned Flights", dash?.unassignedFlights, ERP.warning)}
        {kpi(lang === "bn" ? "উপলব্ধ যানবাহন" : "Available Vehicles", dash?.availableVehicles, ERP.success, <Bus size={16} style={{ color: ERP.success }} />)}
      </div>
      <p className="text-[10px]" style={{ color: ERP.mutedSoft }}>
        {lang === "bn"
          ? "সব সংখ্যা সার্ভার-সাইড অ্যাগ্রিগেশন থেকে। DispatchStatus-এ PENDING/ARRIVED নেই — «পেন্ডিং» মানে ভেহিকল/ড্রাইভার ছাড়া ASSIGNED, «সম্পন্ন» = COMPLETED।"
          : "All counts come from server-side aggregation. DispatchStatus has no PENDING/ARRIVED — “Pending” means ASSIGNED without vehicle/driver, “Completed” is the terminal state."}
      </p>
    </div>
  );

  const boardView = (
    <div className="space-y-4">
      <ErpDataTable
        columns={cols} rows={state === "loading" ? [] : rows} rowKey={(r) => r.id} loading={state === "loading"} lang={lang}
        onRowClick={(r) => void openDetail(r)}
        emptyTitle={lang === "bn" ? "কোনো ডিসপ্যাচ নেই" : "No dispatches match these filters"}
        emptyHint={lang === "bn" ? "তারিখ/ফিল্টার পরিবর্তন করুন বা নতুন ডিসপ্যাচ তৈরি করুন।" : "Adjust the filters, or create a dispatch for a flight."}
      />
      <ErpPagination page={page} pageSize={PAGE} total={total} onPageChange={setPage} lang={lang} />
    </div>
  );

  const body = state === "error" ? <div className="p-7"><ErrorState tone="light" onRetry={() => void load()} /></div> : (
    <div className="p-7 space-y-4">
      <ErpTabs active={view} onChange={(id) => { setView(id as View); setPage(1); }} ariaLabel={lang === "bn" ? "গ্রাউন্ড অপস" : "Ground ops views"}
        tabs={[
          { id: "dashboard", label: lang === "bn" ? "ড্যাশবোর্ড" : "Dashboard", icon: LayoutDashboard },
          { id: "board", label: lang === "bn" ? "ডিসপ্যাচ বোর্ড" : "Dispatch Board", icon: Truck },
        ]} />

      <div className="flex flex-wrap gap-3 items-end">
        <div className="w-40"><ErpField label={lang === "bn" ? "তারিখ" : "Date"}><ErpInput type="date" value={date} onChange={(e) => { setDate(e.target.value); setPage(1); }} /></ErpField></div>
        {view === "board" && (<>
          <div className="flex-1 min-w-[12rem]"><ErpSearchBar lang={lang} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} onClear={() => { setQ(""); setPage(1); }} placeholder={lang === "bn" ? "কোড, ফ্লাইট, যানবাহন…" : "Code, flight, vehicle, driver…"} /></div>
          <div className="w-36"><ErpField label={lang === "bn" ? "স্ট্যাটাস" : "Status"}><ErpSelect value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="all">{lang === "bn" ? "সব" : "All"}</option>{DISPATCH_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}</ErpSelect></ErpField></div>
          <div className="w-32"><ErpField label={lang === "bn" ? "ধরন" : "Direction"}><ErpSelect value={direction} onChange={(e) => { setDirection(e.target.value); setPage(1); }}><option value="all">{lang === "bn" ? "সব" : "All"}</option><option value="ARRIVAL">ARRIVAL</option><option value="DEPARTURE">DEPARTURE</option></ErpSelect></ErpField></div>
          <div className="w-28"><ErpField label={lang === "bn" ? "বিমানবন্দর" : "Airport"}><ErpSelect value={airportId} onChange={(e) => { setAirportId(e.target.value); setPage(1); }}><option value="all">{lang === "bn" ? "সব" : "All"}</option>{airports.map((a) => <option key={a.id} value={a.id}>{a.iata}</option>)}</ErpSelect></ErpField></div>
          <div className="w-40"><ErpField label={lang === "bn" ? "টার্মিনাল" : "Terminal"}><ErpSelect value={terminalId} onChange={(e) => { setTerminalId(e.target.value); setPage(1); }}><option value="all">{lang === "bn" ? "সব" : "All"}</option>{terminals.map((t) => <option key={t.id} value={t.id}>{t.airport?.iata} · {t.name}</option>)}</ErpSelect></ErpField></div>
          <div className="w-36"><ErpField label={lang === "bn" ? "যানবাহন" : "Vehicle"}><ErpSelect value={vehicleId} onChange={(e) => { setVehicleId(e.target.value); setPage(1); }}><option value="all">{lang === "bn" ? "সব" : "All"}</option><option value="none">{lang === "bn" ? "অ্যাসাইন নেই" : "Unassigned"}</option>{vehicles.map((v) => <option key={v.id} value={v.id}>{v.code}</option>)}</ErpSelect></ErpField></div>
          <div className="w-36"><ErpField label={lang === "bn" ? "চালক" : "Driver"}><ErpSelect value={driverId} onChange={(e) => { setDriverId(e.target.value); setPage(1); }}><option value="all">{lang === "bn" ? "সব" : "All"}</option><option value="none">{lang === "bn" ? "অ্যাসাইন নেই" : "Unassigned"}</option>{drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</ErpSelect></ErpField></div>
        </>)}
        <ErpButton variant="secondary" icon={<RefreshCw size={14} />} onClick={() => void load()}>{lang === "bn" ? "রিফ্রেশ" : "Refresh"}</ErpButton>
        <ErpButton variant="primary" icon={<Plus size={14} />} onClick={() => setCreating(true)}>{lang === "bn" ? "নতুন ডিসপ্যাচ" : "New dispatch"}</ErpButton>
      </div>

      {view === "dashboard" ? dashboardView : boardView}
      <div className="flex items-center gap-1.5 text-[10px]" style={{ color: ERP.mutedSoft }}><Timer size={11} /> {lang === "bn" ? "প্রতি ৩০ সেকেন্ডে রিফ্রেশ" : "Auto-refreshes every 30s"}</div>
    </div>
  );

  const NAV: NavItem[] = [{ id: "ground-ops", label: "Ground Operations", labelBn: "গ্রাউন্ড অপারেশনস", icon: Truck as IconFC }];

  return (
    <ErpThemeProvider theme="ds"><ERPShell
      moduleId="ground-ops" moduleName={lang === "bn" ? "গ্রাউন্ড অপারেশনস" : "Ground Operations"}
      moduleColor={ERP.accent} moduleIcon={Truck as IconFC} navItems={NAV} activeItem="ground-ops"
      onItemClick={() => { /* single-item module nav */ }}
      breadcrumb={[lang === "bn" ? "গ্রাউন্ড অপারেশনস" : "Ground Operations"]} notificationCount={0}
    >
      <div className="flex flex-col h-full overflow-hidden" style={{ fontFamily: fontFor(lang) }}>
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>{body}</div>
      </div>

      <CreateDispatch open={creating} onClose={() => setCreating(false)} onDone={() => { setCreating(false); load(); }}
        flights={flights} groups={groups} vehicles={vehicles} drivers={drivers} lang={lang} />

      {/* Assign / reassign / unassign */}
      <ErpModal open={!!assignFor} onClose={() => setAssignFor(null)} title={lang === "bn" ? "যানবাহন ও চালক" : "Assign vehicle & driver"}
        subtitle={assignFor ? `${assignFor.code} · ${assignFor.operationalFlight?.flightMaster.flightNumber ?? ""}` : undefined}
        footer={<div className="flex gap-2 justify-end"><ErpButton variant="secondary" onClick={() => setAssignFor(null)}>{lang === "bn" ? "বাতিল" : "Cancel"}</ErpButton><ErpButton variant="primary" loading={busy} onClick={() => void doAssign()}>{lang === "bn" ? "সংরক্ষণ" : "Save"}</ErpButton></div>}>
        <ErpForm columns={1}>
          <ErpField label={lang === "bn" ? "যানবাহন" : "Vehicle"} hint={assignFor ? `${assignFor.pax} pax` : undefined}>
            <ErpSelect value={assign.vehicleId} onChange={(e) => setAssign({ ...assign, vehicleId: e.target.value })}>
              <option value="">{lang === "bn" ? "— অপরিবর্তিত —" : "— leave unchanged —"}</option>
              <option value="none">{lang === "bn" ? "— অ্যাসাইন সরান —" : "— unassign —"}</option>
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.code} · {v.type} · {v.seats} seats</option>)}
            </ErpSelect>
          </ErpField>
          <ErpField label={lang === "bn" ? "চালক" : "Driver"}>
            <ErpSelect value={assign.driverId} onChange={(e) => setAssign({ ...assign, driverId: e.target.value })}>
              <option value="">{lang === "bn" ? "— অপরিবর্তিত —" : "— leave unchanged —"}</option>
              <option value="none">{lang === "bn" ? "— অ্যাসাইন সরান —" : "— unassign —"}</option>
              {drivers.map((d) => <option key={d.id} value={d.id}>{d.name} · {d.status}</option>)}
            </ErpSelect>
          </ErpField>
        </ErpForm>
      </ErpModal>

      {/* Status */}
      <ErpModal open={!!statusFor} onClose={() => setStatusFor(null)} title={lang === "bn" ? "ডিসপ্যাচ স্ট্যাটাস" : "Dispatch status"}
        subtitle={statusFor ? `${statusFor.code} · ${statusFor.status}` : undefined}
        footer={<div className="flex gap-2 justify-end"><ErpButton variant="secondary" onClick={() => setStatusFor(null)}>{lang === "bn" ? "বাতিল" : "Cancel"}</ErpButton><ErpButton variant="primary" loading={busy} disabled={!nextStatus} onClick={() => void doStatus()}>{lang === "bn" ? "প্রয়োগ" : "Apply"}</ErpButton></div>}>
        <ErpField label={lang === "bn" ? "নতুন স্ট্যাটাস" : "New status"}>
          <ErpSelect value={nextStatus} onChange={(e) => setNextStatus(e.target.value)}>
            <option value="">{lang === "bn" ? "— নির্বাচন —" : "— select —"}</option>
            {DISPATCH_STATUSES.filter((s) => s !== statusFor?.status).map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
          </ErpSelect>
        </ErpField>
      </ErpModal>

      {/* Detail + history */}
      <ErpDrawer open={!!detail} onClose={() => { setDetail(null); setHistory(null); }} lang={lang}
        title={detail?.code ?? ""} subtitle={detail ? `${detail.operationalFlight?.flightMaster.flightNumber ?? ""} · ${detail.operationalFlight?.direction ?? ""}` : undefined}
        footer={detail ? <div className="flex gap-2"><ErpButton variant="secondary" icon={<UserCog size={14} />} onClick={() => { setAssignFor(detail); setAssign({ vehicleId: detail.vehicle?.id ?? "", driverId: detail.driver?.id ?? "" }); }}>{lang === "bn" ? "অ্যাসাইন" : "Assign"}</ErpButton><ErpButton variant="primary" icon={<Activity size={14} />} onClick={() => { setStatusFor(detail); setNextStatus(""); }}>{lang === "bn" ? "স্ট্যাটাস" : "Status"}</ErpButton></div> : undefined}>
        {detail && (
          <div className="space-y-5">
            <ErpStatusChip status={kind(detail.status)} label={detail.status.replace(/_/g, " ")} />
            <div className="grid grid-cols-2 gap-3">
              {([
                [lang === "bn" ? "ডিসপ্যাচ কোড" : "Dispatch", detail.code],
                [lang === "bn" ? "ফ্লাইট" : "Flight", detail.operationalFlight?.flightMaster.flightNumber ?? "—"],
                [lang === "bn" ? "তারিখ" : "Date", dmy(detail.operationalFlight?.flightDate ?? null)],
                [lang === "bn" ? "ধরন" : "Direction", detail.operationalFlight?.direction ?? "—"],
                [lang === "bn" ? "বিমানবন্দর" : "Airport", opAirport(detail.operationalFlight)],
                [lang === "bn" ? "টার্মিনাল" : "Terminal", detail.operationalFlight?.terminal?.name ?? "—"],
                [lang === "bn" ? "যানবাহন" : "Vehicle", detail.vehicle ? `${detail.vehicle.code} · ${detail.vehicle.type} · ${detail.vehicle.seats} seats` : "—"],
                [lang === "bn" ? "রেজিস্ট্রেশন" : "Registration", detail.vehicle?.plateNo ?? "—"],
                [lang === "bn" ? "চালক" : "Driver", detail.driver?.name ?? "—"],
                [lang === "bn" ? "ফোন" : "Driver phone", detail.driver?.phone ?? "—"],
                [lang === "bn" ? "রুট" : "Route", `${detail.routeFrom} → ${detail.routeTo}`],
                [lang === "bn" ? "যাত্রী" : "Pax", String(detail.pax)],
                [lang === "bn" ? "ডিসপ্যাচ সময়" : "Dispatch time", stamp(detail.scheduledAt)],
                [lang === "bn" ? "শেষ আপডেট" : "Last update", stamp(detail.updatedAt)],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k} className="rounded-xl px-3 py-2" style={{ backgroundColor: ERP.surfaceSoft, border: `1px solid ${ERP.border}` }}>
                  <div className="text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color: ERP.muted }}>{k}</div>
                  <div className="text-xs font-semibold text-[color:var(--erp-text-strong)]">{v}</div>
                </div>
              ))}
            </div>
            {detail.note && <div className="rounded-xl px-3 py-2 text-[11px]" style={{ backgroundColor: erpAlpha(ERP.info, 6), border: `1px solid ${erpAlpha(ERP.info, 15)}`, color: ERP.muted }}>{detail.note}</div>}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: ERP.muted }}>{lang === "bn" ? "ইতিহাস" : "History"}</div>
              {!history ? <div className="text-[11px]" style={{ color: ERP.mutedSoft }}>…</div>
                : history.length === 0 ? <div className="text-[11px]" style={{ color: ERP.mutedSoft }}>{lang === "bn" ? "কোনো রেকর্ড নেই" : "No audit records"}</div>
                  : <div className="space-y-1.5">{history.map((h, i) => (
                      <div key={i} className="flex justify-between gap-2 text-[11px] px-3 py-1.5 rounded-lg" style={{ backgroundColor: ERP.surfaceSoft }}>
                        <span style={{ color: ERP.navy }}>{h.operation}{h.from ? ` ${h.from} → ${h.to}` : ""}</span>
                        <span style={{ color: ERP.mutedSoft }}>{h.actor} · {stamp(h.at)}</span>
                      </div>))}
                    </div>}
            </div>
          </div>
        )}
      </ErpDrawer>
    </ERPShell></ErpThemeProvider>
  );
}

function CreateDispatch({ open, onClose, onDone, flights, groups, vehicles, drivers, lang }: {
  open: boolean; onClose: () => void; onDone: () => void;
  flights: FlightRef[]; groups: { id: string; code: string }[]; vehicles: Vehicle[]; drivers: Driver[]; lang: "bn" | "en";
}) {
  const [f, setF] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setF({ operationalFlightId: flights[0]?.id ?? "", groupId: groups[0]?.id ?? "", vehicleId: "", driverId: "", routeFrom: "", routeTo: "", pax: "0", scheduledAt: "", note: "" });
  }, [open, flights, groups]);
  if (!open) return null;
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const submit = async () => {
    if (busy) return;
    setBusy(true);
    const body: Record<string, unknown> = {
      operationalFlightId: f.operationalFlightId, groupId: f.groupId,
      routeFrom: f.routeFrom, routeTo: f.routeTo, pax: Number(f.pax) || 0,
      scheduledAt: f.scheduledAt ? new Date(f.scheduledAt).toISOString() : undefined,
    };
    if (f.vehicleId) body.vehicleId = f.vehicleId;
    if (f.driverId) body.driverId = f.driverId;
    if (f.note) body.note = f.note;
    try { await api.post("/ground-ops/dispatches", body); erpToast.success(lang === "bn" ? "ডিসপ্যাচ তৈরি" : "Dispatch created", lang); onDone(); }
    catch (e) { erpToast.error(e instanceof ApiError ? e.message : "Create failed", lang); }
    finally { setBusy(false); }
  };
  return (
    <ErpModal open onClose={onClose} title={lang === "bn" ? "নতুন ডিসপ্যাচ" : "New dispatch"} width={640}
      footer={<div className="flex gap-2 justify-end"><ErpButton variant="secondary" onClick={onClose}>{lang === "bn" ? "বাতিল" : "Cancel"}</ErpButton><ErpButton variant="primary" loading={busy} onClick={() => void submit()}>{lang === "bn" ? "তৈরি করুন" : "Create"}</ErpButton></div>}>
      <ErpForm columns={2}>
        <ErpFormRow span={2}><ErpField label={lang === "bn" ? "অপারেশনাল ফ্লাইট" : "Operational flight"} required>
          <ErpSelect value={f.operationalFlightId ?? ""} onChange={(e) => set("operationalFlightId", e.target.value)}>
            {flights.map((x) => <option key={x.id} value={x.id}>{x.flightMaster.flightNumber} · {x.direction} · {dmy(x.flightDate)}</option>)}
          </ErpSelect></ErpField></ErpFormRow>
        <ErpField label={lang === "bn" ? "গ্রুপ" : "Group"} required>
          <ErpSelect value={f.groupId ?? ""} onChange={(e) => set("groupId", e.target.value)}>{groups.map((g) => <option key={g.id} value={g.id}>{g.code}</option>)}</ErpSelect>
        </ErpField>
        <ErpField label={lang === "bn" ? "যাত্রী" : "Pax"}><ErpInput type="number" value={f.pax ?? "0"} onChange={(e) => set("pax", e.target.value)} /></ErpField>
        <ErpField label={lang === "bn" ? "পিকআপ" : "Pickup / from"} required><ErpInput value={f.routeFrom ?? ""} onChange={(e) => set("routeFrom", e.target.value)} placeholder="JED Hajj Terminal" /></ErpField>
        <ErpField label={lang === "bn" ? "গন্তব্য" : "Drop / to"} required><ErpInput value={f.routeTo ?? ""} onChange={(e) => set("routeTo", e.target.value)} placeholder="Makkah Hotel" /></ErpField>
        <ErpField label={lang === "bn" ? "ডিসপ্যাচ সময়" : "Dispatch time"} required><ErpInput type="datetime-local" value={f.scheduledAt ?? ""} onChange={(e) => set("scheduledAt", e.target.value)} /></ErpField>
        <ErpField label={lang === "bn" ? "যানবাহন" : "Vehicle"}>
          <ErpSelect value={f.vehicleId ?? ""} onChange={(e) => set("vehicleId", e.target.value)}>
            <option value="">{lang === "bn" ? "— পরে —" : "— assign later —"}</option>
            {vehicles.map((v) => <option key={v.id} value={v.id}>{v.code} · {v.seats} seats</option>)}
          </ErpSelect></ErpField>
        <ErpFormRow span={2}><ErpField label={lang === "bn" ? "চালক" : "Driver"}>
          <ErpSelect value={f.driverId ?? ""} onChange={(e) => set("driverId", e.target.value)}>
            <option value="">{lang === "bn" ? "— পরে —" : "— assign later —"}</option>
            {drivers.map((d) => <option key={d.id} value={d.id}>{d.name} · {d.status}</option>)}
          </ErpSelect></ErpField></ErpFormRow>
        <ErpFormRow span={2}><ErpField label={lang === "bn" ? "মন্তব্য" : "Remarks"}><ErpInput value={f.note ?? ""} onChange={(e) => set("note", e.target.value)} /></ErpField></ErpFormRow>
      </ErpForm>
    </ErpModal>
  );
}
