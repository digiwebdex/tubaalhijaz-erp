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
import { api, ApiError, getStoredUser, isLoggedIn } from "../lib/api";
import { hasPermission, isPlatformStaff, P } from "../lib/rbac";
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
  tenant?: { id?: string; code: string; name: string; nameBn?: string | null } | null;
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

/** Visible tab with no inventable API — no fake actions. */
function ModuleNotConfigured({ title }: { title?: string }) {
  const { lang } = useLang();
  return (
    <div className="p-7" style={{ fontFamily: fontFor(lang) }}>
      <EmptyState
        tone="light"
        title={title ?? (lang === "bn" ? "মডিউল প্রস্তুত নয়" : "Module not ready")}
        hint="এই মডিউল এখনও কনফিগার করা হয়নি।"
        icon={<AlertCircle size={30} style={{ color: "rgba(11,30,63,0.35)" }} />}
      />
    </div>
  );
}

// ─── Group detail service bookings (existing /services/* APIs) ────────────────

interface SvcRow {
  id: string; code: string; status: string; createdAt: string;
  hotel?: { name: string; stars: number } | null;
  checkIn?: string; checkOut?: string; nights?: number;
  doubleRooms?: number; tripleRooms?: number; singleRooms?: number; mealPlan?: string;
  vehicleType?: string; vehicleCount?: number; departurePoint?: string; destination?: string;
  departAt?: string; returnAt?: string | null;
  halalCount?: number; vegetarianCount?: number; diabeticCount?: number;
  voucher?: { id: string; code: string; fileId: string } | null;
}

interface HotelOpt { id: string; name: string; city: string; stars: number; available: boolean }

interface VoucherRow {
  id: string; code: string; type: string; status: string; issueDate: string; fileId: string | null;
  group?: { code: string; name: string } | null;
}

interface AuditRow {
  id: string; createdAt: string; action: string; module: string;
  entityType: string; entityId: string; actorLabel?: string | null;
  actorUser?: { name: string; email: string } | null;
}

function svcStatusKind(s: string): ErpStatusKind {
  if (s === "COMPLETED" || s === "VOUCHER_ISSUED" || s === "CONFIRMED") return "approved";
  if (s === "REJECTED" || s === "CANCELLED") return "rejected";
  if (s === "ASSIGNED") return "info";
  return "pending";
}

function GroupFlightsTab({
  flights, loading, error, onRetry, live,
}: {
  flights: ApiFlightInfo[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  live: boolean;
}) {
  const { lang } = useLang();
  const [q, setQ] = useState("");
  const [dir, setDir] = useState<"all" | "ARRIVAL" | "DEPARTURE">("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE = 20;

  if (!live) {
    return <ModuleNotConfigured title={lang === "bn" ? "ফ্লাইট" : "Flights"} />;
  }

  const filtered = flights.filter((f) => {
    if (dir !== "all" && f.direction !== dir) return false;
    const qq = q.trim().toLowerCase();
    if (!qq) return true;
    return [f.flightNo, f.airline, f.originAirport, f.destAirport, f.code, f.status]
      .join(" ").toLowerCase().includes(qq);
  });
  const safePage = Math.min(page, Math.max(1, Math.ceil(filtered.length / PAGE)));
  const pageRows = filtered.slice((safePage - 1) * PAGE, safePage * PAGE);

  const columns: ErpColumn<ApiFlightInfo>[] = [
    { id: "code", header: lang === "bn" ? "কোড" : "Code", cell: (f) => <span className="text-[11px] font-mono" style={{ color: AGENT }}>{f.code}</span> },
    { id: "dir", header: lang === "bn" ? "ধরন" : "Dir", cell: (f) => f.direction === "ARRIVAL" ? (lang === "bn" ? "আগমন" : "Arrival") : (lang === "bn" ? "প্রস্থান" : "Departure") },
    { id: "flight", header: lang === "bn" ? "ফ্লাইট" : "Flight", cell: (f) => <span className="text-xs font-semibold">{f.airline} · {f.flightNo}</span> },
    { id: "route", header: lang === "bn" ? "রুট" : "Route", cell: (f) => <span className="text-[11px] font-mono">{f.originAirport} → {f.destAirport}</span> },
    { id: "when", header: lang === "bn" ? "সময়" : "When", cell: (f) => <span className="text-[11px]">{fmtDate(f.scheduledAt)} · {fmtTime(f.scheduledAt)}</span> },
    { id: "pax", header: "Pax", align: "center", cell: (f) => <span className="font-mono font-bold">{f.paxCount}</span> },
    { id: "st", header: lang === "bn" ? "স্ট্যাটাস" : "Status", cell: (f) => <ErpStatusChip status={svcStatusKind(f.status)} label={f.status} lang={lang} /> },
  ];

  return (
    <div className="p-4 md:p-5" style={{ fontFamily: fontFor(lang) }}>
      <ErpPageTemplate
        title={lang === "bn" ? "ফ্লাইট" : "Flights"}
        subtitle={lang === "bn" ? "গ্রুপের অ্যাসাইন করা ফ্লাইট (পঠনযোগ্য)" : "Assigned flights for this group (read-only)"}
        toolbar={
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <div className="flex-1">
              <ErpSearchBar lang={lang} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} onClear={() => setQ("")}
                placeholder={lang === "bn" ? "ফ্লাইট নম্বর বা এয়ারলাইন…" : "Flight no or airline…"} />
            </div>
            <ErpFilterPanel open={filtersOpen} onOpenChange={setFiltersOpen} lang={lang} activeCount={dir === "all" ? 0 : 1}>
              <div className="flex flex-wrap gap-2">
                {([
                  { id: "all" as const, bn: "সব", en: "All" },
                  { id: "ARRIVAL" as const, bn: "আগমন", en: "Arrival" },
                  { id: "DEPARTURE" as const, bn: "প্রস্থান", en: "Departure" },
                ]).map((d) => (
                  <ErpButton key={d.id} size="sm" variant={dir === d.id ? "primary" : "outline"} onClick={() => { setDir(d.id); setPage(1); }}>
                    {lang === "bn" ? d.bn : d.en}
                  </ErpButton>
                ))}
              </div>
            </ErpFilterPanel>
          </div>
        }
        footer={<ErpPagination page={safePage} pageSize={PAGE} total={filtered.length} onPageChange={setPage} lang={lang} />}
      >
        {error ? (
          <ErrorState tone="light" lang={lang} onRetry={onRetry} />
        ) : (
          <ErpDataTable
            columns={columns}
            rows={loading ? [] : pageRows}
            rowKey={(f) => f.id}
            loading={loading}
            lang={lang}
            emptyTitle={lang === "bn" ? "কোনো ফ্লাইট নেই" : "No flights assigned"}
            emptyHint={lang === "bn" ? "অপস ফ্লাইট অ্যাসাইন করলে এখানে দেখা যাবে। এজেন্ট তৈরি API নেই।" : "Flights appear when ops assigns them. No agent create API."}
          />
        )}
      </ErpPageTemplate>
    </div>
  );
}

function GroupServiceTab({
  groupId, service, titleBn, titleEn,
}: {
  groupId: string;
  service: "hotel" | "transport" | "catering";
  titleBn: string;
  titleEn: string;
}) {
  const { lang } = useLang();
  const [rows, setRows] = useState<SvcRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const PAGE = 20;

  const load = () => {
    if (!isLoggedIn() || !groupId) { setLoading(false); return; }
    setLoading(true); setError(false);
    api.get<SvcRow[]>(`/services/${service}?groupId=${encodeURIComponent(groupId)}`)
      .then((r) => { setRows(r); setError(false); })
      .catch(() => { setRows(null); setError(true); })
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, service]);

  const list = rows ?? [];
  const filtered = list.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    const qq = q.trim().toLowerCase();
    if (!qq) return true;
    return [r.code, r.status, r.hotel?.name, r.vehicleType, r.destination, r.mealPlan]
      .filter(Boolean).join(" ").toLowerCase().includes(qq);
  });
  const safePage = Math.min(page, Math.max(1, Math.ceil(filtered.length / PAGE)));
  const pageRows = filtered.slice((safePage - 1) * PAGE, safePage * PAGE);

  const cancel = async (id: string) => {
    setBusyId(id);
    try {
      await api.patch(`/services/${service}/${id}/status`, { status: "CANCELLED" });
      erpToast.success(lang === "bn" ? "বাতিল হয়েছে" : "Cancelled", lang);
      load();
    } catch (e) {
      erpToast.error(errMsg(e, lang === "bn" ? "বাতিল ব্যর্থ" : "Cancel failed"), lang);
    } finally {
      setBusyId(null);
    }
  };

  const columns: ErpColumn<SvcRow>[] = [
    { id: "code", header: lang === "bn" ? "কোড" : "Code", cell: (r) => <span className="text-[11px] font-mono" style={{ color: AGENT }}>{r.code}</span> },
    {
      id: "detail",
      header: lang === "bn" ? "বিবরণ" : "Detail",
      cell: (r) => {
        if (service === "hotel") {
          return <span className="text-xs">{r.hotel?.name ?? "—"} · {fmtDate(r.checkIn)} → {fmtDate(r.checkOut)}</span>;
        }
        if (service === "transport") {
          return <span className="text-xs">{r.vehicleType} ×{r.vehicleCount} · {r.departurePoint} → {r.destination}</span>;
        }
        return <span className="text-xs">{r.mealPlan} · H{r.halalCount ?? 0}/V{r.vegetarianCount ?? 0}</span>;
      },
    },
    { id: "st", header: lang === "bn" ? "স্ট্যাটাস" : "Status", cell: (r) => <ErpStatusChip status={svcStatusKind(r.status)} label={r.status} lang={lang} /> },
    { id: "created", header: lang === "bn" ? "তৈরি" : "Created", cell: (r) => <span className="text-[11px]">{fmtDate(r.createdAt)}</span> },
  ];

  return (
    <div className="p-4 md:p-5" style={{ fontFamily: fontFor(lang) }}>
      <ErpPageTemplate
        title={lang === "bn" ? titleBn : titleEn}
        subtitle={lang === "bn" ? "বিদ্যমান সার্ভিস API" : "Existing services API"}
        primaryAction={
          <ErpButton variant="primary" icon={<Plus size={14} />} onClick={() => setShowCreate(true)} disabled={!groupId}>
            {lang === "bn" ? "নতুন অনুরোধ" : "New request"}
          </ErpButton>
        }
        toolbar={
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <div className="flex-1">
              <ErpSearchBar lang={lang} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} onClear={() => setQ("")}
                placeholder={lang === "bn" ? "কোড বা বিবরণ…" : "Code or detail…"} />
            </div>
            <ErpFilterPanel open={filtersOpen} onOpenChange={setFiltersOpen} lang={lang} activeCount={statusFilter === "all" ? 0 : 1}>
              <div className="flex flex-wrap gap-2">
                {["all", "REQUESTED", "ASSIGNED", "CONFIRMED", "VOUCHER_ISSUED", "COMPLETED", "CANCELLED"].map((st) => (
                  <ErpButton key={st} size="sm" variant={statusFilter === st ? "primary" : "outline"} onClick={() => { setStatusFilter(st); setPage(1); }}>
                    {st === "all" ? (lang === "bn" ? "সব" : "All") : st}
                  </ErpButton>
                ))}
              </div>
            </ErpFilterPanel>
          </div>
        }
        footer={<ErpPagination page={safePage} pageSize={PAGE} total={filtered.length} onPageChange={setPage} lang={lang} />}
      >
        {error ? (
          <ErrorState tone="light" lang={lang} onRetry={load} />
        ) : (
          <ErpDataTable
            columns={columns}
            rows={loading ? [] : pageRows}
            rowKey={(r) => r.id}
            loading={loading}
            lang={lang}
            emptyTitle={lang === "bn" ? "কোনো তথ্য পাওয়া যায়নি" : "No bookings yet"}
            emptyHint={lang === "bn" ? "নতুন অনুরোধ দিয়ে শুরু করুন।" : "Submit a new request to get started."}
            emptyAction={
              <ErpButton variant="primary" icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>
                {lang === "bn" ? "নতুন তৈরি করুন" : "Create new"}
              </ErpButton>
            }
            rowActions={(r) => (
              <ErpButton
                size="sm"
                variant="ghost"
                disabled={busyId === r.id || r.status === "CANCELLED" || r.status === "COMPLETED"}
                onClick={(e) => { e.stopPropagation(); void cancel(r.id); }}
              >
                {lang === "bn" ? "বাতিল" : "Cancel"}
              </ErpButton>
            )}
          />
        )}
      </ErpPageTemplate>

      {service === "hotel" && (
        <HotelCreateDrawer groupId={groupId} open={showCreate} onClose={() => setShowCreate(false)} onCreated={load} />
      )}
      {service === "transport" && (
        <TransportCreateDrawer groupId={groupId} open={showCreate} onClose={() => setShowCreate(false)} onCreated={load} />
      )}
      {service === "catering" && (
        <CateringCreateDrawer groupId={groupId} open={showCreate} onClose={() => setShowCreate(false)} onCreated={load} />
      )}
    </div>
  );
}

function HotelCreateDrawer({ groupId, open, onClose, onCreated }: {
  groupId: string; open: boolean; onClose: () => void; onCreated: () => void;
}) {
  const { lang } = useLang();
  const [hotels, setHotels] = useState<HotelOpt[]>([]);
  const [hotelId, setHotelId] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [doubleRooms, setDoubleRooms] = useState("0");
  const [tripleRooms, setTripleRooms] = useState("0");
  const [mealPlan, setMealPlan] = useState("FULL_BOARD");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !isLoggedIn()) return;
    api.get<HotelOpt[]>("/hotels")
      .then((hs) => {
        setHotels(hs);
        const first = hs.find((h) => h.available) ?? hs[0];
        if (first) setHotelId(first.id);
      })
      .catch(() => setHotels([]));
  }, [open]);

  const submit = async () => {
    if (!checkIn || !checkOut) {
      erpToast.error(lang === "bn" ? "চেক-ইন/আউট দিন" : "Check-in and check-out required", lang);
      return;
    }
    setBusy(true);
    try {
      await api.post("/services/hotel", {
        groupId,
        ...(hotelId ? { hotelId } : {}),
        checkIn, checkOut,
        doubleRooms: parseInt(doubleRooms, 10) || 0,
        tripleRooms: parseInt(tripleRooms, 10) || 0,
        mealPlan,
      });
      erpToast.success(lang === "bn" ? "হোটেল অনুরোধ জমা" : "Hotel request submitted", lang);
      onCreated();
      onClose();
    } catch (e) {
      erpToast.error(errMsg(e, lang === "bn" ? "জমা ব্যর্থ" : "Submit failed"), lang);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ErpDrawer open={open} onClose={onClose} title={lang === "bn" ? "হোটেল অনুরোধ" : "Hotel request"} lang={lang}
      footer={<ErpDrawerFooterActions lang={lang} onCancel={onClose} onSave={submit} saving={busy} saveLabel={lang === "bn" ? "জমা দিন" : "Submit"} />}>
      <ErpForm columns={2}>
        <ErpFormRow span={2}>
          <ErpField label={lang === "bn" ? "হোটেল" : "Hotel"}>
            <ErpSelect value={hotelId} onChange={(e) => setHotelId(e.target.value)}>
              <option value="">—</option>
              {hotels.map((h) => <option key={h.id} value={h.id}>{h.name} ({h.city}){"★".repeat(h.stars)}</option>)}
            </ErpSelect>
          </ErpField>
        </ErpFormRow>
        <ErpField label={lang === "bn" ? "চেক-ইন" : "Check-in"} required>
          <ErpInput type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
        </ErpField>
        <ErpField label={lang === "bn" ? "চেক-আউট" : "Check-out"} required>
          <ErpInput type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
        </ErpField>
        <ErpField label={lang === "bn" ? "ডাবল রুম" : "Double rooms"}>
          <ErpInput type="number" value={doubleRooms} onChange={(e) => setDoubleRooms(e.target.value)} />
        </ErpField>
        <ErpField label={lang === "bn" ? "ট্রিপল রুম" : "Triple rooms"}>
          <ErpInput type="number" value={tripleRooms} onChange={(e) => setTripleRooms(e.target.value)} />
        </ErpField>
        <ErpFormRow span={2}>
          <ErpField label={lang === "bn" ? "মিল প্ল্যান" : "Meal plan"}>
            <ErpSelect value={mealPlan} onChange={(e) => setMealPlan(e.target.value)}>
              <option value="FULL_BOARD">Full Board</option>
              <option value="HALF_BOARD">Half Board</option>
              <option value="BED_BREAKFAST">Bed & Breakfast</option>
              <option value="ROOM_ONLY">Room Only</option>
            </ErpSelect>
          </ErpField>
        </ErpFormRow>
      </ErpForm>
    </ErpDrawer>
  );
}

function TransportCreateDrawer({ groupId, open, onClose, onCreated }: {
  groupId: string; open: boolean; onClose: () => void; onCreated: () => void;
}) {
  const { lang } = useLang();
  const [vehicleType, setVehicleType] = useState("BUS");
  const [vehicleCount, setVehicleCount] = useState("1");
  const [departurePoint, setDeparturePoint] = useState("");
  const [destination, setDestination] = useState("");
  const [departAt, setDepartAt] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!departurePoint.trim() || !destination.trim() || !departAt) {
      erpToast.error(lang === "bn" ? "রুট ও সময় আবশ্যক" : "Route and departure required", lang);
      return;
    }
    setBusy(true);
    try {
      await api.post("/services/transport", {
        groupId,
        vehicleType,
        vehicleCount: Math.max(1, parseInt(vehicleCount, 10) || 1),
        departurePoint: departurePoint.trim(),
        destination: destination.trim(),
        departAt: new Date(departAt).toISOString(),
      });
      erpToast.success(lang === "bn" ? "ট্রান্সপোর্ট অনুরোধ জমা" : "Transport request submitted", lang);
      onCreated();
      onClose();
    } catch (e) {
      erpToast.error(errMsg(e, lang === "bn" ? "জমা ব্যর্থ" : "Submit failed"), lang);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ErpDrawer open={open} onClose={onClose} title={lang === "bn" ? "ট্রান্সপোর্ট অনুরোধ" : "Transport request"} lang={lang}
      footer={<ErpDrawerFooterActions lang={lang} onCancel={onClose} onSave={submit} saving={busy} saveLabel={lang === "bn" ? "জমা দিন" : "Submit"} />}>
      <ErpForm columns={2}>
        <ErpField label={lang === "bn" ? "যানবাহন" : "Vehicle"}>
          <ErpSelect value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
            {["SEDAN", "HIACE", "COASTER", "BUS", "VAN"].map((v) => <option key={v} value={v}>{v}</option>)}
          </ErpSelect>
        </ErpField>
        <ErpField label={lang === "bn" ? "সংখ্যা" : "Count"}>
          <ErpInput type="number" value={vehicleCount} onChange={(e) => setVehicleCount(e.target.value)} />
        </ErpField>
        <ErpFormRow span={2}>
          <ErpField label={lang === "bn" ? "যাত্রাস্থল" : "From"} required>
            <ErpInput value={departurePoint} onChange={(e) => setDeparturePoint(e.target.value)} />
          </ErpField>
        </ErpFormRow>
        <ErpFormRow span={2}>
          <ErpField label={lang === "bn" ? "গন্তব্য" : "To"} required>
            <ErpInput value={destination} onChange={(e) => setDestination(e.target.value)} />
          </ErpField>
        </ErpFormRow>
        <ErpFormRow span={2}>
          <ErpField label={lang === "bn" ? "যাত্রার সময়" : "Depart at"} required>
            <ErpInput type="datetime-local" value={departAt} onChange={(e) => setDepartAt(e.target.value)} />
          </ErpField>
        </ErpFormRow>
      </ErpForm>
    </ErpDrawer>
  );
}

function CateringCreateDrawer({ groupId, open, onClose, onCreated }: {
  groupId: string; open: boolean; onClose: () => void; onCreated: () => void;
}) {
  const { lang } = useLang();
  const [mealPlan, setMealPlan] = useState("FULL_BOARD");
  const [halalCount, setHalalCount] = useState("0");
  const [vegetarianCount, setVegetarianCount] = useState("0");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await api.post("/services/catering", {
        groupId,
        mealPlan,
        halalCount: parseInt(halalCount, 10) || 0,
        vegetarianCount: parseInt(vegetarianCount, 10) || 0,
      });
      erpToast.success(lang === "bn" ? "ক্যাটারিং অনুরোধ জমা" : "Catering request submitted", lang);
      onCreated();
      onClose();
    } catch (e) {
      erpToast.error(errMsg(e, lang === "bn" ? "জমা ব্যর্থ" : "Submit failed"), lang);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ErpDrawer open={open} onClose={onClose} title={lang === "bn" ? "ক্যাটারিং অনুরোধ" : "Catering request"} lang={lang}
      footer={<ErpDrawerFooterActions lang={lang} onCancel={onClose} onSave={submit} saving={busy} saveLabel={lang === "bn" ? "জমা দিন" : "Submit"} />}>
      <ErpForm columns={2}>
        <ErpFormRow span={2}>
          <ErpField label={lang === "bn" ? "মিল প্ল্যান" : "Meal plan"}>
            <ErpSelect value={mealPlan} onChange={(e) => setMealPlan(e.target.value)}>
              <option value="BREAKFAST_ONLY">Breakfast only</option>
              <option value="HALF_BOARD">Half board</option>
              <option value="FULL_BOARD">Full board</option>
              <option value="PREMIUM">Premium</option>
            </ErpSelect>
          </ErpField>
        </ErpFormRow>
        <ErpField label={lang === "bn" ? "হালাল" : "Halal"}>
          <ErpInput type="number" value={halalCount} onChange={(e) => setHalalCount(e.target.value)} />
        </ErpField>
        <ErpField label={lang === "bn" ? "ভেজিটেরিয়ান" : "Vegetarian"}>
          <ErpInput type="number" value={vegetarianCount} onChange={(e) => setVegetarianCount(e.target.value)} />
        </ErpField>
      </ErpForm>
    </ErpDrawer>
  );
}

function GroupDocumentsTab({ groupId, live }: { groupId: string; live: boolean }) {
  const { lang } = useLang();
  const [rows, setRows] = useState<VoucherRow[] | null>(null);
  const [loading, setLoading] = useState(live);
  const [error, setError] = useState(false);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const PAGE = 20;

  const load = () => {
    if (!isLoggedIn() || !groupId) { setLoading(false); return; }
    setLoading(true); setError(false);
    api.get<VoucherRow[]>(`/vouchers?groupId=${encodeURIComponent(groupId)}`)
      .then((r) => { setRows(r); setError(false); })
      .catch(() => { setRows(null); setError(true); })
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, live]);

  if (!live) return <ModuleNotConfigured title={lang === "bn" ? "ডকুমেন্টস" : "Documents"} />;

  const list = rows ?? [];
  const filtered = list.filter((r) => {
    const qq = q.trim().toLowerCase();
    if (!qq) return true;
    return [r.code, r.type, r.status].join(" ").toLowerCase().includes(qq);
  });
  const safePage = Math.min(page, Math.max(1, Math.ceil(filtered.length / PAGE)));
  const pageRows = filtered.slice((safePage - 1) * PAGE, safePage * PAGE);

  const download = async (fileId: string | null) => {
    if (!fileId) {
      erpToast.error(lang === "bn" ? "ফাইল নেই" : "No file", lang);
      return;
    }
    try {
      const url = await api.fileBlobUrl(fileId);
      window.open(url, "_blank");
    } catch (e) {
      erpToast.error(errMsg(e, lang === "bn" ? "ডাউনলোড ব্যর্থ" : "Download failed"), lang);
    }
  };

  const columns: ErpColumn<VoucherRow>[] = [
    { id: "code", header: lang === "bn" ? "কোড" : "Code", cell: (r) => <span className="text-[11px] font-mono" style={{ color: AGENT }}>{r.code}</span> },
    { id: "type", header: lang === "bn" ? "ধরন" : "Type", cell: (r) => r.type },
    { id: "st", header: lang === "bn" ? "স্ট্যাটাস" : "Status", cell: (r) => <ErpStatusChip status={svcStatusKind(r.status)} label={r.status} lang={lang} /> },
    { id: "date", header: lang === "bn" ? "ইস্যু" : "Issued", cell: (r) => fmtDate(r.issueDate) },
  ];

  return (
    <div className="p-4 md:p-5" style={{ fontFamily: fontFor(lang) }}>
      <ErpPageTemplate
        title={lang === "bn" ? "ডকুমেন্টস" : "Documents"}
        subtitle={lang === "bn" ? "গ্রুপ ভাউচার তালিকা" : "Group vouchers"}
        toolbar={
          <ErpSearchBar lang={lang} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} onClear={() => setQ("")}
            placeholder={lang === "bn" ? "কোড বা ধরন…" : "Code or type…"} />
        }
        footer={<ErpPagination page={safePage} pageSize={PAGE} total={filtered.length} onPageChange={setPage} lang={lang} />}
      >
        {error ? (
          <ErrorState tone="light" lang={lang} onRetry={load} />
        ) : (
          <ErpDataTable
            columns={columns}
            rows={loading ? [] : pageRows}
            rowKey={(r) => r.id}
            loading={loading}
            lang={lang}
            emptyTitle={lang === "bn" ? "কোনো ভাউচার নেই" : "No vouchers yet"}
            emptyHint={lang === "bn" ? "সাপ্লায়ার গ্রহণ/ইস্যু করলে ভাউচার এখানে আসবে।" : "Vouchers appear after supplier acceptance / issue."}
            rowActions={(r) => (
              <ErpButton size="sm" variant="ghost" icon={<Download size={13} />} disabled={!r.fileId} onClick={(e) => { e.stopPropagation(); void download(r.fileId); }}>
                {lang === "bn" ? "ডাউনলোড" : "Download"}
              </ErpButton>
            )}
          />
        )}
      </ErpPageTemplate>
    </div>
  );
}

function GroupTimelineTab({ groupId, live }: { groupId: string; live: boolean }) {
  const { lang } = useLang();
  const canAudit = hasPermission(P.ACCESS_AUDIT_LOGS);
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const PAGE = 20;

  const load = () => {
    if (!live || !canAudit || !groupId) return;
    setLoading(true); setError(false);
    api.get<{ items?: AuditRow[] } | AuditRow[]>(
      `/audit-logs?entityType=Group&entityId=${encodeURIComponent(groupId)}&pageSize=50`,
    )
      .then((res) => {
        const items = Array.isArray(res) ? res : (res.items ?? []);
        setRows(items);
        setError(false);
      })
      .catch(() => { setRows(null); setError(true); })
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, live, canAudit]);

  if (!live || !canAudit) {
    return <ModuleNotConfigured title={lang === "bn" ? "টাইমলাইন" : "Timeline"} />;
  }

  const list = rows ?? [];
  const filtered = list.filter((r) => {
    const qq = q.trim().toLowerCase();
    if (!qq) return true;
    return [r.action, r.module, r.entityType, r.actorLabel, r.actorUser?.name]
      .filter(Boolean).join(" ").toLowerCase().includes(qq);
  });
  const safePage = Math.min(page, Math.max(1, Math.ceil(filtered.length / PAGE)));
  const pageRows = filtered.slice((safePage - 1) * PAGE, safePage * PAGE);

  const columns: ErpColumn<AuditRow>[] = [
    { id: "when", header: lang === "bn" ? "সময়" : "When", cell: (r) => <span className="text-[11px]">{fmtDate(r.createdAt)} {fmtTime(r.createdAt)}</span> },
    { id: "act", header: lang === "bn" ? "অ্যাকশন" : "Action", cell: (r) => <span className="text-xs font-semibold">{r.action}</span> },
    { id: "mod", header: lang === "bn" ? "মডিউল" : "Module", cell: (r) => r.module },
    { id: "who", header: lang === "bn" ? "কে" : "Actor", cell: (r) => r.actorUser?.name ?? r.actorLabel ?? "—" },
  ];

  return (
    <div className="p-4 md:p-5" style={{ fontFamily: fontFor(lang) }}>
      <ErpPageTemplate
        title={lang === "bn" ? "টাইমলাইন" : "Timeline"}
        subtitle={lang === "bn" ? "অডিট লগ (Group entity)" : "Audit log (Group entity)"}
        toolbar={
          <ErpSearchBar lang={lang} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} onClear={() => setQ("")}
            placeholder={lang === "bn" ? "অ্যাকশন বা মডিউল…" : "Action or module…"} />
        }
        footer={<ErpPagination page={safePage} pageSize={PAGE} total={filtered.length} onPageChange={setPage} lang={lang} />}
      >
        {error ? (
          <ErrorState tone="light" lang={lang} onRetry={load} />
        ) : (
          <ErpDataTable
            columns={columns}
            rows={loading ? [] : pageRows}
            rowKey={(r) => r.id}
            loading={loading}
            lang={lang}
            emptyTitle={lang === "bn" ? "কোনো ইভেন্ট নেই" : "No audit events"}
            emptyHint={lang === "bn" ? "গ্রুপ পরিবর্তন হলে এখানে দেখা যাবে।" : "Group mutations appear here when audited."}
          />
        )}
      </ErpPageTemplate>
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

interface AgentTenantOpt { id: string; code: string; name: string }

/** Load agent companies for staff ownership (existing GET /companies or tenants from GET /groups). */
async function loadAgentTenants(): Promise<AgentTenantOpt[]> {
  try {
    const rows = await api.get<Array<{ id: string; code: string; name: string; type?: string }>>("/companies?type=AGENT");
    return rows.map((c) => ({ id: c.id, code: c.code, name: c.name }));
  } catch {
    try {
      const groups = await api.get<ApiGroup[]>("/groups");
      const map = new Map<string, AgentTenantOpt>();
      for (const g of groups) {
        const t = g.tenant;
        if (t?.id) map.set(t.id, { id: t.id, code: t.code, name: t.name });
      }
      return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      return [];
    }
  }
}

function GroupWizard({ onBack, onDone, onCreated }: {
  onBack: () => void; onDone: (g: GroupRec) => void; onCreated: () => void;
}) {
  const { lang } = useLang();
  const staff = isPlatformStaff(getStoredUser());
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
  /** Staff: agent company vs direct-customer booking (same POST /groups + tenantId). */
  const [ownership, setOwnership] = useState<"agent" | "direct">("agent");
  const [tenantId, setTenantId] = useState("");
  const [agentTenants, setAgentTenants] = useState<AgentTenantOpt[]>([]);
  /** Draft group created before passenger intake (needed for POST passengers / OCR / CSV). */
  const [draftGroup, setDraftGroup] = useState<GroupRec | null>(null);
  const [paxCount, setPaxCount] = useState(0);
  const [paxError, setPaxError] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [showOcr, setShowOcr] = useState(false);
  const [showCsv, setShowCsv] = useState(false);
  const [draftBusy, setDraftBusy] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) return;
    api.get<ApiUmrahCompany[]>("/services/umrah-companies")
      .then(setUmrahCompanies)
      .catch(() => setUmrahCompanies([]));
  }, []);

  useEffect(() => {
    if (!isLoggedIn() || !staff) return;
    loadAgentTenants()
      .then((rows) => {
        setAgentTenants(rows);
        if (rows[0] && !tenantId) setTenantId(rows[0].id);
      })
      .catch(() => setAgentTenants([]));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff]);

  const protoGroup: GroupRec = {
    id: "GRP-1446-2999", name: name || "New Group", dest,
    type: visaType ? VISA_TYPE_LABEL[VISA_UI_TO_ENUM[visaType]] : "—",
    pax: paxCount, status: "pending", depart: departDate || "—", ret: returnDate || "—",
    visa: 0, hotel: 0, transport: 0, catering: 0, created: "—", pkg,
    nusukGroupNumber: nusukGroupNumber || null, hajiWhatsapp: hajiWhatsapp || null,
  };
  const STEPS = lang === "bn"
    ? ["গ্রুপ তথ্য", "প্যাকেজ", "যাত্রী", "নিশ্চিত করুন"]
    : ["Group Info", "Package", "Passengers", "Confirm"];

  const refreshPaxCount = async (apiId: string) => {
    try {
      const ps = await api.get<ApiPassenger[]>(`/groups/${apiId}/passengers`);
      setPaxCount(ps.length);
      if (ps.length > 0) setPaxError(false);
    } catch {
      /* keep prior count */
    }
  };

  const buildCreateBody = () => {
    if (!visaType) return null;
    const cap = parseInt(maxCapacity, 10);
    return {
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
      ...(staff && tenantId ? { tenantId } : {}),
      ...(staff && ownership === "direct" ? { uploadedByLabel: "Direct Customer" } : {}),
    };
  };

  /** Create draft via existing POST /groups once — required before passenger APIs. */
  const ensureDraftGroup = async (): Promise<GroupRec | null> => {
    if (draftGroup?.apiId) return draftGroup;
    if (!isLoggedIn()) return protoGroup;
    if (!visaType) {
      erpToast.error(lang === "bn" ? "ভিসার ধরন নির্বাচন করুন" : "Select a visa type", lang);
      return null;
    }
    if (name.trim().length < 2) {
      erpToast.error(lang === "bn" ? "গ্রুপের নাম দিন (কমপক্ষে ২ অক্ষর)" : "Enter a group name (at least 2 characters)", lang);
      return null;
    }
    if (staff && !tenantId) {
      erpToast.error(lang === "bn" ? "এজেন্ট অথবা কোম্পানি নির্বাচন করুন" : "Select an agent company", lang);
      return null;
    }
    const waErr = validateWhatsappUx(visaType, hajiWhatsapp);
    if (waErr) {
      const waMsg = lang === "bn"
        ? "উমরাহ/হজ গ্রুপের জন্য হাজি হোয়াটসঅ্যাপ দিন (কমপক্ষে ৫ অক্ষর)।"
        : waErr;
      erpToast.error(waMsg, lang);
      setCreateError(waMsg);
      return null;
    }
    const body = buildCreateBody();
    if (!body) return null;
    const g = await api.post<ApiGroup>("/groups", body);
    const rec = toGroupRec(g);
    setDraftGroup(rec);
    return rec;
  };

  const goNextFrom2 = async () => {
    if (!visaType) return;
    if (!isLoggedIn()) { setStep(3); return; }
    setDraftBusy(true);
    setCreateError(null);
    try {
      const rec = await ensureDraftGroup();
      // null = validation/UX guard already toasted + setCreateError — do not overwrite.
      if (!rec) return;
      if (!rec.apiId) {
        setCreateError(lang === "bn" ? "গ্রুপ তৈরি করা যায়নি" : "Could not create the group");
        return;
      }
      await refreshPaxCount(rec.apiId);
      setStep(3);
    } catch (e) {
      setCreateError(errMsg(e, lang === "bn" ? "গ্রুপ তৈরি করা যায়নি" : "Could not create the group"));
    } finally {
      setDraftBusy(false);
    }
  };

  const openIntake = async (kind: "manual" | "ocr" | "csv") => {
    if (!isLoggedIn()) {
      erpToast.error(lang === "bn" ? "সাইন ইন করুন" : "Sign in to add passengers", lang);
      return;
    }
    setDraftBusy(true);
    try {
      const rec = await ensureDraftGroup();
      if (!rec?.apiId) {
        erpToast.error(lang === "bn" ? "গ্রুপ প্রস্তুত নয়" : "Group is not ready", lang);
        return;
      }
      if (kind === "manual") setShowManual(true);
      if (kind === "ocr") setShowOcr(true);
      if (kind === "csv") setShowCsv(true);
    } catch (e) {
      erpToast.error(errMsg(e, lang === "bn" ? "গ্রুপ তৈরি করা যায়নি" : "Could not create the group"), lang);
    } finally {
      setDraftBusy(false);
    }
  };

  const onPaxAdded = () => {
    if (draftGroup?.apiId) void refreshPaxCount(draftGroup.apiId);
    else setPaxCount((n) => n + 1);
    setPaxError(false);
  };

  const goNextFrom3 = () => {
    if (isLoggedIn() && paxCount < 1) {
      setPaxError(true);
      erpToast.error("কমপক্ষে ১ জন যাত্রী যোগ করুন।", lang);
      return;
    }
    setPaxError(false);
    setStep(4);
  };

  /** Confirm: draft already created on step 2→3; finish without inventing a second create. */
  const submit = async () => {
    if (!visaType) return;
    if (!isLoggedIn()) { onDone({ ...protoGroup, pax: paxCount }); return; }
    if (paxCount < 1) {
      setPaxError(true);
      setStep(3);
      erpToast.error("কমপক্ষে ১ জন যাত্রী যোগ করুন।", lang);
      return;
    }
    setSubmitting(true);
    setCreateError(null);
    try {
      let rec = draftGroup;
      if (!rec?.apiId) {
        rec = await ensureDraftGroup();
      }
      if (!rec?.apiId) {
        setCreateError(lang === "bn" ? "গ্রুপ তৈরি করা যায়নি" : "Could not create the group");
        return;
      }
      erpToast.success(lang === "bn" ? `গ্রুপ ${rec.id} প্রস্তুত` : `Group ${rec.id} ready`, lang);
      onCreated();
      onDone({ ...rec, pax: paxCount });
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
    if (isLoggedIn() && staff && !tenantId) {
      erpToast.error(lang === "bn" ? "এজেন্ট অথবা কোম্পানি নির্বাচন করুন" : "Select an agent company", lang);
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
            {staff && (
              <div className="rounded-xl p-3 mb-1" style={{ backgroundColor: "#FBFCFD", border: "1px solid rgba(11,30,63,0.10)" }}>
                <div className="text-[11px] font-semibold mb-2" style={{ color: "rgba(11,30,63,0.55)" }}>
                  {lang === "bn" ? "মালিকানা (স্টাফ)" : "Ownership (staff)"}
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                  <ErpButton size="sm" variant={ownership === "agent" ? "primary" : "outline"} onClick={() => setOwnership("agent")}>
                    {lang === "bn" ? "এজেন্ট" : "Agent"}
                  </ErpButton>
                  <ErpButton size="sm" variant={ownership === "direct" ? "primary" : "outline"} onClick={() => setOwnership("direct")}>
                    {lang === "bn" ? "ডাইরেক্ট কাস্টমার" : "Direct Customer"}
                  </ErpButton>
                </div>
                <ErpField label={lang === "bn" ? "এজেন্ট / কোম্পানি" : "Agent / company"} required>
                  <ErpSelect value={tenantId} onChange={(e) => setTenantId(e.target.value)} disabled={!!draftGroup?.apiId}>
                    <option value="">—</option>
                    {agentTenants.map((a) => (
                      <option key={a.id} value={a.id}>{a.name} ({a.code})</option>
                    ))}
                  </ErpSelect>
                </ErpField>
                {ownership === "direct" && (
                  <p className="text-[11px] mt-2" style={{ color: "rgba(11,30,63,0.50)" }}>
                    {lang === "bn"
                      ? "ডাইরেক্ট কাস্টমার — নির্বাচিত কোম্পানির অধীনে তৈরি (uploadedByLabel = Direct Customer)।"
                      : "Direct customer booking under the selected company account (uploadedByLabel = Direct Customer)."}
                  </p>
                )}
              </div>
            )}
            <ErpForm columns={2}>
              <ErpFormRow span={2}>
                <ErpField label={lang === "bn" ? "গ্রুপের নাম" : "Group Name"} required>
                  <ErpInput value={name} onChange={(e) => setName(e.target.value)} placeholder={lang === "bn" ? "গ্রুপের নাম লিখুন" : "Group name"} disabled={!!draftGroup?.apiId} />
                </ErpField>
              </ErpFormRow>
              <ErpField label={lang === "bn" ? "নুসুক গ্রুপ নম্বর" : "Nusuk Group Number"}>
                <ErpInput value={nusukGroupNumber} onChange={(e) => setNusukGroupNumber(e.target.value)} style={{ fontFamily: "var(--font-mono)" }} disabled={!!draftGroup?.apiId} />
              </ErpField>
              <ErpField label={lang === "bn" ? "গন্তব্য" : "Destination"}>
                <ErpSelect value={dest} onChange={(e) => setDest(e.target.value)} disabled={!!draftGroup?.apiId}>
                  <option value="Makkah">Makkah</option>
                  <option value="Madinah">Madinah</option>
                  <option value="Makkah + Madinah">Makkah + Madinah</option>
                </ErpSelect>
              </ErpField>
              <ErpField label={lang === "bn" ? "কনস্যুলেট" : "Consulate"}>
                <ErpInput value={consulate} onChange={(e) => setConsulate(e.target.value)} disabled={!!draftGroup?.apiId} />
              </ErpField>
              <ErpField label={lang === "bn" ? "উমরাহ কোম্পানি" : "Umrah Company"}>
                <ErpSelect value={umrahCompanyId} onChange={(e) => setUmrahCompanyId(e.target.value)} disabled={!!draftGroup?.apiId}>
                  <option value="">—</option>
                  {umrahCompanies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                  ))}
                </ErpSelect>
              </ErpField>
              <ErpField label={lang === "bn" ? "হাজি হোয়াটসঅ্যাপ" : "Haji WhatsApp"}>
                <ErpInput value={hajiWhatsapp} onChange={(e) => setHajiWhatsapp(e.target.value)} placeholder="+966… / +880…" disabled={!!draftGroup?.apiId} />
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
            {createError && step === 2 && (
              <div className="mt-4"><ErrorState tone="light" lang={lang} message={createError} onRetry={() => void goNextFrom2()} /></div>
            )}
            <div className="flex gap-2 mt-5">
              <ErpButton variant="secondary" onClick={() => setStep(1)} disabled={draftBusy}>{lang === "bn" ? "পিছনে" : "Back"}</ErpButton>
              <ErpButton
                variant="primary"
                disabled={!visaType || draftBusy}
                loading={draftBusy}
                onClick={() => void goNextFrom2()}
              >
                {lang === "bn" ? "পরবর্তী: যাত্রী →" : "Next: Passengers →"}
              </ErpButton>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="rounded-xl p-5 md:p-6" style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(11,30,63,0.11)" }}>
            <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
              <div>
                <h2 className="text-base font-bold text-[#0B1E3F]">{lang === "bn" ? "৩ · যাত্রী" : "3 · Passengers"}</h2>
                <p className="text-sm mt-1" style={{ color: "rgba(11,30,63,0.58)" }}>
                  {lang === "bn"
                    ? "ম্যানুয়াল, পাসপোর্ট OCR অথবা Excel/CSV দিয়ে যাত্রী যোগ করুন।"
                    : "Add passengers via Manual, Passport OCR, or Excel/CSV."}
                </p>
              </div>
              <div
                className="rounded-xl px-3 py-2 text-center min-w-[88px]"
                style={{ backgroundColor: paxCount > 0 ? "#16A34A12" : "#F5F7FA", border: `1px solid ${paxCount > 0 ? "#16A34A40" : "rgba(11,30,63,0.11)"}` }}
              >
                <div className="text-lg font-bold tabular-nums" style={{ fontFamily: "var(--font-mono)", color: paxCount > 0 ? "#16A34A" : NAVY }}>{paxCount}</div>
                <div className="text-[10px]" style={{ color: "rgba(11,30,63,0.55)" }}>{lang === "bn" ? "যাত্রী" : "Passengers"}</div>
              </div>
            </div>
            {draftGroup?.id && (
              <p className="text-[11px] mb-3 font-mono" style={{ color: "rgba(11,30,63,0.45)" }}>
                {draftGroup.id}
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              {([
                { kind: "manual" as const, icon: Users, titleBn: "ম্যানুয়াল", titleEn: "Manual" },
                { kind: "ocr" as const, icon: ScanLine, titleBn: "পাসপোর্ট OCR", titleEn: "Passport OCR" },
                { kind: "csv" as const, icon: FileText, titleBn: "CSV ইমপোর্ট", titleEn: "CSV Import" },
              ]).map((m) => {
                const Icon = m.icon;
                return (
                  <button
                    key={m.kind}
                    type="button"
                    disabled={draftBusy}
                    onClick={() => void openIntake(m.kind)}
                    className="rounded-xl p-4 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
                    style={{ border: `1px solid ${AGENT}40`, backgroundColor: `${AGENT}08`, outlineColor: GOLD }}
                  >
                    <Icon size={18} style={{ color: AGENT }} className="mb-2" />
                    <div className="text-xs font-bold text-[#0B1E3F]">{lang === "bn" ? m.titleBn : m.titleEn}</div>
                  </button>
                );
              })}
            </div>
            {paxError && (
              <div className="mb-3 text-xs font-medium" style={{ color: "#DC2626" }} role="alert">
                কমপক্ষে ১ জন যাত্রী যোগ করুন।
              </div>
            )}
            <div className="flex gap-2">
              <ErpButton variant="secondary" onClick={() => setStep(2)}>{lang === "bn" ? "পিছনে" : "Back"}</ErpButton>
              <ErpButton
                variant="primary"
                disabled={isLoggedIn() && paxCount < 1}
                onClick={goNextFrom3}
              >
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
                [lang === "bn" ? "যাত্রী" : "Passengers", String(paxCount)],
                ...(staff ? [[lang === "bn" ? "মালিকানা" : "Ownership", ownership === "direct" ? (lang === "bn" ? "ডাইরেক্ট কাস্টমার" : "Direct Customer") : (lang === "bn" ? "এজেন্ট" : "Agent")]] : []),
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
              <ErpButton variant="primary" loading={submitting} onClick={() => void submit()} disabled={isLoggedIn() && paxCount < 1}>
                {lang === "bn" ? "নিশ্চিত করে তৈরি করুন" : "Confirm & Create"}
              </ErpButton>
            </div>
          </div>
        )}
      </div>

      {draftGroup?.apiId && (
        <>
          <ManualPassengerDrawer
            groupId={draftGroup.apiId}
            open={showManual}
            onClose={() => setShowManual(false)}
            onAdded={onPaxAdded}
          />
          {showOcr && (
            <OcrIntakeModal
              groupId={draftGroup.apiId}
              onClose={() => setShowOcr(false)}
              onApproved={onPaxAdded}
            />
          )}
          {showCsv && (
            <CsvImportModal
              groupId={draftGroup.apiId}
              onClose={() => setShowCsv(false)}
              onImported={onPaxAdded}
            />
          )}
        </>
      )}
    </div>
  );
}

/** Staff Ops / Agent Portal — same create wizard, existing POST /groups contract. */
export function GroupCreateWizard(props: {
  onBack: () => void; onDone: (g: GroupRec) => void; onCreated: () => void;
}) {
  return <GroupWizard {...props} />;
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

  const groupApiId = group.apiId ?? "";

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
    { id: "passengers", label: "Passengers", icon: Users },
    { id: "flights",    label: "Flights",    icon: Plane },
    { id: "hotel",      label: "Hotel",      icon: Building },
    { id: "transport",  label: "Transport",  icon: Bus },
    { id: "catering",   label: "Catering",   icon: UtensilsCrossed },
    { id: "documents",  label: "Documents",  icon: FileText },
    { id: "timeline",   label: "Timeline",   icon: Clock },
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
          <GroupFlightsTab
            flights={detail?.flightInfos ?? []}
            loading={loading}
            error={error}
            onRetry={refresh}
            live={live}
          />
        )}

        {tab === "hotel" && (
          live && groupApiId
            ? <GroupServiceTab groupId={groupApiId} service="hotel" titleBn="হোটেল" titleEn="Hotel" />
            : <ModuleNotConfigured title={lang === "bn" ? "হোটেল" : "Hotel"} />
        )}

        {tab === "transport" && (
          live && groupApiId
            ? <GroupServiceTab groupId={groupApiId} service="transport" titleBn="ট্রান্সপোর্ট" titleEn="Transport" />
            : <ModuleNotConfigured title={lang === "bn" ? "ট্রান্সপোর্ট" : "Transport"} />
        )}

        {tab === "catering" && (
          live && groupApiId
            ? <GroupServiceTab groupId={groupApiId} service="catering" titleBn="ক্যাটারিং" titleEn="Catering" />
            : <ModuleNotConfigured title={lang === "bn" ? "ক্যাটারিং" : "Catering"} />
        )}

        {tab === "documents" && <GroupDocumentsTab groupId={groupApiId} live={live && !!groupApiId} />}

        {tab === "timeline" && <GroupTimelineTab groupId={groupApiId} live={live && !!groupApiId} />}

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
