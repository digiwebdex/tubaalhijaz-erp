import { useState, useEffect, type ReactNode, type CSSProperties } from "react";
import {
  Zap, Bell, BellRing, ClipboardList, MessageCircle, Mail, Inbox,
  ArrowRight, Plus, Play, Settings, Trash2, Filter, GitBranch,
  AlertTriangle, Activity,
  Search, Download, Send, ChevronRight, RefreshCw,
} from "lucide-react";
import { ERPShell, type NavItem, type IconFC } from "../components/ERPShell";
import { api, ApiError, isLoggedIn } from "../lib/api";
import { EmptyState, LoadingSkeleton, ErrorState } from "../components/States";
import { useShellTab } from "../lib/shellTab";
import {
  ErpPageTemplate, ErpButton, ErpSearchBar, ErpFilterPanel, ErpDataTable,
  ErpPagination, ErpStatusChip, erpToast,
  type ErpColumn, type ErpStatusKind,
} from "../components/erp";
import { useLang } from "../lib/LangContext";
import { fontFor } from "@tuba/shared";
import { downloadCsv } from "../lib/exportCsv";

// ─── Constants ────────────────────────────────────────────────────────────────

const AUTO  = "#8B5CF6";
const WA_C  = "#25D366";
const EM_C  = "var(--erp-destructive)";
const IS: CSSProperties = { backgroundColor:"var(--erp-canvas)", border:"1px solid rgba(11,30,63,0.15)", color:"var(--erp-text-strong)" };

type AutomScreen = "rules"|"notifications"|"log"|"dropdown";

const AUTO_TAB_IDS = ["rules", "notifications", "log", "dropdown"] as const;

const AUTO_NAV: NavItem[] = [
  { id:"rules",         label:"Automation Rules",     labelBn:"অটোমেশন রুলস",     icon: Zap           as IconFC, badge:12 },
  { id:"notifications", label:"Notification Center",  labelBn:"বিজ্ঞপ্তি কেন্দ্র", icon: Bell          as IconFC, badge:3  },
  { id:"log",           label:"Notification History", labelBn:"বিজ্ঞপ্তি ইতিহাস",  icon: ClipboardList as IconFC           },
  { id:"dropdown",      label:"In-App Alert Demo",    labelBn:"ইন-অ্যাপ অ্যালার্ট", icon: BellRing      as IconFC           },
];

// ─── Live API types & mappers ─────────────────────────────────────────────────

interface UiRule {
  _id?: string; id: string; cat: string; name: string; trigger: string;
  condition: string; actions: string[]; enabled: boolean; runs: number; lastRun: string;
}
interface LogRow {
  id: string; time: string; ch: string; event: string;
  rcpt: string; preview: string; status: string; priority: string;
}
interface LiveRuleAction { type: string; params?: Record<string, unknown>; }
interface LiveRule {
  id: string; code: string; name: string; nameBn: string | null;
  category: string; trigger: string; eventKey: string | null;
  conditionExpr: string | null; conditions: unknown; actions: LiveRuleAction[];
  enabled: boolean; cronExpr: string | null; lastRunAt: string | null;
  _count: { runLogs: number };
}
interface LiveRun {
  id: string; ruleId: string; eventKey: string; action: string; jobId: string | null;
  startedAt: string; durationMs: number; status: "OK" | "WARN" | "ERROR";
  message: string | null; rule: { code: string; name: string; category: string } | null;
}
interface LiveEvent {
  id: string; key: string; labelEn: string; labelBn: string | null; priority: string;
  whatsapp: boolean; email: boolean; inApp: boolean; _count: { templates: number; logs: number };
}
interface LiveTemplate {
  id: string; eventId: string; channel: "WHATSAPP" | "EMAIL" | "IN_APP";
  lang: "bn" | "en"; subject: string | null; body: string; event: { key: string };
}
interface NotifLog {
  id: string; channel: "WHATSAPP" | "EMAIL" | "IN_APP"; priority: "LOW" | "NORMAL" | "EMERGENCY";
  title: string; body: string; status: "PENDING" | "DELIVERED" | "READ" | "FAILED";
  readAt: string | null; createdAt: string; event: { key: string; labelEn: string } | null;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function mapRule(r: LiveRule): UiRule {
  return {
    _id: r.id,
    id: r.code,
    cat: r.category,
    name: r.name,
    trigger: r.trigger,
    condition: r.conditionExpr ?? "Always",
    actions: (r.actions ?? []).map(a => a.type.replace(/_/g, " ")),
    enabled: r.enabled,
    runs: r._count?.runLogs ?? 0,
    lastRun: timeAgo(r.lastRunAt),
  };
}

function mapRun(r: LiveRun): LogRow {
  const status = r.status === "OK" ? "DELIVERED" : r.status === "WARN" ? "PENDING" : "FAILED";
  return {
    id: r.id,
    time: timeAgo(r.startedAt),
    ch: r.action.replace(/_/g, " "),
    event: r.rule?.name ?? r.eventKey,
    rcpt: r.rule?.code ?? r.ruleId,
    preview: r.message ?? "",
    status,
    priority: r.rule?.category === "Esc" ? "emergency" : "normal",
  };
}

// ─── Mock data: rules ─────────────────────────────────────────────────────────

const RULES: UiRule[] = [
  { id:"R01", cat:"Agent",   name:"Agent Registration Approval",   trigger:"New agent signup",        condition:"Docs ≥ 3 AND Status = Pending",          actions:["Send approval email","WhatsApp welcome","In-App notification","Set status → Active"],              enabled:true,  runs:48,   lastRun:"2m ago"  },
  { id:"R02", cat:"Group",   name:"Group Creation Notification",   trigger:"Group record created",    condition:"Always",                                 actions:["Notify ops manager","Create Arrival Board entry","WhatsApp agent confirmation"],                  enabled:true,  runs:124,  lastRun:"14m ago" },
  { id:"R03", cat:"Group",   name:"Passport OCR Processing",       trigger:"Passport file uploaded",  condition:"File type = PDF or JPG/PNG",              actions:["Run OCR extraction","Map fields to pax record","Flag errors to operator","Mark as Processed"],   enabled:true,  runs:891,  lastRun:"3m ago"  },
  { id:"R04", cat:"Group",   name:"Excel Import Processing",       trigger:"Excel file uploaded",     condition:"Sheet name = Passenger List",             actions:["Parse all rows","Create/update pax records","Send import summary email to agent"],              enabled:true,  runs:43,   lastRun:"1h ago"  },
  { id:"R05", cat:"Visa",    name:"Visa Application Workflow",     trigger:"Visa status changed",     condition:"Status ∈ {Submitted, Approved, Rejected}",actions:["Update pax record","WhatsApp status to agent","Notify visa desk"],                              enabled:true,  runs:314,  lastRun:"8m ago"  },
  { id:"R06", cat:"Hotel",   name:"Hotel Confirmation Workflow",   trigger:"Hotel booking confirmed", condition:"Voucher not yet generated",               actions:["Generate hotel voucher PDF","Send voucher via WhatsApp","Archive to group docs"],                enabled:true,  runs:77,   lastRun:"22m ago" },
  { id:"R07", cat:"Docs",    name:"Invoice & PDF Generation",      trigger:"Invoice finalized",       condition:"Status = Draft AND Items > 0",            actions:["Render PDF with TUBA letterhead","Upload to docs store","Email PDF to agent"],                  enabled:true,  runs:156,  lastRun:"55m ago" },
  { id:"R08", cat:"Docs",    name:"QR Code Generation",            trigger:"Voucher finalized",       condition:"Type ∈ {Hotel, Transport, Ziyarah}",      actions:["Generate QR payload","Embed in voucher PDF","Log QR to BRN table"],                           enabled:true,  runs:203,  lastRun:"30m ago" },
  { id:"R09", cat:"Finance", name:"Finance Workflow Trigger",      trigger:"Payment received",        condition:"Amount > 0 AND Source = Agent",           actions:["Update agent ledger","Apply to open invoices","Send payment confirmation","WhatsApp receipt"],  enabled:true,  runs:89,   lastRun:"18m ago" },
  { id:"R10", cat:"Sys",     name:"Daily Backup",                  trigger:"Schedule: 02:00 daily",   condition:"Always",                                  actions:["Export DB snapshot","Upload to Azure Blob","Send backup report","Purge snapshots > 30d"],        enabled:true,  runs:180,  lastRun:"8h ago"  },
  { id:"R11", cat:"Esc",     name:"Payment Overdue Escalation",    trigger:"Invoice age > 30 days",   condition:"Status = Outstanding AND Amount > 5,000", actions:["WhatsApp overdue alert","Email finance manager","Set priority = URGENT","Log escalation"],     enabled:true,  runs:12,   lastRun:"2d ago"  },
  { id:"R12", cat:"Esc",     name:"Emergency Alert Dispatch",      trigger:"Emergency flag raised",   condition:"Always — no filter",                      actions:["WhatsApp blast all managers","Emergency email chain","Create URGENT in-app notif","Log incident"],enabled:true,  runs:3,    lastRun:"5d ago"  },
];

const CAT_COLOR: Record<string,string> = { Agent:"#0EA5E9", Group:"#10B981", Visa:"var(--erp-cat-teal)", Hotel:"var(--erp-info)", Finance:"var(--erp-success)", Docs:"var(--erp-warning)", Sys:"var(--erp-muted)", Esc:EM_C };

// ─── Mock data: notification events & templates ───────────────────────────────

interface NEvent { id:string; label:string; priority:"low"|"normal"|"emergency"; wa:boolean; email:boolean; inapp:boolean; }
const N_EVENTS: NEvent[] = [
  { id:"reg",       label:"Agent Registration",     priority:"normal",    wa:true,  email:true,  inapp:true  },
  { id:"visa",      label:"Visa Status Update",      priority:"normal",    wa:true,  email:false, inapp:true  },
  { id:"hotel",     label:"Hotel Confirmation",      priority:"normal",    wa:true,  email:true,  inapp:true  },
  { id:"transport", label:"Transport Dispatch",      priority:"normal",    wa:true,  email:false, inapp:true  },
  { id:"catering",  label:"Catering Confirmation",   priority:"normal",    wa:false, email:false, inapp:true  },
  { id:"payment",   label:"Payment Update",          priority:"normal",    wa:true,  email:true,  inapp:true  },
  { id:"voucher",   label:"Voucher Ready",           priority:"normal",    wa:true,  email:true,  inapp:true  },
  { id:"group",     label:"Group Completed",         priority:"normal",    wa:true,  email:true,  inapp:true  },
  { id:"daily",     label:"Daily Summary",           priority:"low",       wa:false, email:true,  inapp:false },
  { id:"emergency", label:"Emergency Alert",         priority:"emergency", wa:true,  email:true,  inapp:true  },
];

const WA_TMPL: Record<string,string> = {
  reg:       "🎉 *Welcome to TUBA AL HIJAZ!*\n\nDear *{{agent_name}}*, your agent account has been approved and is now active.\n\nPortal: portal.tubalhijaz.sa\nUsername: {{email}}\n\nSeason 1446H operations are open.\n\n_TUBA AL HIJAZ — جاهزون لخدمتكم_",
  voucher:   "🎫 *Voucher Ready — {{group_id}}*\n\nDear *{{agent_name}}*,\n\nYour group vouchers are now available:\n\n📅 Arrival: {{arrival_date}}\n🏨 Hotel: {{hotel_name}}\n👥 Passengers: {{pax_count}} pax\n🔑 Ref: {{voucher_ref}}\n\nDownload: {{voucher_link}}\n\n_TUBA AL HIJAZ — Enterprise Ground Handling_",
  payment:   "💰 *Payment Confirmed*\n\nDear *{{agent_name}}*,\n\nSAR *{{amount}}* has been received and applied.\n\nInvoice: {{invoice_ref}}\nBalance: SAR {{balance}}\nDate: {{date}}\n\n_TUBA AL HIJAZ Finance_",
  emergency: "🚨 *EMERGENCY ALERT — TUBA AL HIJAZ*\n\n⚠️ {{alert_type}}\n\nGroup: *{{group_id}}*\nLocation: {{location}}\nTime: {{timestamp}}\n\n*Immediate action required.*\n\nContact your group coordinator.\nOps Manager: {{ops_contact}}\n\n_Reply HELP for emergency contacts_",
  default:   "📢 *{{event_type}} — TUBA AL HIJAZ*\n\nDear *{{agent_name}}*,\n\n{{message_body}}\n\nRef: {{reference}}\nDate: {{date}}\n\nFor queries: ops@tubalhijaz.sa\n\n_TUBA AL HIJAZ — Enterprise Ground Handling_",
};

// ─── Mock data: notification log ──────────────────────────────────────────────

const NOTIF_LOG: LogRow[] = [
  { id:"NL-0841", time:"16 Jul 14:32", ch:"WhatsApp",  event:"Voucher Ready",       rcpt:"Rashidi Travel (+9661XXXXX)",   preview:"🎫 Voucher Ready — GRP-2891. Your group vouchers are now available…", status:"DELIVERED", priority:"normal"    },
  { id:"NL-0840", time:"16 Jul 14:28", ch:"In-App",    event:"Payment Update",      rcpt:"Finance Controller",            preview:"SAR 250,000 received from Rashidi Travel Co. Applied to INV-1446-0091", status:"READ",      priority:"normal"    },
  { id:"NL-0839", time:"16 Jul 13:11", ch:"WhatsApp",  event:"Emergency Alert",     rcpt:"All Managers · 8 contacts",    preview:"🚨 EMERGENCY ALERT — GRP-2990 flight delayed 3 hours. Rebook transport…", status:"DELIVERED", priority:"emergency" },
  { id:"NL-0838", time:"16 Jul 12:55", ch:"Email",     event:"Agent Registration",  rcpt:"baraka@baraka-travel.sa",      preview:"Your TUBA AL HIJAZ agent account has been approved and is now active…", status:"DELIVERED", priority:"normal"    },
  { id:"NL-0837", time:"16 Jul 12:01", ch:"In-App",    event:"Visa Update",         rcpt:"Visa Desk Team",               preview:"GRP-2891: All 47 Umrah visas approved by MOFA. Ready to print.",      status:"READ",      priority:"normal"    },
  { id:"NL-0836", time:"16 Jul 11:44", ch:"Email",     event:"Daily Summary",       rcpt:"management@tuba.sa",           preview:"TUBA AL HIJAZ Operations Summary — 16 Jul 2025. 8 groups active…",   status:"DELIVERED", priority:"low"       },
  { id:"NL-0835", time:"16 Jul 10:22", ch:"WhatsApp",  event:"Hotel Confirmation",  rcpt:"Al-Noor Pilgrim (+9665XXXXX)", preview:"🏨 Hotel voucher for GRP-2744 is ready. Jabal Omar Hyatt confirmed…", status:"DELIVERED", priority:"normal"    },
  { id:"NL-0834", time:"16 Jul 09:18", ch:"WhatsApp",  event:"Emergency Alert",     rcpt:"All Managers · 8 contacts",   preview:"🚨 EMERGENCY — Passport discrepancy detected in GRP-2612. 3 pax flagged…", status:"DELIVERED", priority:"emergency" },
  { id:"NL-0833", time:"16 Jul 08:45", ch:"Email",     event:"Payment Update",      rcpt:"rashidi@rashidi-travel.sa",    preview:"Invoice INV-1446-0091 — SAR 323,725 due. Payment terms: Net 30 days…", status:"FAILED",    priority:"normal"    },
  { id:"NL-0832", time:"15 Jul 23:30", ch:"Email",     event:"Daily Summary",       rcpt:"management@tuba.sa",           preview:"TUBA AL HIJAZ Operations Summary — 15 Jul 2025. 12 groups active…",  status:"DELIVERED", priority:"low"       },
];

// ─── Mock data: in-app dropdown ───────────────────────────────────────────────

const IN_APP = [
  { id:"A1", type:"emergency", label:"EMERGENCY ALERT",     body:"GRP-2990 flight delayed 3 hours — rebook transport immediately",             time:"5m",   read:false },
  { id:"A2", type:"payment",   label:"Payment Received",    body:"SAR 250,000 received from Rashidi Travel Co. — applied to INV-1446-0091",   time:"12m",  read:false },
  { id:"A3", type:"voucher",   label:"Voucher Ready",       body:"GRP-2891 vouchers generated (47 pax) — available in group documents",       time:"32m",  read:false },
  { id:"A4", type:"group",     label:"Group Completed",     body:"GRP-2203 — all 38 passengers successfully delivered to Jabal Omar Hyatt",   time:"2h",   read:true  },
  { id:"A5", type:"reg",       label:"Agent Registration",  body:"Baraka Travel Co. approved — account is now active for Season 1446H",       time:"3h",   read:true  },
  { id:"A6", type:"visa",      label:"Visa Update",         body:"GRP-2891: All 47 visas approved by MOFA — ready to print stickers",         time:"4h",   read:true  },
  { id:"A7", type:"backup",    label:"Backup Completed",    body:"Daily backup at 02:00 — 4.2 GB uploaded to Azure Blob Storage successfully", time:"12h",  read:true  },
];

const NOTIF_ICON: Record<string,string> = { emergency:"🚨", payment:"💰", voucher:"🎫", group:"✅", reg:"👤", visa:"📋", backup:"☁️", default:"🔔" };

// ─── Live notification-config mappers (Phase 11) ──────────────────────────────

function mapEvent(e: LiveEvent): NEvent {
  const p = (e.priority ?? "").toLowerCase();
  const priority: NEvent["priority"] = p === "low" || p === "emergency" ? p : "normal";
  return { id: e.key, label: e.labelEn, priority, wa: e.whatsapp, email: e.email, inapp: e.inApp };
}

function mapInApp(n: NotifLog): typeof IN_APP[number] {
  const type = n.priority === "EMERGENCY" ? "emergency" : (n.event?.key && NOTIF_ICON[n.event.key] ? n.event.key : "default");
  return {
    id: n.id,
    type,
    label: n.title,
    body: n.body || n.event?.labelEn || "",
    time: timeAgo(n.createdAt).replace(" ago", ""),
    read: n.status === "READ" || !!n.readAt,
  };
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

// `busy` = request in flight: blocks double-submits and dims via the design-system
// disabled token. Inert (identical to the frozen Figma switch) when not busy.
function Toggle({ on, onToggle, busy }: { on:boolean; onToggle:()=>void; busy?:boolean }) {
  return (
    <button disabled={busy} onClick={e=>{ e.stopPropagation(); onToggle(); }} className="relative inline-flex w-9 h-5 rounded-full shrink-0 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
      style={{ backgroundColor:on?AUTO:"var(--erp-border)" }}>
      <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200" style={{ left:on?"calc(100% - 1.125rem)":"0.125rem" }} />
    </button>
  );
}

function ChBadge({ ch }: { ch:string }) {
  const map: Record<string,[string,string]> = { WhatsApp:[WA_C,"WA"], Email:["var(--erp-info)","EM"], "In-App":[AUTO,"APP"] };
  const [c,l] = map[ch] ?? [AUTO, ch.substring(0,3).toUpperCase()];
  return <span className="inline-flex px-1.5 py-0.5 rounded text-[8px] font-black" style={{ backgroundColor:`${c}18`, color:c }}>{l}</span>;
}

function StatBadge({ s, priority }: { s:string; priority?:string }) {
  if (priority==="emergency") return <ErpStatusChip status="rejected" label="EMERGENCY" />;
  const kind: ErpStatusKind =
    s === "DELIVERED" || s === "READ" ? "approved" : s === "FAILED" ? "rejected" : s === "PENDING" ? "pending" : "info";
  return <ErpStatusChip status={kind} label={s} />;
}

function ABtn({ label, color, icon:Icon, onClick, disabled }: { label:string; color?:string; icon?:typeof Download; onClick?:()=>void; disabled?:boolean }) {
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

// ─── Flow builder sub-components ─────────────────────────────────────────────

function FlowArrow() {
  return (
    <div className="flex items-center shrink-0 w-12">
      <div className="flex-1 h-px border-t border-dashed" style={{ borderColor:`rgba(11,30,63,0.15)` }} />
      <ArrowRight size={14} style={{ color:"rgba(11,30,63,0.38)", marginLeft:-1 }} />
    </div>
  );
}

function FlowBlock({ step, color, icon:Icon, items, editing }: { step:string; color:string; icon:typeof Zap; items:string[]; editing:boolean }) {
  return (
    <div className="flex-1 min-w-0 rounded-xl overflow-hidden" style={{ border:`1px solid ${color}25` }}>
      <div className="flex items-center gap-2 px-4 py-3" style={{ backgroundColor:`${color}18` }}>
        <Icon size={13} style={{ color }} />
        <span className="text-[9px] font-black uppercase tracking-widest" style={{ color }}>{step}</span>
      </div>
      <div className="p-3 space-y-1.5" style={{ backgroundColor:"var(--erp-surface)" }}>
        {items.map((item, i) => (
          editing ? (
            <div key={i} className="flex items-center gap-1.5">
              <input defaultValue={item} className="flex-1 px-2.5 py-1.5 rounded-lg text-[10px] focus:outline-none" style={IS} />
              <button style={{ color:"rgba(11,30,63,0.50)" }} className="text-xs">×</button>
            </div>
          ) : (
            <div key={i} className="px-2.5 py-1.5 rounded-lg text-[10px] text-[var(--erp-text-strong)]" style={{ backgroundColor:`${color}10`, border:`1px solid ${color}20` }}>
              {item}
            </div>
          )
        ))}
        {editing && (
          <button className="flex items-center gap-1 text-[9px] font-bold mt-1 px-1" style={{ color:`${color}70` }}>
            <Plus size={9}/> Add
          </button>
        )}
      </div>
    </div>
  );
}

// ─── 1. Rules Screen ─────────────────────────────────────────────────────────

function RulesScreen() {
  const [selId, setSelId] = useState("R01");
  const [enabledMap, setEnabledMap] = useState<Record<string,boolean>>({});
  const [editing, setEditing] = useState(false);
  const [filter, setFilter] = useState("");
  const [live, setLive] = useState<UiRule[] | null>(null);
  const [loading, setLoading] = useState<boolean>(isLoggedIn());
  const [error, setError] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [savingFlow, setSavingFlow] = useState(false);
  const [recent, setRecent] = useState<LiveRun[] | null>(null);
  const [recentLoading, setRecentLoading] = useState(false);
  const [recentError, setRecentError] = useState(false);
  const [runsNonce, setRunsNonce] = useState(0);

  // `spinner` only on first load / explicit retry — a post-mutation refresh must not
  // blank the screen back to a skeleton.
  const load = (spinner: boolean) => {
    if (!isLoggedIn()) { setLoading(false); setError(false); return; }
    if (spinner) setLoading(true);
    setError(false);
    api.get<LiveRule[]>("/automation/rules")
      .then(rs => { setLive(rs.map(mapRule)); setLoading(false); })
      .catch(() => { setLive(null); setError(true); setLoading(false); });
  };
  const refresh = () => load(false);
  useEffect(() => {
    const t = setTimeout(() => load(true), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Logged in → only ever this tenant's real rules (possibly none).
  // Logged out → the frozen Figma demo set.
  const rules = isLoggedIn() ? (live ?? []) : RULES;
  const rule: UiRule | undefined = rules.find(r=>r.id===selId) ?? rules[0];
  const filtered = rules.filter(r=>!filter||r.name.toLowerCase().includes(filter.toLowerCase())||r.cat.toLowerCase().includes(filter.toLowerCase()));

  const cats = [...new Set(rules.map(r=>r.cat))];

  useEffect(() => {
    if (!isLoggedIn() || !rule?._id) { setRecent(null); setRecentLoading(false); setRecentError(false); return; }
    const id = rule._id;
    let cancelled = false;
    setRecentLoading(true);
    setRecentError(false);
    const t = setTimeout(() => {
      api.get<LiveRun[]>(`/automation/runs?ruleId=${encodeURIComponent(id)}&limit=5`)
        .then(r => { if (!cancelled) { setRecent(r); setRecentLoading(false); } })
        .catch(() => { if (!cancelled) { setRecent(null); setRecentError(true); setRecentLoading(false); } });
    }, 0);
    return () => { cancelled = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rule?._id, runsNonce]);

  // Logged in → real run history only (never the demo rows).
  const recentExec = isLoggedIn()
    ? (recent ?? []).map(r => ({ t: timeAgo(r.startedAt), dur: `${r.durationMs}ms`, s: r.status }))
    : [
        { t:"16 Jul 14:44", dur:"280ms", s:"OK"    },
        { t:"16 Jul 14:42", dur:"310ms", s:"OK"    },
        { t:"16 Jul 14:40", dur:"422ms", s:"OK"    },
        { t:"16 Jul 14:36", dur:"295ms", s:"WARN"  },
        { t:"16 Jul 14:30", dur:"501ms", s:"OK"    },
      ];

  const createRule = () => {
    if (!isLoggedIn()) { erpToast.success("New rule created — Draft rule added."); return; }
    setCreating(true);
    api.post<LiveRule>("/automation/rules", { name:"New Rule", category:"Sys", trigger:"Manual trigger", enabled:false })
      .then(created => { erpToast.success(`Rule ${created.code} created`); setSelId(created.code); refresh(); })
      .catch(e => erpToast.error(e instanceof ApiError ? e.message : "Failed to create rule"))
      .finally(() => setCreating(false));
  };

  if (loading) return <div className="p-6"><LoadingSkeleton tone="light" rows={6} /></div>;
  if (error)   return <div className="p-6"><ErrorState tone="light" onRetry={() => load(true)} /></div>;
  if (!rule) return (
    <div className="p-6">
      <EmptyState
        tone="light"
        title="No automation rules yet"
        hint="Rules run your notifications, escalations and scheduled jobs."
        action={<ABtn label="New Rule" color={AUTO} icon={Plus} onClick={createRule} disabled={creating} />}
      />
    </div>
  );

  return (
    <div className="grid grid-cols-5 gap-0 h-full overflow-hidden">
      {/* Left: Rule list */}
      <div className="col-span-2 flex flex-col overflow-hidden" style={{ borderRight:"1px solid rgba(11,30,63,0.11)" }}>
        <div className="flex items-center gap-2 px-4 py-3 shrink-0" style={{ borderBottom:"1px solid rgba(11,30,63,0.11)" }}>
          <div className="relative flex-1">
            <Search size={10} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color:"rgba(11,30,63,0.50)" }} />
            <input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Filter rules…"
              className="w-full pl-7 pr-3 py-2 rounded-xl text-[10px] focus:outline-none" style={IS} />
          </div>
          <ABtn label="New Rule" color={AUTO} icon={Plus} onClick={createRule} disabled={creating} />
        </div>
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth:"thin", scrollbarColor:"rgba(11,30,63,0.38) transparent" }}>
          {cats.map(cat => {
            const catRules = filtered.filter(r=>r.cat===cat);
            if (!catRules.length) return null;
            return (
              <div key={cat}>
                <div className="px-4 py-2 text-[9px] font-black uppercase tracking-widest sticky top-0" style={{ backgroundColor:"var(--erp-surface-soft)", color:"rgba(11,30,63,0.50)" }}>{cat}</div>
                {catRules.map(r=>(
                  <button key={r.id} onClick={()=>setSelId(r.id)}
                    className="w-full text-left flex items-start gap-3 px-4 py-3 transition-all"
                    style={{ backgroundColor:selId===r.id?`${AUTO}08`:"transparent", borderLeft:`3px solid ${selId===r.id?AUTO:"transparent"}`, borderBottom:"1px solid rgba(11,30,63,0.08)" }}>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-[var(--erp-text-strong)] truncate">{r.name}</div>
                      <div className="text-[9px] mt-0.5 truncate" style={{ color:"rgba(11,30,63,0.58)" }}>↯ {r.trigger}</div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[9px] font-mono" style={{ color:"rgba(11,30,63,0.50)", fontFamily:"var(--font-mono)" }}>{r.runs} runs · {r.lastRun}</span>
                      </div>
                    </div>
                    <Toggle on={enabledMap[r.id]??r.enabled} busy={togglingId===r.id} onToggle={()=>{ const next=!(enabledMap[r.id]??r.enabled); setEnabledMap(m=>({...m,[r.id]:next})); next?erpToast.success(`Rule enabled: ${r.name}`):erpToast.info(`Rule disabled: ${r.name}`); if(isLoggedIn()&&r._id){ setTogglingId(r.id); api.patch(`/automation/rules/${r._id}/enabled`,{enabled:next}).then(refresh).catch(e=>{ setEnabledMap(m=>({...m,[r.id]:!next})); erpToast.error(e instanceof ApiError?e.message:"Failed to toggle rule"); }).finally(()=>setTogglingId(null)); } }} />
                  </button>
                ))}
              </div>
            );
          })}
        </div>
        <div className="px-4 py-2.5 shrink-0" style={{ borderTop:"1px solid rgba(11,30,63,0.11)", backgroundColor:"var(--erp-surface)" }}>
          <div className="flex items-center gap-3 text-[9px]" style={{ color:"rgba(11,30,63,0.50)" }}>
            <Activity size={11} style={{ color:AUTO }} />
            <span>{rules.filter(r=>enabledMap[r.id]!==false).length} active · {rules.reduce((s,r)=>s+r.runs,0).toLocaleString()} total runs</span>
          </div>
        </div>
      </div>

      {/* Right: Rule builder */}
      <div className="col-span-3 flex flex-col overflow-hidden">
        {/* Rule header */}
        <div className="flex items-center gap-3 px-6 py-4 shrink-0" style={{ borderBottom:"1px solid rgba(11,30,63,0.11)", backgroundColor:"var(--erp-surface)" }}>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor:`${CAT_COLOR[rule.cat]??AUTO}18` }}>
            <Zap size={14} style={{ color:CAT_COLOR[rule.cat]??AUTO }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-[var(--erp-text-strong)] truncate" title={rule.name}>{rule.name}</div>
            <div className="text-[9px] mt-0.5 truncate" style={{ color:"rgba(11,30,63,0.58)" }}>
              {rule.id} · {rule.runs} runs · Last: {rule.lastRun}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ABtn label={editing?"Save":"Edit Flow"} color={AUTO} icon={editing?undefined:Settings} disabled={savingFlow} onClick={()=>{ const wasEditing=editing; setEditing(e=>!e); if(wasEditing){ if(!isLoggedIn()||!rule._id){ erpToast.success("Flow saved"); return; } setSavingFlow(true); api.patch(`/automation/rules/${rule._id}`,{ name:rule.name, category:rule.cat, trigger:rule.trigger, conditionExpr:rule.condition }).then(refresh).then(()=>erpToast.success("Flow saved")).catch(e=>erpToast.error(e instanceof ApiError?e.message:"Failed to save")).finally(()=>setSavingFlow(false)); } }} />
            <ABtn label="Test Run" color="var(--erp-success)" icon={Play} />
            <Trash2 size={14} onClick={()=>{ if(!isLoggedIn()||!rule._id){ erpToast.info(`Rule deleted: ${rule.name}`); return; } api.delete(`/automation/rules/${rule._id}`).then(()=>{ erpToast.success(`Rule deleted: ${rule.name}`); refresh(); }).catch(e=>erpToast.error(e instanceof ApiError?e.message:"Failed to delete")); }} style={{ color:"rgba(11,30,63,0.38)" }} className="cursor-pointer hover:text-red-400 ml-1" />
          </div>
        </div>

        {/* Flow diagram */}
        <div className="flex-1 overflow-y-auto p-6" style={{ scrollbarWidth:"thin", scrollbarColor:"rgba(11,30,63,0.38) transparent" }}>
          {/* Flow */}
          <div className="flex items-stretch gap-0 mb-5">
            <FlowBlock step="Trigger"    color="var(--erp-warning)" icon={Zap}       items={[rule.trigger]}         editing={editing} />
            <FlowArrow />
            <FlowBlock step="Condition"  color="var(--erp-cat-purple)" icon={GitBranch} items={[rule.condition]}       editing={editing} />
            <FlowArrow />
            <FlowBlock step="Actions"    color="#10B981" icon={Play}      items={rule.actions}           editing={editing} />
          </div>

          {/* Run history stats */}
          <div className="grid grid-cols-4 gap-3 mb-5">
            {[
              { l:"Total Runs",    v:rule.runs.toLocaleString(),  c:AUTO      },
              { l:"Last Executed", v:rule.lastRun,                c:"rgba(11,30,63,0.76)" },
              { l:"Avg Duration",  v:"340ms",                     c:"var(--erp-success)" },
              { l:"Success Rate",  v:"98.4%",                     c:"var(--erp-success)" },
            ].map(k=>(
              <div key={k.l} className="px-3 py-2.5 rounded-xl" style={{ backgroundColor:"var(--erp-surface-soft)", border:"1px solid rgba(11,30,63,0.11)" }}>
                <div className="text-sm font-black" style={{ color:k.c, fontFamily:"var(--font-mono)" }}>{k.v}</div>
                <div className="text-[9px] mt-0.5" style={{ color:"rgba(11,30,63,0.50)" }}>{k.l}</div>
              </div>
            ))}
          </div>

          {/* Mini run log */}
          <div className="rounded-xl overflow-hidden" style={{ border:"1px solid rgba(11,30,63,0.11)" }}>
            <div className="flex items-center justify-between px-4 py-2.5" style={{ backgroundColor:"var(--erp-surface)", borderBottom:"1px solid rgba(11,30,63,0.11)" }}>
              <span className="text-[10px] font-bold text-[var(--erp-text-strong)]">Recent Executions</span>
              <RefreshCw size={11} style={{ color:"rgba(11,30,63,0.50)" }} />
            </div>
            {recentLoading ? (
              <div className="px-4 py-2"><LoadingSkeleton tone="light" rows={3} /></div>
            ) : recentError ? (
              <div className="px-4 py-3"><ErrorState tone="light" message="Could not load recent executions" onRetry={()=>setRunsNonce(n=>n+1)} /></div>
            ) : recentExec.length === 0 ? (
              <EmptyState tone="light" title="No runs yet" hint="Executions appear here once this rule fires." />
            ) : recentExec.map((e,i)=>(
              <div key={i} className="flex items-center px-4 py-2" style={{ borderBottom:i<recentExec.length-1?"1px solid rgba(11,30,63,0.08)":undefined }}>
                <span className="text-[9px] w-28 shrink-0 whitespace-nowrap" style={{ color:"rgba(11,30,63,0.58)", fontFamily:"var(--font-mono)" }}>{e.t}</span>
                <span className="flex-1 min-w-0 truncate text-[10px]" title={rule.name} style={{ color:"rgba(11,30,63,0.66)" }}>{rule.name}</span>
                <span className="text-[9px] mr-3 font-mono shrink-0 whitespace-nowrap tabular-nums" style={{ color:"rgba(11,30,63,0.50)", fontFamily:"var(--font-mono)" }}>{e.dur}</span>
                <span className="text-[9px] font-black px-2 py-0.5 rounded-full shrink-0" style={{ backgroundColor:e.s==="OK"?`#4ADE8018`:e.s==="WARN"?`#FDE68A18`:`${EM_C}18`, color:e.s==="OK"?"var(--erp-success)":e.s==="WARN"?"var(--erp-warning)":EM_C }}>{e.s}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 2. Notification Center ───────────────────────────────────────────────────

type NCTab = "whatsapp"|"email"|"inapp";

function NotificationsScreen() {
  const [tab, setTab]     = useState<NCTab>("whatsapp");
  const [selEvt, setEvt]  = useState("voucher");
  const [liveEvents, setLiveEvents] = useState<NEvent[] | null>(null);
  const [loading, setLoading] = useState<boolean>(isLoggedIn());
  const [error, setError] = useState(false);
  const [busyChannel, setBusyChannel] = useState<string | null>(null);
  const [savingTmpl, setSavingTmpl] = useState(false);
  const [templates, setTemplates] = useState<LiveTemplate[] | null>(null);
  const [evtMap, setEvtMap] = useState<Record<string,Record<NCTab,boolean>>>(
    Object.fromEntries(N_EVENTS.map(e => [e.id, { whatsapp:e.wa, email:e.email, inapp:e.inapp }]))
  );

  // Live per-event channel matrix (falls back to mock only when logged out)
  const loadEvents = () => {
    if (!isLoggedIn()) { setLoading(false); setError(false); return; }
    setLoading(true);
    setError(false);
    api.get<LiveEvent[]>("/notifications/events").then(evs => {
      const mapped = evs.map(mapEvent);
      setLiveEvents(mapped);
      setEvtMap(Object.fromEntries(mapped.map(e => [e.id, { whatsapp:e.wa, email:e.email, inapp:e.inapp }])));
      setLoading(false);
    }).catch(() => { setLiveEvents(null); setError(true); setLoading(false); });
  };
  useEffect(() => {
    const t = setTimeout(loadEvents, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const events = isLoggedIn() ? (liveEvents ?? []) : N_EVENTS;
  const evt: NEvent | undefined = events.find(e=>e.id===selEvt) ?? events[0];

  // Live templates for the selected event
  useEffect(() => {
    if (!isLoggedIn() || !evt) { setTemplates(null); return; }
    const key = evt.id;
    let cancelled = false;
    const t = setTimeout(() => {
      api.get<LiveTemplate[]>(`/notifications/templates?eventKey=${encodeURIComponent(key)}`)
        .then(r => { if (!cancelled) setTemplates(r); })
        .catch(() => { if (!cancelled) setTemplates(null); });
    }, 0);
    return () => { cancelled = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evt?.id]);

  const tmplFor = (channel: LiveTemplate["channel"]) => templates?.find(t => t.channel === channel && t.lang === "en") ?? null;
  const waTmpl = tmplFor("WHATSAPP");
  const emailTmpl = tmplFor("EMAIL");
  const inAppTmpl = tmplFor("IN_APP");
  const waText = waTmpl?.body ?? WA_TMPL[selEvt] ?? WA_TMPL.default;

  const toggleChannel = (id: string, ch: NCTab) => {
    const next = !(evtMap[id]?.[ch]);
    setEvtMap(m => ({ ...m, [id]: { ...m[id], [ch]: next } }));
    if (!isLoggedIn()) { erpToast.success(`${ch==="inapp"?"In-App":ch==="whatsapp"?"WhatsApp":"Email"} ${next?"enabled":"disabled"}`); return; }
    const field = ch === "inapp" ? "inApp" : ch;
    setBusyChannel(`${id}:${ch}`);
    api.patch(`/notifications/events/${encodeURIComponent(id)}`, { [field]: next })
      .catch(e => {
        // roll the switch back so it never shows a state the server rejected
        setEvtMap(m => ({ ...m, [id]: { ...m[id], [ch]: !next } }));
        erpToast.error(e instanceof ApiError ? e.message : "Failed to update event");
      })
      .finally(() => setBusyChannel(null));
  };

  const saveTemplate = () => {
    if (!evt) return;
    const channel: LiveTemplate["channel"] = tab==="whatsapp" ? "WHATSAPP" : tab==="email" ? "EMAIL" : "IN_APP";
    if (!isLoggedIn()) { erpToast.success("Notification settings saved"); return; }
    const cur = channel==="WHATSAPP" ? waTmpl : channel==="EMAIL" ? emailTmpl : inAppTmpl;
    const body = cur?.body ?? waText;
    const subject = channel==="EMAIL" ? (emailTmpl?.subject ?? `${evt.label} — TUBA AL HIJAZ`) : undefined;
    setSavingTmpl(true);
    api.put("/notifications/templates", { eventKey: evt.id, channel, lang:"en", subject, body })
      .then(() => { erpToast.success("Notification settings saved"); })
      .catch((e: unknown) => erpToast.error(e instanceof ApiError ? e.message : "Failed to save template"))
      .finally(() => setSavingTmpl(false));
  };

  const tabColor: Record<NCTab,string> = { whatsapp:WA_C, email:"var(--erp-info)", inapp:AUTO };
  const tabIcon: Record<NCTab, typeof Bell> = { whatsapp:MessageCircle, email:Mail, inapp:Inbox };

  if (loading) return <div className="p-6"><LoadingSkeleton tone="light" rows={6} /></div>;
  if (error)   return <div className="p-6"><ErrorState tone="light" onRetry={loadEvents} /></div>;
  if (!evt) return (
    <div className="p-6">
      <EmptyState tone="light" title="No notification events configured" hint="Events define which channels fire for each system action." />
    </div>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-6 py-3 shrink-0" style={{ borderBottom:"1px solid rgba(11,30,63,0.11)", backgroundColor:"var(--erp-surface)" }}>
        {(["whatsapp","email","inapp"] as NCTab[]).map(t=>{
          const TI = tabIcon[t];
          return (
            <button key={t} onClick={()=>setTab(t)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold capitalize transition-all"
              style={{ backgroundColor:tab===t?`${tabColor[t]}18`:"transparent", color:tab===t?tabColor[t]:"rgba(11,30,63,0.58)", border:`1px solid ${tab===t?tabColor[t]+"30":"transparent"}` }}>
              <TI size={12}/> {t==="inapp"?"In-App":t==="whatsapp"?"WASender API":t.charAt(0).toUpperCase()+t.slice(1)}
            </button>
          );
        })}
        {tab==="whatsapp" && (
          <div className="ml-4 flex items-center gap-2 px-3 py-1.5 rounded-xl" style={{ backgroundColor:`${WA_C}10`, border:`1px solid ${WA_C}25` }}>
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor:WA_C }} />
            <span className="text-[9px] font-bold" style={{ color:WA_C }}>WASender API · Connected</span>
          </div>
        )}
        <ABtn label="Save Settings" color={AUTO} icon={undefined} onClick={saveTemplate} disabled={savingTmpl} />
      </div>

      <div className="grid grid-cols-5 flex-1 overflow-hidden">
        {/* Event list */}
        <div className="col-span-2 overflow-y-auto" style={{ borderRight:"1px solid rgba(11,30,63,0.11)", scrollbarWidth:"thin" }}>
          <div className="px-4 py-2.5 sticky top-0" style={{ backgroundColor:"var(--erp-surface-soft)", borderBottom:"1px solid rgba(11,30,63,0.11)" }}>
            <div className="grid grid-cols-5 text-[8px] font-black uppercase tracking-widest" style={{ color:"rgba(11,30,63,0.50)" }}>
              <span className="col-span-2">Event Type</span>
              <span className="text-center">WA</span>
              <span className="text-center">Email</span>
              <span className="text-center">In-App</span>
            </div>
          </div>
          {events.map((e)=>{
            const isEm = e.priority==="emergency";
            return (
              <button key={e.id} onClick={()=>setEvt(e.id)}
                className="w-full text-left grid grid-cols-5 items-center px-4 py-3 transition-all"
                style={{
                  backgroundColor:selEvt===e.id?`${AUTO}08`:isEm?`${EM_C}05`:"transparent",
                  borderBottom:"1px solid rgba(11,30,63,0.08)",
                  borderLeft:`3px solid ${selEvt===e.id?AUTO:isEm?EM_C:"transparent"}`,
                }}>
                <div className="col-span-2 flex items-center gap-2 min-w-0">
                  {isEm && <AlertTriangle size={11} className="shrink-0" style={{ color:EM_C }} />}
                  <div className="min-w-0">
                    <div className="text-xs font-semibold truncate" title={e.label} style={{ color:isEm?EM_C:"var(--erp-text-strong)" }}>{e.label}</div>
                    {isEm && <span className="text-[8px] font-black" style={{ color:EM_C }}>HIGH PRIORITY</span>}
                  </div>
                </div>
                {(["whatsapp","email","inapp"] as NCTab[]).map(ch => (
                  <div key={ch} className="flex justify-center">
                    <Toggle on={evtMap[e.id]?.[ch]??false} busy={busyChannel===`${e.id}:${ch}`} onToggle={()=>toggleChannel(e.id, ch)} />
                  </div>
                ))}
              </button>
            );
          })}
        </div>

        {/* Template preview */}
        <div className="col-span-3 overflow-y-auto p-5" style={{ scrollbarWidth:"thin", scrollbarColor:"rgba(11,30,63,0.38) transparent" }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-xs font-bold text-[var(--erp-text-strong)]">{evt.label} — {tab==="whatsapp"?"WhatsApp Template":tab==="email"?"Email Template":"In-App Template"}</div>
              {evt.priority==="emergency" && (
                <div className="flex items-center gap-1 mt-1">
                  <AlertTriangle size={10} style={{ color:EM_C }} />
                  <span className="text-[9px] font-black" style={{ color:EM_C }}>Emergency priority — cannot be disabled</span>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <ABtn label="Send Test" color={tabColor[tab]} icon={Send} />
              <ABtn label="Edit" color={AUTO} icon={Settings} />
            </div>
          </div>

          {/* WhatsApp preview */}
          {tab==="whatsapp" && (
            <div className="rounded-xl overflow-hidden" style={{ backgroundColor:"#F0F7F2" }}>
              {/* WA header */}
              <div className="flex items-center gap-3 px-4 py-3" style={{ backgroundColor:"#F0F7F3" }}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-black text-[var(--erp-text-strong)]" style={{ backgroundColor:WA_C }}>TH</div>
                <div>
                  <div className="text-xs font-bold text-[var(--erp-text-strong)]">TUBA AL HIJAZ</div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px]" style={{ color:WA_C }}>Business Account</span>
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded" style={{ backgroundColor:`${WA_C}20`, color:WA_C }}>VERIFIED ✓</span>
                  </div>
                </div>
                <MessageCircle size={18} className="ml-auto" style={{ color:"rgba(11,30,63,0.38)" }} />
              </div>
              {/* Chat area */}
              <div className="p-5 min-h-48">
                <div className="flex justify-end">
                  <div className="max-w-xs rounded-l-2xl rounded-br-2xl px-4 py-3 relative" style={{ backgroundColor:"#005C4B" }}>
                    <pre className="text-xs text-white whitespace-pre-wrap leading-relaxed" style={{ fontFamily:"var(--font-sans)" }}>{waText}</pre>
                    <div className="flex items-center justify-end gap-1 mt-2">
                      <span className="text-[9px]" style={{ color:"rgba(255,255,255,0.7)" }}>16:32</span>
                      <span className="text-[10px]" style={{ color:"#53BDEB" }}>✓✓</span>
                    </div>
                  </div>
                </div>
              </div>
              {/* Variable legend */}
              <div className="px-4 py-3" style={{ backgroundColor:"rgba(0,0,0,0.3)", borderTop:"1px solid rgba(11,30,63,0.11)" }}>
                <div className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color:"rgba(11,30,63,0.50)" }}>Template Variables</div>
                <div className="flex flex-wrap gap-1.5">
                  {["{{agent_name}}","{{group_id}}","{{amount}}","{{date}}","{{reference}}"].map(v=>(
                    <span key={v} className="px-2 py-0.5 rounded text-[8px] font-mono" style={{ backgroundColor:`${WA_C}15`, color:WA_C, fontFamily:"var(--font-mono)" }}>{v}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Email preview */}
          {tab==="email" && (
            <div className="rounded-xl overflow-hidden shadow-xl" style={{ fontFamily:"var(--font-sans)" }}>
              <div className="h-1.5" style={{ background:"linear-gradient(90deg,var(--erp-accent),#E8C87A,var(--erp-accent))" }} />
              <div className="bg-white px-6 py-5">
                <div className="flex items-start justify-between mb-4 pb-4" style={{ borderBottom:"1px solid #E5E7EB" }}>
                  <div>
                    <div className="text-lg font-black text-gray-900">TUBA AL HIJAZ</div>
                    <div className="text-[9px] text-gray-400 uppercase tracking-widest">Enterprise Ground Handling</div>
                  </div>
                  <div className="text-[9px] text-right text-gray-400">
                    <div>no-reply@tubalhijaz.sa</div>
                    <div>Season 1446H Automated</div>
                  </div>
                </div>
                <div className="mb-4">
                  <div className="text-[9px] text-gray-400 mb-1">SUBJECT</div>
                  <div className="text-sm font-bold text-gray-900">
                    {emailTmpl?.subject ??
                     (evt.id==="emergency"?"⚠️ Emergency Alert — Action Required — TUBA AL HIJAZ":
                     evt.id==="voucher"?"Voucher Ready — Group {{group_id}} — TUBA AL HIJAZ":
                     evt.id==="payment"?"Payment Confirmation — SAR {{amount}} — TUBA AL HIJAZ":
                     `${evt.label} — TUBA AL HIJAZ`)}
                  </div>
                </div>
                <div className="text-xs text-gray-700 space-y-2 leading-relaxed">
                  <p>Dear {"{{agent_name}}"},</p>
                  {evt.id==="emergency"
                    ? <><p className="text-red-600 font-bold">⚠️ URGENT: {"{{alert_type}}"} — {"{{group_id}}"}</p><p>Immediate action is required. Please contact your designated operations manager.</p></>
                    : evt.id==="voucher"
                    ? <p>Your travel vouchers for group {"{{group_id}}"} have been generated and are ready for download. Please find the details attached.</p>
                    : <p>This is an automated notification regarding {"{{event_type}}"} for your account. Please review the details and take any required action.</p>
                  }
                  <div className={`px-4 py-3 rounded-lg ${evt.id==="emergency"?"bg-red-50 border border-red-200":"bg-gray-50"}`}>
                    <div className="text-[9px] font-bold text-gray-500 mb-1">DETAILS</div>
                    <div>Reference: {"{{reference}}"}</div>
                    <div>Date: {"{{date}}"}</div>
                    <div>Account: {"{{agent_name}}"}</div>
                  </div>
                  <div className="pt-2">
                    <button className="px-4 py-2 rounded-lg text-xs font-bold text-[var(--erp-text-strong)]" style={{ backgroundColor:evt.id==="emergency"?EM_C:AUTO }}>
                      {evt.id==="emergency"?"Contact Ops Manager":"View in Portal →"}
                    </button>
                  </div>
                  <p className="text-[9px] text-gray-400 pt-2 border-t border-gray-100">This is an automated message. Do not reply to this email. Contact support at ops@tubalhijaz.sa</p>
                </div>
              </div>
              <div className="h-1" style={{ background:"linear-gradient(90deg,var(--erp-accent),#E8C87A,var(--erp-accent))" }} />
            </div>
          )}

          {/* In-App preview */}
          {tab==="inapp" && (
            <div>
              <div className="text-[9px] mb-3 font-bold uppercase tracking-widest" style={{ color:"rgba(11,30,63,0.50)" }}>In-App Notification Preview</div>
              <div className={`rounded-xl p-4`}
                style={{
                  backgroundColor:evt.id==="emergency"?`${EM_C}08`:"rgba(11,30,63,0.38)",
                  border:`1px solid ${evt.id==="emergency"?`${EM_C}30`:"rgba(11,30,63,0.38)"}`,
                  borderLeft:`3px solid ${evt.id==="emergency"?EM_C:AUTO}`,
                }}>
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
                    style={{ backgroundColor:evt.id==="emergency"?`${EM_C}15`:`${AUTO}15` }}>
                    {evt.id==="emergency"?"🚨":NOTIF_ICON[evt.id]??NOTIF_ICON.default}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {evt.id==="emergency" && <span className="text-[8px] font-black px-2 py-0.5 rounded-full" style={{ backgroundColor:`${EM_C}20`, color:EM_C }}>EMERGENCY</span>}
                      <span className="text-xs font-bold" style={{ color:evt.id==="emergency"?EM_C:"var(--erp-text-strong)" }}>{evt.label}</span>
                      <span className="ml-auto text-[9px]" style={{ color:"rgba(11,30,63,0.50)" }}>just now</span>
                    </div>
                    <div className="text-[10px]" style={{ color:"rgba(11,30,63,0.76)" }}>
                      {inAppTmpl?.body ??
                       (evt.id==="emergency"?"⚠️ {{alert_type}} — {{group_id}}. Immediate action required.":
                       evt.id==="voucher"?"Your group vouchers for {{group_id}} are ready. Download and distribute to your team.":
                       "{{message_body}} — Reference: {{reference}}")}
                    </div>
                    <div className="flex gap-2 mt-2.5">
                      <button className="px-3 py-1.5 rounded-lg text-[9px] font-bold" style={{ backgroundColor:`${evt.id==="emergency"?EM_C:AUTO}18`, color:evt.id==="emergency"?EM_C:AUTO }}>
                        {evt.id==="emergency"?"Take Action":"View Details"}
                      </button>
                      <button className="px-3 py-1.5 rounded-lg text-[9px] font-bold" style={{ backgroundColor:"var(--erp-canvas)", color:"rgba(11,30,63,0.58)" }}>Dismiss</button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-3 p-3 rounded-xl" style={{ backgroundColor:"var(--erp-surface)", border:"1px solid rgba(11,30,63,0.11)" }}>
                <div className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color:"rgba(11,30,63,0.50)" }}>Delivery Settings</div>
                {[["Show badge on bell icon","on"],["Play notification sound","on"],["Show toast (3 sec)","on"],["Persist in log","on"]].map(([l,v])=>(
                  <div key={l} className="flex justify-between items-center py-1.5" style={{ borderBottom:"1px solid rgba(11,30,63,0.08)" }}>
                    <span className="text-[10px]" style={{ color:"rgba(11,30,63,0.66)" }}>{l}</span>
                    <span className="text-[9px] font-black" style={{ color:"var(--erp-success)" }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 3. Notification Log ──────────────────────────────────────────────────────

function LogScreen() {
  const { lang } = useLang();
  const [q, setQ] = useState("");
  const [chFilter, setChFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [live, setLive] = useState<LiveRun[] | null>(null);
  const [loading, setLoading] = useState<boolean>(isLoggedIn());
  const [error, setError] = useState(false);
  const pageSize = 25;
  const load = () => {
    if (!isLoggedIn()) { setLoading(false); setError(false); return; }
    setLoading(true);
    setError(false);
    api.get<LiveRun[]>("/automation/runs?limit=100")
      .then(r => { setLive(r); setLoading(false); })
      .catch(() => { setLive(null); setError(true); setLoading(false); });
  };
  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const rows = isLoggedIn() ? (live ?? []).map(mapRun) : NOTIF_LOG;
  const filtered = rows.filter(n=>{
    const qm = !q || [n.event,n.rcpt,n.id,n.preview].join(" ").toLowerCase().includes(q.toLowerCase());
    const cm = chFilter==="All" || n.ch===chFilter;
    return qm && cm;
  });
  const emgCount = rows.filter(n=>n.priority==="emergency").length;
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  const columns: ErpColumn<LogRow>[] = [
    { id: "id", header: "ID", cell: (n) => <span className="font-mono font-black" style={{ color: n.priority === "emergency" ? EM_C : AUTO }}>{n.id}</span> },
    { id: "time", header: lang === "bn" ? "সময়" : "Time", cell: (n) => <span className="font-mono">{n.time}</span> },
    { id: "ch", header: lang === "bn" ? "চ্যানেল" : "Channel", cell: (n) => <ChBadge ch={n.ch} /> },
    {
      id: "event",
      header: lang === "bn" ? "ইভেন্ট" : "Event",
      cell: (n) => (
        <div className="flex items-center gap-1.5">
          {n.priority === "emergency" && <AlertTriangle size={10} style={{ color: EM_C }} />}
          <span className="text-xs font-semibold" style={{ color: n.priority === "emergency" ? EM_C : "var(--erp-text-strong)" }}>{n.event}</span>
        </div>
      ),
    },
    { id: "rcpt", header: lang === "bn" ? "প্রাপক" : "Recipient", cell: (n) => n.rcpt },
    { id: "preview", header: lang === "bn" ? "প্রিভিউ" : "Preview", cell: (n) => <span className="truncate max-w-[200px] block">{n.preview}</span> },
    { id: "status", header: lang === "bn" ? "স্ট্যাটাস" : "Status", cell: (n) => <StatBadge s={n.status} priority={n.priority === "emergency" ? "emergency" : undefined} /> },
  ];

  if (loading) return <div className="p-6"><LoadingSkeleton tone="light" rows={8} /></div>;
  if (error) return <div className="p-6"><ErrorState tone="light" onRetry={load} /></div>;

  return (
    <div style={{ fontFamily: fontFor(lang) }}>
      <ErpPageTemplate
        title={lang === "bn" ? "বিজ্ঞপ্তি ইতিহাস" : "Notification History"}
        subtitle={`${emgCount} ${lang === "bn" ? "জরুরি অ্যালার্ট" : "emergency alerts"}`}
        primaryAction={
          <ABtn
            label={lang === "bn" ? "এক্সপোর্ট CSV" : "Export CSV"}
            color={AUTO}
            icon={Download}
            onClick={() => {
              downloadCsv(
                `notification-log-${new Date().toISOString().slice(0, 10)}.csv`,
                ["ID", "Time", "Channel", "Event", "Recipient", "Preview", "Status", "Priority"],
                filtered.map((n) => [n.id, n.time, n.ch, n.event, n.rcpt, n.preview, n.status, n.priority]),
              );
              erpToast.success(lang === "bn" ? "CSV ডাউনলোড হয়েছে" : "CSV downloaded", lang);
            }}
          />
        }
        toolbar={
          <div className="flex flex-col gap-3 w-full">
            <ErpSearchBar
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
              onClear={() => { setQ(""); setPage(1); }}
              placeholder={lang === "bn" ? "লগ খুঁজুন…" : "Search log…"}
              lang={lang}
            />
            <ErpFilterPanel open={filtersOpen} onOpenChange={setFiltersOpen} lang={lang} activeCount={chFilter === "All" ? 0 : 1}>
              <div className="flex flex-wrap gap-1.5">
                {["All", "WhatsApp", "Email", "In-App"].map((c) => (
                  <ErpButton
                    key={c}
                    size="sm"
                    variant={chFilter === c ? "primary" : "outline"}
                    onClick={() => { setChFilter(c); setPage(1); }}
                    style={chFilter === c ? { backgroundColor: AUTO, color: "var(--erp-text-strong)" } : undefined}
                  >
                    {c}
                  </ErpButton>
                ))}
              </div>
            </ErpFilterPanel>
          </div>
        }
        footer={<ErpPagination page={page} pageSize={pageSize} total={filtered.length} onPageChange={setPage} lang={lang} />}
      >
        <ErpDataTable
          columns={columns}
          rows={pageRows}
          rowKey={(n) => n.id}
          lang={lang}
          emptyTitle={rows.length === 0
            ? (lang === "bn" ? "এখনো কোনো বিজ্ঞপ্তি নেই" : "No notifications sent yet")
            : (lang === "bn" ? "কোনো মিল নেই" : "No matching entries")}
          emptyHint={rows.length === 0
            ? (lang === "bn" ? "অটোমেশন রুল চললে ইতিহাস এখানে দেখা যাবে।" : "Delivery history appears here as automation rules run.")
            : (lang === "bn" ? "সার্চ বা চ্যানেল ফিল্টার মুছুন।" : "Try clearing the search or channel filter.")}
        />
      </ErpPageTemplate>
    </div>
  );
}

function DropdownDemoScreen() {
  // Logged out → the frozen Figma demo feed. Logged in → real notifications only.
  const [notifs, setNotifs] = useState<typeof IN_APP>(isLoggedIn() ? [] : IN_APP);
  const [loading, setLoading] = useState<boolean>(isLoggedIn());
  const [error, setError] = useState(false);
  const load = () => {
    if (!isLoggedIn()) { setNotifs(IN_APP); setLoading(false); setError(false); return; }
    setLoading(true);
    setError(false);
    api.get<NotifLog[]>("/notifications?limit=20")
      .then(rows => { setNotifs(rows.map(mapInApp)); setLoading(false); })
      .catch(() => { setNotifs([]); setError(true); setLoading(false); });
  };
  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const unread = notifs.filter(n=>!n.read).length;

  return (
    <div className="p-7">
      <div className="mb-5">
        <h2 className="text-sm font-bold text-[var(--erp-text-strong)]">In-App Notification Dropdown</h2>
        <p className="text-xs mt-1" style={{ color:"rgba(11,30,63,0.58)" }}>Expanded state — this panel mounts when the bell icon in the top bar is clicked. Emergency alerts appear pinned at the top with distinct red styling.</p>
      </div>

      {/* Simulated top bar context */}
      <div className="rounded-xl flex items-center justify-between px-5 py-3 mb-2" style={{ backgroundColor:"var(--erp-surface-soft)", border:"1px solid rgba(11,30,63,0.11)" }}>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor:AUTO }} />
          <span className="text-[10px] font-bold text-[var(--erp-text-strong)]">TUBA AL HIJAZ ERP</span>
          <ChevronRight size={10} style={{ color:"rgba(11,30,63,0.38)" }} />
          <span className="text-[10px]" style={{ color:"rgba(11,30,63,0.58)" }}>Finance Dashboard</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px]" style={{ color:"rgba(11,30,63,0.58)" }}>Finance Controller · Season 1446H</span>
          <div className="relative">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor:`${AUTO}20`, border:`1px solid ${AUTO}35` }}>
              <BellRing size={14} style={{ color:AUTO }} />
            </div>
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center text-[var(--erp-text-strong)]" style={{ backgroundColor:EM_C }}>
                {unread}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Arrow indicator */}
      <div className="flex justify-end pr-5 mb-px">
        <div className="w-3 h-2 border-l border-r border-t rounded-t-sm" style={{ borderColor:"rgba(11,30,63,0.15)", backgroundColor:"var(--erp-surface-soft)" }} />
      </div>

      {/* Dropdown panel */}
      <div className="ml-auto max-w-sm rounded-xl overflow-hidden" style={{ backgroundColor:"var(--erp-canvas)", border:"1px solid rgba(11,30,63,0.15)", boxShadow:"0 24px 64px rgba(0,0,0,0.6)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom:"1px solid rgba(11,30,63,0.11)", backgroundColor:"var(--erp-surface-soft)" }}>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[var(--erp-text-strong)]">Notifications</span>
            {unread>0 && <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full" style={{ backgroundColor:`${EM_C}20`, color:EM_C }}>{unread} new</span>}
          </div>
          <button onClick={()=>setNotifs(n=>n.map(x=>({...x,read:true})))} className="text-[9px] font-bold" style={{ color:AUTO }}>Mark all read</button>
        </div>

        {/* Notification items */}
        <div>
          {loading ? (
            <div className="px-4 py-3"><LoadingSkeleton tone="light" rows={3} /></div>
          ) : error ? (
            <div className="px-4 py-3"><ErrorState tone="light" onRetry={load} /></div>
          ) : notifs.length === 0 ? (
            <EmptyState tone="light" title="No notifications" hint="New alerts land here as they are raised." />
          ) : notifs.map((n, i)=>{
            const isEm = n.type==="emergency";
            return (
              <div key={n.id} onClick={()=>setNotifs(ns=>ns.map(x=>x.id===n.id?{...x,read:true}:x))} className="cursor-pointer transition-all hover:bg-white/3"
                style={{
                  backgroundColor:isEm?`${EM_C}08`:!n.read?"rgba(11,30,63,0.38)":"transparent",
                  borderBottom:i<notifs.length-1?"1px solid rgba(11,30,63,0.08)":undefined,
                  borderLeft:isEm?`3px solid ${EM_C}`:!n.read?`3px solid ${AUTO}`:"3px solid transparent",
                }}>
                <div className="flex items-start gap-3 px-4 py-3">
                  <span className="text-lg shrink-0 mt-0.5">{NOTIF_ICON[n.type]??NOTIF_ICON.default}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {isEm && (
                        <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full" style={{ backgroundColor:`${EM_C}20`, color:EM_C }}>
                          🚨 EMERGENCY
                        </span>
                      )}
                      <span className="text-[10px] font-bold truncate" style={{ color:isEm?EM_C:"var(--erp-text-strong)" }}>{n.label}</span>
                      <span className="ml-auto text-[9px] shrink-0" style={{ color:"rgba(11,30,63,0.50)" }}>{n.time} ago</span>
                    </div>
                    <div className="text-[10px] leading-relaxed line-clamp-2" style={{ color:isEm?"var(--erp-destructive)":"rgba(11,30,63,0.66)" }}>
                      {n.body}
                    </div>
                    {isEm && (
                      <button className="mt-2 px-3 py-1 rounded-lg text-[9px] font-black" style={{ backgroundColor:`${EM_C}20`, color:EM_C }}>
                        Take Action →
                      </button>
                    )}
                  </div>
                  {!n.read && !isEm && <div className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5" style={{ backgroundColor:AUTO }} />}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 text-center" style={{ borderTop:"1px solid rgba(11,30,63,0.11)", backgroundColor:"var(--erp-surface)" }}>
          <button className="text-[10px] font-bold" style={{ color:AUTO }}>View all notifications →</button>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 grid grid-cols-3 gap-4">
        {[
          { label:"Emergency Alert",  bg:`${EM_C}08`,   border:`${EM_C}30`, accent:EM_C,  desc:"Red left border + red header badge + 'Take Action' CTA. Always pinned at top." },
          { label:"Unread Normal",     bg:"rgba(11,30,63,0.38)", border:"rgba(11,30,63,0.15)", accent:AUTO, desc:"Violet left border + blue dot indicator. Dimmed slightly vs emergency." },
          { label:"Read / Dismissed",  bg:"transparent",            border:"rgba(11,30,63,0.11)", accent:"rgba(11,30,63,0.38)", desc:"No border accent, no dot. Subtle background, text opacity reduced." },
        ].map(l=>(
          <div key={l.label} className="rounded-xl p-4" style={{ backgroundColor:l.bg, border:`1px solid ${l.border}`, borderLeft:`3px solid ${l.accent}` }}>
            <div className="text-[10px] font-bold mb-1" style={{ color:l.accent }}>{l.label}</div>
            <div className="text-[9px]" style={{ color:"rgba(11,30,63,0.58)" }}>{l.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const SCREENS: Record<AutomScreen, ()=>ReactNode> = {
  rules:         ()=><RulesScreen />,
  notifications: ()=><NotificationsScreen />,
  log:           ()=><LogScreen />,
  dropdown:      ()=><DropdownDemoScreen />,
};

const LABELS: Record<AutomScreen,string> = {
  rules:"Automation Rules", notifications:"Notification Center",
  log:"Notification History", dropdown:"In-App Alert Demo",
};

export default function AutomationNotifications() {
  const [screen, setScreen] = useShellTab<AutomScreen>(AUTO_TAB_IDS, "rules");
  const isFluid = screen==="rules" || screen==="notifications" || screen==="log";

  return (
    <ERPShell
      moduleId="automation"
      moduleName="Automation & Notifications"
      moduleColor={AUTO}
      moduleIcon={Zap as IconFC}
      navItems={AUTO_NAV}
      activeItem={screen}
      onItemClick={id=>setScreen(id as AutomScreen)}
      breadcrumb={[LABELS[screen]]}
      notificationCount={3}
      userName="System Administrator"
      userRole="TUBA AL HIJAZ · Season 1446H"
    >
      <div className={`flex flex-col h-full ${isFluid?"overflow-hidden":"overflow-y-auto"}`}
           style={isFluid?{}:{ scrollbarWidth:"thin", scrollbarColor:"rgba(11,30,63,0.38) transparent" }}>
        {SCREENS[screen]()}
      </div>
    </ERPShell>
  );
}
