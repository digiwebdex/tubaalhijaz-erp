import { useEffect, useMemo, useState } from "react";
import { Plane, Plus, Pencil, Trash2, Settings2, RefreshCw, Users } from "lucide-react";
import { ERPShell, type NavItem, type IconFC } from "../components/ERPShell";
import { EmptyState, LoadingSkeleton, ErrorState } from "../components/States";
import {
  ErpPageTemplate, ErpButton, ErpSearchBar, ErpDataTable, ErpDrawer, ErpDrawerFooterActions,
  ErpForm, ErpField, ErpInput, ErpSelect, ErpStatusChip, ErpConfirmDialog, erpToast,
  type ErpColumn, type ErpStatusKind,
} from "../components/erp";
import { api, ApiError, isLoggedIn } from "../lib/api";
import { useLang } from "../lib/LangContext";
import { fontFor } from "@tuba/shared";

const FLIGHT = "#0284C7";
const STATUSES = ["SCHEDULED","DELAYED","CHECK_IN","STANDBY","BOARDING","DEPARTED","EN_ROUTE","IN_TRANSIT","LANDING","AT_GATE","IMMIGRATION","BAGGAGE","ARRIVED","DELIVERED","RESCHEDULED","CANCELLED"];

interface Assignment { id: string; groupId: string; seatsAllocated: number; group: { id: string; code: string; name: string; paxCount: number } }
interface TicketRow { id: string; pnr?: string | null; ticketNumber?: string | null; seatNumber?: string | null; groupId: string; passenger?: { id: string; name: string; passportNo: string } | null }
interface Flight {
  id: string; code: string; direction: "ARRIVAL" | "DEPARTURE"; airline: string; flightNo: string;
  aircraft?: string | null; originAirport: string; destAirport: string; scheduledAt: string;
  boardingAt?: string | null; departureAt?: string | null; arrivalAt?: string | null;
  terminal?: string | null; gate?: string | null; capacity: number; availableSeats: number; paxCount: number;
  status: string; _count?: { assignments: number; tickets: number };
  group?: { id: string; code: string; name: string } | null; assignments?: Assignment[]; tickets?: TicketRow[];
  meetAssist?: { id: string; stepNo: number; done: boolean }[];
}
interface GroupLite { id: string; code: string; name: string }

const statusKind = (s: string): ErpStatusKind => {
  if (["ARRIVED","DELIVERED","DEPARTED"].includes(s)) return "approved";
  if (["CANCELLED"].includes(s)) return "cancelled";
  if (["DELAYED","RESCHEDULED"].includes(s)) return "pending";
  if (["SCHEDULED"].includes(s)) return "info";
  return "info";
};
const fmt = (s?: string | null) => (s ? new Date(s).toLocaleString() : "—");
const toLocalInput = (s?: string | null) => (s ? new Date(s).toISOString().slice(0, 16) : "");

const NAV: NavItem[] = [{ id: "flights", label: "Flight Management", labelBn: "ফ্লাইট ব্যবস্থাপনা", icon: Plane as IconFC }];

export default function FlightManagement() {
  const { lang } = useLang();
  const [rows, setRows] = useState<Flight[] | null>(null);
  const [error, setError] = useState(false);
  const [q, setQ] = useState("");
  const [groups, setGroups] = useState<GroupLite[]>([]);
  const [editing, setEditing] = useState<Flight | "new" | null>(null);
  const [managing, setManaging] = useState<Flight | null>(null);
  const [confirmDel, setConfirmDel] = useState<Flight | null>(null);

  const load = () => {
    if (!isLoggedIn()) return;
    api.get<Flight[]>("/flights")
      .then((d) => { setRows(d); setError(false); })
      .catch(() => { setRows([]); setError(true); });
  };
  useEffect(() => {
    load();
    api.get<GroupLite[]>("/groups").then(setGroups).catch(() => setGroups([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shown = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return (rows ?? []).filter((f) => !qq || [f.code, f.flightNo, f.airline, f.originAirport, f.destAirport, f.status].join(" ").toLowerCase().includes(qq));
  }, [rows, q]);

  const columns: ErpColumn<Flight>[] = [
    { id: "code", header: lang === "bn" ? "কোড" : "Code", cell: (f) => <span className="text-[11px] font-mono" style={{ color: FLIGHT }}>{f.code}</span> },
    { id: "dir", header: lang === "bn" ? "ধরন" : "Dir", cell: (f) => f.direction === "ARRIVAL" ? (lang === "bn" ? "আগমন" : "Arr") : (lang === "bn" ? "প্রস্থান" : "Dep") },
    { id: "flight", header: lang === "bn" ? "ফ্লাইট" : "Flight", cell: (f) => <span className="text-xs font-semibold">{f.airline} · {f.flightNo}</span> },
    { id: "route", header: lang === "bn" ? "রুট" : "Route", cell: (f) => <span className="text-[11px] font-mono">{f.originAirport} → {f.destAirport}</span> },
    { id: "aircraft", header: lang === "bn" ? "উড়োজাহাজ" : "Aircraft", cell: (f) => f.aircraft || "—" },
    { id: "when", header: lang === "bn" ? "সময়" : "Scheduled", cell: (f) => <span className="text-[11px]">{fmt(f.scheduledAt)}</span> },
    { id: "seats", header: lang === "bn" ? "আসন" : "Seats", align: "center", cell: (f) => <span className="font-mono text-xs"><b>{f.availableSeats}</b>/{f.capacity}</span> },
    { id: "grp", header: lang === "bn" ? "গ্রুপ" : "Groups", align: "center", cell: (f) => <span className="font-mono">{f._count?.assignments ?? 0}</span> },
    { id: "st", header: lang === "bn" ? "স্ট্যাটাস" : "Status", cell: (f) => <ErpStatusChip status={statusKind(f.status)} label={f.status} lang={lang} /> },
    { id: "act", header: "", align: "right", cell: (f) => (
      <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
        <ErpButton size="sm" variant="outline" icon={<Settings2 size={12} />} onClick={() => openManage(f)}>{lang === "bn" ? "পরিচালনা" : "Manage"}</ErpButton>
        <ErpButton size="sm" variant="outline" icon={<Pencil size={12} />} onClick={() => setEditing(f)}>{lang === "bn" ? "সম্পাদনা" : "Edit"}</ErpButton>
        <ErpButton size="sm" variant="danger" icon={<Trash2 size={12} />} onClick={() => setConfirmDel(f)} />
      </div>
    ) },
  ];

  const openManage = (f: Flight) => { api.get<Flight>(`/flights/${f.id}`).then(setManaging).catch(() => erpToast.error(lang === "bn" ? "লোড ব্যর্থ" : "Failed to load", lang)); };

  const del = async () => {
    if (!confirmDel) return;
    try { await api.delete(`/flights/${confirmDel.id}`); erpToast.success(lang === "bn" ? "ফ্লাইট মুছে ফেলা হয়েছে" : "Flight deleted", lang); setConfirmDel(null); load(); }
    catch (e) { erpToast.error(e instanceof ApiError ? e.message : (lang === "bn" ? "মুছা যায়নি" : "Delete failed"), lang); }
  };

  return (
    <ERPShell moduleId="ops" moduleName="Flight Management" moduleColor={FLIGHT} moduleIcon={Plane as IconFC}
      navItems={NAV} activeItem="flights" onItemClick={() => undefined} breadcrumb={[lang === "bn" ? "ফ্লাইট ব্যবস্থাপনা" : "Flight Management"]}
      userName="Operations" userRole="TUBA AL HIJAZ">
      <div className="flex-1 overflow-y-auto p-4 md:p-5" style={{ fontFamily: fontFor(lang) }}>
        <ErpPageTemplate
          title={lang === "bn" ? "ফ্লাইট ব্যবস্থাপনা" : "Flight Management"}
          subtitle={lang === "bn" ? "ফ্লাইট মাস্টার, অ্যাসাইনমেন্ট, টিকিট ও অপারেশন" : "Flight master, assignment, tickets & operations"}
          toolbar={
            <div className="flex flex-col sm:flex-row gap-3 w-full">
              <div className="flex-1"><ErpSearchBar lang={lang} value={q} onChange={(e) => setQ(e.target.value)} onClear={() => setQ("")} placeholder={lang === "bn" ? "ফ্লাইট, এয়ারলাইন…" : "Flight, airline, code…"} /></div>
              <ErpButton size="sm" variant="outline" icon={<RefreshCw size={13} />} onClick={load}>{lang === "bn" ? "রিফ্রেশ" : "Refresh"}</ErpButton>
              <ErpButton size="sm" variant="primary" icon={<Plus size={14} />} onClick={() => setEditing("new")}>{lang === "bn" ? "নতুন ফ্লাইট" : "New Flight"}</ErpButton>
            </div>
          }
        >
          {error ? <ErrorState tone="light" lang={lang} onRetry={load} />
            : rows === null ? <LoadingSkeleton />
            : (
              <ErpDataTable columns={columns} rows={shown} rowKey={(f) => f.id} lang={lang}
                emptyTitle={lang === "bn" ? "কোনো ফ্লাইট নেই" : "No flights yet"}
                emptyHint={lang === "bn" ? "‘নতুন ফ্লাইট’ দিয়ে শুরু করুন।" : "Create one with “New Flight”."} />
            )}
        </ErpPageTemplate>
      </div>

      {editing && <FlightFormDrawer flight={editing === "new" ? null : editing} groups={groups} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {managing && <ManageDrawer flight={managing} groups={groups} onClose={() => setManaging(null)} onChanged={() => { openManage(managing); load(); }} />}
      <ErpConfirmDialog open={!!confirmDel} onClose={() => setConfirmDel(null)} onConfirm={del} lang={lang}
        title={lang === "bn" ? "ফ্লাইট মুছবেন?" : "Delete flight?"} description={confirmDel ? `${confirmDel.code} · ${confirmDel.airline} ${confirmDel.flightNo}` : ""} variant="danger" />
    </ERPShell>
  );
}

// ─── Create / Edit ─────────────────────────────────────────────────────────────
function FlightFormDrawer({ flight, groups, onClose, onSaved }: { flight: Flight | null; groups: GroupLite[]; onClose: () => void; onSaved: () => void }) {
  const { lang } = useLang();
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    direction: flight?.direction ?? "ARRIVAL", airline: flight?.airline ?? "", flightNo: flight?.flightNo ?? "",
    aircraft: flight?.aircraft ?? "", originAirport: flight?.originAirport ?? "", destAirport: flight?.destAirport ?? "",
    scheduledAt: toLocalInput(flight?.scheduledAt), boardingAt: toLocalInput(flight?.boardingAt), departureAt: toLocalInput(flight?.departureAt),
    arrivalAt: toLocalInput(flight?.arrivalAt), terminal: flight?.terminal ?? "", gate: flight?.gate ?? "",
    capacity: String(flight?.capacity ?? 0), paxCount: String(flight?.paxCount ?? 0), groupId: flight?.group?.id ?? "",
  });
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const iso = (v: string) => (v ? new Date(v).toISOString() : undefined);

  const save = async () => {
    setSaving(true);
    try {
      if (flight) {
        await api.patch(`/flights/${flight.id}`, {
          airline: f.airline, flightNo: f.flightNo, aircraft: f.aircraft || undefined, originAirport: f.originAirport, destAirport: f.destAirport,
          scheduledAt: iso(f.scheduledAt), boardingAt: iso(f.boardingAt), departureAt: iso(f.departureAt), arrivalAt: iso(f.arrivalAt),
          terminal: f.terminal || undefined, gate: f.gate || undefined, capacity: Number(f.capacity),
        });
        erpToast.success(lang === "bn" ? "ফ্লাইট আপডেট হয়েছে" : "Flight updated", lang);
      } else {
        if (!f.groupId) { erpToast.error(lang === "bn" ? "প্রাথমিক গ্রুপ নির্বাচন করুন" : "Select a primary group", lang); setSaving(false); return; }
        await api.post("/flights", {
          direction: f.direction, airline: f.airline, flightNo: f.flightNo, aircraft: f.aircraft || undefined, originAirport: f.originAirport, destAirport: f.destAirport,
          scheduledAt: iso(f.scheduledAt), boardingAt: iso(f.boardingAt), departureAt: iso(f.departureAt), arrivalAt: iso(f.arrivalAt),
          terminal: f.terminal || undefined, gate: f.gate || undefined, capacity: Number(f.capacity), paxCount: Number(f.paxCount), groupId: f.groupId,
        });
        erpToast.success(lang === "bn" ? "ফ্লাইট তৈরি হয়েছে" : "Flight created", lang);
      }
      onSaved();
    } catch (e) { erpToast.error(e instanceof ApiError ? e.message : (lang === "bn" ? "সংরক্ষণ ব্যর্থ" : "Save failed"), lang); }
    finally { setSaving(false); }
  };

  return (
    <ErpDrawer open onClose={onClose} lang={lang}
      title={flight ? (lang === "bn" ? "ফ্লাইট সম্পাদনা" : "Edit Flight") : (lang === "bn" ? "নতুন ফ্লাইট" : "New Flight")}
      subtitle={flight?.code}
      footer={<ErpDrawerFooterActions lang={lang} onCancel={onClose} onSave={save} saving={saving} saveLabel={lang === "bn" ? "সংরক্ষণ" : "Save"} />}>
      <ErpForm columns={2}>
        <ErpField label={lang === "bn" ? "দিক" : "Direction"}>
          <ErpSelect value={f.direction} onChange={(e) => set("direction", e.target.value)} disabled={!!flight}>
            <option value="ARRIVAL">Arrival</option><option value="DEPARTURE">Departure</option>
          </ErpSelect>
        </ErpField>
        <ErpField label={lang === "bn" ? "উড়োজাহাজ" : "Aircraft"}><ErpInput value={f.aircraft} onChange={(e) => set("aircraft", e.target.value)} placeholder="B777" /></ErpField>
        <ErpField label={lang === "bn" ? "এয়ারলাইন" : "Airline"}><ErpInput value={f.airline} onChange={(e) => set("airline", e.target.value)} placeholder="Saudia" /></ErpField>
        <ErpField label={lang === "bn" ? "ফ্লাইট নম্বর" : "Flight No"}><ErpInput value={f.flightNo} onChange={(e) => set("flightNo", e.target.value)} placeholder="SV 802" /></ErpField>
        <ErpField label={lang === "bn" ? "উৎস বিমানবন্দর" : "Origin (IATA)"}><ErpInput value={f.originAirport} onChange={(e) => set("originAirport", e.target.value)} placeholder="DAC" /></ErpField>
        <ErpField label={lang === "bn" ? "গন্তব্য বিমানবন্দর" : "Dest (IATA)"}><ErpInput value={f.destAirport} onChange={(e) => set("destAirport", e.target.value)} placeholder="JED" /></ErpField>
        <ErpField label={lang === "bn" ? "নির্ধারিত সময়" : "Scheduled"}><ErpInput type="datetime-local" value={f.scheduledAt} onChange={(e) => set("scheduledAt", e.target.value)} /></ErpField>
        <ErpField label={lang === "bn" ? "বোর্ডিং সময়" : "Boarding"}><ErpInput type="datetime-local" value={f.boardingAt} onChange={(e) => set("boardingAt", e.target.value)} /></ErpField>
        <ErpField label={lang === "bn" ? "ছাড়ার সময়" : "Departure"}><ErpInput type="datetime-local" value={f.departureAt} onChange={(e) => set("departureAt", e.target.value)} /></ErpField>
        <ErpField label={lang === "bn" ? "পৌঁছানোর সময়" : "Arrival"}><ErpInput type="datetime-local" value={f.arrivalAt} onChange={(e) => set("arrivalAt", e.target.value)} /></ErpField>
        <ErpField label={lang === "bn" ? "টার্মিনাল" : "Terminal"}><ErpInput value={f.terminal} onChange={(e) => set("terminal", e.target.value)} /></ErpField>
        <ErpField label={lang === "bn" ? "গেট" : "Gate"}><ErpInput value={f.gate} onChange={(e) => set("gate", e.target.value)} /></ErpField>
        <ErpField label={lang === "bn" ? "ধারণক্ষমতা" : "Capacity"}><ErpInput type="number" value={f.capacity} onChange={(e) => set("capacity", e.target.value)} /></ErpField>
        {!flight && <ErpField label={lang === "bn" ? "প্রাথমিক গ্রুপ যাত্রী" : "Primary group pax"}><ErpInput type="number" value={f.paxCount} onChange={(e) => set("paxCount", e.target.value)} /></ErpField>}
        {!flight && <ErpField label={lang === "bn" ? "প্রাথমিক গ্রুপ" : "Primary Group"}>
          <ErpSelect value={f.groupId} onChange={(e) => set("groupId", e.target.value)}>
            <option value="">—</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.code} · {g.name}</option>)}
          </ErpSelect>
        </ErpField>}
      </ErpForm>
    </ErpDrawer>
  );
}

// ─── Manage: status · assignments · tickets ─────────────────────────────────────
function ManageDrawer({ flight, groups, onClose, onChanged }: { flight: Flight; groups: GroupLite[]; onClose: () => void; onChanged: () => void }) {
  const { lang } = useLang();
  const [status, setStatus] = useState(flight.status);
  const [asgGroup, setAsgGroup] = useState(""); const [asgSeats, setAsgSeats] = useState("0");
  const [tkGroup, setTkGroup] = useState(flight.group?.id ?? ""); const [tkPnr, setTkPnr] = useState(""); const [tkNo, setTkNo] = useState(""); const [tkSeat, setTkSeat] = useState("");
  const busy = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); erpToast.success(ok, lang); onChanged(); }
    catch (e) { erpToast.error(e instanceof ApiError ? e.message : "Failed", lang); }
  };

  return (
    <ErpDrawer open onClose={onClose} lang={lang} title={lang === "bn" ? "ফ্লাইট পরিচালনা" : "Manage Flight"} subtitle={`${flight.code} · ${flight.airline} ${flight.flightNo}`}
      footer={<ErpDrawerFooterActions lang={lang} onCancel={onClose} onSave={onClose} saving={false} saveLabel={lang === "bn" ? "বন্ধ" : "Close"} />}>
      <div className="space-y-5">
        {/* Status */}
        <section>
          <h4 className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: FLIGHT }}>{lang === "bn" ? "অপারেশন স্ট্যাটাস" : "Operational Status"}</h4>
          <div className="flex gap-2 items-center">
            <ErpSelect value={status} onChange={(e) => setStatus(e.target.value)}>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</ErpSelect>
            <ErpButton size="sm" variant="primary" disabled={status === flight.status} onClick={() => busy(() => api.patch(`/flights/${flight.id}/status`, { status }), lang === "bn" ? "স্ট্যাটাস আপডেট" : "Status updated")}>{lang === "bn" ? "প্রয়োগ" : "Apply"}</ErpButton>
          </div>
          <p className="text-[10px] mt-1" style={{ color: "rgba(11,30,63,0.5)" }}>{lang === "bn" ? "আগমন LANDING/ARRIVED → মিট অ্যান্ড অ্যাসিস্ট স্বয়ংক্রিয়" : "Arrival → LANDING/ARRIVED auto-provisions Meet & Assist"}</p>
        </section>

        {/* Assignments */}
        <section>
          <h4 className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: FLIGHT }}>{lang === "bn" ? "গ্রুপ অ্যাসাইনমেন্ট" : "Group Assignment"} · {flight.availableSeats}/{flight.capacity} {lang === "bn" ? "আসন" : "seats"}</h4>
          <div className="space-y-1 mb-2">
            {(flight.assignments ?? []).map((a) => (
              <div key={a.id} className="flex items-center justify-between text-xs border rounded px-2 py-1" style={{ borderColor: "rgba(11,30,63,0.12)" }}>
                <span><Users size={11} className="inline mr-1" />{a.group.code} · {a.group.name}</span>
                <span className="flex items-center gap-2"><span className="font-mono">{a.seatsAllocated} {lang === "bn" ? "আসন" : "seats"}</span>
                  {a.groupId !== flight.group?.id && <ErpButton size="sm" variant="danger" icon={<Trash2 size={11} />} onClick={() => busy(() => api.delete(`/flights/${flight.id}/assign/${a.groupId}`), lang === "bn" ? "সরানো হয়েছে" : "Unassigned")} />}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <ErpSelect value={asgGroup} onChange={(e) => setAsgGroup(e.target.value)}><option value="">{lang === "bn" ? "গ্রুপ…" : "Group…"}</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.code} · {g.name}</option>)}</ErpSelect>
            <ErpInput type="number" value={asgSeats} onChange={(e) => setAsgSeats(e.target.value)} placeholder={lang === "bn" ? "আসন" : "seats"} style={{ width: 90 }} />
            <ErpButton size="sm" variant="outline" icon={<Plus size={12} />} disabled={!asgGroup} onClick={() => busy(() => api.post(`/flights/${flight.id}/assign`, { groupId: asgGroup, seatsAllocated: Number(asgSeats) }), lang === "bn" ? "অ্যাসাইন হয়েছে" : "Assigned").then(() => { setAsgGroup(""); setAsgSeats("0"); })}>{lang === "bn" ? "অ্যাসাইন" : "Assign"}</ErpButton>
          </div>
        </section>

        {/* Tickets / PNR / Seat */}
        <section>
          <h4 className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: FLIGHT }}>{lang === "bn" ? "টিকিট · PNR · আসন" : "Tickets · PNR · Seat"}</h4>
          <div className="space-y-1 mb-2">
            {(flight.tickets ?? []).map((t) => (
              <div key={t.id} className="text-[11px] border rounded px-2 py-1 font-mono" style={{ borderColor: "rgba(11,30,63,0.12)" }}>
                {t.passenger?.name ?? "—"} · PNR {t.pnr ?? "—"} · {t.ticketNumber ?? "—"} · {lang === "bn" ? "আসন" : "seat"} {t.seatNumber ?? "—"}
              </div>
            ))}
            {(flight.tickets ?? []).length === 0 && <p className="text-[11px]" style={{ color: "rgba(11,30,63,0.5)" }}>{lang === "bn" ? "কোনো টিকিট নেই" : "No tickets yet"}</p>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <ErpSelect value={tkGroup} onChange={(e) => setTkGroup(e.target.value)}><option value="">{lang === "bn" ? "গ্রুপ…" : "Group…"}</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.code}</option>)}</ErpSelect>
            <ErpInput value={tkPnr} onChange={(e) => setTkPnr(e.target.value)} placeholder="PNR" />
            <ErpInput value={tkNo} onChange={(e) => setTkNo(e.target.value)} placeholder={lang === "bn" ? "টিকিট নম্বর" : "Ticket No"} />
            <ErpInput value={tkSeat} onChange={(e) => setTkSeat(e.target.value)} placeholder={lang === "bn" ? "আসন (12A)" : "Seat (12A)"} />
          </div>
          <ErpButton size="sm" variant="outline" className="mt-2" icon={<Plus size={12} />} disabled={!tkGroup} onClick={() => busy(() => api.post(`/flights/${flight.id}/tickets`, { groupId: tkGroup, pnr: tkPnr || undefined, ticketNumber: tkNo || undefined, seatNumber: tkSeat || undefined }), lang === "bn" ? "টিকিট যোগ হয়েছে" : "Ticket added").then(() => { setTkPnr(""); setTkNo(""); setTkSeat(""); })}>{lang === "bn" ? "টিকিট যোগ" : "Add Ticket"}</ErpButton>
        </section>
      </div>
    </ErpDrawer>
  );
}
