import { useEffect, useState } from "react";
import { BellRing, RefreshCw, Download, RotateCw, CheckCircle2, XCircle, Clock, MailCheck } from "lucide-react";
import { ERPShell, type NavItem, type IconFC } from "../components/ERPShell";
import { LoadingSkeleton, ErrorState } from "../components/States";
import { ErpPageTemplate, ErpButton, ErpSearchBar, ErpDataTable, ErpSelect, ErpPagination, ErpStatusChip, erpToast, type ErpColumn, type ErpStatusKind } from "../components/erp";
import { api, isLoggedIn, getAccessToken } from "../lib/api";
import { useLang } from "../lib/LangContext";
import { fontFor } from "@tuba/shared";

const NC = "var(--erp-cat-purple)";
const CHANNELS = ["", "WHATSAPP", "EMAIL", "IN_APP"];
const STATUSES = ["", "PENDING", "DELIVERED", "READ", "FAILED"];
interface Row { id: string; code: string | null; channel: string; status: string; priority: string; recipientUserId: string | null; recipientAddress: string | null; title: string; providerId: string | null; attempts: number; sentAt: string | null; error: string | null; createdAt: string }
interface Resp { rows: Row[]; total: number; counts: Record<string, number> }
const NAV: NavItem[] = [{ id: "nc", label: "Notification Center", labelBn: "নোটিফিকেশন সেন্টার", icon: BellRing as IconFC }];
const stKind = (s: string): ErpStatusKind => ({ DELIVERED: "approved", READ: "completed", FAILED: "rejected", PENDING: "pending" }[s] as ErpStatusKind ?? "info");
const prKind = (p: string): ErpStatusKind => (p === "EMERGENCY" ? "rejected" : p === "LOW" ? "info" : "pending");

export default function NotificationCenter() {
  const { lang } = useLang();
  const [data, setData] = useState<Resp | null>(null);
  const [error, setError] = useState(false);
  const [q, setQ] = useState(""); const [channel, setChannel] = useState(""); const [status, setStatus] = useState("");
  const [page, setPage] = useState(1); const PAGE = 25;
  const [busy, setBusy] = useState(false);

  const qs = () => {
    const p = new URLSearchParams({ take: String(PAGE), skip: String((page - 1) * PAGE) });
    if (channel) p.set("channel", channel); if (status) p.set("status", status); if (q.trim()) p.set("q", q.trim());
    return p.toString();
  };
  const load = () => { if (!isLoggedIn()) return; api.get<Resp>(`/admin/notifications?${qs()}`).then((d) => { setData(d); setError(false); }).catch(() => { setData(null); setError(true); }); };
  useEffect(load, [page, channel, status]);

  const retry = async (id: string) => { setBusy(true); try { await api.post(`/admin/notifications/${id}/retry`, {}); erpToast.success(lang === "bn" ? "পুনরায় সারিবদ্ধ" : "Requeued", lang); load(); } catch { erpToast.error("Failed", lang); } finally { setBusy(false); } };
  const retryAll = async () => { setBusy(true); try { const r = await api.post<{ requeued: number }>("/admin/notifications/retry-all-failed", {}); erpToast.success(`${r.requeued} ${lang === "bn" ? "পুনরায় সারিবদ্ধ" : "requeued"}`, lang); load(); } catch { erpToast.error("Failed", lang); } finally { setBusy(false); } };
  const exportCsv = async () => {
    try {
      const tok = getAccessToken();
      const res = await fetch(`${api.baseUrl}/admin/notifications/export.csv?${qs()}`, { headers: tok ? { Authorization: `Bearer ${tok}` } : {}, credentials: "include" });
      const blob = await res.blob(); const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = "notifications.csv"; a.click(); URL.revokeObjectURL(a.href);
    } catch { erpToast.error(lang === "bn" ? "এক্সপোর্ট ব্যর্থ" : "Export failed", lang); }
  };

  const cards = [
    { key: "DELIVERED", label: lang === "bn" ? "ডেলিভার্ড" : "Delivered", color: "var(--erp-cat-teal)", icon: CheckCircle2 },
    { key: "READ", label: lang === "bn" ? "পঠিত" : "Read", color: "var(--erp-info)", icon: MailCheck },
    { key: "PENDING", label: lang === "bn" ? "বিচারাধীন" : "Pending", color: "var(--erp-warning)", icon: Clock },
    { key: "FAILED", label: lang === "bn" ? "ব্যর্থ" : "Failed", color: "var(--erp-destructive)", icon: XCircle },
  ];
  const columns: ErpColumn<Row>[] = [
    { id: "time", header: lang === "bn" ? "সময়" : "Time", cell: (r) => <span className="text-[11px]">{new Date(r.createdAt).toLocaleString()}</span> },
    { id: "channel", header: lang === "bn" ? "চ্যানেল" : "Channel", cell: (r) => <span className="text-[11px] font-semibold">{r.channel}</span> },
    { id: "status", header: lang === "bn" ? "স্ট্যাটাস" : "Status", cell: (r) => <ErpStatusChip status={stKind(r.status)} label={r.status} lang={lang} /> },
    { id: "pr", header: lang === "bn" ? "প্রায়োরিটি" : "Priority", cell: (r) => <ErpStatusChip status={prKind(r.priority)} label={r.priority} lang={lang} /> },
    { id: "to", header: lang === "bn" ? "প্রাপক" : "Recipient", cell: (r) => <span className="text-[11px] font-mono">{r.recipientAddress || r.recipientUserId || "—"}</span> },
    { id: "title", header: lang === "bn" ? "শিরোনাম" : "Title", cell: (r) => <span className="text-xs">{r.title}</span> },
    { id: "att", header: lang === "bn" ? "চেষ্টা" : "Attempts", align: "center", cell: (r) => <span className="font-mono">{r.attempts}</span> },
    { id: "act", header: "", align: "right", cell: (r) => r.status === "FAILED" ? <ErpButton size="sm" variant="outline" icon={<RotateCw size={12} />} onClick={() => retry(r.id)} disabled={busy}>{lang === "bn" ? "পুনরায়" : "Retry"}</ErpButton> : null },
  ];

  return (
    <ERPShell moduleId="admin" moduleName="Notification Center" moduleColor={NC} moduleIcon={BellRing as IconFC}
      navItems={NAV} activeItem="nc" onItemClick={() => undefined} breadcrumb={[lang === "bn" ? "প্রশাসন" : "Administration", lang === "bn" ? "নোটিফিকেশন সেন্টার" : "Notification Center"]} userName="Administration" userRole="TUBA AL HIJAZ">
      <div className="flex-1 overflow-y-auto p-4 md:p-5" style={{ fontFamily: fontFor(lang) }}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {cards.map((c) => (
            <div key={c.key} className="rounded-xl p-3" style={{ background: `${c.color}0D`, border: `1px solid ${c.color}22` }}>
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: c.color }}><c.icon size={13} aria-hidden="true" />{c.label}</div>
              <div className="text-2xl font-black mt-1" style={{ color: c.color, fontFamily: "var(--font-mono)" }}>{data?.counts?.[c.key] ?? "—"}</div>
            </div>
          ))}
        </div>
        <ErpPageTemplate title={lang === "bn" ? "নোটিফিকেশন সেন্টার" : "Notification Center"} subtitle={lang === "bn" ? "সব চ্যানেলের ডেলিভারি ইতিহাস" : "Delivery history across all channels"}
          toolbar={<div className="flex flex-col lg:flex-row gap-2 w-full">
            <div className="flex-1"><ErpSearchBar lang={lang} value={q} onChange={(e) => setQ(e.target.value)} onClear={() => { setQ(""); setPage(1); load(); }} placeholder={lang === "bn" ? "শিরোনাম, প্রাপক…" : "Title, recipient…"} /></div>
            <ErpSelect value={channel} onChange={(e) => { setChannel(e.target.value); setPage(1); }} aria-label="Channel">{CHANNELS.map((c) => <option key={c} value={c}>{c || (lang === "bn" ? "সব চ্যানেল" : "All channels")}</option>)}</ErpSelect>
            <ErpSelect value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Status">{STATUSES.map((s) => <option key={s} value={s}>{s || (lang === "bn" ? "সব স্ট্যাটাস" : "All statuses")}</option>)}</ErpSelect>
            <ErpButton size="sm" variant="outline" icon={<RefreshCw size={13} />} onClick={() => { setPage(1); load(); }}>{lang === "bn" ? "রিফ্রেশ" : "Refresh"}</ErpButton>
            <ErpButton size="sm" variant="outline" icon={<RotateCw size={13} />} onClick={retryAll} disabled={busy || !data?.counts?.FAILED}>{lang === "bn" ? "সব ব্যর্থ পুনরায়" : "Retry all failed"}</ErpButton>
            <ErpButton size="sm" variant="outline" icon={<Download size={13} />} onClick={exportCsv}>CSV</ErpButton>
          </div>}
          footer={data ? <ErpPagination page={page} pageSize={PAGE} total={data.total} onPageChange={setPage} lang={lang} /> : undefined}>
          {error ? <ErrorState tone="light" lang={lang} onRetry={load} /> : data === null ? <LoadingSkeleton />
            : <ErpDataTable columns={columns} rows={data.rows} rowKey={(r) => r.id} lang={lang} emptyTitle={lang === "bn" ? "কোনো নোটিফিকেশন নেই" : "No notifications"} />}
        </ErpPageTemplate>
      </div>
    </ERPShell>
  );
}
