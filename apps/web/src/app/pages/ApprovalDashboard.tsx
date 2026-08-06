import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, XCircle, CornerUpLeft, Lock, Unlock, Eye, RefreshCw, ShieldCheck, Layers, GitCompare } from "lucide-react";
import { ERPShell, type NavItem, type IconFC } from "../components/ERPShell";
import { LoadingSkeleton, ErrorState, EmptyState } from "../components/States";
import { ErpPageTemplate, ErpButton, ErpSearchBar, ErpDataTable, ErpDrawer, ErpDrawerFooterActions, ErpForm, ErpField, ErpSelect, ErpTextarea, ErpStatusChip, erpToast, type ErpColumn, type ErpStatusKind } from "../components/erp";
import { api, ApiError, isLoggedIn } from "../lib/api";
import { useLang } from "../lib/LangContext";
import { fontFor } from "@tuba/shared";

const APR = "#0D9488";
interface Group { id: string; code: string; name: string; approvalStatus: string; locked: boolean; lockType: string | null; paxCount: number; tenant?: { name: string } | null }
interface Sig { id: string; level: number; approverUserId: string; signatureHash: string; reason: string | null; createdAt: string }
interface Version { id: string; version: number; changedByUserId: string | null; reason: string | null; createdAt: string }
interface CR { id: string; description: string; field: string | null; status: string; createdAt: string }
interface TL { id: string; event: string; actorLabel: string | null; note: string | null; createdAt: string }
const NAV: NavItem[] = [{ id: "approvals", label: "Approvals", labelBn: "অনুমোদন", icon: ShieldCheck as IconFC }];
const stKind = (s: string): ErpStatusKind => ({ APPROVED: "approved", REJECTED: "rejected", PENDING_APPROVAL: "pending", RETURNED: "warning", DRAFT: "info", SUBMITTED: "info", COMPLETED: "completed", ARCHIVED: "cancelled", LOCKED: "approved" }[s] as ErpStatusKind ?? "info");

export default function ApprovalDashboard() {
  const { lang } = useLang();
  const [rows, setRows] = useState<Group[] | null>(null);
  const [error, setError] = useState(false);
  const [q, setQ] = useState(""); const [filter, setFilter] = useState("PENDING_APPROVAL");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reasonFor, setReasonFor] = useState<{ g: Group; kind: "reject" | "return" | "unlock" } | null>(null);
  const [reason, setReason] = useState(""); const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<Group | null>(null);

  const load = () => { if (!isLoggedIn()) return; api.get<Group[]>("/groups").then((d) => { setRows(d); setError(false); }).catch(() => { setRows([]); setError(true); }); };
  useEffect(load, []);
  const shown = useMemo(() => (rows ?? []).filter((g) => (filter === "ALL" || g.approvalStatus === filter || (filter === "LOCKED" && g.locked)) && (!q.trim() || [g.code, g.name, g.tenant?.name].join(" ").toLowerCase().includes(q.toLowerCase()))), [rows, filter, q]);
  const pendingSelected = shown.filter((g) => selected.has(g.id) && g.approvalStatus === "PENDING_APPROVAL").map((g) => g.id);

  const act = async (fn: () => Promise<unknown>, ok: string) => { setBusy(true); try { await fn(); erpToast.success(ok, lang); setReasonFor(null); setReason(""); load(); } catch (e) { erpToast.error(e instanceof ApiError ? e.message : "Failed", lang); } finally { setBusy(false); } };
  const approve = (g: Group) => act(() => api.post(`/groups/${g.id}/approve`, {}), lang === "bn" ? "অনুমোদিত" : "Approved");
  const finalize = (g: Group) => act(() => api.post(`/groups/${g.id}/finalize`, {}), lang === "bn" ? "চূড়ান্ত (হার্ড লক)" : "Finalized (hard lock)");
  const submitReason = () => { if (!reasonFor) return; const { g, kind } = reasonFor; if (!reason.trim()) { erpToast.error(lang === "bn" ? "কারণ দিন" : "Reason required", lang); return; } act(() => api.post(`/groups/${g.id}/${kind}`, { reason }), lang === "bn" ? "সম্পন্ন" : "Done"); };
  const bulkApprove = () => act(() => api.post("/groups/bulk-approve", { ids: pendingSelected }), `${pendingSelected.length} ${lang === "bn" ? "অনুমোদিত" : "approved"}`).then(() => setSelected(new Set()));

  const columns: ErpColumn<Group>[] = [
    { id: "code", header: lang === "bn" ? "কোড" : "Code", cell: (g) => <span className="text-[11px] font-mono" style={{ color: APR }}>{g.code}</span> },
    { id: "name", header: lang === "bn" ? "গ্রুপ" : "Group", cell: (g) => <span className="text-xs font-semibold">{g.name}</span> },
    { id: "tenant", header: lang === "bn" ? "এজেন্সি" : "Agency", cell: (g) => g.tenant?.name || "—" },
    { id: "pax", header: "Pax", align: "center", cell: (g) => <span className="font-mono">{g.paxCount}</span> },
    { id: "st", header: lang === "bn" ? "স্ট্যাটাস" : "Status", cell: (g) => <ErpStatusChip status={stKind(g.approvalStatus)} label={g.approvalStatus} lang={lang} /> },
    { id: "lock", header: lang === "bn" ? "লক" : "Lock", align: "center", cell: (g) => g.locked ? <span className="inline-flex items-center gap-1 text-[10px] font-bold" style={{ color: g.lockType === "HARD" ? "#B91C1C" : "#B45309" }}><Lock size={11} />{g.lockType || "SOFT"}</span> : "—" },
    { id: "act", header: "", align: "right", cell: (g) => (
      <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
        {g.approvalStatus === "PENDING_APPROVAL" && <>
          <ErpButton size="sm" variant="primary" icon={<CheckCircle2 size={12} />} onClick={() => approve(g)}>{lang === "bn" ? "অনুমোদন" : "Approve"}</ErpButton>
          <ErpButton size="sm" variant="outline" icon={<CornerUpLeft size={12} />} onClick={() => { setReasonFor({ g, kind: "return" }); setReason(""); }}>{lang === "bn" ? "ফেরত" : "Return"}</ErpButton>
          <ErpButton size="sm" variant="danger" icon={<XCircle size={12} />} onClick={() => { setReasonFor({ g, kind: "reject" }); setReason(""); }} />
        </>}
        {g.approvalStatus === "APPROVED" && <ErpButton size="sm" variant="outline" icon={<Lock size={12} />} onClick={() => finalize(g)}>{lang === "bn" ? "চূড়ান্ত" : "Finalize"}</ErpButton>}
        {g.locked && <ErpButton size="sm" variant="outline" icon={<Unlock size={12} />} onClick={() => { setReasonFor({ g, kind: "unlock" }); setReason(""); }}>{lang === "bn" ? "আনলক" : "Unlock"}</ErpButton>}
        <ErpButton size="sm" variant="outline" icon={<Eye size={12} />} onClick={() => setDetail(g)}>{lang === "bn" ? "বিস্তারিত" : "View"}</ErpButton>
      </div>
    ) },
  ];

  return (
    <ERPShell moduleId="admin" moduleName="Approvals" moduleColor={APR} moduleIcon={ShieldCheck as IconFC}
      navItems={NAV} activeItem="approvals" onItemClick={() => undefined} breadcrumb={[lang === "bn" ? "প্রশাসন" : "Administration", lang === "bn" ? "অনুমোদন" : "Approvals"]} userName="Administration" userRole="TUBA AL HIJAZ">
      <div className="flex-1 overflow-y-auto p-4 md:p-5" style={{ fontFamily: fontFor(lang) }}>
        <ErpPageTemplate title={lang === "bn" ? "অনুমোদন ড্যাশবোর্ড" : "Approval Dashboard"} subtitle={lang === "bn" ? "গ্রুপ অনুমোদন, লক ও সংস্করণ" : "Group approval, locking & versioning"}
          toolbar={<div className="flex flex-col lg:flex-row gap-2 w-full">
            <div className="flex-1"><ErpSearchBar lang={lang} value={q} onChange={(e) => setQ(e.target.value)} onClear={() => setQ("")} placeholder={lang === "bn" ? "গ্রুপ, কোড, এজেন্সি…" : "Group, code, agency…"} /></div>
            <ErpSelect value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter by status">
              {["PENDING_APPROVAL", "APPROVED", "LOCKED", "RETURNED", "REJECTED", "COMPLETED", "ALL"].map((s) => <option key={s} value={s}>{s}</option>)}
            </ErpSelect>
            {pendingSelected.length > 0 && <ErpButton size="sm" variant="primary" icon={<CheckCircle2 size={14} />} onClick={bulkApprove}>{lang === "bn" ? "বাল্ক অনুমোদন" : "Bulk Approve"} ({pendingSelected.length})</ErpButton>}
            <ErpButton size="sm" variant="outline" icon={<RefreshCw size={13} />} onClick={load}>{lang === "bn" ? "রিফ্রেশ" : "Refresh"}</ErpButton>
          </div>}>
          {error ? <ErrorState tone="light" lang={lang} onRetry={load} /> : rows === null ? <LoadingSkeleton />
            : shown.length === 0 ? <EmptyState tone="light" title={lang === "bn" ? "কিছু নেই" : "Nothing here"} hint={lang === "bn" ? "ফিল্টার পরিবর্তন করুন" : "Change the filter"} />
            : <ErpDataTable columns={columns} rows={shown} rowKey={(g) => g.id} lang={lang} selectable selectedKeys={selected} onSelectedKeysChange={setSelected} emptyTitle="" />}
        </ErpPageTemplate>
      </div>

      {reasonFor && (
        <ErpDrawer open onClose={() => setReasonFor(null)} lang={lang} title={{ reject: lang === "bn" ? "প্রত্যাখ্যান" : "Reject", return: lang === "bn" ? "সংশোধনের জন্য ফেরত" : "Return for Correction", unlock: lang === "bn" ? "আনলক" : "Unlock" }[reasonFor.kind]} subtitle={`${reasonFor.g.code} · ${reasonFor.g.name}`}
          footer={<ErpDrawerFooterActions lang={lang} onCancel={() => setReasonFor(null)} onSave={submitReason} saving={busy} saveLabel={lang === "bn" ? "নিশ্চিত" : "Confirm"} />}>
          <ErpForm columns={1}><ErpField label={lang === "bn" ? "কারণ (আবশ্যক)" : "Reason (required)"}><ErpTextarea value={reason} onChange={(e) => setReason(e.target.value)} rows={4} /></ErpField></ErpForm>
        </ErpDrawer>
      )}
      {detail && <DetailDrawer group={detail} onClose={() => setDetail(null)} lang={lang} onChanged={load} />}
    </ERPShell>
  );
}

function DetailDrawer({ group, onClose, lang, onChanged }: { group: Group; onClose: () => void; lang: "bn" | "en"; onChanged: () => void }) {
  const [sigs, setSigs] = useState<Sig[]>([]); const [versions, setVersions] = useState<Version[]>([]); const [crs, setCrs] = useState<CR[]>([]); const [tl, setTl] = useState<TL[]>([]);
  const [diffA, setDiffA] = useState<number | "">(""); const [diffB, setDiffB] = useState<number | "">(""); const [diff, setDiff] = useState<{ changed: string[]; diff: Record<string, { from: unknown; to: unknown }> } | null>(null);
  const reload = () => {
    api.get<Sig[]>(`/groups/${group.id}/approvals`).then(setSigs).catch(() => setSigs([]));
    api.get<Version[]>(`/groups/${group.id}/versions`).then(setVersions).catch(() => setVersions([]));
    api.get<CR[]>(`/groups/${group.id}/change-requests`).then(setCrs).catch(() => setCrs([]));
    api.get<TL[]>(`/groups/${group.id}/timeline`).then(setTl).catch(() => setTl([]));
  };
  useEffect(reload, [group.id]);
  const runDiff = () => { if (diffA === "" || diffB === "") return; api.get<typeof diff>(`/groups/${group.id}/versions/${diffA}/diff/${diffB}`).then(setDiff).catch(() => setDiff(null)); };
  const decideCr = (id: string, decision: "approve" | "reject") => api.post(`/change-requests/${id}/${decision}`, { reason: decision === "reject" ? "reviewed" : "ok" }).then(() => { reload(); onChanged(); erpToast.success(lang === "bn" ? "সম্পন্ন" : "Done", lang); }).catch(() => erpToast.error("Failed", lang));

  return (
    <ErpDrawer open onClose={onClose} lang={lang} title={lang === "bn" ? "গ্রুপ বিস্তারিত" : "Group Detail"} subtitle={`${group.code} · ${group.name}`}>
      <div className="space-y-5 text-[11px]" style={{ fontFamily: fontFor(lang) }}>
        <section>
          <h4 className="text-[11px] font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1" style={{ color: APR }}><ShieldCheck size={12} />{lang === "bn" ? "ডিজিটাল স্বাক্ষর" : "Digital Signatures"}</h4>
          {sigs.length === 0 ? <p style={{ color: "rgba(11,30,63,0.5)" }}>{lang === "bn" ? "কোনো স্বাক্ষর নেই" : "No signatures yet"}</p> : sigs.map((s) => <div key={s.id} className="border rounded px-2 py-1 mb-1 font-mono" style={{ borderColor: "rgba(11,30,63,0.12)" }}>L{s.level} · {new Date(s.createdAt).toLocaleString()} · <span title={s.signatureHash}>{s.signatureHash.slice(0, 16)}…</span></div>)}
        </section>
        <section>
          <h4 className="text-[11px] font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1" style={{ color: APR }}><Layers size={12} />{lang === "bn" ? "সংস্করণ" : "Versions"}</h4>
          {versions.map((v) => <div key={v.id} className="border rounded px-2 py-1 mb-1" style={{ borderColor: "rgba(11,30,63,0.12)" }}>v{v.version} · {new Date(v.createdAt).toLocaleString()} · {v.reason}</div>)}
          {versions.length >= 2 && <div className="flex gap-1.5 items-center mt-1.5">
            <GitCompare size={13} style={{ color: APR }} />
            <ErpSelect value={String(diffA)} onChange={(e) => setDiffA(e.target.value ? +e.target.value : "")} aria-label="Version A"><option value="">v…</option>{versions.map((v) => <option key={v.id} value={v.version}>v{v.version}</option>)}</ErpSelect>
            <span>→</span>
            <ErpSelect value={String(diffB)} onChange={(e) => setDiffB(e.target.value ? +e.target.value : "")} aria-label="Version B"><option value="">v…</option>{versions.map((v) => <option key={v.id} value={v.version}>v{v.version}</option>)}</ErpSelect>
            <ErpButton size="sm" variant="outline" onClick={runDiff}>{lang === "bn" ? "তুলনা" : "Compare"}</ErpButton>
          </div>}
          {diff && <pre className="rounded p-2 mt-1.5 overflow-x-auto" style={{ background: "#F5F7FA", maxHeight: 160 }}>{diff.changed.length ? JSON.stringify(diff.diff, null, 2) : (lang === "bn" ? "কোনো পরিবর্তন নেই" : "No differences")}</pre>}
        </section>
        <section>
          <h4 className="text-[11px] font-bold uppercase tracking-widest mb-1.5" style={{ color: APR }}>{lang === "bn" ? "পরিবর্তন অনুরোধ" : "Change Requests"}</h4>
          {crs.length === 0 ? <p style={{ color: "rgba(11,30,63,0.5)" }}>{lang === "bn" ? "কোনো অনুরোধ নেই" : "None"}</p> : crs.map((c) => <div key={c.id} className="border rounded px-2 py-1.5 mb-1 flex items-center justify-between" style={{ borderColor: "rgba(11,30,63,0.12)" }}>
            <span>{c.description} <ErpStatusChip status={stKind(c.status)} label={c.status} lang={lang} /></span>
            {c.status === "PENDING" && <span className="flex gap-1"><ErpButton size="sm" variant="primary" onClick={() => decideCr(c.id, "approve")}>{lang === "bn" ? "অনুমোদন" : "Approve"}</ErpButton><ErpButton size="sm" variant="danger" onClick={() => decideCr(c.id, "reject")}>✕</ErpButton></span>}
          </div>)}
        </section>
        <section>
          <h4 className="text-[11px] font-bold uppercase tracking-widest mb-1.5" style={{ color: APR }}>{lang === "bn" ? "টাইমলাইন" : "Timeline"}</h4>
          {tl.map((t) => <div key={t.id} className="flex gap-2 mb-1"><span className="font-mono" style={{ color: APR }}>{t.event}</span><span style={{ color: "rgba(11,30,63,0.6)" }}>{t.actorLabel} · {new Date(t.createdAt).toLocaleString()}{t.note ? ` · ${t.note}` : ""}</span></div>)}
        </section>
      </div>
    </ErpDrawer>
  );
}
