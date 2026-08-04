import { useState, useEffect, type ReactNode, type CSSProperties } from "react";
import {
  Users, Hash, Map, MapPin, Calendar, Radio,
  PlaneLanding, PlaneTakeoff, Truck, Bus, Car,
  CheckCircle, AlertTriangle, FileText, Download, Printer,
  MessageCircle, Mail, Search, RefreshCw, Plus,
  Eye, ChevronRight, Check, Zap, Navigation,
} from "lucide-react";
import { ERPShell, type NavItem, type IconFC } from "../components/ERPShell";
import { EmptyState, LoadingSkeleton, ErrorState } from "../components/States";
import {
  ErpPageTemplate, ErpButton, ErpSearchBar, ErpFilterPanel, ErpDataTable,
  ErpPagination, ErpDrawer, ErpDrawerFooterActions, ErpForm, ErpFormRow, ErpField,
  ErpInput, ErpSelect, ErpTextarea, ErpStatusChip, erpToast, type ErpColumn, type ErpStatusKind,
} from "../components/erp";
import { api, ApiError, isLoggedIn } from "../lib/api";
import { useLang } from "../lib/LangContext";
import { fontFor } from "@tuba/shared";
import { useShellTab } from "../lib/shellTab";
import {
  GATE_BOARD_COLS,
  GATE_LABELS,
  PKG_LABEL,
  VISA_TYPE_LABEL,
  formatNusuk,
  gateSummary,
  gatesFromApi,
  singleGatePatch,
  type GateKey,
  type GateState,
} from "../lib/group-foundation";
import { useOpsEvents } from "../lib/opsSocket";
import { toast } from "sonner";
import { GroupCreateWizard } from "./AgentPortalGroups";

// ─── Module constants ─────────────────────────────────────────────────────────

const OPS = "#DC4E2A";
const CR_BG = "#F5F7FA";      // control-room near-black
const CR_SURFACE = "#F5F7FA"; // slightly lighter surface

// ─── Types ────────────────────────────────────────────────────────────────────

type ArrivalStatus   = "SCHEDULED"|"DELAYED"|"LANDING"|"AT_GATE"|"IMMIGRATION"|"BAGGAGE"|"EN_ROUTE"|"DELIVERED";
type DepartureStatus = "SCHEDULED"|"STANDBY"|"CHECK_IN"|"BOARDING"|"DEPARTED"|"DELAYED";
type DispatchStatus  = "ASSIGNED"|"EN_ROUTE"|"COMPLETED"|"DELAYED";
type BRNStatus       = "OPEN"|"PROCESSING"|"FULFILLED"|"CANCELLED";
type OpsView = "groups"|"arrivals"|"departures"|"dispatch"|"maassist"|"ziyarah"|"longstay"|"brn"|"vouchers";

interface FlightRec {
  id: string; flight: string; airline: string; route: string;
  eta: string; pax: number; group: string; agent: string;
  vehicle: string; driver: string; status: ArrivalStatus;
}
interface DepRec {
  id: string; flight: string; airline: string; route: string;
  dep: string; pax: number; group: string; agent: string;
  vehicle: string; driver: string; status: DepartureStatus;
}
interface DispatchOrder {
  id: string; code?: string; vehicle: string; driver: string; pax: number;
  route: string; group: string; time: string; status: DispatchStatus; note?: string;
}
interface GroupRec {
  id: string; agent: string; pax: number; hotel: string; city: string;
  dates: string; visa: string; opsStatus: string;
  /** Real uuid when live (needed for PATCH). */
  apiId?: string;
  name?: string | null;
  nusukGroupNumber?: string | null;
  visaType?: string | null;
  packageType?: string | null;
  hajiWhatsapp?: string | null;
  consulate?: string | null;
  umrahCompanyId?: string | null;
  umrahCompanyName?: string | null;
  uploadedBy?: string | null;
  gates?: GateState;
}

interface ApiUmrahCompany {
  id: string; code: string; name: string;
}
interface BRNRec {
  id: string; realId?: string; group: string; agent: string; service: string;
  created: string; status: BRNStatus; detail: string;
}

// ─── API row types + live mappers ─────────────────────────────────────────────

interface ApiGroup {
  id: string; code: string; agent: string; pax: number; hotel: string; city: string;
  dates: string; visa: string; opsStatus: string;
  name?: string | null;
  nusukGroupNumber?: string | null;
  visaType?: string | null;
  packageType?: string | null;
  hajiWhatsapp?: string | null;
  consulate?: string | null;
  umrahCompanyId?: string | null;
  umrahCompany?: { id: string; code: string; name: string } | null;
  uploadedByLabel?: string | null;
  gateVisa?: boolean;
  gatePackage?: boolean;
  gatePayment?: boolean;
  gateBill?: boolean;
}
interface ApiFlight {
  id: string; code: string; flight: string; airline: string; route: string; time: string;
  terminal: string | null; gate: string | null; pax: number; group: string | null; agent: string | null;
  vehicle: string | null; driver: string | null; dispatchStatus: string | null; status: string;
}
interface ApiDispatch { id: string; code: string; vehicle: string; driver: string; pax: number; route: string; group: string | null; time: string; status: string; progressPct: number; note: string | null; }
interface ApiZiyarah { id: string; code: string; group: string | null; date: string; sites: string; guide: string | null; vehicle: string; pax: number; status: string; }
interface ApiLongStay {
  id: string; code: string; group: string | null; groupVisaType?: string | null;
  hotel: string; city: string; nights: number; checkIn: string; checkOut: string;
  pax: number; renewal: string; status: string;
  hostName?: string | null; hostIqama?: string | null; hostWhatsapp?: string | null;
  hostRelation?: string | null; absher?: string | null;
  entryDate?: string | null; exitDate?: string | null;
  hostComplete?: boolean;
  day85?: Day85View | null;
}
/** T002-08 — derived compliance view served by /ops/long-stays (read-only). */
interface Day85View {
  stage: "NOT_TRACKED" | "TRACKING" | "APPROACHING" | "DUE" | "ESCALATED" | "RESOLVED";
  dayCount: number | null;
  dueAt: string | null;
  daysToDue: number | null;
  redCard: boolean;
  resolved: boolean;
  resolvedBy: string | null;
  notifiedAt: string | null;
}
const DAY85_C: Record<string, string> = {
  NOT_TRACKED: "rgba(11,30,63,0.40)",
  TRACKING: "rgba(11,30,63,0.55)",
  APPROACHING: "#B45309",
  DUE: "#DC2626",
  ESCALATED: "#991B1B",
  RESOLVED: "#16A34A",
};
const day85Label = (d?: Day85View | null) => {
  if (!d || d.stage === "NOT_TRACKED") return "—";
  if (d.stage === "RESOLVED") return "RESOLVED";
  return `D${d.dayCount ?? 0} · ${d.stage}`;
};
interface ApiBrn { id: string; code: string; group: string | null; agent: string | null; service: string; created: string; status: string; detail: string | null; priority: string; }
interface MAStep { stepNo: number; done: boolean; completedAt: string | null; }
interface ApiMeetAssist { flightInfoId: string; code: string; steps: MAStep[]; }

const fmtClock = (iso: string) => { const d = new Date(iso); return isNaN(d.getTime()) ? iso : d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }); };
const fmtDay = (iso: string) => { const d = new Date(iso); return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); };
const fmtDayShort = (iso: string) => { const d = new Date(iso); return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }); };

const toGroupRec = (g: ApiGroup): GroupRec => ({
  id: g.code,
  apiId: g.id,
  agent: g.agent,
  pax: g.pax,
  hotel: g.hotel,
  city: g.city,
  dates: g.dates,
  visa: g.visa,
  opsStatus: g.opsStatus,
  name: g.name ?? null,
  nusukGroupNumber: g.nusukGroupNumber ?? null,
  visaType: g.visaType ?? null,
  packageType: g.packageType ?? null,
  hajiWhatsapp: g.hajiWhatsapp ?? null,
  consulate: g.consulate ?? null,
  umrahCompanyId: g.umrahCompanyId ?? null,
  umrahCompanyName: g.umrahCompany?.name ?? null,
  uploadedBy: g.uploadedByLabel ?? null,
  gates: gatesFromApi(g),
});
const toArrivalRec = (f: ApiFlight): FlightRec => ({ id: f.id, flight: f.flight, airline: f.airline, route: f.route, eta: fmtClock(f.time), pax: f.pax, group: f.group ?? "—", agent: f.agent ?? "—", vehicle: f.vehicle ?? "—", driver: f.driver ?? "—", status: f.status as ArrivalStatus });
const toDepartureRec = (f: ApiFlight): DepRec => ({ id: f.id, flight: f.flight, airline: f.airline, route: f.route, dep: fmtClock(f.time), pax: f.pax, group: f.group ?? "—", agent: f.agent ?? "—", vehicle: f.vehicle ?? "—", driver: f.driver ?? "—", status: f.status as DepartureStatus });
const toDispatchRec = (d: ApiDispatch): DispatchOrder => ({ id: d.id, code: d.code, vehicle: d.vehicle, driver: d.driver, pax: d.pax, route: d.route, group: d.group ?? "—", time: fmtClock(d.time), status: d.status as DispatchStatus, note: d.note ?? undefined });
const RENEWAL_LABEL: Record<string, string> = { NONE: "N/A", REQUESTED: "Requested", APPROVED: "Approved" };

/** Group <option> list for create forms: real DB id as value when live, else mock code. */
function groupOptions(apiGroups: ApiGroup[] | null): { value: string; label: string }[] {
  // Signed-in ops users must never see mock group options — only the live list
  // (empty while it loads). The GROUPS fallback is the signed-out demo only.
  if (!isLoggedIn())
    return GROUPS.map((g) => ({ value: g.id, label: `${g.id} — ${g.agent}` }));
  return (apiGroups ?? []).map((g) => ({ value: g.id, label: `${g.code} — ${g.agent}` }));
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const GROUPS: GroupRec[] = [
  { id:"GRP-1446-2891", agent:"Rashidi Travel Co.",    pax:47, hotel:"Jabal Omar Hyatt",    city:"Makkah",  dates:"15 Aug – 29 Aug 2025", visa:"Ready",      opsStatus:"ACTIVE" },
  { id:"GRP-1446-2744", agent:"Al-Noor Pilgrim Svc",  pax:32, hotel:"Makkah Towers",        city:"Makkah",  dates:"22 Aug – 05 Sep 2025", visa:"Ready",      opsStatus:"ACTIVE" },
  { id:"GRP-1446-3102", agent:"Zamzam Pilgrim Svc",   pax:52, hotel:"Movenpick Hajar",      city:"Makkah",  dates:"12 Aug – 26 Aug 2025", visa:"Ready",      opsStatus:"ACTIVE" },
  { id:"GRP-1446-2990", agent:"Crown Hajj Tours",     pax:38, hotel:"Conrad Makkah",        city:"Makkah",  dates:"20 Aug – 03 Sep 2025", visa:"Pending",    opsStatus:"DELAYED" },
  { id:"GRP-1446-2612", agent:"Makkah Tours Co.",     pax:19, hotel:"Intercontinental MED", city:"Madinah", dates:"01 Sep – 15 Sep 2025", visa:"Ready",      opsStatus:"UPCOMING" },
  { id:"GRP-1446-3201", agent:"Baraka Travel",        pax:22, hotel:"Fairmont Makkah",      city:"Makkah",  dates:"01 Sep – 15 Sep 2025", visa:"In Process", opsStatus:"UPCOMING" },
  { id:"GRP-1446-2401", agent:"Rashidi Travel Co.",   pax:64, hotel:"Marriott Makkah",      city:"Makkah",  dates:"01 Jul – 15 Jul 2025", visa:"Ready",      opsStatus:"COMPLETED" },
  { id:"GRP-1446-2203", agent:"Al-Noor Pilgrim Svc",  pax:28, hotel:"Hilton Madinah",       city:"Madinah", dates:"10 Jun – 24 Jun 2025", visa:"Ready",      opsStatus:"COMPLETED" },
];

const ARRIVALS: FlightRec[] = [
  { id:"ARR-001", flight:"SV 101",  airline:"Saudia",     route:"JED → MKK", eta:"08:30", pax:47, group:"GRP-1446-2891", agent:"Rashidi Travel",  vehicle:"BUS B-12", driver:"Ahmad Saleh",    status:"AT_GATE" },
  { id:"ARR-002", flight:"SV 205",  airline:"Saudia",     route:"CAI → JED", eta:"09:15", pax:32, group:"GRP-1446-2744", agent:"Al-Noor Pilgrim", vehicle:"BUS B-07", driver:"Hassan Mahmoud", status:"EN_ROUTE" },
  { id:"ARR-003", flight:"EK 801",  airline:"Emirates",   route:"DXB → JED", eta:"10:00", pax:64, group:"GRP-1446-2401", agent:"Rashidi Travel",  vehicle:"BUS B-03", driver:"Yusuf Amir",     status:"IMMIGRATION" },
  { id:"ARR-004", flight:"QR 421",  airline:"Qatar",      route:"DOH → MED", eta:"10:45", pax:52, group:"GRP-1446-3102", agent:"Zamzam Pilgrim",  vehicle:"BUS B-11", driver:"Khalid Omar",    status:"LANDING" },
  { id:"ARR-005", flight:"MS 961",  airline:"EgyptAir",   route:"CAI → MED", eta:"12:00", pax:19, group:"GRP-1446-2612", agent:"Makkah Tours",    vehicle:"—",        driver:"—",              status:"SCHEDULED" },
  { id:"ARR-006", flight:"TK 082",  airline:"Turkish",    route:"IST → JED", eta:"14:30", pax:38, group:"GRP-1446-2990", agent:"Crown Hajj",      vehicle:"—",        driver:"—",              status:"DELAYED" },
  { id:"ARR-007", flight:"GF 021",  airline:"GulfAir",    route:"BAH → JED", eta:"15:00", pax:22, group:"GRP-1446-3201", agent:"Baraka Travel",   vehicle:"—",        driver:"—",              status:"SCHEDULED" },
  { id:"ARR-008", flight:"SV 334",  airline:"Saudia",     route:"RUH → JED", eta:"07:15", pax:28, group:"GRP-1446-2203", agent:"Al-Noor Pilgrim", vehicle:"BUS B-09", driver:"Faisal Hamad",   status:"DELIVERED" },
];

const DEPARTURES: DepRec[] = [
  { id:"DEP-001", flight:"SV 102",  airline:"Saudia",   route:"MKK → JED", dep:"16:30", pax:47, group:"GRP-1446-2891", agent:"Rashidi Travel",  vehicle:"BUS B-12", driver:"Ahmad Saleh",    status:"CHECK_IN" },
  { id:"DEP-002", flight:"QR 422",  airline:"Qatar",    route:"JED → DOH", dep:"18:00", pax:52, group:"GRP-1446-3102", agent:"Zamzam Pilgrim",  vehicle:"BUS B-11", driver:"Khalid Omar",    status:"STANDBY" },
  { id:"DEP-003", flight:"EK 802",  airline:"Emirates", route:"JED → DXB", dep:"19:45", pax:64, group:"GRP-1446-2401", agent:"Rashidi Travel",  vehicle:"—",        driver:"—",              status:"SCHEDULED" },
  { id:"DEP-004", flight:"SV 336",  airline:"Saudia",   route:"MED → RUH", dep:"20:15", pax:28, group:"GRP-1446-2203", agent:"Al-Noor Pilgrim", vehicle:"BUS B-09", driver:"Faisal Hamad",   status:"SCHEDULED" },
  { id:"DEP-005", flight:"TK 083",  airline:"Turkish",  route:"JED → IST", dep:"23:30", pax:38, group:"GRP-1446-2990", agent:"Crown Hajj",      vehicle:"—",        driver:"—",              status:"DELAYED" },
  { id:"DEP-006", flight:"MS 962",  airline:"EgyptAir", route:"MED → CAI", dep:"22:00", pax:19, group:"GRP-1446-2612", agent:"Makkah Tours",    vehicle:"—",        driver:"—",              status:"SCHEDULED" },
];

const DISPATCHES: DispatchOrder[] = [
  { id:"DSP-0441", vehicle:"BUS B-12", driver:"Ahmad Saleh",    pax:47, route:"King Abdulaziz Int'l → Jabal Omar Hyatt",    group:"GRP-1446-2891", time:"08:00", status:"ASSIGNED" },
  { id:"DSP-0437", vehicle:"BUS B-07", driver:"Hassan Mahmoud", pax:32, route:"KAIA Terminal 1 → Makkah Towers",            group:"GRP-1446-2744", time:"09:15", status:"ASSIGNED" },
  { id:"DSP-0435", vehicle:"VAN H-03", driver:"Tariq Ibrahim",  pax:22, route:"Hotel Jabal Omar → Masjid al-Haram Ziyarah", group:"GRP-1446-2891", time:"07:30", status:"ASSIGNED" },
  { id:"DSP-0429", vehicle:"BUS B-03", driver:"Yusuf Amir",     pax:64, route:"Marriott Makkah → KAIA Terminal 2",          group:"GRP-1446-2401", time:"15:30", status:"EN_ROUTE" },
  { id:"DSP-0428", vehicle:"BUS B-11", driver:"Khalid Omar",    pax:52, route:"KAIA Terminal 3 → Movenpick Hajar",          group:"GRP-1446-3102", time:"10:00", status:"EN_ROUTE" },
  { id:"DSP-0427", vehicle:"VAN H-07", driver:"Bilal Hassan",   pax:18, route:"Conrad Makkah → Mina Station",              group:"GRP-1446-2990", time:"06:00", status:"EN_ROUTE" },
  { id:"DSP-0424", vehicle:"BUS B-09", driver:"Faisal Hamad",   pax:28, route:"KAIA → Hilton Madinah",                    group:"GRP-1446-2203", time:"05:30", status:"EN_ROUTE" },
  { id:"DSP-0422", vehicle:"BUS B-05", driver:"Sami Qureshi",   pax:48, route:"KAIA → Marriott Makkah",                   group:"GRP-1446-2401", time:"Yesterday", status:"COMPLETED" },
  { id:"DSP-0419", vehicle:"BUS B-02", driver:"Omar Farouq",    pax:36, route:"Hotel Fairmont → KAIA T1",                  group:"GRP-1446-3201", time:"Yesterday", status:"COMPLETED" },
  { id:"DSP-0418", vehicle:"VAN H-12", driver:"Nabil Hussain",  pax:20, route:"Ziyarah — Sites of Makkah",                group:"GRP-1446-2744", time:"Yesterday", status:"COMPLETED" },
  { id:"DSP-0416", vehicle:"BUS B-08", driver:"Rami Tawfiq",    pax:55, route:"KAIA → Conrad Makkah",                     group:"GRP-1446-2990", time:"Yesterday", status:"COMPLETED" },
  { id:"DSP-0431", vehicle:"BUS B-06", driver:"Zaid Karimi",    pax:40, route:"Hotel Movenpick → KAIA T2",                group:"GRP-1446-3102", time:"09:00", status:"DELAYED",  note:"Vehicle breakdown — replacement dispatched" },
  { id:"DSP-0433", vehicle:"BUS B-10", driver:"Wael Nassar",    pax:29, route:"KAIA Med → Intercontinental MED",          group:"GRP-1446-2612", time:"10:30", status:"DELAYED",  note:"Heavy traffic on Ring Road — ETA +45 min" },
];

const BRNS: BRNRec[] = [
  { id:"BRN-1446-0091", group:"GRP-1446-2891", agent:"Rashidi Travel",  service:"Hotel + Transport + Meet&Assist", created:"10 Jul 2025", status:"PROCESSING", detail:"Hotel: Jabal Omar 14N, Bus ×2, M&A JED" },
  { id:"BRN-1446-0087", group:"GRP-1446-2744", agent:"Al-Noor Pilgrim", service:"Hotel + Transport",               created:"08 Jul 2025", status:"FULFILLED",  detail:"Hotel: Makkah Towers 14N, Bus ×1" },
  { id:"BRN-1446-0082", group:"GRP-1446-2612", agent:"Makkah Tours",    service:"Hotel + Transport + Catering",    created:"05 Jul 2025", status:"OPEN",       detail:"Intercontinental MED 14N, Bus ×1, FB" },
  { id:"BRN-1446-0079", group:"GRP-1446-3102", agent:"Zamzam Pilgrim",  service:"Full Package",                    created:"02 Jul 2025", status:"PROCESSING", detail:"Movenpick 14N, Bus ×2, FB, M&A JED" },
  { id:"BRN-1446-0071", group:"GRP-1446-2990", agent:"Crown Hajj",      service:"Hotel + Ziyarah",                 created:"28 Jun 2025", status:"OPEN",       detail:"Conrad Makkah 14N, Ziyarah ×3" },
  { id:"BRN-1446-0063", group:"GRP-1446-2401", agent:"Rashidi Travel",  service:"Full Package",                    created:"15 Jun 2025", status:"FULFILLED",  detail:"Marriott 14N, Bus ×3, FB, M&A" },
];

// ─── Sidebar nav ──────────────────────────────────────────────────────────────

const OPS_NAV: NavItem[] = [
  { id:"groups",     label:"Group Master",      labelBn:"গ্রুপ মাস্টার",     icon: Users as IconFC,        badge: 8 },
  { id:"arrivals",   label:"Arrival Board",     labelBn:"আগমন বোর্ড",        icon: PlaneLanding as IconFC, badge: 3 },
  { id:"departures", label:"Departure Board",   labelBn:"প্রস্থান বোর্ড",    icon: PlaneTakeoff as IconFC },
  { id:"dispatch",   label:"Dispatch Board",    labelBn:"ডিসপ্যাচ বোর্ড",    icon: Navigation as IconFC,   badge: 2 },
  { id:"maassist",   label:"Meet & Assist",     labelBn:"মিট অ্যান্ড অ্যাসিস্ট", icon: Users as IconFC },
  { id:"ziyarah",    label:"Ziyarah",           labelBn:"জিয়ারাত",          icon: Map as IconFC },
  { id:"longstay",   label:"Long Stay",         labelBn:"লং স্টে",           icon: Calendar as IconFC },
  { id:"brn",        label:"BRN Management",    labelBn:"বিআরএন",            icon: Hash as IconFC },
  // Voucher Generator has no Ops API yet — reachable only via ?tab=vouchers (honest empty state).
];

const OPS_TAB_IDS = [
  "groups", "arrivals", "departures", "dispatch", "maassist",
  "ziyarah", "longstay", "brn", "vouchers",
] as const;

const SCREEN_LABELS: Record<string, string> = {
  groups:"Group Master", arrivals:"Arrival Board", departures:"Departure Board",
  dispatch:"Dispatch Board", maassist:"Meet & Assist", ziyarah:"Ziyarah",
  longstay:"Long Stay", brn:"BRN Management", vouchers:"Voucher Generator",
};

// ─── Shared helpers ───────────────────────────────────────────────────────────

// Traffic-light status maps
const ARR_STAT: Record<ArrivalStatus,{ bg:string; color:string; label:string }> = {
  SCHEDULED:  { bg:"#1F293780", color:"#9CA3AF", label:"SCHEDULED"   },
  DELAYED:    { bg:"#78350F",   color:"#B45309", label:"⚠  DELAYED"  },
  LANDING:    { bg:"#164E63",   color:"#22D3EE", label:"LANDING"     },
  AT_GATE:    { bg:"#7C2D12",   color:"#FB923C", label:"AT GATE"     },
  IMMIGRATION:{ bg:"#3B0764",   color:"#C084FC", label:"IMMIGRATION" },
  BAGGAGE:    { bg:"#1E1B4B",   color:"#818CF8", label:"BAGGAGE"     },
  EN_ROUTE:   { bg:"#14532D",   color:"#16A34A", label:"▶ EN ROUTE"  },
  DELIVERED:  { bg:"#064E3B40", color:"#059669", label:"✓ DELIVERED" },
};

const DEP_STAT: Record<DepartureStatus,{ bg:string; color:string; label:string }> = {
  SCHEDULED:{ bg:"#1F293780", color:"#9CA3AF", label:"SCHEDULED"    },
  DELAYED:  { bg:"#78350F",   color:"#B45309", label:"⚠  DELAYED"  },
  STANDBY:  { bg:"#1E3A5F",   color:"#2563EB", label:"STANDBY"     },
  CHECK_IN: { bg:"#065F46",   color:"#34D399", label:"CHECK-IN"    },
  BOARDING: { bg:"#7C3AED",   color:"#C084FC", label:"BOARDING"    },
  DEPARTED: { bg:"#064E3B40", color:"#059669", label:"✓ DEPARTED"  },
};

const DSP_STAT: Record<DispatchStatus,{ bg:string; color:string; header:string }> = {
  ASSIGNED:  { bg:"#1E3A5F", color:"#2563EB", header:"ASSIGNED"  },
  EN_ROUTE:  { bg:"#14532D", color:"#16A34A", header:"EN ROUTE"  },
  COMPLETED: { bg:"#064E3B", color:"#059669", header:"COMPLETED" },
  DELAYED:   { bg:"#78350F", color:"#B45309", header:"DELAYED"   },
};

const BRN_STAT: Record<BRNStatus,{ bg:string; color:string }> = {
  OPEN:       { bg:"#1E3A5F18", color:"#2563EB" },
  PROCESSING: { bg:"#D9770618", color:"#B45309" },
  FULFILLED:  { bg:"#14532D18", color:"#16A34A" },
  CANCELLED:  { bg:"#7F1D1D18", color:"#DC2626" },
};

// ─── Live-feed state ──────────────────────────────────────────────────────────
// Logged OUT → demo mode: boards keep rendering their mock rows (unchanged).
// Logged IN  → loading / error / empty / data. A failed /ops fetch must NEVER
// fall through to the mock boards — a controller would work a fabricated shift.
type FeedState = "loading" | "error" | "ready";

/** Full-width board cell that keeps the board's column layout intact. */
function BoardState({ cols, demo, state, onRetry, title, hint }: {
  cols:number; demo:boolean; state:FeedState; onRetry:() => void; title:string; hint?:string;
}) {
  return (
    <tr>
      <td colSpan={cols} className="px-5 py-4">
        {!demo && state === "loading" ? <LoadingSkeleton tone="light" rows={5} />
          : !demo && state === "error" ? <ErrorState tone="light" onRetry={onRetry} />
          : <EmptyState tone="light" title={title} hint={hint} />}
      </td>
    </tr>
  );
}

function BStat({ s, map }: { s: string; map: Record<string, { bg:string; color:string; label?:string }> }) {
  const v = map[s] ?? map.SCHEDULED;
  return (
    <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-[11px] font-black tracking-[0.14em] uppercase whitespace-nowrap"
          style={{ backgroundColor: v.bg, color: v.color }}>
      {"label" in v ? v.label as string : s}
    </span>
  );
}

function OpsKPI({ label, value, color, icon: Icon, sub }: { label:string; value:string|number; color:string; icon:typeof Users; sub?:string }) {
  return (
    <div className="rounded-2xl p-5" style={{ backgroundColor: "#FBFCFD", border:"1px solid rgba(11,30,63,0.11)" }}>
      <div className="flex items-start justify-between mb-4">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor:`${color}18` }}>
          <Icon size={16} style={{ color }} />
        </div>
      </div>
      <div className="text-2xl font-black text-[#0B1E3F] mb-1" style={{ fontFamily:"var(--font-mono)" }}>{value}</div>
      <div className="text-xs font-semibold" style={{ color:"rgba(11,30,63,0.66)" }}>{label}</div>
      {sub && <div className="text-[9px] mt-0.5" style={{ color:"rgba(11,30,63,0.50)" }}>{sub}</div>}
    </div>
  );
}

function LiveBadge({ time, live = true }: { time: string; live?: boolean }) {
  const [pulse, setPulse] = useState(true);
  useEffect(() => {
    const t = setInterval(() => setPulse((p) => !p), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ backgroundColor:"rgba(34,197,94,0.1)", border:"1px solid rgba(34,197,94,0.25)", opacity: live ? 1 : 0.4 }}>
      <span className="w-2 h-2 rounded-full transition-opacity duration-500" style={{ backgroundColor:"#22C55E", opacity: live ? (pulse ? 1 : 0.3) : 0.3 }} />
      <span className="text-[10px] font-black tracking-widest uppercase" style={{ color:"#22C55E" }}>LIVE</span>
      <span className="text-[10px] font-mono" style={{ color:"rgba(11,30,63,0.58)", fontFamily:"var(--font-mono)" }}>{time}</span>
    </div>
  );
}

// ─── 1. Group Master ──────────────────────────────────────────────────────────

/** T001-09 — Excel-like readiness cell; staff toggles via PATCH /groups/:id. */
function GateBoardCell({
  group,
  gateKey,
  checked,
  busy,
  onToggle,
  compactLabel,
}: {
  group: GroupRec;
  gateKey: GateKey;
  checked: boolean;
  busy: boolean;
  onToggle: (group: GroupRec, key: GateKey, next: boolean) => void;
  /** When set, render inline (for ErpDataTable) instead of a bare `<td>`. */
  compactLabel?: string;
}) {
  const col = GATE_BOARD_COLS.find((c) => c.key === gateKey)!;
  const control = (
    <label
      className="inline-flex flex-col items-center justify-center gap-0.5 w-9 h-9 rounded-lg cursor-pointer"
      title={`${col.title} — ${checked ? "Ready" : "Open"} · ${gateSummary(group.gates ?? gatesFromApi(null))}`}
      style={{
        backgroundColor: checked ? "#16A34A18" : "#EEF1F6",
        opacity: busy ? 0.5 : 1,
      }}
    >
      {compactLabel && (
        <span className="text-[8px] font-bold leading-none" style={{ color: checked ? "#16A34A" : "rgba(11,30,63,0.45)" }}>
          {compactLabel}
        </span>
      )}
      <input
        type="checkbox"
        className="w-3.5 h-3.5 accent-[#16A34A]"
        checked={checked}
        disabled={busy || (!group.apiId && !!isLoggedIn())}
        onChange={(e) => onToggle(group, gateKey, e.target.checked)}
        aria-label={`${col.title} for ${group.id}`}
      />
    </label>
  );
  if (compactLabel !== undefined) return control;
  return <td className="px-2 py-3 text-center">{control}</td>;
}

/** Staff edit of T001 foundation fields via existing PATCH /groups/:id — ErpDrawer. */
function OpsGroupFoundationDrawer({
  group,
  open,
  onClose,
  onSaved,
}: {
  group: GroupRec | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { lang } = useLang();
  const [nusuk, setNusuk] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [consulate, setConsulate] = useState("");
  const [umrahCompanyId, setUmrahCompanyId] = useState("");
  const [umrahCompanies, setUmrahCompanies] = useState<ApiUmrahCompany[]>([]);
  const [gates, setGates] = useState<GateState>(gatesFromApi(null));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!group) return;
    setNusuk(group.nusukGroupNumber ?? "");
    setWhatsapp(group.hajiWhatsapp ?? "");
    setConsulate(group.consulate ?? "");
    setUmrahCompanyId(group.umrahCompanyId ?? "");
    setGates(group.gates ?? gatesFromApi(null));
  }, [group]);

  useEffect(() => {
    if (!open) return;
    api.get<ApiUmrahCompany[]>("/services/umrah-companies")
      .then(setUmrahCompanies)
      .catch(() => setUmrahCompanies([]));
  }, [open]);

  const save = async () => {
    if (!group?.apiId) {
      erpToast.error(lang === "bn" ? "ডেমো সারি — লাইভ গ্রুপ সম্পাদনায় সাইন ইন করুন" : "Demo row — sign in to edit live groups", lang);
      return;
    }
    setSaving(true);
    try {
      await api.patch(`/groups/${group.apiId}`, {
        nusukGroupNumber: nusuk.trim() || null,
        hajiWhatsapp: whatsapp.trim() || null,
        consulate: consulate.trim() || null,
        umrahCompanyId: umrahCompanyId.trim() || null,
        ...gates,
      });
      erpToast.success(lang === "bn" ? `গ্রুপ ${group.id} আপডেট হয়েছে` : `Group ${group.id} foundation updated`, lang);
      onSaved();
      onClose();
    } catch (e) {
      erpToast.error(e instanceof ApiError ? e.message : (lang === "bn" ? "আপডেট ব্যর্থ" : "Could not update group"), lang);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ErpDrawer
      open={open && !!group}
      onClose={onClose}
      title={lang === "bn" ? "গ্রুপ ফাউন্ডেশন" : "Group Foundation"}
      subtitle={group ? `${group.id}${group.name ? ` · ${group.name}` : ""}` : undefined}
      lang={lang}
      footer={
        <ErpDrawerFooterActions
          lang={lang}
          onCancel={onClose}
          onSave={save}
          saving={saving}
          saveLabel={lang === "bn" ? "সংরক্ষণ" : "Save"}
        />
      }
    >
      <ErpForm columns={1}>
        <ErpField label={lang === "bn" ? "নুসুক গ্রুপ নম্বর" : "Nusuk Group Number"}>
          <ErpInput value={nusuk} onChange={(e) => setNusuk(e.target.value)} style={{ fontFamily: "var(--font-mono)" }} />
        </ErpField>
        <ErpField label={lang === "bn" ? "হাজি হোয়াটসঅ্যাপ" : "Haji WhatsApp"}>
          <ErpInput value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
        </ErpField>
        <ErpField label={lang === "bn" ? "কনস্যুলেট" : "Consulate"}>
          <ErpInput value={consulate} onChange={(e) => setConsulate(e.target.value)} />
        </ErpField>
        <ErpField label={lang === "bn" ? "উমরাহ কোম্পানি" : "Umrah Company"}>
          <ErpSelect value={umrahCompanyId} onChange={(e) => setUmrahCompanyId(e.target.value)}>
            <option value="">{lang === "bn" ? "— নেই —" : "— None —"}</option>
            {umrahCompanies.map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
            ))}
          </ErpSelect>
        </ErpField>
        <ErpField label={lang === "bn" ? "প্রস্তুতি গেট" : "Readiness"}>
          <div className="grid grid-cols-2 gap-2">
            {GATE_LABELS.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 text-xs text-[#0B1E3F]">
                <input
                  type="checkbox"
                  checked={gates[key]}
                  onChange={(e) => setGates((prev) => ({ ...prev, [key]: e.target.checked }))}
                />
                {label}
              </label>
            ))}
          </div>
        </ErpField>
      </ErpForm>
    </ErpDrawer>
  );
}

function opsStatusKind(status: string): ErpStatusKind {
  if (status === "ACTIVE") return "approved";
  if (status === "DELAYED") return "warning";
  if (status === "UPCOMING") return "info";
  if (status === "COMPLETED") return "completed";
  return "pending";
}

function GroupMaster({ apiGroups, demo, state, onRetry }: { apiGroups: ApiGroup[] | null; demo: boolean; state: FeedState; onRetry: () => void }) {
  const { lang } = useLang();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [edit, setEdit] = useState<GroupRec | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  /** Optimistic gate overrides keyed by apiId|code */
  const [gateLocal, setGateLocal] = useState<Record<string, GateState>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const PAGE = 20;

  if (showWizard) {
    return (
      <GroupCreateWizard
        onBack={() => setShowWizard(false)}
        onCreated={onRetry}
        onDone={() => { setShowWizard(false); onRetry(); }}
      />
    );
  }

  const source = demo ? GROUPS : (apiGroups ?? []).map(toGroupRec);
  const ready = demo || state === "ready";
  const filtered = source.filter((g) => {
    const qq = q.toLowerCase();
    const match =
      g.id.toLowerCase().includes(qq) ||
      g.agent.toLowerCase().includes(qq) ||
      (g.name ?? "").toLowerCase().includes(qq) ||
      (g.nusukGroupNumber ?? "").toLowerCase().includes(qq);
    return match && (filter === "ALL" || g.opsStatus === filter);
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const safePage = Math.min(page, totalPages);
  const pageRows = ready ? filtered.slice((safePage - 1) * PAGE, safePage * PAGE) : [];

  const rowKey = (g: GroupRec) => g.apiId ?? g.id;
  const gatesOf = (g: GroupRec): GateState => gateLocal[rowKey(g)] ?? g.gates ?? gatesFromApi(null);

  const toggleGate = async (group: GroupRec, key: GateKey, next: boolean) => {
    if (demo || !group.apiId) {
      erpToast.error(lang === "bn" ? "ডেমো সারি — সাইন ইন করুন" : "Demo row — sign in to toggle live readiness gates", lang);
      return;
    }
    const rk = rowKey(group);
    const prev = gatesOf(group);
    const optimistic = { ...prev, [key]: next };
    setGateLocal((m) => ({ ...m, [rk]: optimistic }));
    setBusyKey(`${rk}:${key}`);
    try {
      await api.patch(`/groups/${group.apiId}`, singleGatePatch(key, next));
      erpToast.success(`${GATE_BOARD_COLS.find((c) => c.key === key)?.title ?? key} → ${next ? "Ready" : "Open"}`, lang);
      onRetry();
    } catch (e) {
      setGateLocal((m) => ({ ...m, [rk]: prev }));
      erpToast.error(e instanceof ApiError ? e.message : (lang === "bn" ? "গেট আপডেট ব্যর্থ" : "Could not update gate"), lang);
    } finally {
      setBusyKey(null);
    }
  };

  const columns: ErpColumn<GroupRec>[] = [
    {
      id: "id",
      header: lang === "bn" ? "গ্রুপ" : "Group",
      cell: (g) => (
        <div>
          <div className="text-[11px] font-bold" style={{ color: OPS, fontFamily: "var(--font-mono)" }}>{g.id}</div>
          <div className="text-[10px]" style={{ fontFamily: "var(--font-mono)", color: "rgba(11,30,63,0.50)" }}>{formatNusuk(g.nusukGroupNumber)}</div>
        </div>
      ),
    },
    {
      id: "name",
      header: lang === "bn" ? "নাম / এজেন্ট" : "Name / Agent",
      cell: (g) => (
        <div>
          <div className="text-xs font-semibold truncate max-w-[140px]" title={g.name ?? ""}>{g.name?.trim() || "—"}</div>
          <div className="text-[10px] truncate max-w-[140px]" style={{ color: "rgba(11,30,63,0.50)" }} title={g.agent}>{g.agent}</div>
        </div>
      ),
    },
    {
      id: "pkg",
      header: lang === "bn" ? "প্যাকেজ" : "Package",
      cell: (g) => (
        <div className="text-[11px]">
          <div>{VISA_TYPE_LABEL[g.visaType ?? ""] ?? g.visaType ?? "—"}</div>
          <div style={{ color: "rgba(11,30,63,0.50)" }}>{PKG_LABEL[g.packageType ?? ""] ?? g.packageType ?? "—"}</div>
        </div>
      ),
    },
    {
      id: "pax",
      header: lang === "bn" ? "যাত্রী" : "Pax",
      align: "center",
      cell: (g) => <span className="text-sm font-bold tabular-nums" style={{ fontFamily: "var(--font-mono)" }}>{g.pax}</span>,
    },
    {
      id: "gates",
      header: lang === "bn" ? "গেট" : "Gates",
      cell: (g) => {
        const gates = gatesOf(g);
        return (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {GATE_BOARD_COLS.map(({ key, short }) => (
              <GateBoardCell
                key={key}
                group={g}
                gateKey={key}
                checked={gates[key]}
                busy={busyKey === `${rowKey(g)}:${key}`}
                onToggle={toggleGate}
                compactLabel={short}
              />
            ))}
          </div>
        );
      },
    },
    {
      id: "ops",
      header: lang === "bn" ? "অপস" : "Ops",
      cell: (g) => <ErpStatusChip status={opsStatusKind(g.opsStatus)} label={g.opsStatus} lang={lang} />,
    },
  ];

  if (!demo && state === "error") {
    return (
      <div className="p-7" style={{ fontFamily: fontFor(lang) }}>
        <ErrorState tone="light" lang={lang} onRetry={onRetry} />
      </div>
    );
  }

  return (
    <div style={{ fontFamily: fontFor(lang) }}>
      <ErpPageTemplate
        title={lang === "bn" ? "গ্রুপ মাস্টার" : "Group Master"}
        subtitle={lang === "bn" ? "সিজন ১৪৪৬হি · প্রস্তুতি বোর্ড" : "Season 1446H · Readiness board"}
        primaryAction={
          <div className="flex flex-wrap gap-2">
            <ErpButton variant="secondary" icon={<RefreshCw size={14} />} onClick={onRetry}>
              {lang === "bn" ? "রিফ্রেশ" : "Refresh"}
            </ErpButton>
            <ErpButton variant="primary" icon={<Plus size={14} />} onClick={() => setShowWizard(true)} disabled={demo}>
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
                  ? "নাম, পাসপোর্ট নম্বর অথবা গ্রুপ নম্বর লিখুন"
                  : "Search by name, passport, or group number"}
              />
            </div>
            <ErpFilterPanel
              open={filtersOpen}
              onOpenChange={setFiltersOpen}
              lang={lang}
              activeCount={filter === "ALL" ? 0 : 1}
            >
              <div className="flex flex-wrap gap-2">
                {["ALL", "ACTIVE", "DELAYED", "UPCOMING", "COMPLETED"].map((f) => (
                  <ErpButton
                    key={f}
                    size="sm"
                    variant={filter === f ? "primary" : "outline"}
                    onClick={() => { setFilter(f); setPage(1); }}
                  >
                    {f === "ALL" ? (lang === "bn" ? "সব" : "All") : f}
                  </ErpButton>
                ))}
              </div>
            </ErpFilterPanel>
          </div>
        }
        footer={
          <ErpPagination page={safePage} pageSize={PAGE} total={filtered.length} onPageChange={setPage} lang={lang} />
        }
      >
        <ErpDataTable
          columns={columns}
          rows={!ready || state === "loading" ? [] : pageRows}
          rowKey={rowKey}
          loading={!ready || state === "loading"}
          lang={lang}
          selectable
          selectedKeys={selected}
          onSelectedKeysChange={setSelected}
          onRowClick={(g) => setEdit(g)}
          emptyTitle={lang === "bn" ? "কোনো তথ্য পাওয়া যায়নি" : (source.length === 0 ? "No groups this season" : "No matching groups")}
          emptyHint={lang === "bn" ? "এজেন্ট বুকিং জমা দিলে গ্রুপ এখানে দেখা যাবে।" : "Groups appear once agents submit bookings."}
          emptyAction={
            !demo ? (
              <ErpButton variant="primary" icon={<Plus size={14} />} onClick={() => setShowWizard(true)}>
                {lang === "bn" ? "নতুন তৈরি করুন" : "Create new"}
              </ErpButton>
            ) : undefined
          }
          rowActions={(g) => (
            <ErpButton size="sm" variant="ghost" icon={<Eye size={13} />} onClick={(e) => { e.stopPropagation(); setEdit(g); }}>
              {lang === "bn" ? "সম্পাদনা" : "Edit"}
            </ErpButton>
          )}
        />
      </ErpPageTemplate>

      <OpsGroupFoundationDrawer
        group={edit}
        open={!!edit}
        onClose={() => setEdit(null)}
        onSaved={onRetry}
      />
    </div>
  );
}

// ─── 2. Arrival Board ─────────────────────────────────────────────────────────

function ArrivalBoard({ rows, connected, onRefresh, demo, state }: { rows: FlightRec[] | null; connected: boolean; onRefresh: () => void; demo: boolean; state: FeedState }) {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString("en-GB", { hour12:false }));
  const [busyId, setBusyId] = useState<string | null>(null);
  useEffect(() => {
    const t = setInterval(() => setTime(new Date().toLocaleTimeString("en-GB", { hour12:false })), 1000);
    return () => clearInterval(t);
  }, []);

  const data = demo ? ARRIVALS : (rows ?? []);
  const ready = demo || state === "ready";
  const active = (s: ArrivalStatus) => ["AT_GATE","LANDING","EN_ROUTE","IMMIGRATION","BAGGAGE"].includes(s);
  const ARRIVAL_OPTS: ArrivalStatus[] = ["SCHEDULED", "DELAYED", "LANDING", "AT_GATE", "IMMIGRATION", "BAGGAGE", "EN_ROUTE", "DELIVERED"];

  const setFlightStatus = async (id: string, status: ArrivalStatus) => {
    if (demo) return;
    setBusyId(id);
    try {
      await api.patch(`/ops/flights/${id}/status`, { status });
      erpToast.success(`Flight → ${status}`);
      onRefresh();
    } catch (e) {
      erpToast.error(e instanceof ApiError ? e.message : "Status update failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={{ backgroundColor:CR_BG, minHeight:"100%" }}>
      {/* Board header */}
      <div className="flex items-center justify-between px-8 py-4" style={{ borderBottom:"1px solid rgba(11,30,63,0.11)", backgroundColor:CR_SURFACE }}>
        <div className="flex items-center gap-4">
          <PlaneLanding size={20} style={{ color:OPS }} />
          <div>
            <div className="text-lg font-black text-[#0B1E3F] tracking-wide">ARRIVALS</div>
            <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color:"rgba(11,30,63,0.58)" }}>Season 1446H · Ground Handling</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-3 text-[10px] font-bold">
            {[["ACTIVE",data.filter((a)=>active(a.status)).length,"#FB923C"],
              ["DELAYED",data.filter((a)=>a.status==="DELAYED").length,"#B45309"],
              ["DELIVERED",data.filter((a)=>a.status==="DELIVERED").length,"#16A34A"]].map(([l,n,c])=>(
              <span key={l as string} className="px-3 py-1 rounded-lg whitespace-nowrap" style={{ backgroundColor:`${c as string}18`, color:c as string }}>
                {l} <span className="font-black tabular-nums" style={{ fontFamily:"var(--font-mono)" }}>{ready ? (n as number) : "—"}</span>
              </span>
            ))}
          </div>
          <LiveBadge time={time} live={connected} />
          <button onClick={onRefresh} className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor:"#F5F7FA" }}>
            <RefreshCw size={13} style={{ color:"rgba(11,30,63,0.66)" }} />
          </button>
        </div>
      </div>

      {/* Board table */}
      <table className="w-full">
        <thead>
          <tr style={{ backgroundColor:"#FFFFFF", borderBottom:"1px solid rgba(11,30,63,0.11)" }}>
            {["FLIGHT","AIRLINE","ROUTE","ETA","PAX","GROUP / AGENT","VEHICLE · DRIVER","STATUS"].map((c,i) => (
              <th key={c} className={`px-5 py-3 text-left text-[9px] font-black tracking-[0.15em] uppercase ${i===3||i===4?"text-center":""}`}
                  style={{ color:"rgba(11,30,63,0.50)" }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ready && data.map((a) => {
            const s = ARR_STAT[a.status];
            const isActive = active(a.status);
            const isDelay  = a.status === "DELAYED";
            const isDone   = a.status === "DELIVERED";
            return (
              <tr key={a.id}
                  style={{ borderBottom:"1px solid rgba(11,30,63,0.08)", borderLeft:`3px solid ${isActive ? s.color : isDelay ? "#B45309" : "transparent"}`, opacity: isDone ? 0.55 : 1 }}
                  className="hover:bg-white/2">
                <td className="px-5 py-4">
                  <span className="text-xl font-black tracking-wide whitespace-nowrap" style={{ color:"#0B1E3F", fontFamily:"var(--font-mono)" }}>{a.flight}</span>
                </td>
                <td className="px-5 py-4 text-xs font-bold" style={{ color:"rgba(11,30,63,0.76)" }}><div className="truncate max-w-[10rem]" title={a.airline}>{a.airline}</div></td>
                <td className="px-5 py-4 text-sm font-bold text-[#0B1E3F] whitespace-nowrap">{a.route}</td>
                <td className="px-5 py-4 text-center">
                  <span className="text-xl font-black whitespace-nowrap tabular-nums" style={{ color: isDelay ? "#B45309" : "#0B1E3F", fontFamily:"var(--font-mono)" }}>{a.eta}</span>
                  {isDelay && <div className="text-[9px] font-bold mt-0.5" style={{ color:"#B45309" }}>DELAYED</div>}
                </td>
                <td className="px-5 py-4 text-center">
                  <span className="text-3xl font-black tabular-nums" style={{ color:"#0B1E3F", fontFamily:"var(--font-mono)" }}>{a.pax}</span>
                </td>
                <td className="px-5 py-4">
                  <div className="text-[10px] font-black truncate max-w-[13rem]" title={a.group} style={{ color:OPS, fontFamily:"var(--font-mono)" }}>{a.group}</div>
                  <div className="text-xs text-[#0B1E3F] mt-0.5 truncate max-w-[13rem]" title={a.agent}>{a.agent}</div>
                </td>
                <td className="px-5 py-4">
                  {a.vehicle !== "—" ? (
                    <>
                      <div className="text-xs font-black text-[#0B1E3F] truncate max-w-[11rem]" title={a.vehicle}>{a.vehicle}</div>
                      <div className="text-[10px] mt-0.5 truncate max-w-[11rem]" title={a.driver} style={{ color:"rgba(11,30,63,0.66)" }}>{a.driver}</div>
                    </>
                  ) : (
                    <span className="text-xs whitespace-nowrap" style={{ color:"rgba(11,30,63,0.38)" }}>Not Assigned</span>
                  )}
                </td>
                <td className="px-5 py-4">
                  {demo ? (
                    <BStat s={a.status} map={ARR_STAT} />
                  ) : (
                    <select
                      value={a.status}
                      disabled={busyId === a.id}
                      onChange={(e) => void setFlightStatus(a.id, e.target.value as ArrivalStatus)}
                      className="px-2 py-1.5 rounded-lg text-[10px] font-bold focus:outline-none"
                      style={{ backgroundColor: ARR_STAT[a.status]?.bg ?? "#F5F7FA", color: ARR_STAT[a.status]?.color ?? "#0B1E3F", border: "1px solid rgba(11,30,63,0.15)" }}
                    >
                      {ARRIVAL_OPTS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  )}
                </td>
              </tr>
            );
          })}
          {(!ready || data.length === 0) && (
            <BoardState cols={8} demo={demo} state={state} onRetry={onRefresh}
              title="No arrivals today" hint="Scheduled inbound flights appear here." />
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── 3. Departure Board ───────────────────────────────────────────────────────

function DepartureBoard({ rows, connected, demo, state, onRefresh }: { rows: DepRec[] | null; connected: boolean; demo: boolean; state: FeedState; onRefresh: () => void }) {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString("en-GB", { hour12:false }));
  const [busyId, setBusyId] = useState<string | null>(null);
  useEffect(() => {
    const t = setInterval(() => setTime(new Date().toLocaleTimeString("en-GB", { hour12:false })), 1000);
    return () => clearInterval(t);
  }, []);

  const data = demo ? DEPARTURES : (rows ?? []);
  const ready = demo || state === "ready";
  const DEP_OPTS: DepartureStatus[] = ["SCHEDULED", "STANDBY", "CHECK_IN", "BOARDING", "DEPARTED", "DELAYED"];

  const setFlightStatus = async (id: string, status: DepartureStatus) => {
    if (demo) return;
    setBusyId(id);
    try {
      await api.patch(`/ops/flights/${id}/status`, { status });
      erpToast.success(`Flight → ${status}`);
      onRefresh();
    } catch (e) {
      erpToast.error(e instanceof ApiError ? e.message : "Status update failed");
    } finally {
      setBusyId(null);
    }
  };
  return (
    <div style={{ backgroundColor:CR_BG, minHeight:"100%" }}>
      <div className="flex items-center justify-between px-8 py-4" style={{ borderBottom:"1px solid rgba(11,30,63,0.11)", backgroundColor:CR_SURFACE }}>
        <div className="flex items-center gap-4">
          <PlaneTakeoff size={20} style={{ color:"#2563EB" }} />
          <div>
            <div className="text-lg font-black text-[#0B1E3F] tracking-wide">DEPARTURES</div>
            <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color:"rgba(11,30,63,0.58)" }}>Season 1446H · Outbound Transfer</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-3 text-[10px] font-bold">
            {[["CHECK-IN", data.filter(d=>d.status==="CHECK_IN").length,"#34D399"],
              ["DELAYED",  data.filter(d=>d.status==="DELAYED").length, "#B45309"],
              ["SCHEDULED",data.filter(d=>d.status==="SCHEDULED").length,"#9CA3AF"]].map(([l,n,c])=>(
              <span key={l as string} className="px-3 py-1 rounded-lg whitespace-nowrap" style={{ backgroundColor:`${c as string}18`, color:c as string }}>
                {l} <span className="font-black tabular-nums" style={{ fontFamily:"var(--font-mono)" }}>{ready ? (n as number) : "—"}</span>
              </span>
            ))}
          </div>
          <LiveBadge time={time} live={connected} />
        </div>
      </div>

      <table className="w-full">
        <thead>
          <tr style={{ backgroundColor:"#FFFFFF", borderBottom:"1px solid rgba(11,30,63,0.11)" }}>
            {["FLIGHT","AIRLINE","ROUTE","DEP","PAX","GROUP / AGENT","VEHICLE · DRIVER","STATUS"].map((c,i) => (
              <th key={c} className={`px-5 py-3 text-left text-[9px] font-black tracking-[0.15em] uppercase ${i===3||i===4?"text-center":""}`}
                  style={{ color:"rgba(11,30,63,0.50)" }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ready && data.map((d) => {
            const s = DEP_STAT[d.status];
            const isActive = ["CHECK_IN","BOARDING"].includes(d.status);
            const isDelay  = d.status === "DELAYED";
            const isDone   = d.status === "DEPARTED";
            return (
              <tr key={d.id}
                  style={{ borderBottom:"1px solid rgba(11,30,63,0.08)", borderLeft:`3px solid ${isActive ? s.color : isDelay ? "#B45309" : "transparent"}`, opacity: isDone ? 0.55 : 1 }}
                  className="hover:bg-white/2">
                <td className="px-5 py-4">
                  <span className="text-xl font-black tracking-wide whitespace-nowrap" style={{ color:"#0B1E3F", fontFamily:"var(--font-mono)" }}>{d.flight}</span>
                </td>
                <td className="px-5 py-4 text-xs font-bold" style={{ color:"rgba(11,30,63,0.76)" }}><div className="truncate max-w-[10rem]" title={d.airline}>{d.airline}</div></td>
                <td className="px-5 py-4 text-sm font-bold text-[#0B1E3F] whitespace-nowrap">{d.route}</td>
                <td className="px-5 py-4 text-center">
                  <span className="text-xl font-black whitespace-nowrap tabular-nums" style={{ color: isDelay ? "#B45309" : "#0B1E3F", fontFamily:"var(--font-mono)" }}>{d.dep}</span>
                </td>
                <td className="px-5 py-4 text-center">
                  <span className="text-3xl font-black tabular-nums" style={{ color:"#0B1E3F", fontFamily:"var(--font-mono)" }}>{d.pax}</span>
                </td>
                <td className="px-5 py-4">
                  <div className="text-[10px] font-black truncate max-w-[13rem]" title={d.group} style={{ color:OPS, fontFamily:"var(--font-mono)" }}>{d.group}</div>
                  <div className="text-xs text-[#0B1E3F] mt-0.5 truncate max-w-[13rem]" title={d.agent}>{d.agent}</div>
                </td>
                <td className="px-5 py-4">
                  {d.vehicle !== "—" ? (
                    <><div className="text-xs font-black text-[#0B1E3F] truncate max-w-[11rem]" title={d.vehicle}>{d.vehicle}</div>
                    <div className="text-[10px] mt-0.5 truncate max-w-[11rem]" title={d.driver} style={{ color:"rgba(11,30,63,0.66)" }}>{d.driver}</div></>
                  ) : (
                    <span className="text-xs whitespace-nowrap" style={{ color:"rgba(11,30,63,0.38)" }}>Not Assigned</span>
                  )}
                </td>
                <td className="px-5 py-4">
                  {demo ? (
                    <BStat s={d.status} map={DEP_STAT} />
                  ) : (
                    <select
                      value={d.status}
                      disabled={busyId === d.id}
                      onChange={(e) => void setFlightStatus(d.id, e.target.value as DepartureStatus)}
                      className="px-2 py-1.5 rounded-lg text-[10px] font-bold focus:outline-none"
                      style={{ backgroundColor: DEP_STAT[d.status]?.bg ?? "#F5F7FA", color: DEP_STAT[d.status]?.color ?? "#0B1E3F", border: "1px solid rgba(11,30,63,0.15)" }}
                    >
                      {DEP_OPTS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  )}
                </td>
              </tr>
            );
          })}
          {(!ready || data.length === 0) && (
            <BoardState cols={8} demo={demo} state={state} onRetry={onRefresh}
              title="No departures today" hint="Scheduled outbound transfers appear here." />
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── 4. Dispatch Board (Kanban) ───────────────────────────────────────────────

// Minimal create form for "+ New Dispatch" (frozen board keeps its own layout).
function NewDispatchModal({ apiGroups, onClose, onCreated }: { apiGroups: ApiGroup[] | null; onClose: () => void; onCreated: () => void }) {
  const opts = groupOptions(apiGroups);
  const [groupId, setGroupId] = useState(opts[0]?.value ?? "");
  const [routeFrom, setRouteFrom] = useState("");
  const [routeTo, setRouteTo] = useState("");
  const [pax, setPax] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [busy, setBusy] = useState(false);
  const IS = { backgroundColor:"#F5F7FA", border:"1px solid rgba(11,30,63,0.15)", color:"#0B1E3F" } as CSSProperties;

  const submit = async () => {
    if (!groupId || !routeFrom.trim() || !routeTo.trim() || !scheduledAt) { toast.error("Group, route and scheduled time are required."); return; }
    setBusy(true);
    try {
      const row = await api.post<ApiDispatch>("/ops/dispatches", {
        groupId, routeFrom: routeFrom.trim(), routeTo: routeTo.trim(),
        pax: Number(pax) || 0, scheduledAt: new Date(scheduledAt).toISOString(),
      });
      toast.success(`Dispatch ${row.code} created`);
      onCreated();
      onClose();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not create dispatch");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ backgroundColor:"rgba(3,4,10,0.8)" }} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl p-6" style={{ backgroundColor:CR_SURFACE, border:`1px solid ${OPS}30` }} onClick={(e)=>e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div className="text-sm font-bold text-[#0B1E3F]">New Dispatch</div>
          <button onClick={onClose} className="text-xs font-bold" style={{ color:"rgba(11,30,63,0.58)" }}>✕</button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-[9px] font-black uppercase tracking-widest block mb-1.5" style={{ color:"rgba(11,30,63,0.50)" }}>Group</label>
            <select value={groupId} onChange={(e)=>setGroupId(e.target.value)} className="w-full px-3 py-2.5 text-xs rounded-xl focus:outline-none appearance-none" style={IS}>
              {opts.map((o)=><option key={o.value} value={o.value} style={{ color:"black" }}>{o.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest block mb-1.5" style={{ color:"rgba(11,30,63,0.50)" }}>Route From</label>
              <input value={routeFrom} onChange={(e)=>setRouteFrom(e.target.value)} placeholder="KAIA Terminal 1" className="w-full px-3 py-2.5 text-xs rounded-xl focus:outline-none" style={IS} />
            </div>
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest block mb-1.5" style={{ color:"rgba(11,30,63,0.50)" }}>Route To</label>
              <input value={routeTo} onChange={(e)=>setRouteTo(e.target.value)} placeholder="Jabal Omar Hyatt" className="w-full px-3 py-2.5 text-xs rounded-xl focus:outline-none" style={IS} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest block mb-1.5" style={{ color:"rgba(11,30,63,0.50)" }}>Pax</label>
              <input type="number" value={pax} onChange={(e)=>setPax(e.target.value)} placeholder="0" className="w-full px-3 py-2.5 text-xs rounded-xl focus:outline-none" style={IS} />
            </div>
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest block mb-1.5" style={{ color:"rgba(11,30,63,0.50)" }}>Scheduled At</label>
              <input type="datetime-local" value={scheduledAt} onChange={(e)=>setScheduledAt(e.target.value)} className="w-full px-3 py-2.5 text-xs rounded-xl focus:outline-none" style={IS} />
            </div>
          </div>
          <button disabled={busy} onClick={() => void submit()} className="w-full py-3 rounded-xl text-xs font-bold disabled:opacity-50" style={{ backgroundColor:OPS, color:"#0B1E3F" }}>
            Create Dispatch
          </button>
        </div>
      </div>
    </div>
  );
}

function DispatchBoard({ rows, connected, apiGroups, onRefresh, demo, state }: { rows: DispatchOrder[] | null; connected: boolean; apiGroups: ApiGroup[] | null; onRefresh: () => void; demo: boolean; state: FeedState }) {
  const COLS: DispatchStatus[] = ["ASSIGNED","EN_ROUTE","COMPLETED","DELAYED"];
  const [showCreate, setShowCreate] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const data = demo ? DISPATCHES : (rows ?? []);
  const ready = demo || state === "ready";

  const setDispatchStatus = async (id: string, status: DispatchStatus) => {
    if (demo) return;
    setBusyId(id);
    try {
      await api.patch(`/ops/dispatches/${id}/status`, { status });
      erpToast.success(`Dispatch → ${status}`);
      onRefresh();
    } catch (e) {
      erpToast.error(e instanceof ApiError ? e.message : "Dispatch status failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={{ backgroundColor:CR_BG, minHeight:"100%" }}>
      <div className="flex items-center justify-between px-8 py-4" style={{ borderBottom:"1px solid rgba(11,30,63,0.11)", backgroundColor:CR_SURFACE }}>
        <div className="flex items-center gap-4">
          <Navigation size={20} style={{ color:OPS }} />
          <div>
            <div className="text-lg font-black text-[#0B1E3F] tracking-wide">DISPATCH BOARD</div>
            <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color:"rgba(11,30,63,0.58)" }}>Live · {ready ? data.length : "—"} active orders</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold" style={{ backgroundColor:`${OPS}18`, color:OPS, border:`1px solid ${OPS}30` }}>
            <Plus size={12} /> New Dispatch
          </button>
          <LiveBadge time={new Date().toLocaleTimeString("en-GB",{hour12:false})} live={connected} />
        </div>
      </div>

      {showCreate && <NewDispatchModal apiGroups={apiGroups} onClose={() => setShowCreate(false)} onCreated={onRefresh} />}

      {!ready ? (
        <div className="px-8 py-6">
          {state === "loading"
            ? <LoadingSkeleton tone="light" rows={5} />
            : <ErrorState tone="light" onRetry={onRefresh} />}
        </div>
      ) : data.length === 0 ? (
        <div className="px-8 py-6">
          <EmptyState tone="light" title="No dispatch orders" hint="Assigned vehicle movements appear on this board." />
        </div>
      ) : (
      <div className="grid grid-cols-4 gap-px overflow-hidden" style={{ height:"calc(100% - 65px)" }}>
        {COLS.map((col) => {
          const colOrders = data.filter((d) => d.status === col);
          const colStyle  = DSP_STAT[col];
          return (
            <div key={col} className="flex flex-col overflow-hidden" style={{ backgroundColor:"#FFFFFF" }}>
              {/* column header */}
              <div className="flex items-center justify-between px-4 py-3 shrink-0"
                   style={{ backgroundColor: colStyle.bg+"30", borderBottom:`2px solid ${colStyle.color}40` }}>
                <span className="text-xs font-black uppercase tracking-widest" style={{ color:colStyle.color }}>{colStyle.header}</span>
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black" style={{ backgroundColor:colStyle.color+"25", color:colStyle.color }}>
                  {colOrders.length}
                </span>
              </div>
              {/* cards */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2.5" style={{ scrollbarWidth:"none" }}>
                {colOrders.map((o) => (
                  <div key={o.id} className="p-4 rounded-xl" style={{ backgroundColor:"#FBFCFD", border:`1px solid rgba(11,30,63,0.11)`, borderLeft:`3px solid ${colStyle.color}60` }}>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[9px] font-black truncate" title={o.code ?? o.id} style={{ color:colStyle.color, fontFamily:"var(--font-mono)" }}>{o.code ?? o.id}</span>
                      <span className="text-[9px] font-mono shrink-0 whitespace-nowrap" style={{ color:"rgba(11,30,63,0.50)", fontFamily:"var(--font-mono)" }}>{o.time}</span>
                    </div>
                    <div className="text-xs font-black text-[#0B1E3F] mb-1 truncate" title={o.vehicle}>{o.vehicle}</div>
                    <div className="text-[10px] font-semibold mb-2 truncate" title={o.route} style={{ color:"rgba(11,30,63,0.76)" }}>{o.route}</div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="shrink-0">
                        <span className="text-lg font-black tabular-nums" style={{ color:"#0B1E3F", fontFamily:"var(--font-mono)" }}>{o.pax}</span>
                        <span className="text-[10px] ml-1" style={{ color:"rgba(11,30,63,0.58)" }}>pax</span>
                      </div>
                      <div className="text-right min-w-0">
                        <div className="text-[10px] text-[#0B1E3F] truncate" title={o.driver}>{o.driver}</div>
                        <div className="text-[9px] truncate" title={o.group} style={{ color:"rgba(11,30,63,0.58)", fontFamily:"var(--font-mono)" }}>{o.group}</div>
                      </div>
                    </div>
                    {o.note && (
                      <div className="flex items-start gap-1.5 mt-2 pt-2" style={{ borderTop:`1px solid ${colStyle.color}25` }}>
                        <AlertTriangle size={10} style={{ color:"#B45309", flexShrink:0, marginTop:1 }} />
                        <span className="text-[9px]" style={{ color:"#B45309" }}>{o.note}</span>
                      </div>
                    )}
                    {!demo && (
                      <select
                        value={o.status}
                        disabled={busyId === o.id}
                        onChange={(e) => void setDispatchStatus(o.id, e.target.value as DispatchStatus)}
                        className="mt-2 w-full px-2 py-1.5 rounded-lg text-[10px] font-bold focus:outline-none"
                        style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(11,30,63,0.12)", color: "#0B1E3F" }}
                      >
                        {COLS.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}

// ─── 5. Meet & Assist ─────────────────────────────────────────────────────────

const MA_STEPS = ["Flight Landed","Greeter at Gate","Pax Count Verified","Special Needs Handled","Baggage Collected","Bus Loaded","Departed to Hotel"];

function MeetAssist({ arrivals, maUpdate, demo, state, onRetry }: { arrivals: FlightRec[] | null; maUpdate: { flightInfoId: string; steps: MAStep[]; v: number } | null; demo: boolean; state: FeedState; onRetry: () => void }) {
  const live = !demo;
  const data = demo ? ARRIVALS : (arrivals ?? []);
  const ready = demo || state === "ready";
  const activeFlights = data.filter((a) => a.status !== "SCHEDULED");
  const activeKey = activeFlights.map((a) => a.id).join(",");

  const [selId, setSelId] = useState<string>("");
  const [stepsById, setStepsById] = useState<Record<string, Set<number>>>({});

  // Keep a valid selection as the active-flight set changes.
  useEffect(() => {
    if (activeFlights.length && (!selId || !activeFlights.some((a) => a.id === selId))) setSelId(activeFlights[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey]);

  // Load the 7-step checklist for each active flight (live), else derive from mock status.
  useEffect(() => {
    if (live) {
      let cancelled = false;
      Promise.all(
        activeFlights.map((a) =>
          api.get<ApiMeetAssist>(`/ops/meet-assist/${a.id}`)
            .then((m) => [a.id, new Set(m.steps.filter((s) => s.done).map((s) => s.stepNo))] as const)
            .catch(() => [a.id, new Set<number>()] as const),
        ),
      ).then((entries) => { if (!cancelled) setStepsById(Object.fromEntries(entries)); });
      return () => { cancelled = true; };
    }
    setStepsById(
      Object.fromEntries(
        ARRIVALS.map((a) => {
          const n = a.status === "DELIVERED" ? 7 : a.status === "EN_ROUTE" ? 6 : a.status === "AT_GATE" ? 3 : 1;
          return [a.id, new Set(Array.from({ length: n }, (_, i) => i + 1))];
        }),
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey, live]);

  // Live push: a step toggled elsewhere for a flight we track.
  useEffect(() => {
    if (!maUpdate) return;
    setStepsById((prev) => ({ ...prev, [maUpdate.flightInfoId]: new Set(maUpdate.steps.filter((s) => s.done).map((s) => s.stepNo)) }));
  }, [maUpdate]);

  const toggle = (flightId: string, stepNo: number) => {
    const want = !(stepsById[flightId]?.has(stepNo) ?? false);
    setStepsById((prev) => { const s = new Set(prev[flightId] ?? []); want ? s.add(stepNo) : s.delete(stepNo); return { ...prev, [flightId]: s }; });
    if (!live) return;
    api.patch<ApiMeetAssist>(`/ops/meet-assist/${flightId}/step`, { stepNo, done: want })
      .then((m) => setStepsById((prev) => ({ ...prev, [flightId]: new Set(m.steps.filter((s) => s.done).map((s) => s.stepNo)) })))
      .catch((e) => {
        toast.error(e instanceof ApiError ? e.message : "Could not update step");
        setStepsById((prev) => { const s = new Set(prev[flightId] ?? []); want ? s.delete(stepNo) : s.add(stepNo); return { ...prev, [flightId]: s }; });
      });
  };

  return (
    <div className="p-7 grid grid-cols-5 gap-5 h-full">
      {/* Left: flight list */}
      <div className="col-span-2 space-y-2 overflow-y-auto" style={{ scrollbarWidth:"none" }}>
        <div className="text-[9px] font-black uppercase tracking-widest mb-3" style={{ color:"rgba(11,30,63,0.50)" }}>Active Arrivals</div>
        {!ready ? (
          state === "loading"
            ? <LoadingSkeleton tone="light" rows={4} />
            : <ErrorState tone="light" onRetry={onRetry} />
        ) : activeFlights.length === 0 ? (
          <EmptyState tone="light" title="No active arrivals" hint="Flights move here once they land or start processing." />
        ) : activeFlights.map((a) => {
          const done   = stepsById[a.id]?.size ?? 0;
          const pct    = Math.round((done / MA_STEPS.length) * 100);
          const s      = ARR_STAT[a.status];
          void s;
          return (
            <button key={a.id} onClick={() => setSelId(a.id)}
              className="w-full text-left p-4 rounded-2xl transition-all"
              style={{ border:`1px solid ${selId === a.id ? OPS : "rgba(11,30,63,0.38)"}`, backgroundColor: selId === a.id ? `${OPS}0A` : "rgba(11,30,63,0.38)" }}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-base font-black truncate" style={{ color:"#0B1E3F", fontFamily:"var(--font-mono)" }}>{a.flight}</span>
                <BStat s={a.status} map={ARR_STAT} />
              </div>
              <div className="text-xs text-[#0B1E3F] mb-1 truncate" title={a.group}>{a.group}</div>
              <div className="text-[10px] mb-2 truncate" title={`${a.pax} pax · ${a.agent}`} style={{ color:"rgba(11,30,63,0.58)" }}>{a.pax} pax · {a.agent}</div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor:"#F5F7FA" }}>
                <div className="h-full rounded-full transition-all" style={{ width:`${pct}%`, backgroundColor: pct === 100 ? "#16A34A" : OPS }} />
              </div>
              <div className="text-[9px] mt-1" style={{ color:"rgba(11,30,63,0.50)" }}>{done}/{MA_STEPS.length} steps · {pct}%</div>
            </button>
          );
        })}
      </div>

      {/* Right: checklist */}
      <div className="col-span-3">
        {(() => {
          const a = data.find((x) => x.id === selId);
          if (!a) {
            if (!ready) return null;   // left column already shows the loading / error state
            return <EmptyState tone="light" title="Select an arrival to run the checklist" hint="The 7-step Meet & Assist checklist opens here." />;
          }
          const steps = stepsById[selId] ?? new Set<number>();
          return (
            <div className="rounded-2xl overflow-hidden" style={{ border:`1px solid ${OPS}25` }}>
              <div className="px-5 py-4" style={{ backgroundColor:`${OPS}0D`, borderBottom:`1px solid ${OPS}20` }}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-lg font-black text-[#0B1E3F] truncate" style={{ fontFamily:"var(--font-mono)" }}>{a.flight}</div>
                    <div className="text-xs mt-0.5 truncate" title={`${a.group} · ${a.agent} · ${a.pax} pax`} style={{ color:"rgba(11,30,63,0.66)" }}>{a.group} · {a.agent} · {a.pax} pax</div>
                  </div>
                  <BStat s={a.status} map={ARR_STAT} />
                </div>
                <div className="grid grid-cols-3 gap-3 mt-4">
                  {[["Route", a.route],["ETA", a.eta],["Vehicle + Driver", `${a.vehicle} · ${a.driver}`]].map(([l,v]) => (
                    <div key={l as string} className="min-w-0">
                      <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color:"rgba(11,30,63,0.50)" }}>{l}</div>
                      <div className="text-xs font-bold text-[#0B1E3F] mt-0.5 truncate" title={v as string}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-5 space-y-1">
                <div className="text-[9px] font-black uppercase tracking-widest mb-3" style={{ color:"rgba(11,30,63,0.50)" }}>Meet & Assist Checklist</div>
                {MA_STEPS.map((step, idx) => {
                  const done = steps.has(idx + 1);
                  return (
                    <button key={idx} onClick={() => toggle(selId, idx + 1)}
                      className="w-full flex items-center gap-4 p-3.5 rounded-xl transition-all hover:bg-white/3"
                      style={{ backgroundColor: done ? "#4ADE8008" : "transparent", border:`1px solid ${done ? "#4ADE8025" : "rgba(11,30,63,0.38)"}` }}>
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-all`}
                           style={{ backgroundColor: done ? "#16A34A" : "#EEF1F6", border: done ? "none" : "1px solid rgba(11,30,63,0.15)" }}>
                        {done && <Check size={12} style={{ color:"black", strokeWidth:3 }} />}
                      </div>
                      <span className="text-xs font-semibold text-left" style={{ color: done ? "#16A34A" : "rgba(11,30,63,0.76)", textDecoration: done ? "line-through" : undefined }}>
                        {String(idx + 1).padStart(2,"0")}. {step}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ─── 6. Ziyarah ───────────────────────────────────────────────────────────────

const ZIYARAH_TRIPS = [
  { id:"ZYR-0041", group:"GRP-1446-2891", date:"17 Jul 2025", sites:"Masjid al-Haram, Zamzam, Safa & Marwa", guide:"Sheikh Mahmoud Al-Aqeel", vehicle:"VAN H-03", pax:22, status:"CONFIRMED" },
  { id:"ZYR-0038", group:"GRP-1446-2744", date:"18 Jul 2025", sites:"Jabal al-Nour, Hira Cave, Jabal Thawr",  guide:"Sheikh Ibrahim Hassan",    vehicle:"BUS B-14", pax:32, status:"CONFIRMED" },
  { id:"ZYR-0035", group:"GRP-1446-3102", date:"19 Jul 2025", sites:"Mina, Muzdalifah, Arafat (overview)",    guide:"Sheikh Ali Al-Ghamdi",      vehicle:"BUS B-16", pax:52, status:"SCHEDULED" },
  { id:"ZYR-0031", group:"GRP-1446-2990", date:"20 Jul 2025", sites:"Madinah Ziyarah — Masjid Nabawi, Uhud",  guide:"Sheikh Yusuf Al-Qahtani",   vehicle:"BUS B-09", pax:38, status:"SCHEDULED" },
  { id:"ZYR-0029", group:"GRP-1446-2401", date:"12 Jul 2025", sites:"Full Makkah Ziyarah Package",            guide:"Sheikh Mahmoud Al-Aqeel",   vehicle:"VAN H-07", pax:18, status:"COMPLETED" },
];

function ScheduleZiyarahModal({ apiGroups, onClose, onCreated }: { apiGroups: ApiGroup[] | null; onClose: () => void; onCreated: () => void }) {
  const opts = groupOptions(apiGroups);
  const [groupId, setGroupId] = useState(opts[0]?.value ?? "");
  const [date, setDate] = useState("");
  const [sites, setSites] = useState("");
  const [guideName, setGuideName] = useState("");
  const [pax, setPax] = useState("");
  const [busy, setBusy] = useState(false);
  const IS = { backgroundColor:"#F5F7FA", border:"1px solid rgba(11,30,63,0.15)", color:"#0B1E3F" } as CSSProperties;

  const submit = async () => {
    if (!groupId || !date || !sites.trim()) { toast.error("Group, date and sites are required."); return; }
    setBusy(true);
    try {
      const row = await api.post<{ code: string }>("/ops/ziyarah", {
        groupId, date: new Date(date).toISOString(), sites: sites.trim(),
        guideName: guideName.trim() || undefined, pax: Number(pax) || 0,
      });
      toast.success(`Ziyarah ${row.code} scheduled`);
      onCreated();
      onClose();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not schedule ziyarah");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ backgroundColor:"rgba(3,4,10,0.8)" }} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl p-6" style={{ backgroundColor:CR_SURFACE, border:`1px solid ${OPS}30` }} onClick={(e)=>e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div className="text-sm font-bold text-[#0B1E3F]">Schedule Ziyarah</div>
          <button onClick={onClose} className="text-xs font-bold" style={{ color:"rgba(11,30,63,0.58)" }}>✕</button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-[9px] font-black uppercase tracking-widest block mb-1.5" style={{ color:"rgba(11,30,63,0.50)" }}>Group</label>
            <select value={groupId} onChange={(e)=>setGroupId(e.target.value)} className="w-full px-3 py-2.5 text-xs rounded-xl focus:outline-none appearance-none" style={IS}>
              {opts.map((o)=><option key={o.value} value={o.value} style={{ color:"black" }}>{o.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest block mb-1.5" style={{ color:"rgba(11,30,63,0.50)" }}>Date</label>
              <input type="date" value={date} onChange={(e)=>setDate(e.target.value)} className="w-full px-3 py-2.5 text-xs rounded-xl focus:outline-none" style={IS} />
            </div>
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest block mb-1.5" style={{ color:"rgba(11,30,63,0.50)" }}>Pax</label>
              <input type="number" value={pax} onChange={(e)=>setPax(e.target.value)} placeholder="0" className="w-full px-3 py-2.5 text-xs rounded-xl focus:outline-none" style={IS} />
            </div>
          </div>
          <div>
            <label className="text-[9px] font-black uppercase tracking-widest block mb-1.5" style={{ color:"rgba(11,30,63,0.50)" }}>Sites</label>
            <input value={sites} onChange={(e)=>setSites(e.target.value)} placeholder="Masjid al-Haram, Zamzam…" className="w-full px-3 py-2.5 text-xs rounded-xl focus:outline-none" style={IS} />
          </div>
          <div>
            <label className="text-[9px] font-black uppercase tracking-widest block mb-1.5" style={{ color:"rgba(11,30,63,0.50)" }}>Guide (optional)</label>
            <input value={guideName} onChange={(e)=>setGuideName(e.target.value)} placeholder="Sheikh…" className="w-full px-3 py-2.5 text-xs rounded-xl focus:outline-none" style={IS} />
          </div>
          <button disabled={busy} onClick={() => void submit()} className="w-full py-3 rounded-xl text-xs font-bold disabled:opacity-50" style={{ backgroundColor:OPS, color:"#0B1E3F" }}>
            Schedule Ziyarah
          </button>
        </div>
      </div>
    </div>
  );
}

function ZiyarahScreen({ signal, apiGroups }: { signal: number; apiGroups: ApiGroup[] | null }) {
  const demo = !isLoggedIn();
  const [live, setLive] = useState<ApiZiyarah[] | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [state, setState] = useState<FeedState>(demo ? "ready" : "loading");
  const refresh = () => {
    if (!isLoggedIn()) { setLive(null); setState("ready"); return; }
    setState("loading");
    api.get<ApiZiyarah[]>("/ops/ziyarah")
      .then((r) => { setLive(r); setState("ready"); })
      .catch(() => { setLive(null); setState("error"); });
  };
  useEffect(() => {
    const t = setTimeout(refresh, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signal]);

  const rows = demo
    ? ZIYARAH_TRIPS
    : (live ?? []).map((z) => ({ id: z.code, group: z.group ?? "—", date: fmtDay(z.date), sites: z.sites, guide: z.guide ?? "—", vehicle: z.vehicle, pax: z.pax, status: z.status }));
  const ready = demo || state === "ready";

  return (
    <div className="p-7">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-sm font-bold text-[#0B1E3F]">Ziyarah Scheduling & Tracking</h2>
          <p className="text-xs mt-0.5" style={{ color:"rgba(11,30,63,0.58)" }}>Holy site visit programs for all active groups</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold" style={{ backgroundColor:`${OPS}18`, color:OPS }}>
          <Plus size={12} /> Schedule Ziyarah
        </button>
      </div>

      {showCreate && <ScheduleZiyarahModal apiGroups={apiGroups} onClose={() => setShowCreate(false)} onCreated={refresh} />}

      <div className="space-y-3">
        {!ready ? (
          state === "loading"
            ? <LoadingSkeleton tone="light" rows={4} />
            : <ErrorState tone="light" onRetry={refresh} />
        ) : rows.length === 0 ? (
          <EmptyState tone="light" title="No ziyarah scheduled" hint="Holy-site visit programs appear here once scheduled." />
        ) : rows.map((z) => {
          const statusColor = z.status === "COMPLETED" ? "#059669" : z.status === "CONFIRMED" ? "#16A34A" : "#2563EB";
          return (
            <div key={z.id} className="rounded-2xl p-5" style={{ backgroundColor:"#FFFFFF", border:"1px solid rgba(11,30,63,0.11)", opacity: z.status === "COMPLETED" ? 0.6 : 1 }}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs font-black whitespace-nowrap" style={{ color:OPS, fontFamily:"var(--font-mono)" }}>{z.id}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ backgroundColor:`${statusColor}18`, color:statusColor }}>{z.status}</span>
                    <span className="text-xs font-bold text-[#0B1E3F] whitespace-nowrap">{z.date}</span>
                  </div>
                  <div className="text-sm font-semibold text-[#0B1E3F] mb-1 truncate" title={z.sites}>{z.sites}</div>
                  <div className="grid grid-cols-4 gap-4 mt-3">
                    {[["Group",z.group],["Guide",z.guide],["Vehicle",z.vehicle],["Pax",String(z.pax)]].map(([l,v]) => (
                      <div key={l as string} className="min-w-0">
                        <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color:"rgba(11,30,63,0.50)" }}>{l}</div>
                        <div className="text-xs font-semibold text-[#0B1E3F] mt-0.5 truncate" title={v as string}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <button className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor:"#F5F7FA" }}>
                  <Eye size={13} style={{ color:"rgba(11,30,63,0.58)" }} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 7. Long Stay ─────────────────────────────────────────────────────────────

const LONG_STAY_DEMO: ApiLongStay[] = [
  { id: "demo-1", code: "LS-DEMO-1", group: "GRP-1446-2891", hotel: "Jabal Omar Hyatt", city: "Makkah", nights: 14, checkIn: "2026-08-15", checkOut: "2026-08-29", pax: 47, renewal: "NONE", status: "ACTIVE", hostComplete: false },
  { id: "demo-2", code: "LS-DEMO-2", group: "GRP-1446-2744", hotel: "Makkah Towers", city: "Makkah", nights: 14, checkIn: "2026-08-22", checkOut: "2026-09-05", pax: 32, renewal: "NONE", status: "ACTIVE", hostComplete: true, hostName: "Demo Host" },
  { id: "demo-3", code: "LS-DEMO-3", group: "GRP-1446-3102", hotel: "Movenpick Hajar", city: "Makkah", nights: 14, checkIn: "2026-08-12", checkOut: "2026-08-26", pax: 52, renewal: "REQUESTED", status: "RENEWAL", hostComplete: false },
  { id: "demo-4", code: "LS-DEMO-4", group: "GRP-1446-2612", hotel: "Intercontinental MED", city: "Madinah", nights: 14, checkIn: "2026-09-01", checkOut: "2026-09-15", pax: 19, renewal: "NONE", status: "UPCOMING", hostComplete: false },
  { id: "demo-5", code: "LS-DEMO-5", group: "GRP-1446-2401", hotel: "Marriott Makkah", city: "Makkah", nights: 14, checkIn: "2026-07-01", checkOut: "2026-07-15", pax: 64, renewal: "NONE", status: "COMPLETED", hostComplete: true },
];

function day85StatusKind(stage?: string | null, redCard?: boolean): ErpStatusKind {
  if (redCard || stage === "DUE" || stage === "ESCALATED") return "rejected";
  if (stage === "APPROACHING") return "warning";
  if (stage === "RESOLVED") return "completed";
  if (stage === "TRACKING") return "info";
  return "pending";
}

function lsStatusKind(status: string): ErpStatusKind {
  if (status === "ACTIVE") return "approved";
  if (status === "RENEWAL") return "warning";
  if (status === "UPCOMING") return "info";
  if (status === "COMPLETED") return "completed";
  return "pending";
}

type LsQuickFilter = "" | "host" | "red" | "DUE" | "ESCALATED" | "RESOLVED" | "COMPLETED" | "APPROACHING";

function LongStayDrawer({
  row,
  open,
  onClose,
  onSaved,
  demo,
}: {
  row: ApiLongStay | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  demo: boolean;
}) {
  const { lang } = useLang();
  const [tab, setTab] = useState<"summary" | "host" | "day85" | "history">("summary");
  const [hostName, setHostName] = useState("");
  const [hostIqama, setHostIqama] = useState("");
  const [hostWhatsapp, setHostWhatsapp] = useState("");
  const [hostRelation, setHostRelation] = useState("");
  const [absher, setAbsher] = useState("");
  const [exitDate, setExitDate] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!row) return;
    setHostName(row.hostName ?? "");
    setHostIqama(row.hostIqama ?? "");
    setHostWhatsapp(row.hostWhatsapp ?? "");
    setHostRelation(row.hostRelation ?? "");
    setAbsher(row.absher ?? "");
    setExitDate(row.exitDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
    setTab("summary");
  }, [row]);

  /** Same PATCH /ops/long-stays/:id + registerHost as before. */
  const saveHost = async () => {
    if (!row || demo) {
      erpToast.error(lang === "bn" ? "ডেমো — সাইন ইন করুন" : "Demo — sign in to save", lang);
      return;
    }
    const name = hostName.trim();
    const wa = hostWhatsapp.trim();
    if (!name) {
      erpToast.error(lang === "bn" ? "হোস্টের নাম প্রয়োজন" : "hostName is required", lang);
      setTab("host");
      return;
    }
    if (!wa) {
      erpToast.error(lang === "bn" ? "হোস্ট হোয়াটসঅ্যাপ প্রয়োজন" : "hostWhatsapp is required", lang);
      setTab("host");
      return;
    }
    setBusy(true);
    try {
      await api.patch(`/ops/long-stays/${row.id}`, {
        registerHost: true,
        hostName: name,
        hostWhatsapp: wa,
        hostIqama: hostIqama.trim() || undefined,
        hostRelation: hostRelation.trim() || undefined,
        absher: absher.trim() || undefined,
      });
      erpToast.success(lang === "bn" ? `${row.code} — হোস্ট সংরক্ষিত` : `Host registered for ${row.code}`, lang);
      onClose();
      onSaved();
    } catch (e) {
      erpToast.error(e instanceof ApiError ? e.message : (lang === "bn" ? "হোস্ট সংরক্ষণ ব্যর্থ" : "Host register failed"), lang);
    } finally {
      setBusy(false);
    }
  };

  /** T002-08 — exitDate via existing PATCH clears red card; no Day-85 mutate API. */
  const resolveDay85 = async () => {
    if (!row || demo) return;
    const ed = exitDate.trim();
    if (!ed) {
      erpToast.error(lang === "bn" ? "প্রস্থানের তারিখ দিন" : "Exit date is required", lang);
      setTab("day85");
      return;
    }
    setBusy(true);
    try {
      await api.patch(`/ops/long-stays/${row.id}`, { exitDate: ed });
      erpToast.success(lang === "bn" ? `${row.code} — Day-85 সমাধান` : `Day-85 resolved for ${row.code}`, lang);
      onClose();
      onSaved();
    } catch (e) {
      erpToast.error(e instanceof ApiError ? e.message : (lang === "bn" ? "সমাধান ব্যর্থ" : "Resolve failed"), lang);
    } finally {
      setBusy(false);
    }
  };

  const tabs = (
    <div className="flex flex-wrap gap-1">
      {([
        ["summary", lang === "bn" ? "সারাংশ" : "Summary"],
        ["host", lang === "bn" ? "হোস্ট" : "Host"],
        ["day85", "Day-85"],
        ["history", lang === "bn" ? "ইতিহাস" : "History"],
      ] as const).map(([id, label]) => (
        <ErpButton key={id} size="sm" variant={tab === id ? "primary" : "ghost"} onClick={() => setTab(id)}>
          {label}
        </ErpButton>
      ))}
    </div>
  );

  return (
    <ErpDrawer
      open={open && !!row}
      onClose={onClose}
      title={row?.code ?? (lang === "bn" ? "লং স্টে" : "Long Stay")}
      subtitle={row ? `${row.group ?? "—"} · ${row.groupVisaType ?? "—"}` : undefined}
      lang={lang}
      maxWidth={720}
      tabs={tabs}
      footer={
        <ErpDrawerFooterActions
          lang={lang}
          onCancel={onClose}
          onSave={saveHost}
          saving={busy}
          saveDisabled={demo}
          saveLabel={lang === "bn" ? "হোস্ট সংরক্ষণ" : "Save Host"}
        />
      }
    >
      {row && tab === "summary" && (
        <div className="space-y-3">
          <dl className="space-y-2 text-sm">
            {[
              [lang === "bn" ? "গ্রুপ" : "Group", row.group ?? "—"],
              [lang === "bn" ? "হোটেল" : "Hotel", row.hotel],
              [lang === "bn" ? "শহর" : "City", row.city],
              ["Pax", String(row.pax)],
              [lang === "bn" ? "রাত" : "Nights", `${row.nights}N`],
              [lang === "bn" ? "নবায়ন" : "Renewal", RENEWAL_LABEL[row.renewal] ?? row.renewal],
              [lang === "bn" ? "স্ট্যাটাস" : "Status", row.status],
              [lang === "bn" ? "হোস্ট সম্পূর্ণ" : "Host complete", row.hostComplete ? "YES" : "NO"],
              ["Day-85", day85Label(row.day85)],
            ].map(([k, v]) => (
              <div key={String(k)} className="flex justify-between gap-3 py-1.5" style={{ borderBottom: "1px solid rgba(11,30,63,0.06)" }}>
                <dt style={{ color: "rgba(11,30,63,0.50)" }}>{k}</dt>
                <dd className="font-semibold text-[#0B1E3F] text-right">{v}</dd>
              </div>
            ))}
          </dl>
          <ErpStatusChip status={day85StatusKind(row.day85?.stage, row.day85?.redCard)} label={day85Label(row.day85)} lang={lang} />
          <p className="text-[10px]" style={{ color: "rgba(11,30,63,0.50)" }}>
            {lang === "bn"
              ? "হোস্ট লগইন ইউজার নয়। Day-85 মার্কার অটোমেশন সেট করে — হাতে সম্পাদনা নয়।"
              : "Host is not a login user. Day-85 markers are set by the daily automation sweep — they cannot be edited by hand."}
          </p>
        </div>
      )}

      {row && tab === "host" && (
        <ErpForm columns={2}>
          <ErpField label={lang === "bn" ? "নাম" : "Name"} required>
            <ErpInput value={hostName} onChange={(e) => setHostName(e.target.value)} disabled={demo} />
          </ErpField>
          <ErpField label={lang === "bn" ? "ইকামা" : "Iqama"}>
            <ErpInput value={hostIqama} onChange={(e) => setHostIqama(e.target.value)} disabled={demo} style={{ fontFamily: "var(--font-mono)" }} />
          </ErpField>
          <ErpField label="WhatsApp" required>
            <ErpInput value={hostWhatsapp} onChange={(e) => setHostWhatsapp(e.target.value)} disabled={demo} />
          </ErpField>
          <ErpField label={lang === "bn" ? "সম্পর্ক" : "Relation"}>
            <ErpInput value={hostRelation} onChange={(e) => setHostRelation(e.target.value)} disabled={demo} />
          </ErpField>
          <ErpFormRow span={2}>
            <ErpField label="Absher">
              <ErpTextarea value={absher} onChange={(e) => setAbsher(e.target.value)} disabled={demo} rows={3} />
            </ErpField>
          </ErpFormRow>
          <ErpField label={lang === "bn" ? "প্রবেশ" : "Entry"}>
            <ErpInput value={row.entryDate ? fmtDay(row.entryDate) : "—"} readOnly />
          </ErpField>
          <ErpField label={lang === "bn" ? "প্রস্থান" : "Exit"}>
            <ErpInput value={row.exitDate ? fmtDay(row.exitDate) : "—"} readOnly />
          </ErpField>
        </ErpForm>
      )}

      {row && tab === "day85" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {[
              { show: !!row.day85?.redCard, kind: "rejected" as const, label: "Red Card" },
              { show: row.day85?.stage === "APPROACHING", kind: "warning" as const, label: "Approaching" },
              { show: row.day85?.stage === "DUE", kind: "rejected" as const, label: "Due" },
              { show: row.day85?.stage === "ESCALATED", kind: "rejected" as const, label: "Escalated" },
              { show: !!row.day85?.resolved || row.day85?.stage === "RESOLVED", kind: "completed" as const, label: "Resolved" },
            ].filter((x) => x.show).map((x) => (
              <ErpStatusChip key={x.label} status={x.kind} label={x.label} lang={lang} />
            ))}
            {!row.day85 || row.day85.stage === "NOT_TRACKED" ? (
              <ErpStatusChip status="pending" label={lang === "bn" ? "ট্র্যাক নয়" : "Not tracked"} lang={lang} />
            ) : null}
          </div>
          <dl className="space-y-2 text-sm">
            {[
              [lang === "bn" ? "পর্যায়" : "Stage", day85Label(row.day85)],
              [lang === "bn" ? "প্রবেশ" : "Entry", row.entryDate ? fmtDay(row.entryDate) : "—"],
              [lang === "bn" ? "ডিউ (প্রবেশ + ৮৫)" : "Due (entry + 85)", row.day85?.dueAt ? fmtDay(row.day85.dueAt) : "—"],
              [lang === "bn" ? "প্রস্থান" : "Exit", row.exitDate ? fmtDay(row.exitDate) : "—"],
              [lang === "bn" ? "নোটিফাই" : "Notified", row.day85?.notifiedAt ? fmtDay(row.day85.notifiedAt) : (lang === "bn" ? "এখনো নয়" : "not yet")],
            ].map(([k, v]) => (
              <div key={String(k)} className="flex justify-between gap-3 py-1.5" style={{ borderBottom: "1px solid rgba(11,30,63,0.06)" }}>
                <dt style={{ color: "rgba(11,30,63,0.50)" }}>{k}</dt>
                <dd className="font-semibold text-[#0B1E3F]">{v}</dd>
              </div>
            ))}
          </dl>
          {!row.day85?.resolved && !demo && (
            <ErpForm columns={1}>
              <ErpField label={lang === "bn" ? "প্রস্থানের তারিখ (YYYY-MM-DD)" : "Kingdom exit date (YYYY-MM-DD)"}>
                <ErpInput type="date" value={exitDate} onChange={(e) => setExitDate(e.target.value)} />
              </ErpField>
              <ErpButton variant="primary" disabled={busy} onClick={() => void resolveDay85()}>
                {lang === "bn" ? "প্রস্থান রেকর্ড / সমাধান" : "Record exit / resolve"}
              </ErpButton>
            </ErpForm>
          )}
          {row.day85?.resolved && (
            <p className="text-xs font-semibold" style={{ color: "#16A34A" }}>
              {lang === "bn" ? "সমাধান" : "Resolved"} via {row.day85.resolvedBy ?? "—"}
            </p>
          )}
        </div>
      )}

      {row && tab === "history" && (
        <dl className="space-y-2 text-sm">
          {[
            [lang === "bn" ? "চেক-ইন" : "Check-in", fmtDay(row.checkIn)],
            [lang === "bn" ? "চেক-আউট" : "Check-out", fmtDay(row.checkOut)],
            [lang === "bn" ? "প্রবেশ" : "Entry", row.entryDate ? fmtDay(row.entryDate) : "—"],
            [lang === "bn" ? "প্রস্থান" : "Exit", row.exitDate ? fmtDay(row.exitDate) : "—"],
            [lang === "bn" ? "ডিউ" : "Due", row.day85?.dueAt ? fmtDay(row.day85.dueAt) : "—"],
            [lang === "bn" ? "নোটিফাই" : "Notified", row.day85?.notifiedAt ? fmtDay(row.day85.notifiedAt) : "—"],
            [lang === "bn" ? "সমাধানকারী" : "Resolved by", row.day85?.resolvedBy ?? "—"],
          ].map(([k, v]) => (
            <div key={String(k)} className="flex justify-between gap-3 py-1.5" style={{ borderBottom: "1px solid rgba(11,30,63,0.06)" }}>
              <dt style={{ color: "rgba(11,30,63,0.50)" }}>{k}</dt>
              <dd className="font-semibold text-[#0B1E3F]">{v}</dd>
            </div>
          ))}
        </dl>
      )}
    </ErpDrawer>
  );
}

function CreateLongStayDrawer({
  apiGroups,
  open,
  onClose,
  onCreated,
  demo,
}: {
  apiGroups: ApiGroup[] | null;
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  demo: boolean;
}) {
  const { lang } = useLang();
  const opts = groupOptions(apiGroups);
  const [groupId, setGroupId] = useState("");
  const [hotelName, setHotelName] = useState("");
  const [city, setCity] = useState("Makkah");
  const [nights, setNights] = useState("30");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [pax, setPax] = useState("1");
  const [hostName, setHostName] = useState("");
  const [hostWhatsapp, setHostWhatsapp] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setGroupId(opts[0]?.value ?? "");
    setHotelName("");
    setCity("Makkah");
    setNights("30");
    setCheckIn("");
    setCheckOut("");
    setPax("1");
    setHostName("");
    setHostWhatsapp("");
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    if (demo) {
      erpToast.error(lang === "bn" ? "ডেমো — সাইন ইন করুন" : "Demo — sign in to create", lang);
      return;
    }
    if (!groupId || !hotelName.trim() || !city.trim() || !checkIn || !checkOut) {
      erpToast.error(lang === "bn" ? "গ্রুপ, হোটেল, শহর ও তারিখ আবশ্যক" : "Group, hotel, city and dates are required", lang);
      return;
    }
    const n = Math.max(1, Number(nights) || 1);
    const p = Math.max(0, Number(pax) || 0);
    setBusy(true);
    try {
      await api.post("/ops/long-stays", {
        groupId,
        hotelName: hotelName.trim(),
        city: city.trim(),
        nights: n,
        checkIn: new Date(checkIn).toISOString(),
        checkOut: new Date(checkOut).toISOString(),
        pax: p,
        ...(hostName.trim() ? { hostName: hostName.trim(), registerHost: true } : {}),
        ...(hostWhatsapp.trim() ? { hostWhatsapp: hostWhatsapp.trim() } : {}),
      });
      erpToast.success(lang === "bn" ? "লং স্টে তৈরি হয়েছে" : "Long stay created", lang);
      onCreated();
      onClose();
    } catch (e) {
      erpToast.error(e instanceof ApiError ? e.message : (lang === "bn" ? "তৈরি ব্যর্থ" : "Create failed"), lang);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ErpDrawer
      open={open}
      onClose={onClose}
      title={lang === "bn" ? "নতুন লং স্টে" : "New Long Stay"}
      lang={lang}
      footer={
        <ErpDrawerFooterActions
          lang={lang}
          onCancel={onClose}
          onSave={submit}
          saving={busy}
          saveLabel={lang === "bn" ? "তৈরি করুন" : "Create"}
        />
      }
    >
      <ErpForm columns={2}>
        <ErpFormRow span={2}>
          <ErpField label={lang === "bn" ? "গ্রুপ" : "Group"} required>
            <ErpSelect value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              <option value="">—</option>
              {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </ErpSelect>
          </ErpField>
        </ErpFormRow>
        <ErpField label={lang === "bn" ? "হোটেল" : "Hotel"} required>
          <ErpInput value={hotelName} onChange={(e) => setHotelName(e.target.value)} />
        </ErpField>
        <ErpField label={lang === "bn" ? "শহর" : "City"} required>
          <ErpInput value={city} onChange={(e) => setCity(e.target.value)} />
        </ErpField>
        <ErpField label={lang === "bn" ? "রাত" : "Nights"} required>
          <ErpInput type="number" value={nights} onChange={(e) => setNights(e.target.value)} />
        </ErpField>
        <ErpField label="Pax" required>
          <ErpInput type="number" value={pax} onChange={(e) => setPax(e.target.value)} />
        </ErpField>
        <ErpField label={lang === "bn" ? "চেক-ইন" : "Check-in"} required>
          <ErpInput type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
        </ErpField>
        <ErpField label={lang === "bn" ? "চেক-আউট" : "Check-out"} required>
          <ErpInput type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
        </ErpField>
        <ErpField label={lang === "bn" ? "হোস্টের নাম" : "Host name"}>
          <ErpInput value={hostName} onChange={(e) => setHostName(e.target.value)} />
        </ErpField>
        <ErpField label={lang === "bn" ? "হোস্ট হোয়াটসঅ্যাপ" : "Host WhatsApp"}>
          <ErpInput value={hostWhatsapp} onChange={(e) => setHostWhatsapp(e.target.value)} />
        </ErpField>
      </ErpForm>
    </ErpDrawer>
  );
}

function LongStayScreen({ signal, apiGroups }: { signal: number; apiGroups: ApiGroup[] | null }) {
  const { lang } = useLang();
  const demo = !isLoggedIn();
  const [live, setLive] = useState<ApiLongStay[] | null>(null);
  const [state, setState] = useState<FeedState>(demo ? "ready" : "loading");
  const [sel, setSel] = useState<ApiLongStay | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [quick, setQuick] = useState<LsQuickFilter>("");
  const [q, setQ] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [hostFilter, setHostFilter] = useState<"all" | "yes" | "no">("all");
  const [visaType, setVisaType] = useState("");
  const [page, setPage] = useState(1);
  const PAGE = 20;

  const refresh = () => {
    if (!isLoggedIn()) { setLive(null); setState("ready"); return; }
    setState("loading");
    // Full list for summary widgets; filters applied client-side (same fields as ?day85=).
    api.get<ApiLongStay[]>("/ops/long-stays")
      .then((r) => { setLive(r); setState("ready"); })
      .catch(() => { setLive(null); setState("error"); });
  };
  useEffect(() => {
    const t = setTimeout(refresh, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signal]);

  const source = demo ? LONG_STAY_DEMO : (live ?? []);
  const ready = demo || state === "ready";

  /** Existing row fields only — no new calculations beyond counting flags already on the payload. */
  const summary = {
    hostComplete: source.filter((l) => l.hostComplete).length,
    day85Due: source.filter((l) => l.day85?.stage === "DUE").length,
    day90Esc: source.filter((l) => l.day85?.stage === "ESCALATED").length,
    completed: source.filter((l) => l.status === "COMPLETED").length,
  };

  const filtered = source.filter((l) => {
    const qq = q.trim().toLowerCase();
    const matchQ = !qq
      || (l.hostName ?? "").toLowerCase().includes(qq)
      || (l.hostIqama ?? "").toLowerCase().includes(qq)
      || (l.group ?? "").toLowerCase().includes(qq)
      || (l.code ?? "").toLowerCase().includes(qq)
      || (l.hotel ?? "").toLowerCase().includes(qq);
    if (!matchQ) return false;
    if (hostFilter === "yes" && !l.hostComplete) return false;
    if (hostFilter === "no" && l.hostComplete) return false;
    if (visaType && (l.groupVisaType ?? "") !== visaType) return false;
    if (quick === "host" && !l.hostComplete) return false;
    if (quick === "red" && !l.day85?.redCard) return false;
    if (quick === "DUE" && l.day85?.stage !== "DUE") return false;
    if (quick === "ESCALATED" && l.day85?.stage !== "ESCALATED") return false;
    if (quick === "RESOLVED" && l.day85?.stage !== "RESOLVED" && !l.day85?.resolved) return false;
    if (quick === "APPROACHING" && l.day85?.stage !== "APPROACHING") return false;
    if (quick === "COMPLETED" && l.status !== "COMPLETED") return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const safePage = Math.min(page, totalPages);
  const pageRows = ready ? filtered.slice((safePage - 1) * PAGE, safePage * PAGE) : [];

  useEffect(() => { setPage(1); }, [q, quick, hostFilter, visaType]);

  const columns: ErpColumn<ApiLongStay>[] = [
    {
      id: "group",
      header: lang === "bn" ? "গ্রুপ" : "Group",
      cell: (l) => (
        <div>
          <div className="text-[11px] font-bold" style={{ color: OPS, fontFamily: "var(--font-mono)" }}>{l.group ?? "—"}</div>
          <div className="text-[10px]" style={{ color: "rgba(11,30,63,0.45)", fontFamily: "var(--font-mono)" }}>{l.code}</div>
        </div>
      ),
    },
    {
      id: "hotel",
      header: lang === "bn" ? "হোটেল" : "Hotel",
      cell: (l) => (
        <div>
          <div className="text-xs font-semibold truncate max-w-[140px]" title={l.hotel}>{l.hotel}</div>
          <div className="text-[10px]" style={{ color: "rgba(11,30,63,0.50)" }}>{l.city}</div>
        </div>
      ),
    },
    {
      id: "host",
      header: lang === "bn" ? "হোস্ট" : "Host",
      cell: (l) => (
        <div>
          <div className="text-xs truncate max-w-[120px]">{l.hostName ?? "—"}</div>
          <ErpStatusChip
            status={l.hostComplete ? "approved" : "warning"}
            label={l.hostComplete ? (lang === "bn" ? "সম্পূর্ণ" : "Complete") : (lang === "bn" ? "অসম্পূর্ণ" : "Incomplete")}
            lang={lang}
          />
        </div>
      ),
    },
    {
      id: "day85",
      header: "Day-85",
      cell: (l) => (
        <ErpStatusChip
          status={day85StatusKind(l.day85?.stage, l.day85?.redCard)}
          label={`${l.day85?.redCard ? "RED · " : ""}${day85Label(l.day85)}`}
          lang={lang}
        />
      ),
    },
    {
      id: "pax",
      header: "Pax",
      align: "center",
      cell: (l) => <span className="text-sm font-bold tabular-nums" style={{ fontFamily: "var(--font-mono)" }}>{l.pax}</span>,
    },
    {
      id: "status",
      header: lang === "bn" ? "স্ট্যাটাস" : "Status",
      cell: (l) => <ErpStatusChip status={lsStatusKind(l.status)} label={l.status} lang={lang} />,
    },
  ];

  const quickFilters: { id: LsQuickFilter; labelBn: string; labelEn: string }[] = [
    { id: "", labelBn: "সব", labelEn: "All" },
    { id: "host", labelBn: "হোস্ট সম্পূর্ণ", labelEn: "Host Complete" },
    { id: "red", labelBn: "রেড কার্ড", labelEn: "Red cards" },
    { id: "APPROACHING", labelBn: "কাছাকাছি", labelEn: "Approaching" },
    { id: "DUE", labelBn: "Day-85 ডিউ", labelEn: "Day-85 Due" },
    { id: "ESCALATED", labelBn: "Day-90", labelEn: "Day-90 Escalated" },
    { id: "RESOLVED", labelBn: "সমাধান", labelEn: "Resolved" },
    { id: "COMPLETED", labelBn: "সম্পন্ন", labelEn: "Completed" },
  ];

  if (!demo && state === "error") {
    return (
      <div className="p-7" style={{ fontFamily: fontFor(lang) }}>
        <ErrorState tone="light" lang={lang} onRetry={refresh} />
      </div>
    );
  }

  return (
    <div style={{ fontFamily: fontFor(lang) }}>
      <ErpPageTemplate
        title={lang === "bn" ? "লং স্টে" : "Long Stay"}
        subtitle={lang === "bn" ? "হোস্ট · ইকামা · Day-85 কমপ্লায়েন্স" : "Host · Iqama · Day-85 compliance"}
        primaryAction={
          <div className="flex flex-wrap gap-2">
            <ErpButton variant="secondary" icon={<RefreshCw size={14} />} onClick={refresh}>
              {lang === "bn" ? "রিফ্রেশ" : "Refresh"}
            </ErpButton>
            <ErpButton variant="primary" icon={<Plus size={14} />} onClick={() => setShowCreate(true)} disabled={demo}>
              {lang === "bn" ? "নতুন লং স্টে" : "New Long Stay"}
            </ErpButton>
          </div>
        }
        toolbar={
          <div className="flex flex-col gap-3 w-full">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: "host" as LsQuickFilter, labelBn: "হোস্ট সম্পূর্ণ", labelEn: "Host Complete", value: summary.hostComplete },
                { id: "DUE" as LsQuickFilter, labelBn: "Day-85 ডিউ", labelEn: "Day-85 Due", value: summary.day85Due },
                { id: "ESCALATED" as LsQuickFilter, labelBn: "Day-90 এসকেলেটেড", labelEn: "Day-90 Escalated", value: summary.day90Esc },
                { id: "COMPLETED" as LsQuickFilter, labelBn: "সম্পন্ন", labelEn: "Completed", value: summary.completed },
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setQuick(s.id)}
                  className="text-left rounded-xl px-3 py-2.5 transition-colors"
                  style={{
                    backgroundColor: quick === s.id ? `${OPS}12` : "#FFFFFF",
                    border: `1px solid ${quick === s.id ? OPS : "rgba(11,30,63,0.11)"}`,
                  }}
                >
                  <div className="text-lg font-bold tabular-nums text-[#0B1E3F]" style={{ fontFamily: "var(--font-mono)" }}>{s.value}</div>
                  <div className="text-[10px]" style={{ color: "rgba(11,30,63,0.55)" }}>{lang === "bn" ? s.labelBn : s.labelEn}</div>
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {quickFilters.map((c) => (
                <ErpButton
                  key={c.id || "all"}
                  size="sm"
                  variant={quick === c.id ? "primary" : "outline"}
                  onClick={() => setQuick(c.id)}
                >
                  {lang === "bn" ? c.labelBn : c.labelEn}
                </ErpButton>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full">
              <div className="flex-1 min-w-0">
                <ErpSearchBar
                  lang={lang}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onClear={() => setQ("")}
                  placeholder={lang === "bn"
                    ? "যাত্রীর নাম, হোস্ট অথবা ইকামা নম্বর লিখুন..."
                    : "Search passenger name, host, or iqama number…"}
                />
              </div>
              <ErpFilterPanel
                open={filtersOpen}
                onOpenChange={setFiltersOpen}
                lang={lang}
                activeCount={(hostFilter !== "all" ? 1 : 0) + (visaType ? 1 : 0)}
              >
                <ErpForm columns={2}>
                  <ErpField label={lang === "bn" ? "হোস্ট সম্পূর্ণ" : "Host Complete"}>
                    <ErpSelect value={hostFilter} onChange={(e) => setHostFilter(e.target.value as typeof hostFilter)}>
                      <option value="all">{lang === "bn" ? "সব" : "All"}</option>
                      <option value="yes">{lang === "bn" ? "হ্যাঁ" : "Yes"}</option>
                      <option value="no">{lang === "bn" ? "না" : "No"}</option>
                    </ErpSelect>
                  </ErpField>
                  <ErpField label={lang === "bn" ? "ভিসার ধরন" : "Visa Type"}>
                    <ErpSelect value={visaType} onChange={(e) => setVisaType(e.target.value)}>
                      <option value="">{lang === "bn" ? "সব" : "All"}</option>
                      <option value="LONG_STAY">Long Stay</option>
                      <option value="UMRAH">Umrah</option>
                      <option value="HAJJ">Hajj</option>
                    </ErpSelect>
                  </ErpField>
                  <ErpFormRow span={2}>
                    <p className="text-[11px]" style={{ color: "rgba(11,30,63,0.50)" }}>
                      {lang === "bn"
                        ? "Day-85 / Day-90 / Resolved — উপরের কুইক ফিল্টার ব্যবহার করুন (একই বোর্ড ফিল্ড)।"
                        : "Day-85 / Day-90 / Resolved — use quick filters above (same board fields)."}
                    </p>
                  </ErpFormRow>
                </ErpForm>
              </ErpFilterPanel>
            </div>
          </div>
        }
        footer={
          <ErpPagination page={safePage} pageSize={PAGE} total={filtered.length} onPageChange={setPage} lang={lang} />
        }
      >
        <ErpDataTable
          columns={columns}
          rows={!ready || state === "loading" ? [] : pageRows}
          rowKey={(l) => l.id}
          loading={!ready || state === "loading"}
          lang={lang}
          onRowClick={(l) => { if (!demo) setSel(l); }}
          emptyTitle={lang === "bn" ? "কোনো তথ্য পাওয়া যায়নি" : "No long stays"}
          emptyHint={lang === "bn" ? "বর্ধিত হোটেল অবস্থান এখানে দেখা যাবে।" : "Extended hotel occupancies appear here."}
          emptyAction={
            <ErpButton variant="primary" icon={<RefreshCw size={14} />} onClick={refresh}>
              {lang === "bn" ? "রিফ্রেশ" : "Refresh"}
            </ErpButton>
          }
          rowActions={(l) => (
            <ErpButton
              size="sm"
              variant="ghost"
              icon={<Eye size={13} />}
              disabled={demo}
              onClick={(e) => { e.stopPropagation(); setSel(l); }}
            >
              {lang === "bn" ? "খুলুন" : "Open"}
            </ErpButton>
          )}
        />
      </ErpPageTemplate>

      <LongStayDrawer
        row={sel}
        open={!!sel}
        onClose={() => setSel(null)}
        onSaved={refresh}
        demo={demo}
      />
      <CreateLongStayDrawer
        apiGroups={apiGroups}
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={refresh}
        demo={demo}
      />
    </div>
  );
}

// ─── 8. BRN Management ───────────────────────────────────────────────────────

function BRNManagement({ signal, apiGroups }: { signal: number; apiGroups: ApiGroup[] | null }) {
  const [view, setView] = useState<"list"|"create">("list");
  const [selBrn, setSelBrn] = useState<string|null>(null);
  const demo = !isLoggedIn();
  const [live, setLive] = useState<ApiBrn[] | null>(null);
  const [state, setState] = useState<FeedState>(demo ? "ready" : "loading");
  const [statusBusy, setStatusBusy] = useState(false);
  const refresh = () => {
    if (!isLoggedIn()) { setLive(null); setState("ready"); return; }
    setState("loading");
    api.get<ApiBrn[]>("/ops/brns")
      .then((r) => { setLive(r); setState("ready"); })
      .catch(() => { setLive(null); setState("error"); });
  };
  useEffect(() => {
    const t = setTimeout(refresh, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signal]);

  const rows: BRNRec[] = demo
    ? BRNS
    : (live ?? []).map((b) => ({ id: b.code, realId: b.id, group: b.group ?? "—", agent: b.agent ?? "—", service: b.service, created: fmtDay(b.created), status: b.status as BRNStatus, detail: b.detail ?? "" }));
  const ready = demo || state === "ready";
  const selectedBrn = rows.find((b) => b.id === selBrn);
  const opts = groupOptions(apiGroups);

  const BRN_CYCLE: Record<BRNStatus, BRNStatus> = { OPEN:"PROCESSING", PROCESSING:"FULFILLED", FULFILLED:"CANCELLED", CANCELLED:"OPEN" };
  const updateStatus = async (b: BRNRec) => {
    if (!b.realId) { toast.error("Sign in as ops staff to update status."); return; }
    const next = BRN_CYCLE[b.status];
    setStatusBusy(true);
    try {
      await api.patch(`/ops/brns/${b.realId}/status`, { status: next });
      toast.success(`BRN ${b.id} → ${next}`);
      refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not update status");
    } finally {
      setStatusBusy(false);
    }
  };

  // Create-form state (hooks must live at the top level, not inside the create branch).
  const [cGroup, setCGroup] = useState("");
  const [cService, setCService] = useState("Hotel");
  const [cDate, setCDate] = useState("");
  const [cPriority, setCPriority] = useState("Normal");
  const [cDetail, setCDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const submitBrn = async () => {
    const groupId = cGroup || opts[0]?.value;
    if (!groupId) { toast.error("Select a group."); return; }
    setBusy(true);
    try {
      const created = await api.post<{ code: string }>("/ops/brns", {
        groupId, serviceScope: cService,
        detail: cDetail.trim() || undefined, dateRequired: cDate || undefined, priority: cPriority.toUpperCase(),
      });
      toast.success(`BRN ${created.code} created`);
      setCDetail(""); setCDate("");
      setView("list");
      refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not create BRN");
    } finally {
      setBusy(false);
    }
  };

  if (view === "create") {
    const IS = { backgroundColor:"#F5F7FA", border:"1px solid rgba(11,30,63,0.15)", color:"#0B1E3F" } as CSSProperties;
    const FF = ({ label, children }: { label:string; children:ReactNode }) => (
      <div>
        <label className="text-[9px] font-black uppercase tracking-widest block mb-1.5" style={{ color:"rgba(11,30,63,0.50)" }}>{label}</label>
        {children}
      </div>
    );
    return (
      <div className="p-7">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => setView("list")} className="text-xs font-bold" style={{ color:"rgba(11,30,63,0.58)" }}>← Back</button>
          <h2 className="text-sm font-bold text-[#0B1E3F]">Create New BRN</h2>
        </div>
        <div className="max-w-2xl space-y-4">
          <div className="rounded-2xl p-5 grid grid-cols-2 gap-4" style={{ backgroundColor:"#FFFFFF", border:"1px solid rgba(11,30,63,0.11)" }}>
            <FF label="Group ID"><select value={cGroup || (opts[0]?.value ?? "")} onChange={(e)=>setCGroup(e.target.value)} className="w-full px-3 py-2.5 text-xs rounded-xl focus:outline-none appearance-none" style={IS}>{opts.map((o)=><option key={o.value} value={o.value} style={{ color:"black" }}>{o.label}</option>)}</select></FF>
            <FF label="Service Type"><select value={cService} onChange={(e)=>setCService(e.target.value)} className="w-full px-3 py-2.5 text-xs rounded-xl focus:outline-none appearance-none" style={IS}><option>Hotel</option><option>Transport</option><option>Catering</option><option>Meet & Assist</option><option>Full Package</option></select></FF>
            <FF label="Date Required"><input type="date" value={cDate} onChange={(e)=>setCDate(e.target.value)} className="w-full px-3 py-2.5 text-xs rounded-xl focus:outline-none" style={IS} /></FF>
            <FF label="Priority"><select value={cPriority} onChange={(e)=>setCPriority(e.target.value)} className="w-full px-3 py-2.5 text-xs rounded-xl focus:outline-none appearance-none" style={IS}><option>Normal</option><option>High</option><option>Urgent</option></select></FF>
            <div className="col-span-2">
              <FF label="Service Detail"><textarea value={cDetail} onChange={(e)=>setCDetail(e.target.value)} rows={3} placeholder="Describe the service requirement in detail…" className="w-full px-3 py-2.5 text-xs rounded-xl focus:outline-none resize-none" style={IS} /></FF>
            </div>
          </div>
          <button disabled={busy} onClick={() => void submitBrn()} className="px-6 py-3 rounded-xl text-xs font-bold disabled:opacity-50" style={{ backgroundColor:OPS, color:"#0B1E3F" }}>Create BRN</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-7">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-sm font-bold text-[#0B1E3F]">BRN Management</h2>
          <p className="text-xs mt-0.5" style={{ color:"rgba(11,30,63,0.58)" }}>Booking Request Numbers — service request tracking</p>
        </div>
        <button onClick={() => setView("create")} className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold" style={{ backgroundColor:`${OPS}18`, color:OPS }}>
          <Plus size={12} /> New BRN
        </button>
      </div>
      <div className="grid grid-cols-3 gap-5">
        {/* BRN list */}
        <div className="col-span-2 rounded-2xl overflow-hidden" style={{ border:"1px solid rgba(11,30,63,0.11)" }}>
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor:"#FBFCFD", borderBottom:"1px solid rgba(11,30,63,0.11)" }}>
                {["BRN ID","Group","Agent","Service","Created","Status",""].map((c) => (
                  <th key={c} className="px-4 py-3 text-left text-[9px] font-black uppercase tracking-widest" style={{ color:"rgba(11,30,63,0.50)" }}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ready && rows.map((b, i) => (
                <tr key={b.id} onClick={() => setSelBrn(b.id === selBrn ? null : b.id)}
                    style={{ borderBottom: i < rows.length-1 ? "1px solid rgba(11,30,63,0.08)" : undefined, cursor:"pointer", backgroundColor: selBrn === b.id ? `${OPS}08` : undefined }}
                    className="hover:bg-white/2">
                  <td className="px-4 py-3 text-[10px] font-black whitespace-nowrap" style={{ color:OPS, fontFamily:"var(--font-mono)" }}>{b.id}</td>
                  <td className="px-4 py-3 text-[9px] whitespace-nowrap" style={{ color:"rgba(11,30,63,0.76)", fontFamily:"var(--font-mono)" }}>{b.group}</td>
                  <td className="px-4 py-3 text-xs text-[#0B1E3F]"><div className="truncate max-w-[12rem]" title={b.agent}>{b.agent}</div></td>
                  <td className="px-4 py-3 text-[10px]" style={{ color:"rgba(11,30,63,0.66)" }}><div className="truncate max-w-[14rem]" title={b.service}>{b.service}</div></td>
                  <td className="px-4 py-3 text-[10px] whitespace-nowrap" style={{ color:"rgba(11,30,63,0.58)", fontFamily:"var(--font-mono)" }}>{b.created}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black" style={{ backgroundColor:BRN_STAT[b.status].bg, color:BRN_STAT[b.status].color }}>{b.status}</span>
                  </td>
                  <td className="px-4 py-3"><ChevronRight size={12} style={{ color:"rgba(11,30,63,0.50)" }} /></td>
                </tr>
              ))}
              {(!ready || rows.length === 0) && (
                <BoardState cols={7} demo={demo} state={state} onRetry={refresh}
                  title="No booking requests" hint="Agent service requests appear here as BRNs." />
              )}
            </tbody>
          </table>
        </div>
        {/* Detail panel */}
        <div>
          {selectedBrn ? (
            <div className="rounded-2xl overflow-hidden" style={{ border:`1px solid ${OPS}30` }}>
              <div className="px-4 py-3" style={{ backgroundColor:`${OPS}10`, borderBottom:`1px solid ${OPS}20` }}>
                <div className="text-[9px] font-black uppercase tracking-widest mb-0.5" style={{ color:OPS }}>BRN Detail</div>
                <div className="text-sm font-black text-[#0B1E3F]" style={{ fontFamily:"var(--font-mono)" }}>{selectedBrn.id}</div>
              </div>
              <div className="p-4 space-y-3">
                {[["Group",selectedBrn.group],["Agent",selectedBrn.agent],["Service",selectedBrn.service],["Created",selectedBrn.created],["Status",selectedBrn.status],["Detail",selectedBrn.detail]].map(([l,v])=>(
                  <div key={l as string} className="min-w-0">
                    <div className="text-[9px] font-black uppercase tracking-widest" style={{ color:"rgba(11,30,63,0.50)" }}>{l}</div>
                    <div className="text-xs font-semibold text-[#0B1E3F] mt-0.5 break-words">{v}</div>
                  </div>
                ))}
              </div>
              <div className="px-4 pb-4 flex gap-2">
                <button onClick={() => void updateStatus(selectedBrn)} disabled={statusBusy} className="flex-1 py-2 rounded-xl text-[10px] font-bold disabled:opacity-50" style={{ backgroundColor:`${OPS}18`, color:OPS }}>Update Status</button>
                <button className="flex-1 py-2 rounded-xl text-[10px] font-bold" style={{ backgroundColor:"#F5F7FA", color:"rgba(11,30,63,0.66)" }}>Print BRN</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 rounded-2xl" style={{ border:"1px dashed rgba(11,30,63,0.11)" }}>
              <Hash size={22} style={{ color:"rgba(11,30,63,0.38)" }} />
              <div className="text-xs mt-2" style={{ color:"rgba(11,30,63,0.50)" }}>Select a BRN to view</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 9. Voucher Generator ────────────────────────────────────────────────────

// ─── Main OpsControl ──────────────────────────────────────────────────────────

export default function OpsControl() {
  const [screen, setScreen] = useShellTab<OpsView>(OPS_TAB_IDS, "arrivals");

  // ── Lifted live board state (patched in place by the /ops socket) ──
  const [apiGroups, setApiGroups] = useState<ApiGroup[] | null>(null);
  const [arrivals, setArrivals] = useState<FlightRec[] | null>(null);
  const [departures, setDepartures] = useState<DepRec[] | null>(null);
  const [dispatches, setDispatches] = useState<DispatchOrder[] | null>(null);
  // Screens that re-fetch on a socket change: bump a signal to trigger their reload.
  const [ziyarahSignal, setZiyarahSignal] = useState(0);
  const [longStaySignal, setLongStaySignal] = useState(0);
  const [brnSignal, setBrnSignal] = useState(0);
  const [maUpdate, setMaUpdate] = useState<{ flightInfoId: string; steps: MAStep[]; v: number } | null>(null);

  // Per-feed loading/error so a failed board shows the designed error state
  // instead of silently swapping in demo flights.
  const demo = !isLoggedIn();
  type FeedKey = "groups" | "arrivals" | "departures" | "dispatches";
  const [feed, setFeed] = useState<Record<FeedKey, FeedState>>(() => {
    const s: FeedState = isLoggedIn() ? "loading" : "ready";
    return { groups: s, arrivals: s, departures: s, dispatches: s };
  });
  const mark = (k: FeedKey, v: FeedState) => setFeed((f) => (f[k] === v ? f : { ...f, [k]: v }));

  const loadGroups = () => {
    if (!isLoggedIn()) { setApiGroups(null); mark("groups", "ready"); return; }
    mark("groups", "loading");
    api.get<ApiGroup[]>("/ops/groups")
      .then((r) => { setApiGroups(r); mark("groups", "ready"); })
      .catch(() => { setApiGroups(null); mark("groups", "error"); });
  };
  const loadArrivals = () => {
    if (!isLoggedIn()) { setArrivals(null); mark("arrivals", "ready"); return; }
    mark("arrivals", "loading");
    api.get<ApiFlight[]>("/ops/arrivals")
      .then((r) => { setArrivals(r.map(toArrivalRec)); mark("arrivals", "ready"); })
      .catch(() => { setArrivals(null); mark("arrivals", "error"); });
  };
  const loadDepartures = () => {
    if (!isLoggedIn()) { setDepartures(null); mark("departures", "ready"); return; }
    mark("departures", "loading");
    api.get<ApiFlight[]>("/ops/departures")
      .then((r) => { setDepartures(r.map(toDepartureRec)); mark("departures", "ready"); })
      .catch(() => { setDepartures(null); mark("departures", "error"); });
  };
  const loadDispatches = () => {
    if (!isLoggedIn()) { setDispatches(null); mark("dispatches", "ready"); return; }
    mark("dispatches", "loading");
    api.get<ApiDispatch[]>("/ops/dispatches")
      .then((r) => { setDispatches(r.map(toDispatchRec)); mark("dispatches", "ready"); })
      .catch(() => { setDispatches(null); mark("dispatches", "error"); });
  };

  // Fetch-on-mount (deferred, matching the SuperAdmin pattern).
  useEffect(() => {
    const t = setTimeout(() => { loadGroups(); loadArrivals(); loadDepartures(); loadDispatches(); }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── ONE live socket subscription for the whole module ──
  const connected = useOpsEvents(
    {
      "flight.status": (p) => {
        const { direction, row } = p as { direction: "ARRIVAL" | "DEPARTURE"; row: ApiFlight };
        if (direction === "ARRIVAL") setArrivals((prev) => (prev ? prev.map((r) => (r.id === row.id ? toArrivalRec(row) : r)) : prev));
        else setDepartures((prev) => (prev ? prev.map((r) => (r.id === row.id ? toDepartureRec(row) : r)) : prev));
      },
      "dispatch.status": (p) => {
        const row = (p as { row: ApiDispatch }).row;
        setDispatches((prev) => (prev ? prev.map((d) => (d.id === row.id ? toDispatchRec(row) : d)) : prev));
      },
      "dispatch.created": (p) => {
        const row = (p as { row: ApiDispatch }).row;
        setDispatches((prev) => (prev ? (prev.some((d) => d.id === row.id) ? prev : [toDispatchRec(row), ...prev]) : prev));
      },
      "meetassist.updated": (p) => {
        const m = p as ApiMeetAssist;
        setMaUpdate({ flightInfoId: m.flightInfoId, steps: m.steps, v: Date.now() });
      },
      "ziyarah.changed": () => setZiyarahSignal((s) => s + 1),
      "longstay.changed": () => setLongStaySignal((s) => s + 1),
      "brn.changed": () => setBrnSignal((s) => s + 1),
      "group.arrival": (p) => { loadGroups(); const g = p as { group?: string }; toast(`Arrival update${g.group ? ` · ${g.group}` : ""}`); },
      "group.departure": (p) => { loadGroups(); const g = p as { group?: string }; toast(`Departure update${g.group ? ` · ${g.group}` : ""}`); },
    },
    // After a drop→reconnect, re-fetch everything so nothing is missed offline.
    () => {
      loadArrivals(); loadDepartures(); loadDispatches(); loadGroups();
      setZiyarahSignal((s) => s + 1); setLongStaySignal((s) => s + 1); setBrnSignal((s) => s + 1);
    },
  );

  const content: Record<OpsView, ReactNode> = {
    groups:     <GroupMaster apiGroups={apiGroups} demo={demo} state={feed.groups} onRetry={loadGroups} />,
    arrivals:   <ArrivalBoard rows={arrivals} connected={connected} onRefresh={loadArrivals} demo={demo} state={feed.arrivals} />,
    departures: <DepartureBoard rows={departures} connected={connected} demo={demo} state={feed.departures} onRefresh={loadDepartures} />,
    dispatch:   <DispatchBoard rows={dispatches} connected={connected} apiGroups={apiGroups} onRefresh={loadDispatches} demo={demo} state={feed.dispatches} />,
    maassist:   <MeetAssist arrivals={arrivals} maUpdate={maUpdate} demo={demo} state={feed.arrivals} onRetry={loadArrivals} />,
    ziyarah:    <ZiyarahScreen signal={ziyarahSignal} apiGroups={apiGroups} />,
    longstay:   <LongStayScreen signal={longStaySignal} apiGroups={apiGroups} />,
    brn:        <BRNManagement signal={brnSignal} apiGroups={apiGroups} />,
    vouchers:   (
      <div className="p-7">
        <EmptyState
          tone="light"
          title="ভাউচার জেনারেটর"
          hint="এই মডিউল এখনও কনফিগার করা হয়নি। সাপ্লায়ার গ্রহণের পর ভাউচার স্বয়ংক্রিয়ভাবে ইস্যু হয়।"
        />
      </div>
    ),
  };

  // Board screens get the full-dark treatment — no extra padding wrapper
  const isBoardScreen = ["arrivals","departures","dispatch"].includes(screen);

  return (
    <ERPShell
      moduleId="ops"
      moduleName="Operations Control"
      moduleColor={OPS}
      moduleIcon={Zap as IconFC}
      navItems={OPS_NAV}
      activeItem={screen}
      onItemClick={(id) => setScreen(id as OpsView)}
      breadcrumb={[SCREEN_LABELS[screen] ?? screen]}
      notificationCount={5}
      userName="Ops Control Room"
      userRole="TUBA AL HIJAZ · Umrah Season 1446H"
    >
      <div className={`flex flex-col h-full overflow-hidden${isBoardScreen ? "" : ""}`} style={{ backgroundColor: isBoardScreen ? CR_BG : undefined }}>
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth:"thin", scrollbarColor:"rgba(11,30,63,0.38) transparent" }}>
          {content[screen]}
        </div>
      </div>
    </ERPShell>
  );
}
