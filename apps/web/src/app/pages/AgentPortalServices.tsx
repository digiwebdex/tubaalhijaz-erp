import { useEffect, useState, type ReactNode } from "react";
import {
  FileCheck, Building, Bus, UtensilsCrossed, LayoutGrid,
  Check, Download, Printer, Car, Truck, Plane, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState, LoadingSkeleton, ErrorState } from "../components/States";
import {
  ERP, CAT, erpAlpha, ErpCard, ErpButton, ErpInput, ErpSelect, ErpField,
  ErpTabs, ErpStepper,
} from "../components/erp";
import { api, ApiError, getStoredUser, isLoggedIn } from "../lib/api";
import { useLang } from "../lib/LangContext";
import { fontFor } from "@tuba/shared";

const GOLD = ERP.accent;

// Service colours — categorical accents from the shared theme (no hardcode).
const C_VISA      = CAT.teal;
const C_FLIGHT    = CAT.sky;
const C_HOTEL     = CAT.blue;
const C_TRANSPORT = CAT.orange;
const C_CATERING  = CAT.purple;
const C_EXTRA     = CAT.slate;

// Shared input surface style for the few raw <input>/<textarea> not on ErpInput
// (qty steppers, free-text areas) — reads only from theme tokens.
const IS = { backgroundColor: ERP.surface, border: `1px solid ${ERP.border}`, color: ERP.navy } as const;

// ─── Types ────────────────────────────────────────────────────────────────────

type ServiceId = "visa" | "flight" | "hotel" | "transport" | "catering" | "additional";

interface ApiGroup {
  id: string; code: string; name: string; paxCount: number;
  destination?: string; visaType?: string; status?: string;
  departDate?: string | null; returnDate?: string | null;
}

interface ApiVoucher { id: string; code: string; fileId: string; status: string; issueDate: string; validUntil: string | null }

interface ApiServiceRow {
  id: string; code: string; status: string; statusReason?: string | null; createdAt: string;
  group: { id: string; code: string; name: string; paxCount: number };
  supplier?: { name: string } | null;
  hotel?: { name: string; stars: number } | null;
  voucher?: ApiVoucher | null;
  // service-specific fields (present per service)
  checkIn?: string; checkOut?: string; nights?: number; doubleRooms?: number; tripleRooms?: number; singleRooms?: number;
  mealPlan?: string; totalAmount?: string | null; specialRequests?: string | null;
  vehicleType?: string; vehicleCount?: number; departurePoint?: string; destination?: string;
  departAt?: string; returnAt?: string | null; stopPoints?: string | null;
  halalCount?: number; vegetarianCount?: number; diabeticCount?: number; pricePerPaxDay?: string | null;
  serviceType?: string; beneficiaries?: number; priority?: string;
  nusukRef?: string | null; muallimNo?: string | null; mohCategory?: string | null; applicationYearHijri?: string | null; visaType?: string | null;
  embassy?: string | null;
  umrahCompanyId?: string | null;
  umrahCompany?: { id: string; code: string; name: string } | null;
}

interface ApiUmrahCompany {
  id: string; code: string; name: string; nameBn?: string | null; city?: string | null;
}

interface ApiHotel {
  id: string; name: string; city: string; stars: number;
  distanceFromHaramM: number | null; pricePerNight: string | number | null; available: boolean;
}

const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const fmtDateTime = (iso?: string | null) =>
  iso ? `${fmtDate(iso)} · ${new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : "—";
const titleCase = (s?: string | null) =>
  (s ?? "").toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const errMsg = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

/** Auth-carrying voucher PDF download (blob URL → new tab). */
const downloadVoucher = (voucher: ApiVoucher) => async () => {
  try {
    const url = await api.fileBlobUrl(voucher.fileId);
    window.open(url, "_blank");
  } catch (e) {
    toast.error(errMsg(e, "Could not download voucher"));
  }
};

// ─── Status pipelines (the real ServiceRequestStatus state machine) ───────────
// Supplier-routed services (hotel/transport/catering) flow through the supplier
// round-trip; visa/additional stay in the internal ops pipeline (no supplier,
// no voucher). Labels are the real states — nothing here is sample text.
const SUPPLIER_STATES = ["REQUESTED", "ASSIGNED", "CONFIRMED", "VOUCHER_ISSUED", "COMPLETED"];
const SUPPLIER_LABELS = ["Requested", "Sent to Supplier", "Accepted", "Voucher Issued", "Completed"];
const VISA_STATES = ["REQUESTED", "ASSIGNED", "CONFIRMED", "COMPLETED"];
const VISA_LABELS = ["Requested", "In Review", "Approved", "Completed"];
const EXTRA_STATES = ["REQUESTED", "ASSIGNED", "CONFIRMED", "COMPLETED"];
const EXTRA_LABELS = ["Requested", "Under Review", "Arranged", "Completed"];

/** Index of the current step for a real status; REJECTED/CANCELLED resolve to 0
 * (the tracker then shows the reason banner). */
function trackerStep(states: string[], status?: string): number {
  if (!status) return 0;
  const i = states.indexOf(status);
  return i >= 0 ? i : 0;
}


/** Canonical loading / error / empty state for a live list on these screens. */
function listState(
  { loading, error, count, onRetry, title, hint, rows = 3 }: {
    loading: boolean; error: boolean; count: number;
    onRetry: () => void; title: string; hint?: string; rows?: number;
  },
): ReactNode {
  if (loading) return <LoadingSkeleton tone="light" rows={rows} />;
  if (error) return <ErrorState tone="light" onRetry={onRetry} />;
  if (count === 0) return <EmptyState tone="light" title={title} hint={hint} />;
  return null;
}

/** Groups + this service's request rows — always the tenant's own, live data only. */
function useServiceWiring(service: "visa" | "hotel" | "transport" | "catering" | "additional" | null) {
  const [groups, setGroups] = useState<ApiGroup[] | null>(null);
  const [groupId, setGroupId] = useState("");
  const [rows, setRows] = useState<ApiServiceRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const refresh = () => {
    if (!isLoggedIn()) { setLoading(false); return; }
    setLoading(true);
    setError(false);
    const gp = api
      .get<ApiGroup[]>("/groups")
      .then((gs) => {
        setGroups(gs);
        if (gs.length > 0) setGroupId((cur) => (cur && gs.some((g) => g.id === cur) ? cur : gs[0].id));
      })
      .catch(() => { setGroups(null); setError(true); });
    const rp = service
      ? api.get<ApiServiceRow[]>(`/services/${service}`)
          .then((r) => setRows(r))
          .catch(() => { setRows(null); setError(true); })
      : Promise.resolve();
    void Promise.all([gp, rp]).then(() => setLoading(false));
  };
  useEffect(() => {
    const t = setTimeout(refresh, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const liveGroups = groups ?? [];
  const liveRows = rows ?? [];
  const selectedGroup = liveGroups.find((g) => g.id === groupId) ?? null;
  const latest = (groupId ? liveRows.find((r) => r.group.id === groupId) : null) ?? null;
  return { loading, error, liveGroups, groupId, setGroupId, selectedGroup, rows: liveRows, latest, refresh };
}

// ─── Shared layout helpers (Figma design system — pure UI) ────────────────────

// Field label + control wrapper — delegates to the shared ERP field label.
function FF({ label, children }: { label: string; children: ReactNode }) {
  return <ErpField label={label}>{children}</ErpField>;
}

// Thin adapters onto the shared ERP form controls (string onChange API kept for
// the screens; all styling/theming comes from ErpInput / ErpSelect).
function FInput({ placeholder, type = "text", value, onChange }: {
  placeholder?: string; type?: string; value?: string; onChange?: (v: string) => void;
}) {
  return (
    <ErpInput
      type={type}
      placeholder={placeholder}
      value={value ?? ""}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
    />
  );
}

function FSelect({ children, value, onChange, disabled }: {
  children: ReactNode; value?: string; onChange?: (v: string) => void; disabled?: boolean;
}) {
  return (
    <ErpSelect
      value={value}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      disabled={disabled}
    >
      {children}
    </ErpSelect>
  );
}

/** Group <select> — live tenant groups only; empty + disabled when the agent has none. */
function GroupSelect({ liveGroups, groupId, onChange }: {
  liveGroups: ApiGroup[]; groupId: string; onChange: (v: string) => void;
}) {
  if (liveGroups.length === 0) {
    return (
      <FSelect value="" disabled>
        <option value="">No groups yet — create one first</option>
      </FSelect>
    );
  }
  return (
    <FSelect value={groupId} onChange={onChange}>
      {liveGroups.map((g) => (
        <option key={g.id} value={g.id}>{g.code} — {g.name} ({g.paxCount} pax)</option>
      ))}
    </FSelect>
  );
}

// Surface card with optional title — shared ErpCard (theme-driven).
function FormCard({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <ErpCard title={title} padding="md">
      <div className="space-y-4">{children}</div>
    </ErpCard>
  );
}

// Full-width submit — shared ErpButton with the per-service categorical accent.
function SubmitBtn({ color, label = "Submit Request", onClick, disabled }: {
  color: string; label?: string; onClick?: () => void; disabled?: boolean;
}) {
  return (
    <ErpButton
      onClick={onClick}
      disabled={disabled}
      style={{ width: "100%", marginTop: ERP.space[1], backgroundColor: color, color: ERP.primaryFg }}
    >
      {label}
    </ErpButton>
  );
}

// ─── Status Tracker (real state machine; no sample text) ─────────────────────

function StatusTracker({ title = "Request Status", labels, currentStep, color, submittedAt, reason }: {
  title?: string; labels: string[]; currentStep: number; color: string; submittedAt?: string | null; reason?: string | null;
}) {
  const rejected = !!reason;
  return (
    <ErpCard padding="md">
      <div className="text-xs font-bold" style={{ color: ERP.navy }}>{title}</div>
      {submittedAt && <div className="text-[10px] mt-0.5 mb-4" style={{ color: ERP.muted }}>Submitted {fmtDate(submittedAt)}</div>}
      {!submittedAt && <div className="mb-4" />}
      {rejected && (
        <div className="mb-4"><ErrorState message={`Request ${reason}`} /></div>
      )}
      <ErpStepper steps={labels} current={currentStep} accent={color} halted={rejected} />
    </ErpCard>
  );
}

/** Right-column tracker slot: loading skeleton, real tracker, or empty prompt. */
function TrackerSlot({ loading, latest, states, labels, color, title }: {
  loading: boolean; latest: ApiServiceRow | null; states: string[]; labels: string[]; color: string; title?: string;
}) {
  if (loading) {
    return (
      <ErpCard padding="md">
        <LoadingSkeleton rows={labels.length} />
      </ErpCard>
    );
  }
  if (!latest) {
    return (
      <ErpCard padding="md">
        <EmptyState title="No request yet" hint="Submit a request to track its status here." />
      </ErpCard>
    );
  }
  const reason = latest.status === "REJECTED" || latest.status === "CANCELLED"
    ? (latest.statusReason ? `${titleCase(latest.status)}: ${latest.statusReason}` : titleCase(latest.status))
    : null;
  return (
    <StatusTracker
      title={title}
      labels={labels}
      currentStep={trackerStep(states, latest.status)}
      color={color}
      submittedAt={latest.createdAt}
      reason={reason}
    />
  );
}

// Recent requests mini-table (real rows only)
function RecentReqs({ rows, color, state }: { rows: { ref: string; group: string; status: string; date: string }[]; color: string; state?: ReactNode }) {
  const statusColor = (s: string) => s === "approved" || s === "confirmed" || s === "complete" || s === "completed" ? ERP.success : s === "requested" || s === "pending" ? ERP.warning : s === "rejected" || s === "cancelled" ? ERP.destructive : ERP.info;
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${ERP.border}`, background: ERP.surface }}>
      <div className="px-4 py-3" style={{ backgroundColor: ERP.surfaceSoft, borderBottom: `1px solid ${ERP.border}` }}>
        <span className="text-[10px] font-bold" style={{ color: ERP.navy }}>Recent Requests</span>
      </div>
      {state ? <div className="px-4">{state}</div> : rows.map((r, i) => (
        <div key={r.ref} className="flex items-center gap-3 px-4 py-2.5" style={{ borderBottom: i < rows.length - 1 ? `1px solid ${ERP.border}` : undefined }}>
          <span className="text-[9px] flex-1 min-w-0 truncate" style={{ color, fontFamily: ERP.font.data }} title={r.ref}>{r.ref}</span>
          <span className="text-[10px] flex-1 min-w-0 truncate" style={{ color: ERP.muted }} title={r.group}>{r.group}</span>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ backgroundColor: erpAlpha(statusColor(r.status), 9), color: statusColor(r.status) }}>{r.status}</span>
          <span className="text-[9px] shrink-0" style={{ color: ERP.mutedSoft, fontFamily: ERP.font.data }}>{r.date}</span>
        </div>
      ))}
    </div>
  );
}

// Voucher card (real issued voucher only)
function VoucherCard({ color, title, badge, lines, onDownload }: {
  color: string; title: string; badge: string;
  lines: [string, string][]; onDownload?: () => void;
}) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${erpAlpha(color, 19)}`, background: ERP.surface }}>
      <div className="px-5 py-3 flex items-center justify-between" style={{ backgroundColor: erpAlpha(color, 7) }}>
        <div>
          <div className="text-[9px] font-bold uppercase tracking-widest mb-0.5" style={{ color }}>TUBA AL HIJAZ · {title.toUpperCase()}</div>
          <div className="text-xs font-bold" style={{ color: ERP.navy }}>{title}</div>
        </div>
        <span className="text-[9px] font-bold px-2 py-1 rounded-full" style={{ backgroundColor: erpAlpha(ERP.success, 9), color: ERP.success }}>{badge}</span>
      </div>
      <div className="px-5 py-4 space-y-2">
        {lines.map(([l, v]) => (
          <div key={l} className="flex justify-between">
            <span className="text-[10px] shrink-0" style={{ color: ERP.muted }}>{l}</span>
            <span className="text-[10px] font-semibold min-w-0 truncate" style={{ color: ERP.navy }} title={v}>{v}</span>
          </div>
        ))}
      </div>
      <div className="px-5 pb-4 flex gap-2">
        <button onClick={onDownload} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold" style={{ backgroundColor: erpAlpha(color, 9), color }}>
          <Download size={11} /> Download PDF
        </button>
        <button className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: ERP.surfaceSoft, color: ERP.muted }}>
          <Printer size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── Service page header ──────────────────────────────────────────────────────

function SvcHeader({ color, icon: Icon, title, subtitle }: {
  color: string; icon: typeof FileCheck; title: string; subtitle: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-6 pb-5" style={{ borderBottom: `1px solid ${ERP.border}` }}>
      <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: erpAlpha(color, 8), border: `1px solid ${erpAlpha(color, 19)}` }}>
        <Icon size={19} style={{ color }} />
      </div>
      <div>
        <h2 className="text-sm font-bold" style={{ color: ERP.navy }}>{title}</h2>
        <p className="text-xs mt-0.5" style={{ color: ERP.muted }}>{subtitle}</p>
      </div>
    </div>
  );
}

// ─── 1. Visa Screen ───────────────────────────────────────────────────────────

const VISA_TYPE_API: Record<"umrah" | "hajj" | "longstay", "UMRAH" | "HAJJ" | "LONG_STAY"> = {
  umrah: "UMRAH",
  hajj: "HAJJ",
  longstay: "LONG_STAY",
};

function VisaScreen() {
  const { loading, error, liveGroups, groupId, setGroupId, selectedGroup, rows, latest, refresh } = useServiceWiring("visa");
  const [visaType, setVisaType] = useState<"umrah" | "hajj" | "longstay">("umrah");
  const [yearHijri, setYearHijri] = useState("");
  const [nusukRef, setNusukRef] = useState("");
  const [muallimNo, setMuallimNo] = useState("");
  const [mahramWaiverNo, setMahramWaiverNo] = useState("");
  const [mohCategory, setMohCategory] = useState("A");
  const [embassy, setEmbassy] = useState("");
  const [umrahCompanyId, setUmrahCompanyId] = useState("");
  const [umrahCompanies, setUmrahCompanies] = useState<ApiUmrahCompany[]>([]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) return;
    api.get<ApiUmrahCompany[]>("/services/umrah-companies")
      .then(setUmrahCompanies)
      .catch(() => setUmrahCompanies([]));
  }, []);

  const submit = async () => {
    if (!groupId) { toast.error("No group available — create a group first"); return; }
    setSubmitting(true);
    try {
      const created = await api.post<{ code: string }>("/services/visa", {
        groupId,
        visaType: VISA_TYPE_API[visaType],
        ...(yearHijri.trim() ? { applicationYearHijri: yearHijri.trim() } : {}),
        ...(nusukRef.trim() ? { nusukRef: nusukRef.trim() } : {}),
        ...(muallimNo.trim() ? { muallimNo: muallimNo.trim() } : {}),
        ...(mahramWaiverNo.trim() ? { mahramWaiverNo: mahramWaiverNo.trim() } : {}),
        ...(embassy.trim() ? { embassy: embassy.trim() } : {}),
        ...(umrahCompanyId.trim() ? { umrahCompanyId: umrahCompanyId.trim() } : {}),
        mohCategory,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      toast.success(`Visa request ${created.code} submitted`);
      refresh();
    } catch (e) {
      toast.error(errMsg(e, "Could not submit visa request"));
    } finally {
      setSubmitting(false);
    }
  };

  const recentState = listState({ loading, error, count: rows.length, onRetry: refresh, title: "No visa requests yet", hint: "Submitted visa batches will appear here." });

  return (
    <div className="p-7">
      <SvcHeader color={C_VISA} icon={FileCheck} title="Visa Request — Umrah / Hajj / Long Stay" subtitle="Submit Nusuk reference, Umrah Co, and Muallim number for MOH processing" />
      <div className="grid grid-cols-5 gap-6">
        <div className="col-span-3 space-y-4">
          <FormCard title="Group & Visa Details">
            <div className="grid grid-cols-2 gap-3">
              <FF label="Group"><GroupSelect liveGroups={liveGroups} groupId={groupId} onChange={setGroupId} /></FF>
              <FF label="Application Year (Hijri)"><FInput placeholder="Defaults to active season" value={yearHijri} onChange={setYearHijri} /></FF>
            </div>
            <FF label="Visa Type">
              <div className="grid grid-cols-3 gap-2">
                {([
                  { id: "umrah" as const, label: "Umrah (14 days)" },
                  { id: "hajj" as const, label: "Hajj" },
                  { id: "longstay" as const, label: "Long Stay" },
                ]).map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setVisaType(v.id)}
                    className="py-2.5 rounded-xl text-xs font-semibold transition-all"
                    style={{ backgroundColor: visaType === v.id ? C_VISA : ERP.surfaceSoft, border: `1px solid ${visaType === v.id ? C_VISA : ERP.mutedSoft}`, color: visaType === v.id ? "white" : ERP.muted }}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </FF>
            <div className="grid grid-cols-2 gap-3">
              <FF label="Umrah Company">
                <FSelect value={umrahCompanyId} onChange={setUmrahCompanyId}>
                  <option value="">Use group default (if set)</option>
                  {umrahCompanies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                  ))}
                </FSelect>
              </FF>
              <FF label="Embassy / Consulate"><FInput placeholder="Defaults from group consulate" value={embassy} onChange={setEmbassy} /></FF>
            </div>
          </FormCard>

          <FormCard title="Government Reference Numbers">
            <div className="grid grid-cols-2 gap-3">
              <FF label="Nusuk Platform Reference"><FInput placeholder="NK-XXXXXXXX" value={nusukRef} onChange={setNusukRef} /></FF>
              <FF label="Muallim Number"><FInput placeholder="MU-XXXXXXXX" value={muallimNo} onChange={setMuallimNo} /></FF>
              <FF label="Mahram Waiver No. (women 45+)"><FInput placeholder="MHW-XXXXXXXX (if applicable)" value={mahramWaiverNo} onChange={setMahramWaiverNo} /></FF>
              <FF label="MOH Package Category">
                <FSelect value={mohCategory} onChange={setMohCategory}>
                  <option value="A">Category A — Standard</option>
                  <option value="B">Category B — Economy</option>
                  <option value="C">Category C — Premium</option>
                </FSelect>
              </FF>
              <div className="col-span-2">
                <FF label="Notes (optional)"><FInput placeholder="Any note for MOH processing" value={notes} onChange={setNotes} /></FF>
              </div>
            </div>
          </FormCard>

          <FormCard title="Passport Batch">
            <div className="flex items-center justify-between">
              <div className="text-xs text-[color:var(--erp-text-strong)] min-w-0 truncate">
                {selectedGroup ? `${selectedGroup.paxCount} passenger${selectedGroup.paxCount === 1 ? "" : "s"} linked from ${selectedGroup.code}` : "Select a group to link its passengers"}
              </div>
              {selectedGroup && <span className="text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0" style={{ backgroundColor: `${C_VISA}18`, color: C_VISA }}>{selectedGroup.paxCount} pax</span>}
            </div>
          </FormCard>

          <SubmitBtn color={C_VISA} label="Submit Visa Batch to MOH" onClick={submit} disabled={submitting || !groupId} />
        </div>

        <div className="col-span-2 space-y-4">
          <TrackerSlot loading={loading} latest={latest} states={VISA_STATES} labels={VISA_LABELS} color={C_VISA} title="Visa Status" />
          {latest && (
            <div className="rounded-xl p-4 space-y-2" style={{ backgroundColor: ERP.surface, border: `1px solid ${ERP.border}` }}>
              <div className="text-[10px] font-bold text-[color:var(--erp-text-strong)] mb-1">Latest Request</div>
              {([
                ["Reference", latest.code],
                ["Type", titleCase(latest.visaType)],
                ["Umrah Co", latest.umrahCompany?.name ?? "—"],
                ["Embassy", latest.embassy ?? "—"],
                ["MOH Category", latest.mohCategory ? `Category ${latest.mohCategory}` : "—"],
                ["Nusuk Ref", latest.nusukRef ?? "—"],
                ["Muallim No", latest.muallimNo ?? "—"],
                ["Status", titleCase(latest.status)],
              ] as [string, string][]).map(([l, v]) => (
                <div key={l} className="flex justify-between">
                  <span className="text-[10px]" style={{ color: ERP.muted }}>{l}</span>
                  <span className="text-[10px] font-semibold text-[color:var(--erp-text-strong)] min-w-0 truncate ml-3" title={v}>{v}</span>
                </div>
              ))}
            </div>
          )}
          <RecentReqs
            color={C_VISA}
            state={recentState}
            rows={rows.slice(0, 4).map((r) => ({ ref: r.code, group: r.group.code, status: titleCase(r.status), date: fmtDate(r.createdAt) }))}
          />
        </div>
      </div>
    </div>
  );
}

// ─── 2. Flight Screen — deferred (no /services/flight endpoint yet) ───────────

function FlightComingSoon() {
  return (
    <div className="p-7">
      <SvcHeader color={C_FLIGHT} icon={Plane} title="Flight Information & Ticket Upload" subtitle="Arrival/departure details and airline ticket upload" />
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: `${C_FLIGHT}12`, border: `1px solid ${C_FLIGHT}25` }}>
          <Clock size={22} style={{ color: C_FLIGHT }} />
        </div>
        <h3 className="text-sm font-bold text-[color:var(--erp-text-strong)] mb-1.5">ফ্লাইট</h3>
        <p className="text-xs max-w-sm" style={{ color: ERP.muted }}>
          এই মডিউল এখনও কনফিগার করা হয়নি। ভিসা, হোটেল, পরিবহন, ক্যাটারিং ও অতিরিক্ত সেবা লাইভ।
        </p>
      </div>
    </div>
  );
}

// ─── 3. Hotel Screen ──────────────────────────────────────────────────────────

function HotelScreen() {
  const { loading, liveGroups, groupId, setGroupId, latest, refresh } = useServiceWiring("hotel");
  const [selected, setSelected] = useState<string>("");
  const [liveHotels, setLiveHotels] = useState<ApiHotel[] | null>(null);
  const [hLoading, setHLoading] = useState(true);
  const [hError, setHError] = useState(false);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [doubleRooms, setDoubleRooms] = useState("");
  const [tripleRooms, setTripleRooms] = useState("");
  const [singleRooms, setSingleRooms] = useState("");
  const [mealPlan, setMealPlan] = useState("FULL_BOARD");
  const [specialRequests, setSpecialRequests] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const refreshHotels = () => {
    if (!isLoggedIn()) { setHLoading(false); return; }
    setHLoading(true);
    setHError(false);
    api
      .get<ApiHotel[]>("/hotels")
      .then((hs) => {
        setLiveHotels(hs);
        const first = hs.find((h) => h.available) ?? hs[0];
        if (first) setSelected((cur) => (hs.some((h) => h.id === cur) ? cur : first.id));
      })
      .catch(() => { setLiveHotels(null); setHError(true); })
      .finally(() => setHLoading(false));
  };
  useEffect(() => {
    const t = setTimeout(refreshHotels, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async () => {
    if (!groupId) { toast.error("No group available — create a group first"); return; }
    if (!checkIn || !checkOut) { toast.error("Select check-in and check-out dates"); return; }
    setSubmitting(true);
    try {
      const created = await api.post<{ code: string }>("/services/hotel", {
        groupId,
        ...(liveHotels?.some((h) => h.id === selected) ? { hotelId: selected } : {}),
        checkIn,
        checkOut,
        doubleRooms: parseInt(doubleRooms, 10) || 0,
        tripleRooms: parseInt(tripleRooms, 10) || 0,
        ...(parseInt(singleRooms, 10) ? { singleRooms: parseInt(singleRooms, 10) } : {}),
        mealPlan,
        ...(specialRequests.trim() ? { specialRequests: specialRequests.trim() } : {}),
      });
      toast.success(`Hotel booking ${created.code} submitted`);
      refresh();
    } catch (e) {
      toast.error(errMsg(e, "Could not submit hotel booking"));
    } finally {
      setSubmitting(false);
    }
  };

  const hotelCards = (liveHotels ?? []).map((h) => ({
    id: h.id,
    name: h.name,
    stars: h.stars,
    dist: h.distanceFromHaramM == null ? "—" : h.distanceFromHaramM >= 1000 ? `${(h.distanceFromHaramM / 1000).toFixed(1).replace(/\.0$/, "")}km` : `${h.distanceFromHaramM}m`,
    price: h.pricePerNight == null ? "—" : `SAR ${Number(h.pricePerNight).toLocaleString()}/room/night`,
    avail: h.available,
  }));
  const hotelsState = listState({ loading: hLoading, error: hError, count: hotelCards.length, onRetry: refreshHotels, title: "No hotels available", hint: "No MOH-approved hotels are currently listed for your account.", rows: 4 });
  const hotel = hotelCards.find((h) => h.id === selected);

  const voucher = latest?.voucher ?? null;
  const voucherLines: [string, string][] = voucher && latest
    ? [
        ["Agency", getStoredUser()?.company?.name ?? "—"],
        ["Group", latest.group.code],
        ["Hotel", latest.hotel?.name ?? "As arranged by TUBA"],
        ["Check-in", fmtDate(latest.checkIn)],
        ["Check-out", fmtDate(latest.checkOut)],
        ["Nights", String(latest.nights ?? "—")],
        ["Rooms", `${latest.doubleRooms ?? 0} Double + ${latest.tripleRooms ?? 0} Triple${latest.singleRooms ? ` + ${latest.singleRooms} Single` : ""}`],
        ["Pax", String(latest.group.paxCount)],
        ["Meal Plan", titleCase(latest.mealPlan)],
      ]
    : [];

  return (
    <div className="p-7">
      <SvcHeader color={C_HOTEL} icon={Building} title="Hotel Request" subtitle="Select from MOH-approved hotels, allocate rooms — voucher generated on supplier acceptance" />
      <div className="grid grid-cols-5 gap-6">
        <div className="col-span-3 space-y-4">
          <FF label="Group"><GroupSelect liveGroups={liveGroups} groupId={groupId} onChange={setGroupId} /></FF>

          <div>
            <div className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: ERP.muted }}>Select Hotel</div>
            <div className="space-y-2">
              {hotelsState ?? hotelCards.map((h) => (
                <button
                  key={h.id}
                  onClick={() => h.avail && setSelected(h.id)}
                  className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all text-left"
                  style={{ border: `1px solid ${selected === h.id ? C_HOTEL : ERP.borderStrong}`, backgroundColor: selected === h.id ? `${C_HOTEL}0A` : ERP.surface, opacity: h.avail ? 1 : 0.45, cursor: h.avail ? "pointer" : "not-allowed" }}
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${C_HOTEL}15` }}>
                    <Building size={15} style={{ color: C_HOTEL }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-[color:var(--erp-text-strong)] truncate" title={h.name}>{h.name}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9px]" style={{ color: GOLD }}>{"★".repeat(h.stars)}</span>
                      <span className="text-[9px]" style={{ color: ERP.muted }}>{h.dist} from Haram</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[10px] font-semibold" style={{ color: h.avail ? ERP.navy : ERP.muted }}>{h.price}</div>
                    <div className="text-[9px]" style={{ color: h.avail ? ERP.success : ERP.destructive }}>{h.avail ? "Available" : "Full"}</div>
                  </div>
                  {selected === h.id && <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: C_HOTEL }}><Check size={9} style={{ color: ERP.navy }} /></div>}
                </button>
              ))}
            </div>
          </div>

          <FormCard title="Room Allocation">
            <div className="grid grid-cols-2 gap-3">
              <FF label="Check-in Date"><FInput type="date" value={checkIn} onChange={setCheckIn} /></FF>
              <FF label="Check-out Date"><FInput type="date" value={checkOut} onChange={setCheckOut} /></FF>
              <FF label="Double Rooms"><FInput type="number" placeholder="0" value={doubleRooms} onChange={setDoubleRooms} /></FF>
              <FF label="Triple Rooms"><FInput type="number" placeholder="0" value={tripleRooms} onChange={setTripleRooms} /></FF>
              <FF label="Single Rooms (optional)"><FInput type="number" placeholder="0" value={singleRooms} onChange={setSingleRooms} /></FF>
              <FF label="Meal Plan">
                <FSelect value={mealPlan} onChange={setMealPlan}>
                  <option value="FULL_BOARD">Full Board</option>
                  <option value="HALF_BOARD">Half Board</option>
                  <option value="BED_BREAKFAST">Bed & Breakfast</option>
                  <option value="ROOM_ONLY">Room Only</option>
                </FSelect>
              </FF>
              <div className="col-span-2">
                <FF label="Special Requests (optional)"><FInput placeholder="e.g. ground floor, wheelchair access" value={specialRequests} onChange={setSpecialRequests} /></FF>
              </div>
            </div>
          </FormCard>
          <SubmitBtn color={C_HOTEL} label="Submit Hotel Booking" onClick={submit} disabled={submitting || !groupId} />
        </div>

        <div className="col-span-2 space-y-4">
          <TrackerSlot loading={loading} latest={latest} states={SUPPLIER_STATES} labels={SUPPLIER_LABELS} color={C_HOTEL} title="Booking Status" />
          {voucher && <VoucherCard color={C_HOTEL} title="Hotel Voucher" badge="Issued" lines={voucherLines} onDownload={downloadVoucher(voucher)} />}
        </div>
      </div>
    </div>
  );
}

// ─── 4. Transport Screen ──────────────────────────────────────────────────────

const VEHICLES: { id: string; label: string; cap: string; icon: typeof Car }[] = [
  { id: "SEDAN",   label: "Sedan",   cap: "4 pax",  icon: Car },
  { id: "HIACE",   label: "Hiace",   cap: "12 pax", icon: Truck },
  { id: "COASTER", label: "Coaster", cap: "30 pax", icon: Bus },
  { id: "BUS",     label: "Bus",     cap: "47 pax", icon: Bus },
  { id: "VAN",     label: "Van",     cap: "8 pax",  icon: Truck },
];

function TransportScreen() {
  const { loading, liveGroups, groupId, setGroupId, latest, refresh } = useServiceWiring("transport");
  const [vehicle, setVehicle] = useState("BUS");
  const [qty, setQty] = useState(1);
  const [departurePoint, setDeparturePoint] = useState("");
  const [destination, setDestination] = useState("");
  const [departAt, setDepartAt] = useState("");
  const [returnAt, setReturnAt] = useState("");
  const [stopPoints, setStopPoints] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!groupId) { toast.error("No group available — create a group first"); return; }
    if (!departurePoint.trim() || !destination.trim() || !departAt) { toast.error("Fill in the route and departure time"); return; }
    setSubmitting(true);
    try {
      const created = await api.post<{ code: string }>("/services/transport", {
        groupId,
        vehicleType: vehicle,
        vehicleCount: qty,
        departurePoint: departurePoint.trim(),
        destination: destination.trim(),
        departAt: new Date(departAt).toISOString(),
        ...(returnAt ? { returnAt: new Date(returnAt).toISOString() } : {}),
        ...(stopPoints.trim() ? { stopPoints: stopPoints.trim() } : {}),
      });
      toast.success(`Transport request ${created.code} submitted`);
      refresh();
    } catch (e) {
      toast.error(errMsg(e, "Could not submit transport request"));
    } finally {
      setSubmitting(false);
    }
  };

  const voucher = latest?.voucher ?? null;
  const vMeta = latest ? VEHICLES.find((v) => v.id === (latest.vehicleType ?? "")) : undefined;
  const voucherLines: [string, string][] = voucher && latest
    ? [
        ["Carrier", latest.supplier?.name ?? "TUBA AL HIJAZ Operations"],
        ["Group", latest.group.code],
        ["Vehicle", `${latest.vehicleCount ?? 1}× ${vMeta?.label ?? titleCase(latest.vehicleType)}${vMeta ? ` (${vMeta.cap})` : ""}`],
        ["Pickup", latest.departurePoint ?? "—"],
        ["Route", `${latest.departurePoint ?? "—"} → ${latest.destination ?? "—"}`],
        ["Depart", fmtDateTime(latest.departAt)],
        ["Return", fmtDateTime(latest.returnAt)],
      ]
    : [];

  return (
    <div className="p-7">
      <SvcHeader color={C_TRANSPORT} icon={Bus} title="Transport Request" subtitle="Select vehicle type and route — voucher generated on supplier acceptance" />
      <div className="grid grid-cols-5 gap-6">
        <div className="col-span-3 space-y-4">
          <FF label="Group"><GroupSelect liveGroups={liveGroups} groupId={groupId} onChange={setGroupId} /></FF>

          <div>
            <div className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: ERP.muted }}>Vehicle Type</div>
            <div className="grid grid-cols-5 gap-2">
              {VEHICLES.map((v) => {
                const VIcon = v.icon;
                return (
                  <button
                    key={v.id}
                    onClick={() => setVehicle(v.id)}
                    className="flex flex-col items-center gap-2 py-4 px-2 rounded-xl transition-all"
                    style={{ border: `1px solid ${vehicle === v.id ? C_TRANSPORT : ERP.borderStrong}`, backgroundColor: vehicle === v.id ? `${C_TRANSPORT}0C` : ERP.surface }}
                  >
                    <VIcon size={20} style={{ color: vehicle === v.id ? C_TRANSPORT : ERP.muted }} />
                    <div className="text-center">
                      <div className="text-[10px] font-bold text-[color:var(--erp-text-strong)]">{v.label}</div>
                      <div className="text-[9px]" style={{ color: ERP.muted }}>{v.cap}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <FormCard title="Route & Schedule">
            <div className="grid grid-cols-2 gap-3">
              <FF label="Departure Point"><FInput placeholder="e.g. Jeddah North Terminal" value={departurePoint} onChange={setDeparturePoint} /></FF>
              <FF label="Destination"><FInput placeholder="e.g. Makkah — Haram Gate 1" value={destination} onChange={setDestination} /></FF>
              <FF label="Departure Date & Time"><FInput type="datetime-local" value={departAt} onChange={setDepartAt} /></FF>
              <FF label="Return Date & Time (optional)"><FInput type="datetime-local" value={returnAt} onChange={setReturnAt} /></FF>
              <FF label="Number of Vehicles">
                <div className="flex items-center gap-2">
                  <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: ERP.surfaceSoft, color: ERP.navy }}>−</button>
                  <input type="number" value={qty} readOnly className="flex-1 text-center px-3 py-2 text-xs rounded-xl focus:outline-none" style={IS} />
                  <button onClick={() => setQty(qty + 1)} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: ERP.surfaceSoft, color: ERP.navy }}>+</button>
                </div>
              </FF>
              <FF label="Stop Points (optional)"><FInput placeholder="e.g. Hotel → Haram → Mina" value={stopPoints} onChange={setStopPoints} /></FF>
            </div>
          </FormCard>
          <SubmitBtn color={C_TRANSPORT} label="Submit Transport Request" onClick={submit} disabled={submitting || !groupId} />
        </div>

        <div className="col-span-2 space-y-4">
          <TrackerSlot loading={loading} latest={latest} states={SUPPLIER_STATES} labels={SUPPLIER_LABELS} color={C_TRANSPORT} title="Booking Status" />
          {voucher && <VoucherCard color={C_TRANSPORT} title="Transport Voucher" badge="Issued" lines={voucherLines} onDownload={downloadVoucher(voucher)} />}
        </div>
      </div>
    </div>
  );
}

// ─── 5. Catering Screen ───────────────────────────────────────────────────────

const MEAL_PLANS: { id: string; label: string; price: number; meals: string[]; color: string }[] = [
  { id: "BREAKFAST_ONLY", label: "Breakfast Only", price: 35,  meals: ["B"],           color: ERP.warning },
  { id: "HALF_BOARD",     label: "Half Board",     price: 85,  meals: ["B", "D"],      color: C_VISA },
  { id: "FULL_BOARD",     label: "Full Board",     price: 140, meals: ["B", "L", "D"], color: C_CATERING },
  { id: "PREMIUM",        label: "Premium Board",  price: 200, meals: ["B", "L", "D", "★"], color: GOLD },
];

function CateringScreen() {
  const { loading, liveGroups, groupId, setGroupId, selectedGroup, latest, refresh } = useServiceWiring("catering");
  const [plan, setPlan] = useState("FULL_BOARD");
  const [halalCount, setHalalCount] = useState("");
  const [vegetarianCount, setVegetarianCount] = useState("");
  const [diabeticCount, setDiabeticCount] = useState("");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const selected = MEAL_PLANS.find((p) => p.id === plan)!;
  const pax = selectedGroup?.paxCount ?? null;
  const days = selectedGroup?.departDate && selectedGroup?.returnDate
    ? Math.max(1, Math.round((new Date(selectedGroup.returnDate).getTime() - new Date(selectedGroup.departDate).getTime()) / 86_400_000))
    : null;
  const total = pax !== null && days !== null ? selected.price * pax * days : null;

  const submit = async () => {
    if (!groupId) { toast.error("No group available — create a group first"); return; }
    setSubmitting(true);
    try {
      const created = await api.post<{ code: string }>("/services/catering", {
        groupId,
        mealPlan: plan,
        ...(parseInt(halalCount, 10) >= 0 && halalCount !== "" ? { halalCount: parseInt(halalCount, 10) } : {}),
        ...(parseInt(vegetarianCount, 10) >= 0 && vegetarianCount !== "" ? { vegetarianCount: parseInt(vegetarianCount, 10) } : {}),
        ...(parseInt(diabeticCount, 10) >= 0 && diabeticCount !== "" ? { diabeticCount: parseInt(diabeticCount, 10) } : {}),
        ...(specialInstructions.trim() ? { specialInstructions: specialInstructions.trim() } : {}),
      });
      toast.success(`Catering request ${created.code} submitted`);
      refresh();
    } catch (e) {
      toast.error(errMsg(e, "Could not submit catering request"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-7">
      <SvcHeader color={C_CATERING} icon={UtensilsCrossed} title="Catering Request" subtitle="Select a meal plan package and confirm dietary allocations per group" />
      <div className="grid grid-cols-5 gap-6">
        <div className="col-span-3 space-y-4">
          <FF label="Group"><GroupSelect liveGroups={liveGroups} groupId={groupId} onChange={setGroupId} /></FF>

          <div>
            <div className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: ERP.muted }}>Meal Plan</div>
            <div className="grid grid-cols-2 gap-3">
              {MEAL_PLANS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPlan(p.id)}
                  className="flex flex-col items-start gap-2 p-4 rounded-xl transition-all text-left"
                  style={{ border: `1px solid ${plan === p.id ? p.color : ERP.borderStrong}`, backgroundColor: plan === p.id ? `${p.color}0C` : ERP.surface }}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-1.5">
                      {p.meals.map((m) => (
                        <span key={m} className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: `${p.color}25`, color: p.color }}>{m}</span>
                      ))}
                    </div>
                    {plan === p.id && <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ backgroundColor: p.color }}><Check size={9} style={{ color: ERP.navy }} /></div>}
                  </div>
                  <div className="text-xs font-bold text-[color:var(--erp-text-strong)]">{p.label}</div>
                  <div>
                    <span className="text-base font-bold" style={{ color: p.color, fontFamily: "var(--font-mono)" }}>SAR {p.price}</span>
                    <span className="text-[10px] ml-1" style={{ color: ERP.muted }}>/ pax / day</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <FormCard title="Dietary Requirements (optional — defaults to whole group)">
            <div className="grid grid-cols-3 gap-3">
              <FF label="Halal"><FInput type="number" placeholder={pax !== null ? String(pax) : "All"} value={halalCount} onChange={setHalalCount} /></FF>
              <FF label="Vegetarian"><FInput type="number" placeholder="0" value={vegetarianCount} onChange={setVegetarianCount} /></FF>
              <FF label="Diabetic"><FInput type="number" placeholder="0" value={diabeticCount} onChange={setDiabeticCount} /></FF>
            </div>
            <FF label="Special Instructions (optional)">
              <textarea rows={2} placeholder="e.g. no peanuts, low-sodium options required…" value={specialInstructions} onChange={(e) => setSpecialInstructions(e.target.value)} className="w-full px-3 py-2 text-xs rounded-xl focus:outline-none resize-none" style={IS} />
            </FF>
          </FormCard>

          <div className="rounded-xl px-4 py-3 flex items-center justify-between" style={{ backgroundColor: `${C_CATERING}10`, border: `1px solid ${C_CATERING}25` }}>
            <div className="text-xs" style={{ color: ERP.muted }}>
              {total !== null ? `SAR ${selected.price} × ${pax} pax × ${days} day${days === 1 ? "" : "s"}` : "Total calculated on submission from group travel dates"}
            </div>
            {total !== null && (
              <div className="text-sm font-bold" style={{ color: C_CATERING, fontFamily: "var(--font-mono)" }}>SAR {total.toLocaleString()}</div>
            )}
          </div>

          <SubmitBtn color={C_CATERING} label="Submit Catering Request" onClick={submit} disabled={submitting || !groupId} />
        </div>

        <div className="col-span-2 space-y-4">
          <TrackerSlot loading={loading} latest={latest} states={SUPPLIER_STATES} labels={SUPPLIER_LABELS} color={C_CATERING} title="Catering Status" />
          <div className="rounded-xl p-4" style={{ backgroundColor: ERP.surface, border: `1px solid ${ERP.border}` }}>
            <div className="text-[10px] font-bold text-[color:var(--erp-text-strong)] mb-3">Plan Summary</div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {selected.meals.filter((m) => m !== "★").map((m, i) => {
                const labels: Record<string, string> = { B: "Breakfast", L: "Lunch", D: "Dinner" };
                const colors = [ERP.warning, C_VISA, GOLD];
                return (
                  <div key={m} className="rounded-xl p-2.5 text-center" style={{ backgroundColor: `${colors[i]}10`, border: `1px solid ${colors[i]}25` }}>
                    <div className="text-xs font-bold mb-0.5" style={{ color: colors[i] }}>{m}</div>
                    <div className="text-[9px]" style={{ color: ERP.muted }}>{labels[m]}</div>
                    {pax !== null && <div className="text-[10px] font-semibold mt-1 text-[color:var(--erp-text-strong)]">{pax} pax</div>}
                  </div>
                );
              })}
            </div>
            <div className="text-[9px] text-center" style={{ color: ERP.muted }}>
              {selected.label} · SAR {selected.price} / pax / day{days !== null && pax !== null ? ` · ${days * pax} meal-days` : ""}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 6. Additional Services Screen ───────────────────────────────────────────

const SERVICE_TYPE_LABEL: Record<string, string> = {
  WHEELCHAIR: "Wheelchair Assistance",
  VIP_LOUNGE: "VIP Lounge Access",
  SIM_CARD: "SIM Card Package",
  INSURANCE: "Travel Insurance",
  PHOTOGRAPHY: "Photography / Media",
  INTERPRETER: "Interpreter / Guide",
  CURRENCY_EXCHANGE: "Currency Exchange",
  OTHER: "Other Service",
};

function AdditionalScreen() {
  const { loading, error, liveGroups, groupId, setGroupId, rows, latest, refresh } = useServiceWiring("additional");
  const [serviceType, setServiceType] = useState("WHEELCHAIR");
  const [beneficiaries, setBeneficiaries] = useState("");
  const [priority, setPriority] = useState("NORMAL");
  const [description, setDescription] = useState("");
  const [requestedFor, setRequestedFor] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!groupId) { toast.error("No group available — create a group first"); return; }
    setSubmitting(true);
    try {
      const created = await api.post<{ code: string }>("/services/additional", {
        groupId,
        serviceType,
        beneficiaries: Math.max(1, parseInt(beneficiaries, 10) || 1),
        priority,
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(requestedFor ? { requestedFor: new Date(requestedFor).toISOString() } : {}),
      });
      toast.success(`Service request ${created.code} submitted`);
      refresh();
    } catch (e) {
      toast.error(errMsg(e, "Could not submit service request"));
    } finally {
      setSubmitting(false);
    }
  };

  const historyState = listState({ loading, error, count: rows.length, onRetry: refresh, title: "No additional services yet", hint: "Requests you submit will be listed here." });
  const history = rows.slice(0, 5).map((r) => ({
    ref: r.code,
    type: SERVICE_TYPE_LABEL[r.serviceType ?? ""] ?? titleCase(r.serviceType),
    pax: r.beneficiaries ?? 0,
    status: titleCase(r.status),
    date: fmtDate(r.createdAt),
  }));

  return (
    <div className="p-7">
      <SvcHeader color={C_EXTRA} icon={LayoutGrid} title="Additional Services" subtitle="Request miscellaneous services not covered by standard modules" />
      <div className="grid grid-cols-5 gap-6">
        <div className="col-span-3 space-y-4">
          <FormCard title="Service Request">
            <div className="grid grid-cols-2 gap-3">
              <FF label="Group"><GroupSelect liveGroups={liveGroups} groupId={groupId} onChange={setGroupId} /></FF>
              <FF label="Service Type">
                <FSelect value={serviceType} onChange={setServiceType}>
                  <option value="WHEELCHAIR">Wheelchair / Mobility Assistance</option>
                  <option value="VIP_LOUNGE">VIP Lounge Access</option>
                  <option value="SIM_CARD">SIM Card Package</option>
                  <option value="INSURANCE">Travel Insurance</option>
                  <option value="PHOTOGRAPHY">Photography / Media</option>
                  <option value="INTERPRETER">Interpreter / Guide</option>
                  <option value="CURRENCY_EXCHANGE">Currency Exchange</option>
                  <option value="OTHER">Other (describe below)</option>
                </FSelect>
              </FF>
              <FF label="Number of Beneficiaries"><FInput type="number" placeholder="1" value={beneficiaries} onChange={setBeneficiaries} /></FF>
              <FF label="Priority">
                <FSelect value={priority} onChange={setPriority}>
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </FSelect>
              </FF>
              <div className="col-span-2">
                <FF label="Description / Requirements">
                  <textarea rows={3} placeholder="Describe the service needed in detail…" value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-3 py-2.5 text-xs rounded-xl focus:outline-none resize-none" style={IS} />
                </FF>
              </div>
              <div className="col-span-2">
                <FF label="Requested Date / Time Window (optional)"><FInput type="datetime-local" value={requestedFor} onChange={setRequestedFor} /></FF>
              </div>
            </div>
          </FormCard>

          <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${ERP.border}` }}>
            <div className="px-5 py-3 flex items-center justify-between" style={{ backgroundColor: ERP.surfaceSoft, borderBottom: `1px solid ${ERP.border}` }}>
              <span className="text-[10px] font-bold text-[color:var(--erp-text-strong)]">Service History</span>
            </div>
            {historyState ? <div className="px-5">{historyState}</div> : history.map((r, i, arr) => {
              const sc = r.status === "Completed" ? ERP.success : r.status === "Confirmed" || r.status === "Voucher Issued" ? ERP.info : r.status === "Rejected" || r.status === "Cancelled" ? ERP.destructive : ERP.warning;
              return (
                <div key={r.ref} className="flex items-center gap-3 px-5 py-3" style={{ borderBottom: i < arr.length - 1 ? `1px solid ${ERP.border}` : undefined }}>
                  <span className="text-[9px] font-mono shrink-0" style={{ color: C_EXTRA, fontFamily: "var(--font-mono)" }}>{r.ref}</span>
                  <span className="text-xs flex-1 min-w-0 truncate text-[color:var(--erp-text-strong)]" title={r.type}>{r.type}</span>
                  {r.pax > 0 && <span className="text-[9px] shrink-0" style={{ color: ERP.muted }}>{r.pax} pax</span>}
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0" style={{ backgroundColor: `${sc}15`, color: sc }}>{r.status}</span>
                  <span className="text-[9px] shrink-0" style={{ color: ERP.muted, fontFamily: "var(--font-mono)" }}>{r.date}</span>
                </div>
              );
            })}
          </div>

          <SubmitBtn color={C_EXTRA} label="Submit Service Request" onClick={submit} disabled={submitting || !groupId} />
        </div>

        <div className="col-span-2 space-y-4">
          <TrackerSlot loading={loading} latest={latest} states={EXTRA_STATES} labels={EXTRA_LABELS} color={C_EXTRA} title="Request Status" />
          {latest && (
            <div className="rounded-xl p-4 space-y-2" style={{ backgroundColor: ERP.surface, border: `1px solid ${ERP.border}` }}>
              <div className="text-[10px] font-bold text-[color:var(--erp-text-strong)] mb-1">Latest Request</div>
              {([
                ["Reference", latest.code],
                ["Service", SERVICE_TYPE_LABEL[latest.serviceType ?? ""] ?? titleCase(latest.serviceType)],
                ["Beneficiaries", String(latest.beneficiaries ?? "—")],
                ["Priority", titleCase(latest.priority)],
                ["Status", titleCase(latest.status)],
              ] as [string, string][]).map(([l, v]) => (
                <div key={l} className="flex justify-between">
                  <span className="text-[10px]" style={{ color: ERP.muted }}>{l}</span>
                  <span className="text-[10px] font-semibold text-[color:var(--erp-text-strong)] min-w-0 truncate ml-3" title={v}>{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Services Module: tab router ─────────────────────────────────────────────

const SVC_TABS: { id: ServiceId; labelEn: string; labelBn: string; color: string; icon: typeof FileCheck }[] = [
  { id: "visa",       labelEn: "Visa",          labelBn: "ভিসা",        color: C_VISA,      icon: FileCheck },
  { id: "flight",     labelEn: "Flights",       labelBn: "ফ্লাইট",      color: C_FLIGHT,    icon: Plane },
  { id: "hotel",      labelEn: "Hotel",         labelBn: "হোটেল",       color: C_HOTEL,     icon: Building },
  { id: "transport",  labelEn: "Transport",     labelBn: "পরিবহন",      color: C_TRANSPORT, icon: Bus },
  { id: "catering",   labelEn: "Catering",      labelBn: "ক্যাটারিং",   color: C_CATERING,  icon: UtensilsCrossed },
  { id: "additional", labelEn: "Add. Services", labelBn: "অন্যান্য",    color: C_EXTRA,     icon: LayoutGrid },
];

export function ServicesModule({ initial = "visa" }: { initial?: ServiceId }) {
  const { lang } = useLang();
  const [svc, setSvc] = useState<ServiceId>(initial);

  useEffect(() => { setSvc(initial); }, [initial]);

  const screens: Record<ServiceId, ReactNode> = {
    visa:       <VisaScreen />,
    flight:     <FlightComingSoon />,
    hotel:      <HotelScreen />,
    transport:  <TransportScreen />,
    catering:   <CateringScreen />,
    additional: <AdditionalScreen />,
  };

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ fontFamily: fontFor(lang) }}>
      <div className="px-4 sm:px-7 pt-4 shrink-0">
        <ErpTabs
          ariaLabel={lang === "bn" ? "সেবা" : "Services"}
          active={svc}
          onChange={(id) => setSvc(id as ServiceId)}
          tabs={SVC_TABS.map((t) => ({
            id: t.id,
            label: lang === "bn" ? t.labelBn : t.labelEn,
            icon: t.icon,
            accent: t.color,
          }))}
        />
      </div>

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
        {screens[svc]}
      </div>
    </div>
  );
}
