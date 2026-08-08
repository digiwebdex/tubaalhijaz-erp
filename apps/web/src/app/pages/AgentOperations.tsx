import { useEffect, useMemo, useState } from "react";
import { UserCog, Play, RefreshCw, ShieldAlert } from "lucide-react";
import { ERPShell, type NavItem, type IconFC } from "../components/ERPShell";
import { EmptyState, LoadingSkeleton, ErrorState } from "../components/States";
import { ErpPageTemplate, ErpButton, ErpSearchBar, ErpDataTable, ErpDrawer, ErpDrawerFooterActions, ErpForm, ErpField, ErpSelect, ErpTextarea, ErpStatusChip, erpToast, type ErpColumn, type ErpStatusKind } from "../components/erp";
import { ERP, CAT, erpAlpha, ErpThemeProvider } from "../components/erp";
import { api, ApiError, isLoggedIn } from "../lib/api";
import { useLang } from "../lib/LangContext";
import { fontFor } from "@tuba/shared";

const ADMIN = CAT.purple;
const REASONS = ["Customer Support", "Emergency", "Data Correction", "Training", "Management Request", "Other"];

interface Agent { id: string; code?: string | null; name: string; email: string; phone?: string | null; status: string; company?: { id: string; name: string } | null }
const NAV: NavItem[] = [{ id: "agent-ops", label: "Agent Operations", labelBn: "এজেন্ট অপারেশনস", icon: UserCog as IconFC }];
const kind = (s: string): ErpStatusKind => (s === "ACTIVE" ? "approved" : s === "INACTIVE" ? "cancelled" : "pending");

export default function AgentOperations() {
  const { lang } = useLang();
  const [rows, setRows] = useState<Agent[] | null>(null);
  const [error, setError] = useState(false);
  const [q, setQ] = useState("");
  const [target, setTarget] = useState<Agent | null>(null);
  const [reason, setReason] = useState(REASONS[0]);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => {
    if (!isLoggedIn()) return;
    api.get<Agent[]>("/admin/agents").then((d) => { setRows(d); setError(false); }).catch(() => { setRows([]); setError(true); });
  };
  useEffect(load, []);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (rows ?? []).filter((a) => !s || [a.name, a.email, a.phone, a.code, a.company?.name].join(" ").toLowerCase().includes(s));
  }, [rows, q]);

  const startImpersonation = async () => {
    if (!target) return;
    const finalReason = reason === "Other" ? comment.trim() : reason;
    if (reason === "Other" && !finalReason) { erpToast.error(lang === "bn" ? "কারণ লিখুন" : "A comment is required for “Other”", lang); return; }
    setBusy(true);
    try {
      const res = await api.post<{ accessToken: string; session: { agent: { id: string; email: string; name: string } } }>("/admin/impersonation/start", { agentUserId: target.id, reason: finalReason });
      // preserve the admin session, swap to the impersonation token
      sessionStorage.setItem("tuba_admin_at", sessionStorage.getItem("tuba_at") ?? "");
      sessionStorage.setItem("tuba_admin_user", sessionStorage.getItem("tuba_user") ?? "");
      sessionStorage.setItem("tuba_at", res.accessToken);
      // Hydrate the FULL agent user (the impersonation token's identity) so routing/RBAC behave exactly as the agent.
      const API_BASE = (import.meta as { env?: Record<string, string> }).env?.VITE_API_URL ?? "http://127.0.0.1:3210";
      try {
        const me = await fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${res.accessToken}` }, credentials: "include" }).then((r) => r.json());
        sessionStorage.setItem("tuba_user", JSON.stringify(me));
      } catch {
        sessionStorage.setItem("tuba_user", JSON.stringify({ id: target.id, email: target.email, name: target.name, role: "AGENT", companyId: target.company?.id ?? null, companyType: "AGENT" }));
      }
      window.location.href = "/agent-portal"; // reload so the banner + agent context mount fresh
    } catch (e) { erpToast.error(e instanceof ApiError ? e.message : "Failed to start", lang); setBusy(false); }
  };

  const columns: ErpColumn<Agent>[] = [
    { id: "code", header: lang === "bn" ? "কোড" : "Code", cell: (a) => <span className="text-[11px] font-mono" style={{ color: ADMIN }}>{a.code || "—"}</span> },
    { id: "name", header: lang === "bn" ? "নাম" : "Name", cell: (a) => <span className="text-xs font-semibold">{a.name}</span> },
    { id: "email", header: "Email", cell: (a) => <span className="text-[11px]">{a.email}</span> },
    { id: "phone", header: lang === "bn" ? "মোবাইল" : "Mobile", cell: (a) => <span className="text-[11px] font-mono">{a.phone || "—"}</span> },
    { id: "company", header: lang === "bn" ? "কোম্পানি" : "Company", cell: (a) => a.company?.name || "—" },
    { id: "status", header: lang === "bn" ? "স্ট্যাটাস" : "Status", cell: (a) => <ErpStatusChip status={kind(a.status)} label={a.status} lang={lang} /> },
    { id: "act", header: "", align: "right", cell: (a) => (
      <ErpButton size="sm" variant="primary" icon={<Play size={12} />} disabled={a.status !== "ACTIVE"} onClick={(e) => { e.stopPropagation(); setTarget(a); setReason(REASONS[0]); setComment(""); }}>
        {lang === "bn" ? "ইমপারসোনেট" : "Impersonate"}
      </ErpButton>
    ) },
  ];

  return (
    <ErpThemeProvider theme="ds"><ERPShell moduleId="admin" moduleName="Agent Operations" moduleColor={ADMIN} moduleIcon={UserCog as IconFC}
      navItems={NAV} activeItem="agent-ops" onItemClick={() => undefined} breadcrumb={[lang === "bn" ? "প্রশাসন" : "Administration", lang === "bn" ? "এজেন্ট অপারেশনস" : "Agent Operations"]}
      userName="Administration" userRole="TUBA AL HIJAZ">
      <div className="flex-1 overflow-y-auto p-4 md:p-5" style={{ fontFamily: fontFor(lang) }}>
        <div className="mb-3 flex items-start gap-2 text-[11px] rounded-lg p-2.5" style={{ background: "erpAlpha(CAT.purple, 6)", border: "1px solid erpAlpha(CAT.purple, 18)", color: CAT.purple }}>
          <ShieldAlert size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{lang === "bn" ? "নিরাপদ ইমপারসোনেশন — আপনি প্রকৃত ব্যবহারকারী থাকবেন (অ্যাডমিন)। প্রতিটি কাজ অডিটে রেকর্ড হয়। ৩০ মিনিট পর সেশন শেষ হয়।" : "Secure impersonation — you remain the actual user (Admin). Every action is audited. Sessions auto-expire after 30 minutes."}</span>
        </div>
        <ErpPageTemplate title={lang === "bn" ? "এজেন্ট অপারেশনস" : "Agent Operations"} subtitle={lang === "bn" ? "একটি এজেন্টের ওয়ার্কস্পেসে নিরাপদে প্রবেশ করুন" : "Securely enter an agent's workspace (impersonation)"}
          toolbar={<div className="flex gap-3 w-full">
            <div className="flex-1"><ErpSearchBar lang={lang} value={q} onChange={(e) => setQ(e.target.value)} onClear={() => setQ("")} placeholder={lang === "bn" ? "নাম, ইমেইল, মোবাইল, কোড…" : "Name, email, mobile, code, company…"} /></div>
            <ErpButton size="sm" variant="outline" icon={<RefreshCw size={13} />} onClick={load}>{lang === "bn" ? "রিফ্রেশ" : "Refresh"}</ErpButton>
          </div>}>
          {error ? <ErrorState tone="light" lang={lang} onRetry={load} /> : rows === null ? <LoadingSkeleton />
            : shown.length === 0 ? <EmptyState tone="light" title={lang === "bn" ? "কোনো এজেন্ট নেই" : "No agents"} hint={lang === "bn" ? "অনুসন্ধান পরিবর্তন করুন" : "Adjust your search"} />
            : <ErpDataTable columns={columns} rows={shown} rowKey={(a) => a.id} lang={lang} emptyTitle="" />}
        </ErpPageTemplate>
      </div>

      {target && (
        <ErpDrawer open onClose={() => setTarget(null)} lang={lang} title={lang === "bn" ? "ইমপারসোনেশন শুরু" : "Start Impersonation"} subtitle={`${target.name} · ${target.email}`}
          footer={<ErpDrawerFooterActions lang={lang} onCancel={() => setTarget(null)} onSave={startImpersonation} saving={busy} saveLabel={lang === "bn" ? "শুরু করুন" : "Start Session"} />}>
          <ErpForm columns={1}>
            <ErpField label={lang === "bn" ? "কারণ (আবশ্যক)" : "Reason (required)"}>
              <ErpSelect value={reason} onChange={(e) => setReason(e.target.value)}>{REASONS.map((r) => <option key={r} value={r}>{r}</option>)}</ErpSelect>
            </ErpField>
            {reason === "Other" && (
              <ErpField label={lang === "bn" ? "মন্তব্য (আবশ্যক)" : "Comment (required)"}>
                <ErpTextarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} placeholder={lang === "bn" ? "কারণ ব্যাখ্যা করুন…" : "Explain the reason…"} />
              </ErpField>
            )}
            <p className="text-[11px]" style={{ color: ERP.muted }}>
              {lang === "bn" ? "শুরু করলে আপনি এজেন্ট হিসেবে কাজ করবেন; একটি স্থায়ী ব্যানার দেখাবে এবং সব কাজ অডিটে রেকর্ড হবে (আসল অ্যাডমিন = আপনি)।" : "Starting will switch your working context to this agent. A persistent banner will show, and every action is recorded in the audit trail as Actual Admin = you."}
            </p>
          </ErpForm>
        </ErpDrawer>
      )}
    </ERPShell></ErpThemeProvider>
  );
}
