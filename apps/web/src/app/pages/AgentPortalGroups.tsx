import { useState, useEffect, useMemo, type ReactNode } from "react";
import {
  Plus, Search, ChevronRight, ChevronLeft, ChevronDown,
  FileCheck, Building, Bus, UtensilsCrossed, FileText,
  AlertCircle, Clock, X, Check, Upload, Eye, Trash2,
  ScanLine, Loader2, Download, ArrowLeft, Calendar, Plane,
  MapPin, Info, CheckCircle, MoreHorizontal, Users, RefreshCw,
  LayoutGrid, Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState, LoadingSkeleton, ErrorState, SampleDataBanner } from "../components/States";
import {
  ErpPageTemplate, ErpButton, ErpSearchBar, ErpFilterPanel, ErpDataTable,
  ErpPagination, ErpDrawer, ErpDrawerFooterActions, ErpForm, ErpFormRow, ErpField,
  ErpInput, ErpSelect, ErpTextarea, ErpStatusChip, ErpDeleteDialog, erpToast,
  type ErpColumn, type ErpStatusKind,
} from "../components/erp";
import { useLang } from "../lib/LangContext";
import { fontFor } from "@tuba/shared";
import { api, ApiError, isLoggedIn } from "../lib/api";
import {
  GATE_LABELS,
  PKG_LABEL as PKG_LABEL_FOUNDATION,
  VISA_TYPE_LABEL,
  VISA_UI_TO_ENUM,
  formatNusuk,
  foundationPayload,
  gateSummary,
  gatesFromApi,
  type GateState,
  type VisaTypeUi,
  validateWhatsappUx,
} from "../lib/group-foundation";
import { OcrIntakeModal } from "./OCRCenter";
import { downloadCsv } from "../lib/exportCsv";

const AGENT = "#0EA5E9";
const GOLD  = "#C9A24B";
const NAVY  = "#0B1E3F";

// ─── Types ────────────────────────────────────────────────────────────────────

type GroupView  = "list" | "wizard" | "detail";
type DetailTab  = "passengers" | "flights" | "hotel" | "transport" | "catering" | "documents" | "timeline";
type OcrState   = "idle" | "scanning" | "done";
type ImportStep = 0 | 1 | 2 | 3;

interface GroupRec {
  id: string; name: string; dest: string; type: string;
  pax: number; status: string;
  depart: string; ret: string;
  visa: number; hotel: number; transport: number; catering: number;
  created: string; pkg: string;
  /** Real backend uuid — present only for live rows (mock rows have none). */
  apiId?: string;
  /** T001-03 foundation (optional on demo rows). */
  nusukGroupNumber?: string | null;
  hajiWhatsapp?: string | null;
  consulate?: string | null;
  umrahCompanyId?: string | null;
  umrahCompanyName?: string | null;
  visaTypeEnum?: string;
  uploadedByLabel?: string | null;
  uploadedByName?: string | null;
  gates?: GateState;
}

interface ApiUmrahCompany {
  id: string; code: string; name: string; nameBn?: string | null;
}

interface Pax {
  id: string; name: string; passport: string; nat: string;
  gender: "M" | "F"; dob: string;
  visa: "approved" | "pending" | "rejected";
  hotel: "confirmed" | "pending";
  transport: "confirmed" | "pending";
  moh: "cleared" | "pending";
  /** Real backend passenger uuid — needed for PATCH/DELETE /passengers/:id. */
  pid?: string;
  /** T001-06 — linked passport OCR document (intake readiness). */
  ocrLinked?: boolean;
}

// ─── Live-data wiring (falls back to the frozen prototype data when logged out) ─

interface ApiGroup {
  id: string; code: string; name: string; nameBn: string | null;
  destination: string; visaType: string; packageType: string | null;
  maxCapacity: number; paxCount: number;
  departDate: string | null; returnDate: string | null;
  notes: string | null; status: string; opsStatus: string;
  createdAt: string;
  nusukGroupNumber?: string | null;
  hajiWhatsapp?: string | null;
  consulate?: string | null;
  umrahCompanyId?: string | null;
  umrahCompany?: { id: string; code: string; name: string; nameBn?: string | null } | null;
  servicesValue?: string | number | null;
  uploadedByLabel?: string | null;
  uploadedByUserId?: string | null;
  uploadedByUser?: { id: string; email: string; name: string } | null;
  gateVisa?: boolean;
  gatePackage?: boolean;
  gatePayment?: boolean;
  gateBill?: boolean;
  tenant?: { code: string; name: string } | null;
  season?: { code: string; hijriYear: number } | null;
  workflowStage?: { id: number; labelEn: string; labelBn: string } | null;
  _count?: { passengers: number } | null;
}

interface ApiPassenger {
  id: string; code: string; name: string; nameBn: string | null;
  passportNo: string; nationality: string; gender: "MALE" | "FEMALE";
  dob: string | null;
  visaStatus: "PENDING" | "APPROVED" | "REJECTED";
  hotelStatus: "PENDING" | "CONFIRMED";
  transportStatus: "PENDING" | "CONFIRMED";
  mohStatus: "PENDING" | "CLEARED";
  ocrDocumentId?: string | null;
}

interface ApiFlightInfo {
  id: string; code: string; direction: "ARRIVAL" | "DEPARTURE";
  airline: string; flightNo: string;
  originAirport: string; destAirport: string;
  scheduledAt: string; terminal: string | null; gate: string | null;
  paxCount: number; status: string;
}

/** GET /groups/:id — the list row plus its passengers and flights. */
interface ApiGroupDetail extends ApiGroup {
  passengers?: ApiPassenger[];
  flightInfos?: ApiFlightInfo[];
}

const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const fmtTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "—";
const errMsg = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

// Backend enums ↔ the frozen UI's display strings. The wizard's <select> values
// ARE those display strings, so the *_ENUM maps double as the request mapping.
const DEST_LABEL: Record<string, string> = { MAKKAH: "Makkah", MADINAH: "Madinah", MAKKAH_MADINAH: "Makkah + Madinah" };
const DEST_ENUM:  Record<string, string> = { "Makkah": "MAKKAH", "Madinah": "MADINAH", "Makkah + Madinah": "MAKKAH_MADINAH" };
const VISA_LABEL: Record<string, string> = VISA_TYPE_LABEL;
const PKG_LABEL:  Record<string, string> = PKG_LABEL_FOUNDATION;
// GroupStatus → the lowercase convention the frozen SBadge and filter tabs use.
const STATUS_DISPLAY: Record<string, string> = {
  PENDING: "pending", IN_PROGRESS: "in_progress", VERIFIED: "verified",
  COMPLETED: "completed", CANCELLED: "cancelled",
};

/** API group → the GroupRec shape the frozen table already renders. */
function toGroupRec(g: ApiGroup): GroupRec {
  return {
    apiId: g.id,
    id: g.code,
    name: g.name,
    dest: DEST_LABEL[g.destination] ?? g.destination,
    type: VISA_LABEL[g.visaType] ?? g.visaType,
    // paxCount is the group's declared pilgrim count — the same field
    // AgentPortalServices renders as "(n pax)". `_count.passengers` counts
    // uploaded passenger records, which is a different (usually smaller) number.
    pax: g.paxCount,
    status: STATUS_DISPLAY[g.status] ?? g.status.toLowerCase(),
    depart: fmtDate(g.departDate),
    ret: fmtDate(g.returnDate),
    // TODO: GET /groups exposes no per-service completion counts (visa/hotel/
    // transport/catering done-per-pax), so the pipeline reads 0 for live rows.
    // The detail view derives real visa/hotel/transport counts from
    // GET /groups/:id → passengers[]; catering has no passenger-level field.
    visa: 0, hotel: 0, transport: 0, catering: 0,
    created: fmtDate(g.createdAt),
    // TODO: packageType is nullable on the API; "—" rather than a guessed tier.
    pkg: PKG_LABEL[g.packageType ?? ""] ?? "—",
    nusukGroupNumber: g.nusukGroupNumber ?? null,
    hajiWhatsapp: g.hajiWhatsapp ?? null,
    consulate: g.consulate ?? null,
    umrahCompanyId: g.umrahCompanyId ?? null,
    umrahCompanyName: g.umrahCompany?.name ?? null,
    visaTypeEnum: g.visaType,
    uploadedByLabel: g.uploadedByLabel ?? null,
    uploadedByName: g.uploadedByUser?.name ?? null,
    gates: gatesFromApi(g),
  };
}

/** API passenger → the Pax shape the frozen passengers table renders (1:1). */
function toPax(p: ApiPassenger): Pax {
  return {
    pid: p.id,
    id: p.code,
    name: p.name,
    passport: p.passportNo,
    nat: p.nationality,
    gender: p.gender === "FEMALE" ? "F" : "M",
    dob: p.dob ? p.dob.slice(0, 10) : "—",
    visa: p.visaStatus.toLowerCase() as Pax["visa"],
    hotel: p.hotelStatus.toLowerCase() as Pax["hotel"],
    transport: p.transportStatus.toLowerCase() as Pax["transport"],
    moh: p.mohStatus.toLowerCase() as Pax["moh"],
    ocrLinked: !!p.ocrDocumentId,
  };
}

/**
 * The agent's own groups. Signed out → `groups` is null, so every caller keeps
 * the frozen prototype demo untouched. Signed in → only ever real rows: a failed
 * fetch resolves to an error state, never to GROUPS (Phase 19 rule).
 */
function useGroups() {
  const authed = isLoggedIn();
  const [rows, setRows] = useState<GroupRec[] | null>(null);
  const [loading, setLoading] = useState(authed);
  const [error, setError] = useState(false);

  const refresh = () => {
    if (!isLoggedIn()) return;
    setLoading(true);
    setError(false);
    api
      .get<ApiGroup[]>("/groups")
      .then((gs) => { setRows(gs.map(toGroupRec)); setError(false); })
      .catch(() => { setRows(null); setError(true); }) // never fall back to demo groups
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    const t = setTimeout(refresh, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { authed, loading, error, groups: authed ? (rows ?? []) : null, refresh };
}

// ─── (prototype demo data removed — the agent portal is auth-guarded and live) ─

// ─── Helper components ────────────────────────────────────────────────────────

function SBadge({ status }: { status: string }) {
  const M: Record<string, { bg: string; c: string; label: string }> = {
    verified:    { bg: "#16A34A15", c: "#16A34A", label: "Verified" },
    pending:     { bg: "#D9770618", c: "#B45309", label: "Pending" },
    review:      { bg: "#2563EB15", c: "#2563EB", label: "Under Review" },
    rejected:    { bg: "#DC262615", c: "#DC2626", label: "Rejected" },
    in_progress: { bg: "#2563EB15", c: "#2563EB", label: "In Progress" },
    completed:   { bg: "#0D988815", c: "#2DD4BF", label: "Completed" },
    // GroupStatus.CANCELLED had no Figma badge. Reuses the existing `rejected`
    // tokens verbatim rather than letting a cancelled group fall through to the
    // "Pending" default and misreport its real status.
    cancelled:   { bg: "#DC262615", c: "#DC2626", label: "Cancelled" },
  };
  const s = M[status] ?? M.pending;
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ backgroundColor: s.bg, color: s.c }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.c }} />
      {s.label}
    </span>
  );
}

function Pipeline({ pax, v, h, t, c }: { pax: number; v: number; h: number; t: number; c: number }) {
  const stages = [
    { k: "V", done: v, color: "#0D9488", label: "Visa" },
    { k: "H", done: h, color: "#2563EB", label: "Hotel" },
    { k: "T", done: t, color: "#EA580C", label: "Transport" },
    { k: "C", done: c, color: "#9333EA", label: "Catering" },
  ];
  return (
    <div className="flex items-center gap-2.5">
      {stages.map((s) => {
        const pct = pax > 0 ? Math.round((s.done / pax) * 100) : 0;
        return (
          <div key={s.k} title={`${s.label}: ${s.done}/${pax}`} className="flex flex-col items-center gap-0.5">
            <span className="text-[8px] font-bold" style={{ color: pct === 100 ? s.color : "rgba(11,30,63,0.50)" }}>{s.k}</span>
            <div className="w-9 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "#F5F7FA" }}>
              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: pct === 100 ? s.color : pct === 0 ? "transparent" : `${s.color}99` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function THead({ cols }: { cols: string[] }) {
  return (
    <thead>
      <tr style={{ backgroundColor: "#FBFCFD", borderBottom: "1px solid rgba(11,30,63,0.11)" }}>
        {cols.map((c) => (
          <th key={c} className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-widest whitespace-nowrap" style={{ color: "rgba(11,30,63,0.50)" }}>{c}</th>
        ))}
      </tr>
    </thead>
  );
}

// ─── Shared coming-soon panel (for out-of-Module-2 detail tabs) ───────────────

function ComingSoonPanel({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="p-7">
      <EmptyState tone="light" title={title} hint={hint} icon={<Clock size={30} style={{ color: "rgba(11,30,63,0.35)" }} />} />
    </div>
  );
}

// ─── Manual passenger entry (real POST /groups/:id/passengers) ────────────────

const NATIONALITIES = ["Saudi Arabia","Egypt","Pakistan","Indonesia","Morocco","Turkey","Nigeria","India","Bangladesh","Malaysia","Jordan","Yemen","Sudan","Algeria","Tunisia","United Kingdom","United States"];
const PX_CLS = "w-full px-3 py-2.5 text-xs rounded-xl focus:outline-none";
const PX_STYLE = { backgroundColor: "#F5F7FA", border: `1px solid ${AGENT}30`, color: "#0B1E3F" } as const;

function PxField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="text-[9px] font-bold uppercase tracking-widest block mb-1.5" style={{ color: "rgba(11,30,63,0.50)" }}>{label}</label>
      {children}
    </div>
  );
}

function ManualPassengerDrawer({ groupId, open, onClose, onAdded }: {
  groupId: string; open: boolean; onClose: () => void; onAdded: () => void;
}) {
  const { lang } = useLang();
  const [f, setF] = useState({ name: "", passportNo: "", nationality: "", gender: "MALE", dob: "", passportExpiry: "", phone: "" });
  const set = (k: keyof typeof f, v: string) => setF((st) => ({ ...st, [k]: v }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (f.name.trim().length < 2) {
      setErr(lang === "bn" ? "পূর্ণ নাম আবশ্যক (কমপক্ষে ২ অক্ষর)।" : "Full name is required (min 2 characters).");
      return;
    }
    if (f.passportNo.trim().length < 3) {
      setErr(lang === "bn" ? "পাসপোর্ট নম্বর আবশ্যক।" : "Passport number is required.");
      return;
    }
    if (f.nationality.trim().length < 2) {
      setErr(lang === "bn" ? "জাতীয়তা আবশ্যক।" : "Nationality is required.");
      return;
    }
    setBusy(true); setErr(null);
    try {
      await api.post(`/groups/${groupId}/passengers`, {
        name: f.name.trim(),
        passportNo: f.passportNo.trim(),
        nationality: f.nationality.trim(),
        gender: f.gender,
        ...(f.dob ? { dob: new Date(f.dob).toISOString() } : {}),
        ...(f.passportExpiry ? { passportExpiry: new Date(f.passportExpiry).toISOString() } : {}),
        ...(f.phone.trim() ? { phone: f.phone.trim() } : {}),
      });
      erpToast.success(lang === "bn" ? "যাত্রী যোগ হয়েছে" : "Passenger added", lang);
      onAdded();
      onClose();
    } catch (e) {
      setErr(errMsg(e, lang === "bn" ? "যাত্রী যোগ করা যায়নি" : "Could not add passenger"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ErpDrawer
      open={open}
      onClose={onClose}
      title={lang === "bn" ? "যাত্রী যোগ করুন" : "Add Passenger"}
      lang={lang}
      footer={
        <ErpDrawerFooterActions
          lang={lang}
          onCancel={onClose}
          onSave={submit}
          saving={busy}
          saveLabel={lang === "bn" ? "যোগ করুন" : "Add"}
        />
      }
    >
      <ErpForm columns={2}>
        <ErpFormRow span={2}>
          <ErpField label={lang === "bn" ? "পূর্ণ নাম (পাসপোর্ট অনুযায়ী)" : "Full Name (as per passport)"} required error={err && f.name.trim().length < 2 ? err : undefined}>
            <ErpInput value={f.name} onChange={(e) => set("name", e.target.value)} error={!!err && f.name.trim().length < 2} />
          </ErpField>
        </ErpFormRow>
        <ErpField label={lang === "bn" ? "পাসপোর্ট নম্বর" : "Passport Number"} required>
          <ErpInput value={f.passportNo} onChange={(e) => set("passportNo", e.target.value)} style={{ fontFamily: "var(--font-mono)" }} />
        </ErpField>
        <ErpField label={lang === "bn" ? "জাতীয়তা" : "Nationality"} required>
          <ErpInput list="pax-nat-list" value={f.nationality} onChange={(e) => set("nationality", e.target.value)} />
          <datalist id="pax-nat-list">{NATIONALITIES.map((n) => <option key={n} value={n} />)}</datalist>
        </ErpField>
        <ErpField label={lang === "bn" ? "লিঙ্গ" : "Gender"}>
          <ErpSelect value={f.gender} onChange={(e) => set("gender", e.target.value)}>
            <option value="MALE">{lang === "bn" ? "পুরুষ" : "Male"}</option>
            <option value="FEMALE">{lang === "bn" ? "মহিলা" : "Female"}</option>
          </ErpSelect>
        </ErpField>
        <ErpField label={lang === "bn" ? "জন্ম তারিখ" : "Date of Birth"}>
          <ErpInput type="date" value={f.dob} onChange={(e) => set("dob", e.target.value)} />
        </ErpField>
        <ErpField label={lang === "bn" ? "পাসপোর্ট মেয়াদ" : "Passport Expiry"}>
          <ErpInput type="date" value={f.passportExpiry} onChange={(e) => set("passportExpiry", e.target.value)} />
        </ErpField>
        <ErpField label={lang === "bn" ? "ফোন" : "Phone"}>
          <ErpInput value={f.phone} onChange={(e) => set("phone", e.target.value)} />
        </ErpField>
      </ErpForm>
      {err && <div className="mt-3 text-xs font-medium" style={{ color: "#DC2626" }} role="alert">{err}</div>}
    </ErpDrawer>
  );
}

/** Edit existing passenger — PATCH /passengers/:id (same fields as create). */
function EditPassengerDrawer({ pax, open, onClose, onSaved }: {
  pax: Pax | null; open: boolean; onClose: () => void; onSaved: () => void;
}) {
  const { lang } = useLang();
  const [f, setF] = useState({ name: "", passportNo: "", nationality: "", gender: "MALE", dob: "", phone: "" });
  const set = (k: keyof typeof f, v: string) => setF((st) => ({ ...st, [k]: v }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!pax || !open) return;
    setF({
      name: pax.name,
      passportNo: pax.passport,
      nationality: pax.nat,
      gender: pax.gender === "F" ? "FEMALE" : "MALE",
      dob: pax.dob && pax.dob !== "—" ? pax.dob : "",
      phone: "",
    });
    setErr(null);
  }, [pax, open]);

  const submit = async () => {
    if (!pax?.pid) {
      setErr(lang === "bn" ? "যাত্রী আইডি নেই" : "Passenger id missing");
      return;
    }
    if (f.name.trim().length < 2) {
      setErr(lang === "bn" ? "পূর্ণ নাম আবশ্যক।" : "Full name is required.");
      return;
    }
    if (f.passportNo.trim().length < 3) {
      setErr(lang === "bn" ? "পাসপোর্ট নম্বর আবশ্যক।" : "Passport number is required.");
      return;
    }
    setBusy(true); setErr(null);
    try {
      await api.patch(`/passengers/${pax.pid}`, {
        name: f.name.trim(),
        passportNo: f.passportNo.trim(),
        nationality: f.nationality.trim() || undefined,
        gender: f.gender,
        ...(f.dob ? { dob: new Date(f.dob).toISOString() } : {}),
        ...(f.phone.trim() ? { phone: f.phone.trim() } : {}),
      });
      erpToast.success(lang === "bn" ? "যাত্রী আপডেট হয়েছে" : "Passenger updated", lang);
      onSaved();
      onClose();
    } catch (e) {
      setErr(errMsg(e, lang === "bn" ? "আপডেট ব্যর্থ" : "Update failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ErpDrawer
      open={open && !!pax}
      onClose={onClose}
      title={lang === "bn" ? "যাত্রী সম্পাদনা" : "Edit Passenger"}
      subtitle={pax?.id}
      lang={lang}
      footer={
        <ErpDrawerFooterActions
          lang={lang}
          onCancel={onClose}
          onSave={submit}
          saving={busy}
          saveLabel={lang === "bn" ? "সংরক্ষণ" : "Save"}
        />
      }
    >
      <ErpForm columns={2}>
        <ErpFormRow span={2}>
          <ErpField label={lang === "bn" ? "পূর্ণ নাম" : "Full Name"} required>
            <ErpInput value={f.name} onChange={(e) => set("name", e.target.value)} />
          </ErpField>
        </ErpFormRow>
        <ErpField label={lang === "bn" ? "পাসপোর্ট নম্বর" : "Passport Number"} required>
          <ErpInput value={f.passportNo} onChange={(e) => set("passportNo", e.target.value)} style={{ fontFamily: "var(--font-mono)" }} />
        </ErpField>
        <ErpField label={lang === "bn" ? "জাতীয়তা" : "Nationality"}>
          <ErpInput list="pax-edit-nat" value={f.nationality} onChange={(e) => set("nationality", e.target.value)} />
          <datalist id="pax-edit-nat">{NATIONALITIES.map((n) => <option key={n} value={n} />)}</datalist>
        </ErpField>
        <ErpField label={lang === "bn" ? "লিঙ্গ" : "Gender"}>
          <ErpSelect value={f.gender} onChange={(e) => set("gender", e.target.value)}>
            <option value="MALE">{lang === "bn" ? "পুরুষ" : "Male"}</option>
            <option value="FEMALE">{lang === "bn" ? "মহিলা" : "Female"}</option>
          </ErpSelect>
        </ErpField>
        <ErpField label={lang === "bn" ? "জন্ম তারিখ" : "Date of Birth"}>
          <ErpInput type="date" value={f.dob} onChange={(e) => set("dob", e.target.value)} />
        </ErpField>
        <ErpField label={lang === "bn" ? "ফোন" : "Phone"}>
          <ErpInput value={f.phone} onChange={(e) => set("phone", e.target.value)} />
        </ErpField>
      </ErpForm>
      {err && <div className="mt-3 text-xs font-medium" style={{ color: "#DC2626" }} role="alert">{err}</div>}
    </ErpDrawer>
  );
}

// ─── T001-05 Enterprise Mutamer Excel / CSV Import (preview → confirm → commit) ─

const BUSINESS_GUIDE_COLS: { h: string; req: boolean; sample: string }[] = [
  { h: "Mutamer Name", req: true, sample: "Mohammed Hassan" },
  { h: "Age", req: false, sample: "42" },
  { h: "Passport", req: true, sample: "A1234567" },
  { h: "Nationality", req: true, sample: "Bangladesh" },
  { h: "Main External Agent Code", req: true, sample: "1004492" },
  { h: "Main External Agent Name", req: false, sample: "Tuba Al Hijaz" },
  { h: "Sub External Agent Code", req: true, sample: "SUB-01" },
  { h: "Sub External Agent Name", req: false, sample: "Bengal United" },
  { h: "Visa Status", req: true, sample: "Visa Not Issued" },
  { h: "Biometric Status", req: false, sample: "Registered" },
  { h: "Visa Number", req: false, sample: "" },
  { h: "MOFA Number", req: false, sample: "" },
  { h: "Mutamer Type", req: false, sample: "B2B" },
  { h: "Gender", req: false, sample: "M" },
];

const LEGACY_GUIDE_COLS: { h: string; req: boolean; sample: string }[] = [
  { h: "Name", req: true, sample: "Mohammed Hassan" },
  { h: "Passport No", req: true, sample: "A1234567" },
  { h: "Nationality", req: true, sample: "Bangladesh" },
  { h: "Gender", req: true, sample: "M" },
  { h: "Date of Birth", req: false, sample: "1985-03-15" },
  { h: "Passport Expiry", req: false, sample: "2030-06-30" },
  { h: "Phone", req: false, sample: "+8801712345678" },
];

interface ImportPreview {
  fileName: string;
  fileHash: string;
  format: string;
  mode: "business" | "legacy";
  mapping: Array<{ header: string; field: string | null }>;
  summary: {
    totalRows: number;
    valid: number;
    invalid: number;
    warnings: number;
    duplicates: number;
    canCommit: boolean;
  };
  issues: Array<{ level: string; message: string; row?: number }>;
  passengers: Record<string, unknown>[];
  rejectedSample: Array<{ row: number; reason: string }>;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const r = String(reader.result ?? "");
      const i = r.indexOf(",");
      resolve(i >= 0 ? r.slice(i + 1) : r);
    };
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

function CsvImportModal({ groupId, onClose, onImported }: { groupId: string; onClose: () => void; onImported: (n: number) => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [previewing, setPreviewing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [templateKind, setTemplateKind] = useState<"business" | "legacy">("business");

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setErr(null);
    setPreviewing(true);
    try {
      const contentBase64 = await fileToBase64(file);
      const res = await api.post<ImportPreview>(`/groups/${groupId}/passengers/import/preview`, {
        fileName: file.name,
        contentBase64,
        format: "auto",
      });
      setPreview(res);
      setStep(2);
    } catch (e) {
      setErr(errMsg(e, "Preview failed — check file format and columns"));
    } finally {
      setPreviewing(false);
    }
  };

  const commit = async () => {
    if (!preview?.summary.canCommit || !preview.passengers.length) {
      setErr("Cannot import — fix errors/duplicates first. Nothing will be written until the preview is clean.");
      return;
    }
    setCommitting(true);
    setErr(null);
    try {
      const res = await api.post<{ imported: number }>(`/groups/${groupId}/passengers/import/commit`, {
        fileName: preview.fileName,
        fileHash: preview.fileHash,
        confirm: true,
        passengers: preview.passengers,
      });
      toast.success(`${res.imported} Mutamer(s) imported`);
      setStep(3);
      onImported(res.imported);
    } catch (e) {
      setErr(errMsg(e, "Import rolled back — no passengers were written"));
    } finally {
      setCommitting(false);
    }
  };

  const downloadTemplate = () => {
    const cols = templateKind === "business" ? BUSINESS_GUIDE_COLS : LEGACY_GUIDE_COLS;
    const csv = cols.map((c) => c.h).join(",") + "\n" + cols.map((c) => c.sample).join(",") + "\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = templateKind === "business" ? "tuba-mutamer-business-template.csv" : "tuba-passengers-legacy-template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const guide = templateKind === "business" ? BUSINESS_GUIDE_COLS : LEGACY_GUIDE_COLS;
  const s = preview?.summary;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(6,15,32,0.85)" }} onClick={onClose}>
      <div className="w-[680px] max-h-[92vh] overflow-y-auto rounded-2xl shadow-2xl" style={{ backgroundColor: "#F0F3F7", border: "1px solid rgba(11,30,63,0.15)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 sticky top-0 z-10" style={{ backgroundColor: "#F0F3F7", borderBottom: "1px solid rgba(11,30,63,0.11)" }}>
          <div>
            <div className="text-sm font-bold text-[#0B1E3F]">Mutamer Excel Import</div>
            <div className="flex items-center gap-3 mt-1">
              {(["Upload", "Preview", "Done"] as const).map((label, i) => (
                <div key={label} className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold" style={{ backgroundColor: step > i + 1 ? "#4ADE8020" : step === i + 1 ? AGENT : "#EEF1F6", color: step > i + 1 ? "#16A34A" : step === i + 1 ? "white" : "rgba(11,30,63,0.50)" }}>
                    {step > i + 1 ? "✓" : i + 1}
                  </div>
                  <span className="text-[9px]" style={{ color: step === i + 1 ? "#0B1E3F" : "rgba(11,30,63,0.50)" }}>{label}</span>
                  {i < 2 && <ChevronRight size={9} style={{ color: "rgba(11,30,63,0.38)" }} />}
                </div>
              ))}
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/8" style={{ color: "rgba(11,30,63,0.58)" }}>
            <X size={14} />
          </button>
        </div>

        <div className="p-5">
          {step === 1 && (
            <div>
              <label className="flex flex-col items-center gap-3 p-8 rounded-2xl cursor-pointer transition-all" style={{ border: `2px dashed ${AGENT}35`, backgroundColor: `${AGENT}05`, opacity: previewing ? 0.6 : 1 }}>
                <input type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" disabled={previewing} onChange={(e) => onFile(e.target.files?.[0])} />
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${AGENT}18` }}>
                  {previewing ? <Loader2 size={20} className="animate-spin" style={{ color: AGENT }} /> : <Upload size={20} style={{ color: AGENT }} />}
                </div>
                <div className="text-center">
                  <div className="text-sm font-semibold text-[#0B1E3F] mb-1">{previewing ? "Validating workbook…" : "Upload Mutamer Excel / CSV"}</div>
                  <div className="text-xs" style={{ color: "rgba(11,30,63,0.58)" }}>.xlsx or .csv · up to 1000 rows · preview before import</div>
                </div>
              </label>

              <div className="mt-4 flex gap-2">
                {(["business", "legacy"] as const).map((k) => (
                  <button key={k} type="button" onClick={() => setTemplateKind(k)} className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase"
                    style={{ backgroundColor: templateKind === k ? `${AGENT}18` : "#EEF1F6", color: templateKind === k ? AGENT : "rgba(11,30,63,0.55)" }}>
                    {k === "business" ? "Business template" : "Legacy template"}
                  </button>
                ))}
              </div>

              <div className="mt-3 rounded-xl overflow-hidden" style={{ border: "1px solid rgba(11,30,63,0.11)" }}>
                <div className="px-4 py-2.5 flex items-center justify-between gap-3" style={{ backgroundColor: "#FBFCFD", borderBottom: "1px solid rgba(11,30,63,0.11)" }}>
                  <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(11,30,63,0.58)" }}>
                    {templateKind === "business" ? "Business Mutamer columns" : "Legacy columns"}
                  </span>
                  <button type="button" onClick={downloadTemplate} className="flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-lg shrink-0" style={{ backgroundColor: `${AGENT}15`, color: AGENT }}>
                    <Download size={11} /> Download CSV template
                  </button>
                </div>
                <div className="p-3 overflow-x-auto">
                  <table className="w-full" style={{ fontFamily: "var(--font-mono)" }}>
                    <thead>
                      <tr>
                        {guide.map((c) => (
                          <th key={c.h} className="px-2 py-1 text-left text-[10px] whitespace-nowrap" style={{ color: AGENT, borderBottom: "1px solid rgba(11,30,63,0.11)" }}>
                            {c.h}{c.req && <span style={{ color: "#DC2626" }}> *</span>}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        {guide.map((c) => (
                          <td key={c.h} className="px-2 py-1.5 text-[10px] whitespace-nowrap" style={{ color: "rgba(11,30,63,0.70)" }}>{c.sample || "—"}</td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <p className="text-[10px] mt-3 flex items-start gap-1.5" style={{ color: "rgba(11,30,63,0.55)" }}>
                <Info size={11} style={{ color: AGENT }} className="mt-px shrink-0" />
                <span>Nothing is written until you confirm the preview. Duplicates and invalid rows block import (no silent overwrite).</span>
              </p>
              {err && (
                <div className="mt-3 px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", color: "#DC2626" }}>{err}</div>
              )}
            </div>
          )}

          {step === 2 && preview && (
            <div>
              <div className="flex items-center justify-between mb-3 gap-2">
                <span className="text-xs text-[#0B1E3F] font-semibold truncate" title={preview.fileName}>
                  {preview.fileName} · {preview.mode} · {preview.format}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full shrink-0" style={{ backgroundColor: preview.summary.canCommit ? "#4ADE8015" : "#DC262615", color: preview.summary.canCommit ? "#16A34A" : "#DC2626" }}>
                  {preview.summary.canCommit ? "Ready to import" : "Blocked"}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                {[
                  { label: "Valid", value: String(s?.valid ?? 0), color: "#16A34A" },
                  { label: "Invalid", value: String(s?.invalid ?? 0), color: "#DC2626" },
                  { label: "Warnings", value: String(s?.warnings ?? 0), color: "#B45309" },
                  { label: "Duplicates", value: String(s?.duplicates ?? 0), color: "#7C3AED" },
                ].map((st) => (
                  <div key={st.label} className="rounded-xl p-3 text-center" style={{ backgroundColor: `${st.color}10`, border: `1px solid ${st.color}25` }}>
                    <div className="text-lg font-bold mb-0.5" style={{ color: st.color, fontFamily: "var(--font-mono)" }}>{st.value}</div>
                    <div className="text-[10px]" style={{ color: "rgba(11,30,63,0.58)" }}>{st.label}</div>
                  </div>
                ))}
              </div>

              <div className="rounded-xl overflow-hidden mb-3" style={{ border: "1px solid rgba(11,30,63,0.11)" }}>
                <div className="px-4 py-2.5" style={{ backgroundColor: "#FBFCFD", borderBottom: "1px solid rgba(11,30,63,0.11)" }}>
                  <span className="text-[10px] font-bold text-[#0B1E3F]">Column mapping (auto)</span>
                </div>
                <div className="max-h-[120px] overflow-y-auto px-3 py-2 text-[10px]" style={{ fontFamily: "var(--font-mono)", color: "rgba(11,30,63,0.66)" }}>
                  {preview.mapping.map((m, i) => (
                    <div key={i}>{m.header || "(blank)"} → {m.field ?? "ignored"}</div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl overflow-hidden mb-4" style={{ border: "1px solid rgba(11,30,63,0.11)" }}>
                <div className="px-4 py-2.5" style={{ backgroundColor: "#FBFCFD", borderBottom: "1px solid rgba(11,30,63,0.11)" }}>
                  <span className="text-[10px] font-bold text-[#0B1E3F]">Validation / duplicates</span>
                </div>
                <div className="max-h-[200px] overflow-y-auto">
                  {preview.issues.length === 0 ? (
                    <div className="px-4 py-3 flex items-center gap-2.5">
                      <CheckCircle size={13} style={{ color: "#16A34A" }} />
                      <span className="text-xs" style={{ color: "rgba(11,30,63,0.66)" }}>All rows valid — confirm to import.</span>
                    </div>
                  ) : preview.issues.slice(0, 80).map((iss, k) => (
                    <div key={k} className="px-4 py-2 flex items-start gap-2.5" style={{ borderBottom: "1px solid rgba(11,30,63,0.06)" }}>
                      <AlertCircle size={13} style={{ color: iss.level === "error" ? "#DC2626" : iss.level === "duplicate" ? "#7C3AED" : "#B45309" }} className="mt-0.5 shrink-0" />
                      <div className="text-[11px]" style={{ color: iss.level === "error" ? "#DC2626" : iss.level === "duplicate" ? "#7C3AED" : "#B45309" }}>{iss.message}</div>
                    </div>
                  ))}
                </div>
              </div>

              {err && (
                <div className="mb-3 px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", color: "#DC2626" }}>{err}</div>
              )}
              <div className="flex gap-2.5">
                <button onClick={() => { setStep(1); setPreview(null); setErr(null); }} className="px-4 py-2 rounded-xl text-xs" style={{ border: "1px solid rgba(11,30,63,0.15)", color: "rgba(11,30,63,0.58)" }}>Back</button>
                <button onClick={commit} disabled={committing || !preview.summary.canCommit} className="flex-1 py-2 rounded-xl text-xs font-bold disabled:opacity-50" style={{ backgroundColor: AGENT, color: "#0B1E3F" }}>
                  {committing ? "Importing…" : `Confirm import ${preview.summary.valid} Mutamer${preview.summary.valid === 1 ? "" : "s"}`}
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="text-center py-6">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: "#4ADE8018" }}>
                <CheckCircle size={28} style={{ color: "#16A34A" }} />
              </div>
              <h3 className="text-sm font-bold text-[#0B1E3F] mb-1">Import complete</h3>
              <p className="text-xs mb-5" style={{ color: "rgba(11,30,63,0.66)" }}>
                {preview?.summary.valid ?? 0} Mutamer(s) written to this group. Audit log recorded.
              </p>
              <button onClick={onClose} className="px-6 py-2.5 rounded-xl text-xs font-bold" style={{ backgroundColor: AGENT, color: "#0B1E3F" }}>Close</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Screen A: Groups List ────────────────────────────────────────────────────

function groupStatusKind(status: string): ErpStatusKind {
  if (status === "completed" || status === "verified") return "completed";
  if (status === "rejected" || status === "cancelled") return "rejected";
  if (status === "in_progress") return "info";
  if (status === "pending") return "pending";
  return "warning";
}

function GroupsListView({ onSelect, onNew, authed, groups, loading, error, refresh }: {
  onSelect: (g: GroupRec) => void; onNew: () => void;
  authed: boolean; groups: GroupRec[] | null; loading: boolean; error: boolean; refresh: () => void;
}) {
  const { lang } = useLang();
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const PAGE = 20;

  const all = groups ?? [];
  const shown = all.filter((g) => {
    const matchF = filter === "all" || g.status === filter;
    const qq = q.trim().toLowerCase();
    const matchQ = !qq
      || g.id.toLowerCase().includes(qq)
      || g.name.toLowerCase().includes(qq)
      || (g.nusukGroupNumber ?? "").toLowerCase().includes(qq);
    return matchF && matchQ;
  });
  const totalPages = Math.max(1, Math.ceil(shown.length / PAGE));
  const safePage = Math.min(page, totalPages);
  const pageRows = shown.slice((safePage - 1) * PAGE, safePage * PAGE);

  const columns: ErpColumn<GroupRec>[] = [
    {
      id: "code",
      header: lang === "bn" ? "গ্রুপ" : "Group",
      cell: (g) => (
        <div>
          <div className="text-[11px] font-semibold" style={{ color: AGENT, fontFamily: "var(--font-mono)" }}>{g.id}</div>
          <div className="text-[10px]" style={{ color: "rgba(11,30,63,0.50)", fontFamily: "var(--font-mono)" }}>
            Nusuk {formatNusuk(g.nusukGroupNumber)}
          </div>
        </div>
      ),
    },
    {
      id: "name",
      header: lang === "bn" ? "নাম" : "Name",
      cell: (g) => (
        <div>
          <div className="text-xs font-semibold text-[#0B1E3F] max-w-[200px] truncate" title={g.name}>{g.name}</div>
          <div className="text-[10px]" style={{ color: "rgba(11,30,63,0.50)" }}>
            {g.type} · {g.pkg}{g.gates ? ` · ${gateSummary(g.gates)}` : ""}
          </div>
        </div>
      ),
    },
    {
      id: "dest",
      header: lang === "bn" ? "গন্তব্য" : "Destination",
      cell: (g) => (
        <span className="inline-flex items-center gap-1 text-xs" style={{ color: "rgba(11,30,63,0.76)" }}>
          <MapPin size={11} /> {g.dest}
        </span>
      ),
    },
    {
      id: "pax",
      header: lang === "bn" ? "যাত্রী" : "Pax",
      align: "center",
      cell: (g) => <span className="text-sm font-bold tabular-nums" style={{ fontFamily: "var(--font-mono)" }}>{g.pax}</span>,
    },
    {
      id: "dates",
      header: lang === "bn" ? "তারিখ" : "Dates",
      cell: (g) => (
        <div className="text-[11px]" style={{ color: "rgba(11,30,63,0.66)" }}>
          <div>{g.depart}</div>
          <div style={{ color: "rgba(11,30,63,0.45)" }}>→ {g.ret}</div>
        </div>
      ),
    },
    {
      id: "status",
      header: lang === "bn" ? "স্ট্যাটাস" : "Status",
      cell: (g) => <ErpStatusChip status={groupStatusKind(g.status)} lang={lang} />,
    },
  ];

  if (error && authed) {
    return (
      <div className="p-7" style={{ fontFamily: fontFor(lang) }}>
        <ErrorState tone="light" lang={lang} onRetry={refresh} />
      </div>
    );
  }

  return (
    <div style={{ fontFamily: fontFor(lang) }}>
      <ErpPageTemplate
        title={lang === "bn" ? "গ্রুপ" : "Groups"}
        subtitle={lang === "bn" ? "গ্রুপ তৈরি, খোঁজ ও ব্যবস্থাপনা" : "Create, search, and manage groups"}
        primaryAction={
          <div className="flex flex-wrap items-center gap-2">
            <ErpButton
              variant="outline"
              icon={<Download size={14} />}
              disabled={!shown.length}
              onClick={() => {
                downloadCsv(
                  `groups-${new Date().toISOString().slice(0, 10)}.csv`,
                  ["Code", "Name", "Destination", "Pax", "Depart", "Return", "Status", "Package", "Nusuk"],
                  shown.map((g) => [g.id, g.name, g.dest, g.pax, g.depart, g.ret, g.status, g.pkg, g.nusukGroupNumber ?? ""]),
                );
                erpToast.success(lang === "bn" ? "CSV ডাউনলোড হয়েছে" : "CSV downloaded", lang);
              }}
            >
              {lang === "bn" ? "এক্সপোর্ট CSV" : "Export CSV"}
            </ErpButton>
            <ErpButton variant="primary" icon={<Plus size={15} />} onClick={onNew}>
              {lang === "bn" ? "নতুন গ্রুপ" : "New Group"}
            </ErpButton>
          </div>
        }
        toolbar={
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <div className="flex-1 min-w-0">
              <ErpSearchBar
                lang={lang}
                value={q}
                onChange={(e) => { setQ(e.target.value); setPage(1); }}
                onClear={() => { setQ(""); setPage(1); }}
                placeholder={lang === "bn"
                  ? "কোড, নাম অথবা নুসুক নম্বর লিখুন"
                  : "Search by code, name, or Nusuk number"}
              />
            </div>
            <ErpFilterPanel
              open={filtersOpen}
              onOpenChange={setFiltersOpen}
              lang={lang}
              activeCount={filter === "all" ? 0 : 1}
            >
              <div className="flex flex-wrap gap-2">
                {([
                  { id: "all", bn: "সব", en: "All" },
                  { id: "in_progress", bn: "চলমান", en: "In progress" },
                  { id: "pending", bn: "অপেক্ষমাণ", en: "Pending" },
                  { id: "verified", bn: "যাচাইকৃত", en: "Verified" },
                  { id: "completed", bn: "সম্পন্ন", en: "Completed" },
                ] as const).map((f) => (
                  <ErpButton
                    key={f.id}
                    size="sm"
                    variant={filter === f.id ? "primary" : "outline"}
                    onClick={() => { setFilter(f.id); setPage(1); }}
                  >
                    {lang === "bn" ? f.bn : f.en}
                  </ErpButton>
                ))}
              </div>
            </ErpFilterPanel>
          </div>
        }
        footer={
          <ErpPagination
            page={safePage}
            pageSize={PAGE}
            total={shown.length}
            onPageChange={setPage}
            lang={lang}
          />
        }
      >
        <ErpDataTable
          columns={columns}
          rows={loading ? [] : pageRows}
          rowKey={(g) => g.apiId ?? g.id}
          loading={loading}
          lang={lang}
          selectable
          selectedKeys={selected}
          onSelectedKeysChange={setSelected}
          onRowClick={onSelect}
          emptyTitle={lang === "bn" ? "কোনো তথ্য পাওয়া যায়নি" : "No groups found"}
          emptyHint={lang === "bn" ? "নতুন গ্রুপ তৈরি করে শুরু করুন।" : "Create a new group to get started."}
          emptyAction={
            <ErpButton variant="primary" icon={<Plus size={14} />} onClick={onNew}>
              {lang === "bn" ? "নতুন তৈরি করুন" : "Create new"}
            </ErpButton>
          }
          rowActions={(g) => (
            <ErpButton
              size="sm"
              variant="ghost"
              icon={<ChevronRight size={14} />}
              onClick={(e) => { e.stopPropagation(); onSelect(g); }}
              aria-label={lang === "bn" ? "দেখুন" : "View"}
            >
              {lang === "bn" ? "দেখুন" : "View"}
            </ErpButton>
          )}
        />
      </ErpPageTemplate>
    </div>
  );
}

// ─── Screen B: Group Creation Wizard ─────────────────────────────────────────

function GroupWizard({ onBack, onDone, onCreated }: {
  onBack: () => void; onDone: (g: GroupRec) => void; onCreated: () => void;
}) {
  const { lang } = useLang();
  const [step, setStep] = useState(1);
  const [visaType, setVisaType] = useState<VisaTypeUi | null>(null);
  const [dest, setDest] = useState("Makkah");
  const [name, setName] = useState("");
  const [pkg, setPkg] = useState("Economy");
  const [nusukGroupNumber, setNusukGroupNumber] = useState("");
  const [hajiWhatsapp, setHajiWhatsapp] = useState("");
  const [consulate, setConsulate] = useState("");
  const [umrahCompanyId, setUmrahCompanyId] = useState("");
  const [umrahCompanies, setUmrahCompanies] = useState<ApiUmrahCompany[]>([]);
  const [departDate, setDepartDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [maxCapacity, setMaxCapacity] = useState("40");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoggedIn()) return;
    api.get<ApiUmrahCompany[]>("/services/umrah-companies")
      .then(setUmrahCompanies)
      .catch(() => setUmrahCompanies([]));
  }, []);

  const protoGroup: GroupRec = {
    id: "GRP-1446-2999", name: name || "New Group", dest,
    type: visaType ? VISA_TYPE_LABEL[VISA_UI_TO_ENUM[visaType]] : "—",
    pax: 0, status: "pending", depart: departDate || "—", ret: returnDate || "—",
    visa: 0, hotel: 0, transport: 0, catering: 0, created: "—", pkg,
    nusukGroupNumber: nusukGroupNumber || null, hajiWhatsapp: hajiWhatsapp || null,
  };
  const STEPS = lang === "bn"
    ? ["গ্রুপ তথ্য", "প্যাকেজ", "যাত্রী", "নিশ্চিত করুন"]
    : ["Group Info", "Package", "Passengers", "Confirm"];

  /** Same POST /groups contract — fired on Confirm (step 4), then open detail for passenger intake. */
  const submit = async () => {
    if (!visaType) return;
    if (!isLoggedIn()) { onDone(protoGroup); return; }
    if (name.trim().length < 2) {
      erpToast.error(lang === "bn" ? "গ্রুপের নাম দিন (কমপক্ষে ২ অক্ষর)" : "Enter a group name (at least 2 characters)", lang);
      return;
    }
    const waErr = validateWhatsappUx(visaType, hajiWhatsapp);
    if (waErr) { erpToast.error(waErr, lang); return; }
    const cap = parseInt(maxCapacity, 10);
    setSubmitting(true);
    setCreateError(null);
    try {
      const g = await api.post<ApiGroup>("/groups", {
        name: name.trim(),
        destination: DEST_ENUM[dest] ?? "MAKKAH",
        ...foundationPayload({
          visaTypeUi: visaType,
          packageTypeDisplay: pkg,
          nusukGroupNumber,
          hajiWhatsapp,
          consulate,
          umrahCompanyId: umrahCompanyId || undefined,
        }),
        ...(Number.isFinite(cap) && cap >= 1 ? { maxCapacity: cap } : {}),
        ...(departDate ? { departDate: new Date(departDate).toISOString() } : {}),
        ...(returnDate ? { returnDate: new Date(returnDate).toISOString() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      const rec = toGroupRec(g);
      erpToast.success(lang === "bn" ? `গ্রুপ ${g.code} তৈরি হয়েছে` : `Group ${g.code} created`, lang);
      onCreated();
      onDone(rec);
    } catch (e) {
      setCreateError(errMsg(e, lang === "bn" ? "গ্রুপ তৈরি করা যায়নি" : "Could not create the group"));
    } finally {
      setSubmitting(false);
    }
  };

  const goNextFrom1 = () => {
    if (isLoggedIn() && name.trim().length < 2) {
      erpToast.error(lang === "bn" ? "গ্রুপের নাম দিন (কমপক্ষে ২ অক্ষর)" : "Enter a group name (at least 2 characters)", lang);
      return;
    }
    setStep(2);
  };

  return (
    <div className="p-6 md:p-7" style={{ fontFamily: fontFor(lang) }}>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <ErpButton variant="ghost" size="sm" icon={<ArrowLeft size={14} />} onClick={onBack}>
          {lang === "bn" ? "গ্রুপ" : "Groups"}
        </ErpButton>
        <ChevronRight size={12} style={{ color: "rgba(11,30,63,0.38)" }} />
        <span className="text-sm font-semibold text-[#0B1E3F]">{lang === "bn" ? "নতুন গ্রুপ" : "New Group"}</span>
        <div className="flex-1" />
        <div className="flex flex-wrap items-center gap-2">
          {STEPS.map((label, i) => {
            const n = i + 1;
            return (
              <div key={label} className="flex items-center gap-1.5">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold"
                  style={{
                    backgroundColor: step > n ? "#16A34A20" : step === n ? NAVY : "#EEF1F6",
                    color: step > n ? "#16A34A" : step === n ? "#fff" : "rgba(11,30,63,0.50)",
                  }}
                >
                  {step > n ? "✓" : n}
                </div>
                <span className="text-xs hidden md:block" style={{ color: step === n ? NAVY : "rgba(11,30,63,0.55)" }}>{label}</span>
                {n < 4 && <ChevronRight size={12} style={{ color: "rgba(11,30,63,0.3)" }} />}
              </div>
            );
          })}
        </div>
      </div>

      <div className="max-w-3xl mx-auto">
        {step === 1 && (
          <div className="rounded-xl p-5 md:p-6 space-y-4" style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(11,30,63,0.11)" }}>
            <h2 className="text-base font-bold text-[#0B1E3F]">{lang === "bn" ? "১ · গ্রুপ তথ্য" : "1 · Group Info"}</h2>
            <ErpForm columns={2}>
              <ErpFormRow span={2}>
                <ErpField label={lang === "bn" ? "গ্রুপের নাম" : "Group Name"} required>
                  <ErpInput value={name} onChange={(e) => setName(e.target.value)} placeholder={lang === "bn" ? "গ্রুপের নাম লিখুন" : "Group name"} />
                </ErpField>
              </ErpFormRow>
              <ErpField label={lang === "bn" ? "নুসুক গ্রুপ নম্বর" : "Nusuk Group Number"}>
                <ErpInput value={nusukGroupNumber} onChange={(e) => setNusukGroupNumber(e.target.value)} style={{ fontFamily: "var(--font-mono)" }} />
              </ErpField>
              <ErpField label={lang === "bn" ? "গন্তব্য" : "Destination"}>
                <ErpSelect value={dest} onChange={(e) => setDest(e.target.value)}>
                  <option value="Makkah">Makkah</option>
                  <option value="Madinah">Madinah</option>
                  <option value="Makkah + Madinah">Makkah + Madinah</option>
                </ErpSelect>
              </ErpField>
              <ErpField label={lang === "bn" ? "কনস্যুলেট" : "Consulate"}>
                <ErpInput value={consulate} onChange={(e) => setConsulate(e.target.value)} />
              </ErpField>
              <ErpField label={lang === "bn" ? "উমরাহ কোম্পানি" : "Umrah Company"}>
                <ErpSelect value={umrahCompanyId} onChange={(e) => setUmrahCompanyId(e.target.value)}>
                  <option value="">—</option>
                  {umrahCompanies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                  ))}
                </ErpSelect>
              </ErpField>
              <ErpField label={lang === "bn" ? "হাজি হোয়াটসঅ্যাপ" : "Haji WhatsApp"}>
                <ErpInput value={hajiWhatsapp} onChange={(e) => setHajiWhatsapp(e.target.value)} placeholder="+966… / +880…" />
              </ErpField>
            </ErpForm>
            <div className="flex justify-end pt-2">
              <ErpButton variant="primary" onClick={goNextFrom1}>
                {lang === "bn" ? "পরবর্তী: প্যাকেজ →" : "Next: Package →"}
              </ErpButton>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="rounded-xl p-5 md:p-6" style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(11,30,63,0.11)" }}>
            <h2 className="text-base font-bold text-[#0B1E3F] mb-1">{lang === "bn" ? "২ · প্যাকেজ" : "2 · Package"}</h2>
            <p className="text-xs mb-4" style={{ color: "rgba(11,30,63,0.55)" }}>
              {lang === "bn" ? "ভিসা, প্যাকেজ, তারিখ ও ধারণক্ষমতা।" : "Visa, package, travel dates, and capacity."}
            </p>
            <div className="mb-2 text-[11px] font-semibold" style={{ color: "rgba(11,30,63,0.55)" }}>
              {lang === "bn" ? "প্যাকেজ টাইপ" : "Package Type"}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5" role="radiogroup" aria-label={lang === "bn" ? "প্যাকেজ" : "Package"}>
              {([
                { id: "Economy", titleBn: "ইকোনমি", titleEn: "Economy", hintBn: "মৌলিক স্তর", hintEn: "Essential tier" },
                { id: "Standard", titleBn: "স্ট্যান্ডার্ড", titleEn: "Standard", hintBn: "সাধারণ স্তর", hintEn: "Standard tier" },
                { id: "Premium", titleBn: "প্রিমিয়াম", titleEn: "Premium", hintBn: "উচ্চতর স্তর", hintEn: "Premium tier" },
              ]).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={pkg === p.id}
                  onClick={() => setPkg(p.id)}
                  className="rounded-xl p-4 text-left min-h-[96px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{
                    border: `2px solid ${pkg === p.id ? AGENT : "rgba(11,30,63,0.12)"}`,
                    backgroundColor: pkg === p.id ? `${AGENT}10` : "#FBFCFD",
                    outlineColor: GOLD,
                  }}
                >
                  <div className="text-sm font-bold text-[#0B1E3F]">{lang === "bn" ? p.titleBn : p.titleEn}</div>
                  <div className="text-[11px] mt-1" style={{ color: "rgba(11,30,63,0.55)" }}>
                    {lang === "bn" ? p.hintBn : p.hintEn}
                  </div>
                </button>
              ))}
            </div>
            <div className="mb-2 text-[11px] font-semibold" style={{ color: "rgba(11,30,63,0.55)" }}>
              {lang === "bn" ? "ভিসার ধরন" : "Visa Type"}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" role="radiogroup" aria-label={lang === "bn" ? "ভিসা" : "Visa"}>
              {([
                { id: "umrah" as VisaTypeUi, titleBn: "উমরাহ ভিসা", titleEn: "Umrah Visa" },
                { id: "hajj" as VisaTypeUi, titleBn: "হজ ভিসা", titleEn: "Hajj Visa" },
                { id: "longstay" as VisaTypeUi, titleBn: "লং স্টে", titleEn: "Long Stay" },
              ]).map((v) => (
                <button
                  key={v.id}
                  type="button"
                  role="radio"
                  aria-checked={visaType === v.id}
                  onClick={() => setVisaType(v.id)}
                  className="rounded-xl p-4 text-left min-h-[88px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{
                    border: `2px solid ${visaType === v.id ? NAVY : "rgba(11,30,63,0.12)"}`,
                    backgroundColor: visaType === v.id ? `${NAVY}08` : "#FBFCFD",
                    outlineColor: GOLD,
                  }}
                >
                  <FileCheck size={18} style={{ color: AGENT }} className="mb-2" />
                  <div className="text-sm font-bold text-[#0B1E3F]">{lang === "bn" ? v.titleBn : v.titleEn}</div>
                </button>
              ))}
            </div>
            <ErpForm columns={2} className="mt-5">
              <ErpField label={lang === "bn" ? "সর্বোচ্চ ধারণক্ষমতা" : "Max Capacity"}>
                <ErpInput type="number" value={maxCapacity} onChange={(e) => setMaxCapacity(e.target.value)} />
              </ErpField>
              <ErpField label={lang === "bn" ? "যাত্রার তারিখ" : "Departure"}>
                <ErpInput type="date" value={departDate} onChange={(e) => setDepartDate(e.target.value)} />
              </ErpField>
              <ErpField label={lang === "bn" ? "ফেরার তারিখ" : "Return"}>
                <ErpInput type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
              </ErpField>
              <ErpFormRow span={2}>
                <ErpField label={lang === "bn" ? "নোট" : "Notes"}>
                  <ErpTextarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </ErpField>
              </ErpFormRow>
            </ErpForm>
            <div className="flex gap-2 mt-5">
              <ErpButton variant="secondary" onClick={() => setStep(1)}>{lang === "bn" ? "পিছনে" : "Back"}</ErpButton>
              <ErpButton
                variant="primary"
                disabled={!visaType}
                onClick={() => setStep(3)}
              >
                {lang === "bn" ? "পরবর্তী: যাত্রী →" : "Next: Passengers →"}
              </ErpButton>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="rounded-xl p-5 md:p-6" style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(11,30,63,0.11)" }}>
            <h2 className="text-base font-bold text-[#0B1E3F] mb-1">{lang === "bn" ? "৩ · যাত্রী" : "3 · Passengers"}</h2>
            <p className="text-sm mb-4" style={{ color: "rgba(11,30,63,0.58)" }}>
              {lang === "bn"
                ? "গ্রুপ নিশ্চিত করার পর ম্যানুয়াল এন্ট্রি, পাসপোর্ট OCR অথবা CSV দিয়ে যাত্রী যোগ করুন।"
                : "After confirm, add passengers via Manual, Passport OCR, or CSV on the group detail screen."}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
              {[
                { icon: Users, titleBn: "ম্যানুয়াল", titleEn: "Manual" },
                { icon: ScanLine, titleBn: "পাসপোর্ট OCR", titleEn: "Passport OCR" },
                { icon: FileText, titleBn: "CSV ইমপোর্ট", titleEn: "CSV Import" },
              ].map((m) => {
                const Icon = m.icon;
                return (
                  <div key={m.titleEn} className="rounded-xl p-4" style={{ border: "1px solid rgba(11,30,63,0.10)", backgroundColor: "#FBFCFD" }}>
                    <Icon size={18} style={{ color: AGENT }} className="mb-2" />
                    <div className="text-xs font-bold text-[#0B1E3F]">{lang === "bn" ? m.titleBn : m.titleEn}</div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2">
              <ErpButton variant="secondary" onClick={() => setStep(2)}>{lang === "bn" ? "পিছনে" : "Back"}</ErpButton>
              <ErpButton variant="primary" onClick={() => setStep(4)}>
                {lang === "bn" ? "পরবর্তী: নিশ্চিত করুন →" : "Next: Confirm →"}
              </ErpButton>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="rounded-xl p-5 md:p-6" style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(11,30,63,0.11)" }}>
            <h2 className="text-base font-bold text-[#0B1E3F] mb-4">{lang === "bn" ? "৪ · নিশ্চিত করুন" : "4 · Confirm"}</h2>
            <dl className="space-y-2 text-sm mb-5">
              {[
                [lang === "bn" ? "নাম" : "Name", name || "—"],
                [lang === "bn" ? "গন্তব্য" : "Destination", dest],
                [lang === "bn" ? "প্যাকেজ" : "Package", pkg],
                [lang === "bn" ? "ভিসা" : "Visa", visaType ? (lang === "bn" ? ({ umrah: "উমরাহ", hajj: "হজ", longstay: "লং স্টে" } as const)[visaType] : VISA_TYPE_LABEL[VISA_UI_TO_ENUM[visaType]]) : "—"],
                ["Nusuk", nusukGroupNumber || "—"],
                [lang === "bn" ? "তারিখ" : "Dates", `${departDate || "—"} → ${returnDate || "—"}`],
              ].map(([k, v]) => (
                <div key={String(k)} className="flex justify-between gap-4 py-2" style={{ borderBottom: "1px solid rgba(11,30,63,0.06)" }}>
                  <dt style={{ color: "rgba(11,30,63,0.50)" }}>{k}</dt>
                  <dd className="font-semibold text-[#0B1E3F] text-right">{v}</dd>
                </div>
              ))}
            </dl>
            {createError && <div className="mb-4"><ErrorState tone="light" lang={lang} message={createError} onRetry={submit} /></div>}
            <div className="flex gap-2">
              <ErpButton variant="secondary" onClick={() => setStep(3)} disabled={submitting}>{lang === "bn" ? "পিছনে" : "Back"}</ErpButton>
              <ErpButton variant="primary" loading={submitting} onClick={submit}>
                {lang === "bn" ? "নিশ্চিত করে তৈরি করুন" : "Confirm & Create"}
              </ErpButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Passengers Tab (real GET/POST/DELETE) ───────────────────────────────────

function PassengersTab({ group, onChanged }: { group: GroupRec; onChanged: () => void }) {
  const PAGE = 20;
  const groupId = group.apiId ?? "";
  const [rows, setRows] = useState<Pax[] | null>(null);
  const [loading, setLoading] = useState(!!groupId);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showOcr, setShowOcr] = useState(false);
  const [showCsv, setShowCsv] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [deleteCodes, setDeleteCodes] = useState<string[] | null>(null);
  const [detailPax, setDetailPax] = useState<Pax | null>(null);
  const [editPax, setEditPax] = useState<Pax | null>(null);
  const { lang } = useLang();

  const load = () => {
    if (!groupId) { setLoading(false); return; }
    setLoading(true); setError(false);
    api.get<ApiPassenger[]>(`/groups/${groupId}/passengers`)
      .then((ps) => { setRows(ps.map(toPax)); setError(false); })
      .catch(() => { setRows(null); setError(true); })
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  const refreshAll = () => { load(); onChanged(); };

  const paxList = rows ?? [];
  const filtered = paxList.filter((p) => {
    const matchQ = !q || p.name.toLowerCase().includes(q.toLowerCase()) || p.passport.toLowerCase().includes(q.toLowerCase());
    const matchS = statusFilter === "all" || p.visa === statusFilter;
    return matchQ && matchS;
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE, safePage * PAGE);

  const pidOf = (code: string) => paxList.find((p) => p.id === code)?.pid;
  const confirmRemove = async () => {
    if (!deleteCodes?.length) return;
    const pids = deleteCodes.map(pidOf).filter((x): x is string => !!x);
    if (!pids.length) { setDeleteCodes(null); return; }
    setBusy(true);
    try {
      for (const pid of pids) await api.delete(`/passengers/${pid}`);
      erpToast.success(lang === "bn" ? `${pids.length} যাত্রী মুছেছে` : `${pids.length} passenger(s) removed`, lang);
      setSelected(new Set());
      setDeleteCodes(null);
      refreshAll();
    } catch (e) {
      erpToast.error(errMsg(e, lang === "bn" ? "যাত্রী মুছা যায়নি" : "Could not remove passenger(s)"), lang);
    } finally {
      setBusy(false);
    }
  };

  const visaKind = (v: Pax["visa"]): ErpStatusKind =>
    v === "approved" ? "approved" : v === "rejected" ? "rejected" : "pending";

  const columns: ErpColumn<Pax>[] = [
    { id: "id", header: lang === "bn" ? "আইডি" : "ID", cell: (p) => <span className="text-[11px] font-mono" style={{ color: AGENT }}>{p.id}</span> },
    { id: "name", header: lang === "bn" ? "নাম" : "Name", cell: (p) => <span className="text-xs font-semibold truncate max-w-[160px] block" title={p.name}>{p.name}</span> },
    { id: "pass", header: lang === "bn" ? "পাসপোর্ট" : "Passport", cell: (p) => <span className="text-[11px] font-mono">{p.passport}</span> },
    { id: "nat", header: lang === "bn" ? "জাতীয়তা" : "Nat.", cell: (p) => <span className="text-[11px]">{p.nat}</span> },
    { id: "visa", header: lang === "bn" ? "ভিসা" : "Visa", cell: (p) => <ErpStatusChip status={visaKind(p.visa)} lang={lang} /> },
    {
      id: "ocr",
      header: "OCR",
      cell: (p) => p.ocrLinked
        ? <ErpStatusChip status="info" label="OCR" lang={lang} />
        : <span className="text-[10px]" style={{ color: "rgba(11,30,63,0.35)" }}>—</span>,
    },
  ];

  return (
    <div className="p-4 md:p-5" style={{ fontFamily: fontFor(lang) }}>
      <ErpPageTemplate
        title={lang === "bn" ? "যাত্রী" : "Passengers"}
        subtitle={`${group.id} · ${group.name}`}
        primaryAction={
          <div className="relative">
            <ErpButton variant="primary" icon={<Users size={14} />} disabled={!groupId} onClick={() => setAddOpen(!addOpen)}>
              {lang === "bn" ? "যাত্রী যোগ" : "Add Passenger"}
            </ErpButton>
            {addOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setAddOpen(false)} />
                <div className="absolute right-0 top-11 w-56 rounded-xl overflow-hidden z-20 shadow-lg" style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(11,30,63,0.12)" }}>
                  {[
                    { label: lang === "bn" ? "ম্যানুয়াল এন্ট্রি" : "Manual Entry", icon: Users, on: () => setShowManual(true) },
                    { label: lang === "bn" ? "পাসপোর্ট OCR" : "Passport OCR", icon: ScanLine, on: () => setShowOcr(true) },
                    { label: lang === "bn" ? "Excel / CSV ইমপোর্ট" : "Excel / CSV Import", icon: FileText, on: () => setShowCsv(true) },
                  ].map(({ label, icon: Icon, on }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => { setAddOpen(false); on(); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-left hover:bg-[rgba(11,30,63,0.04)]"
                    >
                      <Icon size={13} style={{ color: AGENT }} /> {label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        }
        secondaryAction={
          <div className="flex flex-wrap items-center gap-2">
            <ErpButton
              variant="outline"
              size="sm"
              icon={<Download size={13} />}
              disabled={!filtered.length}
              onClick={() => {
                downloadCsv(
                  `passengers-${group.id}-${new Date().toISOString().slice(0, 10)}.csv`,
                  ["Code", "Name", "Passport", "Nationality", "Gender", "DOB", "Visa", "Hotel", "Transport", "MoH"],
                  filtered.map((p) => [p.id, p.name, p.passport, p.nat, p.gender, p.dob, p.visa, p.hotel, p.transport, p.moh]),
                );
                erpToast.success(lang === "bn" ? "CSV ডাউনলোড হয়েছে" : "CSV downloaded", lang);
              }}
            >
              {lang === "bn" ? "এক্সপোর্ট CSV" : "Export CSV"}
            </ErpButton>
            {selected.size > 0 ? (
              <ErpButton variant="danger" size="sm" icon={<Trash2 size={13} />} disabled={busy} onClick={() => setDeleteCodes([...selected])}>
                {lang === "bn" ? `মুছুন (${selected.size})` : `Delete (${selected.size})`}
              </ErpButton>
            ) : null}
          </div>
        }
        toolbar={
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <div className="flex-1">
              <ErpSearchBar
                lang={lang}
                value={q}
                onChange={(e) => { setQ(e.target.value); setPage(1); }}
                onClear={() => { setQ(""); setPage(1); }}
                placeholder={lang === "bn"
                  ? "নাম অথবা পাসপোর্ট নম্বর লিখুন"
                  : "Search by name or passport number"}
              />
            </div>
            <ErpFilterPanel open={filtersOpen} onOpenChange={setFiltersOpen} lang={lang} activeCount={statusFilter === "all" ? 0 : 1}>
              <div className="flex flex-wrap gap-2">
                {([
                  { id: "all", bn: "সব", en: "All" },
                  { id: "approved", bn: "অনুমোদিত", en: "Approved" },
                  { id: "pending", bn: "অপেক্ষমাণ", en: "Pending" },
                  { id: "rejected", bn: "প্রত্যাখ্যাত", en: "Rejected" },
                ] as const).map((st) => (
                  <ErpButton key={st.id} size="sm" variant={statusFilter === st.id ? "primary" : "outline"} onClick={() => { setStatusFilter(st.id); setPage(1); }}>
                    {lang === "bn" ? st.bn : st.en}
                  </ErpButton>
                ))}
              </div>
            </ErpFilterPanel>
          </div>
        }
        footer={<ErpPagination page={safePage} pageSize={PAGE} total={filtered.length} onPageChange={setPage} lang={lang} />}
      >
        {!groupId ? (
          <EmptyState tone="light" title={lang === "bn" ? "প্রথমে গ্রুপ সংরক্ষণ করুন" : "Save the group first"} />
        ) : error ? (
          <ErrorState tone="light" lang={lang} onRetry={load} />
        ) : (
          <ErpDataTable
            columns={columns}
            rows={loading ? [] : pageRows}
            rowKey={(p) => p.id}
            loading={loading}
            lang={lang}
            selectable
            selectedKeys={selected}
            onSelectedKeysChange={setSelected}
            onRowClick={(p) => setDetailPax(p)}
            emptyTitle={lang === "bn" ? "কোনো তথ্য পাওয়া যায়নি" : "No passengers found"}
            emptyHint={lang === "bn" ? "ম্যানুয়াল, OCR অথবা CSV দিয়ে যাত্রী যোগ করুন।" : "Add via Manual, OCR, or CSV."}
            emptyAction={
              <ErpButton variant="primary" icon={<Plus size={14} />} onClick={() => setShowManual(true)} disabled={!groupId}>
                {lang === "bn" ? "নতুন তৈরি করুন" : "Add passenger"}
              </ErpButton>
            }
            rowActions={(p) => (
              <>
                <ErpButton size="sm" variant="ghost" icon={<Eye size={13} />} onClick={(e) => { e.stopPropagation(); setDetailPax(p); }} aria-label="View" />
                <ErpButton size="sm" variant="ghost" icon={<Pencil size={13} />} onClick={(e) => { e.stopPropagation(); setEditPax(p); }} aria-label="Edit" disabled={!p.pid} />
                <ErpButton size="sm" variant="ghost" icon={<Trash2 size={13} />} onClick={(e) => { e.stopPropagation(); setDeleteCodes([p.id]); }} aria-label="Delete" />
              </>
            )}
          />
        )}
      </ErpPageTemplate>

      <ManualPassengerDrawer groupId={groupId} open={showManual && !!groupId} onClose={() => setShowManual(false)} onAdded={refreshAll} />
      <EditPassengerDrawer pax={editPax} open={!!editPax} onClose={() => setEditPax(null)} onSaved={refreshAll} />
      {showOcr && groupId && <OcrIntakeModal groupId={groupId} onClose={() => setShowOcr(false)} onApproved={refreshAll} />}
      {showCsv && groupId && <CsvImportModal groupId={groupId} onClose={() => setShowCsv(false)} onImported={refreshAll} />}

      <ErpDrawer
        open={!!detailPax}
        onClose={() => setDetailPax(null)}
        title={detailPax?.name ?? (lang === "bn" ? "যাত্রীর বিবরণ" : "Passenger Details")}
        subtitle={detailPax?.id}
        lang={lang}
        footer={
          <div className="flex gap-2">
            <ErpButton variant="secondary" onClick={() => setDetailPax(null)}>
              {lang === "bn" ? "বন্ধ" : "Close"}
            </ErpButton>
            {detailPax?.pid && (
              <ErpButton
                variant="primary"
                icon={<Pencil size={13} />}
                onClick={() => { setEditPax(detailPax); setDetailPax(null); }}
              >
                {lang === "bn" ? "সম্পাদনা" : "Edit"}
              </ErpButton>
            )}
          </div>
        }
      >
        {detailPax && (
          <dl className="space-y-2 text-sm">
            {[
              [lang === "bn" ? "পাসপোর্ট" : "Passport", detailPax.passport],
              [lang === "bn" ? "জাতীয়তা" : "Nationality", detailPax.nat],
              [lang === "bn" ? "লিঙ্গ" : "Gender", detailPax.gender],
              [lang === "bn" ? "জন্ম" : "DOB", detailPax.dob],
              [lang === "bn" ? "ভিসা" : "Visa", detailPax.visa],
              ["Hotel", detailPax.hotel],
              ["Transport", detailPax.transport],
              ["MoH", detailPax.moh],
            ].map(([k, v]) => (
              <div key={String(k)} className="flex justify-between gap-3 py-2" style={{ borderBottom: "1px solid rgba(11,30,63,0.06)" }}>
                <dt style={{ color: "rgba(11,30,63,0.50)" }}>{k}</dt>
                <dd className="font-semibold text-[#0B1E3F]">{v}</dd>
              </div>
            ))}
          </dl>
        )}
      </ErpDrawer>

      <ErpDeleteDialog
        open={!!deleteCodes}
        onClose={() => setDeleteCodes(null)}
        onConfirm={confirmRemove}
        loading={busy}
        lang={lang}
        entityLabel={deleteCodes && deleteCodes.length === 1 ? deleteCodes[0] : deleteCodes ? `${deleteCodes.length}` : undefined}
      />
    </div>
  );
}

// ─── Group Detail View ────────────────────────────────────────────────────────

/** T001-03 — edit Nusuk / package / WhatsApp / readiness gates on an existing group. */
function GroupFoundationPanel({
  groupId,
  detail,
  onSaved,
}: {
  groupId: string;
  detail: ApiGroupDetail | null;
  onSaved: () => void;
}) {
  const [nusuk, setNusuk] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [consulate, setConsulate] = useState("");
  const [umrahCompanyId, setUmrahCompanyId] = useState("");
  const [umrahCompanies, setUmrahCompanies] = useState<ApiUmrahCompany[]>([]);
  const [pkg, setPkg] = useState("Standard");
  const [visaUi, setVisaUi] = useState<VisaTypeUi>("umrah");
  const [gates, setGates] = useState<GateState>(gatesFromApi(null));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) return;
    api.get<ApiUmrahCompany[]>("/services/umrah-companies")
      .then(setUmrahCompanies)
      .catch(() => setUmrahCompanies([]));
  }, []);

  useEffect(() => {
    if (!detail) return;
    setNusuk(detail.nusukGroupNumber ?? "");
    setWhatsapp(detail.hajiWhatsapp ?? "");
    setConsulate(detail.consulate ?? "");
    setUmrahCompanyId(detail.umrahCompanyId ?? "");
    setPkg(PKG_LABEL[detail.packageType ?? ""] ?? "Standard");
    const vt = detail.visaType;
    setVisaUi(vt === "HAJJ" ? "hajj" : vt === "LONG_STAY" ? "longstay" : "umrah");
    setGates(gatesFromApi(detail));
  }, [detail]);

  const save = async () => {
    const waErr = validateWhatsappUx(visaUi, whatsapp);
    if (waErr) { toast.error(waErr); return; }
    setSaving(true);
    try {
      await api.patch(`/groups/${groupId}`, {
        ...foundationPayload({
          visaTypeUi: visaUi,
          packageTypeDisplay: pkg,
          nusukGroupNumber: nusuk,
          hajiWhatsapp: whatsapp,
          consulate,
          umrahCompanyId,
          gates,
        }),
        // Allow clearing Nusuk / WhatsApp / Umrah Co explicitly when blanked in the form.
        nusukGroupNumber: nusuk.trim() || null,
        hajiWhatsapp: whatsapp.trim() || null,
        consulate: consulate.trim() || null,
        umrahCompanyId: umrahCompanyId.trim() || null,
        ...gates,
      });
      toast.success("Group foundation saved");
      onSaved();
    } catch (e) {
      toast.error(errMsg(e, "Could not save group foundation"));
    } finally {
      setSaving(false);
    }
  };

  const uploadedBy =
    detail?.uploadedByLabel?.trim() ||
    detail?.uploadedByUser?.name ||
    "—";

  const field = "w-full px-3 py-2 text-xs rounded-xl focus:outline-none";
  const fieldStyle = { backgroundColor: "#F5F7FA", border: `1px solid ${AGENT}30`, color: "#0B1E3F" } as const;

  return (
    <div className="mx-7 mt-5 mb-2 rounded-2xl p-5 space-y-4" style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(11,30,63,0.11)" }}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-[#0B1E3F]">Group Foundation</h2>
          <p className="text-[10px] mt-0.5" style={{ color: "rgba(11,30,63,0.50)" }}>
            Internal code <span style={{ fontFamily: "var(--font-mono)", color: AGENT }}>{detail?.code ?? "—"}</span>
          </p>
        </div>
        <button onClick={save} disabled={saving || !detail} className="px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-50" style={{ backgroundColor: AGENT, color: "#0B1E3F" }}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <section>
          <h3 className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: AGENT }}>Group Information</h3>
          <div className="space-y-2.5">
            <div>
              <label className="text-[9px] font-bold uppercase tracking-widest block mb-1" style={{ color: "rgba(11,30,63,0.50)" }}>Nusuk Group Number</label>
              <input value={nusuk} onChange={(e) => setNusuk(e.target.value)} className={field} style={{ ...fieldStyle, fontFamily: "var(--font-mono)" }} />
            </div>
            <div>
              <label className="text-[9px] font-bold uppercase tracking-widest block mb-1" style={{ color: "rgba(11,30,63,0.50)" }}>Visa Type</label>
              <select value={visaUi} onChange={(e) => setVisaUi(e.target.value as VisaTypeUi)} className={field} style={fieldStyle}>
                <option value="umrah">Umrah Visa</option>
                <option value="hajj">Hajj Visa</option>
                <option value="longstay">Long Stay</option>
              </select>
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: AGENT }}>Package</h3>
          <div>
            <label className="text-[9px] font-bold uppercase tracking-widest block mb-1" style={{ color: "rgba(11,30,63,0.50)" }}>Package Type</label>
            <select value={pkg} onChange={(e) => setPkg(e.target.value)} className={field} style={fieldStyle}>
              <option>Economy</option><option>Standard</option><option>Premium</option>
            </select>
          </div>
        </section>

        <section>
          <h3 className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: AGENT }}>Communication</h3>
          <div className="space-y-2.5">
            <div>
              <label className="text-[9px] font-bold uppercase tracking-widest block mb-1" style={{ color: "rgba(11,30,63,0.50)" }}>Haji WhatsApp</label>
              <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className={field} style={fieldStyle} />
            </div>
            <div>
              <label className="text-[9px] font-bold uppercase tracking-widest block mb-1" style={{ color: "rgba(11,30,63,0.50)" }}>Consulate</label>
              <input value={consulate} onChange={(e) => setConsulate(e.target.value)} className={field} style={fieldStyle} />
            </div>
            <div>
              <label className="text-[9px] font-bold uppercase tracking-widest block mb-1" style={{ color: "rgba(11,30,63,0.50)" }}>Umrah Company</label>
              <select value={umrahCompanyId} onChange={(e) => setUmrahCompanyId(e.target.value)} className={field} style={fieldStyle}>
                <option value="">— None —</option>
                {umrahCompanies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[9px] font-bold uppercase tracking-widest block mb-1" style={{ color: "rgba(11,30,63,0.50)" }}>Uploaded By</label>
              <div className="text-xs px-3 py-2 rounded-xl" style={{ backgroundColor: "#EEF1F6", color: "rgba(11,30,63,0.66)" }}>{uploadedBy}</div>
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: AGENT }}>Readiness</h3>
          <div className="grid grid-cols-1 gap-2">
            {GATE_LABELS.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2.5 text-xs text-[#0B1E3F] cursor-pointer">
                <input
                  type="checkbox"
                  checked={gates[key]}
                  onChange={(e) => setGates((g) => ({ ...g, [key]: e.target.checked }))}
                  className="rounded"
                />
                {label}
              </label>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function GroupDetailView({ group, onBack }: { group: GroupRec; onBack: () => void }) {
  const { lang } = useLang();
  const [tab, setTab] = useState<DetailTab>("passengers");
  const authed = isLoggedIn();
  // Only real (API-backed) groups have a uuid to fetch; the demo rows do not.
  const live = authed && !!group.apiId;
  const [detail, setDetail] = useState<ApiGroupDetail | null>(null);
  const [loading, setLoading] = useState(live);
  const [error, setError] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const refresh = () => {
    if (!isLoggedIn() || !group.apiId) return;
    setLoading(true);
    setError(false);
    api
      .get<ApiGroupDetail>(`/groups/${group.apiId}`)
      .then((d) => { setDetail(d); setError(false); })
      .catch(() => { setDetail(null); setError(true); }) // never fall back to the demo roster
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    const t = setTimeout(refresh, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.apiId]);

  const deleteGroup = async () => {
    if (!group.apiId) return;
    setDeleting(true);
    try {
      await api.delete(`/groups/${group.apiId}`);
      erpToast.success(lang === "bn" ? `গ্রুপ ${group.id} মুছেছে` : `Group ${group.id} deleted`, lang);
      setConfirmDelete(false);
      onBack();
    } catch (e) {
      erpToast.error(
        errMsg(e, lang === "bn"
          ? "মুছা যায়নি — যাত্রী বা ইনভয়েস থাকলে গ্রুপ বাতিল করুন"
          : "Could not delete — cancel the group instead if it has passengers or invoices"),
        lang,
      );
    } finally {
      setDeleting(false);
    }
  };

  // null → signed out / demo row, which keeps the frozen prototype content.
  const paxRows = useMemo<Pax[] | null>(
    () => (live ? (detail?.passengers ?? []).map(toPax) : null),
    [live, detail],
  );

  // Flights come from GET /groups/:id → flightInfos[].
  const flightCards = live
    ? (detail?.flightInfos ?? []).map((f) => ({
        dir: f.direction === "ARRIVAL" ? "Arrival" : "Departure",
        airline: f.airline,
        flight: f.flightNo,
        from: f.originAirport,
        to: f.destAirport,
        date: fmtDate(f.scheduledAt),
        time: fmtTime(f.scheduledAt),
        // TODO: FlightInfo has `gate` too, but the frozen card has no gate row.
        terminal: f.terminal ?? "—",
        pax: f.paxCount,
      }))
    : [];

  const flightsState: ReactNode = !live ? null
    : loading ? <LoadingSkeleton tone="light" rows={4} />
    : error ? <ErrorState tone="light" onRetry={refresh} />
    : flightCards.length === 0 ? (
        <EmptyState tone="light" title="No flights yet" hint="Arrival and departure flights appear here once submitted." />
      )
    : null;

  // Header pipeline, derived from the real passenger statuses when signed in.
  // TODO: Passenger carries visaStatus/hotelStatus/transportStatus/mohStatus only —
  // there is no catering field, so the C stage stays 0 for live groups.
  const pipe = paxRows
    ? {
        v: paxRows.filter((p) => p.visa === "approved").length,
        h: paxRows.filter((p) => p.hotel === "confirmed").length,
        t: paxRows.filter((p) => p.transport === "confirmed").length,
        c: 0,
      }
    : { v: group.visa, h: group.hotel, t: group.transport, c: group.catering };

  const TABS: { id: DetailTab; label: string; icon: typeof FileCheck }[] = [
    { id: "passengers", label: "Passengers",  icon: Users },
    { id: "flights",    label: "Flights",     icon: Plane },
    { id: "hotel",      label: "Hotel",       icon: Building },
    { id: "transport",  label: "transport",   icon: Bus },
    { id: "catering",   label: "Catering",    icon: UtensilsCrossed },
    { id: "documents",  label: "Documents",   icon: FileText },
    { id: "timeline",   label: "Timeline",    icon: Clock },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Group header */}
      <div className="px-7 pt-5 pb-0" style={{ borderBottom: "1px solid rgba(11,30,63,0.11)" }}>
        <div className="flex items-center gap-2 mb-3">
          <button onClick={onBack} className="flex items-center gap-1 text-xs" style={{ color: "rgba(11,30,63,0.58)" }}>
            <ArrowLeft size={12} /> Groups
          </button>
          <ChevronRight size={10} style={{ color: "rgba(11,30,63,0.38)" }} />
          <span className="text-xs" style={{ color: AGENT, fontFamily: "var(--font-mono)" }}>{group.id}</span>
          <div className="flex-1" />
          {live && (
            <ErpButton
              variant="danger"
              size="sm"
              icon={<Trash2 size={12} />}
              disabled={deleting}
              onClick={() => setConfirmDelete(true)}
            >
              {lang === "bn" ? "মুছুন" : "Delete"}
            </ErpButton>
          )}
        </div>
        <div className="flex items-start justify-between mb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 mb-1 min-w-0">
              <h1 className="text-base font-bold text-[#0B1E3F] truncate" title={group.name}>{group.name}</h1>
              <span className="shrink-0"><SBadge status={group.status} /></span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[10px]" style={{ color: "rgba(11,30,63,0.58)" }}>
              <span><MapPin size={9} className="inline mr-1" />{group.dest}</span>
              <span>·</span>
              <span>{VISA_LABEL[detail?.visaType ?? group.visaTypeEnum ?? ""] ?? group.type}</span>
              <span>·</span>
              <span>{PKG_LABEL[detail?.packageType ?? ""] ?? group.pkg}</span>
              <span>·</span>
              <span style={{ fontFamily: "var(--font-mono)" }}>Nusuk {formatNusuk(detail?.nusukGroupNumber ?? group.nusukGroupNumber)}</span>
              <span>·</span>
              <span style={{ fontFamily: "var(--font-mono)" }}>{group.pax} pax</span>
              <span>·</span>
              <span>{group.depart} → {group.ret}</span>
              {(detail || group.gates) && (
                <>
                  <span>·</span>
                  <span>Gates {gateSummary(gatesFromApi(detail ?? group.gates))}</span>
                </>
              )}
            </div>
          </div>
          <div className="shrink-0">
            <Pipeline pax={group.pax} v={pipe.v} h={pipe.h} t={pipe.t} c={pipe.c} />
          </div>
        </div>
        {/* Tabs */}
        <div className="flex gap-0">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold transition-all relative"
              style={{ color: tab === id ? "#0B1E3F" : "rgba(11,30,63,0.58)" }}
            >
              <Icon size={12} />
              {label.charAt(0).toUpperCase() + label.slice(1)}
              {tab === id && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full" style={{ backgroundColor: AGENT }} />}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content (scrollable) */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(11,30,63,0.38) transparent" }}>
        {live && (
          <GroupFoundationPanel groupId={group.apiId!} detail={detail} onSaved={refresh} />
        )}
        {tab === "passengers" && <PassengersTab group={group} onChanged={refresh} />}

        {tab === "flights" && (
          <div className="p-7 grid grid-cols-2 gap-5">
            {flightsState ? (
              <div className="col-span-2">{flightsState}</div>
            ) : flightCards.map((f) => (
              <div key={`${f.dir}-${f.flight}`} className="rounded-2xl p-5" style={{ backgroundColor: "#FBFCFD", border: "1px solid rgba(11,30,63,0.11)" }}>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${AGENT}18` }}><Plane size={14} style={{ color: AGENT }} /></div>
                  <div className="min-w-0">
                    <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "rgba(11,30,63,0.50)" }}>{f.dir} Flight</div>
                    <div className="text-xs font-bold text-[#0B1E3F] truncate" title={f.airline}>{f.airline}</div>
                  </div>
                  <span className="ml-auto text-xs font-mono font-bold shrink-0" style={{ color: GOLD, fontFamily: "var(--font-mono)" }}>{f.flight}</span>
                </div>
                {[["Route", `${f.from} → ${f.to}`], ["Date", f.date], ["Departure Time", f.time], ["Terminal", f.terminal], ["Passengers", String(f.pax)]].map(([l, v]) => (
                  <div key={l} className="flex justify-between items-center gap-3 py-1.5" style={{ borderBottom: "1px solid rgba(11,30,63,0.08)" }}>
                    <span className="text-[10px] shrink-0" style={{ color: "rgba(11,30,63,0.50)" }}>{l}</span>
                    <span className="text-[10px] font-semibold text-[#0B1E3F] min-w-0 truncate" title={v}>{v}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {tab === "hotel" && <ComingSoonPanel title="Hotel bookings — coming soon" hint="Room blocks and hotel vouchers appear here once the Supplier module goes live." />}

        {tab === "transport" && <ComingSoonPanel title="Transport — coming soon" hint="Bus and driver assignments appear here once the Fleet module goes live." />}

        {tab === "catering" && <ComingSoonPanel title="Catering — coming soon" hint="Group meal plans appear here in a later release." />}

        {tab === "documents" && <ComingSoonPanel title="Group documents — coming soon" hint="Vouchers and manifests appear here. Company documents live under Finance & Billing." />}

        {tab === "timeline" && <ComingSoonPanel title="Activity timeline — coming soon" hint="A per-group audit trail appears here in a later release." />}

      </div>

      <ErpDeleteDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={deleteGroup}
        loading={deleting}
        lang={lang}
        entityLabel={group.id}
      />
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function GroupsModule() {
  const [view, setView] = useState<GroupView>("list");
  const [selectedGroup, setSelectedGroup] = useState<GroupRec | null>(null);
  // Owned here so the wizard's successful POST and the detail view's Back both
  // land on a freshly refetched list.
  const { authed, loading, error, groups, refresh } = useGroups();

  if (view === "wizard") {
    return (
      <GroupWizard
        onBack={() => setView("list")}
        onCreated={refresh}
        onDone={(g) => { setSelectedGroup(g); setView("detail"); }}
      />
    );
  }

  if (view === "detail" && selectedGroup) {
    return <GroupDetailView group={selectedGroup} onBack={() => { refresh(); setView("list"); }} />;
  }

  return (
    <GroupsListView
      onSelect={(g) => { setSelectedGroup(g); setView("detail"); }}
      onNew={() => setView("wizard")}
      authed={authed}
      groups={groups}
      loading={loading}
      error={error}
      refresh={refresh}
    />
  );
}
