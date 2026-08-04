import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { api, ApiError } from "../lib/api";
import { EmptyState, LoadingSkeleton, ErrorState } from "../components/States";

const NAVY = "#0B1E3F", GOLD = "#C9A24B";
type Kind = "transport" | "visa" | "additional";
const VEHICLES = ["SEDAN", "VAN", "HIACE", "COASTER", "BUS"];
const UNITS = ["PER_VEHICLE", "PER_SEAT", "PER_PERSON", "PER_SERVICE", "PER_TRIP"];
const VISA_TYPES = ["UMRAH", "LONG_STAY", "HAJJ"], CATS = ["", "A", "B", "C"], PROC = ["NORMAL", "EXPRESS", "VIP"];
const SVC = ["WHEELCHAIR", "VIP_LOUNGE", "SIM_CARD", "INSURANCE", "PHOTOGRAPHY", "INTERPRETER", "CURRENCY_EXCHANGE", "OTHER"];
const inp = { backgroundColor: "#F5F7FA", border: "1px solid rgba(11,30,63,0.15)", color: NAVY } as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;
function defaults(k: Kind): Record<string, unknown> {
  if (k === "transport") return { vehicleType: "SEDAN", tripType: "ONE_WAY", unit: "PER_VEHICLE", currency: "SAR", price: 0 };
  if (k === "visa") return { visaType: "UMRAH", visaCategory: "", country: "SA", processingType: "NORMAL", currency: "SAR", price: 0 };
  return { serviceType: "WHEELCHAIR", unit: "PER_SERVICE", currency: "SAR", price: 0 };
}

export default function RateCards() {
  const [kind, setKind] = useState<Kind>("transport");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState(false);
  const [form, setForm] = useState<Record<string, unknown>>(defaults("transport"));

  const load = (k: Kind) => {
    setRows(null); setError(false);
    api.get<Row[]>("/rate-cards/" + k).then(setRows).catch(() => setError(true));
  };
  useEffect(() => { load(kind); setForm(defaults(kind)); /* eslint-disable-next-line */ }, [kind]);

  const set = (key: string, v: unknown) => setForm((f) => ({ ...f, [key]: v }));
  const create = async () => {
    try {
      const body: Record<string, unknown> = { ...form, price: Number(form.price) };
      if (kind === "visa" && !body.visaCategory) delete body.visaCategory;
      await api.post("/rate-cards/" + kind, body);
      toast.success("Rate card added"); setForm(defaults(kind)); load(kind);
    } catch (e) { toast.error(e instanceof ApiError ? e.message : "Could not add rate"); }
  };
  const toggle = async (r: Row) => { try { await api.patch("/rate-cards/" + kind + "/" + r.id, { active: !r.active }); load(kind); } catch { toast.error("Update failed"); } };
  const del = async (r: Row) => { try { await api.delete("/rate-cards/" + kind + "/" + r.id); load(kind); } catch { toast.error("Delete failed"); } };

  const Sel = ({ k, opts }: { k: string; opts: string[] }) => (
    <select value={String(form[k] ?? "")} onChange={(e) => set(k, e.target.value)} className="px-2 py-2 text-xs rounded-lg" style={inp}>
      {opts.map((o) => <option key={o} value={o}>{o || "— any —"}</option>)}
    </select>
  );

  const cols: Record<Kind, string[]> = {
    transport: ["vehicleType", "tripType", "unit", "currency", "price", "active"],
    visa: ["visaType", "visaCategory", "country", "processingType", "currency", "price", "active"],
    additional: ["serviceType", "unit", "currency", "price", "active"],
  };

  const formFields: ReactNode =
    kind === "transport" ? <><Sel k="vehicleType" opts={VEHICLES} /><Sel k="tripType" opts={["ONE_WAY", "ROUND_TRIP"]} /><Sel k="unit" opts={UNITS} /></>
    : kind === "visa" ? <><Sel k="visaType" opts={VISA_TYPES} /><Sel k="visaCategory" opts={CATS} /><Sel k="processingType" opts={PROC} /></>
    : <><Sel k="serviceType" opts={SVC} /><Sel k="unit" opts={UNITS} /></>;

  return (
    <div className="min-h-screen p-8" style={{ backgroundColor: "#F5F7FA" }}>
      <h1 className="text-lg font-bold mb-1" style={{ color: NAVY }}>Rate Card Administration</h1>
      <p className="text-xs mb-5" style={{ color: "rgba(11,30,63,0.58)" }}>Configurable, effective-dated price masters. Bookings snapshot the price at creation — changing a card never alters historical bookings.</p>
      <div className="flex gap-1 mb-4">
        {(["transport", "visa", "additional"] as Kind[]).map((k) => (
          <button key={k} onClick={() => setKind(k)} className="px-4 py-2 text-xs font-semibold rounded-lg capitalize" style={{ backgroundColor: kind === k ? NAVY : "#FFF", color: kind === k ? "#FFF" : NAVY, border: "1px solid rgba(11,30,63,0.15)" }}>{k}</button>
        ))}
      </div>

      <div className="rounded-2xl p-4 mb-5 flex flex-wrap items-end gap-2" style={{ backgroundColor: "#FFF", border: "1px solid rgba(11,30,63,0.11)" }}>
        {formFields}
        <input type="number" placeholder="Price" value={String(form.price ?? "")} onChange={(e) => set("price", e.target.value)} className="px-3 py-2 text-xs rounded-lg w-28" style={inp} />
        <input type="text" placeholder="SAR" value={String(form.currency ?? "SAR")} onChange={(e) => set("currency", e.target.value)} className="px-3 py-2 text-xs rounded-lg w-16" style={inp} />
        <input type="date" onChange={(e) => set("effectiveFrom", e.target.value ? new Date(e.target.value).toISOString() : undefined)} className="px-3 py-2 text-xs rounded-lg" style={inp} title="Effective from" />
        <button onClick={create} className="px-4 py-2 text-xs font-bold rounded-lg" style={{ backgroundColor: GOLD, color: NAVY }}>Add rate</button>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "#FFF", border: "1px solid rgba(11,30,63,0.11)" }}>
        {rows === null && !error ? <div className="p-5"><LoadingSkeleton rows={4} /></div>
          : error ? <div className="p-5"><ErrorState onRetry={() => load(kind)} /></div>
          : rows && rows.length === 0 ? <div className="p-5"><EmptyState title="No rate cards yet" hint="Add one above." /></div>
          : (
            <table className="w-full text-xs">
              <thead><tr style={{ backgroundColor: "#FBFCFD" }}>{cols[kind].map((c) => <th key={c} className="px-4 py-2.5 text-left font-bold uppercase tracking-wider" style={{ color: "rgba(11,30,63,0.5)", fontSize: 9 }}>{c}</th>)}<th /></tr></thead>
              <tbody>
                {rows?.map((r) => (
                  <tr key={r.id} style={{ borderTop: "1px solid rgba(11,30,63,0.07)" }}>
                    {cols[kind].map((c) => <td key={c} className="px-4 py-2.5" style={{ color: NAVY }}>{c === "active" ? (r.active ? "✓" : "—") : String(r[c] ?? "—")}</td>)}
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <button onClick={() => toggle(r)} className="text-[10px] font-semibold mr-3" style={{ color: r.active ? "#B45309" : "#16A34A" }}>{r.active ? "Deactivate" : "Activate"}</button>
                      <button onClick={() => del(r)} className="text-[10px] font-semibold" style={{ color: "#DC2626" }}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>
    </div>
  );
}
