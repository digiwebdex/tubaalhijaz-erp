import { useEffect, useState } from "react";
import { MessageCircle, RefreshCw, Send, Save, ShieldCheck } from "lucide-react";
import { ERPShell, type NavItem, type IconFC } from "../components/ERPShell";
import { LoadingSkeleton, ErrorState } from "../components/States";
import { ErpPageTemplate, ErpButton, ErpForm, ErpField, ErpInput, ErpStatusChip, erpToast, type ErpStatusKind } from "../components/erp";
import { api, ApiError, isLoggedIn } from "../lib/api";
import { useLang } from "../lib/LangContext";
import { fontFor } from "@tuba/shared";

const WA = "#128C7E";
interface Cfg { apiUrl: string; deviceId: string | null; defaultCountry: string; configured: boolean; apiKeyMasked: string | null; keyFromEnv: boolean; connectionStatus: string | null; lastTestAt: string | null; lastResponse: string | null }
interface TestRes { success: boolean; recipient?: string; status?: string; providerId?: string | null; error?: string | null }
const NAV: NavItem[] = [{ id: "wasender", label: "WaSender", labelBn: "ওয়াসেন্ডার", icon: MessageCircle as IconFC }];
const connKind = (s?: string | null): ErpStatusKind => !s ? "info" : /connected|open|ready/i.test(s) ? "approved" : /error|fail|not/i.test(s) ? "rejected" : "pending";

export default function WaSenderConfig() {
  const { lang } = useLang();
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [error, setError] = useState(false);
  const [form, setForm] = useState({ apiUrl: "", deviceId: "", defaultCountry: "", apiKey: "" });
  const [busy, setBusy] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [testing, setTesting] = useState(false);
  const [testRes, setTestRes] = useState<TestRes | null>(null);

  const load = () => {
    if (!isLoggedIn()) return;
    api.get<Cfg>("/admin/integrations/wasender").then((c) => {
      setCfg(c); setError(false);
      setForm({ apiUrl: c.apiUrl ?? "", deviceId: c.deviceId ?? "", defaultCountry: c.defaultCountry ?? "", apiKey: "" });
    }).catch(() => { setCfg(null); setError(true); });
  };
  useEffect(load, []);

  const save = async () => {
    setBusy(true);
    try {
      const body: Record<string, string> = { apiUrl: form.apiUrl.trim(), deviceId: form.deviceId.trim(), defaultCountry: form.defaultCountry.trim() };
      if (form.apiKey.trim()) body.apiKey = form.apiKey.trim(); // only overwrite the secret when a new one is typed
      const c = await api.put<Cfg>("/admin/integrations/wasender", body);
      setCfg(c); setForm((f) => ({ ...f, apiKey: "" }));
      erpToast.success(lang === "bn" ? "সংরক্ষিত" : "Saved", lang);
    } catch (e) { erpToast.error(e instanceof ApiError ? e.message : "Failed", lang); } finally { setBusy(false); }
  };
  const runTest = async () => {
    setTesting(true); setTestRes(null);
    try {
      const r = await api.post<TestRes>("/admin/integrations/wasender/test", testPhone.trim() ? { phone: testPhone.trim() } : {});
      setTestRes(r);
      r.success ? erpToast.success(lang === "bn" ? "বার্তা পৌঁছেছে" : "Message delivered", lang) : erpToast.error(r.error || (lang === "bn" ? "ব্যর্থ" : "Failed"), lang);
      load();
    } catch (e) { erpToast.error(e instanceof ApiError ? e.message : "Failed", lang); } finally { setTesting(false); }
  };

  return (
    <ERPShell moduleId="admin" moduleName="WaSender" moduleColor={WA} moduleIcon={MessageCircle as IconFC}
      navItems={NAV} activeItem="wasender" onItemClick={() => undefined} breadcrumb={[lang === "bn" ? "প্রশাসন" : "Administration", "WaSender"]} userName="Administration" userRole="TUBA AL HIJAZ">
      <div className="flex-1 overflow-y-auto p-4 md:p-5" style={{ fontFamily: fontFor(lang) }}>
        {error ? <ErrorState tone="light" lang={lang} onRetry={load} /> : cfg === null ? <LoadingSkeleton /> : (
          <div className="grid lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <ErpPageTemplate title={lang === "bn" ? "ওয়াসেন্ডার কনফিগারেশন" : "WaSender Configuration"} subtitle={lang === "bn" ? "হোয়াটসঅ্যাপ ডেলিভারি — এন্ক্রিপ্টেড কী" : "WhatsApp delivery gateway — key encrypted at rest"}>
                <ErpForm columns={2}>
                  <ErpField label="API URL"><ErpInput value={form.apiUrl} onChange={(e) => setForm({ ...form, apiUrl: e.target.value })} placeholder="https://wasenderapi.com/api" /></ErpField>
                  <ErpField label={lang === "bn" ? "ডিভাইস আইডি" : "Device ID"}><ErpInput value={form.deviceId} onChange={(e) => setForm({ ...form, deviceId: e.target.value })} /></ErpField>
                  <ErpField label={lang === "bn" ? "ডিফল্ট দেশ কোড" : "Default country code"}><ErpInput value={form.defaultCountry} onChange={(e) => setForm({ ...form, defaultCountry: e.target.value })} placeholder="+966" /></ErpField>
                  <ErpField label={lang === "bn" ? "API কী" : "API Key"} hint={cfg.keyFromEnv ? (lang === "bn" ? "বর্তমানে .env থেকে" : "currently from .env") : cfg.apiKeyMasked ? `${lang === "bn" ? "সংরক্ষিত" : "stored"}: ${cfg.apiKeyMasked}` : undefined}>
                    <ErpInput type="password" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} placeholder={cfg.configured ? "•••••••• (unchanged)" : lang === "bn" ? "কী দিন" : "Enter key"} autoComplete="new-password" />
                  </ErpField>
                </ErpForm>
                <div className="flex justify-end mt-4"><ErpButton variant="primary" icon={<Save size={14} />} onClick={save} disabled={busy}>{busy ? (lang === "bn" ? "সংরক্ষণ…" : "Saving…") : (lang === "bn" ? "সংরক্ষণ" : "Save")}</ErpButton></div>
              </ErpPageTemplate>
            </div>
            <div className="space-y-4">
              <div className="rounded-xl p-4" style={{ background: `${WA}0D`, border: `1px solid ${WA}22` }}>
                <div className="flex items-center gap-2 mb-2"><ShieldCheck size={15} style={{ color: WA }} /><span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: WA }}>{lang === "bn" ? "সংযোগ" : "Connection"}</span></div>
                <div className="flex items-center gap-2 mb-2"><ErpStatusChip status={connKind(cfg.connectionStatus)} label={cfg.connectionStatus || (cfg.configured ? "configured" : "not configured")} lang={lang} /></div>
                <div className="text-[11px] space-y-1" style={{ color: "rgba(11,30,63,0.6)" }}>
                  <div>{lang === "bn" ? "কনফিগার্ড" : "Configured"}: <b>{cfg.configured ? "✓" : "✕"}</b></div>
                  {cfg.lastTestAt && <div>{lang === "bn" ? "শেষ পরীক্ষা" : "Last test"}: {new Date(cfg.lastTestAt).toLocaleString()}</div>}
                </div>
              </div>
              <div className="rounded-xl p-4 border" style={{ borderColor: "rgba(11,30,63,0.12)" }}>
                <div className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: WA }}>{lang === "bn" ? "লাইভ পরীক্ষা" : "Live Test"}</div>
                <ErpField label={lang === "bn" ? "প্রাপকের নম্বর (ঐচ্ছিক)" : "Recipient number (optional)"}>
                  <ErpInput value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder={lang === "bn" ? "ফাঁকা = নিজের ডিভাইস" : "blank = own device"} />
                </ErpField>
                <ErpButton variant="outline" icon={<Send size={13} />} onClick={runTest} disabled={testing} style={{ width: "100%", marginTop: 8 }}>{testing ? (lang === "bn" ? "পাঠানো হচ্ছে…" : "Sending…") : (lang === "bn" ? "পরীক্ষা বার্তা পাঠান" : "Send test message")}</ErpButton>
                {testRes && (
                  <div className="mt-3 text-[11px] rounded-lg p-2.5" style={{ background: testRes.success ? "rgba(13,148,136,0.08)" : "rgba(185,28,28,0.06)", border: `1px solid ${testRes.success ? "rgba(13,148,136,0.25)" : "rgba(185,28,28,0.2)"}` }}>
                    <div><b>{lang === "bn" ? "ফলাফল" : "Result"}:</b> {testRes.success ? "✓ delivered" : "✕ failed"} {testRes.status ? `(${testRes.status})` : ""}</div>
                    {testRes.recipient && <div className="font-mono">→ {testRes.recipient}</div>}
                    {testRes.providerId && <div className="font-mono">id: {testRes.providerId}</div>}
                    {testRes.error && <div style={{ color: "#B91C1C" }}>{testRes.error}</div>}
                  </div>
                )}
              </div>
              <ErpButton variant="ghost" size="sm" icon={<RefreshCw size={13} />} onClick={load}>{lang === "bn" ? "রিফ্রেশ" : "Refresh"}</ErpButton>
            </div>
          </div>
        )}
      </div>
    </ERPShell>
  );
}
