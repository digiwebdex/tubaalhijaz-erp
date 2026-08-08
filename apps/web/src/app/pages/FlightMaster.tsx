/**
 * Module 10 Phase 10A — Flight Master.
 * Reference data (Airline / Airport / Terminal / Flight Number) beneath the
 * operational FlightInfo. No scheduling. Consumes the shared ERP library only.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Plane, Building2, LayoutGrid, Hash, Plus, Pencil, Trash2 } from "lucide-react";
import { ERPShell, type NavItem, type IconFC } from "../components/ERPShell";
import { ErrorState } from "../components/States";
import {
  ERP, ErpThemeProvider, ErpDataTable, type ErpColumn, ErpSearchBar, ErpButton,
  ErpModal, ErpInput, ErpSelect, ErpStatusChip, ErpSectionHeader,
  ErpForm, ErpFormRow, ErpField, erpToast, type ErpStatusKind,
} from "../components/erp";
import { api, ApiError } from "../lib/api";
import { useLang } from "../lib/LangContext";
import { fontFor } from "@tuba/shared";

type Section = "airlines" | "airports" | "terminals" | "flights";
type Feed = "loading" | "error" | "ready";

interface Airline { id: string; code: string; name: string; icao: string | null; country: string; active: boolean }
interface Terminal { id: string; airportId: string; name: string; active: boolean; airport?: { iata: string; name: string } }
interface Airport { id: string; iata: string; icao: string | null; name: string; city: string; country: string; timezone: string; active: boolean; terminals?: Terminal[] }
interface FlightNo {
  id: string; flightNumber: string; active: boolean;
  airlineId: string; originId: string; destinationId: string; defaultTerminalId: string | null;
  airline?: { code: string; name: string }; origin?: { iata: string; city: string };
  destination?: { iata: string; city: string }; defaultTerminal?: { name: string } | null;
}

const activeChip = (on: boolean, lang: string) => (
  <ErpStatusChip status={(on ? "approved" : "rejected") as ErpStatusKind} label={on ? (lang === "bn" ? "সক্রিয়" : "Active") : (lang === "bn" ? "নিষ্ক্রিয়" : "Inactive")} />
);

/** Shared section frame — header + search + table (no new shared component). */
function SectionFrame({ title, subtitle, onNew, newLabel, q, setQ, placeholder, children }: {
  title: string; subtitle: string; onNew: () => void; newLabel: string;
  q: string; setQ: (v: string) => void; placeholder: string; children: ReactNode;
}) {
  const { lang } = useLang();
  return (
    <div className="p-7 space-y-4">
      <ErpSectionHeader title={title} subtitle={subtitle} action={<ErpButton variant="primary" size="sm" icon={<Plus size={14} />} onClick={onNew}>{newLabel}</ErpButton>} />
      <div className="max-w-md">
        <ErpSearchBar lang={lang} value={q} onChange={(e) => setQ(e.target.value)} onClear={() => setQ("")} placeholder={placeholder} />
      </div>
      {children}
    </div>
  );
}

export default function FlightMaster() {
  const { lang } = useLang();
  const [section, setSection] = useState<Section>("airlines");
  const [q, setQ] = useState("");

  const [airlines, setAirlines] = useState<Airline[]>([]);
  const [airports, setAirports] = useState<Airport[]>([]);
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [flights, setFlights] = useState<FlightNo[]>([]);
  const [state, setState] = useState<Feed>("loading");
  const [busy, setBusy] = useState(false);

  const [edit, setEdit] = useState<{ kind: Section; row: Record<string, unknown> | null } | null>(null);
  const [del, setDel] = useState<{ kind: Section; id: string; label: string } | null>(null);

  const PATHS: Record<Section, string> = { airlines: "airlines", airports: "airports", terminals: "terminals", flights: "flight-numbers" };

  const load = () => {
    setState("loading");
    const s = q.trim() ? `?search=${encodeURIComponent(q.trim())}` : "";
    const calls = [
      api.get<Airline[]>(`/flight-master/airlines${section === "airlines" ? s : ""}`),
      api.get<Airport[]>(`/flight-master/airports${section === "airports" ? s : ""}`),
      api.get<Terminal[]>(`/flight-master/terminals${section === "terminals" ? s : ""}`),
      api.get<FlightNo[]>(`/flight-master/flight-numbers${section === "flights" ? s : ""}`),
    ] as const;
    Promise.all(calls)
      .then(([al, ap, tm, fn]) => { setAirlines(al); setAirports(ap); setTerminals(tm); setFlights(fn); setState("ready"); })
      .catch(() => setState("error"));
  };
  useEffect(load, [section, q]);

  const save = async (kind: Section, row: Record<string, unknown>) => {
    if (busy) return;
    setBusy(true);
    const id = row.id as string | undefined;
    const body = { ...row }; delete body.id;
    try {
      if (id) await api.patch(`/flight-master/${PATHS[kind]}/${id}`, body);
      else await api.post(`/flight-master/${PATHS[kind]}`, body);
      erpToast.success(lang === "bn" ? "সংরক্ষিত" : "Saved", lang);
      setEdit(null); load();
    } catch (e) { erpToast.error(e instanceof ApiError ? e.message : "Save failed", lang); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!del || busy) return;
    setBusy(true);
    try {
      await api.delete(`/flight-master/${PATHS[del.kind]}/${del.id}`);
      erpToast.success(lang === "bn" ? "মুছে ফেলা হয়েছে" : "Deleted", lang);
      setDel(null); load();
    } catch (e) { erpToast.error(e instanceof ApiError ? e.message : "Delete failed", lang); }
    finally { setBusy(false); }
  };

  const actions = (kind: Section, row: { id: string }, label: string) => (
    <div className="flex gap-1">
      <ErpButton size="sm" variant="ghost" icon={<Pencil size={13} />} onClick={(e) => { e.stopPropagation(); setEdit({ kind, row: row as unknown as Record<string, unknown> }); }} />
      <ErpButton size="sm" variant="ghost" icon={<Trash2 size={13} />} style={{ color: ERP.destructive }} onClick={(e) => { e.stopPropagation(); setDel({ kind, id: row.id, label }); }} />
    </div>
  );

  const airlineCols: ErpColumn<Airline>[] = [
    { id: "code", header: lang === "bn" ? "কোড" : "Code", cell: (r) => <span className="text-xs font-bold" style={{ color: ERP.accent, fontFamily: "var(--font-mono)" }}>{r.code}</span> },
    { id: "name", header: lang === "bn" ? "নাম" : "Name", cell: (r) => <span className="text-xs font-semibold text-[color:var(--erp-text-strong)]">{r.name}</span> },
    { id: "icao", header: "ICAO", cell: (r) => <span className="text-[11px]" style={{ color: ERP.muted, fontFamily: "var(--font-mono)" }}>{r.icao || "—"}</span> },
    { id: "country", header: lang === "bn" ? "দেশ" : "Country", cell: (r) => <span className="text-[11px]" style={{ color: ERP.muted }}>{r.country}</span> },
    { id: "active", header: lang === "bn" ? "স্ট্যাটাস" : "Status", cell: (r) => activeChip(r.active, lang) },
  ];
  const airportCols: ErpColumn<Airport>[] = [
    { id: "iata", header: "IATA", cell: (r) => <span className="text-xs font-bold" style={{ color: ERP.accent, fontFamily: "var(--font-mono)" }}>{r.iata}</span> },
    { id: "icao", header: "ICAO", cell: (r) => <span className="text-[11px]" style={{ color: ERP.muted, fontFamily: "var(--font-mono)" }}>{r.icao || "—"}</span> },
    { id: "name", header: lang === "bn" ? "নাম" : "Name", cell: (r) => <div className="truncate max-w-[18rem] text-xs font-semibold text-[color:var(--erp-text-strong)]" title={r.name}>{r.name}</div> },
    { id: "city", header: lang === "bn" ? "শহর" : "City", cell: (r) => <span className="text-[11px]" style={{ color: ERP.muted }}>{r.city}, {r.country}</span> },
    { id: "tz", header: lang === "bn" ? "টাইমজোন" : "Timezone", cell: (r) => <span className="text-[11px]" style={{ color: ERP.muted, fontFamily: "var(--font-mono)" }}>{r.timezone}</span> },
    { id: "terms", header: lang === "bn" ? "টার্মিনাল" : "Terminals", align: "center", cell: (r) => <span className="text-xs tabular-nums" style={{ color: ERP.navy }}>{r.terminals?.length ?? 0}</span> },
    { id: "active", header: lang === "bn" ? "স্ট্যাটাস" : "Status", cell: (r) => activeChip(r.active, lang) },
  ];
  const terminalCols: ErpColumn<Terminal>[] = [
    { id: "airport", header: lang === "bn" ? "বিমানবন্দর" : "Airport", cell: (r) => <span className="text-xs font-bold" style={{ color: ERP.accent, fontFamily: "var(--font-mono)" }}>{r.airport?.iata ?? "—"}</span> },
    { id: "name", header: lang === "bn" ? "টার্মিনাল" : "Terminal", cell: (r) => <span className="text-xs font-semibold text-[color:var(--erp-text-strong)]">{r.name}</span> },
    { id: "active", header: lang === "bn" ? "স্ট্যাটাস" : "Status", cell: (r) => activeChip(r.active, lang) },
  ];
  const flightCols: ErpColumn<FlightNo>[] = [
    { id: "fn", header: lang === "bn" ? "ফ্লাইট নম্বর" : "Flight Number", cell: (r) => <span className="text-xs font-bold" style={{ color: ERP.accent, fontFamily: "var(--font-mono)" }}>{r.flightNumber}</span> },
    { id: "airline", header: lang === "bn" ? "এয়ারলাইন" : "Airline", cell: (r) => <span className="text-xs text-[color:var(--erp-text-strong)]">{r.airline?.code} · {r.airline?.name}</span> },
    { id: "route", header: lang === "bn" ? "রুট" : "Route", cell: (r) => <span className="text-[11px]" style={{ color: ERP.muted, fontFamily: "var(--font-mono)" }}>{r.origin?.iata} → {r.destination?.iata}</span> },
    { id: "term", header: lang === "bn" ? "ডিফল্ট টার্মিনাল" : "Default Terminal", cell: (r) => <span className="text-[11px]" style={{ color: ERP.muted }}>{r.defaultTerminal?.name || "—"}</span> },
    { id: "active", header: lang === "bn" ? "স্ট্যাটাস" : "Status", cell: (r) => activeChip(r.active, lang) },
  ];

  const NAV: (NavItem & { section: Section })[] = [
    { id: "airlines", section: "airlines", label: "Airlines", labelBn: "এয়ারলাইন", icon: Plane as IconFC },
    { id: "airports", section: "airports", label: "Airports", labelBn: "বিমানবন্দর", icon: Building2 as IconFC },
    { id: "terminals", section: "terminals", label: "Terminals", labelBn: "টার্মিনাল", icon: LayoutGrid as IconFC },
    { id: "flights", section: "flights", label: "Flight Numbers", labelBn: "ফ্লাইট নম্বর", icon: Hash as IconFC },
  ];
  const LABELS: Record<Section, string> = {
    airlines: lang === "bn" ? "এয়ারলাইন" : "Airlines",
    airports: lang === "bn" ? "বিমানবন্দর" : "Airports",
    terminals: lang === "bn" ? "টার্মিনাল" : "Terminals",
    flights: lang === "bn" ? "ফ্লাইট নম্বর" : "Flight Numbers",
  };

  const body = useMemo(() => {
    if (state === "error") return <div className="p-7"><ErrorState tone="light" onRetry={load} /></div>;
    const loading = state === "loading";
    if (section === "airlines") return (
      <SectionFrame title={LABELS.airlines} subtitle={lang === "bn" ? "ক্যারিয়ার মাস্টার" : "Carrier master data"} onNew={() => setEdit({ kind: "airlines", row: null })} newLabel={lang === "bn" ? "নতুন এয়ারলাইন" : "New airline"} q={q} setQ={setQ} placeholder={lang === "bn" ? "কোড বা নাম…" : "Code, name or country…"}>
        <ErpDataTable columns={airlineCols} rows={loading ? [] : airlines} rowKey={(r) => r.id} loading={loading} lang={lang}
          emptyTitle={lang === "bn" ? "কোনো এয়ারলাইন নেই" : "No airlines"} emptyHint={lang === "bn" ? "নতুন এয়ারলাইন যোগ করুন।" : "Add a carrier to begin."}
          rowActions={(r) => actions("airlines", r, r.code)} />
      </SectionFrame>
    );
    if (section === "airports") return (
      <SectionFrame title={LABELS.airports} subtitle={lang === "bn" ? "বিমানবন্দর মাস্টার" : "Airport master data"} onNew={() => setEdit({ kind: "airports", row: null })} newLabel={lang === "bn" ? "নতুন বিমানবন্দর" : "New airport"} q={q} setQ={setQ} placeholder={lang === "bn" ? "IATA, শহর…" : "IATA, city or country…"}>
        <ErpDataTable columns={airportCols} rows={loading ? [] : airports} rowKey={(r) => r.id} loading={loading} lang={lang}
          emptyTitle={lang === "bn" ? "কোনো বিমানবন্দর নেই" : "No airports"} emptyHint={lang === "bn" ? "নতুন বিমানবন্দর যোগ করুন।" : "Add an airport to begin."}
          rowActions={(r) => actions("airports", r, r.iata)} />
      </SectionFrame>
    );
    if (section === "terminals") return (
      <SectionFrame title={LABELS.terminals} subtitle={lang === "bn" ? "বিমানবন্দর টার্মিনাল" : "Airport terminals"} onNew={() => setEdit({ kind: "terminals", row: null })} newLabel={lang === "bn" ? "নতুন টার্মিনাল" : "New terminal"} q={q} setQ={setQ} placeholder={lang === "bn" ? "টার্মিনাল নাম…" : "Terminal name…"}>
        <ErpDataTable columns={terminalCols} rows={loading ? [] : terminals} rowKey={(r) => r.id} loading={loading} lang={lang}
          emptyTitle={lang === "bn" ? "কোনো টার্মিনাল নেই" : "No terminals"} emptyHint={lang === "bn" ? "একটি বিমানবন্দরে টার্মিনাল যোগ করুন।" : "Add a terminal to an airport."}
          rowActions={(r) => actions("terminals", r, r.name)} />
      </SectionFrame>
    );
    return (
      <SectionFrame title={LABELS.flights} subtitle={lang === "bn" ? "ফ্লাইট নম্বর মাস্টার · সময়সূচি ছাড়া" : "Flight number master · no scheduling"} onNew={() => setEdit({ kind: "flights", row: null })} newLabel={lang === "bn" ? "নতুন ফ্লাইট নম্বর" : "New flight number"} q={q} setQ={setQ} placeholder={lang === "bn" ? "ফ্লাইট নম্বর…" : "Flight number, airline or airport…"}>
        <ErpDataTable columns={flightCols} rows={loading ? [] : flights} rowKey={(r) => r.id} loading={loading} lang={lang}
          emptyTitle={lang === "bn" ? "কোনো ফ্লাইট নম্বর নেই" : "No flight numbers"} emptyHint={lang === "bn" ? "এয়ারলাইন ও রুট দিয়ে ফ্লাইট নম্বর যোগ করুন।" : "Add a flight number with its airline and route."}
          rowActions={(r) => actions("flights", r, r.flightNumber)} />
      </SectionFrame>
    );
  }, [section, state, airlines, airports, terminals, flights, q, lang, busy]);

  return (
    <ErpThemeProvider theme="ds"><ERPShell
      moduleId="flight-master"
      moduleName={lang === "bn" ? "ফ্লাইট মাস্টার" : "Flight Master"}
      moduleColor={ERP.accent}
      moduleIcon={Plane as IconFC}
      navItems={NAV.map(({ section: _s, ...n }) => n)}
      activeItem={section}
      onItemClick={(id) => { setSection(id as Section); setQ(""); }}
      breadcrumb={[lang === "bn" ? "ফ্লাইট মাস্টার" : "Flight Master", LABELS[section]]}
      notificationCount={0}
    >
      <div className="flex flex-col h-full overflow-hidden" style={{ fontFamily: fontFor(lang) }}>
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>{body}</div>
      </div>

      <EditModal edit={edit} onClose={() => setEdit(null)} onSave={save} busy={busy}
        airlines={airlines} airports={airports} terminals={terminals} lang={lang} />

      <ErpModal open={!!del} onClose={() => setDel(null)} title={lang === "bn" ? "মুছে ফেলবেন?" : "Delete?"}
        footer={<div className="flex gap-2 justify-end"><ErpButton variant="secondary" onClick={() => setDel(null)}>{lang === "bn" ? "বাতিল" : "Cancel"}</ErpButton><ErpButton variant="danger" loading={busy} onClick={() => void remove()}>{lang === "bn" ? "মুছুন" : "Delete"}</ErpButton></div>}>
        <p className="text-sm" style={{ color: ERP.muted }}>{del?.label}</p>
      </ErpModal>
    </ERPShell></ErpThemeProvider>
  );
}

/** Create / edit dialog for all four entities. */
function EditModal({ edit, onClose, onSave, busy, airlines, airports, terminals, lang }: {
  edit: { kind: Section; row: Record<string, unknown> | null } | null;
  onClose: () => void; onSave: (k: Section, row: Record<string, unknown>) => void; busy: boolean;
  airlines: Airline[]; airports: Airport[]; terminals: Terminal[]; lang: string;
}) {
  const [f, setF] = useState<Record<string, unknown>>({});
  useEffect(() => {
    if (!edit) return;
    const r = edit.row;
    if (r) setF({ ...r });
    else setF(edit.kind === "airlines" ? { code: "", name: "", icao: "", country: "", active: true }
      : edit.kind === "airports" ? { iata: "", icao: "", name: "", city: "", country: "", timezone: "Asia/Riyadh", active: true }
        : edit.kind === "terminals" ? { airportId: airports[0]?.id ?? "", name: "", active: true }
          : { flightNumber: "", airlineId: airlines[0]?.id ?? "", originId: airports[0]?.id ?? "", destinationId: airports[1]?.id ?? "", defaultTerminalId: "", active: true });
  }, [edit, airports, airlines]);
  if (!edit) return null;
  const set = (k: string, v: unknown) => setF((p) => ({ ...p, [k]: v }));
  const S = (k: string) => String(f[k] ?? "");
  const titles: Record<Section, string> = {
    airlines: lang === "bn" ? "এয়ারলাইন" : "Airline", airports: lang === "bn" ? "বিমানবন্দর" : "Airport",
    terminals: lang === "bn" ? "টার্মিনাল" : "Terminal", flights: lang === "bn" ? "ফ্লাইট নম্বর" : "Flight Number",
  };
  const submit = () => {
    const payload: Record<string, unknown> = { ...f };
    delete payload.airline; delete payload.origin; delete payload.destination;
    delete payload.defaultTerminal; delete payload.terminals; delete payload.airport;
    delete payload.createdAt; delete payload.updatedAt;
    if (edit.kind === "flights" && !payload.defaultTerminalId) delete payload.defaultTerminalId;
    if (!payload.icao) delete payload.icao;
    onSave(edit.kind, payload);
  };
  const activeSelect = (
    <ErpField label={lang === "bn" ? "স্ট্যাটাস" : "Status"}>
      <ErpSelect value={f.active === false ? "false" : "true"} onChange={(e) => set("active", e.target.value === "true")}>
        <option value="true">{lang === "bn" ? "সক্রিয়" : "Active"}</option>
        <option value="false">{lang === "bn" ? "নিষ্ক্রিয়" : "Inactive"}</option>
      </ErpSelect>
    </ErpField>
  );
  return (
    <ErpModal open onClose={onClose} title={`${f.id ? (lang === "bn" ? "সম্পাদনা" : "Edit") : (lang === "bn" ? "নতুন" : "New")} — ${titles[edit.kind]}`}
      footer={<div className="flex gap-2 justify-end"><ErpButton variant="secondary" onClick={onClose}>{lang === "bn" ? "বাতিল" : "Cancel"}</ErpButton><ErpButton variant="primary" loading={busy} onClick={submit}>{lang === "bn" ? "সংরক্ষণ" : "Save"}</ErpButton></div>}>
      <ErpForm columns={2}>
        {edit.kind === "airlines" && (<>
          <ErpField label={lang === "bn" ? "কোড (IATA)" : "Code (IATA)"} required><ErpInput value={S("code")} onChange={(e) => set("code", e.target.value)} placeholder="SV" /></ErpField>
          <ErpField label="ICAO"><ErpInput value={S("icao")} onChange={(e) => set("icao", e.target.value)} placeholder="SVA" /></ErpField>
          <ErpFormRow span={2}><ErpField label={lang === "bn" ? "নাম" : "Name"} required><ErpInput value={S("name")} onChange={(e) => set("name", e.target.value)} /></ErpField></ErpFormRow>
          <ErpField label={lang === "bn" ? "দেশ" : "Country"} required><ErpInput value={S("country")} onChange={(e) => set("country", e.target.value)} /></ErpField>
          {activeSelect}
        </>)}
        {edit.kind === "airports" && (<>
          <ErpField label="IATA" required><ErpInput value={S("iata")} onChange={(e) => set("iata", e.target.value)} placeholder="JED" /></ErpField>
          <ErpField label="ICAO"><ErpInput value={S("icao")} onChange={(e) => set("icao", e.target.value)} placeholder="OEJN" /></ErpField>
          <ErpFormRow span={2}><ErpField label={lang === "bn" ? "নাম" : "Name"} required><ErpInput value={S("name")} onChange={(e) => set("name", e.target.value)} /></ErpField></ErpFormRow>
          <ErpField label={lang === "bn" ? "শহর" : "City"} required><ErpInput value={S("city")} onChange={(e) => set("city", e.target.value)} /></ErpField>
          <ErpField label={lang === "bn" ? "দেশ" : "Country"} required><ErpInput value={S("country")} onChange={(e) => set("country", e.target.value)} /></ErpField>
          <ErpField label={lang === "bn" ? "টাইমজোন" : "Timezone"} required><ErpInput value={S("timezone")} onChange={(e) => set("timezone", e.target.value)} placeholder="Asia/Riyadh" /></ErpField>
          {activeSelect}
        </>)}
        {edit.kind === "terminals" && (<>
          <ErpField label={lang === "bn" ? "বিমানবন্দর" : "Airport"} required>
            <ErpSelect value={S("airportId")} onChange={(e) => set("airportId", e.target.value)}>
              {airports.map((a) => <option key={a.id} value={a.id}>{a.iata} — {a.name}</option>)}
            </ErpSelect>
          </ErpField>
          <ErpField label={lang === "bn" ? "টার্মিনাল নাম" : "Terminal name"} required><ErpInput value={S("name")} onChange={(e) => set("name", e.target.value)} placeholder="Hajj Terminal" /></ErpField>
          {activeSelect}
        </>)}
        {edit.kind === "flights" && (<>
          <ErpField label={lang === "bn" ? "ফ্লাইট নম্বর" : "Flight number"} required><ErpInput value={S("flightNumber")} onChange={(e) => set("flightNumber", e.target.value)} placeholder="SV 642" /></ErpField>
          <ErpField label={lang === "bn" ? "এয়ারলাইন" : "Airline"} required>
            <ErpSelect value={S("airlineId")} onChange={(e) => set("airlineId", e.target.value)}>
              {airlines.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
            </ErpSelect>
          </ErpField>
          <ErpField label={lang === "bn" ? "উৎস" : "Origin"} required>
            <ErpSelect value={S("originId")} onChange={(e) => set("originId", e.target.value)}>
              {airports.map((a) => <option key={a.id} value={a.id}>{a.iata} — {a.city}</option>)}
            </ErpSelect>
          </ErpField>
          <ErpField label={lang === "bn" ? "গন্তব্য" : "Destination"} required>
            <ErpSelect value={S("destinationId")} onChange={(e) => set("destinationId", e.target.value)}>
              {airports.map((a) => <option key={a.id} value={a.id}>{a.iata} — {a.city}</option>)}
            </ErpSelect>
          </ErpField>
          <ErpField label={lang === "bn" ? "ডিফল্ট টার্মিনাল" : "Default terminal"}>
            <ErpSelect value={S("defaultTerminalId")} onChange={(e) => set("defaultTerminalId", e.target.value)}>
              <option value="">{lang === "bn" ? "— কোনোটি নয় —" : "— none —"}</option>
              {terminals.filter((t) => !f.destinationId || t.airportId === f.destinationId).map((t) => <option key={t.id} value={t.id}>{t.airport?.iata} · {t.name}</option>)}
            </ErpSelect>
          </ErpField>
          {activeSelect}
        </>)}
      </ErpForm>
    </ErpModal>
  );
}
