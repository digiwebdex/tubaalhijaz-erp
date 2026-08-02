// ─── Page 18 · Tablet Views ── TUBA AL HIJAZ ERP ────────────────────────────
import { useState, type CSSProperties, type ReactNode } from "react";
import {
  Zap, Users, Truck, Shield, Settings, UserCircle,
  Search, Bell, CheckCircle, AlertTriangle,
  MapPin, Navigation, Phone, ArrowRight,
} from "lucide-react";
import { ERPShell, type NavItem as ShellNavItem, type IconFC } from "../components/ERPShell";

// ─── Types ────────────────────────────────────────────────────────────────────

type TabletView = "ops" | "agent" | "driver" | "sup";

interface TabNav { id: TabletView; label: string; icon: IconFC; color: string; }

// ─── Constants ────────────────────────────────────────────────────────────────

const TAB_MOD  = "#6366F1";
const OPS_C    = "#DC4E2A";
const AGT_C    = "#9333EA";
const DRV_C    = "#EA580C";
const SUP_C    = "#0D9488";
const BG_DARK  = "#080E1E";
const BG_MID   = "#0C1628";
const BG_CARD  = "#111E35";
const BORDER   = "rgba(11,30,63,0.38)";
const MUTED    = "#64748B";
const TEXT     = "#E8EDF5";
const TEXT_DIM = "#94A3B8";

const TAB_NAV: TabNav[] = [
  { id:"ops",    label:"Ops Terminal",  icon: Zap    as IconFC, color: OPS_C },
  { id:"agent",  label:"Agent Portal",  icon: Users  as IconFC, color: AGT_C },
  { id:"driver", label:"Driver Tablet", icon: Truck  as IconFC, color: DRV_C },
  { id:"sup",    label:"Supervisor",    icon: Shield as IconFC, color: SUP_C },
];

// ─── Mock data ────────────────────────────────────────────────────────────────

const FLIGHTS = [
  { id:"F1", no:"SV-821", from:"CGP", terminal:"T2", eta:"10:35", pax:248, status:"landing" },
  { id:"F2", no:"BG-404", from:"DAC", terminal:"T1", eta:"11:10", pax:182, status:"taxiing" },
  { id:"F3", no:"SV-303", from:"JED", terminal:"T2", eta:"12:00", pax:312, status:"scheduled" },
  { id:"F4", no:"WY-551", from:"MCT", terminal:"T3", eta:"12:45", pax:97,  status:"delayed" },
];

const DEPARTURES = [
  { no:"SV-822", to:"CGP", etd:"14:00", gate:"G12", pax:248, status:"boarding" },
  { no:"BG-405", to:"DAC", etd:"15:30", gate:"G7",  pax:182, status:"check-in" },
  { no:"SV-304", to:"JED", etd:"16:15", gate:"G3",  pax:310, status:"scheduled" },
];

const DISPATCHES = [
  { id:"D-001", driver:"Khalil A.", vehicle:"Bus-07", route:"T2→Hilton", pax:22, status:"en-route" },
  { id:"D-002", driver:"Rahim M.",  vehicle:"Van-12", route:"T1→Mercure",pax:9,  status:"loading" },
  { id:"D-003", driver:"Noor S.",   vehicle:"Bus-03", route:"T3→Pullman",pax:41, status:"waiting" },
  { id:"D-004", driver:"Faruk H.",  vehicle:"Van-08", route:"T2→Makkah", pax:7,  status:"complete" },
];

const GROUPS = [
  { id:"GRP-1041", name:"Dhaka Hajj Group A",  pax:248, agent:"Al-Najm Travel",  status:"active" },
  { id:"GRP-1042", name:"Chittagong Umrah B",  pax:182, agent:"Makkah Direct",   status:"active" },
  { id:"GRP-1043", name:"Sylhet VIP Group",    pax:40,  agent:"Royal Pilgrims",  status:"pending" },
  { id:"GRP-1044", name:"Rajshahi Group C",    pax:97,  agent:"Al-Baraka Co.",   status:"active" },
  { id:"GRP-1045", name:"Khulna Delegation",   pax:60,  agent:"Zamzam Tours",    status:"pending" },
];

const PASSENGERS = [
  { id:"P-101", name:"Mohammad Hasan",   passport:"BD9812345", seat:"24A", status:"checked-in" },
  { id:"P-102", name:"Fatima Begum",     passport:"BD9823456", seat:"24B", status:"checked-in" },
  { id:"P-103", name:"Abdul Karim",      passport:"BD9834567", seat:"25C", status:"pending" },
  { id:"P-104", name:"Salma Khatun",     passport:"BD9845678", seat:"26A", status:"checked-in" },
  { id:"P-105", name:"Nurul Islam",      passport:"BD9856789", seat:"26B", status:"boarding" },
  { id:"P-106", name:"Rabeya Akter",     passport:"BD9867890", seat:"27C", status:"pending" },
];

const DRV_TRIPS = [
  { id:"T-44", from:"Terminal 2",  to:"Hilton Makkah",   pax:22, dist:"4.2 km", status:"active",    time:"10:15" },
  { id:"T-45", from:"Terminal 1",  to:"Mercure Jeddah",  pax:9,  dist:"12.8 km",status:"scheduled", time:"11:00" },
  { id:"T-46", from:"Terminal 3",  to:"Pullman ZamZam",  pax:41, dist:"3.1 km", status:"scheduled", time:"12:30" },
  { id:"T-47", from:"Grand Mosque",to:"Mövenpick Hotel", pax:14, dist:"0.9 km", status:"complete",  time:"09:30" },
];

const APPROVALS = [
  { id:"AP-88",  type:"Rate Change",    agent:"Al-Najm Travel",  amount:"SAR 48,000", time:"08:42", priority:"high" },
  { id:"AP-89",  type:"Group Discount", agent:"Royal Pilgrims",  amount:"SAR 12,500", time:"09:15", priority:"normal" },
  { id:"AP-90",  type:"Refund Request", agent:"Zamzam Tours",    amount:"SAR 6,800",  time:"09:55", priority:"high" },
  { id:"AP-91",  type:"Credit Limit",   agent:"Makkah Direct",   amount:"SAR 200,000",time:"10:30", priority:"normal" },
];

// ─── Shared micro-components ──────────────────────────────────────────────────

function TPill({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      display:"inline-flex", alignItems:"center",
      padding:"2px 8px", borderRadius:20,
      fontSize:11, fontWeight:600,
      background:`${color}22`, color,
    }}>{label}</span>
  );
}

function StatusPill({ s }: { s: string }) {
  const map: Record<string, [string, string]> = {
    landing:    ["#22C55E","Landing"],
    taxiing:    ["#3B82F6","Taxiing"],
    scheduled:  ["#64748B","Scheduled"],
    delayed:    ["#EF4444","Delayed"],
    boarding:   ["#22C55E","Boarding"],
    "check-in": ["#F59E0B","Check-in"],
    "en-route": ["#22C55E","En Route"],
    loading:    ["#F59E0B","Loading"],
    waiting:    ["#64748B","Waiting"],
    complete:   ["#64748B","Complete"],
    active:     ["#22C55E","Active"],
    pending:    ["#F59E0B","Pending"],
    "checked-in":["#22C55E","Checked-in"],
    "boarding2":["#3B82F6","Boarding"],
  };
  const [c, l] = map[s] ?? ["#64748B", s];
  return <TPill label={l} color={c} />;
}

function TSearchBar({ placeholder, color }: { placeholder: string; color: string }) {
  return (
    <div style={{
      display:"flex", alignItems:"center", gap:8,
      background:"#FBFCFD", border:`1px solid ${BORDER}`,
      borderRadius:10, padding:"8px 12px", flex:1,
    }}>
      <Search size={14} style={{ color:MUTED, flexShrink:0 }} />
      <input
        placeholder={placeholder}
        style={{
          background:"transparent", border:"none", outline:"none",
          color:TEXT, fontSize:13, width:"100%",
        }}
      />
    </div>
  );
}

function TSectionHead({ title, count, color }: { title: string; count?: number; color: string }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
      <span style={{ fontSize:11, fontWeight:700, letterSpacing:"0.08em", color, textTransform:"uppercase" }}>
        {title}
      </span>
      {count !== undefined && (
        <span style={{
          background:`${color}22`, color,
          fontSize:10, fontWeight:700,
          padding:"1px 6px", borderRadius:20,
        }}>{count}</span>
      )}
    </div>
  );
}

// ─── Icon Rail (64px, icons-only with title tooltip) ─────────────────────────

function IconRail({
  items, active, onSelect, color,
  appIcon: AppIcon,
}: {
  items: TabNav[];
  active: TabletView;
  onSelect: (id: TabletView) => void;
  color: string;
  appIcon: IconFC;
}) {
  return (
    <div style={{
      width:64, flexShrink:0, height:"100%",
      backgroundColor:BG_DARK,
      borderRight:`1px solid ${BORDER}`,
      display:"flex", flexDirection:"column",
      alignItems:"center",
      paddingTop:16, paddingBottom:16, gap:4,
    }}>
      {/* App mark */}
      <div style={{
        width:40, height:40, borderRadius:10,
        background:`${color}22`,
        display:"flex", alignItems:"center", justifyContent:"center",
        marginBottom:8,
      }}>
        <AppIcon size={20} style={{ color }} />
      </div>

      <div style={{ flex:1, display:"flex", flexDirection:"column", gap:4, width:"100%" }}>
        {items.map(item => {
          const Ic = item.icon;
          const isActive = item.id === active;
          return (
            <button
              key={item.id}
              title={item.label}
              onClick={() => onSelect(item.id)}
              style={{
                width:"100%", height:48,
                display:"flex", alignItems:"center", justifyContent:"center",
                background: isActive ? `${item.color}22` : "transparent",
                border:"none",
                borderLeft: isActive ? `2px solid ${item.color}` : "2px solid transparent",
                cursor:"pointer",
                transition:"background 120ms ease",
              }}
            >
              <Ic size={20} style={{ color: isActive ? item.color : TEXT_DIM }} />
            </button>
          );
        })}
      </div>

      {/* Bottom: settings + avatar */}
      <button title="Settings" style={{ width:"100%", height:48, display:"flex", alignItems:"center", justifyContent:"center", background:"transparent", border:"none", cursor:"pointer" }}>
        <Settings size={18} style={{ color: TEXT_DIM }} />
      </button>
      <div style={{ width:32, height:32, borderRadius:"50%", background:"#EEF1F6", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <UserCircle size={18} style={{ color: TEXT_DIM }} />
      </div>
    </div>
  );
}

// ─── Tablet Frame (834×~980px iPad Air portrait) ──────────────────────────────

function TabletFrame({ color, children }: { color: string; children: ReactNode }) {
  return (
    <div style={{
      width:834, flexShrink:0,
      background:"#1A1A1F",
      borderRadius:28,
      padding:"10px 8px 14px",
      boxShadow:"0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(11,30,63,0.06)",
      display:"flex", flexDirection:"column",
      gap:0,
    }}>
      {/* Front camera strip */}
      <div style={{
        height:20,
        display:"flex", alignItems:"center", justifyContent:"center",
        flexShrink:0,
      }}>
        <div style={{ width:8, height:8, borderRadius:"50%", background:"#2A2A30" }} />
      </div>

      {/* Screen area */}
      <div style={{
        background:BG_DARK, borderRadius:16,
        overflow:"hidden",
        display:"flex", flexDirection:"column",
        height:900,
      }}>
        {/* Status bar */}
        <div style={{
          height:28, flexShrink:0,
          display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"0 20px",
          background:BG_DARK,
          borderBottom:`1px solid ${BORDER}`,
        }}>
          <span style={{ fontSize:11, fontWeight:600, color:TEXT }}>9:41</span>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <Bell size={12} style={{ color:TEXT_DIM }} />
            <div style={{ width:18, height:9, border:`1.5px solid ${TEXT_DIM}`, borderRadius:2, display:"flex", alignItems:"center", padding:"1px 1px" }}>
              <div style={{ width:"75%", height:"100%", background:TEXT_DIM, borderRadius:1 }} />
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex:1, display:"flex", overflow:"hidden" }}>
          {children}
        </div>
      </div>

      {/* Home gesture bar */}
      <div style={{ height:14, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
        <div style={{ width:100, height:4, borderRadius:2, background:"#E4E9F0" }} />
      </div>
    </div>
  );
}

// ─── Ops Terminal ─────────────────────────────────────────────────────────────

function OpsTablet() {
  const [tab, setTab] = useState<"arrivals"|"departures"|"dispatch"|"live">("arrivals");
  const tabs = ["arrivals","departures","dispatch","live"] as const;
  const tabLabels = { arrivals:"Arrivals", departures:"Departures", dispatch:"Dispatch", live:"Live Board" };

  return (
    <div style={{ display:"flex", height:"100%", width:"100%" }}>
      <IconRail
        items={TAB_NAV} active="ops" onSelect={() => {}}
        color={OPS_C} appIcon={Zap as IconFC}
      />
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        {/* Header */}
        <div style={{ height:52, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 16px", borderBottom:`1px solid ${BORDER}` }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <Zap size={16} style={{ color:OPS_C }} />
            <span style={{ fontSize:14, fontWeight:700, color:TEXT }}>Ops Terminal</span>
          </div>
          <TSearchBar placeholder="Search flights, routes…" color={OPS_C} />
        </div>

        {/* Tab bar */}
        <div style={{ height:40, flexShrink:0, display:"flex", alignItems:"center", gap:2, padding:"0 16px", borderBottom:`1px solid ${BORDER}` }}>
          {tabs.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding:"4px 14px", border:"none", borderRadius:6, cursor:"pointer", fontSize:12, fontWeight:600,
                background: tab===t ? `${OPS_C}22` : "transparent",
                color: tab===t ? OPS_C : TEXT_DIM,
                borderBottom: tab===t ? `2px solid ${OPS_C}` : "2px solid transparent",
              }}
            >{tabLabels[t]}</button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex:1, overflow:"auto", padding:16 }}>
          {tab === "arrivals" && (
            <>
              <TSectionHead title="Arrivals Today" count={FLIGHTS.length} color={OPS_C} />
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                {FLIGHTS.map(f => (
                  <div key={f.id} style={{ background:BG_CARD, border:`1px solid ${BORDER}`, borderRadius:12, padding:14 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                      <div>
                        <div style={{ fontSize:16, fontWeight:800, color:TEXT, fontFamily:"var(--font-mono)" }}>{f.no}</div>
                        <div style={{ fontSize:12, color:TEXT_DIM }}>{f.from} → JED</div>
                      </div>
                      <StatusPill s={f.status} />
                    </div>
                    <div style={{ display:"flex", gap:16 }}>
                      <div>
                        <div style={{ fontSize:10, color:MUTED, marginBottom:2 }}>ETA</div>
                        <div style={{ fontSize:14, fontWeight:700, color:TEXT }}>{f.eta}</div>
                      </div>
                      <div>
                        <div style={{ fontSize:10, color:MUTED, marginBottom:2 }}>Terminal</div>
                        <div style={{ fontSize:14, fontWeight:700, color:TEXT }}>{f.terminal}</div>
                      </div>
                      <div>
                        <div style={{ fontSize:10, color:MUTED, marginBottom:2 }}>Pax</div>
                        <div style={{ fontSize:14, fontWeight:700, color:OPS_C }}>{f.pax}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {tab === "departures" && (
            <>
              <TSectionHead title="Departures Today" count={DEPARTURES.length} color={OPS_C} />
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead>
                  <tr style={{ background:BG_MID }}>
                    {["Flight","Destination","ETD","Gate","Pax","Status"].map(h => (
                      <th key={h} style={{ padding:"8px 10px", textAlign:"left", fontSize:10, fontWeight:700, color:MUTED, textTransform:"uppercase", letterSpacing:"0.06em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DEPARTURES.map((d,i) => (
                    <tr key={i} style={{ borderBottom:`1px solid ${BORDER}` }}>
                      <td style={{ padding:"12px 10px", fontSize:13, fontWeight:700, color:TEXT, fontFamily:"var(--font-mono)" }}>{d.no}</td>
                      <td style={{ padding:"12px 10px", fontSize:13, color:TEXT_DIM }}>{d.to}</td>
                      <td style={{ padding:"12px 10px", fontSize:13, fontWeight:600, color:TEXT }}>{d.etd}</td>
                      <td style={{ padding:"12px 10px", fontSize:13, color:TEXT }}>{d.gate}</td>
                      <td style={{ padding:"12px 10px", fontSize:13, fontWeight:600, color:OPS_C }}>{d.pax}</td>
                      <td style={{ padding:"12px 10px" }}><StatusPill s={d.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {tab === "dispatch" && (
            <>
              <TSectionHead title="Active Dispatches" count={DISPATCHES.length} color={OPS_C} />
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead>
                  <tr style={{ background:BG_MID }}>
                    {["Dispatch ID","Driver","Vehicle","Route","Pax","Status"].map(h => (
                      <th key={h} style={{ padding:"8px 10px", textAlign:"left", fontSize:10, fontWeight:700, color:MUTED, textTransform:"uppercase", letterSpacing:"0.06em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DISPATCHES.map(d => (
                    <tr key={d.id} style={{ borderBottom:`1px solid ${BORDER}` }}>
                      <td style={{ padding:"12px 10px", fontSize:12, fontWeight:700, color:TEXT_DIM, fontFamily:"var(--font-mono)" }}>{d.id}</td>
                      <td style={{ padding:"12px 10px", fontSize:13, fontWeight:600, color:TEXT }}>{d.driver}</td>
                      <td style={{ padding:"12px 10px", fontSize:13, color:TEXT_DIM }}>{d.vehicle}</td>
                      <td style={{ padding:"12px 10px", fontSize:12, color:TEXT_DIM }}>{d.route}</td>
                      <td style={{ padding:"12px 10px", fontSize:13, fontWeight:600, color:OPS_C }}>{d.pax}</td>
                      <td style={{ padding:"12px 10px" }}><StatusPill s={d.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {tab === "live" && (
            <>
              <TSectionHead title="Live Operations Board" color={OPS_C} />
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:20 }}>
                {[
                  { label:"Flights Today",  val:"7",  sub:"4 arr · 3 dep",  c:"#3B82F6" },
                  { label:"Active Buses",   val:"12", sub:"8 en-route",     c:OPS_C },
                  { label:"Total Pax",      val:"839",sub:"in transit",     c:"#22C55E" },
                  { label:"Pending Tasks",  val:"3",  sub:"require action", c:"#F59E0B" },
                ].map(k => (
                  <div key={k.label} style={{ background:BG_CARD, border:`1px solid ${BORDER}`, borderRadius:12, padding:14 }}>
                    <div style={{ fontSize:11, color:MUTED, marginBottom:4 }}>{k.label}</div>
                    <div style={{ fontSize:26, fontWeight:800, color:k.c, fontFamily:"var(--font-mono)" }}>{k.val}</div>
                    <div style={{ fontSize:11, color:TEXT_DIM }}>{k.sub}</div>
                  </div>
                ))}
              </div>
              <TSectionHead title="Recent Activity" color={OPS_C} />
              {[
                { icon:"✈", msg:"SV-821 landed at Terminal 2 — 248 pax", time:"10:35", c:"#22C55E" },
                { icon:"🚌", msg:"Bus-07 dispatched: T2 → Hilton Makkah",  time:"10:38", c:OPS_C },
                { icon:"⚠", msg:"WY-551 delayed 45 min (weather)",        time:"10:42", c:"#F59E0B" },
                { icon:"✅", msg:"D-004 completed: T2 → Makkah Hotel",     time:"10:50", c:"#22C55E" },
              ].map((a, i) => (
                <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"10px 0", borderBottom:`1px solid ${BORDER}` }}>
                  <span style={{ fontSize:16 }}>{a.icon}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, color:TEXT }}>{a.msg}</div>
                  </div>
                  <span style={{ fontSize:11, color:MUTED }}>{a.time}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Agent Tablet (master-detail) ─────────────────────────────────────────────

function AgentTablet() {
  const [selectedGroup, setSelectedGroup] = useState(GROUPS[0]);

  return (
    <div style={{ display:"flex", height:"100%", width:"100%" }}>
      <IconRail
        items={TAB_NAV} active="agent" onSelect={() => {}}
        color={AGT_C} appIcon={Users as IconFC}
      />

      {/* Master pane: 280px */}
      <div style={{
        width:280, flexShrink:0,
        borderRight:`1px solid ${BORDER}`,
        display:"flex", flexDirection:"column",
        overflow:"hidden",
      }}>
        <div style={{ padding:"12px 12px 8px", borderBottom:`1px solid ${BORDER}` }}>
          <TSearchBar placeholder="Search groups…" color={AGT_C} />
        </div>
        <div style={{ flex:1, overflow:"auto" }}>
          {GROUPS.map(g => {
            const isActive = g.id === selectedGroup.id;
            return (
              <button
                key={g.id}
                onClick={() => setSelectedGroup(g)}
                style={{
                  width:"100%", textAlign:"left",
                  padding:"14px 14px", border:"none",
                  background: isActive ? `${AGT_C}18` : "transparent",
                  borderLeft: isActive ? `2px solid ${AGT_C}` : "2px solid transparent",
                  cursor:"pointer",
                  borderBottom:`1px solid ${BORDER}`,
                  display:"flex", flexDirection:"column", gap:4,
                }}
              >
                <div style={{ fontSize:12, fontWeight:700, color: isActive ? AGT_C : TEXT }}>{g.name}</div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontSize:11, color:TEXT_DIM }}>{g.id}</span>
                  <StatusPill s={g.status} />
                </div>
                <div style={{ fontSize:11, color:MUTED }}>{g.pax} passengers · {g.agent}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Detail pane: flex-1 */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        {/* Detail header */}
        <div style={{ height:52, flexShrink:0, padding:"0 16px", display:"flex", alignItems:"center", justifyContent:"space-between", borderBottom:`1px solid ${BORDER}` }}>
          <div>
            <div style={{ fontSize:15, fontWeight:800, color:TEXT }}>{selectedGroup.name}</div>
            <div style={{ fontSize:11, color:MUTED }}>{selectedGroup.agent} · {selectedGroup.pax} pax</div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button style={{ padding:"6px 12px", borderRadius:8, border:`1px solid ${BORDER}`, background:"transparent", color:TEXT_DIM, fontSize:12, cursor:"pointer" }}>
              Export
            </button>
            <button style={{ padding:"6px 14px", borderRadius:8, border:"none", background:AGT_C, color:"#fff", fontSize:12, fontWeight:600, cursor:"pointer" }}>
              + Add Pax
            </button>
          </div>
        </div>

        {/* Group KPIs */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, padding:14, borderBottom:`1px solid ${BORDER}` }}>
          {[
            { label:"Total Pax",  val:selectedGroup.pax, c:AGT_C },
            { label:"Checked In", val:Math.floor(selectedGroup.pax * 0.7), c:"#22C55E" },
            { label:"Pending",    val:Math.floor(selectedGroup.pax * 0.2), c:"#F59E0B" },
            { label:"Boarding",   val:Math.floor(selectedGroup.pax * 0.1), c:"#3B82F6" },
          ].map(k => (
            <div key={k.label} style={{ background:BG_CARD, borderRadius:10, padding:"10px 12px" }}>
              <div style={{ fontSize:10, color:MUTED, marginBottom:2 }}>{k.label}</div>
              <div style={{ fontSize:20, fontWeight:800, color:k.c }}>{k.val}</div>
            </div>
          ))}
        </div>

        {/* Passenger table */}
        <div style={{ flex:1, overflow:"auto", padding:"0 14px 14px" }}>
          <div style={{ marginTop:14, marginBottom:8 }}>
            <TSectionHead title="Passengers" count={PASSENGERS.length} color={AGT_C} />
          </div>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ background:BG_MID }}>
                {["Pax ID","Name","Passport","Seat","Status","Action"].map(h => (
                  <th key={h} style={{ padding:"8px 10px", textAlign:"left", fontSize:10, fontWeight:700, color:MUTED, textTransform:"uppercase", letterSpacing:"0.06em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PASSENGERS.map(p => (
                <tr key={p.id} style={{ borderBottom:`1px solid ${BORDER}`, minHeight:56 }}>
                  <td style={{ padding:"13px 10px", fontSize:11, color:TEXT_DIM, fontFamily:"var(--font-mono)" }}>{p.id}</td>
                  <td style={{ padding:"13px 10px", fontSize:13, fontWeight:600, color:TEXT }}>{p.name}</td>
                  <td style={{ padding:"13px 10px", fontSize:12, color:TEXT_DIM, fontFamily:"var(--font-mono)" }}>{p.passport}</td>
                  <td style={{ padding:"13px 10px", fontSize:13, color:TEXT }}>{p.seat}</td>
                  <td style={{ padding:"13px 10px" }}><StatusPill s={p.status} /></td>
                  <td style={{ padding:"13px 10px" }}>
                    <button style={{ padding:"4px 10px", borderRadius:6, border:`1px solid ${BORDER}`, background:"transparent", color:AGT_C, fontSize:11, cursor:"pointer" }}>
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Driver Tablet (2-col: trip list + map/detail) ────────────────────────────

function DriverTablet() {
  const [selectedTrip, setSelectedTrip] = useState(DRV_TRIPS[0]);

  return (
    <div style={{ display:"flex", height:"100%", width:"100%" }}>
      <IconRail
        items={TAB_NAV} active="driver" onSelect={() => {}}
        color={DRV_C} appIcon={Truck as IconFC}
      />

      {/* Trip list: 300px */}
      <div style={{
        width:300, flexShrink:0,
        borderRight:`1px solid ${BORDER}`,
        display:"flex", flexDirection:"column",
        overflow:"hidden",
      }}>
        <div style={{ padding:"12px 12px 8px", borderBottom:`1px solid ${BORDER}` }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
            <Truck size={14} style={{ color:DRV_C }} />
            <span style={{ fontSize:13, fontWeight:700, color:TEXT }}>My Trips</span>
          </div>
          <TSearchBar placeholder="Search trips…" color={DRV_C} />
        </div>
        <div style={{ flex:1, overflow:"auto" }}>
          {DRV_TRIPS.map(trip => {
            const isActive = trip.id === selectedTrip.id;
            const statusColor = trip.status === "active" ? "#22C55E" : trip.status === "complete" ? MUTED : "#F59E0B";
            return (
              <button
                key={trip.id}
                onClick={() => setSelectedTrip(trip)}
                style={{
                  width:"100%", textAlign:"left",
                  padding:"14px 14px", border:"none",
                  background: isActive ? `${DRV_C}18` : "transparent",
                  borderLeft: isActive ? `2px solid ${DRV_C}` : "2px solid transparent",
                  cursor:"pointer",
                  borderBottom:`1px solid ${BORDER}`,
                  display:"flex", flexDirection:"column", gap:4,
                }}
              >
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontSize:12, fontWeight:700, color: isActive ? DRV_C : TEXT, fontFamily:"var(--font-mono)" }}>{trip.id}</span>
                  <span style={{ fontSize:11, fontWeight:600, color: statusColor }}>{trip.status.charAt(0).toUpperCase() + trip.status.slice(1)}</span>
                </div>
                <div style={{ fontSize:12, color:TEXT_DIM }}>{trip.from}</div>
                <div style={{ display:"flex", alignItems:"center", gap:4, fontSize:12, color:TEXT_DIM }}>
                  <ArrowRight size={10} style={{ color:DRV_C }} />
                  <span>{trip.to}</span>
                </div>
                <div style={{ display:"flex", gap:12, fontSize:11, color:MUTED }}>
                  <span>{trip.pax} pax</span>
                  <span>{trip.dist}</span>
                  <span>{trip.time}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Map + detail: flex-1 */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        {/* Mini map */}
        <div style={{
          height:260, flexShrink:0,
          background:"#0A1628",
          position:"relative",
          overflow:"hidden",
          borderBottom:`1px solid ${BORDER}`,
        }}>
          {/* Map grid lines */}
          {[...Array(8)].map((_, i) => (
            <div key={`h${i}`} style={{ position:"absolute", left:0, right:0, top:`${i * 14}%`, height:1, background:"#FBFCFD" }} />
          ))}
          {[...Array(10)].map((_, i) => (
            <div key={`v${i}`} style={{ position:"absolute", top:0, bottom:0, left:`${i * 10}%`, width:1, background:"#FBFCFD" }} />
          ))}

          {/* Route SVG */}
          <svg style={{ position:"absolute", inset:0, width:"100%", height:"100%" }} viewBox="0 0 470 260" preserveAspectRatio="none">
            <path d="M80 200 Q200 160 260 120 Q340 80 400 60" stroke={DRV_C} strokeWidth="2.5" fill="none" strokeDasharray="6 4" style={{ animation:"dash-march 1s linear infinite" }} />
          </svg>

          {/* Origin pin */}
          <div style={{ position:"absolute", left:"15%", bottom:"25%", display:"flex", flexDirection:"column", alignItems:"center" }}>
            <div style={{ width:12, height:12, borderRadius:"50%", background:DRV_C, border:"2px solid #fff", boxShadow:`0 0 0 4px ${DRV_C}44` }} />
            <span style={{ fontSize:10, color:TEXT, marginTop:4, whiteSpace:"nowrap" }}>{selectedTrip.from}</span>
          </div>

          {/* Destination pin */}
          <div style={{ position:"absolute", right:"15%", top:"18%", display:"flex", flexDirection:"column", alignItems:"center" }}>
            <MapPin size={18} style={{ color:"#22C55E" }} />
            <span style={{ fontSize:10, color:TEXT, marginTop:2, whiteSpace:"nowrap" }}>{selectedTrip.to}</span>
          </div>

          {/* Overlay badge */}
          <div style={{
            position:"absolute", top:12, left:12,
            background:"rgba(0,0,0,0.7)", borderRadius:8,
            padding:"6px 10px",
            display:"flex", alignItems:"center", gap:6,
          }}>
            <Navigation size={12} style={{ color:DRV_C }} />
            <span style={{ fontSize:11, fontWeight:700, color:TEXT }}>{selectedTrip.dist} · ~12 min</span>
          </div>
        </div>

        {/* Trip detail */}
        <div style={{ flex:1, overflow:"auto", padding:16 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
            <div>
              <div style={{ fontSize:16, fontWeight:800, color:TEXT, marginBottom:4 }}>{selectedTrip.to}</div>
              <div style={{ fontSize:12, color:TEXT_DIM }}>Trip {selectedTrip.id} · Departing {selectedTrip.time}</div>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button style={{ width:40, height:40, borderRadius:10, border:`1px solid ${BORDER}`, background:"transparent", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
                <Phone size={16} style={{ color:TEXT_DIM }} />
              </button>
              <button style={{ padding:"0 16px", height:40, borderRadius:10, border:"none", background:DRV_C, color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer" }}>
                Start Trip
              </button>
            </div>
          </div>

          {/* Passenger manifest */}
          <TSectionHead title="Passenger Manifest" count={selectedTrip.pax} color={DRV_C} />
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
            {PASSENGERS.slice(0, 4).map(p => (
              <div key={p.id} style={{ background:BG_CARD, borderRadius:10, padding:"10px 12px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ fontSize:12, fontWeight:600, color:TEXT }}>{p.name}</div>
                  <div style={{ fontSize:11, color:TEXT_DIM }}>{p.passport}</div>
                </div>
                <CheckCircle size={14} style={{ color:"#22C55E" }} />
              </div>
            ))}
          </div>
          <div style={{ marginTop:8, fontSize:11, color:TEXT_DIM }}>+ {selectedTrip.pax - 4} more passengers</div>
        </div>
      </div>
    </div>
  );
}

// ─── Supervisor Tablet ────────────────────────────────────────────────────────

function SupTablet() {
  const [selectedAp, setSelectedAp] = useState(APPROVALS[0]);

  return (
    <div style={{ display:"flex", height:"100%", width:"100%" }}>
      <IconRail
        items={TAB_NAV} active="sup" onSelect={() => {}}
        color={SUP_C} appIcon={Shield as IconFC}
      />

      {/* Queue: 320px */}
      <div style={{
        width:320, flexShrink:0,
        borderRight:`1px solid ${BORDER}`,
        display:"flex", flexDirection:"column",
        overflow:"hidden",
      }}>
        <div style={{ padding:"12px 12px 8px", borderBottom:`1px solid ${BORDER}` }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <Shield size={14} style={{ color:SUP_C }} />
              <span style={{ fontSize:13, fontWeight:700, color:TEXT }}>Approvals Queue</span>
            </div>
            <span style={{ background:`${SUP_C}22`, color:SUP_C, fontSize:11, fontWeight:700, padding:"2px 7px", borderRadius:20 }}>
              {APPROVALS.length}
            </span>
          </div>
        </div>

        {/* KPI row */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, padding:"10px 12px", borderBottom:`1px solid ${BORDER}` }}>
          {[
            { label:"Pending",   val:"4",  c:"#F59E0B" },
            { label:"Approved",  val:"12", c:"#22C55E" },
            { label:"Rejected",  val:"2",  c:"#EF4444" },
            { label:"Today SAR", val:"267k",c:SUP_C },
          ].map(k => (
            <div key={k.label} style={{ background:BG_CARD, borderRadius:8, padding:"8px 10px" }}>
              <div style={{ fontSize:10, color:MUTED }}>{k.label}</div>
              <div style={{ fontSize:16, fontWeight:800, color:k.c }}>{k.val}</div>
            </div>
          ))}
        </div>

        {/* Approvals list */}
        <div style={{ flex:1, overflow:"auto" }}>
          {APPROVALS.map(ap => {
            const isActive = ap.id === selectedAp.id;
            return (
              <button
                key={ap.id}
                onClick={() => setSelectedAp(ap)}
                style={{
                  width:"100%", textAlign:"left",
                  padding:"14px 14px", border:"none",
                  background: isActive ? `${SUP_C}18` : "transparent",
                  borderLeft: isActive ? `2px solid ${SUP_C}` : "2px solid transparent",
                  cursor:"pointer",
                  borderBottom:`1px solid ${BORDER}`,
                  display:"flex", flexDirection:"column", gap:4,
                }}
              >
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontSize:12, fontWeight:700, color: isActive ? SUP_C : TEXT }}>{ap.type}</span>
                  {ap.priority === "high" && (
                    <AlertTriangle size={12} style={{ color:"#EF4444" }} />
                  )}
                </div>
                <div style={{ fontSize:11, color:TEXT_DIM }}>{ap.agent}</div>
                <div style={{ display:"flex", justifyContent:"space-between" }}>
                  <span style={{ fontSize:12, fontWeight:700, color:TEXT }}>{ap.amount}</span>
                  <span style={{ fontSize:11, color:MUTED }}>{ap.time}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Detail: flex-1 */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        <div style={{ height:52, flexShrink:0, padding:"0 16px", display:"flex", alignItems:"center", justifyContent:"space-between", borderBottom:`1px solid ${BORDER}` }}>
          <div>
            <div style={{ fontSize:15, fontWeight:800, color:TEXT }}>{selectedAp.type}</div>
            <div style={{ fontSize:11, color:MUTED }}>{selectedAp.id} · {selectedAp.agent}</div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button style={{ padding:"7px 18px", borderRadius:8, border:`1px solid #EF444444`, background:"transparent", color:"#EF4444", fontSize:13, fontWeight:700, cursor:"pointer" }}>
              Reject
            </button>
            <button style={{ padding:"7px 20px", borderRadius:8, border:"none", background:SUP_C, color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer" }}>
              Approve
            </button>
          </div>
        </div>

        <div style={{ flex:1, overflow:"auto", padding:16 }}>
          {/* Amount card */}
          <div style={{ background:BG_CARD, border:`1px solid ${BORDER}`, borderRadius:14, padding:20, marginBottom:16 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div>
                <div style={{ fontSize:12, color:MUTED, marginBottom:6 }}>Request Amount</div>
                <div style={{ fontSize:28, fontWeight:800, color:SUP_C }}>{selectedAp.amount}</div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontSize:12, color:MUTED, marginBottom:2 }}>Submitted</div>
                <div style={{ fontSize:13, fontWeight:600, color:TEXT }}>{selectedAp.time}</div>
                <div style={{ fontSize:11, color:TEXT_DIM }}>Today</div>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <TSectionHead title="Approval History" color={SUP_C} />
          <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
            {[
              { label:"Request Submitted",  by:"Al-Najm Travel",   time:"08:42", icon:"📝", done:true },
              { label:"Auto-check Passed",  by:"System",           time:"08:43", icon:"🤖", done:true },
              { label:"Finance Review",     by:"Finance Team",     time:"09:00", icon:"💰", done:false },
              { label:"Supervisor Approval",by:"Pending…",         time:"—",    icon:"👤", done:false },
            ].map((step, i, arr) => (
              <div key={i} style={{ display:"flex", gap:12, paddingBottom: i < arr.length-1 ? 0 : 0 }}>
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center", width:32 }}>
                  <div style={{
                    width:28, height:28, borderRadius:"50%", flexShrink:0,
                    background: step.done ? `${SUP_C}22` : BG_CARD,
                    border: step.done ? `1.5px solid ${SUP_C}` : `1.5px solid ${BORDER}`,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:13,
                  }}>{step.icon}</div>
                  {i < arr.length-1 && <div style={{ width:1, flex:1, background:BORDER, minHeight:20 }} />}
                </div>
                <div style={{ paddingBottom:16 }}>
                  <div style={{ fontSize:13, fontWeight:600, color: step.done ? TEXT : TEXT_DIM }}>{step.label}</div>
                  <div style={{ fontSize:11, color:MUTED }}>{step.by} · {step.time}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Alert */}
          {selectedAp.priority === "high" && (
            <div style={{ display:"flex", alignItems:"flex-start", gap:10, background:"#EF444412", border:"1px solid #EF444430", borderRadius:10, padding:"12px 14px", marginTop:8 }}>
              <AlertTriangle size={16} style={{ color:"#EF4444", flexShrink:0, marginTop:1 }} />
              <div style={{ fontSize:12, color:"#EF4444", lineHeight:1.5 }}>
                High-priority request. Finance team flagged this for immediate supervisor review.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Tablet Page ──────────────────────────────────────────────────────────────

const VIEW_MAP: Record<TabletView, () => ReactNode> = {
  ops:    () => <OpsTablet />,
  agent:  () => <AgentTablet />,
  driver: () => <DriverTablet />,
  sup:    () => <SupTablet />,
};

const SHELL_NAV: ShellNavItem[] = [
  { id:"ops",    label:"Ops Terminal",  icon: Zap    as IconFC },
  { id:"agent",  label:"Agent Portal",  icon: Users  as IconFC },
  { id:"driver", label:"Driver Tablet", icon: Truck  as IconFC },
  { id:"sup",    label:"Supervisor",    icon: Shield as IconFC },
];

export default function TabletPage() {
  const [view, setView] = useState<TabletView>("ops");
  const active = TAB_NAV.find(n => n.id === view)!;

  return (
    <ERPShell
      moduleId="tablet"
      moduleName="Tablet Views"
      moduleColor={TAB_MOD}
      moduleIcon={Shield as IconFC}
      navItems={SHELL_NAV}
      activeItem={view}
      onItemClick={id => setView(id as TabletView)}
      breadcrumb={["Tablet Views", active.label]}
      notificationCount={0}
      userName="Abdullah Al-Otaibi"
      userRole="TUBA AL HIJAZ · Super Admin"
    >
      <div style={{ padding:"32px 40px 48px", minHeight:"100%", background:BG_DARK, overflowY:"auto" }}>
        {/* Page header */}
        <div style={{ marginBottom:28 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
            <div style={{ width:8, height:8, borderRadius:"50%", background:TAB_MOD }} />
            <span style={{ fontSize:11, fontWeight:700, color:TAB_MOD, textTransform:"uppercase", letterSpacing:"0.1em" }}>
              Page 18 · Tablet Views
            </span>
          </div>
          <h1 style={{ fontSize:24, fontWeight:800, color:TEXT, margin:0, marginBottom:6 }}>
            iPad Air · 834px Portrait
          </h1>
          <p style={{ fontSize:14, color:TEXT_DIM, margin:0 }}>
            Tablet-optimised layouts with 64px icon rail, 56px touch targets, and master-detail patterns.
            Switch between the four app views using the pills below.
          </p>
        </div>

        {/* View selector pills */}
        <div style={{ display:"flex", gap:8, marginBottom:28, flexWrap:"wrap" }}>
          {TAB_NAV.map(nav => {
            const Ic = nav.icon;
            const isActive = view === nav.id;
            return (
              <button
                key={nav.id}
                onClick={() => setView(nav.id)}
                style={{
                  display:"flex", alignItems:"center", gap:6,
                  padding:"8px 16px", border:"none", borderRadius:100, cursor:"pointer",
                  background: isActive ? nav.color : "rgba(11,30,63,0.38)",
                  color: isActive ? "#fff" : TEXT_DIM,
                  fontSize:13, fontWeight:600,
                  transition:"all 160ms ease",
                }}
              >
                <Ic size={14} />
                {nav.label}
              </button>
            );
          })}
        </div>

        {/* Tablet frame */}
        <div style={{ display:"flex", justifyContent:"center" }}>
          <TabletFrame color={active.color}>
            {VIEW_MAP[view]()}
          </TabletFrame>
        </div>

        {/* Spec callouts */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginTop:32, maxWidth:834, margin:"32px auto 0" }}>
          {[
            { label:"Frame Width",       val:"834px",   note:"iPad Air portrait" },
            { label:"Icon Rail",          val:"64px",    note:"Icons + title tooltip" },
            { label:"Touch Targets",      val:"≥ 56px",  note:"Apple HIG compliant" },
            { label:"Master Pane",        val:"280–320px",note:"Detail pane: flex-1" },
          ].map(s => (
            <div key={s.label} style={{ background:BG_CARD, border:`1px solid ${BORDER}`, borderRadius:10, padding:"12px 14px" }}>
              <div style={{ fontSize:10, color:MUTED, marginBottom:2 }}>{s.label}</div>
              <div style={{ fontSize:15, fontWeight:800, color:TAB_MOD }}>{s.val}</div>
              <div style={{ fontSize:11, color:TEXT_DIM }}>{s.note}</div>
            </div>
          ))}
        </div>
      </div>
    </ERPShell>
  );
}
