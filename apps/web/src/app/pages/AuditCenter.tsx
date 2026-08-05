import { useEffect, useState } from "react";
import { ScrollText, RefreshCw, Download, Eye } from "lucide-react";
import { ERPShell, type NavItem, type IconFC } from "../components/ERPShell";
import { LoadingSkeleton, ErrorState } from "../components/States";
import { ErpPageTemplate, ErpButton, ErpSearchBar, ErpDataTable, ErpSelect, ErpDrawer, ErpPagination, ErpStatusChip, type ErpColumn, type ErpStatusKind } from "../components/erp";
import { api, isLoggedIn } from "../lib/api";
import { useLang } from "../lib/LangContext";
import { fontFor } from "@tuba/shared";

const AUD = "#0F766E";
const ACTIONS = ["", "CREATE", "UPDATE", "DELETE", "APPROVE", "REJECT", "PROCESS", "REVIEW", "EXPORT", "LOGIN"];
const MODULES = ["", "Workflow", "Groups", "Passengers", "Services", "Finance", "OCR", "Uploads", "Flights", "Impersonation", "Security", "RateCards", "Companies"];

interface Row { id: string; actorUserId: string | null; actorLabel: string | null; actorEmail: string | null; actorName: string | null; action: string; module: string; entityType: string; entityId: string | null; ip: string | null; createdAt: string; before: unknown; after: unknown }
interface Resp { items?: Row[]; rows?: Row[]; total: number; page?: number; pageSize?: number }
const NAV: NavItem[] = [{ id: "audit", label: "Audit Center", labelBn: "অডিট সেন্টার", icon: ScrollText as IconFC }];
const actKind = (a: string): ErpStatusKind => (["APPROVE"].includes(a) ? "approved" : ["REJECT", "DELETE"].includes(a) ? "rejected" : ["CREATE"].includes(a) ? "info" : "pending");

export default function AuditCenter() {
  const { lang } = useLang();
  const [data, setData] = useState<Resp | null>(null);
  const [error, setError] = useState(false);
  const [q, setQ] = useState(""); const [module, setModule] = useState(""); const [action, setAction] = useState("");
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [page, setPage] = useState(1); const PAGE = 25;
  const [view, setView] = useState<Row | null>(null);

  const params = () => {
    const p = new URLSearchParams({ page: String(page), pageSize: String(PAGE), sort: "createdAt:desc" });
    if (module) p.set("module", module); if (action) p.set("action", action);
    if (q.trim()) p.set("user", q.trim()); if (from) p.set("from", from); if (to) p.set("to", to);
    return p.toString();
  };
  const load = () => {
    if (!isLoggedIn()) return;
    api.get<Resp>(`/audit-logs?${params()}`).then((d) => { setData(d); setError(false); }).catch(() => { setData(null); setError(true); });
  };
  useEffect(load, [page, module, action, from, to]);
  const rows = data?.items ?? data?.rows ?? [];

  const exportCsv = () => {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const head = ["time", "actor", "action", "module", "entityType", "entityId", "ip"];
    const lines = [head.join(",")].concat(rows.map((r) => [new Date(r.createdAt).toISOString(), r.actorEmail || r.actorLabel || r.actorUserId, r.action, r.module, r.entityType, r.entityId, r.ip].map(esc).join(",")));
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "audit-logs.csv"; a.click(); URL.revokeObjectURL(a.href);
  };

  const columns: ErpColumn<Row>[] = [
    { id: "time", header: lang === "bn" ? "সময়" : "Time", cell: (r) => <span className="text-[11px]">{new Date(r.createdAt).toLocaleString()}</span> },
    { id: "actor", header: lang === "bn" ? "ব্যবহারকারী" : "Actor", cell: (r) => <span className="text-[11px]">{r.actorEmail || r.actorName || r.actorLabel || "System"}</span> },
    { id: "action", header: lang === "bn" ? "অ্যাকশন" : "Action", cell: (r) => <ErpStatusChip status={actKind(r.action)} label={r.action} lang={lang} /> },
    { id: "module", header: lang === "bn" ? "মডিউল" : "Module", cell: (r) => <span className="text-xs font-semibold">{r.module}</span> },
    { id: "entity", header: lang === "bn" ? "এন্টিটি" : "Entity", cell: (r) => <span className="text-[11px] font-mono">{r.entityType}{r.entityId ? ` · ${r.entityId.slice(0, 8)}` : ""}</span> },
    { id: "ip", header: "IP", cell: (r) => <span className="text-[11px] font-mono">{r.ip || "—"}</span> },
    { id: "act", header: "", align: "right", cell: (r) => <ErpButton size="sm" variant="outline" icon={<Eye size={12} />} onClick={() => setView(r)}>{lang === "bn" ? "দেখুন" : "View"}</ErpButton> },
  ];

  return (
    <ERPShell moduleId="admin" moduleName="Audit Center" moduleColor={AUD} moduleIcon={ScrollText as IconFC}
      navItems={NAV} activeItem="audit" onItemClick={() => undefined} breadcrumb={[lang === "bn" ? "প্রশাসন" : "Administration", lang === "bn" ? "অডিট সেন্টার" : "Audit Center"]}
      userName="Administration" userRole="TUBA AL HIJAZ">
      <div className="flex-1 overflow-y-auto p-4 md:p-5" style={{ fontFamily: fontFor(lang) }}>
        <ErpPageTemplate title={lang === "bn" ? "অডিট সেন্টার" : "Audit Center"} subtitle={lang === "bn" ? "সিস্টেম-ব্যাপী পরিবর্তনের অপরিবর্তনীয় লগ" : "Immutable, system-wide change log"}
          toolbar={<div className="flex flex-col lg:flex-row gap-2 w-full">
            <div className="flex-1"><ErpSearchBar lang={lang} value={q} onChange={(e) => setQ(e.target.value)} onClear={() => setQ("")} placeholder={lang === "bn" ? "অ্যাক্টর ইউজার আইডি…" : "Actor user id…"} /></div>
            <ErpSelect value={module} onChange={(e) => { setModule(e.target.value); setPage(1); }} aria-label="Module">{MODULES.map((m) => <option key={m} value={m}>{m || (lang === "bn" ? "সব মডিউল" : "All modules")}</option>)}</ErpSelect>
            <ErpSelect value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} aria-label="Action">{ACTIONS.map((a) => <option key={a} value={a}>{a || (lang === "bn" ? "সব অ্যাকশন" : "All actions")}</option>)}</ErpSelect>
            <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} aria-label="From date" className="text-xs border rounded px-2" style={{ borderColor: "rgba(11,30,63,0.2)" }} />
            <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} aria-label="To date" className="text-xs border rounded px-2" style={{ borderColor: "rgba(11,30,63,0.2)" }} />
            <ErpButton size="sm" variant="outline" icon={<RefreshCw size={13} />} onClick={load}>{lang === "bn" ? "রিফ্রেশ" : "Refresh"}</ErpButton>
            <ErpButton size="sm" variant="outline" icon={<Download size={13} />} onClick={exportCsv}>CSV</ErpButton>
          </div>}
          footer={data ? <ErpPagination page={page} pageSize={PAGE} total={data.total} onPageChange={setPage} lang={lang} /> : undefined}>
          {error ? <ErrorState tone="light" lang={lang} onRetry={load} /> : data === null ? <LoadingSkeleton />
            : <ErpDataTable columns={columns} rows={rows} rowKey={(r) => r.id} lang={lang} emptyTitle={lang === "bn" ? "কোনো লগ নেই" : "No audit entries"} />}
        </ErpPageTemplate>
      </div>

      {view && (
        <ErpDrawer open onClose={() => setView(null)} lang={lang} title={lang === "bn" ? "অডিট বিস্তারিত" : "Audit Detail"} subtitle={`${view.action} · ${view.module}/${view.entityType}`}>
          <div className="space-y-3 text-[11px]" style={{ fontFamily: fontFor(lang) }}>
            <div className="grid grid-cols-2 gap-2">
              <div><b>{lang === "bn" ? "সময়" : "Timestamp"}:</b> {new Date(view.createdAt).toLocaleString()}</div>
              <div><b>IP:</b> {view.ip || "—"}</div>
              <div className="col-span-2"><b>{lang === "bn" ? "ব্যবহারকারী" : "Actor"}:</b> {view.actorEmail || view.actorName || view.actorLabel || "System"}</div>
              <div className="col-span-2"><b>Entity:</b> <span className="font-mono">{view.entityType} · {view.entityId || "—"}</span></div>
            </div>
            <div>
              <div className="font-bold uppercase tracking-widest mb-1" style={{ color: AUD }}>{lang === "bn" ? "পূর্বের মান" : "Before"}</div>
              <pre className="rounded p-2 overflow-x-auto" style={{ background: "#F5F7FA", maxHeight: 200 }}>{view.before ? JSON.stringify(view.before, null, 2) : "—"}</pre>
            </div>
            <div>
              <div className="font-bold uppercase tracking-widest mb-1" style={{ color: AUD }}>{lang === "bn" ? "নতুন মান" : "After"}</div>
              <pre className="rounded p-2 overflow-x-auto" style={{ background: "#F5F7FA", maxHeight: 200 }}>{view.after ? JSON.stringify(view.after, null, 2) : "—"}</pre>
            </div>
          </div>
        </ErpDrawer>
      )}
    </ERPShell>
  );
}
