/**
 * Module 10 Phase 10E — Meet & Assist operational workspace.
 * Built on the EXISTING MeetAssistTask checklist (7 steps per arrival FlightInfo).
 * Status is DERIVED server-side (no second status system); `done` stays authoritative.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Users, LayoutDashboard, ClipboardList, RefreshCw, UserCheck, Activity, Timer, CheckCircle2, AlertTriangle, Clock, PlayCircle } from "lucide-react";
import { ERPShell, type NavItem, type IconFC } from "../components/ERPShell";
import { ErrorState, EmptyState } from "../components/States";
import {
  ERP, erpAlpha, ErpThemeProvider, ErpTabs, ErpDataTable, type ErpColumn, ErpStatCard,
  ErpSearchBar, ErpButton, ErpModal, ErpDrawer, ErpSelect, ErpStatusChip, ErpPagination,
  ErpForm, ErpField, ErpInput, erpToast, type ErpStatusKind,
} from "../components/erp";
import { api, ApiError } from "../lib/api";
import { useLang } from "../lib/LangContext";
import { fontFor } from "@tuba/shared";

type View = "dashboard" | "board";
const STATUSES = ["PENDING", "ASSIGNED", "IN_PROGRESS", "COMPLETED", "SKIPPED", "EXCEPTION"];

interface Staff { id: string; name: string; email: string; role?: { key: string } }
interface FlightCtx {
  id: string; code: string; airline: string; flightNo: string; direction: string; scheduledAt: string;
  terminal: string | null; gate: string | null; paxCount: number; status: string;
  group: { id: string; code: string; paxCount: number; tenant: { id: string; name: string; code: string } } | null;
}
interface Task {
  id: string; stepNo: number; task: string; status: string; done: boolean;
  completedAt: string | null; scheduledAt: string | null; startedAt: string | null;
  skippedAt: string | null; exceptionAt: string | null; note: string | null; updatedAt: string;
  assignedTo: Staff | null; flightInfo: FlightCtx;
}
interface Dash { date: string | null; total: number; pending: number; assigned: number; inProgress: number; completed: number; skipped: number; exceptions: number }
interface Detail {
  task: Task;
  checklist: { id: string; stepNo: number; task: string; status: string; completedAt: string | null }[];
  history: { operation: string; from?: string; to?: string; at: string; actor: string }[];
  allowedNext: string[];
}

const kind = (s: string): ErpStatusKind =>
  s === "COMPLETED" ? "approved" : s === "EXCEPTION" ? "rejected" : s === "SKIPPED" ? "warning"
    : s === "IN_PROGRESS" ? "info" : s === "ASSIGNED" ? "info" : "pending";
const hhmm = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(11, 16) : "—");
const dmy = (iso: string | null) => (iso ? iso.slice(0, 10) : "—");
const stamp = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 16).replace("T", " ") : "—");

export default function MeetAssist() {
  const { lang } = useLang();
  const [view, setView] = useState<View>("dashboard");
  const [date, setDate] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [flightInfoId, setFlightInfoId] = useState("all");
  const [airport, setAirport] = useState("all");
  const [groupId, setGroupId] = useState("all");
  const [tenantId, setTenantId] = useState("all");
  const [assignedToId, setAssignedToId] = useState("all");
  const [page, setPage] = useState(1);
  const PAGE = 15;

  const [rows, setRows] = useState<Task[]>([]);
  const [total, setTotal] = useState(0);
  const [dash, setDash] = useState<Dash | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [opts, setOpts] = useState<{ flights: { id: string; code: string; flightNo: string }[]; groups: { id: string; code: string }[]; agents: { id: string; code: string; name: string }[]; airports: string[] } | null>(null);
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  const [detail, setDetail] = useState<Detail | null>(null);
  const [assignFor, setAssignFor] = useState<Task | null>(null);
  const [assignTo, setAssignTo] = useState("");
  const [statusFor, setStatusFor] = useState<Task | null>(null);
  const [nextStatus, setNextStatus] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async (silent = false) => {
    if (inFlight.current) return;
    inFlight.current = true;
    if (!silent) setState("loading");
    try {
      const p = new URLSearchParams({ page: String(page), pageSize: String(PAGE) });
      if (date) p.set("date", date);
      if (status !== "all") p.set("status", status);
      if (flightInfoId !== "all") p.set("flightInfoId", flightInfoId);
      if (airport !== "all") p.set("airport", airport);
      if (groupId !== "all") p.set("groupId", groupId);
      if (tenantId !== "all") p.set("tenantId", tenantId);
      if (assignedToId !== "all") p.set("assignedToId", assignedToId);
      if (q.trim()) p.set("search", q.trim());
      const [list, d] = await Promise.all([
        api.get<{ rows: Task[]; total: number }>(`/meet-assist/tasks?${p}`),
        api.get<Dash>(`/meet-assist/dashboard${date ? `?date=${date}` : ""}`),
      ]);
      setRows(list.rows); setTotal(list.total); setDash(d); setState("ready");
    } catch { setState("error"); }
    finally { inFlight.current = false; }
  }, [page, date, status, flightInfoId, airport, groupId, tenantId, assignedToId, q]);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    api.get<Staff[]>("/meet-assist/staff").then(setStaff).catch(() => setStaff([]));
    api.get<typeof opts>("/meet-assist/options").then(setOpts).catch(() => setOpts(null));
  }, []);

  // Polling only — the existing ops.gateway is NOT duplicated (see phase report).
  useEffect(() => { const t = setInterval(() => { void load(true); }, 30_000); return () => clearInterval(t); }, [load]);

  const openDetail = async (row: Task) => {
    setDetail(null);
    try { setDetail(await api.get<Detail>(`/meet-assist/tasks/${row.id}`)); }
    catch { erpToast.error(lang === "bn" ? "বিস্তারিত লোড হয়নি" : "Could not load detail", lang); }
  };
  const doAssign = async () => {
    if (!assignFor || busy) return;
    setBusy(true);
    try {
      await api.patch(`/meet-assist/tasks/${assignFor.id}/assign`, { assignedToId: assignTo === "none" ? null : assignTo });
      erpToast.success(lang === "bn" ? "স্টাফ আপডেট" : "Staff updated", lang);
      setAssignFor(null); load();
    } catch (e) { erpToast.error(e instanceof ApiError ? e.message : "Assignment failed", lang); }
    finally { setBusy(false); }
  };
  const doStatus = async () => {
    if (!statusFor || !nextStatus || busy) return;
    setBusy(true);
    try {
      await api.patch(`/meet-assist/tasks/${statusFor.id}/status`, { status: nextStatus, ...(note ? { note } : {}) });
      erpToast.success(lang === "bn" ? "স্ট্যাটাস আপডেট" : "Status updated", lang);
      setStatusFor(null); setNextStatus(""); setNote(""); load();
      if (detail?.task.id === statusFor.id) void openDetail(statusFor);
    } catch (e) { erpToast.error(e instanceof ApiError ? e.message : "Status change failed", lang); }
    finally { setBusy(false); }
  };

  const cols: ErpColumn<Task>[] = [
    { id: "status", header: lang === "bn" ? "স্ট্যাটাস" : "Status", cell: (r) => <ErpStatusChip status={kind(r.status)} label={r.status.replace(/_/g, " ")} /> },
    { id: "flight", header: lang === "bn" ? "ফ্লাইট" : "Flight", cell: (r) => <span className="text-xs font-bold" style={{ color: ERP.accent, fontFamily: "var(--font-mono)" }}>{r.flightInfo.flightNo}</span> },
    { id: "fdate", header: lang === "bn" ? "ফ্লাইট তারিখ" : "Flight Date", cell: (r) => <span className="text-[11px] whitespace-nowrap" style={{ color: ERP.navy, fontFamily: "var(--font-mono)" }}>{dmy(r.flightInfo.scheduledAt)}</span> },
    { id: "group", header: lang === "bn" ? "গ্রুপ" : "Group", cell: (r) => <span className="text-[11px]" style={{ color: ERP.navy, fontFamily: "var(--font-mono)" }}>{r.flightInfo.group?.code ?? "—"}</span> },
    { id: "agent", header: lang === "bn" ? "এজেন্ট" : "Agent", cell: (r) => <div className="truncate max-w-[11rem] text-[11px]" title={r.flightInfo.group?.tenant?.name} style={{ color: ERP.muted }}>{r.flightInfo.group?.tenant?.name ?? "—"}</div> },
    { id: "pax", header: lang === "bn" ? "যাত্রী" : "Pax", align: "center", cell: (r) => <span className="text-xs font-bold tabular-nums" style={{ color: ERP.navy, fontFamily: "var(--font-mono)" }}>{r.flightInfo.group?.paxCount ?? r.flightInfo.paxCount}</span> },
    { id: "task", header: lang === "bn" ? "কাজ" : "Task", cell: (r) => <span className="text-xs font-semibold text-[color:var(--erp-text-strong)]">{r.stepNo}. {r.task}</span> },
    { id: "staff", header: lang === "bn" ? "নিযুক্ত স্টাফ" : "Assigned Staff", cell: (r) => r.assignedTo
      ? <span className="text-[11px]" style={{ color: ERP.navy }}>{r.assignedTo.name}</span>
      : <span className="text-[11px]" style={{ color: ERP.warning }}>{lang === "bn" ? "নিযুক্ত নয়" : "unassigned"}</span> },
    { id: "sched", header: lang === "bn" ? "নির্ধারিত" : "Scheduled", align: "center", cell: (r) => <span className="text-[11px] tabular-nums" style={{ color: ERP.muted, fontFamily: "var(--font-mono)" }}>{hhmm(r.scheduledAt ?? r.flightInfo.scheduledAt)}</span> },
    { id: "upd", header: lang === "bn" ? "শেষ আপডেট" : "Last Update", cell: (r) => <span className="text-[10px]" style={{ color: ERP.mutedSoft, fontFamily: "var(--font-mono)" }}>{stamp(r.updatedAt)}</span> },
    { id: "act", header: lang === "bn" ? "অ্যাকশন" : "Actions", cell: (r) => (
      <div className="flex gap-1">
        <ErpButton size="sm" variant="ghost" icon={<UserCheck size={13} />} onClick={(e) => { e.stopPropagation(); setAssignFor(r); setAssignTo(r.assignedTo?.id ?? ""); }} />
        <ErpButton size="sm" variant="ghost" icon={<Activity size={13} />} onClick={(e) => { e.stopPropagation(); setStatusFor(r); setNextStatus(""); setNote(""); }} />
      </div>
    ) },
  ];

  const kpi = (label: string, v: number | undefined, accent: string, icon?: React.ReactNode) => <ErpStatCard label={label} value={String(v ?? 0)} accent={accent} icon={icon} />;

  const dashboardView = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {kpi(lang === "bn" ? "আজকের মিট অ্যান্ড অ্যাসিস্ট" : "Today's Meet & Assist", dash?.total, ERP.accent, <Users size={16} style={{ color: ERP.accent }} />)}
        {kpi(lang === "bn" ? "পেন্ডিং" : "Pending", dash?.pending, ERP.muted, <Clock size={16} style={{ color: ERP.muted }} />)}
        {kpi(lang === "bn" ? "নিযুক্ত" : "Assigned", dash?.assigned, ERP.info, <UserCheck size={16} style={{ color: ERP.info }} />)}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {kpi(lang === "bn" ? "চলমান" : "In Progress", dash?.inProgress, ERP.info, <PlayCircle size={16} style={{ color: ERP.info }} />)}
        {kpi(lang === "bn" ? "সম্পন্ন" : "Completed", dash?.completed, ERP.success, <CheckCircle2 size={16} style={{ color: ERP.success }} />)}
        {kpi(lang === "bn" ? "ব্যতিক্রম" : "Exceptions", dash?.exceptions, ERP.destructive, <AlertTriangle size={16} style={{ color: ERP.destructive }} />)}
      </div>
      {dash && dash.skipped > 0 && (
        <div className="rounded-xl px-4 py-2.5 text-[11px]" style={{ backgroundColor: erpAlpha(ERP.warning, 8), border: `1px solid ${erpAlpha(ERP.warning, 20)}`, color: ERP.warning }}>
          {lang === "bn" ? `${dash.skipped}টি ধাপ বাদ দেওয়া হয়েছে` : `${dash.skipped} step(s) skipped`}
        </div>
      )}
      {dash && dash.total === 0 && (
        <EmptyState tone="light"
          title={lang === "bn" ? "কোনো মিট অ্যান্ড অ্যাসিস্ট কাজ নেই" : "No Meet & Assist tasks"}
          hint={lang === "bn" ? "আগমন ফ্লাইটের ৭-ধাপের চেকলিস্ট তৈরি হলে এখানে দেখা যাবে।" : "The 7-step checklist appears here once created for an arrival flight."} />
      )}
    </div>
  );

  const boardView = (
    <div className="space-y-4">
      <ErpDataTable
        columns={cols} rows={state === "loading" ? [] : rows} rowKey={(r) => r.id} loading={state === "loading"} lang={lang}
        onRowClick={(r) => void openDetail(r)}
        emptyTitle={lang === "bn" ? "কোনো কাজ নেই" : "No tasks match these filters"}
        emptyHint={lang === "bn" ? "ফিল্টার পরিবর্তন করুন।" : "Adjust the filters above."}
      />
      <ErpPagination page={page} pageSize={PAGE} total={total} onPageChange={setPage} lang={lang} />
    </div>
  );

  const body = state === "error" ? <div className="p-7"><ErrorState tone="light" onRetry={() => void load()} /></div> : (
    <div className="p-7 space-y-4">
      <ErpTabs active={view} onChange={(id) => { setView(id as View); setPage(1); }} ariaLabel={lang === "bn" ? "মিট অ্যান্ড অ্যাসিস্ট" : "Meet & Assist views"}
        tabs={[
          { id: "dashboard", label: lang === "bn" ? "ড্যাশবোর্ড" : "Dashboard", icon: LayoutDashboard },
          { id: "board", label: lang === "bn" ? "টাস্ক বোর্ড" : "Task Board", icon: ClipboardList },
        ]} />

      <div className="flex flex-wrap gap-3 items-end">
        <div className="w-40"><ErpField label={lang === "bn" ? "তারিখ" : "Date"}><ErpInput type="date" value={date} onChange={(e) => { setDate(e.target.value); setPage(1); }} /></ErpField></div>
        {view === "board" && (<>
          <div className="flex-1 min-w-[12rem]"><ErpSearchBar lang={lang} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} onClear={() => { setQ(""); setPage(1); }} placeholder={lang === "bn" ? "কাজ, ফ্লাইট, গ্রুপ…" : "Task, flight, group, staff…"} /></div>
          <div className="w-36"><ErpField label={lang === "bn" ? "স্ট্যাটাস" : "Status"}><ErpSelect value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="all">{lang === "bn" ? "সব" : "All"}</option>{STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}</ErpSelect></ErpField></div>
          <div className="w-36"><ErpField label={lang === "bn" ? "ফ্লাইট" : "Flight"}><ErpSelect value={flightInfoId} onChange={(e) => { setFlightInfoId(e.target.value); setPage(1); }}><option value="all">{lang === "bn" ? "সব" : "All"}</option>{(opts?.flights ?? []).map((f) => <option key={f.id} value={f.id}>{f.flightNo}</option>)}</ErpSelect></ErpField></div>
          <div className="w-28"><ErpField label={lang === "bn" ? "বিমানবন্দর" : "Airport"}><ErpSelect value={airport} onChange={(e) => { setAirport(e.target.value); setPage(1); }}><option value="all">{lang === "bn" ? "সব" : "All"}</option>{(opts?.airports ?? []).map((a) => <option key={a} value={a}>{a}</option>)}</ErpSelect></ErpField></div>
          <div className="w-40"><ErpField label={lang === "bn" ? "গ্রুপ" : "Group"}><ErpSelect value={groupId} onChange={(e) => { setGroupId(e.target.value); setPage(1); }}><option value="all">{lang === "bn" ? "সব" : "All"}</option>{(opts?.groups ?? []).map((g) => <option key={g.id} value={g.id}>{g.code}</option>)}</ErpSelect></ErpField></div>
          <div className="w-40"><ErpField label={lang === "bn" ? "এজেন্ট" : "Agent"}><ErpSelect value={tenantId} onChange={(e) => { setTenantId(e.target.value); setPage(1); }}><option value="all">{lang === "bn" ? "সব" : "All"}</option>{(opts?.agents ?? []).map((a) => <option key={a.id} value={a.id}>{a.code}</option>)}</ErpSelect></ErpField></div>
          <div className="w-40"><ErpField label={lang === "bn" ? "স্টাফ" : "Staff"}><ErpSelect value={assignedToId} onChange={(e) => { setAssignedToId(e.target.value); setPage(1); }}><option value="all">{lang === "bn" ? "সব" : "All"}</option><option value="none">{lang === "bn" ? "নিযুক্ত নয়" : "Unassigned"}</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</ErpSelect></ErpField></div>
        </>)}
        <ErpButton variant="secondary" icon={<RefreshCw size={14} />} onClick={() => void load()}>{lang === "bn" ? "রিফ্রেশ" : "Refresh"}</ErpButton>
      </div>

      {view === "dashboard" ? dashboardView : boardView}
      <div className="flex items-center gap-1.5 text-[10px]" style={{ color: ERP.mutedSoft }}><Timer size={11} /> {lang === "bn" ? "প্রতি ৩০ সেকেন্ডে রিফ্রেশ" : "Auto-refreshes every 30s"}</div>
    </div>
  );

  const NAV: NavItem[] = [{ id: "meet-assist", label: "Meet & Assist", labelBn: "মিট অ্যান্ড অ্যাসিস্ট", icon: Users as IconFC }];

  return (
    <ErpThemeProvider theme="ds"><ERPShell
      moduleId="meet-assist" moduleName={lang === "bn" ? "মিট অ্যান্ড অ্যাসিস্ট" : "Meet & Assist"}
      moduleColor={ERP.accent} moduleIcon={Users as IconFC} navItems={NAV} activeItem="meet-assist"
      onItemClick={() => { /* single-item module nav */ }}
      breadcrumb={[lang === "bn" ? "মিট অ্যান্ড অ্যাসিস্ট" : "Meet & Assist"]} notificationCount={0}
    >
      <div className="flex flex-col h-full overflow-hidden" style={{ fontFamily: fontFor(lang) }}>
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>{body}</div>
      </div>

      {/* Staff assignment */}
      <ErpModal open={!!assignFor} onClose={() => setAssignFor(null)} title={lang === "bn" ? "স্টাফ নিয়োগ" : "Assign staff"}
        subtitle={assignFor ? `${assignFor.stepNo}. ${assignFor.task}` : undefined}
        footer={<div className="flex gap-2 justify-end"><ErpButton variant="secondary" onClick={() => setAssignFor(null)}>{lang === "bn" ? "বাতিল" : "Cancel"}</ErpButton><ErpButton variant="primary" loading={busy} onClick={() => void doAssign()}>{lang === "bn" ? "সংরক্ষণ" : "Save"}</ErpButton></div>}>
        <ErpField label={lang === "bn" ? "এয়ারপোর্ট স্টাফ" : "Airport staff"} hint={lang === "bn" ? "শুধু অনুমোদিত প্ল্যাটফর্ম স্টাফ" : "Only platform staff whose role grants MANAGE_FLIGHTS / MANAGE_OPS"}>
          <ErpSelect value={assignTo} onChange={(e) => setAssignTo(e.target.value)}>
            <option value="">{lang === "bn" ? "— নির্বাচন —" : "— select —"}</option>
            <option value="none">{lang === "bn" ? "— নিয়োগ সরান —" : "— unassign —"}</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.role?.key}</option>)}
          </ErpSelect>
        </ErpField>
      </ErpModal>

      {/* Status */}
      <ErpModal open={!!statusFor} onClose={() => setStatusFor(null)} title={lang === "bn" ? "টাস্ক স্ট্যাটাস" : "Task status"}
        subtitle={statusFor ? `${statusFor.task} · ${statusFor.status}` : undefined}
        footer={<div className="flex gap-2 justify-end"><ErpButton variant="secondary" onClick={() => setStatusFor(null)}>{lang === "bn" ? "বাতিল" : "Cancel"}</ErpButton><ErpButton variant="primary" loading={busy} disabled={!nextStatus} onClick={() => void doStatus()}>{lang === "bn" ? "প্রয়োগ" : "Apply"}</ErpButton></div>}>
        <ErpForm columns={1}>
          <ErpField label={lang === "bn" ? "নতুন স্ট্যাটাস" : "New status"}>
            <ErpSelect value={nextStatus} onChange={(e) => setNextStatus(e.target.value)}>
              <option value="">{lang === "bn" ? "— নির্বাচন —" : "— select —"}</option>
              {STATUSES.filter((s) => s !== statusFor?.status).map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
            </ErpSelect>
          </ErpField>
          <ErpField label={lang === "bn" ? "নোট" : "Note"}><ErpInput value={note} onChange={(e) => setNote(e.target.value)} placeholder={lang === "bn" ? "ঐচ্ছিক" : "Optional"} /></ErpField>
        </ErpForm>
      </ErpModal>

      {/* Task detail */}
      <ErpDrawer open={!!detail} onClose={() => setDetail(null)} lang={lang}
        title={detail ? `${detail.task.stepNo}. ${detail.task.task}` : ""}
        subtitle={detail ? `${detail.task.flightInfo.flightNo} · ${detail.task.flightInfo.group?.code ?? ""}` : undefined}
        footer={detail ? <div className="flex gap-2">
          <ErpButton variant="secondary" icon={<UserCheck size={14} />} onClick={() => { setAssignFor(detail.task); setAssignTo(detail.task.assignedTo?.id ?? ""); }}>{lang === "bn" ? "স্টাফ" : "Staff"}</ErpButton>
          <ErpButton variant="primary" icon={<Activity size={14} />} onClick={() => { setStatusFor(detail.task); setNextStatus(""); setNote(""); }}>{lang === "bn" ? "স্ট্যাটাস" : "Status"}</ErpButton>
        </div> : undefined}>
        {detail && (
          <div className="space-y-5">
            <ErpStatusChip status={kind(detail.task.status)} label={detail.task.status.replace(/_/g, " ")} />
            <div className="grid grid-cols-2 gap-3">
              {([
                [lang === "bn" ? "ফ্লাইট" : "Flight", `${detail.task.flightInfo.airline} ${detail.task.flightInfo.flightNo}`],
                [lang === "bn" ? "গ্রুপ" : "Group", detail.task.flightInfo.group?.code ?? "—"],
                [lang === "bn" ? "এজেন্ট" : "Agent", detail.task.flightInfo.group?.tenant?.name ?? "—"],
                [lang === "bn" ? "যাত্রী সংখ্যা" : "Passenger count", String(detail.task.flightInfo.group?.paxCount ?? detail.task.flightInfo.paxCount)],
                [lang === "bn" ? "কাজ" : "Task name", detail.task.task],
                [lang === "bn" ? "ধাপ" : "Step number", `${detail.task.stepNo} / 7`],
                [lang === "bn" ? "নির্ধারিত সময়" : "Scheduled time", stamp(detail.task.scheduledAt ?? detail.task.flightInfo.scheduledAt)],
                [lang === "bn" ? "নিযুক্ত স্টাফ" : "Assigned staff", detail.task.assignedTo?.name ?? "—"],
                [lang === "bn" ? "স্ট্যাটাস" : "Status", detail.task.status.replace(/_/g, " ")],
                [lang === "bn" ? "নোট" : "Notes", detail.task.note ?? "—"],
                [lang === "bn" ? "তৈরি" : "Created", "—"],
                [lang === "bn" ? "আপডেট" : "Updated", stamp(detail.task.updatedAt)],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k} className="rounded-xl px-3 py-2" style={{ backgroundColor: ERP.surfaceSoft, border: `1px solid ${ERP.border}` }}>
                  <div className="text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color: ERP.muted }}>{k}</div>
                  <div className="text-xs font-semibold text-[color:var(--erp-text-strong)]">{v}</div>
                </div>
              ))}
            </div>

            {/* Checklist context — the existing 7-step model, not a new timeline */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: ERP.muted }}>{lang === "bn" ? "চেকলিস্ট" : "Checklist (7 steps)"}</div>
              <div className="space-y-1.5">
                {detail.checklist.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg"
                    style={{ backgroundColor: c.id === detail.task.id ? erpAlpha(ERP.accent, 8) : ERP.surfaceSoft, border: `1px solid ${c.id === detail.task.id ? erpAlpha(ERP.accent, 22) : ERP.border}` }}>
                    <span className="text-[11px] font-semibold" style={{ color: c.id === detail.task.id ? ERP.accent : ERP.navy }}>{c.stepNo}. {c.task}</span>
                    <ErpStatusChip status={kind(c.status)} label={c.status.replace(/_/g, " ")} />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: ERP.muted }}>{lang === "bn" ? "ইতিহাস" : "History"}</div>
              {detail.history.length === 0
                ? <div className="text-[11px]" style={{ color: ERP.mutedSoft }}>{lang === "bn" ? "কোনো রেকর্ড নেই" : "No audit records yet"}</div>
                : <div className="space-y-1.5">{detail.history.map((h, i) => (
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
