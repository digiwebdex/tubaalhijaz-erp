import { useState, useEffect, useCallback, useRef, type ReactNode, type CSSProperties } from "react";
import { api, ApiError, isLoggedIn } from "../lib/api";
import { EmptyState, LoadingSkeleton, ErrorState } from "../components/States";
import {
  LayoutDashboard, Truck, IdCard, ShieldCheck, Fuel, Wrench, Shield,
  MapPin, Route, Plus, X, Trash2, Pencil, RefreshCw,
  AlertTriangle, Navigation, Clock, Send, Users, Gauge, Droplet,
  FileText,
} from "lucide-react";
import { ERPShell, type NavItem, type IconFC } from "../components/ERPShell";
import {
  ErpPageTemplate, ErpButton, ErpSearchBar, ErpFilterPanel, ErpDataTable,
  ErpPagination, ErpDrawer, ErpDrawerFooterActions, ErpForm, ErpFormRow, ErpField,
  ErpInput, ErpSelect, ErpTextarea, ErpStatusChip, ErpDeleteDialog, erpToast,
  type ErpColumn, type ErpStatusKind,
} from "../components/erp";
import { useLang } from "../lib/LangContext";
import { fontFor } from "@tuba/shared";

// ─── Constants ────────────────────────────────────────────────────────────────

const FLEET = "var(--erp-muted)";   // slate — matches GLOBAL_MODS fleet entry
const FUEL_C = "#0EA5E9";  // fuel bar
const MAINT_C = "var(--erp-warning)"; // maintenance bar

type FleetScreen =
  | "dashboard" | "vehicles" | "drivers" | "compliance" | "fuel"
  | "maintenance" | "insurance" | "gps" | "dispatch";

const FLEET_NAV: NavItem[] = [
  { id:"dashboard",   label:"Fleet Dashboard",     icon: LayoutDashboard as IconFC },
  { id:"vehicles",    label:"Vehicle Master",      icon: Truck           as IconFC },
  { id:"drivers",     label:"Driver Master",       icon: IdCard          as IconFC },
  { id:"compliance",  label:"Documents & Expiry",  icon: ShieldCheck     as IconFC, badge:3 },
  { id:"fuel",        label:"Fuel Log",            icon: Fuel            as IconFC },
  { id:"maintenance", label:"Maintenance",         icon: Wrench          as IconFC },
  { id:"insurance",   label:"Insurance",           icon: Shield          as IconFC },
  { id:"gps",         label:"GPS Map",             icon: MapPin          as IconFC },
  { id:"dispatch",    label:"Dispatch Assignment", icon: Route           as IconFC, badge:2 },
];

const LABELS: Record<FleetScreen, string> = {
  dashboard:"Fleet Dashboard", vehicles:"Vehicle Master", drivers:"Driver Master",
  compliance:"Documents & Expiry", fuel:"Fuel Log", maintenance:"Maintenance",
  insurance:"Insurance", gps:"GPS Map", dispatch:"Dispatch Assignment",
};

// ─── API response types ───────────────────────────────────────────────────────

type Severity = "EXPIRED" | "CRITICAL" | "WARNING" | null;

interface ExpiringItem {
  kind:string; refId:string; vehicleId?:string; subject:string; detail:string;
  expiryDate:string; daysLeft:number; severity:string;
}
interface DashData {
  fleet:{ total:number; active:number; maintenance:number; retired:number };
  drivers:Record<string, number>;
  expiring:{ total:number; critical:number; items:ExpiringItem[] };
  cost:{ mtd:number; ytd:number; trend:{ month:string; fuel:number; maintenance:number; total:number }[] };
  utilization:{ activeDispatch:number; pct:number };
}
interface VehicleRow {
  id:string; code:string; type:string; plateNo:string|null; seats:number|null; status:string;
  notes:string|null; owner:string|null; supplierId:string|null;
  lastLat:number|null; lastLng:number|null; lastLocationLabel:string|null; lastLocationAt:string|null;
  docCount:number; nextDocExpiry:string|null; nextDocDays:number|null;
  insuranceExpiry:string|null; insuranceDays:number|null; docSeverity:Severity;
}
interface VehicleDocument {
  id:string; vehicleId:string; type:string; docNo:string|null; issueDate:string|null;
  expiryDate:string; fileId:string|null; notes:string|null; createdAt:string;
}
interface InsurancePolicy {
  id:string; vehicleId:string; provider:string; policyNo:string; startDate:string; endDate:string;
  premium:number|null; status:string; vehicle?:{ code:string };
}
interface FuelLog {
  id:string; vehicleId:string; driverId:string|null; date:string; liters:number; cost:number;
  odometerKm:number|null; notes:string|null; vehicle?:{ code:string }; driver?:{ name:string }|null;
}
interface MaintenanceRecord {
  id:string; vehicleId:string; type:string; description:string; date:string; cost:number|null;
  odometerKm:number|null; nextDueDate:string|null; workshop:string|null; vehicle?:{ code:string };
}
interface VehicleLocation {
  id?:string; vehicleId?:string; lat:number; lng:number; label:string|null; at?:string;
  speedKmh?:number|null; source?:string;
}
interface VehicleDetail extends VehicleRow {
  documents:VehicleDocument[]; insurancePolicies:InsurancePolicy[]; fuelLogs:FuelLog[];
  maintenanceRecords:MaintenanceRecord[]; locations:VehicleLocation[];
  supplier:{ id:string; name:string }|null;
}
interface DriverRow {
  id:string; name:string; nameBn:string|null; phone:string|null; licenseNo:string|null;
  licenseExpiry:string|null; licenseDays:number|null; licenseSeverity:Severity;
  status:string; rating:number|null; owner:string|null; supplierId:string|null;
}
interface MapVehicle {
  id:string; code:string; type:string; status:string; lat:number; lng:number;
  label:string|null; at:string|null; activeDispatch:boolean;
}
interface Dispatch {
  id:string; code:string; status:string; routeFrom:string|null; routeTo:string|null;
  pax:number|null; scheduledAt:string|null;
  group:{ code:string; tenant:{ name:string } }|null;
  vehicle:{ code:string }|null; driver:{ name:string }|null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const IS: CSSProperties = { backgroundColor:"var(--erp-canvas)", border:"1px solid rgba(11,30,63,0.15)", color:"var(--erp-text-strong)" };
const CARD: CSSProperties = { backgroundColor:"var(--erp-surface-soft)", border:"1px solid rgba(11,30,63,0.11)" };
const PANEL: CSSProperties = { backgroundColor:"var(--erp-surface)", border:"1px solid rgba(11,30,63,0.11)" };

const fmtDate = (iso:string|null|undefined) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" }) : "—";
const money = (v:number|null|undefined) => `SAR ${(v ?? 0).toLocaleString()}`;

const STAT_C: Record<string,string> = {
  ACTIVE:"var(--erp-success)", AVAILABLE:"var(--erp-success)", ASSIGNED:"var(--erp-success)", CONFIRMED:"var(--erp-success)", PREVENTIVE:"var(--erp-success)",
  ON_TRIP:"var(--erp-info)", INSPECTION:"var(--erp-info)", SCHEDULED:"var(--erp-info)",
  MAINTENANCE:"var(--erp-warning)", PENDING:"var(--erp-warning)",
  RETIRED:"var(--erp-muted-soft)", IDLE:"var(--erp-muted-soft)", OFF:"var(--erp-muted-soft)", INACTIVE:"var(--erp-muted-soft)",
  EXPIRED:"var(--erp-destructive)", CANCELLED:"var(--erp-destructive)", REPAIR:"var(--erp-destructive)",
};

function sevColor(s:string|null|undefined):string {
  return s==="EXPIRED" ? "var(--erp-destructive)" : s==="CRITICAL" ? "var(--erp-warning)" : s==="WARNING" ? "var(--erp-muted-soft)" : "rgba(11,30,63,0.66)";
}

function fleetStatusKind(s: string): ErpStatusKind {
  const u = s.toUpperCase();
  if (["ACTIVE", "AVAILABLE", "ASSIGNED", "CONFIRMED", "PREVENTIVE"].includes(u)) return "approved";
  if (["ON_TRIP", "INSPECTION", "SCHEDULED"].includes(u)) return "info";
  if (["MAINTENANCE", "PENDING"].includes(u)) return "warning";
  if (["EXPIRED", "CANCELLED", "REPAIR"].includes(u)) return "rejected";
  if (["RETIRED", "IDLE", "OFF", "INACTIVE"].includes(u)) return "cancelled";
  return "info";
}

function Chip({ s }:{ s:string }) {
  return <ErpStatusChip status={fleetStatusKind(s)} label={s.replace(/_/g, " ")} />;
}

function SevChip({ s }:{ s:string }) {
  const kind: ErpStatusKind =
    s === "EXPIRED" ? "rejected" : s === "CRITICAL" ? "warning" : s === "WARNING" ? "info" : "pending";
  return <ErpStatusChip status={kind} label={s} />;
}

function TH({ cols }:{ cols:string[] }) {
  return (
    <thead>
      <tr style={{ backgroundColor:"var(--erp-surface-soft)", borderBottom:"1px solid rgba(11,30,63,0.11)" }}>
        {cols.map(c => (
          <th key={c} className="px-4 py-2.5 text-left text-[9px] font-black uppercase tracking-widest whitespace-nowrap" style={{ color:"rgba(11,30,63,0.50)" }}>{c}</th>
        ))}
      </tr>
    </thead>
  );
}

function FKpi({ label, value, sub, color, icon:Icon }:{ label:string; value:string; sub?:string; color:string; icon:IconFC }) {
  return (
    <div className="rounded-2xl p-5" style={CARD}>
      <div className="flex items-start justify-between mb-4">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor:`${color}18` }}>
          <Icon size={16} style={{ color }} />
        </div>
      </div>
      <div className="text-xl font-black text-[var(--erp-text-strong)] mb-0.5" style={{ fontFamily:"var(--font-mono)" }}>{value}</div>
      <div className="text-xs" style={{ color:"rgba(11,30,63,0.66)" }}>{label}</div>
      {sub && <div className="text-[9px] mt-0.5" style={{ color:"rgba(11,30,63,0.50)" }}>{sub}</div>}
    </div>
  );
}

/** ESP-01 — ActionBtn → ErpButton adapter (keeps call sites; no business change). */
function ActionBtn({ label, color, icon:Icon, onClick, disabled }:{ label:string; color?:string; icon?:IconFC; onClick?:()=>void; disabled?:boolean }) {
  return (
    <ErpButton
      size="sm"
      variant={color ? "primary" : "secondary"}
      icon={Icon ? <Icon size={14} /> : undefined}
      onClick={onClick}
      disabled={disabled}
      style={color ? { backgroundColor: color, color: "var(--erp-text-strong)" } : undefined}
    >
      {label}
    </ErpButton>
  );
}

function Field({ label, children }:{ label:string; children:ReactNode }) {
  return <ErpField label={label}>{children}</ErpField>;
}


const inputCls = "w-full px-3 py-2.5 text-xs rounded-xl focus:outline-none";
const inputSelCls = "w-full px-3 py-2.5 text-xs rounded-xl focus:outline-none appearance-none";

// ─── Live-data plumbing ───────────────────────────────────────────────────────
// One place for the loading / error / empty contract so no screen can silently
// serve MOCK_* data to a logged-in tenant:
//   logged out → data:null (screens fall back to mock)   · loading → skeleton
//   request failed → ErrorState + retry                  · loaded → real rows (even if [])
interface FleetState<T> { data: T | null; loading: boolean; error: boolean; reload: (spinner?: boolean) => void }

function useFleet<T>(path: string): FleetState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(isLoggedIn());
  const [error, setError] = useState(false);
  const reqRef = useRef(0);
  const dataRef = useRef<T | null>(null);

  const reload = useCallback((spinner = false) => {
    if (!isLoggedIn()) { dataRef.current = null; setData(null); setLoading(false); setError(false); return; }
    const id = ++reqRef.current;
    // Skeleton only when there is nothing to keep on screen (first load / retry after
    // error) — a filter change refetches without tearing the table out from under the
    // controls the user is still using.
    if (spinner && dataRef.current === null) setLoading(true);
    setError(false);
    api.get<T>(path)
      .then(d => { if (id === reqRef.current) { dataRef.current = d; setData(d); setLoading(false); } })
      .catch(() => { if (id === reqRef.current) { dataRef.current = null; setData(null); setError(true); setLoading(false); } });
  }, [path]);

  useEffect(() => {
    reload(true);
    return () => { reqRef.current++; };
  }, [reload]);

  return { data, loading, error, reload };
}

// Screen-level loading / error frames — same p-7 gutter the screens already use,
// so nothing shifts when the data lands.
function ScreenLoading({ rows = 6 }: { rows?: number }) {
  return <div className="p-7"><LoadingSkeleton tone="light" rows={rows} /></div>;
}
function ScreenError({ onRetry }: { onRetry: () => void }) {
  return <div className="p-7"><ErrorState tone="light" onRetry={onRetry} /></div>;
}
/** Designed empty row spanning a table body. */
function EmptyRow({ cols, title, hint }: { cols:number; title:string; hint?:string }) {
  return <tr><td colSpan={cols} className="px-4"><EmptyState tone="light" title={title} hint={hint} /></td></tr>;
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const VEHICLE_TYPES = ["BUS","COASTER","VAN","SEDAN","SUV"];
const DOC_TYPES = ["REGISTRATION","INSPECTION","OPERATING_CARD","PERMIT","OTHER"];

const MOCK_VEHICLES: VehicleRow[] = [
  { id:"v1", code:"BUS-01", type:"BUS", plateNo:"RSD-4821", seats:50, status:"ACTIVE", notes:"Primary Makkah–Madinah coach", owner:"OWNED", supplierId:null,
    lastLat:21.4225, lastLng:39.8262, lastLocationLabel:"Makkah Haram", lastLocationAt:"2026-07-18T06:20:00Z",
    docCount:4, nextDocExpiry:"2026-08-02", nextDocDays:15, insuranceExpiry:"2026-09-30", insuranceDays:74, docSeverity:"CRITICAL" },
  { id:"v2", code:"BUS-02", type:"BUS", plateNo:"RSD-4822", seats:50, status:"ACTIVE", notes:null, owner:"OWNED", supplierId:null,
    lastLat:24.4672, lastLng:39.6111, lastLocationLabel:"Madinah Depot", lastLocationAt:"2026-07-18T05:10:00Z",
    docCount:4, nextDocExpiry:"2026-11-14", nextDocDays:119, insuranceExpiry:"2026-10-20", insuranceDays:94, docSeverity:null },
  { id:"v3", code:"COA-11", type:"COASTER", plateNo:"JED-2210", seats:22, status:"MAINTENANCE", notes:"Gearbox service", owner:"Al-Naqil Transport", supplierId:"sup1",
    lastLat:21.6796, lastLng:39.1565, lastLocationLabel:"Jeddah Airport", lastLocationAt:"2026-07-17T18:40:00Z",
    docCount:3, nextDocExpiry:"2026-07-24", nextDocDays:6, insuranceExpiry:"2026-07-31", insuranceDays:13, docSeverity:"CRITICAL" },
  { id:"v4", code:"VAN-07", type:"VAN", plateNo:"MAK-9014", seats:14, status:"ACTIVE", notes:null, owner:"OWNED", supplierId:null,
    lastLat:21.3891, lastLng:39.8579, lastLocationLabel:"Aziziyah", lastLocationAt:"2026-07-18T04:00:00Z",
    docCount:4, nextDocExpiry:"2026-07-12", nextDocDays:-6, insuranceExpiry:"2026-12-01", insuranceDays:136, docSeverity:"EXPIRED" },
  { id:"v5", code:"SED-03", type:"SEDAN", plateNo:"MAK-5501", seats:4, status:"IDLE", notes:"VIP transfers", owner:"OWNED", supplierId:null,
    lastLat:21.4241, lastLng:39.8173, lastLocationLabel:"Head Office", lastLocationAt:"2026-07-16T09:30:00Z",
    docCount:4, nextDocExpiry:"2027-01-18", nextDocDays:184, insuranceExpiry:"2026-08-14", insuranceDays:27, docSeverity:"WARNING" },
];

const MOCK_DRIVERS: DriverRow[] = [
  { id:"d1", name:"Bassem Khalil", nameBn:null, phone:"+966 55 118 2201", licenseNo:"KSA-DL-889201", licenseExpiry:"2026-07-29", licenseDays:11, licenseSeverity:"CRITICAL", status:"ON_TRIP", rating:4.8, owner:"OWNED", supplierId:null },
  { id:"d2", name:"Imran Hossain", nameBn:"ইমরান হোসেন", phone:"+966 56 442 7788", licenseNo:"KSA-DL-773410", licenseExpiry:"2027-03-15", licenseDays:240, licenseSeverity:null, status:"AVAILABLE", rating:4.6, owner:"OWNED", supplierId:null },
  { id:"d3", name:"Yusuf Rahman", nameBn:"ইউসুফ রহমান", phone:"+966 50 990 1122", licenseNo:"KSA-DL-560033", licenseExpiry:"2026-07-10", licenseDays:-8, licenseSeverity:"EXPIRED", status:"OFF", rating:4.3, owner:"Al-Naqil Transport", supplierId:"sup1" },
  { id:"d4", name:"Ahmed Siddiqui", nameBn:null, phone:"+966 53 771 6650", licenseNo:"KSA-DL-201984", licenseExpiry:"2026-08-20", licenseDays:33, licenseSeverity:"WARNING", status:"AVAILABLE", rating:4.9, owner:"OWNED", supplierId:null },
];

const MOCK_EXPIRING: ExpiringItem[] = [
  { kind:"REGISTRATION", refId:"v4", vehicleId:"v4", subject:"VAN-07 · Registration", detail:"Istimara expired", expiryDate:"2026-07-12", daysLeft:-6, severity:"EXPIRED" },
  { kind:"LICENSE", refId:"d3", subject:"Yusuf Rahman · License", detail:"KSA-DL-560033", expiryDate:"2026-07-10", daysLeft:-8, severity:"EXPIRED" },
  { kind:"INSPECTION", refId:"v3", vehicleId:"v3", subject:"COA-11 · Inspection", detail:"Fahes due", expiryDate:"2026-07-24", daysLeft:6, severity:"CRITICAL" },
  { kind:"LICENSE", refId:"d1", subject:"Bassem Khalil · License", detail:"KSA-DL-889201", expiryDate:"2026-07-29", daysLeft:11, severity:"CRITICAL" },
  { kind:"OPERATING_CARD", refId:"v1", vehicleId:"v1", subject:"BUS-01 · Operating Card", detail:"Tashghil card", expiryDate:"2026-08-02", daysLeft:15, severity:"CRITICAL" },
  { kind:"INSURANCE", refId:"v5", vehicleId:"v5", subject:"SED-03 · Insurance", detail:"Tawuniya policy", expiryDate:"2026-08-14", daysLeft:27, severity:"WARNING" },
];

const MOCK_TREND = [
  { month:"2026-02", fuel:41000, maintenance:12000, total:53000 },
  { month:"2026-03", fuel:47500, maintenance:28000, total:75500 },
  { month:"2026-04", fuel:52000, maintenance:9000,  total:61000 },
  { month:"2026-05", fuel:58000, maintenance:34000, total:92000 },
  { month:"2026-06", fuel:61000, maintenance:15000, total:76000 },
  { month:"2026-07", fuel:39000, maintenance:22000, total:61000 },
];

const MOCK_DASH: DashData = {
  fleet:{ total:5, active:3, maintenance:1, retired:0 },
  drivers:{ AVAILABLE:2, ON_TRIP:1, OFF:1 },
  expiring:{ total:6, critical:3, items:MOCK_EXPIRING },
  cost:{ mtd:61000, ytd:418500, trend:MOCK_TREND },
  utilization:{ activeDispatch:2, pct:60 },
};

const MOCK_FUEL: FuelLog[] = [
  { id:"f1", vehicleId:"v1", driverId:"d1", date:"2026-07-17", liters:180, cost:1134, odometerKm:184200, notes:null, vehicle:{code:"BUS-01"}, driver:{name:"Bassem Khalil"} },
  { id:"f2", vehicleId:"v2", driverId:"d2", date:"2026-07-16", liters:175, cost:1102, odometerKm:151980, notes:null, vehicle:{code:"BUS-02"}, driver:{name:"Imran Hossain"} },
  { id:"f3", vehicleId:"v4", driverId:"d4", date:"2026-07-15", liters:62,  cost:390,  odometerKm:98120,  notes:"Top-up", vehicle:{code:"VAN-07"}, driver:{name:"Ahmed Siddiqui"} },
  { id:"f4", vehicleId:"v1", driverId:"d1", date:"2026-07-12", liters:190, cost:1197, odometerKm:183100, notes:null, vehicle:{code:"BUS-01"}, driver:{name:"Bassem Khalil"} },
  { id:"f5", vehicleId:"v5", driverId:null, date:"2026-07-10", liters:45,  cost:283,  odometerKm:41220,  notes:null, vehicle:{code:"SED-03"}, driver:null },
];

const MOCK_MAINT: MaintenanceRecord[] = [
  { id:"m1", vehicleId:"v3", type:"REPAIR", description:"Gearbox overhaul", date:"2026-07-16", cost:8600, odometerKm:220400, nextDueDate:null, workshop:"Al-Jazira Motors", vehicle:{code:"COA-11"} },
  { id:"m2", vehicleId:"v1", type:"PREVENTIVE", description:"Oil & filter service", date:"2026-07-08", cost:1200, odometerKm:182500, nextDueDate:"2026-10-08", workshop:"TUBA Workshop", vehicle:{code:"BUS-01"} },
  { id:"m3", vehicleId:"v2", type:"INSPECTION", description:"Annual Fahes inspection", date:"2026-06-28", cost:450, odometerKm:150200, nextDueDate:"2027-06-28", workshop:"Fahes Center Makkah", vehicle:{code:"BUS-02"} },
  { id:"m4", vehicleId:"v4", type:"PREVENTIVE", description:"Brake pads + rotation", date:"2026-06-20", cost:980, odometerKm:96400, nextDueDate:"2026-09-20", workshop:"TUBA Workshop", vehicle:{code:"VAN-07"} },
];

const MOCK_INSURANCE: InsurancePolicy[] = [
  { id:"i1", vehicleId:"v1", provider:"Tawuniya", policyNo:"TW-1446-0011", startDate:"2025-10-01", endDate:"2026-09-30", premium:8400, status:"ACTIVE", vehicle:{code:"BUS-01"} },
  { id:"i2", vehicleId:"v2", provider:"Bupa Arabia", policyNo:"BP-1446-0042", startDate:"2025-10-21", endDate:"2026-10-20", premium:8100, status:"ACTIVE", vehicle:{code:"BUS-02"} },
  { id:"i3", vehicleId:"v3", provider:"Tawuniya", policyNo:"TW-1446-0018", startDate:"2025-08-01", endDate:"2026-07-31", premium:5200, status:"ACTIVE", vehicle:{code:"COA-11"} },
  { id:"i4", vehicleId:"v5", provider:"Al Rajhi Takaful", policyNo:"RT-1446-0090", startDate:"2025-08-15", endDate:"2026-08-14", premium:3100, status:"ACTIVE", vehicle:{code:"SED-03"} },
];

const MOCK_MAP: MapVehicle[] = MOCK_VEHICLES
  .filter(v => v.lastLat !== null && v.lastLng !== null)
  .map(v => ({ id:v.id, code:v.code, type:v.type, status:v.status, lat:v.lastLat as number, lng:v.lastLng as number, label:v.lastLocationLabel, at:v.lastLocationAt, activeDispatch:v.status==="ACTIVE" }));

const MOCK_DISPATCHES: Dispatch[] = [
  { id:"o1", code:"DSP-006", status:"SCHEDULED", routeFrom:"Jeddah Airport", routeTo:"Makkah Hotel", pax:47, scheduledAt:"2026-07-18T14:00:00Z", group:{ code:"GRP-2891", tenant:{ name:"Rashidi Travel Co." } }, vehicle:{ code:"BUS-01" }, driver:{ name:"Bassem Khalil" } },
  { id:"o2", code:"DSP-007", status:"PENDING", routeFrom:"Makkah Hotel", routeTo:"Madinah Hotel", pax:32, scheduledAt:"2026-07-19T07:00:00Z", group:{ code:"GRP-2744", tenant:{ name:"Al-Noor Pilgrim Svc" } }, vehicle:null, driver:null },
  { id:"o3", code:"DSP-008", status:"PENDING", routeFrom:"Madinah Hotel", routeTo:"Madinah Airport", pax:14, scheduledAt:"2026-07-20T10:30:00Z", group:{ code:"GRP-3102", tenant:{ name:"Zamzam Pilgrim Svc" } }, vehicle:null, driver:null },
];

// ─── 1. Dashboard ─────────────────────────────────────────────────────────────

function CostTrendChart({ trend }:{ trend:DashData["cost"]["trend"] }) {
  const max = Math.max(1, ...trend.map(t => t.total));
  if (trend.length === 0) {
    return <EmptyState tone="light" title="No operating cost recorded" hint="Fuel and maintenance entries build this trend." />;
  }
  return (
    <div>
      <div className="flex items-end gap-3 h-40 px-1">
        {trend.map(t => {
          const h = (t.total / max) * 100;
          const fuelPct = t.total ? (t.fuel / t.total) * 100 : 0;
          const maintPct = t.total ? (t.maintenance / t.total) * 100 : 0;
          return (
            <div key={t.month} className="flex-1 flex flex-col items-center justify-end h-full gap-1.5" title={`${t.month} · ${money(t.total)}`}>
              <div className="w-full rounded-md overflow-hidden flex flex-col justify-end" style={{ height:`${h}%`, minHeight:4 }}>
                <div style={{ height:`${maintPct}%`, backgroundColor:MAINT_C }} />
                <div style={{ height:`${fuelPct}%`, backgroundColor:FUEL_C }} />
              </div>
              <span className="text-[9px]" style={{ color:"rgba(11,30,63,0.58)", fontFamily:"var(--font-mono)" }}>{t.month.slice(5)}</span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 mt-3 pt-3" style={{ borderTop:"1px solid rgba(11,30,63,0.11)" }}>
        {[["Fuel",FUEL_C],["Maintenance",MAINT_C]].map(([l,c])=>(
          <div key={l} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor:c }} />
            <span className="text-[10px]" style={{ color:"rgba(11,30,63,0.66)" }}>{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DashboardScreen() {
  const { data: live, loading, error, reload } = useFleet<DashData>("/fleet/dashboard");
  if (loading) return <ScreenLoading />;
  if (error) return <ScreenError onRetry={() => reload(true)} />;
  const d = live ?? MOCK_DASH;
  const driversAvail = d.drivers.AVAILABLE ?? 0;

  return (
    <div className="p-7 space-y-5">
      <div className="grid grid-cols-4 gap-4">
        <FKpi label="Total Vehicles"    value={String(d.fleet.total)}       sub={`${d.fleet.retired} retired`}              color={FLEET}     icon={Truck} />
        <FKpi label="Active"            value={String(d.fleet.active)}      sub="On the road / idle"                        color="var(--erp-success)"   icon={Navigation} />
        <FKpi label="In Maintenance"    value={String(d.fleet.maintenance)} sub="Workshop / off-road"                       color="var(--erp-warning)"   icon={Wrench} />
        <FKpi label="Drivers Available" value={String(driversAvail)}        sub={`${d.drivers.ON_TRIP ?? 0} on trip`}        color="var(--erp-info)"   icon={Users} />
      </div>

      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 rounded-2xl p-5" style={PANEL}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-xs font-bold text-[var(--erp-text-strong)]">Operating Cost — Last 6 Months</div>
              <div className="text-[10px]" style={{ color:"rgba(11,30,63,0.58)" }}>Fuel vs Maintenance (SAR)</div>
            </div>
            <div className="flex gap-2">
              <span className="text-[9px] font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor:`${FUEL_C}18`, color:FUEL_C }}>MTD {money(d.cost.mtd)}</span>
              <span className="text-[9px] font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor:`${FLEET}28`, color:FLEET }}>YTD {money(d.cost.ytd)}</span>
            </div>
          </div>
          <CostTrendChart trend={d.cost.trend} />
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl p-5" style={CARD}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-bold text-[var(--erp-text-strong)]">Fleet Utilization</div>
              <Gauge size={14} style={{ color:FLEET }} />
            </div>
            <div className="text-3xl font-black text-[var(--erp-text-strong)] mb-2" style={{ fontFamily:"var(--font-mono)" }}>{d.utilization.pct}%</div>
            <div className="h-2.5 rounded-full overflow-hidden mb-2" style={{ backgroundColor:"var(--erp-canvas)" }}>
              <div className="h-full rounded-full" style={{ width:`${Math.min(100,d.utilization.pct)}%`, background:`linear-gradient(90deg,${FLEET},var(--erp-muted))` }} />
            </div>
            <div className="text-[10px]" style={{ color:"rgba(11,30,63,0.58)" }}>{d.utilization.activeDispatch} vehicles on active dispatch</div>
          </div>
          <div className="rounded-2xl p-5 flex items-center gap-4" style={{ backgroundColor:"#DC262610", border:"1px solid #DC262630" }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor:"#DC262622" }}>
              <AlertTriangle size={18} style={{ color:"var(--erp-destructive)" }} />
            </div>
            <div>
              <div className="text-xl font-black text-[var(--erp-text-strong)]" style={{ fontFamily:"var(--font-mono)" }}>{d.expiring.total}</div>
              <div className="text-[10px]" style={{ color:"rgba(11,30,63,0.66)" }}>{d.expiring.critical} critical / expired</div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ border:"1px solid rgba(11,30,63,0.11)" }}>
        <div className="px-5 py-3 flex items-center justify-between" style={{ backgroundColor:"var(--erp-surface)", borderBottom:"1px solid rgba(11,30,63,0.11)" }}>
          <span className="text-xs font-bold text-[var(--erp-text-strong)]">Expiring Soon</span>
          <span className="text-[9px]" style={{ color:"rgba(11,30,63,0.58)" }}>Documents · Licenses · Insurance</span>
        </div>
        <div>
          {d.expiring.items.length === 0 && (
            <EmptyState tone="light" title="Nothing expiring soon" hint="Documents, licences and policies are all in date." />
          )}
          {d.expiring.items.map((it, i) => (
            <div key={`${it.kind}-${it.refId}-${i}`} className="flex items-center justify-between px-5 py-3" style={{ borderBottom:i<d.expiring.items.length-1?"1px solid rgba(11,30,63,0.08)":undefined }}>
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-1.5 h-8 rounded-full shrink-0" style={{ backgroundColor:sevColor(it.severity) }} />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[var(--erp-text-strong)] truncate" title={it.subject}>{it.subject}</div>
                  <div className="text-[9px] truncate" title={`${it.kind.replace(/_/g," ")} · ${it.detail}`} style={{ color:"rgba(11,30,63,0.58)" }}>{it.kind.replace(/_/g," ")} · {it.detail}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <div className="text-[10px] font-mono whitespace-nowrap" style={{ color:"rgba(11,30,63,0.76)", fontFamily:"var(--font-mono)" }}>{fmtDate(it.expiryDate)}</div>
                  <div className="text-[9px]" style={{ color:sevColor(it.severity) }}>{it.daysLeft < 0 ? `${Math.abs(it.daysLeft)}d overdue` : `${it.daysLeft}d left`}</div>
                </div>
                <SevChip s={it.severity} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── 2. Vehicle Master ────────────────────────────────────────────────────────

function VehicleDetailDrawer({ id, onClose, onChanged, isLive }:{ id:string; onClose:()=>void; onChanged:()=>void; isLive:boolean }) {
  const [detail, setDetail] = useState<VehicleDetail | null>(null);
  const [detailError, setDetailError] = useState(false);
  const [detailNonce, setDetailNonce] = useState(0);
  const [status, setStatus] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const mock = MOCK_VEHICLES.find(v => v.id === id);
    const fallback: VehicleDetail | null = mock ? {
      ...mock,
      documents: [
        { id:"doc1", vehicleId:id, type:"REGISTRATION", docNo:"IST-"+mock.code, issueDate:"2025-08-02", expiryDate:mock.nextDocExpiry ?? "2026-12-31", fileId:null, notes:null, createdAt:"2025-08-02" },
        { id:"doc2", vehicleId:id, type:"OPERATING_CARD", docNo:"TASH-"+mock.code, issueDate:"2025-08-02", expiryDate:"2026-08-02", fileId:null, notes:null, createdAt:"2025-08-02" },
      ],
      insurancePolicies: MOCK_INSURANCE.filter(p => p.vehicleId === id),
      fuelLogs: MOCK_FUEL.filter(f => f.vehicleId === id),
      maintenanceRecords: MOCK_MAINT.filter(m => m.vehicleId === id),
      locations: mock.lastLat !== null ? [{ lat:mock.lastLat, lng:mock.lastLng as number, label:mock.lastLocationLabel, at:mock.lastLocationAt ?? undefined }] : [],
      supplier: null,
    } : null;

    if (!isLive) { setDetail(fallback); if (fallback) { setStatus(fallback.status); setNotes(fallback.notes ?? ""); } return; }
    // Signed in: real data only. On failure show an error — NEVER the mock vehicle.
    setDetail(null); setDetailError(false);
    const t = setTimeout(() => {
      api.get<VehicleDetail>(`/fleet/vehicles/${id}`)
        .then(v => { setDetail(v); setDetailError(false); setStatus(v.status); setNotes(v.notes ?? ""); })
        .catch(() => { setDetail(null); setDetailError(true); });
    }, 0);
    return () => clearTimeout(t);
  }, [id, isLive, detailNonce]);

  const save = async () => {
    if (!isLoggedIn()) { erpToast.success("Vehicle updated"); onChanged(); return; }
    try {
      await api.patch(`/fleet/vehicles/${id}`, { status, notes: notes.trim() || null });
      erpToast.success("Vehicle updated");
      onChanged();
    } catch (e) { erpToast.error(e instanceof ApiError ? e.message : "Update failed"); }
  };
  const remove = async () => {
    if (!isLoggedIn()) { erpToast.success("Vehicle deleted"); onChanged(); onClose(); return; }
    try {
      await api.delete(`/fleet/vehicles/${id}`);
      erpToast.success("Vehicle deleted");
      onChanged(); onClose();
    } catch (e) { erpToast.error(e instanceof ApiError ? e.message : "Delete failed"); }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ backgroundColor:"rgba(3,8,20,0.6)" }} onClick={onClose}>
      <div className="w-[440px] h-full overflow-y-auto" style={{ backgroundColor:"var(--erp-surface)", borderLeft:"1px solid rgba(11,30,63,0.15)", scrollbarWidth:"thin", scrollbarColor:"rgba(11,30,63,0.38) transparent" }} onClick={e=>e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4" style={{ backgroundColor:"var(--erp-surface)", borderBottom:"1px solid rgba(11,30,63,0.11)" }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor:`${FLEET}22` }}><Truck size={15} style={{ color:FLEET }} /></div>
            <div>
              <div className="text-sm font-black text-[var(--erp-text-strong)]">{detail?.code ?? "…"}</div>
              <div className="text-[9px]" style={{ color:"rgba(11,30,63,0.58)" }}>{detail?.type} · {detail?.plateNo ?? "no plate"}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ color:"rgba(11,30,63,0.58)" }}><X size={16} /></button>
        </div>

        {detailError ? <div className="p-6"><ErrorState tone="light" message="Could not load this vehicle." onRetry={() => setDetailNonce(n => n + 1)} /></div>
        : !detail ? <div className="p-8 text-center text-xs" style={{ color:"rgba(11,30,63,0.58)" }}>Loading…</div> : (
        <div className="p-5 space-y-5">
          <div className="grid grid-cols-3 gap-2">
            {[["Seats", detail.seats ?? "—"],["Owner", detail.supplier?.name ?? detail.owner ?? "OWNED"],["Docs", detail.documents.length]].map(([l,v])=>(
              <div key={l as string} className="rounded-xl p-3" style={CARD}>
                <div className="text-xs font-bold text-[var(--erp-text-strong)] truncate">{v}</div>
                <div className="text-[9px]" style={{ color:"rgba(11,30,63,0.58)" }}>{l}</div>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <Field label="Status">
              <select value={status} onChange={e=>setStatus(e.target.value)} className={inputSelCls} style={IS}>
                {["ACTIVE","IDLE","MAINTENANCE","RETIRED"].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Notes">
              <textarea rows={2} value={notes} onChange={e=>setNotes(e.target.value)} className={`${inputCls} resize-none`} style={IS} placeholder="Operational notes…" />
            </Field>
            <div className="flex gap-2">
              <button onClick={()=>void save()} className="flex-1 py-2.5 rounded-xl text-xs font-bold active:scale-95 transition-all" style={{ backgroundColor:FLEET, color:"var(--erp-text-strong)" }}>Save Changes</button>
              <button onClick={()=>void remove()} className="px-3 rounded-xl active:scale-95 transition-all" style={{ backgroundColor:"#DC262618", border:"1px solid #DC262633", color:"var(--erp-destructive)" }}><Trash2 size={14} /></button>
            </div>
          </div>

          <DrawerSection title="Documents" icon={FileText}>
            {detail.documents.length === 0 ? <Empty /> : detail.documents.map(doc => (
              <div key={doc.id} className="flex items-center justify-between py-2" style={{ borderBottom:"1px solid rgba(11,30,63,0.08)" }}>
                <div><div className="text-[11px] text-[var(--erp-text-strong)]">{doc.type.replace(/_/g," ")}</div><div className="text-[9px]" style={{ color:"rgba(11,30,63,0.58)" }}>{doc.docNo ?? "—"}</div></div>
                <div className="text-[10px] font-mono" style={{ color:"rgba(11,30,63,0.66)" }}>{fmtDate(doc.expiryDate)}</div>
              </div>
            ))}
          </DrawerSection>

          <DrawerSection title="Insurance" icon={Shield}>
            {detail.insurancePolicies.length === 0 ? <Empty /> : detail.insurancePolicies.map(p => (
              <div key={p.id} className="flex items-center justify-between py-2" style={{ borderBottom:"1px solid rgba(11,30,63,0.08)" }}>
                <div><div className="text-[11px] text-[var(--erp-text-strong)]">{p.provider}</div><div className="text-[9px]" style={{ color:"rgba(11,30,63,0.58)" }}>{p.policyNo}</div></div>
                <div className="text-right"><div className="text-[10px] font-mono" style={{ color:"rgba(11,30,63,0.66)" }}>{fmtDate(p.endDate)}</div><Chip s={p.status} /></div>
              </div>
            ))}
          </DrawerSection>

          <DrawerSection title="Recent Fuel" icon={Droplet}>
            {detail.fuelLogs.length === 0 ? <Empty /> : detail.fuelLogs.slice(0,3).map(f => (
              <div key={f.id} className="flex items-center justify-between py-2" style={{ borderBottom:"1px solid rgba(11,30,63,0.08)" }}>
                <div className="text-[10px] font-mono" style={{ color:"rgba(11,30,63,0.66)" }}>{fmtDate(f.date)}</div>
                <div className="text-[11px] text-[var(--erp-text-strong)]">{f.liters} L · {money(f.cost)}</div>
              </div>
            ))}
          </DrawerSection>

          <DrawerSection title="Recent Maintenance" icon={Wrench}>
            {detail.maintenanceRecords.length === 0 ? <Empty /> : detail.maintenanceRecords.slice(0,3).map(m => (
              <div key={m.id} className="flex items-center justify-between py-2" style={{ borderBottom:"1px solid rgba(11,30,63,0.08)" }}>
                <div><div className="text-[11px] text-[var(--erp-text-strong)]">{m.description}</div><div className="text-[9px]" style={{ color:"rgba(11,30,63,0.58)" }}>{fmtDate(m.date)} · {m.workshop ?? "—"}</div></div>
                <Chip s={m.type} />
              </div>
            ))}
          </DrawerSection>

          <DrawerSection title="Last Location" icon={MapPin}>
            {detail.locations.length === 0 ? <Empty /> : (
              <div className="py-2">
                <div className="text-[11px] text-[var(--erp-text-strong)]">{detail.locations[0].label ?? "Unknown"}</div>
                <div className="text-[9px] font-mono" style={{ color:"rgba(11,30,63,0.58)" }}>{detail.locations[0].lat?.toFixed(4)}, {detail.locations[0].lng?.toFixed(4)} · {fmtDate(detail.locations[0].at)}</div>
              </div>
            )}
          </DrawerSection>
        </div>
        )}
      </div>
    </div>
  );
}

function DrawerSection({ title, icon:Icon, children }:{ title:string; icon:IconFC; children:ReactNode }) {
  return (
    <div className="rounded-xl p-4" style={PANEL}>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={12} style={{ color:FLEET }} />
        <span className="text-[9px] font-black uppercase tracking-widest" style={{ color:"rgba(11,30,63,0.58)" }}>{title}</span>
      </div>
      {children}
    </div>
  );
}
function Empty() { return <div className="text-[10px] py-1" style={{ color:"rgba(11,30,63,0.50)" }}>None on record</div>; }

function SevCell({ date, days, severity }:{ date:string|null; days:number|null; severity?:Severity }) {
  if (!date) return <span style={{ color:"rgba(11,30,63,0.38)" }}>—</span>;
  const c = sevColor(severity ?? null);
  return (
    <div>
      <div className="text-[10px] font-mono" style={{ color:c, fontFamily:"var(--font-mono)" }}>{fmtDate(date)}</div>
      {days !== null && <div className="text-[9px]" style={{ color:"rgba(11,30,63,0.58)" }}>{days < 0 ? `${Math.abs(days)}d overdue` : `${days}d`}</div>}
    </div>
  );
}

function VehicleMasterScreen() {
  const { lang } = useLang();
  const [statusF, setStatusF] = useState("");
  const [typeF, setTypeF] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const pageSize = 25;

  const params = new URLSearchParams();
  if (statusF) params.set("status", statusF);
  if (typeF) params.set("type", typeF);
  const qs = params.toString();
  const { data: live, loading, error, reload } = useFleet<VehicleRow[]>(`/fleet/vehicles${qs?`?${qs}`:""}`);
  const refresh = () => reload(false);

  const isLive = isLoggedIn();
  let rows = isLive ? (live ?? []) : MOCK_VEHICLES;
  if (!isLive) rows = rows.filter(v => (!statusF || v.status === statusF) && (!typeF || v.type === typeF));
  rows = rows.filter(v => !q || [v.code, v.plateNo, v.owner].join(" ").toLowerCase().includes(q.toLowerCase()));

  const total = rows.length;
  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);

  const columns: ErpColumn<VehicleRow>[] = [
    { id: "code", header: lang === "bn" ? "কোড" : "Code", cell: (v) => <span className="font-black font-mono" style={{ color: FLEET }}>{v.code}</span> },
    { id: "type", header: lang === "bn" ? "ধরন" : "Type", cell: (v) => v.type },
    { id: "plate", header: lang === "bn" ? "প্লেট" : "Plate", cell: (v) => <span className="font-mono">{v.plateNo ?? "—"}</span> },
    { id: "seats", header: lang === "bn" ? "সিট" : "Seats", cell: (v) => v.seats ?? "—" },
    { id: "owner", header: lang === "bn" ? "মালিক" : "Owner", cell: (v) => v.owner ?? "OWNED" },
    { id: "status", header: lang === "bn" ? "স্ট্যাটাস" : "Status", cell: (v) => <Chip s={v.status} /> },
    { id: "doc", header: lang === "bn" ? "পরবর্তী ডক" : "Next Doc", cell: (v) => <SevCell date={v.nextDocExpiry} days={v.nextDocDays} severity={v.docSeverity} /> },
    { id: "ins", header: lang === "bn" ? "বীমা" : "Insurance", cell: (v) => <SevCell date={v.insuranceExpiry} days={v.insuranceDays} /> },
  ];

  if (loading) return <ScreenLoading />;
  if (error) return <ScreenError onRetry={() => reload(true)} />;

  return (
    <div style={{ fontFamily: fontFor(lang) }}>
      <ErpPageTemplate
        title={lang === "bn" ? "যানবাহন মাস্টার" : "Vehicle Master"}
        subtitle={lang === "bn" ? "ফ্লিট যানবাহন · বিদ্যমান API" : "Fleet vehicles · existing API"}
        primaryAction={
          <ErpButton variant="primary" icon={<Plus size={14} />} onClick={() => setShowAdd(true)} style={{ backgroundColor: FLEET, color: "var(--erp-text-strong)" }}>
            {lang === "bn" ? "যানবাহন যোগ" : "Add Vehicle"}
          </ErpButton>
        }
        toolbar={
          <div className="flex flex-col gap-3 w-full">
            <ErpSearchBar
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
              onClear={() => { setQ(""); setPage(1); }}
              placeholder={lang === "bn" ? "কোড, প্লেট, মালিক…" : "Search code, plate, owner…"}
              lang={lang}
            />
            <ErpFilterPanel
              open={filtersOpen}
              onOpenChange={setFiltersOpen}
              lang={lang}
              activeCount={(statusF ? 1 : 0) + (typeF ? 1 : 0)}
            >
              <div className="flex flex-wrap gap-3">
                <ErpSelect value={statusF} onChange={(e) => { setStatusF(e.target.value); setPage(1); }}>
                  <option value="">{lang === "bn" ? "সব স্ট্যাটাস" : "All statuses"}</option>
                  {["ACTIVE", "IDLE", "MAINTENANCE", "RETIRED"].map((s) => <option key={s} value={s}>{s}</option>)}
                </ErpSelect>
                <ErpSelect value={typeF} onChange={(e) => { setTypeF(e.target.value); setPage(1); }}>
                  <option value="">{lang === "bn" ? "সব ধরন" : "All types"}</option>
                  {VEHICLE_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
                </ErpSelect>
              </div>
            </ErpFilterPanel>
          </div>
        }
        footer={<ErpPagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} lang={lang} />}
      >
        <ErpDataTable
          columns={columns}
          rows={pageRows}
          rowKey={(v) => v.id}
          lang={lang}
          onRowClick={(v) => setOpenId(v.id)}
          emptyTitle={q || statusF || typeF
            ? (lang === "bn" ? "কোনো মিল নেই" : "No vehicles match these filters")
            : (lang === "bn" ? "এখনো কোনো যানবাহন নেই" : "No vehicles yet")}
          emptyHint={q || statusF || typeF
            ? (lang === "bn" ? "সার্চ বা ফিল্টার মুছুন।" : "Try clearing the search or filters.")
            : (lang === "bn" ? "ডকুমেন্ট, জ্বালানি ও ডিসপ্যাচ ট্র্যাক করতে যানবাহন যোগ করুন।" : "Add a vehicle to start tracking documents, fuel and dispatch.")}
        />
      </ErpPageTemplate>

      {openId && <VehicleDetailDrawer id={openId} isLive={isLive} onClose={() => setOpenId(null)} onChanged={refresh} />}
      {showAdd && <AddVehicleModal onClose={() => setShowAdd(false)} onSaved={refresh} />}
    </div>
  );
}

function AddVehicleModal({ onClose, onSaved }:{ onClose:()=>void; onSaved:()=>void }) {
  const { lang } = useLang();
  const [code, setCode] = useState("");
  const [type, setType] = useState("BUS");
  const [plateNo, setPlateNo] = useState("");
  const [seats, setSeats] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!code.trim()) { erpToast.error(lang === "bn" ? "যানবাহন কোড প্রয়োজন।" : "Vehicle code is required.", lang); return; }
    if (!isLoggedIn()) { erpToast.success(`Vehicle ${code} added`, lang); onSaved(); onClose(); return; }
    setSaving(true);
    try {
      await api.post("/fleet/vehicles", {
        code: code.trim(), type,
        plateNo: plateNo.trim() || undefined,
        seats: seats ? parseInt(seats,10) : undefined,
        status, notes: notes.trim() || undefined,
      });
      erpToast.success(`Vehicle ${code} added`, lang);
      onSaved(); onClose();
    } catch (e) { erpToast.error(e instanceof ApiError ? e.message : "Failed to add vehicle", lang); }
    finally { setSaving(false); }
  };

  return (
    <ErpDrawer
      open
      onClose={onClose}
      title={lang === "bn" ? "যানবাহন যোগ" : "Add Vehicle"}
      maxWidth={560}
      footer={
        <ErpDrawerFooterActions
          onCancel={onClose}
          onSave={() => void save()}
          saving={saving}
          saveLabel={lang === "bn" ? "সংরক্ষণ" : "Save Vehicle"}
          cancelLabel={lang === "bn" ? "বাতিল" : "Cancel"}
          lang={lang}
        />
      }
    >
      <ErpForm>
        <ErpFormRow span={2}><ErpField label={lang === "bn" ? "কোড *" : "Code *"} required><ErpInput value={code} onChange={(e) => setCode(e.target.value)} placeholder="BUS-06" /></ErpField></ErpFormRow>
        <ErpField label={lang === "bn" ? "ধরন" : "Type"}><ErpSelect value={type} onChange={(e) => setType(e.target.value)}>{VEHICLE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</ErpSelect></ErpField>
        <ErpField label={lang === "bn" ? "সিট" : "Seats"}><ErpInput type="number" value={seats} onChange={(e) => setSeats(e.target.value)} placeholder="50" /></ErpField>
        <ErpFormRow span={2}><ErpField label={lang === "bn" ? "প্লেট নং" : "Plate No"}><ErpInput value={plateNo} onChange={(e) => setPlateNo(e.target.value)} placeholder="RSD-0000" /></ErpField></ErpFormRow>
        <ErpFormRow span={2}><ErpField label={lang === "bn" ? "স্ট্যাটাস" : "Status"}><ErpSelect value={status} onChange={(e) => setStatus(e.target.value)}>{["ACTIVE","IDLE","MAINTENANCE","RETIRED"].map((s) => <option key={s} value={s}>{s}</option>)}</ErpSelect></ErpField></ErpFormRow>
        <ErpFormRow span={2}><ErpField label={lang === "bn" ? "নোট" : "Notes"}><ErpTextarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional…" /></ErpField></ErpFormRow>
      </ErpForm>
    </ErpDrawer>
  );
}

// ─── 3. Driver Master ─────────────────────────────────────────────────────────

function DriverMasterScreen() {
  const { lang } = useLang();
  const [statusF, setStatusF] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editRow, setEditRow] = useState<DriverRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DriverRow | null>(null);
  const [removing, setRemoving] = useState(false);
  const pageSize = 25;

  const { data: live, loading, error, reload } = useFleet<DriverRow[]>(`/fleet/drivers${statusF?`?status=${statusF}`:""}`);
  const refresh = () => reload(false);

  const isLive = isLoggedIn();
  let rows = isLive ? (live ?? []) : MOCK_DRIVERS;
  if (!isLive) rows = rows.filter(d => !statusF || d.status === statusF);
  rows = rows.filter(d => !q || [d.name, d.phone, d.licenseNo].join(" ").toLowerCase().includes(q.toLowerCase()));

  const total = rows.length;
  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);

  const confirmRemove = async () => {
    if (!deleteTarget) return;
    const d = deleteTarget;
    if (!isLoggedIn()) { erpToast.success(`${d.name} removed`, lang); setDeleteTarget(null); return; }
    setRemoving(true);
    try {
      await api.delete(`/fleet/drivers/${d.id}`);
      erpToast.success(`${d.name} removed`, lang);
      setDeleteTarget(null);
      refresh();
    } catch (e) { erpToast.error(e instanceof ApiError ? e.message : "Delete failed", lang); }
    finally { setRemoving(false); }
  };

  const columns: ErpColumn<DriverRow>[] = [
    { id: "name", header: lang === "bn" ? "ড্রাইভার" : "Driver",
      cell: (d) => (
        <div>
          <div className="text-xs font-semibold text-[var(--erp-text-strong)]">{d.name}</div>
          {d.nameBn && <div className="text-[9px]" style={{ color: "rgba(11,30,63,0.58)", fontFamily: "var(--font-bengali)" }}>{d.nameBn}</div>}
        </div>
      ),
    },
    { id: "phone", header: lang === "bn" ? "ফোন" : "Phone", cell: (d) => <span className="font-mono">{d.phone ?? "—"}</span> },
    { id: "license", header: lang === "bn" ? "লাইসেন্স" : "License No", cell: (d) => <span className="font-mono">{d.licenseNo ?? "—"}</span> },
    { id: "expiry", header: lang === "bn" ? "মেয়াদ" : "License Expiry", cell: (d) => <SevCell date={d.licenseExpiry} days={d.licenseDays} severity={d.licenseSeverity} /> },
    { id: "status", header: lang === "bn" ? "স্ট্যাটাস" : "Status", cell: (d) => <Chip s={d.status} /> },
    { id: "rating", header: lang === "bn" ? "রেটিং" : "Rating", cell: (d) => <span style={{ color: "var(--erp-warning)" }}>{d.rating ? `★ ${d.rating.toFixed(1)}` : "—"}</span> },
    { id: "actions", header: "",
      cell: (d) => (
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <ErpButton size="sm" variant="ghost" icon={<Pencil size={12} />} onClick={() => setEditRow(d)} aria-label="Edit" />
          <ErpButton size="sm" variant="ghost" icon={<Trash2 size={12} />} onClick={() => setDeleteTarget(d)} aria-label="Delete" />
        </div>
      ),
    },
  ];

  if (loading) return <ScreenLoading />;
  if (error) return <ScreenError onRetry={() => reload(true)} />;

  return (
    <div style={{ fontFamily: fontFor(lang) }}>
      <ErpPageTemplate
        title={lang === "bn" ? "ড্রাইভার মাস্টার" : "Driver Master"}
        subtitle={lang === "bn" ? "ফ্লিট ড্রাইভার · বিদ্যমান API" : "Fleet drivers · existing API"}
        primaryAction={
          <ErpButton variant="primary" icon={<Plus size={14} />} onClick={() => setShowAdd(true)} style={{ backgroundColor: FLEET, color: "var(--erp-text-strong)" }}>
            {lang === "bn" ? "ড্রাইভার যোগ" : "Add Driver"}
          </ErpButton>
        }
        toolbar={
          <div className="flex flex-col gap-3 w-full">
            <ErpSearchBar
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
              onClear={() => { setQ(""); setPage(1); }}
              placeholder={lang === "bn" ? "নাম, ফোন, লাইসেন্স…" : "Search name, phone, license…"}
              lang={lang}
            />
            <ErpFilterPanel open={filtersOpen} onOpenChange={setFiltersOpen} lang={lang} activeCount={statusF ? 1 : 0}>
              <ErpSelect value={statusF} onChange={(e) => { setStatusF(e.target.value); setPage(1); }}>
                <option value="">{lang === "bn" ? "সব স্ট্যাটাস" : "All statuses"}</option>
                {["AVAILABLE", "ON_TRIP", "OFF", "INACTIVE"].map((s) => <option key={s} value={s}>{s}</option>)}
              </ErpSelect>
            </ErpFilterPanel>
          </div>
        }
        footer={<ErpPagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} lang={lang} />}
      >
        <ErpDataTable
          columns={columns}
          rows={pageRows}
          rowKey={(d) => d.id}
          lang={lang}
          emptyTitle={q || statusF
            ? (lang === "bn" ? "কোনো মিল নেই" : "No drivers match these filters")
            : (lang === "bn" ? "এখনো কোনো ড্রাইভার নেই" : "No drivers yet")}
          emptyHint={q || statusF
            ? (lang === "bn" ? "সার্চ বা স্ট্যাটাস ফিল্টার মুছুন।" : "Try clearing the search or status filter.")
            : (lang === "bn" ? "ডিসপ্যাচে অ্যাসাইন করতে ড্রাইভার যোগ করুন।" : "Add a driver to assign them to dispatches.")}
        />
      </ErpPageTemplate>

      {showAdd && <DriverModal onClose={() => setShowAdd(false)} onSaved={refresh} />}
      {editRow && <DriverModal driver={editRow} onClose={() => setEditRow(null)} onSaved={refresh} />}
      <ErpDeleteDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void confirmRemove()}
        loading={removing}
        entityLabel={deleteTarget?.name}
        lang={lang}
      />
    </div>
  );
}

function DriverModal({ driver, onClose, onSaved }:{ driver?:DriverRow; onClose:()=>void; onSaved:()=>void }) {
  const { lang } = useLang();
  const [name, setName] = useState(driver?.name ?? "");
  const [nameBn, setNameBn] = useState(driver?.nameBn ?? "");
  const [phone, setPhone] = useState(driver?.phone ?? "");
  const [licenseNo, setLicenseNo] = useState(driver?.licenseNo ?? "");
  const [licenseExpiry, setLicenseExpiry] = useState(driver?.licenseExpiry ? driver.licenseExpiry.slice(0,10) : "");
  const [status, setStatus] = useState(driver?.status ?? "AVAILABLE");
  const [saving, setSaving] = useState(false);
  const editing = !!driver;

  const save = async () => {
    if (!name.trim()) { erpToast.error(lang === "bn" ? "ড্রাইভারের নাম প্রয়োজন।" : "Driver name is required.", lang); return; }
    const body = {
      name: name.trim(),
      nameBn: nameBn.trim() || undefined,
      phone: phone.trim() || undefined,
      licenseNo: licenseNo.trim() || undefined,
      licenseExpiry: licenseExpiry || undefined,
      status,
    };
    if (!isLoggedIn()) { erpToast.success(editing ? `${name} updated` : `${name} added`, lang); onSaved(); onClose(); return; }
    setSaving(true);
    try {
      if (editing) await api.patch(`/fleet/drivers/${driver.id}`, body);
      else await api.post("/fleet/drivers", body);
      erpToast.success(editing ? `${name} updated` : `${name} added`, lang);
      onSaved(); onClose();
    } catch (e) { erpToast.error(e instanceof ApiError ? e.message : "Save failed", lang); }
    finally { setSaving(false); }
  };

  return (
    <ErpDrawer
      open
      onClose={onClose}
      title={editing ? (lang === "bn" ? "ড্রাইভার সম্পাদনা" : "Edit Driver") : (lang === "bn" ? "ড্রাইভার যোগ" : "Add Driver")}
      maxWidth={560}
      footer={
        <ErpDrawerFooterActions
          onCancel={onClose}
          onSave={() => void save()}
          saving={saving}
          saveLabel={editing ? (lang === "bn" ? "সংরক্ষণ" : "Save Changes") : (lang === "bn" ? "যোগ করুন" : "Add Driver")}
          cancelLabel={lang === "bn" ? "বাতিল" : "Cancel"}
          lang={lang}
        />
      }
    >
      <ErpForm>
        <ErpFormRow span={2}><ErpField label={lang === "bn" ? "নাম *" : "Name *"} required><ErpInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" /></ErpField></ErpFormRow>
        <ErpFormRow span={2}><ErpField label={lang === "bn" ? "নাম (বাংলা)" : "Name (Bangla)"}><ErpInput value={nameBn} onChange={(e) => setNameBn(e.target.value)} placeholder="Optional" /></ErpField></ErpFormRow>
        <ErpField label={lang === "bn" ? "ফোন" : "Phone"}><ErpInput value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+966…" /></ErpField>
        <ErpField label={lang === "bn" ? "স্ট্যাটাস" : "Status"}><ErpSelect value={status} onChange={(e) => setStatus(e.target.value)}>{["AVAILABLE","ON_TRIP","OFF","INACTIVE"].map((s) => <option key={s} value={s}>{s}</option>)}</ErpSelect></ErpField>
        <ErpFormRow span={2}><ErpField label={lang === "bn" ? "লাইসেন্স নং" : "License No"}><ErpInput value={licenseNo} onChange={(e) => setLicenseNo(e.target.value)} placeholder="KSA-DL-…" /></ErpField></ErpFormRow>
        <ErpFormRow span={2}><ErpField label={lang === "bn" ? "লাইসেন্স মেয়াদ" : "License Expiry"}><ErpInput type="date" value={licenseExpiry} onChange={(e) => setLicenseExpiry(e.target.value)} /></ErpField></ErpFormRow>
      </ErpForm>
    </ErpDrawer>
  );
}

// ─── 4. Compliance (Documents & Expiry) ───────────────────────────────────────

function ComplianceScreen() {
  const [days, setDays] = useState(30);
  const [selVehicle, setSelVehicle] = useState("");
  const [docs, setDocs] = useState<VehicleDocument[] | null>(null);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsError, setDocsError] = useState(false);
  const [docsNonce, setDocsNonce] = useState(0);
  const [showAddDoc, setShowAddDoc] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [deletingDoc, setDeletingDoc] = useState<string | null>(null);

  const { data: live, loading, error, reload } = useFleet<ExpiringItem[]>(`/fleet/expiring?days=${days}`);
  const { data: vehicles } = useFleet<VehicleRow[]>("/fleet/vehicles");
  const refreshExpiring = () => reload(false);

  const vehList = isLoggedIn() ? (vehicles ?? []) : MOCK_VEHICLES;
  const effVehicle = selVehicle || vehList[0]?.id || "";

  const refreshDocs = () => setDocsNonce(n => n + 1);
  useEffect(() => {
    if (!effVehicle) { setDocs([]); setDocsLoading(false); setDocsError(false); return; }
    if (!isLoggedIn()) {
      const mock = MOCK_VEHICLES.find(v => v.id === effVehicle);
      setDocs(mock ? [
        { id:"doc1", vehicleId:effVehicle, type:"REGISTRATION", docNo:"IST-"+mock.code, issueDate:"2025-08-02", expiryDate:mock.nextDocExpiry ?? "2026-12-31", fileId:null, notes:null, createdAt:"2025-08-02" },
        { id:"doc2", vehicleId:effVehicle, type:"OPERATING_CARD", docNo:"TASH-"+mock.code, issueDate:"2025-08-02", expiryDate:"2026-08-02", fileId:null, notes:null, createdAt:"2025-08-02" },
      ] : []);
      setDocsLoading(false); setDocsError(false);
      return;
    }
    let cancelled = false;
    setDocsLoading(true);
    setDocsError(false);
    const t = setTimeout(() => {
      api.get<VehicleDocument[]>(`/fleet/vehicles/${effVehicle}/documents`)
        .then(d => { if (!cancelled) { setDocs(d); setDocsLoading(false); } })
        // a failed fetch is NOT "no documents" — surface it as an error
        .catch(() => { if (!cancelled) { setDocs(null); setDocsError(true); setDocsLoading(false); } });
    }, 0);
    return () => { cancelled = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effVehicle, docsNonce]);

  const items = isLoggedIn() ? (live ?? []) : MOCK_EXPIRING.filter(it => it.daysLeft <= days);
  const docRows = docs ?? [];

  const scan = async () => {
    if (!isLoggedIn()) { erpToast.success("2 new alerts from 6 at-risk items"); return; }
    setScanning(true);
    try {
      const res = await api.post<{ scanned:number; created:number }>("/fleet/expiry/scan", {});
      erpToast.success(`${res.created} new alerts from ${res.scanned} at-risk items`);
      refreshExpiring();
    } catch (e) { erpToast.error(e instanceof ApiError ? e.message : "Scan failed"); }
    finally { setScanning(false); }
  };
  const deleteDoc = async (docId:string) => {
    if (!isLoggedIn()) { erpToast.success("Document removed"); setDocs(d => (d ?? []).filter(x => x.id !== docId)); return; }
    setDeletingDoc(docId);
    try { await api.delete(`/fleet/documents/${docId}`); erpToast.success("Document removed"); refreshDocs(); }
    catch (e) { erpToast.error(e instanceof ApiError ? e.message : "Delete failed"); }
    finally { setDeletingDoc(null); }
  };

  return (
    <div className="p-7 space-y-5">
      <div className="rounded-2xl overflow-hidden" style={{ border:"1px solid rgba(11,30,63,0.11)" }}>
        <div className="flex items-center justify-between px-5 py-3 gap-3 flex-wrap" style={{ backgroundColor:"var(--erp-surface)", borderBottom:"1px solid rgba(11,30,63,0.11)" }}>
          <div className="flex items-center gap-2">
            <ShieldCheck size={14} style={{ color:FLEET }} />
            <span className="text-xs font-bold text-[var(--erp-text-strong)]">Unified Expiry Feed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-xl p-0.5" style={{ backgroundColor:"var(--erp-surface-soft)" }}>
              {[7,30,90].map(dd => (
                <button key={dd} onClick={()=>setDays(dd)} className="px-2.5 py-1 rounded-lg text-[10px] font-bold" style={{ backgroundColor:days===dd?`${FLEET}30`:"transparent", color:days===dd?FLEET:"rgba(11,30,63,0.58)" }}>{dd}d</button>
              ))}
            </div>
            <ActionBtn label={scanning ? "Scanning…" : "Run compliance scan"} icon={RefreshCw} color={FLEET} disabled={scanning} onClick={()=>void scan()} />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <TH cols={["Kind","Subject","Detail","Expiry","Days Left","Severity"]} />
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-4"><LoadingSkeleton tone="light" rows={4} /></td></tr>
              ) : error ? (
                <tr><td colSpan={6} className="px-4 py-4"><ErrorState tone="light" message="Could not load the expiry feed" onRetry={()=>reload(true)} /></td></tr>
              ) : items.length === 0 ? (
                <EmptyRow cols={6} title={`Nothing expiring within ${days} days`} hint="Switch the 7 / 30 / 90-day range to look further ahead." />
              ) : items.map((it, i) => (
                <tr key={`${it.kind}-${it.refId}-${i}`} className="hover:bg-white/2" style={{ borderBottom:i<items.length-1?"1px solid rgba(11,30,63,0.08)":undefined }}>
                  <td className="px-4 py-3 text-[9px] font-black" style={{ color:FLEET }}>{it.kind.replace(/_/g," ")}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-[var(--erp-text-strong)]">{it.subject}</td>
                  <td className="px-4 py-3 text-[10px]" style={{ color:"rgba(11,30,63,0.66)" }}>{it.detail}</td>
                  <td className="px-4 py-3 text-[10px] font-mono" style={{ color:"rgba(11,30,63,0.76)", fontFamily:"var(--font-mono)" }}>{fmtDate(it.expiryDate)}</td>
                  <td className="px-4 py-3 text-[10px] font-bold" style={{ color:sevColor(it.severity) }}>{it.daysLeft < 0 ? `${Math.abs(it.daysLeft)}d overdue` : `${it.daysLeft}d`}</td>
                  <td className="px-4 py-3"><SevChip s={it.severity} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ border:"1px solid rgba(11,30,63,0.11)" }}>
        <div className="flex items-center justify-between px-5 py-3 gap-3 flex-wrap" style={{ backgroundColor:"var(--erp-surface)", borderBottom:"1px solid rgba(11,30,63,0.11)" }}>
          <div className="flex items-center gap-2">
            <FileText size={14} style={{ color:FLEET }} />
            <span className="text-xs font-bold text-[var(--erp-text-strong)]">Vehicle Documents</span>
          </div>
          <div className="flex items-center gap-2">
            <select value={effVehicle} onChange={e=>setSelVehicle(e.target.value)} className="px-3 py-2 rounded-xl text-[10px] focus:outline-none appearance-none" style={IS}>
              {vehList.map(v => <option key={v.id} value={v.id}>{v.code} · {v.type}</option>)}
            </select>
            <ActionBtn label="Add Document" icon={Plus} color={FLEET} disabled={!effVehicle} onClick={()=>setShowAddDoc(true)} />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <TH cols={["Type","Doc No","Issue Date","Expiry","Notes",""]} />
            <tbody>
              {docsLoading ? (
                <tr><td colSpan={6} className="px-4 py-4"><LoadingSkeleton tone="light" rows={3} /></td></tr>
              ) : docsError ? (
                <tr><td colSpan={6} className="px-4 py-4"><ErrorState tone="light" message="Could not load documents for this vehicle" onRetry={refreshDocs} /></td></tr>
              ) : !effVehicle ? (
                <EmptyRow cols={6} title="No vehicles yet" hint="Add a vehicle before uploading its documents." />
              ) : docRows.length === 0 ? (
                <EmptyRow cols={6} title="No documents on record" hint="Add registration, inspection or permit documents for this vehicle." />
              ) : docRows.map((doc, i) => (
                <tr key={doc.id} className="hover:bg-white/2" style={{ borderBottom:i<docRows.length-1?"1px solid rgba(11,30,63,0.08)":undefined }}>
                  <td className="px-4 py-3 text-xs font-semibold text-[var(--erp-text-strong)]">{doc.type.replace(/_/g," ")}</td>
                  <td className="px-4 py-3 text-[10px] font-mono" style={{ color:"rgba(11,30,63,0.66)", fontFamily:"var(--font-mono)" }}>{doc.docNo ?? "—"}</td>
                  <td className="px-4 py-3 text-[10px] font-mono" style={{ color:"rgba(11,30,63,0.66)", fontFamily:"var(--font-mono)" }}>{fmtDate(doc.issueDate)}</td>
                  <td className="px-4 py-3 text-[10px] font-mono" style={{ color:"rgba(11,30,63,0.76)", fontFamily:"var(--font-mono)" }}>{fmtDate(doc.expiryDate)}</td>
                  <td className="px-4 py-3 text-[10px]" title={doc.notes ?? undefined} style={{ color:"rgba(11,30,63,0.58)" }}>{doc.notes ?? "—"}</td>
                  <td className="px-4 py-3"><button disabled={deletingDoc===doc.id} onClick={()=>void deleteDoc(doc.id)} className="p-1.5 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed" style={{ backgroundColor:"#DC262618" }}><Trash2 size={12} style={{ color:"var(--erp-destructive)" }} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAddDoc && <AddDocModal vehicleId={effVehicle} vehicleCode={vehList.find(v=>v.id===effVehicle)?.code ?? ""} onClose={()=>setShowAddDoc(false)} onSaved={refreshDocs} />}
    </div>
  );
}

function AddDocModal({ vehicleId, vehicleCode, onClose, onSaved }:{ vehicleId:string; vehicleCode:string; onClose:()=>void; onSaved:()=>void }) {
  const { lang } = useLang();
  const [type, setType] = useState("REGISTRATION");
  const [docNo, setDocNo] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!expiryDate) { erpToast.error("Expiry date is required.", lang); return; }
    const body = { type, docNo: docNo.trim() || undefined, issueDate: issueDate || undefined, expiryDate, notes: notes.trim() || undefined };
    if (!isLoggedIn()) { erpToast.success("Document added", lang); onSaved(); onClose(); return; }
    setSaving(true);
    try {
      await api.post(`/fleet/vehicles/${vehicleId}/documents`, body);
      erpToast.success("Document added", lang);
      onSaved(); onClose();
    } catch (e) { erpToast.error(e instanceof ApiError ? e.message : "Failed to add document", lang); }
    finally { setSaving(false); }
  };

  return (
    <ErpDrawer
      open
      onClose={onClose}
      title={`${lang === "bn" ? "ডকুমেন্ট যোগ" : "Add Document"} — ${vehicleCode}`}
      maxWidth={560}
      footer={<ErpDrawerFooterActions onCancel={onClose} onSave={() => void save()} saving={saving} saveLabel={lang === "bn" ? "যোগ করুন" : "Add Document"} lang={lang} />}
    >
      <ErpForm>
        <ErpFormRow span={2}><ErpField label={lang === "bn" ? "ধরন" : "Type"}><ErpSelect value={type} onChange={(e) => setType(e.target.value)}>{DOC_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}</ErpSelect></ErpField></ErpFormRow>
        <ErpFormRow span={2}><ErpField label={lang === "bn" ? "ডক নং" : "Doc No"}><ErpInput value={docNo} onChange={(e) => setDocNo(e.target.value)} placeholder="Optional" /></ErpField></ErpFormRow>
        <ErpField label={lang === "bn" ? "ইস্যু" : "Issue Date"}><ErpInput type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} /></ErpField>
        <ErpField label={lang === "bn" ? "মেয়াদ *" : "Expiry Date *"} required><ErpInput type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} /></ErpField>
        <ErpFormRow span={2}><ErpField label={lang === "bn" ? "নোট" : "Notes"}><ErpTextarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional…" /></ErpField></ErpFormRow>
      </ErpForm>
    </ErpDrawer>
  );
}

// ─── 5. Fuel Log ──────────────────────────────────────────────────────────────

function FuelScreen() {
  const { lang } = useLang();
  const [vehicleF, setVehicleF] = useState("");
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FuelLog | null>(null);
  const [removing, setRemoving] = useState(false);
  const pageSize = 25;

  const { data: live, loading, error, reload } = useFleet<FuelLog[]>(`/fleet/fuel${vehicleF?`?vehicleId=${vehicleF}`:""}`);
  const { data: vehicles } = useFleet<VehicleRow[]>("/fleet/vehicles");
  const refresh = () => reload(false);

  const isLive = isLoggedIn();
  let rows = isLive ? (live ?? []) : MOCK_FUEL;
  if (!isLive && vehicleF) rows = rows.filter(f => f.vehicleId === vehicleF);
  const costTotal = rows.reduce((s, f) => s + (f.cost ?? 0), 0);
  const vehList = isLive ? (vehicles ?? []) : MOCK_VEHICLES;
  const total = rows.length;
  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);

  const confirmRemove = async () => {
    if (!deleteTarget) return;
    if (!isLoggedIn()) { erpToast.success("Fuel entry removed", lang); setDeleteTarget(null); return; }
    setRemoving(true);
    try {
      await api.delete(`/fleet/fuel/${deleteTarget.id}`);
      erpToast.success("Fuel entry removed", lang);
      setDeleteTarget(null);
      refresh();
    } catch (e) { erpToast.error(e instanceof ApiError ? e.message : "Delete failed", lang); }
    finally { setRemoving(false); }
  };

  const columns: ErpColumn<FuelLog>[] = [
    { id: "date", header: lang === "bn" ? "তারিখ" : "Date", cell: (f) => <span className="font-mono">{fmtDate(f.date)}</span> },
    { id: "veh", header: lang === "bn" ? "যানবাহন" : "Vehicle", cell: (f) => <span className="font-black font-mono" style={{ color: FLEET }}>{f.vehicle?.code ?? "—"}</span> },
    { id: "drv", header: lang === "bn" ? "ড্রাইভার" : "Driver", cell: (f) => f.driver?.name ?? "—" },
    { id: "liters", header: lang === "bn" ? "লিটার" : "Liters", cell: (f) => <span className="font-mono tabular-nums">{f.liters} L</span> },
    { id: "cost", header: lang === "bn" ? "খরচ" : "Cost", cell: (f) => <span className="font-mono font-bold tabular-nums" style={{ color: FUEL_C }}>{money(f.cost)}</span> },
    { id: "odo", header: lang === "bn" ? "ওডোমিটার" : "Odometer", cell: (f) => <span className="font-mono">{f.odometerKm ? `${f.odometerKm.toLocaleString()} km` : "—"}</span> },
    { id: "act", header: "",
      cell: (f) => (
        <ErpButton size="sm" variant="ghost" icon={<Trash2 size={12} />} onClick={(e) => { e.stopPropagation(); setDeleteTarget(f); }} aria-label="Delete" />
      ),
    },
  ];

  if (loading) return <ScreenLoading />;
  if (error) return <ScreenError onRetry={() => reload(true)} />;

  return (
    <div style={{ fontFamily: fontFor(lang) }}>
      <ErpPageTemplate
        title={lang === "bn" ? "জ্বালানি লগ" : "Fuel Log"}
        subtitle={`${lang === "bn" ? "মোট" : "Total"}: ${money(costTotal)} · ${rows.length} ${lang === "bn" ? "এন্ট্রি" : "entries"}`}
        primaryAction={
          <ErpButton variant="primary" icon={<Plus size={14} />} onClick={() => setShowAdd(true)} style={{ backgroundColor: FLEET, color: "var(--erp-text-strong)" }}>
            {lang === "bn" ? "জ্বালানি লগ" : "Log Fuel"}
          </ErpButton>
        }
        toolbar={
          <ErpFilterPanel open={filtersOpen} onOpenChange={setFiltersOpen} lang={lang} activeCount={vehicleF ? 1 : 0}>
            <ErpSelect value={vehicleF} onChange={(e) => { setVehicleF(e.target.value); setPage(1); }}>
              <option value="">{lang === "bn" ? "সব যানবাহন" : "All vehicles"}</option>
              {vehList.map((v) => <option key={v.id} value={v.id}>{v.code}</option>)}
            </ErpSelect>
          </ErpFilterPanel>
        }
        footer={<ErpPagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} lang={lang} />}
      >
        <ErpDataTable
          columns={columns}
          rows={pageRows}
          rowKey={(f) => f.id}
          lang={lang}
          emptyTitle={vehicleF ? (lang === "bn" ? "এই যানবাহনে কোনো এন্ট্রি নেই" : "No fuel entries for this vehicle") : (lang === "bn" ? "এখনো জ্বালানি লগ নেই" : "No fuel logged yet")}
          emptyHint={lang === "bn" ? "খরচ ট্র্যাক করতে ফিল-আপ লগ করুন।" : "Log a fill-up to start tracking consumption and cost."}
        />
      </ErpPageTemplate>
      {showAdd && <AddFuelModal vehicles={vehList} onClose={() => setShowAdd(false)} onSaved={refresh} />}
      <ErpDeleteDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={() => void confirmRemove()} loading={removing} lang={lang} />
    </div>
  );
}

function AddFuelModal({ vehicles, onClose, onSaved }:{ vehicles:VehicleRow[]; onClose:()=>void; onSaved:()=>void }) {
  const { lang } = useLang();
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id ?? "");
  const [date, setDate] = useState(new Date().toISOString().slice(0,10));
  const [liters, setLiters] = useState("");
  const [cost, setCost] = useState("");
  const [odometerKm, setOdometerKm] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const l = parseFloat(liters), c = parseFloat(cost);
    if (!vehicleId || !l || !c) { erpToast.error("Vehicle, liters and cost are required.", lang); return; }
    const body = { vehicleId, date, liters:l, cost:c, odometerKm: odometerKm ? parseInt(odometerKm,10) : undefined, notes: notes.trim() || undefined };
    if (!isLoggedIn()) { erpToast.success("Fuel logged", lang); onSaved(); onClose(); return; }
    setSaving(true);
    try { await api.post("/fleet/fuel", body); erpToast.success("Fuel logged", lang); onSaved(); onClose(); }
    catch (e) { erpToast.error(e instanceof ApiError ? e.message : "Failed to log fuel", lang); }
    finally { setSaving(false); }
  };

  return (
    <ErpDrawer
      open
      onClose={onClose}
      title={lang === "bn" ? "জ্বালানি লগ" : "Log Fuel"}
      maxWidth={560}
      footer={<ErpDrawerFooterActions onCancel={onClose} onSave={() => void save()} saving={saving} saveLabel={lang === "bn" ? "সংরক্ষণ" : "Save Fuel Entry"} lang={lang} />}
    >
      <ErpForm>
        <ErpFormRow span={2}><ErpField label={lang === "bn" ? "যানবাহন *" : "Vehicle *"} required><ErpSelect value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>{vehicles.map((v) => <option key={v.id} value={v.id}>{v.code} · {v.type}</option>)}</ErpSelect></ErpField></ErpFormRow>
        <ErpFormRow span={2}><ErpField label={lang === "bn" ? "তারিখ" : "Date"}><ErpInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></ErpField></ErpFormRow>
        <ErpField label={lang === "bn" ? "লিটার *" : "Liters *"} required><ErpInput type="number" value={liters} onChange={(e) => setLiters(e.target.value)} placeholder="180" /></ErpField>
        <ErpField label={lang === "bn" ? "খরচ (SAR) *" : "Cost (SAR) *"} required><ErpInput type="number" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="1134" /></ErpField>
        <ErpFormRow span={2}><ErpField label={lang === "bn" ? "ওডোমিটার (km)" : "Odometer (km)"}><ErpInput type="number" value={odometerKm} onChange={(e) => setOdometerKm(e.target.value)} placeholder="184200" /></ErpField></ErpFormRow>
        <ErpFormRow span={2}><ErpField label={lang === "bn" ? "নোট" : "Notes"}><ErpTextarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional…" /></ErpField></ErpFormRow>
      </ErpForm>
    </ErpDrawer>
  );
}

// ─── 6. Maintenance ───────────────────────────────────────────────────────────

function MaintenanceScreen() {
  const { lang } = useLang();
  const [vehicleF, setVehicleF] = useState("");
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MaintenanceRecord | null>(null);
  const [removing, setRemoving] = useState(false);
  const pageSize = 25;

  const { data: live, loading, error, reload } = useFleet<MaintenanceRecord[]>(`/fleet/maintenance${vehicleF?`?vehicleId=${vehicleF}`:""}`);
  const { data: vehicles } = useFleet<VehicleRow[]>("/fleet/vehicles");
  const refresh = () => reload(false);

  const isLive = isLoggedIn();
  let rows = isLive ? (live ?? []) : MOCK_MAINT;
  if (!isLive && vehicleF) rows = rows.filter(m => m.vehicleId === vehicleF);
  const vehList = isLive ? (vehicles ?? []) : MOCK_VEHICLES;
  const costTotal = rows.reduce((s, m) => s + (m.cost ?? 0), 0);
  const total = rows.length;
  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);

  const confirmRemove = async () => {
    if (!deleteTarget) return;
    if (!isLoggedIn()) { erpToast.success("Record removed", lang); setDeleteTarget(null); return; }
    setRemoving(true);
    try {
      await api.delete(`/fleet/maintenance/${deleteTarget.id}`);
      erpToast.success("Record removed", lang);
      setDeleteTarget(null);
      refresh();
    } catch (e) { erpToast.error(e instanceof ApiError ? e.message : "Delete failed", lang); }
    finally { setRemoving(false); }
  };

  const columns: ErpColumn<MaintenanceRecord>[] = [
    { id: "date", header: lang === "bn" ? "তারিখ" : "Date", cell: (m) => <span className="font-mono">{fmtDate(m.date)}</span> },
    { id: "veh", header: lang === "bn" ? "যানবাহন" : "Vehicle", cell: (m) => <span className="font-black font-mono" style={{ color: FLEET }}>{m.vehicle?.code ?? "—"}</span> },
    { id: "type", header: lang === "bn" ? "ধরন" : "Type", cell: (m) => <Chip s={m.type} /> },
    { id: "desc", header: lang === "bn" ? "বিবরণ" : "Description", cell: (m) => m.description },
    { id: "cost", header: lang === "bn" ? "খরচ" : "Cost", cell: (m) => <span className="font-mono font-bold" style={{ color: MAINT_C }}>{money(m.cost)}</span> },
    { id: "shop", header: lang === "bn" ? "ওয়ার্কশপ" : "Workshop", cell: (m) => m.workshop ?? "—" },
    { id: "due", header: lang === "bn" ? "পরবর্তী" : "Next Due", cell: (m) => <span className="font-mono">{fmtDate(m.nextDueDate)}</span> },
    { id: "act", header: "",
      cell: (m) => (
        <ErpButton size="sm" variant="ghost" icon={<Trash2 size={12} />} onClick={(e) => { e.stopPropagation(); setDeleteTarget(m); }} aria-label="Delete" />
      ),
    },
  ];

  if (loading) return <ScreenLoading />;
  if (error) return <ScreenError onRetry={() => reload(true)} />;

  return (
    <div style={{ fontFamily: fontFor(lang) }}>
      <ErpPageTemplate
        title={lang === "bn" ? "রক্ষণাবেক্ষণ" : "Maintenance"}
        subtitle={`${lang === "bn" ? "মোট খরচ" : "Total spend"}: ${money(costTotal)}`}
        primaryAction={
          <ErpButton variant="primary" icon={<Plus size={14} />} onClick={() => setShowAdd(true)} style={{ backgroundColor: FLEET, color: "var(--erp-text-strong)" }}>
            {lang === "bn" ? "রেকর্ড যোগ" : "Add Record"}
          </ErpButton>
        }
        toolbar={
          <ErpFilterPanel open={filtersOpen} onOpenChange={setFiltersOpen} lang={lang} activeCount={vehicleF ? 1 : 0}>
            <ErpSelect value={vehicleF} onChange={(e) => { setVehicleF(e.target.value); setPage(1); }}>
              <option value="">{lang === "bn" ? "সব যানবাহন" : "All vehicles"}</option>
              {vehList.map((v) => <option key={v.id} value={v.id}>{v.code}</option>)}
            </ErpSelect>
          </ErpFilterPanel>
        }
        footer={<ErpPagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} lang={lang} />}
      >
        <ErpDataTable
          columns={columns}
          rows={pageRows}
          rowKey={(m) => m.id}
          lang={lang}
          emptyTitle={vehicleF ? (lang === "bn" ? "এই যানবাহনে রেকর্ড নেই" : "No maintenance for this vehicle") : (lang === "bn" ? "এখনো রেকর্ড নেই" : "No maintenance recorded yet")}
          emptyHint={lang === "bn" ? "সার্ভিস ও মেরামত লগ করুন।" : "Log services, repairs and inspections to track spend and next-due dates."}
        />
      </ErpPageTemplate>
      {showAdd && <AddMaintModal vehicles={vehList} onClose={() => setShowAdd(false)} onSaved={refresh} />}
      <ErpDeleteDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={() => void confirmRemove()} loading={removing} lang={lang} />
    </div>
  );
}

function AddMaintModal({ vehicles, onClose, onSaved }:{ vehicles:VehicleRow[]; onClose:()=>void; onSaved:()=>void }) {
  const { lang } = useLang();
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id ?? "");
  const [type, setType] = useState("PREVENTIVE");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0,10));
  const [cost, setCost] = useState("");
  const [odometerKm, setOdometerKm] = useState("");
  const [nextDueDate, setNextDueDate] = useState("");
  const [workshop, setWorkshop] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!vehicleId || !description.trim()) { erpToast.error("Vehicle and description are required.", lang); return; }
    const body = { vehicleId, type, description: description.trim(), date, cost: cost ? parseFloat(cost) : undefined, odometerKm: odometerKm ? parseInt(odometerKm,10) : undefined, nextDueDate: nextDueDate || undefined, workshop: workshop.trim() || undefined };
    if (!isLoggedIn()) { erpToast.success("Maintenance record added", lang); onSaved(); onClose(); return; }
    setSaving(true);
    try { await api.post("/fleet/maintenance", body); erpToast.success("Maintenance record added", lang); onSaved(); onClose(); }
    catch (e) { erpToast.error(e instanceof ApiError ? e.message : "Failed to add record", lang); }
    finally { setSaving(false); }
  };

  return (
    <ErpDrawer
      open
      onClose={onClose}
      title={lang === "bn" ? "রক্ষণাবেক্ষণ রেকর্ড" : "Add Maintenance Record"}
      maxWidth={720}
      footer={<ErpDrawerFooterActions onCancel={onClose} onSave={() => void save()} saving={saving} saveLabel={lang === "bn" ? "সংরক্ষণ" : "Save Record"} lang={lang} />}
    >
      <ErpForm>
        <ErpField label={lang === "bn" ? "যানবাহন *" : "Vehicle *"} required><ErpSelect value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>{vehicles.map((v) => <option key={v.id} value={v.id}>{v.code}</option>)}</ErpSelect></ErpField>
        <ErpField label={lang === "bn" ? "ধরন" : "Type"}><ErpSelect value={type} onChange={(e) => setType(e.target.value)}>{["PREVENTIVE","REPAIR","INSPECTION"].map((t) => <option key={t} value={t}>{t}</option>)}</ErpSelect></ErpField>
        <ErpFormRow span={2}><ErpField label={lang === "bn" ? "বিবরণ *" : "Description *"} required><ErpInput value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Oil & filter service" /></ErpField></ErpFormRow>
        <ErpField label={lang === "bn" ? "তারিখ" : "Date"}><ErpInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></ErpField>
        <ErpField label={lang === "bn" ? "পরবর্তী" : "Next Due"}><ErpInput type="date" value={nextDueDate} onChange={(e) => setNextDueDate(e.target.value)} /></ErpField>
        <ErpField label={lang === "bn" ? "খরচ (SAR)" : "Cost (SAR)"}><ErpInput type="number" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="1200" /></ErpField>
        <ErpField label={lang === "bn" ? "ওডোমিটার (km)" : "Odometer (km)"}><ErpInput type="number" value={odometerKm} onChange={(e) => setOdometerKm(e.target.value)} placeholder="182500" /></ErpField>
        <ErpFormRow span={2}><ErpField label={lang === "bn" ? "ওয়ার্কশপ" : "Workshop"}><ErpInput value={workshop} onChange={(e) => setWorkshop(e.target.value)} placeholder="TUBA Workshop" /></ErpField></ErpFormRow>
      </ErpForm>
    </ErpDrawer>
  );
}


// ─── 7. Insurance ─────────────────────────────────────────────────────────────

function insuranceSeverity(endDate:string):Severity {
  const days = Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000);
  if (days < 0) return "EXPIRED";
  if (days <= 14) return "CRITICAL";
  if (days <= 30) return "WARNING";
  return null;
}

function InsuranceScreen() {
  const { lang } = useLang();
  const [vehicleF, setVehicleF] = useState("");
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editRow, setEditRow] = useState<InsurancePolicy | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InsurancePolicy | null>(null);
  const [removing, setRemoving] = useState(false);
  const pageSize = 25;

  const { data: live, loading, error, reload } = useFleet<InsurancePolicy[]>(`/fleet/insurance${vehicleF?`?vehicleId=${vehicleF}`:""}`);
  const { data: vehicles } = useFleet<VehicleRow[]>("/fleet/vehicles");
  const refresh = () => reload(false);

  const isLive = isLoggedIn();
  let rows = isLive ? (live ?? []) : MOCK_INSURANCE;
  if (!isLive && vehicleF) rows = rows.filter(p => p.vehicleId === vehicleF);
  const vehList = isLive ? (vehicles ?? []) : MOCK_VEHICLES;
  const total = rows.length;
  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);

  const confirmRemove = async () => {
    if (!deleteTarget) return;
    if (!isLoggedIn()) { erpToast.success("Policy removed", lang); setDeleteTarget(null); return; }
    setRemoving(true);
    try {
      await api.delete(`/fleet/insurance/${deleteTarget.id}`);
      erpToast.success("Policy removed", lang);
      setDeleteTarget(null);
      refresh();
    } catch (e) { erpToast.error(e instanceof ApiError ? e.message : "Delete failed", lang); }
    finally { setRemoving(false); }
  };

  const columns: ErpColumn<InsurancePolicy>[] = [
    { id: "veh", header: lang === "bn" ? "যানবাহন" : "Vehicle",
      cell: (p) => (
        <span className="font-black font-mono" style={{ color: FLEET }}>
          {p.vehicle?.code ?? vehList.find((v) => v.id === p.vehicleId)?.code ?? "—"}
        </span>
      ),
    },
    { id: "prov", header: lang === "bn" ? "প্রদানকারী" : "Provider", cell: (p) => p.provider },
    { id: "no", header: lang === "bn" ? "পলিসি নং" : "Policy No", cell: (p) => <span className="font-mono">{p.policyNo}</span> },
    { id: "start", header: lang === "bn" ? "শুরু" : "Start", cell: (p) => <span className="font-mono">{fmtDate(p.startDate)}</span> },
    { id: "end", header: lang === "bn" ? "শেষ" : "End",
      cell: (p) => {
        const sev = insuranceSeverity(p.endDate);
        return <span className="font-mono font-bold" style={{ color: sevColor(sev) }}>{fmtDate(p.endDate)}</span>;
      },
    },
    { id: "prem", header: lang === "bn" ? "প্রিমিয়াম" : "Premium", cell: (p) => <span className="font-mono">{money(p.premium)}</span> },
    { id: "status", header: lang === "bn" ? "স্ট্যাটাস" : "Status", cell: (p) => <Chip s={p.status} /> },
    { id: "act", header: "",
      cell: (p) => (
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <ErpButton size="sm" variant="ghost" icon={<Pencil size={12} />} onClick={() => setEditRow(p)} aria-label="Edit" />
          <ErpButton size="sm" variant="ghost" icon={<Trash2 size={12} />} onClick={() => setDeleteTarget(p)} aria-label="Delete" />
        </div>
      ),
    },
  ];

  if (loading) return <ScreenLoading />;
  if (error) return <ScreenError onRetry={() => reload(true)} />;

  return (
    <div style={{ fontFamily: fontFor(lang) }}>
      <ErpPageTemplate
        title={lang === "bn" ? "বীমা" : "Insurance"}
        subtitle={`${rows.length} ${lang === "bn" ? "পলিসি · মেয়াদ নজরদারি" : "policies · end-date monitored"}`}
        primaryAction={
          <ErpButton variant="primary" icon={<Plus size={14} />} onClick={() => setShowAdd(true)} style={{ backgroundColor: FLEET, color: "var(--erp-text-strong)" }}>
            {lang === "bn" ? "পলিসি যোগ" : "Add Policy"}
          </ErpButton>
        }
        toolbar={
          <ErpFilterPanel open={filtersOpen} onOpenChange={setFiltersOpen} lang={lang} activeCount={vehicleF ? 1 : 0}>
            <ErpSelect value={vehicleF} onChange={(e) => { setVehicleF(e.target.value); setPage(1); }}>
              <option value="">{lang === "bn" ? "সব যানবাহন" : "All vehicles"}</option>
              {vehList.map((v) => <option key={v.id} value={v.id}>{v.code}</option>)}
            </ErpSelect>
          </ErpFilterPanel>
        }
        footer={<ErpPagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} lang={lang} />}
      >
        <ErpDataTable
          columns={columns}
          rows={pageRows}
          rowKey={(p) => p.id}
          lang={lang}
          emptyTitle={vehicleF ? (lang === "bn" ? "এই যানবাহনে পলিসি নেই" : "No policies for this vehicle") : (lang === "bn" ? "এখনো পলিসি নেই" : "No insurance policies yet")}
          emptyHint={lang === "bn" ? "মেয়াদ ফিডে নজরদারির জন্য পলিসি যোগ করুন।" : "Add a policy so its end date is monitored in the expiry feed."}
        />
      </ErpPageTemplate>
      {showAdd && <InsuranceModal vehicles={vehList} onClose={() => setShowAdd(false)} onSaved={refresh} />}
      {editRow && <InsuranceModal vehicles={vehList} policy={editRow} onClose={() => setEditRow(null)} onSaved={refresh} />}
      <ErpDeleteDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={() => void confirmRemove()} loading={removing} entityLabel={deleteTarget?.policyNo} lang={lang} />
    </div>
  );
}

function InsuranceModal({ vehicles, policy, onClose, onSaved }:{ vehicles:VehicleRow[]; policy?:InsurancePolicy; onClose:()=>void; onSaved:()=>void }) {
  const { lang } = useLang();
  const [vehicleId, setVehicleId] = useState(policy?.vehicleId ?? vehicles[0]?.id ?? "");
  const [provider, setProvider] = useState(policy?.provider ?? "");
  const [policyNo, setPolicyNo] = useState(policy?.policyNo ?? "");
  const [startDate, setStartDate] = useState(policy?.startDate ? policy.startDate.slice(0,10) : "");
  const [endDate, setEndDate] = useState(policy?.endDate ? policy.endDate.slice(0,10) : "");
  const [premium, setPremium] = useState(policy?.premium != null ? String(policy.premium) : "");
  const [status, setStatus] = useState(policy?.status ?? "ACTIVE");
  const [saving, setSaving] = useState(false);
  const editing = !!policy;

  const save = async () => {
    if (!vehicleId || !provider.trim() || !policyNo.trim() || !startDate || !endDate) {
      erpToast.error("Vehicle, provider, policy no, start and end dates are required.", lang);
      return;
    }
    const body = { vehicleId, provider: provider.trim(), policyNo: policyNo.trim(), startDate, endDate, premium: premium ? parseFloat(premium) : undefined, status };
    if (!isLoggedIn()) { erpToast.success(editing ? "Policy updated" : "Policy added", lang); onSaved(); onClose(); return; }
    setSaving(true);
    try {
      if (editing) await api.patch(`/fleet/insurance/${policy.id}`, body);
      else await api.post("/fleet/insurance", body);
      erpToast.success(editing ? "Policy updated" : "Policy added", lang);
      onSaved(); onClose();
    } catch (e) { erpToast.error(e instanceof ApiError ? e.message : "Save failed", lang); }
    finally { setSaving(false); }
  };

  return (
    <ErpDrawer
      open
      onClose={onClose}
      title={editing ? (lang === "bn" ? "পলিসি সম্পাদনা" : "Edit Insurance Policy") : (lang === "bn" ? "পলিসি যোগ" : "Add Insurance Policy")}
      maxWidth={720}
      footer={
        <ErpDrawerFooterActions
          onCancel={onClose}
          onSave={() => void save()}
          saving={saving}
          saveLabel={editing ? (lang === "bn" ? "সংরক্ষণ" : "Save Changes") : (lang === "bn" ? "যোগ করুন" : "Add Policy")}
          lang={lang}
        />
      }
    >
      <ErpForm>
        <ErpField label={lang === "bn" ? "যানবাহন *" : "Vehicle *"} required><ErpSelect value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>{vehicles.map((v) => <option key={v.id} value={v.id}>{v.code}</option>)}</ErpSelect></ErpField>
        <ErpField label={lang === "bn" ? "স্ট্যাটাস" : "Status"}><ErpSelect value={status} onChange={(e) => setStatus(e.target.value)}>{["ACTIVE","EXPIRED","CANCELLED"].map((s) => <option key={s} value={s}>{s}</option>)}</ErpSelect></ErpField>
        <ErpFormRow span={2}><ErpField label={lang === "bn" ? "প্রদানকারী *" : "Provider *"} required><ErpInput value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="Tawuniya" /></ErpField></ErpFormRow>
        <ErpFormRow span={2}><ErpField label={lang === "bn" ? "পলিসি নং *" : "Policy No *"} required><ErpInput value={policyNo} onChange={(e) => setPolicyNo(e.target.value)} placeholder="TW-1446-0011" /></ErpField></ErpFormRow>
        <ErpField label={lang === "bn" ? "শুরু *" : "Start Date *"} required><ErpInput type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></ErpField>
        <ErpField label={lang === "bn" ? "শেষ *" : "End Date *"} required><ErpInput type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></ErpField>
        <ErpFormRow span={2}><ErpField label={lang === "bn" ? "প্রিমিয়াম (SAR)" : "Premium (SAR)"}><ErpInput type="number" value={premium} onChange={(e) => setPremium(e.target.value)} placeholder="8400" /></ErpField></ErpFormRow>
      </ErpForm>
    </ErpDrawer>
  );
}

// ─── 8. GPS Map ───────────────────────────────────────────────────────────────

const REGION = { latMin:21, latMax:25, lngMin:39, lngMax:40 };
const PRESETS: { label:string; lat:number; lng:number }[] = [
  { label:"Makkah Haram", lat:21.4225, lng:39.8262 },
  { label:"Jeddah Airport", lat:21.6796, lng:39.1565 },
  { label:"Madinah", lat:24.4672, lng:39.6111 },
];
const clamp = (n:number) => Math.max(2, Math.min(98, n));
const projX = (lng:number) => clamp(((lng - REGION.lngMin) / (REGION.lngMax - REGION.lngMin)) * 100);
const projY = (lat:number) => clamp(((REGION.latMax - lat) / (REGION.latMax - REGION.latMin)) * 100);

function GpsScreen() {
  const [selId, setSelId] = useState<string | null>(null);
  const [simVehicle, setSimVehicle] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [label, setLabel] = useState("");
  const [updating, setUpdating] = useState(false);

  const { data: live, loading, error, reload } = useFleet<MapVehicle[]>("/fleet/map");
  const { data: vehicles } = useFleet<VehicleRow[]>("/fleet/vehicles");
  const refresh = () => reload(false);

  const pins = isLoggedIn() ? (live ?? []) : MOCK_MAP;
  const vehList = isLoggedIn() ? (vehicles ?? []) : MOCK_VEHICLES;
  const selected = pins.find(p => p.id === selId) ?? null;
  const effSim = simVehicle || vehList[0]?.id || "";

  const applyPreset = (p:{ lat:number; lng:number; label:string }) => { setLat(String(p.lat)); setLng(String(p.lng)); setLabel(p.label); };

  const simulate = async () => {
    const la = parseFloat(lat), ln = parseFloat(lng);
    if (!effSim || Number.isNaN(la) || Number.isNaN(ln)) { erpToast.error("Pick a vehicle and enter valid coordinates."); return; }
    if (!isLoggedIn()) { erpToast.success("Location updated (demo)"); return; }
    setUpdating(true);
    try {
      await api.post(`/vehicles/${effSim}/location`, { lat:la, lng:ln, label: label.trim() || undefined, source:"MANUAL" });
      erpToast.success("Location updated");
      refresh();
    } catch (e) { erpToast.error(e instanceof ApiError ? e.message : "Failed to update location"); }
    finally { setUpdating(false); }
  };

  if (loading) return <ScreenLoading />;
  if (error) return <ScreenError onRetry={() => reload(true)} />;

  return (
    <div className="p-7">
      <div className="flex items-center justify-between mb-4">
        <div><h2 className="text-sm font-bold text-[var(--erp-text-strong)]">GPS Map</h2><p className="text-xs mt-0.5" style={{ color:"rgba(11,30,63,0.58)" }}>{pins.length} vehicles positioned · Makkah–Madinah–Jeddah corridor</p></div>
        <ActionBtn label="Refresh" icon={RefreshCw} onClick={refresh} />
      </div>

      <div className="rounded-xl px-4 py-2.5 mb-4 flex items-center gap-2" style={{ backgroundColor:`${MAINT_C}12`, border:`1px solid ${MAINT_C}30` }}>
        <AlertTriangle size={13} style={{ color:MAINT_C }} />
        <span className="text-[10px]" style={{ color:"rgba(11,30,63,0.76)" }}>MVP manual GPS — positions are set via the simulate control below. Hardware trackers are a documented Phase-2 integration.</span>
      </div>

      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 rounded-2xl overflow-hidden" style={PANEL}>
          <div className="relative w-full" style={{ height:440, background:"linear-gradient(135deg,#EEF3F8,#E4EBF3)" }}>
            {[25,50,75].map(p => <div key={`v${p}`} className="absolute top-0 bottom-0" style={{ left:`${p}%`, borderLeft:"1px dashed rgba(11,30,63,0.08)" }} />)}
            {[25,50,75].map(p => <div key={`h${p}`} className="absolute left-0 right-0" style={{ top:`${p}%`, borderTop:"1px dashed rgba(11,30,63,0.08)" }} />)}
            {PRESETS.map(c => (
              <div key={c.label} className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center" style={{ left:`${projX(c.lng)}%`, top:`${projY(c.lat)}%` }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor:"rgba(11,30,63,0.30)" }} />
                <span className="text-[8px] mt-0.5 whitespace-nowrap" style={{ color:"rgba(11,30,63,0.50)" }}>{c.label}</span>
              </div>
            ))}
            {pins.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <EmptyState tone="light" title="No vehicle positions yet" hint="Use the simulate control to place a vehicle on the map." />
              </div>
            )}
            {pins.map(p => {
              const c = STAT_C[p.status] ?? "var(--erp-muted-soft)";
              const active = selId === p.id;
              return (
                <button key={p.id} onClick={()=>setSelId(p.id)} className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group" style={{ left:`${projX(p.lng)}%`, top:`${projY(p.lat)}%`, zIndex:active?20:10 }}>
                  <div className="flex items-center justify-center rounded-full transition-all" style={{ width:active?28:22, height:active?28:22, backgroundColor:`${c}30`, border:`2px solid ${c}` }}>
                    <MapPin size={active?13:11} style={{ color:c }} />
                  </div>
                  <span className="text-[8px] font-black mt-0.5 px-1 rounded whitespace-nowrap" style={{ color:"var(--erp-text-strong)", backgroundColor:"rgba(255,255,255,0.85)", fontFamily:"var(--font-mono)" }}>{p.code}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          {selected && (
            <div className="rounded-2xl p-4" style={CARD}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black text-[var(--erp-text-strong)]" style={{ fontFamily:"var(--font-mono)" }}>{selected.code}</span>
                <Chip s={selected.status} />
              </div>
              <div className="space-y-1 text-[10px]" style={{ color:"rgba(11,30,63,0.66)" }}>
                <div>{selected.label ?? "Unknown location"}</div>
                <div className="font-mono" style={{ fontFamily:"var(--font-mono)" }}>{selected.lat.toFixed(4)}, {selected.lng.toFixed(4)}</div>
                <div className="flex items-center gap-1"><Clock size={9} /> {fmtDate(selected.at)}</div>
                {selected.activeDispatch && <div style={{ color:"var(--erp-success)" }}>● On active dispatch</div>}
              </div>
            </div>
          )}

          <div className="rounded-2xl p-4" style={PANEL}>
            <div className="flex items-center gap-2 mb-3">
              <Navigation size={13} style={{ color:FLEET }} />
              <span className="text-xs font-bold text-[var(--erp-text-strong)]">Simulate Location</span>
            </div>
            <div className="space-y-3">
              <Field label="Vehicle"><select value={effSim} onChange={e=>setSimVehicle(e.target.value)} className={inputSelCls} style={IS}>{vehList.map(v=><option key={v.id} value={v.id}>{v.code} · {v.type}</option>)}</select></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Latitude"><input value={lat} onChange={e=>setLat(e.target.value)} className={inputCls} style={IS} placeholder="21.4225" /></Field>
                <Field label="Longitude"><input value={lng} onChange={e=>setLng(e.target.value)} className={inputCls} style={IS} placeholder="39.8262" /></Field>
              </div>
              <Field label="Label"><input value={label} onChange={e=>setLabel(e.target.value)} className={inputCls} style={IS} placeholder="Makkah Haram" /></Field>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map(p => (
                  <button key={p.label} onClick={()=>applyPreset(p)} className="px-2 py-1 rounded-lg text-[9px] font-bold" style={{ backgroundColor:"var(--erp-surface-soft)", color:"rgba(11,30,63,0.76)", border:"1px solid rgba(11,30,63,0.11)" }}>{p.label}</button>
                ))}
              </div>
              <button disabled={updating} onClick={()=>void simulate()} className="w-full py-2.5 rounded-xl text-xs font-bold active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed" style={{ backgroundColor:FLEET, color:"var(--erp-text-strong)" }}>Update Location</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 9. Dispatch Assignment ───────────────────────────────────────────────────

function DispatchScreen() {
  const [assigning, setAssigning] = useState<string | null>(null);

  const { data: live, loading, error, reload } = useFleet<Dispatch[]>("/fleet/dispatches");
  const { data: vehicles } = useFleet<VehicleRow[]>("/fleet/vehicles");
  const { data: drivers } = useFleet<DriverRow[]>("/fleet/drivers");
  const refresh = () => reload(false);

  const rows = isLoggedIn() ? (live ?? []) : MOCK_DISPATCHES;
  const vehList = isLoggedIn() ? (vehicles ?? []) : MOCK_VEHICLES;
  const drvList = isLoggedIn() ? (drivers ?? []) : MOCK_DRIVERS;

  if (loading) return <ScreenLoading />;
  if (error) return <ScreenError onRetry={() => reload(true)} />;

  return (
    <div className="p-7">
      <div className="mb-4">
        <h2 className="text-sm font-bold text-[var(--erp-text-strong)]">Dispatch Assignment</h2>
        <p className="text-xs mt-0.5" style={{ color:"rgba(11,30,63,0.58)" }}>Assigning a vehicle + driver broadcasts live to the Ops board.</p>
      </div>
      <div className="space-y-3">
        {rows.length === 0 && (
          <EmptyState tone="light" title="No dispatches to assign" hint="Transport orders raised by Ops appear here awaiting a vehicle and driver." />
        )}
        {rows.map(o => (
          <div key={o.id} className="rounded-2xl p-5" style={CARD}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor:`${FLEET}22` }}><Route size={18} style={{ color:FLEET }} /></div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-[var(--erp-text-strong)]" style={{ fontFamily:"var(--font-mono)" }}>{o.code}</span>
                    <Chip s={o.status} />
                  </div>
                  <div className="text-[11px] mt-0.5 truncate" title={`${o.routeFrom ?? "—"} → ${o.routeTo ?? "—"}`} style={{ color:"rgba(11,30,63,0.76)" }}>{o.routeFrom ?? "—"} → {o.routeTo ?? "—"}</div>
                  <div className="text-[9px] mt-0.5 truncate" title={`${o.group?.tenant.name ?? "—"} · ${o.group?.code ?? "—"}`} style={{ color:"rgba(11,30,63,0.58)" }}>{o.group?.tenant.name ?? "—"} · {o.group?.code ?? "—"} · {o.pax ?? 0} pax · {fmtDate(o.scheduledAt)}</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-[9px] uppercase tracking-widest" style={{ color:"rgba(11,30,63,0.50)" }}>Assigned</div>
                  <div className="text-[11px] font-bold text-[var(--erp-text-strong)]">{o.vehicle?.code ?? "— no vehicle"}</div>
                  <div className="text-[10px]" style={{ color:"rgba(11,30,63,0.66)" }}>{o.driver?.name ?? "— no driver"}</div>
                </div>
                <button onClick={()=>setAssigning(a => a===o.id ? null : o.id)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold active:scale-95 transition-all" style={{ backgroundColor:`${FLEET}22`, color:FLEET, border:`1px solid ${FLEET}40` }}>
                  <Send size={11} /> Assign
                </button>
              </div>
            </div>
            {assigning === o.id && (
              <AssignForm dispatch={o} vehicles={vehList} drivers={drvList} onDone={()=>{ setAssigning(null); refresh(); }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function AssignForm({ dispatch, vehicles, drivers, onDone }:{ dispatch:Dispatch; vehicles:VehicleRow[]; drivers:DriverRow[]; onDone:()=>void }) {
  const [vehicleId, setVehicleId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [saving, setSaving] = useState(false);

  const assign = async () => {
    if (!vehicleId && !driverId) { erpToast.error("Pick a vehicle and/or driver."); return; }
    const body = { vehicleId: vehicleId || undefined, driverId: driverId || undefined };
    if (!isLoggedIn()) { erpToast.success(`${dispatch.code} assigned (demo)`); onDone(); return; }
    setSaving(true);
    try {
      await api.post(`/fleet/dispatches/${dispatch.id}/assign`, body);
      erpToast.success(`${dispatch.code} assigned · broadcast to Ops board`);
      onDone();
    } catch (e) { erpToast.error(e instanceof ApiError ? e.message : "Assignment failed"); }
    finally { setSaving(false); }
  };

  return (
    <div className="mt-4 pt-4 grid grid-cols-3 gap-3 items-end" style={{ borderTop:"1px solid rgba(11,30,63,0.11)" }}>
      <Field label="Vehicle"><select value={vehicleId} onChange={e=>setVehicleId(e.target.value)} className={inputSelCls} style={IS}><option value="">Select vehicle…</option>{vehicles.filter(v=>v.status!=="RETIRED").map(v=><option key={v.id} value={v.id}>{v.code} · {v.type} · {v.status}</option>)}</select></Field>
      <Field label="Driver"><select value={driverId} onChange={e=>setDriverId(e.target.value)} className={inputSelCls} style={IS}><option value="">Select driver…</option>{drivers.map(d=><option key={d.id} value={d.id}>{d.name} · {d.status}</option>)}</select></Field>
      <button disabled={saving} onClick={()=>void assign()} className="py-2.5 rounded-xl text-xs font-bold active:scale-95 transition-all disabled:opacity-60" style={{ backgroundColor:FLEET, color:"var(--erp-text-strong)" }}>Confirm Assignment</button>
    </div>
  );
}

// ─── Main FleetERP ────────────────────────────────────────────────────────────

const SCREENS: Record<FleetScreen, () => ReactNode> = {
  dashboard:   () => <DashboardScreen />,
  vehicles:    () => <VehicleMasterScreen />,
  drivers:     () => <DriverMasterScreen />,
  compliance:  () => <ComplianceScreen />,
  fuel:        () => <FuelScreen />,
  maintenance: () => <MaintenanceScreen />,
  insurance:   () => <InsuranceScreen />,
  gps:         () => <GpsScreen />,
  dispatch:    () => <DispatchScreen />,
};

export default function FleetERP() {
  const [screen, setScreen] = useState<FleetScreen>("dashboard");

  return (
    <ERPShell
      moduleId="fleet"
      moduleName="Fleet ERP"
      moduleColor={FLEET}
      moduleIcon={Truck as IconFC}
      navItems={FLEET_NAV}
      activeItem={screen}
      onItemClick={id => setScreen(id as FleetScreen)}
      breadcrumb={["Fleet", LABELS[screen]]}
      notificationCount={5}
      userName="Fleet Manager"
      userRole="TUBA AL HIJAZ · Season 1446H"
    >
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth:"thin", scrollbarColor:"rgba(11,30,63,0.38) transparent" }}>
          {SCREENS[screen]()}
        </div>
      </div>
    </ERPShell>
  );
}
