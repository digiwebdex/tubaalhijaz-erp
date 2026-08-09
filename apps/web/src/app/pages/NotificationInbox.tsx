import { useEffect, useState } from "react";
import { Inbox, RefreshCw, CheckCheck, Check, MessageCircle, Mail, Bell } from "lucide-react";
import { ERPShell, type NavItem, type IconFC } from "../components/ERPShell";
import { LoadingSkeleton, ErrorState, EmptyState } from "../components/States";
import { ErpPageTemplate, ErpButton, ErpStatusChip, erpToast, type ErpStatusKind } from "../components/erp";
import { api, isLoggedIn } from "../lib/api";
import { useLang } from "../lib/LangContext";
import { fontFor } from "@tuba/shared";

const IN = "#4338CA";
interface Item { id: string; code: string | null; channel: string; priority: string; title: string; body: string | null; status: string; readAt: string | null; createdAt: string; event?: { key: string; labelEn: string } | null }
const NAV: NavItem[] = [{ id: "inbox", label: "Inbox", labelBn: "ইনবক্স", icon: Inbox as IconFC }];
const chIcon = (c: string) => c === "WHATSAPP" ? MessageCircle : c === "EMAIL" ? Mail : Bell;
const prKind = (p: string): ErpStatusKind => (p === "EMERGENCY" ? "rejected" : p === "LOW" ? "info" : "pending");

export default function NotificationInbox() {
  const { lang } = useLang();
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState(false);
  const [unread, setUnread] = useState(0);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"all" | "unread">("all");

  const load = () => {
    if (!isLoggedIn()) return;
    api.get<Item[]>("/notifications?limit=50").then((d) => { setItems(d); setError(false); }).catch(() => { setItems([]); setError(true); });
    api.get<{ count: number }>("/notifications/unread-count").then((r) => setUnread(r.count)).catch(() => undefined);
  };
  useEffect(load, []);

  const markRead = async (it: Item) => {
    if (it.readAt) return;
    setItems((xs) => (xs ?? []).map((x) => x.id === it.id ? { ...x, readAt: new Date().toISOString() } : x));
    setUnread((u) => Math.max(0, u - 1));
    try { await api.patch(`/notifications/${it.id}/read`, {}); } catch { load(); }
  };
  const markAll = async () => {
    setBusy(true);
    try { await api.post("/notifications/read-all", {}); erpToast.success(lang === "bn" ? "সব পঠিত হিসেবে চিহ্নিত" : "All marked read", lang); load(); }
    catch { erpToast.error("Failed", lang); } finally { setBusy(false); }
  };

  const shown = (items ?? []).filter((i) => tab === "all" || !i.readAt);

  return (
    <ERPShell moduleId="admin" moduleName="Inbox" moduleColor={IN} moduleIcon={Inbox as IconFC}
      navItems={NAV} activeItem="inbox" onItemClick={() => undefined} breadcrumb={[lang === "bn" ? "নোটিফিকেশন" : "Notifications", lang === "bn" ? "ইনবক্স" : "Inbox"]} userName="Inbox" userRole="TUBA AL HIJAZ">
      <div className="flex-1 overflow-y-auto p-4 md:p-5" style={{ fontFamily: fontFor(lang) }}>
        <ErpPageTemplate title={lang === "bn" ? "নোটিফিকেশন ইনবক্স" : "Notification Inbox"} subtitle={lang === "bn" ? "আপনার এবং আপনার প্রতিষ্ঠানের বার্তা" : "Your and your organization's messages"}
          toolbar={<div className="flex items-center gap-2 w-full">
            <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: "rgba(11,30,63,0.15)" }} role="tablist">
              {(["all", "unread"] as const).map((t) => (
                <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
                  className="text-[11px] font-bold px-3 py-1.5" style={{ background: tab === t ? IN : "transparent", color: tab === t ? "var(--erp-surface)" : "rgba(11,30,63,0.6)" }}>
                  {t === "all" ? (lang === "bn" ? "সব" : "All") : `${lang === "bn" ? "অপঠিত" : "Unread"}${unread ? ` (${unread})` : ""}`}
                </button>
              ))}
            </div>
            <span style={{ flex: 1 }} />
            <ErpButton size="sm" variant="outline" icon={<CheckCheck size={13} />} onClick={markAll} disabled={busy || !unread}>{lang === "bn" ? "সব পঠিত" : "Mark all read"}</ErpButton>
            <ErpButton size="sm" variant="outline" icon={<RefreshCw size={13} />} onClick={load}>{lang === "bn" ? "রিফ্রেশ" : "Refresh"}</ErpButton>
          </div>}>
          {error ? <ErrorState tone="light" lang={lang} onRetry={load} /> : items === null ? <LoadingSkeleton />
            : shown.length === 0 ? <EmptyState tone="light" title={tab === "unread" ? (lang === "bn" ? "সব পঠিত" : "All caught up") : (lang === "bn" ? "কোনো বার্তা নেই" : "No messages")} hint={lang === "bn" ? "নতুন বার্তা এখানে আসবে" : "New notifications will appear here"} />
            : (
              <ul className="space-y-2" aria-label={lang === "bn" ? "বার্তা তালিকা" : "Notifications"}>
                {shown.map((it) => {
                  const Icon = chIcon(it.channel); const isUnread = !it.readAt;
                  return (
                    <li key={it.id}>
                      <button onClick={() => markRead(it)} className="w-full text-left rounded-xl p-3 flex gap-3 items-start transition"
                        style={{ background: isUnread ? `${IN}0A` : "var(--erp-surface)", border: `1px solid ${isUnread ? `${IN}33` : "rgba(11,30,63,0.1)"}` }}>
                        <span className="mt-0.5 shrink-0 rounded-lg p-1.5" style={{ background: `${IN}14`, color: IN }} aria-hidden="true"><Icon size={15} /></span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {isUnread && <span className="shrink-0 rounded-full" style={{ width: 7, height: 7, background: IN }} aria-label={lang === "bn" ? "অপঠিত" : "unread"} />}
                            <span className="text-xs font-bold truncate">{it.title}</span>
                            <ErpStatusChip status={prKind(it.priority)} label={it.priority} lang={lang} />
                          </div>
                          {it.body && <div className="text-[11px] mt-0.5" style={{ color: "rgba(11,30,63,0.7)" }}>{it.body}</div>}
                          <div className="text-[10px] mt-1 font-mono" style={{ color: "rgba(11,30,63,0.45)" }}>{it.channel} · {it.event?.labelEn || it.event?.key || "system"} · {new Date(it.createdAt).toLocaleString()}</div>
                        </div>
                        {isUnread ? <Check size={14} style={{ color: IN }} aria-hidden="true" /> : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
        </ErpPageTemplate>
      </div>
    </ERPShell>
  );
}
