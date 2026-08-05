import { useEffect, useMemo, useState } from "react";
import { FileText, RefreshCw, Pencil, Send, Check, X } from "lucide-react";
import { ERPShell, type NavItem, type IconFC } from "../components/ERPShell";
import { LoadingSkeleton, ErrorState, EmptyState } from "../components/States";
import { ErpPageTemplate, ErpButton, ErpSearchBar, ErpDataTable, ErpDrawer, ErpDrawerFooterActions, ErpForm, ErpField, ErpInput, ErpTextarea, ErpSelect, erpToast, type ErpColumn } from "../components/erp";
import { api, ApiError, isLoggedIn } from "../lib/api";
import { useLang } from "../lib/LangContext";
import { fontFor } from "@tuba/shared";

const TM = "#0F766E";
const CHANNELS = ["WHATSAPP", "EMAIL", "IN_APP"] as const;
const LANGS = ["bn", "en"] as const;
type Channel = typeof CHANNELS[number];
interface Ev { id: string; key: string; labelEn: string; labelBn: string; priority: string; whatsapp: boolean; email: boolean; inApp: boolean; _count: { templates: number; logs: number } }
interface Tpl { id: string; channel: string; lang: string; subject: string | null; body: string; event: { key: string } }
const NAV: NavItem[] = [{ id: "tm", label: "Template Manager", labelBn: "টেমপ্লেট ম্যানেজার", icon: FileText as IconFC }];
const CHFLAG: Record<Channel, keyof Ev> = { WHATSAPP: "whatsapp", EMAIL: "email", IN_APP: "inApp" };

export default function TemplateManager() {
  const { lang } = useLang();
  const [events, setEvents] = useState<Ev[] | null>(null);
  const [error, setError] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState<Ev | null>(null);
  const [tpls, setTpls] = useState<Tpl[] | null>(null);
  const [edit, setEdit] = useState<{ channel: Channel; lang: string; subject: string; body: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [test, setTest] = useState<{ eventKey: string; phone: string; email: string } | null>(null);

  const loadEvents = () => { if (!isLoggedIn()) return; api.get<Ev[]>("/notifications/events").then((d) => { setEvents(d); setError(false); }).catch(() => { setEvents([]); setError(true); }); };
  useEffect(loadEvents, []);
  const openEvent = (ev: Ev) => { setActive(ev); setTpls(null); api.get<Tpl[]>(`/notifications/templates?eventKey=${encodeURIComponent(ev.key)}`).then(setTpls).catch(() => setTpls([])); };
  const shown = useMemo(() => (events ?? []).filter((e) => { const s = q.trim().toLowerCase(); return !s || [e.key, e.labelEn, e.labelBn].join(" ").toLowerCase().includes(s); }), [events, q]);

  const toggleChannel = async (ev: Ev, ch: Channel) => {
    const flag = CHFLAG[ch]; const next = !ev[flag];
    setEvents((es) => (es ?? []).map((e) => e.id === ev.id ? { ...e, [flag]: next } : e));
    try { await api.patch(`/notifications/events/${ev.key}`, { [ch === "WHATSAPP" ? "whatsapp" : ch === "EMAIL" ? "email" : "inApp"]: next }); }
    catch { erpToast.error("Failed", lang); loadEvents(); }
  };
  const saveTpl = async () => {
    if (!active || !edit) return;
    if (!edit.body.trim()) { erpToast.error(lang === "bn" ? "বডি আবশ্যক" : "Body is required", lang); return; }
    setBusy(true);
    try {
      await api.put("/notifications/templates", { eventKey: active.key, channel: edit.channel, lang: edit.lang, subject: edit.subject.trim() || undefined, body: edit.body });
      erpToast.success(lang === "bn" ? "সংরক্ষিত" : "Saved", lang); setEdit(null); openEvent(active); loadEvents();
    } catch (e) { erpToast.error(e instanceof ApiError ? e.message : "Failed", lang); } finally { setBusy(false); }
  };
  const sendTest = async () => {
    if (!test) return; setBusy(true);
    try {
      const r = await api.post<{ queued: boolean }>("/notifications/test", { eventKey: test.eventKey, phone: test.phone.trim() || undefined, email: test.email.trim() || undefined });
      erpToast.success(r.queued ? (lang === "bn" ? "পরীক্ষা পাঠানো হয়েছে" : "Test dispatched") : "Sent", lang); setTest(null);
    } catch (e) { erpToast.error(e instanceof ApiError ? e.message : "Failed", lang); } finally { setBusy(false); }
  };

  const ChBtn = ({ ev, ch }: { ev: Ev; ch: Channel }) => {
    const on = !!ev[CHFLAG[ch]];
    return <button onClick={(e) => { e.stopPropagation(); toggleChannel(ev, ch); }} aria-pressed={on} aria-label={`${ch} ${on ? "on" : "off"}`}
      className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: on ? `${TM}18` : "rgba(11,30,63,0.05)", color: on ? TM : "rgba(11,30,63,0.4)", border: `1px solid ${on ? `${TM}44` : "transparent"}` }}>
      {on ? <Check size={10} /> : <X size={10} />}{ch === "IN_APP" ? "APP" : ch.slice(0, 2)}</button>;
  };
  const columns: ErpColumn<Ev>[] = [
    { id: "key", header: lang === "bn" ? "ইভেন্ট" : "Event", cell: (e) => <div><div className="text-xs font-semibold">{lang === "bn" ? e.labelBn : e.labelEn}</div><div className="text-[10px] font-mono" style={{ color: "rgba(11,30,63,0.5)" }}>{e.key}</div></div> },
    { id: "ch", header: lang === "bn" ? "চ্যানেল" : "Channels", cell: (e) => <div className="flex gap-1">{CHANNELS.map((c) => <ChBtn key={c} ev={e} ch={c} />)}</div> },
    { id: "pr", header: lang === "bn" ? "প্রায়োরিটি" : "Priority", cell: (e) => <span className="text-[11px] font-mono">{e.priority}</span> },
    { id: "tpl", header: lang === "bn" ? "টেমপ্লেট" : "Templates", align: "center", cell: (e) => <span className="font-mono">{e._count.templates}</span> },
    { id: "act", header: "", align: "right", cell: (e) => (
      <div className="flex gap-1 justify-end" onClick={(ev) => ev.stopPropagation()}>
        <ErpButton size="sm" variant="outline" icon={<Pencil size={12} />} onClick={() => openEvent(e)}>{lang === "bn" ? "টেমপ্লেট" : "Templates"}</ErpButton>
        <ErpButton size="sm" variant="ghost" icon={<Send size={12} />} onClick={() => setTest({ eventKey: e.key, phone: "", email: "" })}>{lang === "bn" ? "পরীক্ষা" : "Test"}</ErpButton>
      </div>
    ) },
  ];

  return (
    <ERPShell moduleId="admin" moduleName="Template Manager" moduleColor={TM} moduleIcon={FileText as IconFC}
      navItems={NAV} activeItem="tm" onItemClick={() => undefined} breadcrumb={[lang === "bn" ? "প্রশাসন" : "Administration", lang === "bn" ? "টেমপ্লেট ম্যানেজার" : "Template Manager"]} userName="Administration" userRole="TUBA AL HIJAZ">
      <div className="flex-1 overflow-y-auto p-4 md:p-5" style={{ fontFamily: fontFor(lang) }}>
        <ErpPageTemplate title={lang === "bn" ? "টেমপ্লেট ম্যানেজার" : "Template Manager"} subtitle={lang === "bn" ? "ইভেন্ট চ্যানেল ম্যাট্রিক্স ও বার্তা টেমপ্লেট" : "Event channel matrix & message templates"}
          toolbar={<div className="flex gap-3 w-full">
            <div className="flex-1"><ErpSearchBar lang={lang} value={q} onChange={(e) => setQ(e.target.value)} onClear={() => setQ("")} placeholder={lang === "bn" ? "ইভেন্ট খুঁজুন…" : "Search events…"} /></div>
            <ErpButton size="sm" variant="outline" icon={<RefreshCw size={13} />} onClick={loadEvents}>{lang === "bn" ? "রিফ্রেশ" : "Refresh"}</ErpButton>
          </div>}>
          {error ? <ErrorState tone="light" lang={lang} onRetry={loadEvents} /> : events === null ? <LoadingSkeleton />
            : shown.length === 0 ? <EmptyState tone="light" title={lang === "bn" ? "কোনো ইভেন্ট নেই" : "No events"} hint={lang === "bn" ? "অনুসন্ধান পরিবর্তন করুন" : "Adjust your search"} />
            : <ErpDataTable columns={columns} rows={shown} rowKey={(e) => e.id} lang={lang} emptyTitle="" />}
        </ErpPageTemplate>
      </div>

      {/* Templates drawer for the active event */}
      {active && (
        <ErpDrawer open onClose={() => { setActive(null); setEdit(null); }} lang={lang} title={lang === "bn" ? "টেমপ্লেট" : "Templates"} subtitle={`${lang === "bn" ? active.labelBn : active.labelEn} · ${active.key}`}
          footer={edit ? <ErpDrawerFooterActions lang={lang} onCancel={() => setEdit(null)} onSave={saveTpl} saving={busy} saveLabel={lang === "bn" ? "সংরক্ষণ" : "Save template"} /> : undefined}>
          {edit ? (
            <ErpForm columns={1}>
              <div className="grid grid-cols-2 gap-2">
                <ErpField label={lang === "bn" ? "চ্যানেল" : "Channel"}><ErpSelect value={edit.channel} onChange={(e) => setEdit({ ...edit, channel: e.target.value as Channel })}>{CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}</ErpSelect></ErpField>
                <ErpField label={lang === "bn" ? "ভাষা" : "Language"}><ErpSelect value={edit.lang} onChange={(e) => setEdit({ ...edit, lang: e.target.value })}>{LANGS.map((l) => <option key={l} value={l}>{l}</option>)}</ErpSelect></ErpField>
              </div>
              {edit.channel === "EMAIL" && <ErpField label={lang === "bn" ? "বিষয়" : "Subject"}><ErpInput value={edit.subject} onChange={(e) => setEdit({ ...edit, subject: e.target.value })} /></ErpField>}
              <ErpField label={lang === "bn" ? "বডি ({{ভেরিয়েবল}} সমর্থিত)" : "Body ({{variables}} supported)"}><ErpTextarea value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} rows={8} /></ErpField>
              <p className="text-[11px]" style={{ color: "rgba(11,30,63,0.5)" }}>{lang === "bn" ? "উপলব্ধ: {{name}} {{code}} {{title}} {{body}}" : "Available: {{name}} {{code}} {{title}} {{body}}"}</p>
            </ErpForm>
          ) : tpls === null ? <LoadingSkeleton /> : (
            <div className="space-y-2 text-[11px]" style={{ fontFamily: fontFor(lang) }}>
              <ErpButton size="sm" variant="primary" icon={<Pencil size={12} />} onClick={() => setEdit({ channel: "WHATSAPP", lang: "bn", subject: "", body: "" })}>{lang === "bn" ? "নতুন টেমপ্লেট" : "New template"}</ErpButton>
              {tpls.length === 0 ? <p style={{ color: "rgba(11,30,63,0.5)" }} className="mt-2">{lang === "bn" ? "কোনো টেমপ্লেট নেই — ফলব্যাক ব্যবহৃত হচ্ছে" : "No templates yet — built-in fallback is used"}</p>
                : tpls.map((t) => (
                  <div key={t.id} className="border rounded-lg p-2.5" style={{ borderColor: "rgba(11,30,63,0.12)" }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold" style={{ color: TM }}>{t.channel} · {t.lang}</span>
                      <ErpButton size="sm" variant="ghost" icon={<Pencil size={11} />} onClick={() => setEdit({ channel: t.channel as Channel, lang: t.lang, subject: t.subject ?? "", body: t.body })}>{lang === "bn" ? "সম্পাদনা" : "Edit"}</ErpButton>
                    </div>
                    {t.subject && <div className="font-semibold">{t.subject}</div>}
                    <div className="whitespace-pre-wrap" style={{ color: "rgba(11,30,63,0.7)" }}>{t.body}</div>
                  </div>
                ))}
            </div>
          )}
        </ErpDrawer>
      )}

      {/* Test-send drawer */}
      {test && (
        <ErpDrawer open onClose={() => setTest(null)} lang={lang} title={lang === "bn" ? "পরীক্ষা বার্তা" : "Send Test"} subtitle={test.eventKey}
          footer={<ErpDrawerFooterActions lang={lang} onCancel={() => setTest(null)} onSave={sendTest} saving={busy} saveLabel={lang === "bn" ? "পাঠান" : "Dispatch"} />}>
          <ErpForm columns={1}>
            <ErpField label={lang === "bn" ? "হোয়াটসঅ্যাপ নম্বর (ঐচ্ছিক)" : "WhatsApp number (optional)"}><ErpInput value={test.phone} onChange={(e) => setTest({ ...test, phone: e.target.value })} placeholder="+8801…" /></ErpField>
            <ErpField label={lang === "bn" ? "ইমেইল (ঐচ্ছিক)" : "Email (optional)"}><ErpInput value={test.email} onChange={(e) => setTest({ ...test, email: e.target.value })} placeholder="name@example.com" /></ErpField>
            <p className="text-[11px]" style={{ color: "rgba(11,30,63,0.5)" }}>{lang === "bn" ? "IN_APP সর্বদা পাঠানো হয়। এটি লাইভ ডেলিভারি চালায় এবং অডিট/লগে রেকর্ড হয়।" : "IN_APP is always sent. This runs a real dispatch and is recorded in the notification log."}</p>
          </ErpForm>
        </ErpDrawer>
      )}
    </ERPShell>
  );
}
