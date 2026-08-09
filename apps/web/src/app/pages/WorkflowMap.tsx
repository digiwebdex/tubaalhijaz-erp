import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import {
  UserPlus, ShieldCheck, BadgeCheck, FolderPlus, Scan, Plane,
  Fingerprint, BedDouble, Truck, UtensilsCrossed, FileText, CreditCard,
  Ticket, Bell, PlaneLanding, Home, PlaneTakeoff, BarChart2,
  Archive, ChevronRight, ChevronDown, ExternalLink, Clock,
  GitBranch, LayoutList, List,
} from "lucide-react";
import { ERPShell, type NavItem, type IconFC } from "../components/ERPShell";
import {
  ErpPageTemplate, ErpSearchBar, ErpDataTable, ErpPagination,
  ErpStatusChip, erpToast, type ErpColumn,
} from "../components/erp";
import { ERP, CAT, erpAlpha, ErpThemeProvider } from "../components/erp";
import { useLang } from "../lib/LangContext";
import { fontFor } from "@tuba/shared";

// ─── Module color ─────────────────────────────────────────────────────────────

const GOLD = ERP.accent;

// ─── Types ────────────────────────────────────────────────────────────────────

type WFScreen  = "pipeline" | "tracker" | "directory";
type StageStatus = "COMPLETED" | "IN_PROGRESS" | "PENDING" | "BLOCKED";

interface Stage {
  id: number; label: string; short: string; module: string;
  color: string; icon: any; phase: 1|2|3; route: string;
}

interface GroupPipeline {
  id: string; agent: string; pax: number; flag: string; currentStage: number; note: string;
}

// ─── Status style map ─────────────────────────────────────────────────────────

const SS: Record<StageStatus, [string, string]> = {
  COMPLETED:   [ERP.success,              "DONE"    ],
  IN_PROGRESS: [ERP.info,              "ACTIVE"  ],
  PENDING:     [ERP.mutedSoft,"PENDING" ],
  BLOCKED:     [ERP.destructive,              "BLOCKED" ],
};

// ─── Stage definitions (19 stages) ───────────────────────────────────────────

const STAGES: Stage[] = [
  { id:1,  label:"Agent Registration",  short:"Agent Reg",   module:"Agent Portal",   color:CAT.purple, icon:UserPlus,       phase:1, route:"/agent-portal"    },
  { id:2,  label:"Verification",        short:"Verify",      module:"Super Admin",    color:CAT.slate, icon:ShieldCheck,    phase:1, route:"/super-admin"     },
  { id:3,  label:"Agent Approval",      short:"Approval",    module:"Super Admin",    color:CAT.slate, icon:BadgeCheck,     phase:1, route:"/super-admin"     },
  { id:4,  label:"Group Creation",      short:"Group",       module:"Agent Portal",   color:CAT.purple, icon:FolderPlus,     phase:1, route:"/agent-portal"    },
  { id:5,  label:"Pax OCR / Excel",     short:"Pax Import",  module:"OCR Center",     color:CAT.sky, icon:Scan,           phase:1, route:"/ocr-center"      },
  { id:6,  label:"Flight & Ticket",     short:"Flight",      module:"Ops Control",    color:CAT.orange, icon:Plane,          phase:1, route:"/ops-control"     },
  { id:7,  label:"Visa Processing",     short:"Visa",        module:"Visa Desk",      color:CAT.teal, icon:Fingerprint,    phase:2, route:"/ops-departments" },
  { id:8,  label:"Hotel Booking",       short:"Hotel",       module:"Hotel Desk",     color:ERP.info, icon:BedDouble,      phase:2, route:"/ops-departments" },
  { id:9,  label:"Transport Dispatch",  short:"Transport",   module:"Transport",      color:CAT.orange, icon:Truck,          phase:2, route:"/ops-departments" },
  { id:10, label:"Catering",            short:"Catering",    module:"Catering",       color:ERP.warning, icon:UtensilsCrossed,phase:2, route:"/ops-departments" },
  { id:11, label:"Invoice",             short:"Invoice",     module:"Finance ERP",    color:ERP.success, icon:FileText,       phase:2, route:"/finance-erp"     },
  { id:12, label:"Payment",             short:"Payment",     module:"Finance ERP",    color:ERP.success, icon:CreditCard,     phase:2, route:"/finance-erp"     },
  { id:13, label:"Voucher",             short:"Voucher",     module:"Agent Portal",   color:CAT.purple, icon:Ticket,         phase:2, route:"/agent-portal"    },
  { id:14, label:"WhatsApp & Email",    short:"Comms",       module:"Automation",     color:CAT.purple, icon:Bell,           phase:3, route:"/automation"      },
  { id:15, label:"Arrival",             short:"Arrival",     module:"Ops Control",    color:ERP.info, icon:PlaneLanding,   phase:3, route:"/ops-control"     },
  { id:16, label:"Stay",                short:"Stay",        module:"Hotel Desk",     color:ERP.info, icon:Home,           phase:3, route:"/ops-departments" },
  { id:17, label:"Departure",           short:"Departure",   module:"Ops Control",    color:ERP.info, icon:PlaneTakeoff,   phase:3, route:"/ops-control"     },
  { id:18, label:"Final Statement",     short:"Statement",   module:"Finance ERP",    color:ERP.success, icon:BarChart2,      phase:3, route:"/finance-erp"     },
  { id:19, label:"Archive",             short:"Archive",     module:"Super Admin",    color:CAT.slate, icon:Archive,        phase:3, route:"/super-admin"     },
];

// ─── Phase metadata ───────────────────────────────────────────────────────────

const PHASES = [
  { id:1 as const, label:"Pre-Travel & Onboarding",    color:CAT.purple, stages:[1,2,3,4,5,6]          },
  { id:2 as const, label:"Service Booking & Finance",  color:ERP.success, stages:[7,8,9,10,11,12,13]    },
  { id:3 as const, label:"On-Ground Operations",       color:ERP.info, stages:[14,15,16,17,18,19]     },
];

// ─── Stage detail content ─────────────────────────────────────────────────────

const STAGE_INFO = [
  { desc:"Agent submits company CR, bank details, and authorized contact via the public registration portal.", tasks:["Complete company registration form","Upload CR / Iqama document","Provide bank account details","Nominate authorized representative"], sla:"Instant — self-service" },
  { desc:"Compliance team authenticates documents, checks MOFA agent codes, and runs AML screening.", tasks:["Document authenticity review","MOFA agent code validation","AML & sanctions screening","Risk tier assessment"], sla:"48h review window" },
  { desc:"Super Admin grants portal access and configures agent tier, credit limit, and service packages.", tasks:["Approve or reject application","Assign credit limit & service tier","Configure portal access rights","Send onboarding email"], sla:"4h after verification pass" },
  { desc:"Agent creates a group booking: season, nationality, travel dates, pax count, and required services.", tasks:["Enter group name and season","Set nationality & departure dates","Specify pax count and services","Pay group deposit or set credit"], sla:"Self-service, instant" },
  { desc:"Passenger passports scanned via OCR or uploaded as Excel. System auto-populates MOFA fields and flags errors.", tasks:["Upload passport scans or Excel file","Review OCR auto-fill results","Correct highlighted field errors","Submit final data to MOFA queue"], sla:"OCR auto-fill < 2 min / pax" },
  { desc:"Ops team records flight bookings, PNR numbers, and ticket status for all group passengers.", tasks:["Enter flight PNR and sector details","Upload e-ticket PDFs","Link tickets to passenger records","Confirm seat map allocation"], sla:"Same-day entry" },
  { desc:"Visa applications submitted to MOFA portal with biometric data. Status tracked until approval.", tasks:["Batch submit to MOFA portal","Track biometric appointment slots","Monitor approval notifications","Download and issue visa stickers"], sla:"3–10 business days (MOFA)" },
  { desc:"Hotel bookings confirmed with room allocation, check-in/out dates, meal plan, and voucher numbers.", tasks:["Send RFQ to hotel partner","Confirm room type allocation","Record voucher and confirmation numbers","Upload signed confirmation docs"], sla:"2–5 days lead time" },
  { desc:"Vehicles and drivers assigned to each group leg: airport transfer, inter-city, and daily transport.", tasks:["Assign bus and driver per segment","Define route map and waypoints","Share digital itinerary with drivers","Confirm Meet & Assist officers"], sla:"48h before first arrival" },
  { desc:"Catering order placed with supplier for full period: meal plan, dietary requirements, delivery schedule.", tasks:["Submit meal order with headcount","Confirm dietary requirement breakdown","Record delivery slots per day","Sign-off on pre-delivery quality check"], sla:"72h before group start date" },
  { desc:"Finance team generates itemized invoice covering all confirmed services for the agent.", tasks:["Auto-generate invoice from services","Apply early-payment discount if eligible","Send PDF via email & portal","Post to AR ledger"], sla:"Within 24h of service confirmation" },
  { desc:"Agent payment received and reconciled against the outstanding invoice. AR status updated.", tasks:["Receive payment via bank transfer / SARIE","Match amount against open invoice","Post receipt in Finance ERP","Issue official payment receipt"], sla:"Net 30 days (standard terms)" },
  { desc:"Service vouchers generated and dispatched to agent for distribution to group passengers.", tasks:["Generate hotel voucher PDF","Generate transport service voucher","Generate catering voucher","Send all vouchers via WhatsApp & email"], sla:"24h after payment confirmed" },
  { desc:"Automated WhatsApp and email notifications dispatched at key journey milestones via WASender API.", tasks:["Send visa approval notification","Send pre-departure travel brief","Dispatch hotel check-in voucher","Send return flight reminder"], sla:"Fully automated — instant" },
  { desc:"Ops team manages flight arrival: Meet & Assist, immigration clearance, baggage, and bus boarding.", tasks:["Deploy Meet & Assist officers at gate","Assist immigration clearance","Coordinate baggage collection","Board buses to hotel — confirm headcount"], sla:"Complete within 2h of landing" },
  { desc:"Hotel desk monitors occupancy throughout stay, manages incidents, and coordinates daily services.", tasks:["Coordinate check-in with hotel reception","Handle passenger issues & escalations","Confirm daily meal delivery","Conduct room readiness spot checks"], sla:"Ongoing — full stay period" },
  { desc:"Departure operations: airport shuttle, check-in assistance, baggage escort, and final boarding.", tasks:["Arrange hotel-to-airport shuttles","Assist check-in counter (4h before STD)","Escort baggage drop & security","Gate clearance and final headcount"], sla:"Ops mobilized 4h before STD" },
  { desc:"Finance issues final settlement statement reconciling all charges, credits, and advance payments.", tasks:["Calculate final charges and credits","Apply any credit notes or adjustments","Issue final statement PDF to agent","Post to ledger and close group account"], sla:"Within 5 days of return flight" },
  { desc:"Group archived: all documents, scans, vouchers, correspondence filed for compliance retention.", tasks:["Archive all passports, visas, tickets","Store vouchers and supplier confirmations","Generate season performance report","Retain records for 7-year compliance"], sla:"30 days after departure" },
];

// ─── Group pipeline data ──────────────────────────────────────────────────────

const GROUPS: GroupPipeline[] = [
  { id:"GRP-2891", agent:"Rashidi Travel",   pax:47, flag:"🇧🇩", currentStage:16, note:"In Stay — Jabal Omar Hyatt, Makkah (check-out 28 Aug)" },
  { id:"GRP-2744", agent:"Al-Noor Pilgrim",  pax:32, flag:"🇧🇩", currentStage:9,  note:"Transport dispatch — en route KAIA T1 → Makkah Towers" },
  { id:"GRP-3301", agent:"PIA Charter",      pax:67, flag:"🇵🇰", currentStage:7,  note:"Visa processing — 52 approved, 15 pending MOFA queue" },
  { id:"GRP-2401", agent:"Rashidi Travel",   pax:28, flag:"🇧🇩", currentStage:8,  note:"Hotel booking — awaiting Movenpick confirmation" },
  { id:"GRP-2990", agent:"Zamzam Pilgrim",   pax:52, flag:"🇧🇩", currentStage:6,  note:"Flight ticketing in progress — PNR entry 38/52 done" },
];

// ─── Nav ──────────────────────────────────────────────────────────────────────

const WF_NAV: NavItem[] = [
  { id:"pipeline",  label:"Pipeline View",   icon: GitBranch  as IconFC },
  { id:"tracker",   label:"Group Tracker",   icon: LayoutList as IconFC, badge: GROUPS.length },
  { id:"directory", label:"Stage Directory", icon: List       as IconFC },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const stageStatus = (stageId: number, g: GroupPipeline): StageStatus =>
  stageId < g.currentStage ? "COMPLETED" : stageId === g.currentStage ? "IN_PROGRESS" : "PENDING";

const allGroupsStatus = (stageId: number): StageStatus => {
  if (GROUPS.every(g => g.currentStage > stageId)) return "COMPLETED";
  if (GROUPS.some(g => g.currentStage === stageId)) return "IN_PROGRESS";
  return "PENDING";
};

// ─── Stage node ───────────────────────────────────────────────────────────────

function StageNode({ stage, status, selected, onClick, groupCount }: {
  stage: Stage; status: StageStatus; selected: boolean; onClick: () => void; groupCount: number;
}) {
  const [sc] = SS[status];
  const Icon = stage.icon;
  const active = status === "IN_PROGRESS";
  const done   = status === "COMPLETED";
  return (
    <button
      onClick={onClick}
      className="relative flex flex-col items-center gap-1 rounded-xl pt-3 pb-3 px-2 transition-all duration-150"
      style={{
        width: 92, minHeight: 128, flexShrink: 0,
        backgroundColor: selected ? `${erpAlpha(stage.color, 8)}` : active ? `${erpAlpha(stage.color, 3)}` : done ? ERP.mutedSoft : ERP.mutedSoft,
        border: `1px solid ${selected ? stage.color : active ? `${erpAlpha(stage.color, 33)}` : done ? ERP.mutedSoft : ERP.mutedSoft}`,
        boxShadow: selected ? `0 0 0 2px ${erpAlpha(stage.color, 21)}, 0 0 20px ${erpAlpha(stage.color, 7)}` : active ? `0 0 12px ${erpAlpha(stage.color, 8)}` : "none",
      }}
    >
      {/* Stage number */}
      <span className="absolute top-1.5 left-2 text-[7px] font-black tabular-nums" style={{ color:ERP.mutedSoft, fontFamily:"var(--font-mono)" }}>
        {String(stage.id).padStart(2,"0")}
      </span>

      {/* Group count badge */}
      {groupCount > 0 && (
        <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full text-[8px] font-black flex items-center justify-center z-10"
          style={{ backgroundColor: stage.color, color:"var(--erp-surface)", boxShadow:`0 0 0 2px ${ERP.canvas}` }}>
          {groupCount}
        </div>
      )}

      {/* Icon container */}
      <div className="w-10 h-10 rounded-xl flex items-center justify-center mt-2 shrink-0"
        style={{ backgroundColor: done||active||selected ? `${erpAlpha(stage.color, 13)}` : ERP.mutedSoft }}>
        <Icon size={18} style={{ color: done||active||selected ? stage.color : ERP.mutedSoft }} />
      </div>

      {/* Label */}
      <div className="text-center text-[8.5px] font-bold leading-tight mt-1 px-1"
        style={{ color: done||active||selected ? ERP.navy : ERP.muted }}>
        {stage.label}
      </div>

      {/* Module */}
      <div className="text-[7px] text-center leading-tight"
        style={{ color: done||active||selected ? `${erpAlpha(stage.color, 73)}` : ERP.mutedSoft }}>
        {stage.module}
      </div>

      {/* Status pill */}
      <div className="text-[6.5px] font-black px-1.5 py-[2px] rounded-full mt-auto"
        style={{ backgroundColor:`${erpAlpha(sc, 8)}`, color:sc }}>
        {SS[status][1]}
      </div>
    </button>
  );
}

// ─── Arrow connector ──────────────────────────────────────────────────────────

function FlowArrow({ color, lit }: { color: string; lit: boolean }) {
  return (
    <div className="flex items-center shrink-0" style={{ marginTop: ERP.space[11], width: 22 }}>
      <div className="flex-1 h-px" style={{ backgroundColor: lit ? `${erpAlpha(color, 31)}` : ERP.mutedSoft }} />
      <ChevronRight size={10} style={{ color: lit ? `${erpAlpha(color, 44)}` : ERP.mutedSoft, flexShrink:0 }} />
    </div>
  );
}

// ─── Phase-to-phase connector ─────────────────────────────────────────────────

function PhaseConnector() {
  return (
    <div className="flex justify-center items-center gap-3 py-1">
      <div className="flex-1 h-px" style={{ backgroundColor:ERP.surfaceSoft }} />
      <div className="flex flex-col items-center gap-px">
        <div className="h-3 w-px" style={{ backgroundColor:ERP.surfaceSoft }} />
        <ChevronDown size={10} style={{ color:ERP.mutedSoft }} />
      </div>
      <div className="flex-1 h-px" style={{ backgroundColor:ERP.surfaceSoft }} />
    </div>
  );
}

// ─── Stage detail pane ────────────────────────────────────────────────────────

function StageDetailPane({ stageId, group }: { stageId: number; group: GroupPipeline|null }) {
  const navigate = useNavigate();
  const stage  = STAGES.find(s => s.id === stageId)!;
  const info   = STAGE_INFO[stageId - 1];
  const status = group ? stageStatus(stageId, group) : allGroupsStatus(stageId);
  const [sc]   = SS[status];
  const here   = GROUPS.filter(g => g.currentStage === stageId);
  const Icon   = stage.icon;
  return (
    <div className="rounded-xl p-5 mt-4 shrink-0" style={{ backgroundColor:`${erpAlpha(stage.color, 3)}`, border:`1px solid ${erpAlpha(stage.color, 13)}` }}>
      <div className="flex items-start gap-6">
        {/* Stage overview */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor:`${erpAlpha(stage.color, 13)}` }}>
              <Icon size={20} style={{ color:stage.color }} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-black text-[color:var(--erp-text-strong)]">{stage.id}. {stage.label}</span>
                <span className="text-[7px] font-black px-2 py-[2px] rounded-full shrink-0" style={{ backgroundColor:`${erpAlpha(sc, 8)}`, color:sc }}>{SS[status][1]}</span>
              </div>
              <div className="text-[9px] mt-0.5" style={{ color:`${erpAlpha(stage.color, 73)}` }}>
                Module: <span className="font-bold">{stage.module}</span>
              </div>
            </div>
          </div>
          <p className="text-[10.5px] leading-relaxed mb-3" style={{ color:ERP.muted }}>{info.desc}</p>
          <div className="flex items-center gap-1.5 text-[9px]" style={{ color:ERP.muted }}>
            <Clock size={9} />
            <span>SLA: <span className="font-bold" style={{ color:ERP.muted }}>{info.sla}</span></span>
          </div>
        </div>

        {/* Tasks */}
        <div className="w-60 shrink-0">
          <div className="text-[8px] font-black uppercase tracking-widest mb-2.5" style={{ color:ERP.muted }}>Sub-Tasks</div>
          <div className="space-y-1.5">
            {info.tasks.map((t, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full mt-1 shrink-0" style={{ backgroundColor:stage.color }} />
                <span className="text-[9.5px]" style={{ color:status==="PENDING"?ERP.muted:ERP.navy }}>{t}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Groups at this stage + portal button */}
        <div className="w-52 shrink-0">
          <div className="text-[8px] font-black uppercase tracking-widest mb-2.5" style={{ color:ERP.muted }}>
            Groups here now {here.length > 0 && <span style={{ color:stage.color }}>({here.length})</span>}
          </div>
          {here.length > 0 ? (
            <div className="space-y-1.5">
              {here.map(g => (
                <div key={g.id} className="rounded-xl p-2.5" style={{ backgroundColor:ERP.surfaceSoft, border:`1px solid ${erpAlpha(stage.color, 13)}` }}>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[9px] font-black" style={{ color:stage.color }}>{g.id}</span>
                    <span className="text-[8px]" style={{ color:ERP.muted }}>{g.flag} {g.pax} pax · {g.agent}</span>
                  </div>
                  <div className="text-[8px] leading-tight" style={{ color:ERP.muted }}>{g.note}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[9px] mb-3" style={{ color:ERP.mutedSoft }}>No groups currently at this stage.</div>
          )}
          <button
            onClick={() => {
              erpToast.success(`Opening ${stage.module} — Stage ${stage.id}: ${stage.label}`);
              navigate(stage.route);
            }}
            className="mt-3 flex items-center gap-1.5 text-[9px] font-black px-3 py-1.5 rounded-xl transition-all hover:opacity-80 active:scale-95"
            style={{ backgroundColor:`${erpAlpha(stage.color, 9)}`, color:stage.color }}>
            <ExternalLink size={10} />
            Open {stage.module}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Pipeline view (main) ─────────────────────────────────────────────────────

function PipelineScreen() {
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [selectedStage, setSelectedStage] = useState<number | null>(null);
  const activeGroup = GROUPS.find(g => g.id === selectedGroup) ?? null;

  return (
    <div className="p-6 h-full overflow-y-auto space-y-0" style={{ scrollbarWidth:"thin", scrollbarColor:"${ERP.mutedSoft} transparent" }}>

      {/* Group selector */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <span className="text-[9px] font-black uppercase tracking-widest mr-1" style={{ color:ERP.muted }}>View:</span>
        {[{ id:"all", label:"All Groups", pax:null, flag:null },...GROUPS.map(g=>({ id:g.id, label:g.id, pax:g.pax, flag:g.flag }))].map(g => (
          <button
            key={g.id}
            onClick={() => { setSelectedGroup(g.id); setSelectedStage(null); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-bold transition-all"
            style={{
              backgroundColor: selectedGroup===g.id ? `${erpAlpha(GOLD, 13)}` : ERP.mutedSoft,
              border: `1px solid ${selectedGroup===g.id ? GOLD : ERP.mutedSoft}`,
              color: selectedGroup===g.id ? GOLD : ERP.muted,
            }}
          >
            {g.flag && <span>{g.flag}</span>}
            {g.label}
            {g.pax && <span style={{ color:ERP.muted }}>{g.pax}p</span>}
          </button>
        ))}
        {activeGroup && (
          <span className="ml-2 text-[9px]" style={{ color:ERP.muted }}>
            Currently at: <span className="font-bold" style={{ color:STAGES.find(s=>s.id===activeGroup.currentStage)?.color }}>{STAGES.find(s=>s.id===activeGroup.currentStage)?.label}</span>
            {" — "}{activeGroup.note}
          </span>
        )}
      </div>

      {/* 3 Phase rows */}
      {PHASES.map((phase, pi) => {
        const phaseStages = STAGES.filter(s => s.phase === phase.id);
        return (
          <div key={phase.id}>
            <div className="rounded-xl px-4 pt-4 pb-5" style={{ backgroundColor:ERP.surface, border:`1px solid ${erpAlpha(phase.color, 9)}` }}>
              {/* Phase header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px" style={{ width:16, backgroundColor:`${erpAlpha(phase.color, 25)}` }} />
                <span className="text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-full shrink-0"
                  style={{ backgroundColor:`${erpAlpha(phase.color, 8)}`, color:phase.color }}>
                  Phase {phase.id}: {phase.label}
                </span>
                <div className="flex-1 h-px" style={{ backgroundColor:`${erpAlpha(phase.color, 9)}` }} />
                <span className="text-[8px]" style={{ color:ERP.mutedSoft }}>
                  {phaseStages.map(s=>s.id).join(" → ")}
                </span>
              </div>

              {/* Stage nodes row */}
              <div className="flex items-start overflow-x-auto pb-1" style={{ scrollbarWidth:"none" }}>
                <div className="flex items-start gap-0 mx-auto">
                  {phaseStages.flatMap((stage, i) => {
                    const status = activeGroup ? stageStatus(stage.id, activeGroup) : allGroupsStatus(stage.id);
                    const groupCount = selectedGroup==="all" ? GROUPS.filter(g=>g.currentStage===stage.id).length : 0;
                    const nodes: ReactNode[] = [
                      <StageNode
                        key={`s${stage.id}`}
                        stage={stage}
                        status={status}
                        selected={selectedStage === stage.id}
                        onClick={() => setSelectedStage(selectedStage===stage.id ? null : stage.id)}
                        groupCount={groupCount}
                      />,
                    ];
                    if (i < phaseStages.length - 1) {
                      nodes.push(<FlowArrow key={`a${stage.id}`} color={phase.color} lit={status==="COMPLETED"} />);
                    }
                    return nodes;
                  })}
                </div>
              </div>
            </div>

            {/* Phase connector */}
            {pi < PHASES.length - 1 && <PhaseConnector />}
          </div>
        );
      })}

      {/* Selected stage detail pane */}
      {selectedStage !== null && (
        <StageDetailPane stageId={selectedStage} group={activeGroup} />
      )}

      {/* Module legend */}
      <div className="rounded-xl p-4 mt-4" style={{ backgroundColor:ERP.surface, border:`1px solid ${ERP.border}` }}>
        <div className="text-[8px] font-black uppercase tracking-widest mb-3" style={{ color:ERP.muted }}>Module Ownership Legend</div>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {([
            [CAT.purple,"Agent Portal"], [CAT.slate,"Super Admin"],  [CAT.sky,"OCR Center"],
            [CAT.orange,"Ops Control"],  [CAT.teal,"Visa Desk"],    [ERP.info,"Hotel Desk"],
            [CAT.orange,"Transport"],   [ERP.warning,"Catering"],      [ERP.success,"Finance ERP"],
            [CAT.purple,"Automation"],  [ERP.info,"Ops Control (Arrival/Departure)"],
          ] as [string,string][]).map(([c,n]) => (
            <div key={n} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor:c }} />
              <span className="text-[8.5px]" style={{ color:ERP.muted }}>{n}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Group Tracker screen ─────────────────────────────────────────────────────

function GroupTrackerScreen() {
  const [selected, setSelected] = useState<string|null>(null);
  return (
    <div className="p-6 h-full overflow-y-auto space-y-3" style={{ scrollbarWidth:"thin", scrollbarColor:"${ERP.mutedSoft} transparent" }}>
      <div className="text-xs font-black text-[color:var(--erp-text-strong)] mb-1">Active Groups — Pipeline Progress</div>
      <div className="text-[9px] mb-5" style={{ color:ERP.muted }}>
        Each bar shows progress through all 19 stages. Colour = module that owns each stage. Click any group for detail.
      </div>
      {GROUPS.map(g => {
        const pct = Math.round((g.currentStage - 1) / (STAGES.length - 1) * 100);
        const cStage = STAGES.find(s => s.id === g.currentStage)!;
        const isOpen = selected === g.id;
        return (
          <div key={g.id}>
            <button
              onClick={() => setSelected(isOpen ? null : g.id)}
              className="w-full text-left rounded-xl p-5 transition-all"
              style={{ backgroundColor:ERP.surfaceSoft, border:`1px solid ${isOpen?cStage.color:ERP.mutedSoft}` }}
            >
              <div className="flex items-start gap-4 mb-4">
                <div className="text-lg font-black" style={{ color:GOLD, fontFamily:"var(--font-mono)" }}>{g.id}</div>
                <div className="flex-1">
                  <div className="text-xs font-semibold text-[color:var(--erp-text-strong)]">{g.agent} · {g.flag} · {g.pax} pax</div>
                  <div className="text-[9px] mt-0.5" style={{ color:ERP.muted }}>{g.note}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-black" style={{ color:cStage.color }}>{cStage.label}</div>
                  <div className="text-[9px]" style={{ color:ERP.muted }}>Stage {g.currentStage} / {STAGES.length}</div>
                </div>
              </div>

              {/* Progress bar — one segment per stage */}
              <div className="flex gap-px">
                {STAGES.map(s => {
                  const st = stageStatus(s.id, g);
                  return (
                    <div key={s.id} title={`${s.id}. ${s.label}`}
                      className="flex-1 h-2.5 first:rounded-l-full last:rounded-r-full"
                      style={{ backgroundColor: st==="COMPLETED" ? s.color : st==="IN_PROGRESS" ? s.color : ERP.surfaceSoft, opacity: st==="IN_PROGRESS" ? 1 : st==="COMPLETED" ? 0.8 : 1 }} />
                  );
                })}
              </div>
              <div className="flex justify-between mt-1.5 text-[8px]" style={{ color:ERP.muted }}>
                <span>Agent Reg</span>
                <span className="font-bold" style={{ color:GOLD }}>{pct}% complete</span>
                <span>Archive</span>
              </div>
            </button>

            {/* Expanded stage list */}
            {isOpen && (
              <div className="mt-2 rounded-xl overflow-hidden" style={{ border:`1px solid ${ERP.border}` }}>
                {STAGES.map((s, i) => {
                  const st = stageStatus(s.id, g);
                  const [sc, sl] = SS[st];
                  const SIcon = s.icon;
                  return (
                    <div key={s.id} className="flex items-center gap-3 px-4 py-2.5"
                      style={{ backgroundColor: st==="IN_PROGRESS" ? `${erpAlpha(s.color, 3)}` : ERP.mutedSoft, borderBottom: i<STAGES.length-1 ? `1px solid ${ERP.border}` : "none", borderLeft:`3px solid ${st==="IN_PROGRESS"?s.color:st==="COMPLETED"?`${erpAlpha(s.color, 25)}`:"transparent"}` }}>
                      <span className="text-[8px] w-4 text-right font-black" style={{ color:ERP.mutedSoft, fontFamily:"var(--font-mono)" }}>{s.id}</span>
                      <SIcon size={12} style={{ color: st==="PENDING"?ERP.mutedSoft:s.color }} />
                      <span className="flex-1 text-[10px]" style={{ color: st==="PENDING"?ERP.muted:ERP.navy }}>{s.label}</span>
                      <span className="text-[8px]" style={{ color:ERP.muted }}>{s.module}</span>
                      <span className="text-[7px] font-black px-1.5 py-[2px] rounded-full" style={{ backgroundColor:`${erpAlpha(sc, 7)}`, color:sc }}>{sl}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Stage Directory screen ───────────────────────────────────────────────────

// ─── Stage Directory screen ───────────────────────────────────────────────────

function DirectoryScreen() {
  const { lang } = useLang();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const filtered = STAGES.filter(s =>
    s.label.toLowerCase().includes(search.toLowerCase()) ||
    s.module.toLowerCase().includes(search.toLowerCase())
  );
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  const columns: ErpColumn<Stage>[] = [
    {
      id: "stage",
      header: lang === "bn" ? "স্টেজ" : "Stage",
      cell: (s) => {
        const SIcon = s.icon;
        const activeCount = GROUPS.filter(g => g.currentStage === s.id).length;
        return (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${erpAlpha(s.color, 8)}` }}>
              <SIcon size={16} style={{ color: s.color }} />
            </div>
            <div>
              <div className="text-xs font-black text-[color:var(--erp-text-strong)]">{s.id}. {s.label}</div>
              <div className="text-[10px]" style={{ color: `${erpAlpha(s.color, 73)}` }}>{s.module}</div>
              {activeCount > 0 && (
                <ErpStatusChip status="info" label={`${activeCount} active`} lang={lang} />
              )}
            </div>
          </div>
        );
      },
    },
    {
      id: "phase",
      header: lang === "bn" ? "ফেজ" : "Phase",
      cell: (s) => {
        const phase = PHASES.find(p => p.id === s.phase);
        return phase ? <ErpStatusChip status="pending" label={`Phase ${phase.id}: ${phase.label}`} /> : "—";
      },
    },
    {
      id: "desc",
      header: lang === "bn" ? "বিবরণ" : "Description",
      cell: (s) => <span className="text-[11px]" style={{ color: ERP.muted }}>{STAGE_INFO[s.id - 1]?.desc ?? ""}</span>,
    },
    {
      id: "sla",
      header: "SLA",
      cell: (s) => <span className="text-[10px] font-bold" style={{ color: GOLD }}>{STAGE_INFO[s.id - 1]?.sla ?? "—"}</span>,
    },
  ];

  return (
    <div style={{ fontFamily: fontFor(lang) }}>
      <ErpPageTemplate
        title={lang === "bn" ? "স্টেজ ডিরেক্টরি" : "Stage Directory"}
        subtitle={`${filtered.length} / ${STAGES.length} ${lang === "bn" ? "স্টেজ" : "stages"}`}
        toolbar={
          <ErpSearchBar
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            onClear={() => { setSearch(""); setPage(1); }}
            placeholder={lang === "bn" ? "স্টেজ বা মডিউল…" : "Search stages or modules…"}
            lang={lang}
          />
        }
        footer={<ErpPagination page={page} pageSize={pageSize} total={filtered.length} onPageChange={setPage} lang={lang} />}
      >
        <ErpDataTable
          columns={columns}
          rows={pageRows}
          rowKey={(s) => String(s.id)}
          lang={lang}
          emptyTitle={lang === "bn" ? "কোনো মিল নেই" : "No matching stages"}
        />
      </ErpPageTemplate>
    </div>
  );
}

export default function WorkflowMap() {
  const [screen, setScreen] = useState<WFScreen>("pipeline");
  return (
    <ErpThemeProvider theme="ds"><ERPShell
      moduleId="workflow"
      moduleName="Workflow Map"
      moduleColor={GOLD}
      moduleIcon={GitBranch as IconFC}
      navItems={WF_NAV}
      activeItem={screen}
      onItemClick={id => setScreen(id as WFScreen)}
      breadcrumb={["Workflow Map", screen === "pipeline" ? "Pipeline View" : screen === "tracker" ? "Group Tracker" : "Stage Directory"]}
      notificationCount={2}
      userName="System Administrator"
      userRole="TUBA AL HIJAZ · Season 1446H"
    >
      <div className="h-full overflow-hidden">
        {screen === "pipeline"  && <PipelineScreen />}
        {screen === "tracker"   && <GroupTrackerScreen />}
        {screen === "directory" && <DirectoryScreen />}
      </div>
    </ERPShell></ErpThemeProvider>
  );
}
