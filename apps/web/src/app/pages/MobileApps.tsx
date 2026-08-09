import { useState, type ReactNode } from "react";
import {
  Truck, Users, Shield, Zap, MapPin, FileText, User,
  Camera, Upload, ChevronLeft, ChevronRight, CheckCircle,
  AlertTriangle, Clock, Bell, Plus, Navigation, Phone,
  Wallet, BarChart2, Star, X, ClipboardList, Activity,
  Smartphone, BedDouble, Plane, Search, LayoutDashboard,
  Home, UtensilsCrossed, TrendingUp, RefreshCw, Fingerprint,
} from "lucide-react";
import { toast } from "sonner";
import { ERPShell, type NavItem, type IconFC } from "../components/ERPShell";

// ─── Module constants ─────────────────────────────────────────────────────────

const MOB   = "#E11D48";
const DRV_C = "var(--erp-cat-orange)";
const AGT_C = "var(--erp-cat-purple)";
const OPS_C = "#DC4E2A";
const SUP_C = "var(--erp-cat-teal)";
const NAVY  = "var(--erp-text-strong)";
const GOLD  = "var(--erp-accent)";

type AppId       = "driver" | "agent" | "ops" | "sup";
type DriverScreen = "home" | "trip" | "enroute" | "arrived" | "docs";
type AgentScreen  = "groups" | "detail" | "ocr" | "tracker" | "wallet" | "notifs";
type OpsScreen    = "arrivals" | "dispatch" | "emergency" | "live";
type SupScreen    = "approvals" | "visa" | "hotel" | "kpis" | "alerts";

// ─── Nav ──────────────────────────────────────────────────────────────────────

const MOB_NAV: NavItem[] = [
  { id:"driver", label:"Driver App",     icon: Truck        as IconFC },
  { id:"agent",  label:"Agent App",      icon: Users        as IconFC },
  { id:"ops",    label:"Operations App", icon: Zap          as IconFC },
  { id:"sup",    label:"Supervisor App", icon: Shield       as IconFC },
];

// Screen labels for jump selector
const SCREEN_LABELS: Record<AppId, { id: string; label: string }[]> = {
  driver: [
    { id:"home",    label:"Today" },
    { id:"trip",    label:"Trip Detail" },
    { id:"enroute", label:"Navigation" },
    { id:"arrived", label:"Arrived" },
    { id:"docs",    label:"Documents" },
  ],
  agent: [
    { id:"groups",  label:"Groups" },
    { id:"detail",  label:"Group Detail" },
    { id:"ocr",     label:"Scan Passport" },
    { id:"tracker", label:"Status Tracker" },
    { id:"wallet",  label:"Wallet" },
    { id:"notifs",  label:"Notifications" },
  ],
  ops: [
    { id:"arrivals",  label:"Arrivals" },
    { id:"dispatch",  label:"Dispatch" },
    { id:"emergency", label:"Emergency" },
    { id:"live",      label:"Live Board" },
  ],
  sup: [
    { id:"approvals", label:"Approvals" },
    { id:"visa",      label:"Visa Detail" },
    { id:"hotel",     label:"Hotel Detail" },
    { id:"kpis",      label:"KPIs" },
    { id:"alerts",    label:"Escalations" },
  ],
};

// ─── Shared mobile components ─────────────────────────────────────────────────

// Mobile status pill
function MPill({ label, color, size = "sm" }: { label: string; color: string; size?: "xs"|"sm" }) {
  const sz = size === "xs" ? "text-[7px] px-1.5 py-[2px]" : "text-[9px] px-2 py-0.5";
  return (
    <span className={`inline-flex items-center rounded-full font-black ${sz}`} style={{ backgroundColor:`${color}18`, color }}>
      {label}
    </span>
  );
}

// Mobile card wrapper
function MCard({ children, color, className = "" }: { children: ReactNode; color?: string; className?: string }) {
  return (
    <div className={`rounded-xl overflow-hidden ${className}`} style={{ backgroundColor:"var(--erp-surface-soft)", border:`1px solid ${color ? color+"20" : "rgba(11,30,63,0.38)"}` }}>
      {children}
    </div>
  );
}

// Mobile section header
function MSec({ title, action, color }: { title: string; action?: string; color: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 shrink-0">
      <span className="text-[10px] font-black uppercase tracking-widest" style={{ color:"rgba(11,30,63,0.58)" }}>{title}</span>
      {action && <button className="text-[9px] font-bold" style={{ color }}>{action}</button>}
    </div>
  );
}

// Mobile list row (with chevron)
function MRow({ icon: Icon, label, sub, right, color, onClick }: {
  icon: typeof Truck; label: string; sub?: string; right?: ReactNode; color: string; onClick?: () => void;
}) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors active:bg-white/5"
      style={{ borderBottom:"1px solid rgba(11,30,63,0.08)" }}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor:`${color}15` }}>
        <Icon size={16} style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-[var(--erp-text-strong)] truncate">{label}</div>
        {sub && <div className="text-[10px] mt-0.5 truncate" style={{ color:"rgba(11,30,63,0.58)" }}>{sub}</div>}
      </div>
      {right ?? <ChevronRight size={13} style={{ color:"rgba(11,30,63,0.38)", flexShrink:0 }} />}
    </button>
  );
}

// Mobile app header
function MHeader({ title, sub, back, color, right }: {
  title: string; sub?: string; back?: () => void; color: string; right?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-4 pb-3 pt-2 shrink-0">
      {back && (
        <button onClick={back} className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor:"var(--erp-canvas)" }}>
          <ChevronLeft size={16} style={{ color:"rgba(11,30,63,0.86)" }} />
        </button>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-base font-black text-[var(--erp-text-strong)] truncate">{title}</div>
        {sub && <div className="text-[10px]" style={{ color:"rgba(11,30,63,0.58)" }}>{sub}</div>}
      </div>
      {right}
    </div>
  );
}

// Bottom tab bar
interface MobTab { id: string; label: string; icon: typeof Truck; badge?: number; }
function BottomTabs({ tabs, active, onSelect, color }: {
  tabs: MobTab[]; active: string; onSelect: (id: string) => void; color: string;
}) {
  return (
    <div className="absolute bottom-0 left-0 right-0 flex items-end shrink-0" style={{ height:64, backgroundColor:"#0C1B33", borderTop:"1px solid rgba(11,30,63,0.11)" }}>
      {tabs.map(t => {
        const Ic = t.icon;
        const isA = t.id === active;
        return (
          <button key={t.id} onClick={() => onSelect(t.id)} className="flex-1 flex flex-col items-center justify-center gap-0.5 pt-1.5 pb-2 relative transition-all active:scale-95">
            {t.badge != null && t.badge > 0 && (
              <span className="absolute top-1 right-1/4 w-4 h-4 rounded-full text-[7px] font-black flex items-center justify-center"
                style={{ backgroundColor: color, color:"white", zIndex:10 }}>{t.badge > 9 ? "9+" : t.badge}</span>
            )}
            <Ic size={20} style={{ color: isA ? color : "rgba(11,30,63,0.50)" }} />
            <span className="text-[8.5px] font-semibold" style={{ color: isA ? color : "rgba(11,30,63,0.50)" }}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// OCR camera capture screen (shared)
function MobCameraCapture({ onCapture, onCancel, color }: { onCapture: () => void; onCancel: () => void; color: string }) {
  const [scanning, setScanning] = useState(false);
  const [done, setDone] = useState(false);
  const fire = () => {
    if (done) return;
    setScanning(true);
    setTimeout(() => { setScanning(false); setDone(true); setTimeout(() => { onCapture(); }, 600); }, 1800);
  };
  return (
    <div className="flex flex-col h-full" style={{ backgroundColor:"#000" }}>
      {/* Camera viewfinder */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden" style={{ background:"linear-gradient(135deg,#0a0a14 0%,#0d1020 100%)" }}>
        {/* Ambient passport glow */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div style={{ width:300, height:210, borderRadius:8, background:"var(--erp-surface)" }} />
        </div>

        {/* Passport frame overlay */}
        <div className="relative" style={{ width:280, height:196 }}>
          {/* Corner markers */}
          {([["top-0 left-0","border-t-[3px] border-l-[3px]"],["top-0 right-0","border-t-[3px] border-r-[3px]"],["bottom-0 left-0","border-b-[3px] border-l-[3px]"],["bottom-0 right-0","border-b-[3px] border-r-[3px]"]] as [string,string][]).map(([pos,cls]) => (
            <div key={pos} className={`absolute ${pos} w-8 h-8 rounded-sm ${cls} transition-all`}
              style={{ borderColor: done ? "var(--erp-success)" : scanning ? color : "rgba(255,255,255,0.55)" }} />
          ))}

          {/* Scan line */}
          {scanning && (
            <div className="absolute left-0 right-0 h-[2px] rounded-full" style={{ backgroundColor:color, opacity:0.9, top:"50%", animation:"scan-line-move 0.9s ease-in-out infinite alternate" }} />
          )}

          {/* Done checkmark */}
          {done && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor:"rgba(74,222,128,0.2)", border:"2px solid var(--erp-success)" }}>
                <CheckCircle size={28} style={{ color:"var(--erp-success)" }} />
              </div>
            </div>
          )}

          {/* Passport content hint lines */}
          {!scanning && !done && (
            <div className="absolute inset-4 space-y-2.5 pt-2">
              {[60,80,55,70,45].map((w,i) => (
                <div key={i} className="h-1 rounded-full" style={{ width:`${w}%`, backgroundColor:"var(--erp-canvas)" }} />
              ))}
            </div>
          )}
        </div>

        {/* Instruction */}
        <div className="absolute bottom-6 left-0 right-0 text-center text-xs" style={{ color: done ? "var(--erp-success)" : "rgba(255,255,255,0.80)" }}>
          {done ? "Passport captured successfully" : scanning ? "Scanning…" : "Align passport data page within the frame"}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between px-8 pb-6 pt-4" style={{ backgroundColor:"#0a0a14" }}>
        <button onClick={onCancel} className="w-12 h-12 rounded-full flex items-center justify-center active:scale-90" style={{ backgroundColor:"var(--erp-canvas)" }}>
          <X size={18} style={{ color:"rgba(11,30,63,0.76)" }} />
        </button>
        <button onClick={fire} disabled={done}
          className="w-16 h-16 rounded-full flex items-center justify-center shadow-xl active:scale-90 transition-all"
          style={{ backgroundColor: done ? "var(--erp-success)" : color, boxShadow:`0 0 20px ${color}50` }}>
          {done ? <CheckCircle size={28} style={{ color:"white" }} /> : <Camera size={24} style={{ color:"white" }} />}
        </button>
        <button className="w-12 h-12 rounded-full flex items-center justify-center active:scale-90" style={{ backgroundColor:"var(--erp-canvas)" }}>
          <Upload size={16} style={{ color:"rgba(11,30,63,0.76)" }} />
        </button>
      </div>
    </div>
  );
}

// ─── Driver App ───────────────────────────────────────────────────────────────

const DRV_TABS: MobTab[] = [
  { id:"today",   label:"Today",   icon: Home        },
  { id:"route",   label:"Route",   icon: Navigation  },
  { id:"docs",    label:"Docs",    icon: FileText    },
  { id:"profile", label:"Me",      icon: User        },
];

const DRV_TRIPS = [
  { id:"DSP-005", time:"14:10", from:"KAIA Terminal 1", to:"Marriott Makkah", pax:52, status:"ACTIVE",    color:DRV_C },
  { id:"DSP-007", time:"17:00", from:"Marriott Makkah", to:"KAIA Terminal 2", pax:38, status:"UPCOMING",  color:"rgba(11,30,63,0.50)" },
  { id:"DSP-002", time:"11:20", from:"KAIA Terminal 2", to:"Makkah Towers",   pax:32, status:"DONE",      color:"var(--erp-success)" },
];

function DriverApp({ screen, setScreen }: { screen: DriverScreen; setScreen: (s: DriverScreen) => void }) {
  const [tab, setTab] = useState("today");

  const handleTab = (id: string) => {
    setTab(id);
    if (id === "today") setScreen("home");
    if (id === "route") setScreen("enroute");
    if (id === "docs")  setScreen("docs");
  };

  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="flex-1 relative overflow-hidden">
        <div className="absolute inset-0 overflow-y-auto pb-1" style={{ scrollbarWidth:"none" }}>
          {screen === "home" && (
            <div>
              <div className="px-4 pt-2 pb-3" style={{ background:`linear-gradient(135deg,${DRV_C}18 0%,transparent 100%)` }}>
                <MHeader title="Today's Dispatch" sub="Thu 16 Jul · Ahmad Hassan" color={DRV_C}
                  right={<div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor:"#16A34A20" }}><div className="w-2 h-2 rounded-full" style={{ backgroundColor:"var(--erp-success)" }} /></div>} />
                {/* Driver status card */}
                <MCard color={DRV_C} className="mx-4 mb-4">
                  <div className="p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor:`${DRV_C}20` }}>
                      <Truck size={22} style={{ color:DRV_C }} />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-black text-[var(--erp-text-strong)]">Bus #TAH-07</div>
                      <div className="text-[10px]" style={{ color:"rgba(11,30,63,0.66)" }}>32-seat · SAUDI/2024-1441</div>
                    </div>
                    <MPill label="ON DUTY" color="var(--erp-success)" />
                  </div>
                  <div className="flex" style={{ borderTop:"1px solid rgba(11,30,63,0.11)" }}>
                    {[["3","Trips Today"],["184","Pax Moved"],["4.9","Rating"]].map(([v,l]) => (
                      <div key={l} className="flex-1 py-3 text-center" style={{ borderRight:"1px solid rgba(11,30,63,0.08)" }}>
                        <div className="text-sm font-black text-[var(--erp-text-strong)]">{v}</div>
                        <div className="text-[8px]" style={{ color:"rgba(11,30,63,0.58)" }}>{l}</div>
                      </div>
                    ))}
                  </div>
                </MCard>
              </div>
              <MSec title="Trips" action="Full Log" color={DRV_C} />
              <div className="px-4 space-y-3 pb-4">
                {DRV_TRIPS.map(t => (
                  <button key={t.id} onClick={() => { if(t.status==="ACTIVE"){ setTab("today"); setScreen("trip"); } }}
                    className="w-full rounded-xl p-4 text-left active:scale-98 transition-all"
                    style={{ backgroundColor:t.status==="ACTIVE"?`${DRV_C}10`:"rgba(11,30,63,0.38)", border:`1px solid ${t.status==="ACTIVE"?`${DRV_C}30`:"rgba(11,30,63,0.38)"}`, borderLeft:`3px solid ${t.color}` }}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-black" style={{ color:DRV_C, fontFamily:"var(--font-mono)" }}>{t.id}</span>
                      <span className="text-[10px]" style={{ color:"rgba(11,30,63,0.58)" }}>{t.time}</span>
                      <MPill label={t.status} color={t.color} size="xs" />
                    </div>
                    <div className="text-xs text-[var(--erp-text-strong)] flex items-center gap-1.5">
                      <span>{t.from}</span>
                      <ChevronRight size={10} style={{ color:"rgba(11,30,63,0.50)" }} />
                      <span className="font-semibold">{t.to}</span>
                    </div>
                    <div className="text-[10px] mt-1" style={{ color:"rgba(11,30,63,0.58)" }}><Users size={9} className="inline mr-1" />{t.pax} passengers</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {screen === "trip" && (
            <div>
              <div className="pt-2">
                <MHeader title="DSP-005 · Trip Detail" sub="Active — Tap to update status" back={() => setScreen("home")} color={DRV_C} />
              </div>
              {/* Route card */}
              <div className="px-4 mb-3">
                <MCard color={DRV_C}>
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex flex-col items-center gap-1 pt-1">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor:DRV_C }} />
                        <div className="w-px flex-1 bg-white/20" style={{ height:40 }} />
                        <MapPin size={12} style={{ color:DRV_C }} />
                      </div>
                      <div className="flex-1 space-y-3">
                        <div>
                          <div className="text-[9px] font-black uppercase tracking-wider mb-0.5" style={{ color:"rgba(11,30,63,0.50)" }}>PICKUP</div>
                          <div className="text-sm font-bold text-[var(--erp-text-strong)]">KAIA Terminal 1</div>
                          <div className="text-[10px]" style={{ color:"rgba(11,30,63,0.58)" }}>King Abdulaziz Int'l Airport, Jeddah</div>
                        </div>
                        <div>
                          <div className="text-[9px] font-black uppercase tracking-wider mb-0.5" style={{ color:"rgba(11,30,63,0.50)" }}>DROP-OFF</div>
                          <div className="text-sm font-bold text-[var(--erp-text-strong)]">Marriott Makkah</div>
                          <div className="text-[10px]" style={{ color:"rgba(11,30,63,0.58)" }}>Abraj Al-Bait Towers, Makkah</div>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-3 mt-4 pt-3" style={{ borderTop:"1px solid rgba(11,30,63,0.11)" }}>
                      {[["52","PAX"],["8.4km","DIST"],["14:37","ETA"]].map(([v,l]) => (
                        <div key={l} className="flex-1 text-center">
                          <div className="text-base font-black text-[var(--erp-text-strong)]">{v}</div>
                          <div className="text-[8px]" style={{ color:"rgba(11,30,63,0.50)" }}>{l}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </MCard>
              </div>
              {/* Passengers */}
              <MSec title={`Passengers (52)`} color={DRV_C} />
              <div className="px-4 space-y-1.5 mb-4">
                {[["Mohammad Rahman","🇧🇩","12A"],["Fatima Begum","🇧🇩","12B"],["Karim Hassan","🇧🇩","13A"],["Aisha Malik","🇵🇰","13B"],["Omar Siddiqui","🇵🇰","14A"]].map(([n,f,s]) => (
                  <div key={n as string} className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ backgroundColor:"var(--erp-surface-soft)" }}>
                    <span className="text-base">{f}</span>
                    <span className="flex-1 text-xs text-[var(--erp-text-strong)]">{n}</span>
                    <span className="text-[9px] font-black" style={{ color:DRV_C, fontFamily:"var(--font-mono)" }}>{s}</span>
                  </div>
                ))}
                <div className="text-center py-2">
                  <span className="text-[9px]" style={{ color:"rgba(11,30,63,0.50)" }}>+47 more passengers</span>
                </div>
              </div>
              {/* Action buttons */}
              <div className="px-4 pb-4 space-y-2">
                <div className="flex gap-2">
                  <button className="flex-1 py-3 rounded-xl text-sm font-bold active:scale-95 transition-all" style={{ backgroundColor:`${DRV_C}18`, color:DRV_C, border:`1px solid ${DRV_C}35` }}>
                    En Route
                  </button>
                  <button onClick={() => { setScreen("enroute"); setTab("route"); toast.success("Navigation started", { duration:2000 }); }}
                    className="flex-1 py-3 rounded-xl text-sm font-bold active:scale-95 transition-all" style={{ backgroundColor:DRV_C, color:"white" }}>
                    Start Navigation →
                  </button>
                </div>
                <button className="w-full py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 active:scale-95"
                  style={{ backgroundColor:"var(--erp-surface-soft)", color:"rgba(11,30,63,0.66)" }}>
                  <Phone size={13} /> Call Operations
                </button>
              </div>
            </div>
          )}

          {screen === "enroute" && (
            <div className="h-full flex flex-col" style={{ minHeight: 540 }}>
              {/* Stylized map */}
              <div className="flex-1 relative" style={{ background:"linear-gradient(160deg,#0d1827 0%,#111d2e 100%)", minHeight:320 }}>
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 390 330" preserveAspectRatio="xMidYMid slice">
                  {/* Grid roads */}
                  <line x1="0" y1="165" x2="390" y2="165" stroke="rgba(11,30,63,0.38)" strokeWidth="10" />
                  <line x1="0" y1="100" x2="390" y2="80"  stroke="rgba(11,30,63,0.38)" strokeWidth="6" />
                  <line x1="195" y1="0" x2="195" y2="330" stroke="rgba(11,30,63,0.38)" strokeWidth="10" />
                  <line x1="100" y1="0" x2="80"  y2="330" stroke="rgba(11,30,63,0.38)" strokeWidth="5" />
                  <line x1="290" y1="0" x2="310" y2="330" stroke="rgba(11,30,63,0.38)" strokeWidth="5" />
                  {/* Route line */}
                  <path d="M70,300 C70,240 120,200 160,160 C200,120 240,80 310,50"
                    stroke={DRV_C} strokeWidth="4" fill="none" strokeDasharray="10 5"
                    style={{ animation:"dash-march 1.2s linear infinite" }} />
                  {/* Origin dot */}
                  <circle cx="70" cy="300" r="10" fill={DRV_C} opacity="0.9" />
                  <circle cx="70" cy="300" r="18" fill={DRV_C} opacity="0.2" />
                  {/* Destination */}
                  <circle cx="310" cy="50" r="8" fill="white" opacity="0.9" />
                  {/* Driver marker */}
                  <circle cx="155" cy="165" r="7" fill={DRV_C} />
                  <circle cx="155" cy="165" r="14" fill={DRV_C} opacity="0.25" />
                  <circle cx="155" cy="165" r="22" fill={DRV_C} opacity="0.08" />
                </svg>
                {/* ETA overlay */}
                <div className="absolute top-4 left-4 right-4 rounded-xl p-3" style={{ backgroundColor:"rgba(0,0,0,0.75)", backdropFilter:"blur(12px)", border:"1px solid rgba(11,30,63,0.15)" }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-black text-[var(--erp-text-strong)]">14 min</div>
                      <div className="text-[10px]" style={{ color:"rgba(11,30,63,0.66)" }}>8.2 km · Arrive ~14:37</div>
                    </div>
                    <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold active:scale-95" style={{ backgroundColor:DRV_C, color:"white" }}>
                      <Navigation size={12} /> Maps
                    </button>
                  </div>
                </div>
                {/* Next turn indicator */}
                <div className="absolute bottom-4 left-4 right-4 flex items-center gap-3 rounded-xl p-3" style={{ backgroundColor:"rgba(0,0,0,0.65)", backdropFilter:"blur(8px)" }}>
                  <ChevronRight size={20} style={{ color:DRV_C }} />
                  <div>
                    <div className="text-xs font-bold text-[var(--erp-text-strong)]">Turn right on King Fahd Rd</div>
                    <div className="text-[9px]" style={{ color:"rgba(11,30,63,0.66)" }}>In 1.2 km</div>
                  </div>
                </div>
              </div>
              {/* Status actions */}
              <div className="px-4 py-4 shrink-0" style={{ backgroundColor:"#0C1B33" }}>
                <div className="flex gap-2 mb-2">
                  <button className="flex-1 py-3 rounded-xl text-sm font-bold active:scale-95" style={{ backgroundColor:`${DRV_C}18`, color:DRV_C, border:`1px solid ${DRV_C}30` }}>
                    En Route ●
                  </button>
                  <button onClick={() => { setScreen("arrived"); toast.success("Arrival marked!", { duration:2000 }); }}
                    className="flex-1 py-3 rounded-xl text-sm font-bold active:scale-95" style={{ backgroundColor:DRV_C, color:"white" }}>
                    Arrived ✓
                  </button>
                </div>
                <div className="text-[9px] text-center" style={{ color:"rgba(11,30,63,0.50)" }}>KAIA T1 → Marriott Makkah · DSP-005</div>
              </div>
            </div>
          )}

          {screen === "arrived" && (
            <div className="px-4 pt-2">
              <MHeader title="Arrival Confirmed" sub="DSP-005 · Marriott Makkah" back={() => setScreen("enroute")} color={DRV_C} />
              <MCard color="var(--erp-success)" className="mb-4">
                <div className="p-4 text-center">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ backgroundColor:"rgba(74,222,128,0.15)", border:"2px solid var(--erp-success)" }}>
                    <CheckCircle size={28} style={{ color:"var(--erp-success)" }} />
                  </div>
                  <div className="text-base font-black text-[var(--erp-text-strong)] mb-1">Arrived at Destination</div>
                  <div className="text-xs" style={{ color:"rgba(11,30,63,0.66)" }}>14:33 · Marriott Hotel, Makkah</div>
                </div>
              </MCard>
              <MSec title="Headcount Confirmation" color={DRV_C} />
              <MCard className="mb-4">
                <div className="p-4">
                  {[["Expected","52 pax"],["Boarded","52 pax"],["Disembarked","52 pax"],["Discrepancy","None"]].map(([l,v]) => (
                    <div key={l} className="flex justify-between py-1.5 text-sm" style={{ borderBottom:"1px solid rgba(11,30,63,0.08)" }}>
                      <span style={{ color:"rgba(11,30,63,0.66)" }}>{l}</span>
                      <span className="font-bold text-[var(--erp-text-strong)]">{v}</span>
                    </div>
                  ))}
                </div>
              </MCard>
              <button onClick={() => { toast.success("Trip completed — SAR 180 earned", { duration:3000 }); setScreen("home"); }}
                className="w-full py-4 rounded-xl text-sm font-black active:scale-95" style={{ backgroundColor:DRV_C, color:"white" }}>
                Complete Trip & Submit Report
              </button>
            </div>
          )}

          {screen === "docs" && (
            <div className="pt-2">
              <MHeader title="My Documents" sub="License & Vehicle Papers" color={DRV_C} />
              <MSec title="Required Documents" color={DRV_C} />
              {[
                { icon:FileText,  label:"Saudi Driving License",   expiry:"Mar 2027", status:"VALID",   color:"var(--erp-success)" },
                { icon:Truck,     label:"Vehicle Registration",    expiry:"Sep 2026", status:"VALID",   color:"var(--erp-success)" },
                { icon:Shield,    label:"Vehicle Insurance",       expiry:"Nov 2025", status:"VALID",   color:"var(--erp-success)" },
                { icon:ClipboardList, label:"Vehicle Inspection",  expiry:"Jul 2026", status:"EXPIRING",color:"var(--erp-warning)" },
              ].map(d => (
                <MRow key={d.label} icon={d.icon} label={d.label} sub={`Expires ${d.expiry}`} color={DRV_C}
                  right={<MPill label={d.status} color={d.color} size="xs" />} />
              ))}
              <div className="px-4 mt-4">
                <button onClick={() => toast.info("Opening camera for upload…", { duration:2000 })}
                  className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 active:scale-95"
                  style={{ backgroundColor:`${DRV_C}15`, color:DRV_C, border:`1px solid ${DRV_C}30` }}>
                  <Upload size={15} /> Upload New Document
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      <BottomTabs tabs={DRV_TABS} active={tab} onSelect={handleTab} color={DRV_C} />
    </div>
  );
}

// ─── Agent App ────────────────────────────────────────────────────────────────

const AGT_TABS: MobTab[] = [
  { id:"groups",  label:"Groups",  icon: Users    },
  { id:"scan",    label:"Scan",    icon: Camera   },
  { id:"tracker", label:"Track",   icon: Activity },
  { id:"wallet",  label:"Wallet",  icon: Wallet   },
  { id:"alerts",  label:"Alerts",  icon: Bell, badge: 3 },
];

const AGT_GROUPS = [
  { id:"GRP-2891", pax:47, season:"1446H", status:"IN_STAY",    stage:"Stay · Jabal Omar",       color:"var(--erp-success)" },
  { id:"GRP-2401", pax:28, season:"1446H", status:"HOTEL",      stage:"Hotel Booking",            color:"var(--erp-warning)" },
  { id:"GRP-2990", pax:52, season:"1446H", status:"FLIGHT",     stage:"Flight Ticketing",         color:AGT_C     },
  { id:"GRP-1884", pax:63, season:"1445H", status:"ARCHIVED",   stage:"Completed · Archived",     color:"rgba(11,30,63,0.38)" },
];

function AgentApp({ screen, setScreen }: { screen: AgentScreen; setScreen: (s: AgentScreen) => void }) {
  const [tab, setTab] = useState("groups");
  const handleTab = (id: string) => {
    setTab(id);
    if (id==="groups")  setScreen("groups");
    if (id==="scan")    setScreen("ocr");
    if (id==="tracker") setScreen("tracker");
    if (id==="wallet")  setScreen("wallet");
    if (id==="alerts")  setScreen("notifs");
  };

  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="flex-1 relative overflow-hidden">
        <div className="absolute inset-0 overflow-y-auto pb-1" style={{ scrollbarWidth:"none" }}>
          {screen === "groups" && (
            <div className="pt-2">
              <MHeader title="My Groups" sub="Rashidi Travel · Season 1446H" color={AGT_C}
                right={<button onClick={() => toast.info("এই মডিউল এখনও কনফিগার করা হয়নি।")} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor:AGT_C }}><Plus size={16} style={{ color:"white" }} /></button>} />
              {/* Wallet quick-look */}
              <div className="mx-4 mb-4 rounded-xl p-4" style={{ background:`linear-gradient(135deg,${AGT_C} 0%,var(--erp-cat-purple) 100%)` }}>
                <div className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color:"rgba(255,255,255,0.80)" }}>Wallet Balance</div>
                <div className="text-3xl font-black text-white">SAR 59,600</div>
                <div className="text-[10px] mt-1" style={{ color:"rgba(255,255,255,0.80)" }}>INV-1446-0091 outstanding · SAR 323,725</div>
              </div>
              {/* Search */}
              <div className="px-4 mb-3">
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ backgroundColor:"var(--erp-canvas)", border:"1px solid rgba(11,30,63,0.11)" }}>
                  <Search size={13} style={{ color:"rgba(11,30,63,0.50)" }} />
                  <span className="text-xs" style={{ color:"rgba(11,30,63,0.50)" }}>Search groups…</span>
                </div>
              </div>
              {/* Groups */}
              {AGT_GROUPS.map(g => (
                <button key={g.id} onClick={() => setScreen("detail")}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-white/5 transition-all"
                  style={{ borderBottom:"1px solid rgba(11,30,63,0.08)" }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor:`${g.color}15`, border:`1px solid ${g.color}25` }}>
                    <Users size={16} style={{ color:g.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-bold text-[var(--erp-text-strong)]">{g.id}</span>
                      <MPill label={g.status} color={g.color} size="xs" />
                    </div>
                    <div className="text-[10px]" style={{ color:"rgba(11,30,63,0.58)" }}>{g.pax} pax · {g.stage}</div>
                  </div>
                  <ChevronRight size={13} style={{ color:"rgba(11,30,63,0.38)" }} />
                </button>
              ))}
            </div>
          )}

          {screen === "detail" && (
            <div className="pt-2">
              <MHeader title="GRP-2891" sub="47 pax · Rashidi Travel" back={() => setScreen("groups")} color={AGT_C} />
              <div className="mx-4 mb-4">
                <MCard color={AGT_C}>
                  <div className="p-4 flex items-center gap-4">
                    <div className="flex-1">
                      <div className="text-[10px] font-black uppercase tracking-wider mb-1" style={{ color:"rgba(11,30,63,0.58)" }}>Current Stage</div>
                      <div className="text-base font-black text-[var(--erp-text-strong)]">In Stay</div>
                      <div className="text-[10px]" style={{ color:"rgba(11,30,63,0.58)" }}>Jabal Omar Hyatt · 14–28 Aug</div>
                    </div>
                    <MPill label="ACTIVE" color="var(--erp-success)" />
                  </div>
                </MCard>
              </div>
              <MSec title="Services" color={AGT_C} />
              {[
                { icon:Fingerprint,    label:"Visa",      status:"All 47 Approved",   color:"var(--erp-success)" },
                { icon:BedDouble,      label:"Hotel",     status:"Confirmed · 14 Aug", color:"var(--erp-success)" },
                { icon:Truck,          label:"Transport", status:"3 dispatches done",  color:"var(--erp-success)" },
                { icon:UtensilsCrossed,label:"Catering",  status:"Daily meals active", color:"var(--erp-success)" },
                { icon:FileText,       label:"Invoice",   status:"SAR 323,725 due",    color:"var(--erp-warning)" },
              ].map(s => <MRow key={s.label} icon={s.icon} label={s.label} sub={s.status} color={AGT_C} right={<MPill label={s.status.startsWith("SAR")?"OUTSTANDING":"DONE"} color={s.color} size="xs" />} />)}
              <div className="px-4 mt-4">
                <button onClick={() => setScreen("ocr")}
                  className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 active:scale-95"
                  style={{ backgroundColor:AGT_C, color:"white" }}>
                  <Camera size={15} /> Add Passenger (OCR)
                </button>
              </div>
            </div>
          )}

          {screen === "ocr" && (
            <MobCameraCapture color={AGT_C}
              onCapture={() => { toast.success("Passport captured", { description:"Auto-filling MOFA form…" }); setScreen("groups"); }}
              onCancel={() => setScreen("groups")} />
          )}

          {screen === "tracker" && (
            <div className="pt-2">
              <MHeader title="Status Tracker" sub="GRP-2891 · Real-time pipeline" color={AGT_C} />
              <div className="px-4 pt-2 pb-20">
                {[
                  { id:1, label:"Agent Registration",  done:true  },
                  { id:4, label:"Group Created",        done:true  },
                  { id:5, label:"Pax OCR Import",       done:true  },
                  { id:6, label:"Flight & Ticket",      done:true  },
                  { id:7, label:"Visa Processing",      done:true  },
                  { id:8, label:"Hotel Booking",        done:true  },
                  { id:9, label:"Transport Dispatch",   done:true  },
                  { id:10,label:"Catering",             done:true  },
                  { id:11,label:"Invoice",              done:true  },
                  { id:12,label:"Payment",              done:false, active:true },
                  { id:13,label:"Voucher",              done:false },
                  { id:14,label:"Notifications Sent",   done:false },
                  { id:15,label:"Arrival",              done:false },
                  { id:16,label:"Stay",                 done:false, future:true },
                ].map((s, i) => (
                  <div key={s.id} className="flex items-start gap-3 mb-0">
                    <div className="flex flex-col items-center" style={{ width:24 }}>
                      <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                        style={{ backgroundColor: s.done?"#16A34A18":s.active?`${AGT_C}18`:"rgba(11,30,63,0.38)", border:`1.5px solid ${s.done?"var(--erp-success)":s.active?AGT_C:"rgba(11,30,63,0.38)"}` }}>
                        {s.done ? <CheckCircle size={11} style={{ color:"var(--erp-success)" }} /> : s.active ? <div className="w-2 h-2 rounded-full" style={{ backgroundColor:AGT_C }} /> : <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor:"var(--erp-border)" }} />}
                      </div>
                      {i < 13 && <div className="w-px flex-1 mt-0.5 mb-0.5" style={{ height:20, backgroundColor:s.done?"rgba(74,222,128,0.25)":"rgba(11,30,63,0.38)" }} />}
                    </div>
                    <div className="flex-1 pb-3">
                      <div className="text-xs font-semibold" style={{ color:s.done?"rgba(11,30,63,0.76)":s.active?"rgba(11,30,63,0.94)":"rgba(11,30,63,0.50)" }}>
                        {s.id}. {s.label}
                        {s.active && <span className="ml-2 text-[8px] font-black px-1.5 py-0.5 rounded-full" style={{ backgroundColor:`${AGT_C}20`, color:AGT_C }}>ACTIVE</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {screen === "wallet" && (
            <div className="pt-2">
              <MHeader title="Wallet" sub="Rashidi Travel · Agent Account" color={AGT_C} />
              <div className="mx-4 mb-4 rounded-xl p-5" style={{ background:`linear-gradient(135deg,${AGT_C} 0%,#4F46E5 100%)` }}>
                <div className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color:"rgba(255,255,255,0.86)" }}>Available Balance</div>
                <div className="text-4xl font-black text-white mb-1">SAR 59,600</div>
                <div className="text-[10px]" style={{ color:"rgba(255,255,255,0.80)" }}>Last topped up: SAR 180,000 · 15 Jul</div>
                <button onClick={() => toast.info("Top-up request sent to TUBA Finance.", { duration:2500 })}
                  className="mt-4 px-4 py-2 rounded-xl text-xs font-bold active:scale-95" style={{ backgroundColor:"var(--erp-border)", color:"var(--erp-text-strong)" }}>
                  + Request Top-up
                </button>
              </div>
              <MSec title="Recent Transactions" color={AGT_C} />
              {[
                { label:"INV-1446-0091 issued",  amt:"-SAR 323,725", time:"Today",   type:"debit"  },
                { label:"Payment received",       amt:"+SAR 180,000", time:"15 Jul", type:"credit" },
                { label:"INV-1446-0087 settled",  amt:"-SAR 202,400", time:"10 Jul", type:"debit"  },
                { label:"Top-up",                  amt:"+SAR 300,000", time:"1 Jul",  type:"credit" },
              ].map(t => (
                <div key={t.label} className="flex items-center gap-3 px-4 py-3" style={{ borderBottom:"1px solid rgba(11,30,63,0.08)" }}>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor:t.type==="credit"?"rgba(74,222,128,0.12)":"rgba(248,113,113,0.12)" }}>
                    <TrendingUp size={14} style={{ color:t.type==="credit"?"var(--erp-success)":"var(--erp-destructive)", transform:t.type==="debit"?"scaleY(-1)":undefined }} />
                  </div>
                  <div className="flex-1"><div className="text-xs font-semibold text-[var(--erp-text-strong)]">{t.label}</div><div className="text-[9px]" style={{ color:"rgba(11,30,63,0.58)" }}>{t.time}</div></div>
                  <span className="text-sm font-bold" style={{ color:t.type==="credit"?"var(--erp-success)":"var(--erp-destructive)" }}>{t.amt}</span>
                </div>
              ))}
            </div>
          )}

          {screen === "notifs" && (
            <div className="pt-2">
              <MHeader title="Notifications" sub="3 unread" color={AGT_C} />
              {[
                { title:"GRP-2891 fully arrived",  sub:"47 pax delivered to Jabal Omar Hyatt", time:"10m",  urgent:false },
                { title:"Invoice INV-1446-0091",    sub:"SAR 323,725 due · Net 30 days",        time:"2h",   urgent:true  },
                { title:"Visa issued — 47 pax",     sub:"Visa Desk update · GRP-2891",           time:"8h",   urgent:false },
                { title:"Vouchers dispatched",       sub:"Hotel + transport vouchers sent",       time:"1d",   urgent:false },
              ].map((n, i) => (
                <div key={i} className="px-4 py-3.5" style={{ borderBottom:"1px solid rgba(11,30,63,0.08)", borderLeft:`3px solid ${n.urgent?"var(--erp-destructive)":"transparent"}`, backgroundColor:n.urgent?"rgba(239,68,68,0.04)":"transparent" }}>
                  <div className="flex items-start gap-2">
                    {n.urgent && <AlertTriangle size={12} className="mt-0.5 shrink-0" style={{ color:"var(--erp-destructive)" }} />}
                    <div className="flex-1">
                      <div className="text-xs font-bold" style={{ color:n.urgent?"var(--erp-destructive)":"rgba(11,30,63,0.94)" }}>{n.title}</div>
                      <div className="text-[10px] mt-0.5" style={{ color:"rgba(11,30,63,0.58)" }}>{n.sub}</div>
                    </div>
                    <span className="text-[9px] shrink-0" style={{ color:"rgba(11,30,63,0.50)", fontFamily:"var(--font-mono)" }}>{n.time}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <BottomTabs tabs={AGT_TABS} active={tab} onSelect={handleTab} color={AGT_C} />
    </div>
  );
}

// ─── Operations App ───────────────────────────────────────────────────────────

const OPS_TABS: MobTab[] = [
  { id:"board",    label:"Board",    icon: LayoutDashboard },
  { id:"dispatch", label:"Dispatch", icon: Truck           },
  { id:"alerts",   label:"Alerts",   icon: AlertTriangle, badge:1 },
  { id:"live",     label:"Live",     icon: Activity        },
];

function OpsApp({ screen, setScreen }: { screen: OpsScreen; setScreen: (s: OpsScreen) => void }) {
  const [tab, setTab] = useState("board");
  const handleTab = (id: string) => {
    setTab(id);
    if (id==="board")    setScreen("arrivals");
    if (id==="dispatch") setScreen("dispatch");
    if (id==="alerts")   setScreen("emergency");
    if (id==="live")     setScreen("live");
  };

  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="flex-1 relative overflow-hidden">
        <div className="absolute inset-0 overflow-y-auto pb-1" style={{ scrollbarWidth:"none" }}>
          {screen === "arrivals" && (
            <div className="pt-2">
              <div className="flex gap-2 px-4 pt-2 pb-3">
                {["Arrivals","Departures"].map(t => (
                  <button key={t} className="px-4 py-2 rounded-xl text-xs font-bold active:scale-95"
                    style={{ backgroundColor:t==="Arrivals"?OPS_C:`${OPS_C}18`, color:t==="Arrivals"?"white":OPS_C, border:`1px solid ${OPS_C}30` }}>
                    {t}
                  </button>
                ))}
              </div>
              <MHeader title="Arrivals · 16 Jul" sub="3 flights today · 146 pax" color={OPS_C} />
              <div className="px-4 space-y-3 pb-4">
                {[
                  { flight:"SV-802", from:"DAC", time:"08:45", pax:47, status:"AT GATE",  color:"var(--erp-success)", grp:"GRP-2891" },
                  { flight:"BG-088", from:"DAC", time:"11:20", pax:32, status:"EN ROUTE", color:OPS_C,     grp:"GRP-2744" },
                  { flight:"PK-901", from:"KHI", time:"15:40", pax:67, status:"SCHED",    color:"var(--erp-muted-soft)", grp:"GRP-3301" },
                ].map(f => (
                  <MCard key={f.flight} color={f.color}>
                    <div className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <Plane size={18} style={{ color:f.color }} />
                        <div className="flex-1">
                          <div className="text-base font-black text-[var(--erp-text-strong)]">{f.flight}</div>
                          <div className="text-[10px]" style={{ color:"rgba(11,30,63,0.66)" }}>From {f.from} · ETA {f.time}</div>
                        </div>
                        <MPill label={f.status} color={f.color} />
                      </div>
                      <div className="flex gap-4 text-xs">
                        <span style={{ color:"rgba(11,30,63,0.58)" }}><strong className="text-[var(--erp-text-strong)]">{f.pax}</strong> pax</span>
                        <span style={{ color:"rgba(11,30,63,0.58)" }}>Group: <strong className="text-[var(--erp-text-strong)]">{f.grp}</strong></span>
                      </div>
                      {f.status==="AT GATE" && (
                        <div className="flex gap-2 mt-3">
                          <button className="flex-1 py-2 rounded-xl text-[10px] font-bold active:scale-95" style={{ backgroundColor:`${OPS_C}15`, color:OPS_C, border:`1px solid ${OPS_C}30` }}>Deploy M&A</button>
                          <button onClick={() => toast.success("Buses assigned to SV-802", { duration:2000 })} className="flex-1 py-2 rounded-xl text-[10px] font-bold active:scale-95" style={{ backgroundColor:OPS_C, color:"white" }}>Assign Buses</button>
                        </div>
                      )}
                    </div>
                  </MCard>
                ))}
              </div>
            </div>
          )}

          {screen === "dispatch" && (
            <div className="pt-2">
              <MHeader title="Dispatch Assignment" sub="Assign drivers to groups" color={OPS_C} />
              <MSec title="Pending Assignments" color={OPS_C} />
              {[
                { grp:"GRP-2744", route:"KAIA T1 → Makkah Towers", pax:32, driver:null    },
                { grp:"GRP-3301", route:"KAIA T2 → Marriott Makkah",pax:67, driver:null    },
                { grp:"GRP-2891", route:"Jabal Omar → KAIA T1",     pax:47, driver:"Ahmad Hassan" },
              ].map(d => (
                <div key={d.grp} className="mx-4 mb-3">
                  <MCard color={d.driver?`${OPS_C}40`:OPS_C}>
                    <div className="p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-black" style={{ color:OPS_C, fontFamily:"var(--font-mono)" }}>{d.grp}</span>
                        <span className="text-[9px]" style={{ color:"rgba(11,30,63,0.58)" }}>{d.pax} pax</span>
                        <MPill label={d.driver?"ASSIGNED":"PENDING"} color={d.driver?"var(--erp-success)":OPS_C} size="xs" />
                      </div>
                      <div className="text-xs text-[var(--erp-text-strong)] mb-2">{d.route}</div>
                      {d.driver
                        ? <div className="text-[10px]" style={{ color:"var(--erp-success)" }}>Driver: {d.driver}</div>
                        : <button onClick={() => toast.success(`Driver assigned to ${d.grp}`, { duration:2000 })}
                            className="w-full py-2 rounded-xl text-[10px] font-bold active:scale-95" style={{ backgroundColor:OPS_C, color:"white" }}>
                            Assign Driver +
                          </button>
                      }
                    </div>
                  </MCard>
                </div>
              ))}
            </div>
          )}

          {screen === "emergency" && (
            <div className="h-full flex flex-col" style={{ backgroundColor:"#150000" }}>
              <div className="pt-2 px-4 pb-4 text-center">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mt-4 mb-3" style={{ backgroundColor:"rgba(239,68,68,0.2)", border:"2px solid var(--erp-destructive)" }}>
                  <AlertTriangle size={28} style={{ color:"var(--erp-destructive)" }} />
                </div>
                <div className="text-lg font-black text-white mb-1">EMERGENCY ALERT</div>
                <div className="text-sm" style={{ color:"rgba(255,100,100,0.8)" }}>Transport SLA Breach · DSP-006</div>
              </div>
              <div className="px-4 space-y-2 flex-1">
                {[["Group","GRP-2990 · 52 pax · Zamzam Pilgrim"],["Driver","Bassem Khalil · Bus TAH-06"],["Delay","3h 15min past SLA limit"],["Last GPS","Makkah-Jeddah Hwy, KM 45"],["Contact","+966-50-XXX-XXXX"]].map(([l,v]) => (
                  <div key={l} className="rounded-xl p-3" style={{ backgroundColor:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.2)" }}>
                    <div className="text-[9px] font-black uppercase tracking-wider mb-0.5" style={{ color:"rgba(239,68,68,0.6)" }}>{l}</div>
                    <div className="text-sm font-semibold text-white">{v}</div>
                  </div>
                ))}
              </div>
              <div className="px-4 pb-4 space-y-2 mt-4">
                <button onClick={() => toast.error("Calling driver...", { duration:2000 })}
                  className="w-full py-4 rounded-xl text-sm font-black flex items-center justify-center gap-2 active:scale-95" style={{ backgroundColor:"var(--erp-destructive)", color: "white" }}>
                  <Phone size={16} /> Call Driver Now
                </button>
                <button onClick={() => toast.success("Re-assignment initiated", { duration:2000 })}
                  className="w-full py-3 rounded-xl text-sm font-bold active:scale-95" style={{ backgroundColor:"rgba(239,68,68,0.12)", color:"#F87171", border:"1px solid rgba(239,68,68,0.25)" }}>
                  Re-assign & Dispatch New Vehicle
                </button>
              </div>
            </div>
          )}

          {screen === "live" && (
            <div className="pt-2">
              <MHeader title="Live Overview" sub="Now · TUBA Operations" color={OPS_C} />
              <div className="grid grid-cols-2 gap-3 px-4 mb-4">
                {[["8","Active Groups",OPS_C],["194","Pax Moving","var(--erp-success)"],["6","Dispatches",OPS_C],["1","Alert",  "var(--erp-destructive)"]].map(([v,l,c]) => (
                  <MCard key={l}>
                    <div className="p-3 text-center">
                      <div className="text-2xl font-black" style={{ color:c as string }}>{v}</div>
                      <div className="text-[9px] mt-0.5" style={{ color:"rgba(11,30,63,0.58)" }}>{l}</div>
                    </div>
                  </MCard>
                ))}
              </div>
              <MSec title="Live Dispatches" color={OPS_C} />
              {[
                { id:"DSP-005", route:"KAIA → Marriott", pct:85, color:OPS_C    },
                { id:"DSP-003", route:"Mosque → KAIA",   pct:40, color:OPS_C    },
                { id:"DSP-006", route:"Hilton → KAIA",   pct:20, color:"var(--erp-destructive)"},
              ].map(d => (
                <div key={d.id} className="px-4 py-3" style={{ borderBottom:"1px solid rgba(11,30,63,0.08)" }}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[10px] font-black" style={{ color:d.color, fontFamily:"var(--font-mono)" }}>{d.id}</span>
                    <span className="flex-1 text-xs text-[var(--erp-text-strong)]">{d.route}</span>
                    <span className="text-[10px] font-bold" style={{ color:d.color }}>{d.pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ backgroundColor:"var(--erp-canvas)" }}>
                    <div className="h-full rounded-full" style={{ width:`${d.pct}%`, backgroundColor:d.color }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <BottomTabs tabs={OPS_TABS} active={tab} onSelect={handleTab} color={OPS_C} />
    </div>
  );
}

// ─── Supervisor App ───────────────────────────────────────────────────────────

const SUP_TABS: MobTab[] = [
  { id:"approvals", label:"Approvals", icon: ClipboardList, badge:5 },
  { id:"kpis",      label:"KPIs",      icon: BarChart2     },
  { id:"alerts",    label:"Alerts",    icon: AlertTriangle, badge:2 },
  { id:"team",      label:"Team",      icon: Users         },
];

const PENDING_APPROVALS = [
  { id:"VIS-0341", type:"Visa",      icon:Fingerprint,    label:"GRP-3301 · 15 pax pending MOFA",  sub:"PIA Charter · Pakistan",          color:"var(--erp-cat-teal)",  },
  { id:"HOT-0088", type:"Hotel",     icon:BedDouble,      label:"Movenpick MKK · 28 rooms",        sub:"GRP-2401 · 19–31 Aug",            color:"var(--erp-info)",  },
  { id:"TRN-0121", type:"Transport", icon:Truck,          label:"Al-Naqil · 3 buses · GRP-3301",   sub:"KAIA T2 → Marriott · 15 Sep",     color:"var(--erp-cat-orange)",  },
  { id:"CAT-0055", type:"Catering",  icon:UtensilsCrossed,label:"Al-Barakah · Meal plan 67 pax",   sub:"GRP-3301 · Sep 15–29",            color:"var(--erp-warning)",  },
  { id:"FIN-0093", type:"Finance",   icon:FileText,       label:"INV-1446-0093 · SAR 450,000",     sub:"Rashidi Travel · Net 30d",         color:"var(--erp-success)",  },
];

function SupApp({ screen, setScreen }: { screen: SupScreen; setScreen: (s: SupScreen) => void }) {
  const [tab, setTab] = useState("approvals");
  const [approved, setApproved] = useState<Set<string>>(new Set());
  const handleTab = (id: string) => {
    setTab(id);
    if (id==="approvals") setScreen("approvals");
    if (id==="kpis")      setScreen("kpis");
    if (id==="alerts")    setScreen("alerts");
  };

  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="flex-1 relative overflow-hidden">
        <div className="absolute inset-0 overflow-y-auto pb-1" style={{ scrollbarWidth:"none" }}>
          {screen === "approvals" && (
            <div className="pt-2">
              <MHeader title="Approvals Inbox" sub={`${PENDING_APPROVALS.length - approved.size} pending`} color={SUP_C} />
              {PENDING_APPROVALS.map(a => {
                const isApproved = approved.has(a.id);
                const Icon = a.icon;
                return (
                  <div key={a.id} className="mx-4 mb-3">
                    <MCard color={isApproved?"var(--erp-success)":a.color}>
                      <div className="p-3">
                        <div className="flex items-start gap-3 mb-3">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor:`${a.color}18` }}>
                            <Icon size={16} style={{ color:a.color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-[9px] font-black" style={{ color:a.color, fontFamily:"var(--font-mono)" }}>{a.id}</span>
                              <MPill label={a.type} color={a.color} size="xs" />
                            </div>
                            <div className="text-xs font-semibold text-[var(--erp-text-strong)] truncate">{a.label}</div>
                            <div className="text-[9px] mt-0.5" style={{ color:"rgba(11,30,63,0.58)" }}>{a.sub}</div>
                          </div>
                        </div>
                        {isApproved
                          ? <div className="flex items-center gap-2 py-2 text-xs" style={{ color:"var(--erp-success)" }}><CheckCircle size={12} /> Approved</div>
                          : <div className="flex gap-2">
                              <button onClick={() => { setApproved(s => new Set(s).add(a.id)); toast.success(`${a.type} approved: ${a.id}`, { duration:2000 }); }}
                                className="flex-1 py-2 rounded-xl text-[10px] font-bold active:scale-95" style={{ backgroundColor:a.color, color:"white" }}>
                                Approve ✓
                              </button>
                              <button onClick={() => toast.error(`${a.id} rejected`, { duration:2000 })}
                                className="flex-1 py-2 rounded-xl text-[10px] font-bold active:scale-95" style={{ backgroundColor:"rgba(248,113,113,0.12)", color:"var(--erp-destructive)", border:"1px solid rgba(248,113,113,0.2)" }}>
                                Reject ✗
                              </button>
                            </div>
                        }
                      </div>
                    </MCard>
                  </div>
                );
              })}
            </div>
          )}

          {(screen === "visa" || screen === "hotel") && (
            <div className="pt-2">
              <MHeader title={screen==="visa"?"Visa Approval Detail":"Hotel Approval Detail"} back={() => setScreen("approvals")} color={SUP_C} />
              <div className="px-4 pt-2">
                <MCard color={SUP_C} className="mb-4">
                  <div className="p-4">
                    {(screen==="visa"
                      ? [["Reference","VIS-0341"],["Group","GRP-3301 · PIA Charter"],["Nationality","Pakistan"],["Pax","67 total · 15 pending"],["Status","MOFA queue · batch 3"],["Submitted","14 Jul 2025"]]
                      : [["Reference","HOT-0088"],["Group","GRP-2401"],["Hotel","Movenpick Makkah"],["Rooms","28 rooms · 4 types"],["Check-in","19 Aug 2025"],["Value","SAR 168,000"]]
                    ).map(([l,v]) => (
                      <div key={l} className="flex justify-between py-2 text-xs" style={{ borderBottom:"1px solid rgba(11,30,63,0.11)" }}>
                        <span style={{ color:"rgba(11,30,63,0.58)" }}>{l}</span>
                        <span className="font-semibold text-[var(--erp-text-strong)]">{v}</span>
                      </div>
                    ))}
                  </div>
                </MCard>
                <div className="flex gap-2">
                  <button onClick={() => { toast.success("Approved and notified", { duration:2000 }); setScreen("approvals"); }}
                    className="flex-1 py-3 rounded-xl text-sm font-bold active:scale-95" style={{ backgroundColor:SUP_C, color:"white" }}>
                    Approve ✓
                  </button>
                  <button onClick={() => { toast.error("Rejected", { duration:2000 }); setScreen("approvals"); }}
                    className="flex-1 py-3 rounded-xl text-sm font-bold active:scale-95" style={{ backgroundColor:"rgba(248,113,113,0.12)", color:"var(--erp-destructive)", border:"1px solid rgba(248,113,113,0.2)" }}>
                    Reject ✗
                  </button>
                </div>
              </div>
            </div>
          )}

          {screen === "kpis" && (
            <div className="pt-2">
              <MHeader title="KPI Snapshot" sub="Season 1446H · Today" color={SUP_C} />
              <div className="grid grid-cols-2 gap-3 px-4 mb-4">
                {[["SAR 8.45M","YTD Revenue",SUP_C,"↑ 12.4%"],["19.3%","Net Margin","var(--erp-success)","↑ 2.1pp"],["8","Active Groups","var(--erp-warning)",""],["924","Total Pax","var(--erp-cat-sky)",""]].map(([v,l,c,t]) => (
                  <MCard key={l}>
                    <div className="p-3">
                      <div className="text-xl font-black" style={{ color:c as string }}>{v}</div>
                      <div className="text-[9px] mt-0.5" style={{ color:"rgba(11,30,63,0.58)" }}>{l}</div>
                      {t && <div className="text-[8px] font-bold mt-1" style={{ color:"var(--erp-success)" }}>{t as string}</div>}
                    </div>
                  </MCard>
                ))}
              </div>
              <MSec title="Module Health" color={SUP_C} />
              {[["Visa Desk","72%","var(--erp-success)"],["Hotel Desk","85%","var(--erp-success)"],["Transport","94%","var(--erp-warning)"],["Finance","55%","var(--erp-success)"],["Automation","88%","var(--erp-warning)"]].map(([n,p,c]) => (
                <div key={n as string} className="flex items-center gap-3 px-4 py-2.5" style={{ borderBottom:"1px solid rgba(11,30,63,0.08)" }}>
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor:c as string }} />
                  <span className="flex-1 text-xs text-[var(--erp-text-strong)]">{n}</span>
                  <div className="w-20 h-1.5 rounded-full" style={{ backgroundColor:"var(--erp-canvas)" }}>
                    <div className="h-full rounded-full" style={{ width:p as string, backgroundColor:c as string }} />
                  </div>
                  <span className="text-[9px] w-8 text-right font-bold" style={{ color:c as string, fontFamily:"var(--font-mono)" }}>{p}</span>
                </div>
              ))}
            </div>
          )}

          {screen === "alerts" && (
            <div className="pt-2">
              <MHeader title="Escalation Alerts" sub="2 require action" color={SUP_C} />
              {[
                { title:"Transport SLA breach — DSP-006",  sub:"Bassem Khalil · 3h delay · 52 pax affected",  priority:"HIGH",   color:"var(--erp-destructive)" },
                { title:"INV-1446-0091 overdue by 3 days", sub:"Rashidi Travel · SAR 323,725 · Notify agent",  priority:"MEDIUM", color:"var(--erp-warning)" },
                { title:"OCR flag: GRP-3301 (3 pax)",      sub:"Passport field mismatch · requires manual check", priority:"LOW", color:"var(--erp-muted-soft)" },
              ].map((a, i) => (
                <div key={i} className="mx-4 mb-3">
                  <MCard color={a.color}>
                    <div className="p-3">
                      <div className="flex items-start gap-2 mb-2">
                        <AlertTriangle size={13} className="shrink-0 mt-0.5" style={{ color:a.color }} />
                        <div className="flex-1">
                          <div className="text-xs font-bold text-[var(--erp-text-strong)]">{a.title}</div>
                          <div className="text-[9px] mt-0.5" style={{ color:"rgba(11,30,63,0.66)" }}>{a.sub}</div>
                        </div>
                        <MPill label={a.priority} color={a.color} size="xs" />
                      </div>
                      <button onClick={() => toast.success("Escalation acknowledged", { duration:2000 })}
                        className="w-full py-2 rounded-xl text-[10px] font-bold active:scale-95"
                        style={{ backgroundColor:`${a.color}15`, color:a.color, border:`1px solid ${a.color}25` }}>
                        Acknowledge & Action
                      </button>
                    </div>
                  </MCard>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <BottomTabs tabs={SUP_TABS} active={tab} onSelect={handleTab} color={SUP_C} />
    </div>
  );
}

// ─── Phone frame ──────────────────────────────────────────────────────────────

function PhoneFrame({ children, color }: { children: ReactNode; color: string }) {
  return (
    <div className="relative shrink-0" style={{
      width: 390, height: 720,
      borderRadius: 44,
      overflow: "hidden",
      backgroundColor: "var(--erp-canvas)",
      boxShadow: `0 0 0 2px rgba(11,30,63,0.18), 0 0 0 10px #0a0a0a, 0 50px 100px rgba(0,0,0,0.7), 0 0 80px ${color}08`,
    }}>
      {/* Dynamic Island */}
      <div className="absolute top-2.5 left-1/2 -translate-x-1/2 z-30 flex items-center justify-center"
        style={{ width:112, height:28, borderRadius:20, backgroundColor:"#0a0a0a" }}>
        <div className="w-2 h-2 rounded-full ml-8" style={{ backgroundColor:"#1a1a1a" }} />
      </div>

      {/* Status bar */}
      <div className="absolute top-0 left-0 right-0 h-12 z-20 flex items-end pb-1.5 px-6 pointer-events-none">
        <span className="text-[11px] font-bold text-[var(--erp-text-strong)]">9:41</span>
        <div className="ml-auto flex items-center gap-1.5">
          <svg width="14" height="10" viewBox="0 0 14 10" fill="rgba(11,30,63,0.94)">
            <rect x="0" y="5" width="2.5" height="5" rx="0.5" />
            <rect x="3.5" y="3.5" width="2.5" height="6.5" rx="0.5" />
            <rect x="7" y="2" width="2.5" height="8" rx="0.5" />
            <rect x="10.5" y="0" width="2.5" height="10" rx="0.5" />
          </svg>
          <div className="flex items-center gap-0.5">
            <div className="w-5 h-2.5 rounded-sm" style={{ border:"1px solid rgba(11,30,63,0.22)", padding:"1px" }}>
              <div className="h-full rounded-sm" style={{ width:"75%", backgroundColor:"var(--erp-border)" }} />
            </div>
            <div className="w-0.5 h-1.5 rounded-r" style={{ backgroundColor:"var(--erp-border)" }} />
          </div>
        </div>
      </div>

      {/* App content — starts below status bar */}
      <div className="absolute inset-0" style={{ paddingTop:48 }}>
        {children}
      </div>

      {/* Home indicator */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 rounded-full" style={{ backgroundColor:"var(--erp-border)", zIndex:30 }} />
    </div>
  );
}

// ─── App info panel (right of phone) ─────────────────────────────────────────

const APP_META: Record<AppId, { name: string; desc: string; color: string; features: string[] }> = {
  driver: { name:"Driver App", color:DRV_C,  desc:"For TUBA-registered bus drivers. Shows today's dispatch schedule, trip navigation, and document management.",
    features:["Today's trip list with pax count","Turn-by-turn navigation handoff","En Route / Arrived status updates","Headcount confirmation on arrival","License & vehicle document upload"] },
  agent:  { name:"Agent App",  color:AGT_C,  desc:"For registered travel agents. Manage groups, add passengers via passport scan, track pipeline status, and monitor wallet.",
    features:["Group overview with service status","Passport OCR camera capture","19-stage pipeline tracker","Wallet balance & transactions","Push notifications & alerts"] },
  ops:    { name:"Operations App", color:OPS_C, desc:"For TUBA Ops team. Mobile arrival/departure board, dispatch assignment, and emergency alert management.",
    features:["Flight arrival / departure cards","One-tap driver assignment","Emergency dispatch with map","Live dispatch progress tracking","SLA breach notifications"] },
  sup:    { name:"Supervisor App", color:SUP_C, desc:"For supervisors and department heads. One-tap approvals, real-time KPIs, and escalation management.",
    features:["Unified approval inbox (5 types)","One-tap approve / reject with log","KPI snapshot with module health","Escalation alert triage","Cross-module visibility"] },
};

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function MobileApps() {
  const [activeApp, setActiveApp]        = useState<AppId>("driver");
  const [driverScreen, setDriverScreen]  = useState<DriverScreen>("home");
  const [agentScreen,  setAgentScreen]   = useState<AgentScreen>("groups");
  const [opsScreen,    setOpsScreen]     = useState<OpsScreen>("arrivals");
  const [supScreen,    setSupScreen]     = useState<SupScreen>("approvals");

  const appColor = { driver:DRV_C, agent:AGT_C, ops:OPS_C, sup:SUP_C }[activeApp];
  const meta     = APP_META[activeApp];

  const currentScreen = { driver:driverScreen, agent:agentScreen, ops:opsScreen, sup:supScreen }[activeApp];

  const setCurrentScreen = (id: string) => {
    if (activeApp==="driver") setDriverScreen(id as DriverScreen);
    if (activeApp==="agent")  setAgentScreen(id as AgentScreen);
    if (activeApp==="ops")    setOpsScreen(id as OpsScreen);
    if (activeApp==="sup")    setSupScreen(id as SupScreen);
  };

  return (
    <ERPShell
      moduleId="mobile"
      moduleName="Mobile Apps"
      moduleColor={MOB}
      moduleIcon={Smartphone as IconFC}
      navItems={MOB_NAV}
      activeItem={activeApp}
      onItemClick={id => { setActiveApp(id as AppId); }}
      breadcrumb={["Mobile Apps", meta.name]}
      notificationCount={0}
      userName="Abdullah Al-Otaibi"
      userRole="TUBA AL HIJAZ · Super Admin"
    >
      <div className="h-full overflow-y-auto" style={{ scrollbarWidth:"thin", scrollbarColor:"rgba(11,30,63,0.38) transparent" }}>
        <div className="flex gap-8 p-8 items-start justify-center min-h-full">

          {/* Phone frame + screen selector */}
          <div className="flex flex-col items-center gap-5 shrink-0">
            {/* Screen selector pills */}
            <div className="flex flex-wrap gap-1.5 justify-center" style={{ maxWidth:390 }}>
              {SCREEN_LABELS[activeApp].map(s => (
                <button
                  key={s.id}
                  onClick={() => setCurrentScreen(s.id)}
                  className="px-3 py-1.5 rounded-full text-[9px] font-bold transition-all active:scale-95"
                  style={{
                    backgroundColor: currentScreen===s.id ? `${appColor}22` : "rgba(11,30,63,0.38)",
                    border: `1px solid ${currentScreen===s.id ? appColor+"50" : "rgba(11,30,63,0.38)"}`,
                    color: currentScreen===s.id ? appColor : "rgba(11,30,63,0.58)",
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Phone */}
            <PhoneFrame color={appColor}>
              {activeApp==="driver" && <DriverApp screen={driverScreen} setScreen={setDriverScreen} />}
              {activeApp==="agent"  && <AgentApp  screen={agentScreen}  setScreen={setAgentScreen}  />}
              {activeApp==="ops"    && <OpsApp    screen={opsScreen}    setScreen={setOpsScreen}    />}
              {activeApp==="sup"    && <SupApp    screen={supScreen}    setScreen={setSupScreen}    />}
            </PhoneFrame>

            {/* Screen label */}
            <div className="text-center">
              <div className="text-xs font-bold text-[var(--erp-text-strong)]">{SCREEN_LABELS[activeApp].find(s=>s.id===currentScreen)?.label ?? "—"}</div>
              <div className="text-[9px] mt-0.5" style={{ color:"rgba(11,30,63,0.50)" }}>{activeApp.toUpperCase()} · Screen {SCREEN_LABELS[activeApp].findIndex(s=>s.id===currentScreen)+1} of {SCREEN_LABELS[activeApp].length}</div>
            </div>
          </div>

          {/* App info panel */}
          <div className="w-72 shrink-0 space-y-4 pt-12">
            <div className="rounded-xl p-5" style={{ backgroundColor:"var(--erp-surface-soft)", border:`1px solid ${appColor}20` }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor:`${appColor}18` }}>
                  <Smartphone size={18} style={{ color:appColor }} />
                </div>
                <div>
                  <div className="text-sm font-black text-[var(--erp-text-strong)]">{meta.name}</div>
                  <div className="text-[9px]" style={{ color:`${appColor}BB` }}>iOS & Android · React Native</div>
                </div>
              </div>
              <p className="text-[10px] leading-relaxed mb-4" style={{ color:"rgba(11,30,63,0.66)" }}>{meta.desc}</p>
              <div className="text-[8px] font-black uppercase tracking-widest mb-2.5" style={{ color:"rgba(11,30,63,0.50)" }}>Features</div>
              {meta.features.map((f, i) => (
                <div key={i} className="flex items-start gap-2 mb-1.5">
                  <div className="w-1.5 h-1.5 rounded-full mt-1 shrink-0" style={{ backgroundColor:appColor }} />
                  <span className="text-[9.5px]" style={{ color:"rgba(11,30,63,0.76)" }}>{f}</span>
                </div>
              ))}
            </div>

            {/* Other apps */}
            <div className="rounded-xl p-4" style={{ backgroundColor:"var(--erp-surface)", border:"1px solid rgba(11,30,63,0.11)" }}>
              <div className="text-[8px] font-black uppercase tracking-widest mb-3" style={{ color:"rgba(11,30,63,0.50)" }}>All Mobile Apps</div>
              {(["driver","agent","ops","sup"] as AppId[]).map(id => {
                const m = APP_META[id];
                const isA = id === activeApp;
                return (
                  <button key={id} onClick={() => setActiveApp(id)}
                    className="w-full flex items-center gap-2.5 py-2 px-2 rounded-xl mb-1 transition-all active:scale-97"
                    style={{ backgroundColor:isA?`${m.color}12`:"transparent", border:`1px solid ${isA?m.color+"25":"transparent"}` }}>
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor:m.color }} />
                    <span className="text-[10px] font-semibold flex-1 text-left" style={{ color:isA?m.color:"rgba(11,30,63,0.66)" }}>{m.name}</span>
                    {isA && <MPill label="ACTIVE" color={m.color} size="xs" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </ERPShell>
  );
}
