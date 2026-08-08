/**
 * Module 10 Phase 10B — Flight Schedule & Operational Flights.
 * Physical flight instances built on the Phase 10A Flight Master (untouched),
 * and entirely separate from FlightInfo (which is an agent group's segment).
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { CalendarClock, PlaneLanding, PlaneTakeoff, Plus, Pencil, Trash2, RefreshCw, Activity } from "lucide-react";
import { ERPShell, type NavItem, type IconFC } from "../components/ERPShell";
import { ErrorState } from "../components/States";
import {
  ERP, erpAlpha, ErpThemeProvider, ErpTabs, ErpDataTable, type ErpColumn, ErpStatCard,
  ErpSearchBar, ErpButton, ErpModal, ErpDrawer, ErpInput, ErpSelect, ErpStatusChip,
  ErpPagination, ErpForm, ErpFormRow, ErpField, erpToast, type ErpStatusKind,
} from "../components/erp";
import { api, ApiError } from "../lib/api";
import { useLang } from "../lib/LangContext";
import { fontFor } from "@tuba/shared";

type View = "schedule" | "arrivals" | "departures";

interface Master { id: string; flightNumber: string; active: boolean; airline?: { code: string; name: string }; origin?: { iata: string; city: string }; destination?: { iata: string; city: string } }
interface TerminalRow { id: string; name: string; airportId: string; airport?: { iata: string } }
interface OpFlight {
  id: string; flightDate: string; direction: "ARRIVAL" | "DEPARTURE";
  scheduledTime: string; estimatedTime: string | null; actualTime: string | null;
  gate: string | null; status: string; remarks: string | null; isTestData: boolean;
  flightMaster: Master; terminal: { id: string; name: string } | null;
}
interface Timeline {
  direction: string; current: string;
  steps: { status: string; reached: boolean; current: boolean }[];
  offPath: string | null;
  history: { operation: string; from?: string; to?: string; at: string; actor: string }[];
  allowedNext: string[];
}

const statusKind = (s: string): ErpStatusKind =>
  ["DELIVERED", "ARRIVED", "AT_GATE"].includes(s) ? "approved"
    : ["CANCELLED"].includes(s) ? "rejected"
      : ["DELAYED", "RESCHEDULED"].includes(s) ? "warning"
        : ["SCHEDULED"].includes(s) ? "pending" : "info";

const hhmm = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(11, 16) : "—");
const day = (iso: string) => iso.slice(0, 10);
const toLocalInput = (iso: string | null) => (iso ? iso.slice(0, 16) : "");

export default function FlightSchedule() {
  const { lang } = useLang();
  const [view, setView] = useState<View>("schedule");
  const [q, setQ] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const PAGE = 15;

  const [rows, setRows] = useState<OpFlight[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [masters, setMasters] = useState<Master[]>([]);
  const [terminals, setTerminals] = useState<TerminalRow[]>([]);
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [busy, setBusy] = useState(false);

  const [edit, setEdit] = useState<{ row: OpFlight | null } | null>(null);
  const [detail, setDetail] = useState<OpFlight | null>(null);
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [statusFor, setStatusFor] = useState<OpFlight | null>(null);
  const [nextStatus, setNextStatus] = useState("");
  const [del, setDel] = useState<OpFlight | null>(null);

  const direction = view === "arrivals" ? "ARRIVAL" : view === "departures" ? "DEPARTURE" : "all";

  const load = useCallback(() => {
    setState("loading");
    const p = new URLSearchParams({ page: String(page), pageSize: String(PAGE) });
    if (direction !== "all") p.set("direction", direction);
    if (statusFilter !== "all") p.set("status", statusFilter);
    if (dateFilter) p.set("date", dateFilter);
    if (q.trim()) p.set("search", q.trim());
    const calls: Promise<unknown>[] = [
      api.get<{ rows: OpFlight[]; total: number }>(`/flight-ops?${p}`),
      api.get<Master[]>("/flight-master/flight-numbers"),
      api.get<TerminalRow[]>("/flight-master/terminals"),
    ];
    if (direction !== "all") calls.push(api.get<Record<string, number>>(`/flight-ops/stats?direction=${direction}${dateFilter ? `&date=${dateFilter}` : ""}`));
    Promise.all(calls)
      .then((res) => {
        const list = res[0] as { rows: OpFlight[]; total: number };
        setRows(list.rows); setTotal(list.total);
        setMasters(res[1] as Master[]); setTerminals(res[2] as TerminalRow[]);
        setStats(direction === "all" ? null : (res[3] as Record<string, number>));
        setState("ready");
      })
      .catch(() => setState("error"));
  }, [page, direction, statusFilter, dateFilter, q]);
  useEffect(load, [load]);

  const openDetail = async (row: OpFlight) => {
    setDetail(row); setTimeline(null);
    try { setTimeline(await api.get<Timeline>(`/flight-ops/${row.id}/timeline`)); } catch { /* drawer still shows the record */ }
  };

  const save = async (form: Record<string, unknown>, id?: string) => {
    if (busy) return;
    setBusy(true);
    try {
      if (id) await api.patch(`/flight-ops/${id}`, form);
      else await api.post("/flight-ops", form);
      erpToast.success(lang === "bn" ? "সংরক্ষিত" : "Saved", lang);
      setEdit(null); load();
    } catch (e) { erpToast.error(e instanceof ApiError ? e.message : "Save failed", lang); }
    finally { setBusy(false); }
  };
  const applyStatus = async () => {
    if (!statusFor || !nextStatus || busy) return;
    setBusy(true);
    try {
      await api.patch(`/flight-ops/${statusFor.id}/status`, { status: nextStatus });
      erpToast.success(lang === "bn" ? "স্ট্যাটাস আপডেট" : "Status updated", lang);
      setStatusFor(null); setNextStatus(""); load();
      if (detail?.id === statusFor.id) void openDetail(statusFor);
    } catch (e) { erpToast.error(e instanceof ApiError ? e.message : "Status change failed", lang); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!del || busy) return;
    setBusy(true);
    try { await api.delete(`/flight-ops/${del.id}`); erpToast.success(lang === "bn" ? "মুছে ফেলা হয়েছে" : "Deleted", lang); setDel(null); load(); }
    catch (e) { erpToast.error(e instanceof ApiError ? e.message : "Delete failed", lang); }
    finally { setBusy(false); }
  };
  const openStatus = async (row: OpFlight) => {
    setStatusFor(row); setNextStatus("");
    try { const t = await api.get<Timeline>(`/flight-ops/${row.id}/timeline`); setTimeline(t); setNextStatus(t.allowedNext[0] ?? ""); } catch { /* select stays empty */ }
  };

  const cols: ErpColumn<OpFlight>[] = [
    { id: "fn", header: lang === "bn" ? "ফ্লাইট" : "Flight", cell: (r) => (
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold" style={{ color: ERP.accent, fontFamily: "var(--font-mono)" }}>{r.flightMaster.flightNumber}</span>
        {r.isTestData && <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: erpAlpha(ERP.warning, 12), color: ERP.warning }}>TEST</span>}
      </div>
    ) },
    { id: "airline", header: lang === "bn" ? "এয়ারলাইন" : "Airline", cell: (r) => <span className="text-[11px]" style={{ color: ERP.muted }}>{r.flightMaster.airline?.code}</span> },
    { id: "route", header: lang === "bn" ? "রুট" : "Route", cell: (r) => <span className="text-[11px]" style={{ color: ERP.muted, fontFamily: "var(--font-mono)" }}>{r.flightMaster.origin?.iata} → {r.flightMaster.destination?.iata}</span> },
    { id: "dir", header: lang === "bn" ? "ধরন" : "Type", cell: (r) => <span className="text-[11px] font-semibold" style={{ color: r.direction === "ARRIVAL" ? ERP.info : ERP.success }}>{r.direction}</span> },
    { id: "date", header: lang === "bn" ? "তারিখ" : "Date", cell: (r) => <span className="text-[11px] whitespace-nowrap" style={{ color: ERP.navy, fontFamily: "var(--font-mono)" }}>{day(r.flightDate)}</span> },
    { id: "sched", header: "STD/STA", align: "center", cell: (r) => <span className="text-[11px] tabular-nums" style={{ color: ERP.navy, fontFamily: "var(--font-mono)" }}>{hhmm(r.scheduledTime)}</span> },
    { id: "est", header: "ETD/ETA", align: "center", cell: (r) => <span className="text-[11px] tabular-nums" style={{ color: ERP.muted, fontFamily: "var(--font-mono)" }}>{hhmm(r.estimatedTime)}</span> },
    { id: "act", header: lang === "bn" ? "প্রকৃত" : "Actual", align: "center", cell: (r) => <span className="text-[11px] tabular-nums" style={{ color: ERP.muted, fontFamily: "var(--font-mono)" }}>{hhmm(r.actualTime)}</span> },
    { id: "term", header: lang === "bn" ? "টার্মিনাল/গেট" : "Term/Gate", cell: (r) => <span className="text-[11px]" style={{ color: ERP.muted }}>{r.terminal?.name ?? "—"}{r.gate ? ` · ${r.gate}` : ""}</span> },
    { id: "status", header: lang === "bn" ? "স্ট্যাটাস" : "Status", cell: (r) => <ErpStatusChip status={statusKind(r.status)} label={r.status.replace(/_/g, " ")} /> },
  ];

  const kpis = stats && (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
      <ErpStatCard label={lang === "bn" ? "মোট" : "Total"} value={String(stats.total ?? 0)} accent={ERP.accent} icon={<CalendarClock size={16} style={{ color: ERP.accent }} />} />
      <ErpStatCard label={lang === "bn" ? "নির্ধারিত" : "Scheduled"} value={String(stats.scheduled ?? 0)} accent={ERP.info} />
      <ErpStatCard label={lang === "bn" ? "চলমান" : "In progress"} value={String(stats.inProgress ?? 0)} accent={ERP.warning} />
      <ErpStatCard label={lang === "bn" ? "সম্পন্ন" : "Completed"} value={String(stats.completed ?? 0)} accent={ERP.success} />
      <ErpStatCard label={lang === "bn" ? "বাতিল/বিলম্ব" : "Delayed/Cancelled"} value={String((stats.delayed ?? 0) + (stats.cancelled ?? 0))} accent={ERP.destructive} />
    </div>
  );

  const body = state === "error" ? <div className="p-7"><ErrorState tone="light" onRetry={load} /></div> : (
    <div className="p-7 space-y-4">
      <ErpTabs
        active={view}
        onChange={(id) => { setView(id as View); setPage(1); }}
        ariaLabel={lang === "bn" ? "ফ্লাইট ভিউ" : "Flight views"}
        tabs={[
          { id: "schedule", label: lang === "bn" ? "সময়সূচি" : "Schedule", icon: CalendarClock },
          { id: "arrivals", label: lang === "bn" ? "আগমন" : "Arrivals", icon: PlaneLanding },
          { id: "departures", label: lang === "bn" ? "প্রস্থান" : "Departures", icon: PlaneTakeoff },
        ]}
      />
      {kpis}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[14rem]">
          <ErpSearchBar lang={lang} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} onClear={() => { setQ(""); setPage(1); }} placeholder={lang === "bn" ? "ফ্লাইট নম্বর, রুট…" : "Flight number, airline, airport…"} />
        </div>
        <div className="w-40"><ErpField label={lang === "bn" ? "তারিখ" : "Date"}><ErpInput type="date" value={dateFilter} onChange={(e) => { setDateFilter(e.target.value); setPage(1); }} /></ErpField></div>
        <div className="w-44"><ErpField label={lang === "bn" ? "স্ট্যাটাস" : "Status"}>
          <ErpSelect value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="all">{lang === "bn" ? "সব" : "All"}</option>
            {["SCHEDULED", "CHECK_IN", "BOARDING", "DEPARTED", "EN_ROUTE", "LANDING", "AT_GATE", "ARRIVED", "DELIVERED", "DELAYED", "RESCHEDULED", "CANCELLED"].map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
          </ErpSelect>
        </ErpField></div>
        <ErpButton variant="secondary" icon={<RefreshCw size={14} />} onClick={load}>{lang === "bn" ? "রিফ্রেশ" : "Refresh"}</ErpButton>
        <ErpButton variant="primary" icon={<Plus size={14} />} onClick={() => setEdit({ row: null })}>{lang === "bn" ? "নতুন ফ্লাইট" : "New flight"}</ErpButton>
      </div>

      <ErpDataTable
        columns={cols} rows={state === "loading" ? [] : rows} rowKey={(r) => r.id} loading={state === "loading"} lang={lang}
        onRowClick={(r) => void openDetail(r)}
        emptyTitle={lang === "bn" ? "কোনো ফ্লাইট নেই" : "No operational flights"}
        emptyHint={lang === "bn" ? "ফ্লাইট মাস্টার থেকে নতুন ফ্লাইট তৈরি করুন।" : "Create one from an active flight master."}
        rowActions={(r) => (
          <div className="flex gap-1">
            <ErpButton size="sm" variant="ghost" icon={<Activity size={13} />} onClick={(e) => { e.stopPropagation(); void openStatus(r); }} />
            <ErpButton size="sm" variant="ghost" icon={<Pencil size={13} />} onClick={(e) => { e.stopPropagation(); setEdit({ row: r }); }} />
            <ErpButton size="sm" variant="ghost" icon={<Trash2 size={13} />} style={{ color: ERP.destructive }} onClick={(e) => { e.stopPropagation(); setDel(r); }} />
          </div>
        )}
      />
      <ErpPagination page={page} pageSize={PAGE} total={total} onPageChange={setPage} lang={lang} />
    </div>
  );

  const NAV: NavItem[] = [{ id: "flight-schedule", label: "Flight Schedule", labelBn: "ফ্লাইট সময়সূচি", icon: CalendarClock as IconFC }];

  return (
    <ErpThemeProvider theme="ds"><ERPShell
      moduleId="flight-schedule"
      moduleName={lang === "bn" ? "ফ্লাইট সময়সূচি" : "Flight Schedule"}
      moduleColor={ERP.accent}
      moduleIcon={CalendarClock as IconFC}
      navItems={NAV}
      activeItem="flight-schedule"
      onItemClick={() => { /* single-item module nav */ }}
      breadcrumb={[lang === "bn" ? "ফ্লাইট সময়সূচি" : "Flight Schedule"]}
      notificationCount={0}
    >
      <div className="flex flex-col h-full overflow-hidden" style={{ fontFamily: fontFor(lang) }}>
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>{body}</div>
      </div>

      <FlightForm edit={edit} onClose={() => setEdit(null)} onSave={save} busy={busy} masters={masters} terminals={terminals} lang={lang} />

      {/* Status change */}
      <ErpModal open={!!statusFor} onClose={() => setStatusFor(null)} title={lang === "bn" ? "স্ট্যাটাস পরিবর্তন" : "Change status"}
        subtitle={statusFor ? `${statusFor.flightMaster.flightNumber} · ${statusFor.status.replace(/_/g, " ")}` : undefined}
        footer={<div className="flex gap-2 justify-end"><ErpButton variant="secondary" onClick={() => setStatusFor(null)}>{lang === "bn" ? "বাতিল" : "Cancel"}</ErpButton><ErpButton variant="primary" loading={busy} disabled={!nextStatus} onClick={() => void applyStatus()}>{lang === "bn" ? "প্রয়োগ" : "Apply"}</ErpButton></div>}>
        <ErpField label={lang === "bn" ? "পরবর্তী স্ট্যাটাস" : "Next status"} hint={timeline && !timeline.allowedNext.length ? (lang === "bn" ? "টার্মিনাল অবস্থা — কোনো পরিবর্তন নেই" : "Terminal state — no transitions available") : undefined}>
          <ErpSelect value={nextStatus} onChange={(e) => setNextStatus(e.target.value)}>
            <option value="">{lang === "bn" ? "— নির্বাচন —" : "— select —"}</option>
            {(timeline?.allowedNext ?? []).map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
          </ErpSelect>
        </ErpField>
      </ErpModal>

      {/* Flight detail + operational timeline */}
      <ErpDrawer open={!!detail} onClose={() => { setDetail(null); setTimeline(null); }} lang={lang}
        title={detail?.flightMaster.flightNumber ?? ""} subtitle={detail ? `${detail.flightMaster.airline?.name} · ${detail.direction}` : undefined}
        footer={detail ? <ErpButton variant="primary" icon={<Activity size={14} />} onClick={() => void openStatus(detail)}>{lang === "bn" ? "স্ট্যাটাস পরিবর্তন" : "Change status"}</ErpButton> : undefined}>
        {detail && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              {([
                [lang === "bn" ? "ফ্লাইট নম্বর" : "Flight number", detail.flightMaster.flightNumber],
                [lang === "bn" ? "এয়ারলাইন" : "Airline", `${detail.flightMaster.airline?.code} · ${detail.flightMaster.airline?.name}`],
                [lang === "bn" ? "উৎস" : "Origin", `${detail.flightMaster.origin?.iata} — ${detail.flightMaster.origin?.city}`],
                [lang === "bn" ? "গন্তব্য" : "Destination", `${detail.flightMaster.destination?.iata} — ${detail.flightMaster.destination?.city}`],
                [lang === "bn" ? "তারিখ" : "Date", day(detail.flightDate)],
                [lang === "bn" ? "টার্মিনাল" : "Terminal", detail.terminal?.name ?? "—"],
                [lang === "bn" ? "গেট" : "Gate", detail.gate ?? "—"],
                [detail.direction === "ARRIVAL" ? "STA" : "STD", hhmm(detail.scheduledTime)],
                [detail.direction === "ARRIVAL" ? "ETA" : "ETD", hhmm(detail.estimatedTime)],
                [lang === "bn" ? "প্রকৃত সময়" : "Actual time", hhmm(detail.actualTime)],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k} className="rounded-xl px-3 py-2" style={{ backgroundColor: ERP.surfaceSoft, border: `1px solid ${ERP.border}` }}>
                  <div className="text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color: ERP.muted }}>{k}</div>
                  <div className="text-xs font-semibold text-[color:var(--erp-text-strong)]">{v}</div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: ERP.muted }}>{lang === "bn" ? "স্ট্যাটাস" : "Status"}</span>
              <ErpStatusChip status={statusKind(detail.status)} label={detail.status.replace(/_/g, " ")} />
            </div>

            {/* Operational timeline — only states supported by this record's direction */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: ERP.muted }}>{lang === "bn" ? "অপারেশনাল টাইমলাইন" : "Operational timeline"}</div>
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
                  {timeline.offPath && (
                    <div className="mt-3 px-3 py-2 rounded-xl text-[11px]" style={{ backgroundColor: erpAlpha(ERP.warning, 8), border: `1px solid ${erpAlpha(ERP.warning, 20)}`, color: ERP.warning }}>
                      {lang === "bn" ? "বর্তমান অবস্থা মূল পথের বাইরে:" : "Current state is off the canonical path:"} {timeline.offPath.replace(/_/g, " ")}
                    </div>
                  )}
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

      <ErpModal open={!!del} onClose={() => setDel(null)} title={lang === "bn" ? "ফ্লাইট মুছবেন?" : "Delete flight?"}
        footer={<div className="flex gap-2 justify-end"><ErpButton variant="secondary" onClick={() => setDel(null)}>{lang === "bn" ? "বাতিল" : "Cancel"}</ErpButton><ErpButton variant="danger" loading={busy} onClick={() => void remove()}>{lang === "bn" ? "মুছুন" : "Delete"}</ErpButton></div>}>
        <p className="text-sm" style={{ color: ERP.muted }}>{del?.flightMaster.flightNumber} · {del && day(del.flightDate)}</p>
        <p className="text-[11px] mt-2" style={{ color: ERP.mutedSoft }}>{lang === "bn" ? "অপারেশনাল ইতিহাস থাকলে মুছে ফেলা যাবে না — বাতিল করুন।" : "Flights with operational history cannot be deleted — cancel them instead."}</p>
      </ErpModal>
    </ERPShell></ErpThemeProvider>
  );
}

function FlightForm({ edit, onClose, onSave, busy, masters, terminals, lang }: {
  edit: { row: OpFlight | null } | null; onClose: () => void;
  onSave: (form: Record<string, unknown>, id?: string) => void; busy: boolean;
  masters: Master[]; terminals: TerminalRow[]; lang: string;
}) {
  const [f, setF] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!edit) return;
    const r = edit.row;
    setF(r ? {
      flightMasterId: r.flightMaster.id, flightDate: day(r.flightDate), direction: r.direction,
      scheduledTime: toLocalInput(r.scheduledTime), estimatedTime: toLocalInput(r.estimatedTime),
      actualTime: toLocalInput(r.actualTime), terminalId: r.terminal?.id ?? "", gate: r.gate ?? "", remarks: r.remarks ?? "",
    } : { flightMasterId: masters.find((m) => m.active)?.id ?? "", flightDate: "", direction: "ARRIVAL", scheduledTime: "", estimatedTime: "", actualTime: "", terminalId: "", gate: "", remarks: "" });
  }, [edit, masters]);
  if (!edit) return null;
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const iso = (v: string) => (v ? new Date(v).toISOString() : undefined);
  const submit = () => {
    const payload: Record<string, unknown> = {
      flightMasterId: f.flightMasterId,
      flightDate: f.flightDate ? new Date(`${f.flightDate}T00:00:00.000Z`).toISOString() : undefined,
      direction: f.direction,
      scheduledTime: iso(f.scheduledTime),
      isTestData: true,
    };
    if (f.estimatedTime) payload.estimatedTime = iso(f.estimatedTime);
    if (f.actualTime) payload.actualTime = iso(f.actualTime);
    if (f.terminalId) payload.terminalId = f.terminalId;
    if (f.gate) payload.gate = f.gate;
    if (f.remarks) payload.remarks = f.remarks;
    if (edit.row) { delete payload.isTestData; onSave(payload, edit.row.id); } else onSave(payload);
  };
  return (
    <ErpModal open onClose={onClose} title={edit.row ? (lang === "bn" ? "ফ্লাইট সম্পাদনা" : "Edit flight") : (lang === "bn" ? "নতুন অপারেশনাল ফ্লাইট" : "New operational flight")}
      footer={<div className="flex gap-2 justify-end"><ErpButton variant="secondary" onClick={onClose}>{lang === "bn" ? "বাতিল" : "Cancel"}</ErpButton><ErpButton variant="primary" loading={busy} onClick={submit}>{lang === "bn" ? "সংরক্ষণ" : "Save"}</ErpButton></div>}>
      <ErpForm columns={2}>
        <ErpFormRow span={2}>
          <ErpField label={lang === "bn" ? "ফ্লাইট মাস্টার" : "Flight master"} required hint={lang === "bn" ? "শুধু সক্রিয় মাস্টার" : "Archived masters cannot be scheduled"}>
            <ErpSelect value={f.flightMasterId ?? ""} onChange={(e) => set("flightMasterId", e.target.value)}>
              {masters.filter((m) => m.active).map((m) => <option key={m.id} value={m.id}>{m.flightNumber} — {m.origin?.iata}→{m.destination?.iata}</option>)}
            </ErpSelect>
          </ErpField>
        </ErpFormRow>
        <ErpField label={lang === "bn" ? "ফ্লাইট তারিখ" : "Flight date"} required><ErpInput type="date" value={f.flightDate ?? ""} onChange={(e) => set("flightDate", e.target.value)} /></ErpField>
        <ErpField label={lang === "bn" ? "ধরন" : "Type"} required>
          <ErpSelect value={f.direction ?? "ARRIVAL"} onChange={(e) => set("direction", e.target.value)}>
            <option value="ARRIVAL">ARRIVAL</option><option value="DEPARTURE">DEPARTURE</option>
          </ErpSelect>
        </ErpField>
        <ErpField label={lang === "bn" ? "নির্ধারিত সময়" : "Scheduled time"} required><ErpInput type="datetime-local" value={f.scheduledTime ?? ""} onChange={(e) => set("scheduledTime", e.target.value)} /></ErpField>
        <ErpField label={lang === "bn" ? "আনুমানিক সময়" : "Estimated time"}><ErpInput type="datetime-local" value={f.estimatedTime ?? ""} onChange={(e) => set("estimatedTime", e.target.value)} /></ErpField>
        <ErpField label={lang === "bn" ? "প্রকৃত সময়" : "Actual time"}><ErpInput type="datetime-local" value={f.actualTime ?? ""} onChange={(e) => set("actualTime", e.target.value)} /></ErpField>
        <ErpField label={lang === "bn" ? "টার্মিনাল" : "Terminal"}>
          <ErpSelect value={f.terminalId ?? ""} onChange={(e) => set("terminalId", e.target.value)}>
            <option value="">{lang === "bn" ? "— কোনোটি নয় —" : "— none —"}</option>
            {terminals.map((t) => <option key={t.id} value={t.id}>{t.airport?.iata} · {t.name}</option>)}
          </ErpSelect>
        </ErpField>
        <ErpField label={lang === "bn" ? "গেট" : "Gate"}><ErpInput value={f.gate ?? ""} onChange={(e) => set("gate", e.target.value)} placeholder="A12" /></ErpField>
        <ErpFormRow span={2}><ErpField label={lang === "bn" ? "মন্তব্য" : "Remarks"}><ErpInput value={f.remarks ?? ""} onChange={(e) => set("remarks", e.target.value)} /></ErpField></ErpFormRow>
      </ErpForm>
    </ErpModal>
  );
}
