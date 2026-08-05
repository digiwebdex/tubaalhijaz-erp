import { useEffect, useMemo, useState } from "react";
import { Workflow as WfIcon, RefreshCw, Send, Lock, Unlock, Eye, MessageSquarePlus, Layers, Clock, ShieldAlert } from "lucide-react";
import { ERPShell, type NavItem, type IconFC } from "../components/ERPShell";
import { LoadingSkeleton, ErrorState, EmptyState } from "../components/States";
import { ErpPageTemplate, ErpButton, ErpSearchBar, ErpDataTable, ErpSelect, ErpDrawer, ErpDrawerFooterActions, ErpForm, ErpField, ErpInput, ErpTextarea, ErpStatusChip, erpToast, type ErpColumn, type ErpStatusKind } from "../components/erp";
import { api, ApiError, isLoggedIn } from "../lib/api";
import { useLang } from "../lib/LangContext";
import { fontFor } from "@tuba/shared";

const MW = "#1D4ED8";
interface Group { id: string; code: string; name: string; approvalStatus: string; locked: boolean; lockType: string | null; paxCount: number; returnReason?: string | null }
interface Wf { approvalStatus: string; locked: boolean; lockType: string | null; submittedAt: string | null; approvedAt: string | null; lockedAt: string | null; returnReason: string | null }
interface CR { id: string; description: string; field: string | null; status: string; createdAt: string }
interface Version { id: string; version: number; reason: string | null; createdAt: string }
interface TL { id: string; event: string; actorLabel: string | null; note: string | null; createdAt: string }
const NAV: NavItem[] = [{ id: "mw", label: "My Workflow", labelBn: "আমার ওয়ার্কফ্লো", icon: WfIcon as IconFC }];
const stKind = (s: string): ErpStatusKind => ({ APPROVED: "approved", REJECTED: "rejected", PENDING_APPROVAL: "pending", RETURNED: "warning", DRAFT: "info", SUBMITTED: "info", COMPLETED: "completed", ARCHIVED: "cancelled" }[s] as ErpStatusKind ?? "info");

export default function AgentGroupWorkflow() {
  const { lang } = useLang();
  const [rows, setRows] = useState<Group[] | null>(null);
  const [error, setError] = useState(false);
  const [q, setQ] = useState(""); const [filter, setFilter] = useState("ALL");
  const [busy, setBusy] = useState(false);
  const [crFor, setCrFor] = useState<Group | null>(null);
  const [crField, setCrField] = useState(""); const [crDesc, setCrDesc] = useState("");
  const [detail, setDetail] = useState<Group | null>(null);

  const load = () => { if (!isLoggedIn()) return; api.get<Group[]>("/groups").then((d) => { setRows(d); setError(false); }).catch(() => { setRows([]); setError(true); }); };
  useEffect(load, []);
  const shown = useMemo(() => (rows ?? []).filter((g) => (filter === "ALL" || g.approvalStatus === filter || (filter === "LOCKED" && g.locked)) && (!q.trim() || [g.code, g.name].join(" ").toLowerCase().includes(q.toLowerCase()))), [rows, filter, q]);

  const submit = async (g: Group) => {
    setBusy(true);
    try { await api.post(`/groups/${g.id}/submit`, {}); erpToast.success(lang === "bn" ? "অনুমোদনের জন্য জমা হয়েছে" : "Submitted for approval", lang); load(); }
    catch (e) { erpToast.error(e instanceof ApiError ? e.message : "Failed", lang); } finally { setBusy(false); }
  };
  const raiseCr = async () => {
    if (!crFor) return;
    if (!crDesc.trim()) { erpToast.error(lang === "bn" ? "বিবরণ আবশ্যক" : "Description required", lang); return; }
    setBusy(true);
    try {
      await api.post(`/groups/${crFor.id}/change-requests`, { field: crField.trim() || undefined, description: crDesc.trim() });
      erpToast.success(lang === "bn" ? "পরিবর্তন অনুরোধ পাঠানো হয়েছে" : "Change request submitted", lang);
      setCrFor(null); setCrField(""); setCrDesc(""); load();
    } catch (e) { erpToast.error(e instanceof ApiError ? e.message : "Failed", lang); } finally { setBusy(false); }
  };

  const columns: ErpColumn<Group>[] = [
    { id: "code", header: lang === "bn" ? "কোড" : "Code", cell: (g) => <span className="text-[11px] font-mono" style={{ color: MW }}>{g.code}</span> },
    { id: "name", header: lang === "bn" ? "গ্রুপ" : "Group", cell: (g) => <span className="text-xs font-semibold">{g.name}</span> },
    { id: "pax", header: "Pax", align: "center", cell: (g) => <span className="font-mono">{g.paxCount}</span> },
    { id: "st", header: lang === "bn" ? "স্ট্যাটাস" : "Status", cell: (g) => <ErpStatusChip status={stKind(g.approvalStatus)} label={g.approvalStatus} lang={lang} /> },
    { id: "lock", header: lang === "bn" ? "লক" : "Lock", align: "center", cell: (g) => g.locked ? <span className="inline-flex items-center gap-1 text-[10px] font-bold" style={{ color: g.lockType === "HARD" ? "#B91C1C" : "#B45309" }}><Lock size={11} />{g.lockType || "SOFT"}</span> : <Unlock size={12} style={{ color: "rgba(11,30,63,0.3)" }} /> },
    { id: "act", header: "", align: "right", cell: (g) => (
      <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
        {["DRAFT", "RETURNED"].includes(g.approvalStatus) && !g.locked &&
          <ErpButton size="sm" variant="primary" icon={<Send size={12} />} onClick={() => submit(g)} disabled={busy}>{lang === "bn" ? "জমা দিন" : "Submit"}</ErpButton>}
        {g.locked &&
          <ErpButton size="sm" variant="outline" icon={<MessageSquarePlus size={12} />} onClick={() => { setCrFor(g); setCrField(""); setCrDesc(""); }}>{lang === "bn" ? "পরিবর্তন অনুরোধ" : "Request Change"}</ErpButton>}
        <ErpButton size="sm" variant="ghost" icon={<Eye size={12} />} onClick={() => setDetail(g)}>{lang === "bn" ? "বিস্তারিত" : "View"}</ErpButton>
      </div>
    ) },
  ];

  return (
    <ERPShell moduleId="admin" moduleName="My Workflow" moduleColor={MW} moduleIcon={WfIcon as IconFC}
      navItems={NAV} activeItem="mw" onItemClick={() => undefined} breadcrumb={[lang === "bn" ? "ওয়ার্কফ্লো" : "Workflow", lang === "bn" ? "আমার গ্রুপ" : "My Groups"]} userName="Workspace" userRole="TUBA AL HIJAZ">
      <div className="flex-1 overflow-y-auto p-4 md:p-5" style={{ fontFamily: fontFor(lang) }}>
        <div className="mb-3 flex items-start gap-2 text-[11px] rounded-lg p-2.5" style={{ background: `${MW}0A`, border: `1px solid ${MW}22`, color: "#1E3A8A" }}>
          <ShieldAlert size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{lang === "bn" ? "লক করা গ্রুপ সরাসরি সম্পাদনা করা যায় না — পরিবর্তনের জন্য একটি অনুরোধ পাঠান, যা স্টাফ পর্যালোচনা করবে।" : "Locked groups can't be edited directly — raise a change request for staff to review. Draft/returned groups can be submitted for approval."}</span>
        </div>
        <ErpPageTemplate title={lang === "bn" ? "আমার ওয়ার্কফ্লো" : "My Workflow"} subtitle={lang === "bn" ? "গ্রুপ জমা, লক অবস্থা ও পরিবর্তন অনুরোধ" : "Submit groups, track lock state & raise change requests"}
          toolbar={<div className="flex flex-col lg:flex-row gap-2 w-full">
            <div className="flex-1"><ErpSearchBar lang={lang} value={q} onChange={(e) => setQ(e.target.value)} onClear={() => setQ("")} placeholder={lang === "bn" ? "গ্রুপ, কোড…" : "Group, code…"} /></div>
            <ErpSelect value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter by status">
              {["ALL", "DRAFT", "PENDING_APPROVAL", "APPROVED", "LOCKED", "RETURNED", "REJECTED", "COMPLETED"].map((s) => <option key={s} value={s}>{s}</option>)}
            </ErpSelect>
            <ErpButton size="sm" variant="outline" icon={<RefreshCw size={13} />} onClick={load}>{lang === "bn" ? "রিফ্রেশ" : "Refresh"}</ErpButton>
          </div>}>
          {error ? <ErrorState tone="light" lang={lang} onRetry={load} /> : rows === null ? <LoadingSkeleton />
            : shown.length === 0 ? <EmptyState tone="light" title={lang === "bn" ? "কোনো গ্রুপ নেই" : "No groups"} hint={lang === "bn" ? "ফিল্টার পরিবর্তন করুন" : "Change the filter"} />
            : <ErpDataTable columns={columns} rows={shown} rowKey={(g) => g.id} lang={lang} emptyTitle="" />}
        </ErpPageTemplate>
      </div>

      {crFor && (
        <ErpDrawer open onClose={() => setCrFor(null)} lang={lang} title={lang === "bn" ? "পরিবর্তন অনুরোধ" : "Request a Change"} subtitle={`${crFor.code} · ${crFor.name}`}
          footer={<ErpDrawerFooterActions lang={lang} onCancel={() => setCrFor(null)} onSave={raiseCr} saving={busy} saveLabel={lang === "bn" ? "অনুরোধ পাঠান" : "Submit request"} />}>
          <div className="mb-2 flex items-center gap-1.5 text-[11px]" style={{ color: crFor.lockType === "HARD" ? "#B91C1C" : "#B45309" }}><Lock size={12} />{crFor.lockType || "SOFT"} {lang === "bn" ? "লক" : "lock"}</div>
          <ErpForm columns={1}>
            <ErpField label={lang === "bn" ? "ক্ষেত্র (ঐচ্ছিক)" : "Field (optional)"} hint={lang === "bn" ? "যেমন: passenger.passport, flight.date" : "e.g. passenger.passport, flight.date"}><ErpInput value={crField} onChange={(e) => setCrField(e.target.value)} /></ErpField>
            <ErpField label={lang === "bn" ? "বিবরণ (আবশ্যক)" : "Description (required)"}><ErpTextarea value={crDesc} onChange={(e) => setCrDesc(e.target.value)} rows={4} placeholder={lang === "bn" ? "কী পরিবর্তন দরকার তা ব্যাখ্যা করুন…" : "Explain what needs to change…"} /></ErpField>
          </ErpForm>
        </ErpDrawer>
      )}
      {detail && <WfDetail group={detail} onClose={() => setDetail(null)} lang={lang} />}
    </ERPShell>
  );
}

function WfDetail({ group, onClose, lang }: { group: Group; onClose: () => void; lang: "bn" | "en" }) {
  const [wf, setWf] = useState<Wf | null>(null);
  const [crs, setCrs] = useState<CR[] | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [tl, setTl] = useState<TL[]>([]);
  useEffect(() => {
    api.get<Wf>(`/groups/${group.id}/workflow`).then(setWf).catch(() => setWf(null));
    api.get<CR[]>(`/groups/${group.id}/change-requests`).then(setCrs).catch(() => setCrs([]));
    api.get<Version[]>(`/groups/${group.id}/versions`).then(setVersions).catch(() => setVersions([]));
    api.get<TL[]>(`/groups/${group.id}/timeline`).then(setTl).catch(() => setTl([]));
  }, [group.id]);
  return (
    <ErpDrawer open onClose={onClose} lang={lang} title={lang === "bn" ? "গ্রুপ ওয়ার্কফ্লো" : "Group Workflow"} subtitle={`${group.code} · ${group.name}`}>
      <div className="space-y-5 text-[11px]" style={{ fontFamily: fontFor(lang) }}>
        <section>
          <div className="flex items-center gap-2 mb-1.5">
            <ErpStatusChip status={stKind(group.approvalStatus)} label={group.approvalStatus} lang={lang} />
            {wf?.locked && <span className="inline-flex items-center gap-1 text-[10px] font-bold" style={{ color: wf.lockType === "HARD" ? "#B91C1C" : "#B45309" }}><Lock size={11} />{wf.lockType || "SOFT"}</span>}
          </div>
          {wf?.returnReason && <div className="rounded p-2" style={{ background: "rgba(180,83,9,0.08)", color: "#92400E" }}><b>{lang === "bn" ? "ফেরতের কারণ" : "Return reason"}:</b> {wf.returnReason}</div>}
          <div className="grid grid-cols-2 gap-1 mt-1" style={{ color: "rgba(11,30,63,0.6)" }}>
            {wf?.submittedAt && <div>{lang === "bn" ? "জমা" : "Submitted"}: {new Date(wf.submittedAt).toLocaleString()}</div>}
            {wf?.approvedAt && <div>{lang === "bn" ? "অনুমোদিত" : "Approved"}: {new Date(wf.approvedAt).toLocaleString()}</div>}
            {wf?.lockedAt && <div>{lang === "bn" ? "লক" : "Locked"}: {new Date(wf.lockedAt).toLocaleString()}</div>}
          </div>
        </section>
        <section>
          <h4 className="font-bold uppercase tracking-widest mb-1.5" style={{ color: MW }}>{lang === "bn" ? "পরিবর্তন অনুরোধ" : "Change Requests"}</h4>
          {crs === null ? <LoadingSkeleton /> : crs.length === 0 ? <p style={{ color: "rgba(11,30,63,0.5)" }}>{lang === "bn" ? "কোনো অনুরোধ নেই" : "None"}</p>
            : crs.map((c) => <div key={c.id} className="border rounded px-2 py-1.5 mb-1 flex items-center justify-between" style={{ borderColor: "rgba(11,30,63,0.12)" }}><span>{c.field ? <b className="font-mono">{c.field}: </b> : null}{c.description}</span><ErpStatusChip status={stKind(c.status)} label={c.status} lang={lang} /></div>)}
        </section>
        <section>
          <h4 className="font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1" style={{ color: MW }}><Layers size={12} />{lang === "bn" ? "সংস্করণ" : "Versions"}</h4>
          {versions.length === 0 ? <p style={{ color: "rgba(11,30,63,0.5)" }}>{lang === "bn" ? "কোনো সংস্করণ নেই" : "No versions yet"}</p>
            : versions.map((v) => <div key={v.id} className="border rounded px-2 py-1 mb-1" style={{ borderColor: "rgba(11,30,63,0.12)" }}>v{v.version} · {new Date(v.createdAt).toLocaleString()}{v.reason ? ` · ${v.reason}` : ""}</div>)}
        </section>
        <section>
          <h4 className="font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1" style={{ color: MW }}><Clock size={12} />{lang === "bn" ? "টাইমলাইন" : "Timeline"}</h4>
          {tl.map((t) => <div key={t.id} className="flex gap-2 mb-1"><span className="font-mono" style={{ color: MW }}>{t.event}</span><span style={{ color: "rgba(11,30,63,0.6)" }}>{t.actorLabel} · {new Date(t.createdAt).toLocaleString()}{t.note ? ` · ${t.note}` : ""}</span></div>)}
        </section>
      </div>
    </ErpDrawer>
  );
}
