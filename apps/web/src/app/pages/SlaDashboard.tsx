import { useEffect, useState } from "react";
import { Gauge, RefreshCw, AlertTriangle, Clock, CheckCircle2 } from "lucide-react";
import { ERPShell, type NavItem, type IconFC } from "../components/ERPShell";
import { LoadingSkeleton, ErrorState } from "../components/States";
import { ErpPageTemplate, ErpButton, ErpDataTable, ErpStatusChip, type ErpColumn, type ErpStatusKind } from "../components/erp";
import { api, isLoggedIn } from "../lib/api";
import { useLang } from "../lib/LangContext";
import { fontFor } from "@tuba/shared";

const SLA = "#B45309";
interface Row { id: string; code: string; name: string; stage: number; approvalStatus: string; slaHours: number | null; hoursInStage: number; status: string }
interface Resp { summary: Record<string, number>; rows: Row[] }
const NAV: NavItem[] = [{ id: "sla", label: "SLA Dashboard", labelBn: "এসএলএ ড্যাশবোর্ড", icon: Gauge as IconFC }];
const kind = (s: string): ErpStatusKind => ({ OVERDUE: "rejected", AT_RISK: "warning", ON_TIME: "approved", NO_SLA: "info" }[s] as ErpStatusKind ?? "info");

export default function SlaDashboard() {
  const { lang } = useLang();
  const [data, setData] = useState<Resp | null>(null);
  const [error, setError] = useState(false);
  const load = () => { if (!isLoggedIn()) return; api.get<Resp>("/sla/dashboard").then((d) => { setData(d); setError(false); }).catch(() => { setData(null); setError(true); }); };
  useEffect(load, []);

  const cards = [
    { key: "OVERDUE", label: lang === "bn" ? "মেয়াদোত্তীর্ণ" : "Overdue", color: "#B91C1C", icon: AlertTriangle },
    { key: "AT_RISK", label: lang === "bn" ? "ঝুঁকিতে" : "At Risk", color: SLA, icon: Clock },
    { key: "ON_TIME", label: lang === "bn" ? "সময়মতো" : "On Time", color: "#0D9488", icon: CheckCircle2 },
    { key: "NO_SLA", label: lang === "bn" ? "এসএলএ নেই" : "No SLA", color: "#64748B", icon: Gauge },
  ];
  const columns: ErpColumn<Row>[] = [
    { id: "code", header: lang === "bn" ? "কোড" : "Code", cell: (r) => <span className="text-[11px] font-mono" style={{ color: SLA }}>{r.code}</span> },
    { id: "name", header: lang === "bn" ? "গ্রুপ" : "Group", cell: (r) => <span className="text-xs font-semibold">{r.name}</span> },
    { id: "stage", header: lang === "bn" ? "ধাপ" : "Stage", align: "center", cell: (r) => <span className="font-mono">{r.stage}</span> },
    { id: "sla", header: lang === "bn" ? "এসএলএ (ঘণ্টা)" : "SLA (h)", align: "center", cell: (r) => <span className="font-mono">{r.slaHours ?? "—"}</span> },
    { id: "in", header: lang === "bn" ? "ধাপে (ঘণ্টা)" : "In stage (h)", align: "center", cell: (r) => <span className="font-mono font-bold">{r.hoursInStage}</span> },
    { id: "st", header: lang === "bn" ? "স্ট্যাটাস" : "Status", cell: (r) => <ErpStatusChip status={kind(r.status)} label={r.status} lang={lang} /> },
  ];

  return (
    <ERPShell moduleId="admin" moduleName="SLA Dashboard" moduleColor={SLA} moduleIcon={Gauge as IconFC}
      navItems={NAV} activeItem="sla" onItemClick={() => undefined} breadcrumb={[lang === "bn" ? "প্রশাসন" : "Administration", lang === "bn" ? "এসএলএ" : "SLA"]} userName="Administration" userRole="TUBA AL HIJAZ">
      <div className="flex-1 overflow-y-auto p-4 md:p-5" style={{ fontFamily: fontFor(lang) }}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {cards.map((c) => (
            <div key={c.key} className="rounded-xl p-3" style={{ background: `${c.color}0D`, border: `1px solid ${c.color}22` }}>
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: c.color }}><c.icon size={13} aria-hidden="true" />{c.label}</div>
              <div className="text-2xl font-black mt-1" style={{ color: c.color, fontFamily: "var(--font-mono)" }}>{data?.summary?.[c.key] ?? "—"}</div>
            </div>
          ))}
        </div>
        <ErpPageTemplate title={lang === "bn" ? "এসএলএ ড্যাশবোর্ড" : "SLA Dashboard"} subtitle={lang === "bn" ? "কনফিগারেশন-চালিত ধাপ এসএলএ" : "Configuration-driven stage SLAs"}
          toolbar={<div className="flex justify-end w-full"><ErpButton size="sm" variant="outline" icon={<RefreshCw size={13} />} onClick={load}>{lang === "bn" ? "রিফ্রেশ" : "Refresh"}</ErpButton></div>}>
          {error ? <ErrorState tone="light" lang={lang} onRetry={load} /> : data === null ? <LoadingSkeleton />
            : <ErpDataTable columns={columns} rows={data.rows} rowKey={(r) => r.id} lang={lang} emptyTitle={lang === "bn" ? "কোনো সক্রিয় গ্রুপ নেই" : "No active groups"} />}
        </ErpPageTemplate>
      </div>
    </ERPShell>
  );
}
