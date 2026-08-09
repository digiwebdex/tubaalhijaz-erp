/**
 * Module 9 — System Administration (Settings) hub.
 * Unified administration shell. Reuses existing pages via links; hosts config
 * panels that consume EXISTING backend APIs (companies, security-policy,
 * approval-rules, integrations). No duplicate pages / APIs / components.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import {
  Building2, Shield, GitBranch, Plug, Users, Zap, FileCode, ScrollText,
  DollarSign, Layers, Bell, Mail, MessageCircle, Plus, Trash2, RefreshCw,
  Save, ExternalLink, Settings as SettingsIcon, SlidersHorizontal, Upload, Image as ImageIcon,
  CalendarDays, Archive, Power, Star, Lock, HardDrive, ShieldCheck, Clock, Flag,
} from "lucide-react";
import { ERPShell, type NavItem, type IconFC } from "../components/ERPShell";
import { LoadingSkeleton, ErrorState, EmptyState } from "../components/States";
import {
  ERP, erpAlpha, ErpThemeProvider, ErpButton, ErpForm, ErpFormRow, ErpField,
  ErpInput, ErpSelect, ErpToggle, ErpModal, ErpDataTable, type ErpColumn,
  ErpStatCard, ErpStatusChip, ErpSearchBar, ErpSectionHeader, erpToast, type ErpStatusKind,
} from "../components/erp";
import { api, ApiError, getStoredUser } from "../lib/api";
import { canAccessPath } from "../lib/rbac";
import { useLang } from "../lib/LangContext";
import { fontFor } from "@tuba/shared";

const GOLD = ERP.accent;
type Section = "overview" | "company" | "security" | "approvals" | "seasons" | "sysconfig" | "flags" | "backup" | "integrations";

// ─── Reused-page links (never cloned — the hub deep-links to existing routes) ──
interface LinkItem { id: string; label: string; labelBn: string; icon: IconFC; path: string }
const REUSE_LINKS: LinkItem[] = [
  { id: "lnk-users",     label: "Users, Roles & Permissions", labelBn: "ব্যবহারকারী ও রোল", icon: Users        as IconFC, path: "/super-admin?tab=users" },
  { id: "lnk-workflow",  label: "Workflow / Automation",      labelBn: "ওয়ার্কফ্লো",       icon: Zap          as IconFC, path: "/automation" },
  { id: "lnk-templates", label: "Notification Templates",     labelBn: "টেমপ্লেট",          icon: FileCode     as IconFC, path: "/template-manager" },
  { id: "lnk-notif",     label: "Notification Center",        labelBn: "নোটিফিকেশন",        icon: Bell         as IconFC, path: "/notification-center" },
  { id: "lnk-audit",     label: "Audit Logs",                 labelBn: "অডিট লগ",           icon: ScrollText   as IconFC, path: "/audit-center" },
  { id: "lnk-rates",     label: "Master Data — Rate Cards",   labelBn: "রেট কার্ড",         icon: Layers       as IconFC, path: "/rate-cards" },
  { id: "lnk-currency",  label: "Currencies",                 labelBn: "মুদ্রা",            icon: DollarSign   as IconFC, path: "/finance-erp" },
];

// ─── Company Settings — reuses GET/PATCH /companies/:id (own company) ─────────
interface DayHours { open?: string; close?: string; closed?: boolean }
interface Holiday { date: string; name: string }
interface BrandColors { primary?: string; secondary?: string; accent?: string }
interface CompanyRow {
  id: string; code: string; type: string; name: string; nameBn?: string | null;
  city?: string | null; email?: string | null; phone?: string | null; verificationStatus?: string;
  invoicePrefix?: string | null; voucherPrefix?: string | null; bookingPrefix?: string | null;
  groupPrefix?: string | null; passengerPrefix?: string | null; logoUrl?: string | null;
  businessHours?: Record<string, DayHours> | null; holidays?: Holiday[] | null; brandColors?: BrandColors | null;
}
const DAYS: [string, string][] = [["mon", "Mon"], ["tue", "Tue"], ["wed", "Wed"], ["thu", "Thu"], ["fri", "Fri"], ["sat", "Sat"], ["sun", "Sun"]];
function CompanySettings() {
  const { lang } = useLang();
  const ownId = getStoredUser()?.companyId ?? null;
  const [list, setList] = useState<CompanyRow[]>([]);
  const [sel, setSel] = useState<string>(ownId ?? "");
  const [row, setRow] = useState<CompanyRow | null>(null);
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [form, setForm] = useState({ name: "", nameBn: "", city: "", email: "", phone: "" });
  const [enh, setEnh] = useState<{
    invoicePrefix: string; voucherPrefix: string; bookingPrefix: string; groupPrefix: string; passengerPrefix: string;
    logoUrl: string; brandColors: BrandColors; businessHours: Record<string, DayHours>; holidays: Holiday[];
  }>({ invoicePrefix: "", voucherPrefix: "", bookingPrefix: "", groupPrefix: "", passengerPrefix: "", logoUrl: "", brandColors: {}, businessHours: {}, holidays: [] });
  const [busy, setBusy] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);

  // Reuse the existing companies list API for the picker (SuperAdmin owns lifecycle/verification;
  // this panel only edits profile fields via the SAME PATCH /companies/:id — no new API, no clone).
  useEffect(() => {
    api.get<CompanyRow[]>("/companies")
      .then((r) => { setList(r); setSel((cur) => cur || ownId || r[0]?.id || ""); })
      .catch(() => setState("error"));
  }, [ownId]);

  const load = () => {
    if (!sel) { setState("error"); return; }
    setState("loading");
    api.get<CompanyRow>(`/companies/${sel}`)
      .then((c) => {
        setRow(c);
        setForm({ name: c.name ?? "", nameBn: c.nameBn ?? "", city: c.city ?? "", email: c.email ?? "", phone: c.phone ?? "" });
        setEnh({
          invoicePrefix: c.invoicePrefix ?? "", voucherPrefix: c.voucherPrefix ?? "", bookingPrefix: c.bookingPrefix ?? "",
          groupPrefix: c.groupPrefix ?? "", passengerPrefix: c.passengerPrefix ?? "", logoUrl: c.logoUrl ?? "",
          brandColors: c.brandColors ?? {}, businessHours: c.businessHours ?? {}, holidays: c.holidays ?? [],
        });
        setState("ready");
      })
      .catch(() => setState("error"));
  };
  useEffect(load, [sel]);

  const save = async () => {
    if (!sel || busy) return;
    setBusy(true);
    try {
      await api.patch(`/companies/${sel}`, {
        ...form,
        invoicePrefix: enh.invoicePrefix, voucherPrefix: enh.voucherPrefix, bookingPrefix: enh.bookingPrefix,
        groupPrefix: enh.groupPrefix, passengerPrefix: enh.passengerPrefix, logoUrl: enh.logoUrl,
        brandColors: enh.brandColors, businessHours: enh.businessHours, holidays: enh.holidays,
      });
      erpToast.success(lang === "bn" ? "কোম্পানি সেটিংস সংরক্ষিত" : "Company settings saved", lang);
      load();
    } catch (e) { erpToast.error(e instanceof ApiError ? e.message : "Save failed", lang); }
    finally { setBusy(false); }
  };

  const onLogo = (file: File) => {
    if (file.size > 1_200_000) { erpToast.error(lang === "bn" ? "লোগো খুব বড় (সর্বোচ্চ ~1MB)" : "Logo too large (max ~1MB)", lang); return; }
    const r = new FileReader();
    r.onload = () => setEnh((e) => ({ ...e, logoUrl: String(r.result) }));
    r.readAsDataURL(file);
  };
  const setDay = (d: string, patch: Partial<DayHours>) => setEnh((e) => ({ ...e, businessHours: { ...e.businessHours, [d]: { ...e.businessHours[d], ...patch } } }));
  const addHoliday = () => setEnh((e) => ({ ...e, holidays: [...e.holidays, { date: "", name: "" }] }));
  const setHoliday = (i: number, patch: Partial<Holiday>) => setEnh((e) => ({ ...e, holidays: e.holidays.map((h, idx) => (idx === i ? { ...h, ...patch } : h)) }));
  const rmHoliday = (i: number) => setEnh((e) => ({ ...e, holidays: e.holidays.filter((_, idx) => idx !== i) }));
  const setColor = (k: keyof BrandColors, v: string) => setEnh((e) => ({ ...e, brandColors: { ...e.brandColors, [k]: v } }));

  if (state === "error" && !list.length) return <ErrorState tone="light" onRetry={() => api.get<CompanyRow[]>("/companies").then((r) => { setList(r); setSel(r[0]?.id || ""); }).catch(() => setState("error"))} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[16rem]">
          <ErpSelect value={sel} onChange={(e) => setSel(e.target.value)}>
            {list.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.code}</option>)}
          </ErpSelect>
        </div>
        {row?.verificationStatus && <ErpStatusChip status={(row.verificationStatus === "VERIFIED" ? "approved" : "pending") as ErpStatusKind} label={row.verificationStatus} />}
      </div>
      {state === "loading" && <LoadingSkeleton tone="light" rows={4} />}
      {state === "ready" && (<>
      <ErpForm columns={2}>
        <ErpField label={lang === "bn" ? "নাম" : "Name"} required><ErpInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></ErpField>
        <ErpField label={lang === "bn" ? "নাম (বাংলা)" : "Name (Bangla)"}><ErpInput value={form.nameBn} onChange={(e) => setForm({ ...form, nameBn: e.target.value })} /></ErpField>
        <ErpField label={lang === "bn" ? "শহর" : "City"}><ErpInput value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></ErpField>
        <ErpField label={lang === "bn" ? "ইমেইল" : "Email"}><ErpInput type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></ErpField>
        <ErpField label={lang === "bn" ? "ফোন" : "Phone"}><ErpInput value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></ErpField>
      </ErpForm>
      {/* ── Document Prefixes ── */}
      <div className="pt-3 mt-3" style={{ borderTop: `1px solid ${ERP.border}` }}>
        <div className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: ERP.muted }}>{lang === "bn" ? "ডকুমেন্ট প্রিফিক্স" : "Document Prefixes"}</div>
        <ErpForm columns={2}>
          <ErpField label={lang === "bn" ? "ইনভয়েস" : "Invoice Prefix"}><ErpInput value={enh.invoicePrefix} onChange={(e) => setEnh({ ...enh, invoicePrefix: e.target.value })} placeholder="INV-" /></ErpField>
          <ErpField label={lang === "bn" ? "ভাউচার" : "Voucher Prefix"}><ErpInput value={enh.voucherPrefix} onChange={(e) => setEnh({ ...enh, voucherPrefix: e.target.value })} placeholder="VCH-" /></ErpField>
          <ErpField label={lang === "bn" ? "বুকিং" : "Booking Prefix"}><ErpInput value={enh.bookingPrefix} onChange={(e) => setEnh({ ...enh, bookingPrefix: e.target.value })} placeholder="BKG-" /></ErpField>
          <ErpField label={lang === "bn" ? "গ্রুপ" : "Group Prefix"}><ErpInput value={enh.groupPrefix} onChange={(e) => setEnh({ ...enh, groupPrefix: e.target.value })} placeholder="GRP-" /></ErpField>
          <ErpField label={lang === "bn" ? "যাত্রী" : "Passenger Prefix"}><ErpInput value={enh.passengerPrefix} onChange={(e) => setEnh({ ...enh, passengerPrefix: e.target.value })} placeholder="PAX-" /></ErpField>
        </ErpForm>
      </div>

      {/* ── Branding: logo + brand colours ── */}
      <div className="pt-3 mt-3" style={{ borderTop: `1px solid ${ERP.border}` }}>
        <div className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: ERP.muted }}>{lang === "bn" ? "ব্র্যান্ডিং" : "Branding"}</div>
        <div className="flex flex-wrap items-start gap-6">
          <div className="flex items-center gap-3">
            {enh.logoUrl
              ? <img src={enh.logoUrl} alt="logo" className="w-16 h-16 rounded-xl object-contain" style={{ backgroundColor: ERP.surfaceSoft, border: `1px solid ${ERP.border}` }} />
              : <div className="w-16 h-16 rounded-xl flex items-center justify-center" style={{ backgroundColor: ERP.surfaceSoft, border: `1px solid ${ERP.border}` }}><ImageIcon size={20} style={{ color: ERP.mutedSoft }} /></div>}
            <div className="flex flex-col gap-1.5">
              <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onLogo(f); e.target.value = ""; }} />
              <ErpButton size="sm" variant="secondary" icon={<Upload size={13} />} onClick={() => logoRef.current?.click()}>{lang === "bn" ? "লোগো আপলোড" : "Upload logo"}</ErpButton>
              {enh.logoUrl && <ErpButton size="sm" variant="ghost" icon={<Trash2 size={13} />} onClick={() => setEnh({ ...enh, logoUrl: "" })} style={{ color: ERP.destructive }}>{lang === "bn" ? "সরান" : "Remove"}</ErpButton>}
            </div>
          </div>
          <div className="flex-1 min-w-[16rem] grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(["primary", "secondary", "accent"] as (keyof BrandColors)[]).map((k) => (
              <div key={k} className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg shrink-0" style={{ backgroundColor: enh.brandColors[k] || ERP.surfaceSoft, border: `1px solid ${ERP.border}` }} />
                <div className="flex-1"><ErpField label={k.charAt(0).toUpperCase() + k.slice(1)}><ErpInput value={enh.brandColors[k] || ""} onChange={(e) => setColor(k, e.target.value)} placeholder="#RRGGBB" /></ErpField></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Business Hours ── */}
      <div className="pt-3 mt-3" style={{ borderTop: `1px solid ${ERP.border}` }}>
        <div className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: ERP.muted }}>{lang === "bn" ? "কর্মঘণ্টা" : "Business Hours"}</div>
        <div className="space-y-1.5">
          {DAYS.map(([d, lbl]) => { const h = enh.businessHours[d] || {}; return (
            <div key={d} className="flex flex-wrap items-center gap-3 rounded-xl px-3 py-2" style={{ backgroundColor: ERP.surfaceSoft, border: `1px solid ${ERP.border}` }}>
              <span className="w-9 text-xs font-bold" style={{ color: ERP.navy }}>{lbl}</span>
              <div style={{ opacity: h.closed ? ERP.opacity.disabled : 1 }}><ErpInput type="time" value={h.open || ""} onChange={(e) => setDay(d, { open: e.target.value })} /></div>
              <span className="text-[10px]" style={{ color: ERP.mutedSoft }}>–</span>
              <div style={{ opacity: h.closed ? ERP.opacity.disabled : 1 }}><ErpInput type="time" value={h.close || ""} onChange={(e) => setDay(d, { close: e.target.value })} /></div>
              <div className="flex-1" />
              <span className="text-[10px]" style={{ color: ERP.muted }}>{lang === "bn" ? "বন্ধ" : "Closed"}</span>
              <ErpToggle on={!!h.closed} onToggle={() => setDay(d, { closed: !h.closed })} ariaLabel={`${lbl} closed`} size="sm" />
            </div>
          ); })}
        </div>
      </div>

      {/* ── Holiday Calendar ── */}
      <div className="pt-3 mt-3" style={{ borderTop: `1px solid ${ERP.border}` }}>
        <div className="flex items-center justify-between mb-3">
          <div className="text-[11px] font-bold uppercase tracking-widest" style={{ color: ERP.muted }}>{lang === "bn" ? "ছুটির ক্যালেন্ডার" : "Holiday Calendar"}</div>
          <ErpButton size="sm" variant="secondary" icon={<Plus size={13} />} onClick={addHoliday}>{lang === "bn" ? "যোগ করুন" : "Add holiday"}</ErpButton>
        </div>
        <div className="space-y-1.5">
          {enh.holidays.length === 0 && <div className="text-[11px]" style={{ color: ERP.mutedSoft }}>{lang === "bn" ? "কোনো ছুটি কনফিগার করা হয়নি" : "No holidays configured"}</div>}
          {enh.holidays.map((h, i) => (
            <div key={i} className="flex items-center gap-2">
              <ErpInput type="date" value={h.date} onChange={(e) => setHoliday(i, { date: e.target.value })} />
              <div className="flex-1"><ErpInput value={h.name} onChange={(e) => setHoliday(i, { name: e.target.value })} placeholder={lang === "bn" ? "নাম" : "Holiday name"} /></div>
              <ErpButton size="sm" variant="ghost" icon={<Trash2 size={13} />} onClick={() => rmHoliday(i)} style={{ color: ERP.destructive }} />
            </div>
          ))}
        </div>
      </div>

      <div className="pt-3">
        <ErpButton variant="primary" icon={<Save size={14} />} loading={busy} onClick={() => void save()}>{lang === "bn" ? "সংরক্ষণ" : "Save changes"}</ErpButton>
      </div>
      </>)}
    </div>
  );
}

// ─── Security Policy — reuses GET/PUT /admin/security-policy ──────────────────
interface Policy { impersonationMaxMinutes: number; forceLogoutOnRoleChange: boolean; forceLogoutOnLock: boolean; maxSessionMinutes: number | null }
function SecurityPolicyPanel() {
  const { lang } = useLang();
  const [p, setP] = useState<Policy | null>(null);
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [busy, setBusy] = useState(false);
  const load = () => { setState("loading"); api.get<Policy>("/admin/security-policy").then((d) => { setP(d); setState("ready"); }).catch(() => setState("error")); };
  useEffect(load, []);
  const save = async () => {
    if (!p || busy) return; setBusy(true);
    try { await api.put("/admin/security-policy", p); erpToast.success(lang === "bn" ? "নিরাপত্তা নীতি সংরক্ষিত" : "Security policy saved", lang); load(); }
    catch (e) { erpToast.error(e instanceof ApiError ? e.message : "Save failed", lang); }
    finally { setBusy(false); }
  };
  if (state === "loading") return <LoadingSkeleton tone="light" rows={4} />;
  if (state === "error" || !p) return <ErrorState tone="light" onRetry={load} />;
  const Toggle = ({ label, k }: { label: string; k: "forceLogoutOnRoleChange" | "forceLogoutOnLock" }) => (
    <div className="flex items-center justify-between rounded-xl px-4 py-3" style={{ backgroundColor: ERP.surfaceSoft, border: `1px solid ${ERP.border}` }}>
      <span className="text-xs font-semibold text-[color:var(--erp-text-strong)]">{label}</span>
      <ErpToggle on={p[k]} onToggle={() => setP({ ...p, [k]: !p[k] })} ariaLabel={label} />
    </div>
  );
  return (
    <div className="space-y-5">
      <ErpForm columns={2}>
        <ErpField label={lang === "bn" ? "ইম্পারসোনেশন সর্বোচ্চ (মিনিট)" : "Impersonation max (minutes)"}><ErpInput type="number" value={String(p.impersonationMaxMinutes)} onChange={(e) => setP({ ...p, impersonationMaxMinutes: Number(e.target.value) || 1 })} /></ErpField>
        <ErpField label={lang === "bn" ? "সর্বোচ্চ সেশন (মিনিট)" : "Max session (minutes)"} hint={lang === "bn" ? "খালি = সীমাহীন" : "Empty = unlimited"}><ErpInput type="number" value={p.maxSessionMinutes == null ? "" : String(p.maxSessionMinutes)} onChange={(e) => setP({ ...p, maxSessionMinutes: e.target.value === "" ? null : Number(e.target.value) })} /></ErpField>
      </ErpForm>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Toggle label={lang === "bn" ? "রোল পরিবর্তনে লগআউট" : "Force logout on role change"} k="forceLogoutOnRoleChange" />
        <Toggle label={lang === "bn" ? "লক হলে লগআউট" : "Force logout on lock"} k="forceLogoutOnLock" />
      </div>
      <ErpButton variant="primary" icon={<Save size={14} />} loading={busy} onClick={() => void save()}>{lang === "bn" ? "সংরক্ষণ" : "Save policy"}</ErpButton>
    </div>
  );
}

// ─── Approval Matrix — reuses /approval-rules CRUD ───────────────────────────
interface Rule { id: string; name: string; minPax: number | null; requiredRole: string; level: number; minApprovals: number; active: boolean }
const ROLES = ["OPS_STAFF", "FINANCE_STAFF", "FLEET_STAFF", "SUPER_ADMIN"];
function ApprovalMatrix() {
  const { lang } = useLang();
  const [rows, setRows] = useState<Rule[]>([]);
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [edit, setEdit] = useState<Rule | null>(null);
  const [del, setDel] = useState<Rule | null>(null);
  const [busy, setBusy] = useState(false);
  const blank: Rule = { id: "", name: "", minPax: null, requiredRole: "OPS_STAFF", level: 1, minApprovals: 1, active: true };
  const load = () => { setState("loading"); api.get<Rule[]>("/approval-rules").then((d) => { setRows(d); setState("ready"); }).catch(() => setState("error")); };
  useEffect(load, []);

  const submit = async () => {
    if (!edit || busy) return; setBusy(true);
    const body = { name: edit.name, minPax: edit.minPax, requiredRole: edit.requiredRole, level: edit.level, minApprovals: edit.minApprovals, active: edit.active };
    try {
      if (edit.id) await api.patch(`/approval-rules/${edit.id}`, body);
      else await api.post("/approval-rules", body);
      erpToast.success(lang === "bn" ? "নিয়ম সংরক্ষিত" : "Rule saved", lang);
      setEdit(null); load();
    } catch (e) { erpToast.error(e instanceof ApiError ? e.message : "Save failed", lang); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!del || busy) return; setBusy(true);
    try { await api.delete(`/approval-rules/${del.id}`); erpToast.success(lang === "bn" ? "নিয়ম মুছে ফেলা হয়েছে" : "Rule deleted", lang); setDel(null); load(); }
    catch (e) { erpToast.error(e instanceof ApiError ? e.message : "Delete failed", lang); }
    finally { setBusy(false); }
  };

  const cols: ErpColumn<Rule>[] = [
    { id: "name", header: lang === "bn" ? "নাম" : "Name", cell: (r) => <span className="text-xs font-semibold text-[color:var(--erp-text-strong)]">{r.name}</span> },
    { id: "minPax", header: "Min Pax", align: "center", cell: (r) => <span className="text-xs tabular-nums" style={{ color: ERP.muted }}>{r.minPax ?? "—"}</span> },
    { id: "role", header: lang === "bn" ? "রোল" : "Role", cell: (r) => <span className="text-[11px] font-mono" style={{ color: ERP.info }}>{r.requiredRole}</span> },
    { id: "level", header: lang === "bn" ? "লেভেল" : "Level", align: "center", cell: (r) => <span className="text-xs tabular-nums" style={{ color: ERP.navy }}>{r.level}</span> },
    { id: "min", header: lang === "bn" ? "সর্বনিম্ন অনুমোদন" : "Min approvals", align: "center", cell: (r) => <span className="text-xs tabular-nums" style={{ color: ERP.navy }}>{r.minApprovals}</span> },
    { id: "active", header: lang === "bn" ? "সক্রিয়" : "Active", cell: (r) => <ErpStatusChip status={(r.active ? "approved" : "rejected") as ErpStatusKind} label={r.active ? (lang === "bn" ? "সক্রিয়" : "Active") : (lang === "bn" ? "নিষ্ক্রিয়" : "Inactive")} /> },
  ];

  const F = edit;
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ErpButton variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setEdit({ ...blank })}>{lang === "bn" ? "নতুন নিয়ম" : "New rule"}</ErpButton>
      </div>
      {state === "error"
        ? <ErrorState tone="light" onRetry={load} />
        : <ErpDataTable
            columns={cols} rows={state === "ready" ? rows : []} rowKey={(r) => r.id} loading={state === "loading"} lang={lang}
            emptyTitle={lang === "bn" ? "কোনো নিয়ম নেই" : "No approval rules"}
            emptyHint={lang === "bn" ? "নতুন নিয়ম যোগ করুন।" : "Add a rule to define the approval matrix."}
            rowActions={(r) => (
              <div className="flex gap-1">
                <ErpButton size="sm" variant="ghost" icon={<SlidersHorizontal size={13} />} onClick={(e) => { e.stopPropagation(); setEdit({ ...r }); }} />
                <ErpButton size="sm" variant="ghost" icon={<Trash2 size={13} />} onClick={(e) => { e.stopPropagation(); setDel(r); }} style={{ color: ERP.destructive }} />
              </div>
            )}
          />}

      <ErpModal open={!!F} onClose={() => setEdit(null)} title={F?.id ? (lang === "bn" ? "নিয়ম সম্পাদনা" : "Edit rule") : (lang === "bn" ? "নতুন নিয়ম" : "New rule")}
        footer={<div className="flex gap-2 justify-end"><ErpButton variant="secondary" onClick={() => setEdit(null)}>{lang === "bn" ? "বাতিল" : "Cancel"}</ErpButton><ErpButton variant="primary" loading={busy} onClick={() => void submit()}>{lang === "bn" ? "সংরক্ষণ" : "Save"}</ErpButton></div>}>
        {F && (
          <ErpForm columns={2}>
            <ErpFormRow span={2}><ErpField label={lang === "bn" ? "নাম" : "Name"} required><ErpInput value={F.name} onChange={(e) => setEdit({ ...F, name: e.target.value })} /></ErpField></ErpFormRow>
            <ErpField label="Min Pax"><ErpInput type="number" value={F.minPax == null ? "" : String(F.minPax)} onChange={(e) => setEdit({ ...F, minPax: e.target.value === "" ? null : Number(e.target.value) })} /></ErpField>
            <ErpField label={lang === "bn" ? "প্রয়োজনীয় রোল" : "Required role"}><ErpSelect value={F.requiredRole} onChange={(e) => setEdit({ ...F, requiredRole: e.target.value })}>{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</ErpSelect></ErpField>
            <ErpField label={lang === "bn" ? "লেভেল" : "Level"}><ErpInput type="number" value={String(F.level)} onChange={(e) => setEdit({ ...F, level: Number(e.target.value) || 1 })} /></ErpField>
            <ErpField label={lang === "bn" ? "সর্বনিম্ন অনুমোদন" : "Min approvals"}><ErpInput type="number" value={String(F.minApprovals)} onChange={(e) => setEdit({ ...F, minApprovals: Number(e.target.value) || 1 })} /></ErpField>
            <ErpFormRow span={2}>
              <div className="flex items-center justify-between rounded-xl px-4 py-3" style={{ backgroundColor: ERP.surfaceSoft, border: `1px solid ${ERP.border}` }}>
                <span className="text-xs font-semibold text-[color:var(--erp-text-strong)]">{lang === "bn" ? "সক্রিয়" : "Active"}</span>
                <ErpToggle on={F.active} onToggle={() => setEdit({ ...F, active: !F.active })} ariaLabel="active" />
              </div>
            </ErpFormRow>
          </ErpForm>
        )}
      </ErpModal>

      <ErpModal open={!!del} onClose={() => setDel(null)} title={lang === "bn" ? "নিয়ম মুছবেন?" : "Delete rule?"}
        footer={<div className="flex gap-2 justify-end"><ErpButton variant="secondary" onClick={() => setDel(null)}>{lang === "bn" ? "বাতিল" : "Cancel"}</ErpButton><ErpButton variant="danger" loading={busy} onClick={() => void remove()}>{lang === "bn" ? "মুছুন" : "Delete"}</ErpButton></div>}>
        <p className="text-sm" style={{ color: ERP.muted }}>{del?.name}</p>
      </ErpModal>
    </div>
  );
}

// ─── Integration Hub — reuses /admin/integrations (wasender link + email) ─────
interface WaStatus { apiUrl: string; deviceId: string | null; defaultCountry: string; configured: boolean; apiKeyMasked: string | null; keyFromEnv: boolean; connectionStatus: string | null }
interface EmailStatus { host: string | null; port: number; from: string; user: string | null; secure: boolean; configured: boolean; passMasked: string | null; mode: string; keyFromEnv: boolean }
function IntegrationHub() {
  const { lang } = useLang();
  const navigate = useNavigate();
  const [wa, setWa] = useState<WaStatus | null>(null);
  const [em, setEm] = useState<EmailStatus | null>(null);
  const [form, setForm] = useState({ host: "", port: "587", user: "", pass: "", from: "", secure: false });
  const [busy, setBusy] = useState(false);
  const loadWa = () => api.get<WaStatus>("/admin/integrations/wasender").then(setWa).catch(() => setWa(null));
  const loadEm = () => api.get<EmailStatus>("/admin/integrations/email").then((d) => { setEm(d); setForm({ host: d.host ?? "", port: String(d.port ?? 587), user: d.user ?? "", pass: "", from: d.from ?? "", secure: !!d.secure }); }).catch(() => setEm(null));
  useEffect(() => { void loadWa(); void loadEm(); }, []);

  const saveEmail = async () => {
    if (busy) return; setBusy(true);
    const body: Record<string, unknown> = { host: form.host, port: Number(form.port) || 587, user: form.user, from: form.from, secure: form.secure };
    if (form.pass) body.pass = form.pass;
    try { await api.put("/admin/integrations/email", body); erpToast.success(lang === "bn" ? "ইমেইল কনফিগ সংরক্ষিত" : "Email config saved", lang); void loadEm(); }
    catch (e) { erpToast.error(e instanceof ApiError ? e.message : "Save failed", lang); }
    finally { setBusy(false); }
  };
  const testEmail = async () => {
    setBusy(true);
    try { const r = await api.post<{ ok: boolean; message: string }>("/admin/integrations/email/test", {}); r.ok ? erpToast.success(r.message || "OK", lang) : erpToast.error(r.message || "Test failed", lang); }
    catch (e) { erpToast.error(e instanceof ApiError ? e.message : "Test failed", lang); }
    finally { setBusy(false); }
  };

  const chip = (ok: boolean, label: string) => <ErpStatusChip status={(ok ? "approved" : "pending") as ErpStatusKind} label={label} />;

  return (
    <div className="space-y-6">
      {/* WaSender — reuse existing dedicated page */}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: ERP.surface, border: `1px solid ${ERP.border}` }}>
        <div className="flex items-center gap-3 px-5 py-4">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: erpAlpha(ERP.success, 9) }}><MessageCircle size={16} style={{ color: ERP.success }} /></div>
          <div className="flex-1">
            <div className="text-sm font-bold text-[color:var(--erp-text-strong)]">WaSender (WhatsApp)</div>
            <div className="text-[11px]" style={{ color: ERP.muted }}>{wa ? `${wa.apiUrl} · ${wa.configured ? (lang === "bn" ? "কনফিগার করা" : "configured") : (lang === "bn" ? "কনফিগার করা হয়নি" : "not configured")}` : "…"}</div>
          </div>
          {wa && chip(wa.configured, wa.connectionStatus ?? (wa.configured ? "configured" : "unset"))}
          <ErpButton size="sm" variant="outline" icon={<ExternalLink size={13} />} onClick={() => navigate("/wasender-config")}>{lang === "bn" ? "কনফিগার" : "Configure"}</ErpButton>
        </div>
      </div>

      {/* Email — extends existing SMTP backend (nodemailer) via IntegrationConfig */}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: ERP.surface, border: `1px solid ${ERP.border}` }}>
        <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: `1px solid ${ERP.border}` }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: erpAlpha(ERP.info, 9) }}><Mail size={16} style={{ color: ERP.info }} /></div>
          <div className="flex-1">
            <div className="text-sm font-bold text-[color:var(--erp-text-strong)]">{lang === "bn" ? "ইমেইল (SMTP)" : "Email (SMTP)"}</div>
            <div className="text-[11px]" style={{ color: ERP.muted }}>{em ? (em.mode === "live" ? (lang === "bn" ? "সক্রিয়" : "live") : (lang === "bn" ? "স্টাব মোড" : "stub mode")) : "…"}{em?.keyFromEnv ? " · env" : ""}</div>
          </div>
          {em && chip(em.mode === "live", em.mode)}
        </div>
        <div className="p-5 space-y-4">
          <ErpForm columns={2}>
            <ErpField label={lang === "bn" ? "SMTP হোস্ট" : "SMTP host"}><ErpInput value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} placeholder="smtp.example.com" /></ErpField>
            <ErpField label={lang === "bn" ? "পোর্ট" : "Port"}><ErpInput type="number" value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })} /></ErpField>
            <ErpField label={lang === "bn" ? "ইউজার" : "Username"}><ErpInput value={form.user} onChange={(e) => setForm({ ...form, user: e.target.value })} /></ErpField>
            <ErpField label={lang === "bn" ? "পাসওয়ার্ড" : "Password"} hint={em?.passMasked ? `${lang === "bn" ? "বর্তমান" : "current"}: ${em.passMasked}` : undefined}><ErpInput type="password" value={form.pass} onChange={(e) => setForm({ ...form, pass: e.target.value })} placeholder={em?.configured ? "••••••••" : ""} /></ErpField>
            <ErpField label={lang === "bn" ? "প্রেরক (From)" : "From address"}><ErpInput value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} placeholder="TUBA <no-reply@tubalhijaz.com>" /></ErpField>
            <div className="flex items-center justify-between rounded-xl px-4 py-3" style={{ backgroundColor: ERP.surfaceSoft, border: `1px solid ${ERP.border}` }}>
              <span className="text-xs font-semibold text-[color:var(--erp-text-strong)]">{lang === "bn" ? "TLS (secure)" : "TLS (secure)"}</span>
              <ErpToggle on={form.secure} onToggle={() => setForm({ ...form, secure: !form.secure })} ariaLabel="secure" />
            </div>
          </ErpForm>
          <div className="flex gap-2">
            <ErpButton variant="primary" icon={<Save size={14} />} loading={busy} onClick={() => void saveEmail()}>{lang === "bn" ? "সংরক্ষণ" : "Save"}</ErpButton>
            <ErpButton variant="secondary" icon={<RefreshCw size={14} />} loading={busy} onClick={() => void testEmail()}>{lang === "bn" ? "টেস্ট" : "Send test"}</ErpButton>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Season Management — reuses the Season model via new /seasons CRUD API ────
interface Season { id: string; code: string; name: string; nameBn?: string | null; hijriYear: number; startDate: string; endDate: string; status: string; isActive: boolean; isDefault: boolean }
function SeasonManagement() {
  const { lang } = useLang();
  const [rows, setRows] = useState<Season[]>([]);
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [edit, setEdit] = useState<Partial<Season> | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () => { setState("loading"); api.get<Season[]>("/seasons").then((d) => { setRows(d); setState("ready"); }).catch(() => setState("error")); };
  useEffect(load, []);

  const act = async (path: string, ok: string) => {
    if (busy) return; setBusy(true);
    try { await api.post(path, {}); erpToast.success(ok, lang); load(); }
    catch (e) { erpToast.error(e instanceof ApiError ? e.message : "Failed", lang); }
    finally { setBusy(false); }
  };
  const submit = async () => {
    if (!edit || busy) return; setBusy(true);
    const body = { name: edit.name, nameBn: edit.nameBn || undefined, hijriYear: Number(edit.hijriYear), startDate: edit.startDate, endDate: edit.endDate };
    try {
      if (edit.id) await api.patch(`/seasons/${edit.id}`, body);
      else await api.post("/seasons", body);
      erpToast.success(lang === "bn" ? "সিজন সংরক্ষিত" : "Season saved", lang); setEdit(null); load();
    } catch (e) { erpToast.error(e instanceof ApiError ? e.message : "Save failed", lang); }
    finally { setBusy(false); }
  };
  const fmtD = (d?: string | null) => (d ? String(d).slice(0, 10) : "");
  const kind = (s: string): ErpStatusKind => (s === "ACTIVE" ? "approved" : s === "ARCHIVED" ? "rejected" : "pending");

  const cols: ErpColumn<Season>[] = [
    { id: "name", header: lang === "bn" ? "নাম" : "Name", cell: (r) => <div><div className="text-xs font-semibold text-[color:var(--erp-text-strong)]">{r.name}</div><div className="text-[9px] font-mono" style={{ color: ERP.muted }}>{r.code}</div></div> },
    { id: "hy", header: lang === "bn" ? "হিজরি" : "Hijri Year", align: "center", cell: (r) => <span className="text-xs tabular-nums" style={{ color: ERP.navy }}>{r.hijriYear}H</span> },
    { id: "start", header: lang === "bn" ? "শুরু" : "Start", cell: (r) => <span className="text-[11px] whitespace-nowrap" style={{ color: ERP.muted }}>{fmtD(r.startDate)}</span> },
    { id: "end", header: lang === "bn" ? "শেষ" : "End", cell: (r) => <span className="text-[11px] whitespace-nowrap" style={{ color: ERP.muted }}>{fmtD(r.endDate)}</span> },
    { id: "status", header: lang === "bn" ? "স্ট্যাটাস" : "Status", cell: (r) => <ErpStatusChip status={kind(r.status)} label={r.status} /> },
    { id: "default", header: lang === "bn" ? "ডিফল্ট" : "Default", cell: (r) => (r.isDefault ? <ErpStatusChip status="approved" label={lang === "bn" ? "ডিফল্ট" : "Default"} /> : <span style={{ color: ERP.mutedSoft }}>—</span>) },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ErpButton variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setEdit({ hijriYear: 1447 })}>{lang === "bn" ? "নতুন সিজন" : "New Season"}</ErpButton>
      </div>
      {state === "error"
        ? <ErrorState tone="light" onRetry={load} />
        : <ErpDataTable
            columns={cols} rows={state === "ready" ? rows : []} rowKey={(r) => r.id} loading={state === "loading"} lang={lang}
            emptyTitle={lang === "bn" ? "কোনো সিজন নেই" : "No seasons"} emptyHint={lang === "bn" ? "নতুন সিজন তৈরি করুন।" : "Create a season to begin."}
            rowActions={(r) => (
              <div className="flex gap-1">
                {r.status !== "ARCHIVED" && r.status !== "ACTIVE" && <ErpButton size="sm" variant="ghost" icon={<Power size={13} />} onClick={(e) => { e.stopPropagation(); void act(`/seasons/${r.id}/activate`, lang === "bn" ? "সক্রিয় করা হয়েছে" : "Activated"); }}>{lang === "bn" ? "সক্রিয়" : "Activate"}</ErpButton>}
                {!r.isDefault && r.status !== "ARCHIVED" && <ErpButton size="sm" variant="ghost" icon={<Star size={13} />} onClick={(e) => { e.stopPropagation(); void act(`/seasons/${r.id}/default`, lang === "bn" ? "ডিফল্ট সেট" : "Set as default"); }} style={{ color: GOLD }} />}
                {r.status !== "ARCHIVED" && <ErpButton size="sm" variant="ghost" icon={<SlidersHorizontal size={13} />} onClick={(e) => { e.stopPropagation(); setEdit(r); }} />}
                {r.status !== "ARCHIVED" && <ErpButton size="sm" variant="ghost" icon={<Archive size={13} />} onClick={(e) => { e.stopPropagation(); void act(`/seasons/${r.id}/archive`, lang === "bn" ? "আর্কাইভ করা হয়েছে" : "Archived"); }} style={{ color: ERP.destructive }} />}
              </div>
            )}
          />}
      <ErpModal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? (lang === "bn" ? "সিজন সম্পাদনা" : "Edit Season") : (lang === "bn" ? "নতুন সিজন" : "New Season")}
        footer={<div className="flex gap-2 justify-end"><ErpButton variant="secondary" onClick={() => setEdit(null)}>{lang === "bn" ? "বাতিল" : "Cancel"}</ErpButton><ErpButton variant="primary" loading={busy} onClick={() => void submit()}>{lang === "bn" ? "সংরক্ষণ" : "Save"}</ErpButton></div>}>
        {edit && (
          <ErpForm columns={2}>
            <ErpFormRow span={2}><ErpField label={lang === "bn" ? "নাম" : "Name"} required><ErpInput value={edit.name || ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></ErpField></ErpFormRow>
            <ErpField label={lang === "bn" ? "হিজরি বছর" : "Hijri Year"} required><ErpInput type="number" value={edit.hijriYear ? String(edit.hijriYear) : ""} onChange={(e) => setEdit({ ...edit, hijriYear: Number(e.target.value) })} /></ErpField>
            <ErpField label={lang === "bn" ? "নাম (বাংলা)" : "Name (Bangla)"}><ErpInput value={edit.nameBn || ""} onChange={(e) => setEdit({ ...edit, nameBn: e.target.value })} /></ErpField>
            <ErpField label={lang === "bn" ? "গ্রেগরিয়ান শুরু" : "Gregorian Start"} required><ErpInput type="date" value={fmtD(edit.startDate)} onChange={(e) => setEdit({ ...edit, startDate: e.target.value })} /></ErpField>
            <ErpField label={lang === "bn" ? "গ্রেগরিয়ান শেষ" : "Gregorian End"} required><ErpInput type="date" value={fmtD(edit.endDate)} onChange={(e) => setEdit({ ...edit, endDate: e.target.value })} /></ErpField>
          </ErpForm>
        )}
      </ErpModal>
    </div>
  );
}

// ─── System Configuration — generic key/value store (SystemConfig, one table) ─
const CATS = ["General", "Security", "Notification", "Finance", "Workflow", "Integration", "API", "UI"] as const;
interface SysConfig { id: string; key: string; category: string; description?: string | null; encrypted: boolean; restartRequired: boolean; value: string }
function SystemConfigPanel() {
  const { lang } = useLang();
  const [rows, setRows] = useState<SysConfig[]>([]);
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [edit, setEdit] = useState<(Partial<SysConfig> & { value?: string }) | null>(null);
  const [del, setDel] = useState<SysConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () => {
    setState("loading");
    const p = new URLSearchParams();
    if (q.trim()) p.set("search", q.trim());
    if (cat !== "all") p.set("category", cat);
    api.get<SysConfig[]>(`/system-config?${p.toString()}`).then((d) => { setRows(d); setState("ready"); }).catch(() => setState("error"));
  };
  useEffect(load, [q, cat]);

  const submit = async () => {
    if (!edit || busy) return; setBusy(true);
    const body: Record<string, unknown> = { value: edit.value ?? "", category: edit.category ?? "General", description: edit.description ?? "", encrypted: !!edit.encrypted, restartRequired: !!edit.restartRequired };
    try {
      if (edit.id) await api.patch(`/system-config/${edit.id}`, body);
      else await api.post("/system-config", { ...body, key: edit.key });
      erpToast.success(lang === "bn" ? "কনফিগ সংরক্ষিত" : "Configuration saved", lang); setEdit(null); load();
    } catch (e) { erpToast.error(e instanceof ApiError ? e.message : "Save failed", lang); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!del || busy) return; setBusy(true);
    try { await api.delete(`/system-config/${del.id}`); erpToast.success(lang === "bn" ? "মুছে ফেলা হয়েছে" : "Deleted", lang); setDel(null); load(); }
    catch (e) { erpToast.error(e instanceof ApiError ? e.message : "Delete failed", lang); }
    finally { setBusy(false); }
  };

  const cols: ErpColumn<SysConfig>[] = [
    { id: "key", header: lang === "bn" ? "কী" : "Key", cell: (r) => <span className="text-[11px] font-mono font-semibold" style={{ color: ERP.navy }}>{r.key}</span> },
    { id: "cat", header: lang === "bn" ? "ক্যাটাগরি" : "Category", cell: (r) => <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: erpAlpha(ERP.info, 10), color: ERP.info }}>{r.category}</span> },
    { id: "val", header: lang === "bn" ? "মান" : "Value", cell: (r) => r.encrypted ? <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: ERP.muted }}><Lock size={11} /> ••••••••</span> : <span className="text-xs truncate max-w-[16rem] inline-block align-bottom" style={{ color: ERP.navy }}>{r.value}</span> },
    { id: "enc", header: lang === "bn" ? "এনক্রিপ্ট" : "Encrypted", cell: (r) => r.encrypted ? <ErpStatusChip status={"approved" as ErpStatusKind} label={lang === "bn" ? "হ্যাঁ" : "Yes"} /> : <span style={{ color: ERP.mutedSoft }}>—</span> },
    { id: "restart", header: lang === "bn" ? "রিস্টার্ট" : "Restart", cell: (r) => r.restartRequired ? <ErpStatusChip status={"warning" as ErpStatusKind} label={lang === "bn" ? "প্রয়োজন" : "Required"} /> : <span style={{ color: ERP.mutedSoft }}>—</span> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="flex-1 min-w-0"><ErpSearchBar lang={lang} value={q} onChange={(e) => setQ(e.target.value)} onClear={() => setQ("")} placeholder={lang === "bn" ? "কী বা ক্যাটাগরি খুঁজুন..." : "Search key, category…"} /></div>
        <div className="w-full sm:w-52"><ErpSelect value={cat} onChange={(e) => setCat(e.target.value)}><option value="all">{lang === "bn" ? "সব ক্যাটাগরি" : "All categories"}</option>{CATS.map((c) => <option key={c} value={c}>{c}</option>)}</ErpSelect></div>
        <ErpButton variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setEdit({ category: "General", encrypted: false, restartRequired: false })}>{lang === "bn" ? "নতুন কনফিগ" : "New config"}</ErpButton>
      </div>
      {state === "error"
        ? <ErrorState tone="light" onRetry={load} />
        : <ErpDataTable columns={cols} rows={state === "ready" ? rows : []} rowKey={(r) => r.id} loading={state === "loading"} lang={lang}
            emptyTitle={lang === "bn" ? "কোনো কনফিগ নেই" : "No configuration"} emptyHint={lang === "bn" ? "নতুন কনফিগ যোগ করুন।" : "Add a configuration entry."}
            rowActions={(r) => (<div className="flex gap-1">
              <ErpButton size="sm" variant="ghost" icon={<SlidersHorizontal size={13} />} onClick={(e) => { e.stopPropagation(); setEdit({ ...r, value: "" }); }} />
              <ErpButton size="sm" variant="ghost" icon={<Trash2 size={13} />} onClick={(e) => { e.stopPropagation(); setDel(r); }} style={{ color: ERP.destructive }} />
            </div>)}
          />}

      <ErpModal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? (lang === "bn" ? "কনফিগ সম্পাদনা" : "Edit configuration") : (lang === "bn" ? "নতুন কনফিগ" : "New configuration")}
        footer={<div className="flex gap-2 justify-end"><ErpButton variant="secondary" onClick={() => setEdit(null)}>{lang === "bn" ? "বাতিল" : "Cancel"}</ErpButton><ErpButton variant="primary" loading={busy} onClick={() => void submit()}>{lang === "bn" ? "সংরক্ষণ" : "Save"}</ErpButton></div>}>
        {edit && (
          <ErpForm columns={2}>
            <ErpField label={lang === "bn" ? "কী" : "Key"} required hint={edit.id ? (lang === "bn" ? "কী পরিবর্তন করা যাবে না" : "Key cannot be changed") : undefined}><ErpInput value={edit.key || ""} disabled={!!edit.id} onChange={(e) => setEdit({ ...edit, key: e.target.value })} placeholder="api.stripe_key" /></ErpField>
            <ErpField label={lang === "bn" ? "ক্যাটাগরি" : "Category"} required><ErpSelect value={edit.category || "General"} onChange={(e) => setEdit({ ...edit, category: e.target.value })}>{CATS.map((c) => <option key={c} value={c}>{c}</option>)}</ErpSelect></ErpField>
            <ErpFormRow span={2}><ErpField label={lang === "bn" ? "মান" : "Value"} hint={edit.id && edit.encrypted ? (lang === "bn" ? "নতুন মান দিলে পুনরায় এনক্রিপ্ট হবে" : "Enter a new value to re-encrypt") : undefined}><ErpInput type={edit.encrypted ? "password" : "text"} value={edit.value || ""} onChange={(e) => setEdit({ ...edit, value: e.target.value })} /></ErpField></ErpFormRow>
            <ErpFormRow span={2}><ErpField label={lang === "bn" ? "বর্ণনা" : "Description"}><ErpInput value={edit.description || ""} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></ErpField></ErpFormRow>
            <div className="flex items-center justify-between rounded-xl px-4 py-3" style={{ backgroundColor: ERP.surfaceSoft, border: `1px solid ${ERP.border}` }}><span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[color:var(--erp-text-strong)]"><Lock size={12} /> {lang === "bn" ? "এনক্রিপ্ট" : "Encrypted"}</span><ErpToggle on={!!edit.encrypted} onToggle={() => setEdit({ ...edit, encrypted: !edit.encrypted })} ariaLabel="encrypted" /></div>
            <div className="flex items-center justify-between rounded-xl px-4 py-3" style={{ backgroundColor: ERP.surfaceSoft, border: `1px solid ${ERP.border}` }}><span className="text-xs font-semibold text-[color:var(--erp-text-strong)]">{lang === "bn" ? "রিস্টার্ট প্রয়োজন" : "Restart required"}</span><ErpToggle on={!!edit.restartRequired} onToggle={() => setEdit({ ...edit, restartRequired: !edit.restartRequired })} ariaLabel="restart required" /></div>
          </ErpForm>
        )}
      </ErpModal>

      <ErpModal open={!!del} onClose={() => setDel(null)} title={lang === "bn" ? "কনফিগ মুছবেন?" : "Delete configuration?"}
        footer={<div className="flex gap-2 justify-end"><ErpButton variant="secondary" onClick={() => setDel(null)}>{lang === "bn" ? "বাতিল" : "Cancel"}</ErpButton><ErpButton variant="danger" loading={busy} onClick={() => void remove()}>{lang === "bn" ? "মুছুন" : "Delete"}</ErpButton></div>}>
        <p className="text-sm font-mono" style={{ color: ERP.muted }}>{del?.key}</p>
      </ErpModal>
    </div>
  );
}

// ─── Backup Status — READ-ONLY; reads published metadata from SystemConfig ────
// Never runs/restores/deletes backups. Never fabricates: shows only real
// "Backup" category config; if none, an honest EmptyState.
function BackupStatusPanel() {
  const { lang } = useLang();
  const [map, setMap] = useState<Record<string, { value: string; encrypted: boolean }>>({});
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const load = () => {
    setState("loading");
    api.get<{ key: string; value: string; encrypted: boolean }[]>("/system-config?category=Backup")
      .then((rows) => { const m: Record<string, { value: string; encrypted: boolean }> = {}; rows.forEach((r) => { m[r.key] = { value: r.value, encrypted: r.encrypted }; }); setMap(m); setState("ready"); })
      .catch(() => setState("error"));
  };
  useEffect(load, []);
  if (state === "loading") return <LoadingSkeleton tone="light" rows={5} />;
  if (state === "error") return <ErrorState tone="light" onRetry={load} />;

  if (Object.keys(map).length === 0) {
    return (
      <EmptyState
        tone="light"
        title={lang === "bn" ? "ব্যাকআপ মনিটরিং সংযুক্ত নয়" : "Backup monitoring not connected"}
        hint={lang === "bn"
          ? "এখনো কোনো ব্যাকআপ মেটাডেটা প্রকাশিত হয়নি। কোনো ব্যাকআপ প্রসেস System Configuration → Backup ক্যাটাগরিতে স্ট্যাটাস প্রকাশ করলে তা এখানে দেখা যাবে। এই প্যানেল রিড-অনলি — এটি কখনো ব্যাকআপ চালায় না।"
          : "No backup metadata is published yet. When a backup process publishes status under System Configuration → Backup, it will appear here. This panel is read-only and never runs, restores, or deletes backups."}
      />
    );
  }

  const F = (k: string) => { const v = map[k]; return v ? (v.encrypted ? "••••••••" : (v.value || "—")) : "—"; };
  const health = F("backup.health"), status = F("backup.status");
  const kind = (v: string): ErpStatusKind => /healthy|ok|pass|success|green/i.test(v) ? "approved" : /warn|degrad|amber/i.test(v) ? "warning" : /fail|error|red|critical/i.test(v) ? "rejected" : "info";
  const fields: [string, string, ReactNode][] = [
    [lang === "bn" ? "শেষ ব্যাকআপ" : "Last Backup", F("backup.lastBackup"), <Clock size={13} />],
    [lang === "bn" ? "পরবর্তী নির্ধারিত" : "Next Scheduled Backup", F("backup.nextScheduled"), <CalendarDays size={13} />],
    [lang === "bn" ? "ব্যাকআপ সাইজ" : "Backup Size", F("backup.size"), <HardDrive size={13} />],
    [lang === "bn" ? "স্টোরেজ লোকেশন" : "Storage Location", F("backup.storageLocation"), <HardDrive size={13} />],
    [lang === "bn" ? "রিটেনশন পলিসি" : "Retention Policy", F("backup.retention"), <Archive size={13} />],
    [lang === "bn" ? "শেষ রিস্টোর টেস্ট" : "Last Restore Test", F("backup.lastRestoreTest"), <ShieldCheck size={13} />],
  ];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: ERP.muted }}>{lang === "bn" ? "স্বাস্থ্য" : "Backup Health"}</span>
        <ErpStatusChip status={kind(health)} label={health} />
        <span className="text-[10px] font-bold uppercase tracking-widest ml-3" style={{ color: ERP.muted }}>{lang === "bn" ? "স্ট্যাটাস" : "Status"}</span>
        <ErpStatusChip status={kind(status)} label={status} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {fields.map(([label, value, icon]) => (
          <div key={label} className="rounded-xl px-4 py-3" style={{ backgroundColor: ERP.surfaceSoft, border: `1px solid ${ERP.border}` }}>
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: ERP.muted }}>{icon} {label}</div>
            <div className="text-sm font-semibold text-[color:var(--erp-text-strong)]">{value}</div>
          </div>
        ))}
      </div>
      <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl" style={{ backgroundColor: erpAlpha(ERP.info, 6), border: `1px solid ${erpAlpha(ERP.info, 15)}` }}>
        <ShieldCheck size={13} style={{ color: ERP.info }} className="mt-0.5 shrink-0" />
        <p className="text-[11px]" style={{ color: ERP.muted }}>{lang === "bn" ? "রিড-অনলি — এই প্যানেল কখনো ব্যাকআপ চালায় না, রিস্টোর করে না বা মুছে না। মানগুলো শুধু প্রকাশিত মেটাডেটা প্রতিফলিত করে।" : "Read-only — this panel never runs, restores, or deletes backups. Values reflect published metadata only."}</p>
      </div>
    </div>
  );
}

// ─── Feature Flags — single flag store (FeatureFlag, one table) ───────────────
const FLAG_CATS = ["General", "AI", "Operations", "Finance", "Portal", "Reports", "Experimental", "API"] as const;
interface FFlag { id: string; key: string; name: string; category: string; description?: string | null; enabled: boolean }
function FeatureFlagsPanel() {
  const { lang } = useLang();
  const [rows, setRows] = useState<FFlag[]>([]);
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [edit, setEdit] = useState<Partial<FFlag> | null>(null);
  const [del, setDel] = useState<FFlag | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () => {
    setState("loading");
    const p = new URLSearchParams();
    if (q.trim()) p.set("search", q.trim());
    if (cat !== "all") p.set("category", cat);
    api.get<FFlag[]>(`/feature-flags?${p.toString()}`).then((d) => { setRows(d); setState("ready"); }).catch(() => setState("error"));
  };
  useEffect(load, [q, cat]);

  const toggle = async (f: FFlag) => {
    setRows((rs) => rs.map((r) => (r.id === f.id ? { ...r, enabled: !r.enabled } : r))); // optimistic
    try { await api.patch(`/feature-flags/${f.id}`, { enabled: !f.enabled }); erpToast.success(!f.enabled ? (lang === "bn" ? "সক্রিয়" : "Enabled") : (lang === "bn" ? "নিষ্ক্রিয়" : "Disabled"), lang); }
    catch (e) { setRows((rs) => rs.map((r) => (r.id === f.id ? { ...r, enabled: f.enabled } : r))); erpToast.error(e instanceof ApiError ? e.message : "Failed", lang); }
  };
  const submit = async () => {
    if (!edit || busy) return; setBusy(true);
    const body = { name: edit.name, category: edit.category ?? "General", description: edit.description ?? "", enabled: !!edit.enabled };
    try {
      if (edit.id) await api.patch(`/feature-flags/${edit.id}`, body);
      else await api.post("/feature-flags", { ...body, key: edit.key });
      erpToast.success(lang === "bn" ? "ফ্ল্যাগ সংরক্ষিত" : "Flag saved", lang); setEdit(null); load();
    } catch (e) { erpToast.error(e instanceof ApiError ? e.message : "Save failed", lang); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!del || busy) return; setBusy(true);
    try { await api.delete(`/feature-flags/${del.id}`); erpToast.success(lang === "bn" ? "মুছে ফেলা হয়েছে" : "Deleted", lang); setDel(null); load(); }
    catch (e) { erpToast.error(e instanceof ApiError ? e.message : "Delete failed", lang); }
    finally { setBusy(false); }
  };

  const cols: ErpColumn<FFlag>[] = [
    { id: "key", header: lang === "bn" ? "কী" : "Key", cell: (r) => <span className="text-[11px] font-mono font-semibold" style={{ color: ERP.navy }}>{r.key}</span> },
    { id: "name", header: lang === "bn" ? "নাম" : "Name", cell: (r) => <span className="text-xs font-semibold text-[color:var(--erp-text-strong)]">{r.name}</span> },
    { id: "cat", header: lang === "bn" ? "ক্যাটাগরি" : "Category", cell: (r) => <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: erpAlpha(ERP.info, 10), color: ERP.info }}>{r.category}</span> },
    { id: "desc", header: lang === "bn" ? "বর্ণনা" : "Description", cell: (r) => <span className="text-[11px] truncate max-w-[16rem] inline-block align-bottom" style={{ color: ERP.muted }}>{r.description || "—"}</span> },
    { id: "state", header: lang === "bn" ? "স্ট্যাটাস" : "Status", cell: (r) => <ErpStatusChip status={(r.enabled ? "approved" : "rejected") as ErpStatusKind} label={r.enabled ? (lang === "bn" ? "সক্রিয়" : "Enabled") : (lang === "bn" ? "নিষ্ক্রিয়" : "Disabled")} /> },
    { id: "toggle", header: lang === "bn" ? "চালু/বন্ধ" : "Toggle", cell: (r) => <ErpToggle on={r.enabled} onToggle={() => void toggle(r)} ariaLabel={`toggle ${r.key}`} /> },
  ];

  return (
    <div className="space-y-4">
      <ErpSectionHeader
        title={lang === "bn" ? "ফিচার ফ্ল্যাগ" : "Feature Flags"}
        subtitle={lang === "bn" ? "মডিউল ও ফিচার চালু/বন্ধ করুন" : "Enable or disable modules & features"}
        action={<ErpButton variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setEdit({ category: "General", enabled: false })}>{lang === "bn" ? "নতুন ফ্ল্যাগ" : "New flag"}</ErpButton>}
      />
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="flex-1 min-w-0"><ErpSearchBar lang={lang} value={q} onChange={(e) => setQ(e.target.value)} onClear={() => setQ("")} placeholder={lang === "bn" ? "কী, নাম বা ক্যাটাগরি খুঁজুন..." : "Search key, name, category…"} /></div>
        <div className="w-full sm:w-52"><ErpSelect value={cat} onChange={(e) => setCat(e.target.value)}><option value="all">{lang === "bn" ? "সব ক্যাটাগরি" : "All categories"}</option>{FLAG_CATS.map((c) => <option key={c} value={c}>{c}</option>)}</ErpSelect></div>
      </div>
      {state === "error"
        ? <ErrorState tone="light" onRetry={load} />
        : <ErpDataTable columns={cols} rows={state === "ready" ? rows : []} rowKey={(r) => r.id} loading={state === "loading"} lang={lang}
            emptyTitle={lang === "bn" ? "কোনো ফ্ল্যাগ নেই" : "No feature flags"} emptyHint={lang === "bn" ? "নতুন ফ্ল্যাগ যোগ করুন।" : "Add a feature flag."}
            rowActions={(r) => (<div className="flex gap-1">
              <ErpButton size="sm" variant="ghost" icon={<SlidersHorizontal size={13} />} onClick={(e) => { e.stopPropagation(); setEdit(r); }} />
              <ErpButton size="sm" variant="ghost" icon={<Trash2 size={13} />} onClick={(e) => { e.stopPropagation(); setDel(r); }} style={{ color: ERP.destructive }} />
            </div>)}
          />}

      <ErpModal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? (lang === "bn" ? "ফ্ল্যাগ সম্পাদনা" : "Edit flag") : (lang === "bn" ? "নতুন ফ্ল্যাগ" : "New flag")}
        footer={<div className="flex gap-2 justify-end"><ErpButton variant="secondary" onClick={() => setEdit(null)}>{lang === "bn" ? "বাতিল" : "Cancel"}</ErpButton><ErpButton variant="primary" loading={busy} onClick={() => void submit()}>{lang === "bn" ? "সংরক্ষণ" : "Save"}</ErpButton></div>}>
        {edit && (
          <ErpForm columns={2}>
            <ErpField label={lang === "bn" ? "কী" : "Key"} required hint={edit.id ? (lang === "bn" ? "কী পরিবর্তন করা যাবে না" : "Key cannot be changed") : "UPPER_SNAKE_CASE"}><ErpInput value={edit.key || ""} disabled={!!edit.id} onChange={(e) => setEdit({ ...edit, key: e.target.value.toUpperCase() })} placeholder="MY_FEATURE" /></ErpField>
            <ErpField label={lang === "bn" ? "নাম" : "Name"} required><ErpInput value={edit.name || ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></ErpField>
            <ErpField label={lang === "bn" ? "ক্যাটাগরি" : "Category"} required><ErpSelect value={edit.category || "General"} onChange={(e) => setEdit({ ...edit, category: e.target.value })}>{FLAG_CATS.map((c) => <option key={c} value={c}>{c}</option>)}</ErpSelect></ErpField>
            <div className="flex items-center justify-between rounded-xl px-4 py-3" style={{ backgroundColor: ERP.surfaceSoft, border: `1px solid ${ERP.border}` }}><span className="text-xs font-semibold text-[color:var(--erp-text-strong)]">{lang === "bn" ? "সক্রিয়" : "Enabled"}</span><ErpToggle on={!!edit.enabled} onToggle={() => setEdit({ ...edit, enabled: !edit.enabled })} ariaLabel="enabled" /></div>
            <ErpFormRow span={2}><ErpField label={lang === "bn" ? "বর্ণনা" : "Description"}><ErpInput value={edit.description || ""} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></ErpField></ErpFormRow>
          </ErpForm>
        )}
      </ErpModal>

      <ErpModal open={!!del} onClose={() => setDel(null)} title={lang === "bn" ? "ফ্ল্যাগ মুছবেন?" : "Delete flag?"}
        footer={<div className="flex gap-2 justify-end"><ErpButton variant="secondary" onClick={() => setDel(null)}>{lang === "bn" ? "বাতিল" : "Cancel"}</ErpButton><ErpButton variant="danger" loading={busy} onClick={() => void remove()}>{lang === "bn" ? "মুছুন" : "Delete"}</ErpButton></div>}>
        <p className="text-sm font-mono" style={{ color: ERP.muted }}>{del?.key}</p>
      </ErpModal>
    </div>
  );
}

// ─── Section chrome ──────────────────────────────────────────────────────────
function SectionShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="p-7">
      <div className="mb-5"><h2 className="text-sm font-bold text-[color:var(--erp-text-strong)]">{title}</h2>{subtitle && <p className="text-xs mt-0.5" style={{ color: ERP.muted }}>{subtitle}</p>}</div>
      <div className="rounded-xl p-6" style={{ backgroundColor: ERP.surface, border: `1px solid ${ERP.border}` }}>{children}</div>
    </div>
  );
}

// ─── Shell ───────────────────────────────────────────────────────────────────
export default function Settings() {
  const { lang } = useLang();
  const navigate = useNavigate();
  const [section, setSection] = useState<Section>("overview");

  const canSys = canAccessPath("/wasender-config");     // MANAGE_SYSTEM_SETTINGS
  const canCompany = canAccessPath("/super-admin");     // APPROVE_COMPANIES et al

  const internalNav: (NavItem & { section: Section })[] = [
    { id: "overview",     section: "overview",     label: "Overview",        labelBn: "সারসংক্ষেপ",  icon: SettingsIcon as IconFC },
    ...(canCompany ? [{ id: "company", section: "company" as Section, label: "Company Settings", labelBn: "কোম্পানি সেটিংস", icon: Building2 as IconFC }] : []),
    ...(canSys ? [
      { id: "security",     section: "security" as Section,     label: "Security Policy",  labelBn: "নিরাপত্তা নীতি", icon: Shield    as IconFC },
      { id: "approvals",    section: "approvals" as Section,    label: "Approval Matrix",  labelBn: "অনুমোদন ম্যাট্রিক্স", icon: GitBranch as IconFC },
      { id: "seasons",      section: "seasons" as Section,      label: "Season Management", labelBn: "সিজন ব্যবস্থাপনা", icon: CalendarDays as IconFC },
      { id: "sysconfig",    section: "sysconfig" as Section,    label: "System Configuration", labelBn: "সিস্টেম কনফিগ", icon: SettingsIcon as IconFC },
      { id: "flags",        section: "flags" as Section,        label: "Feature Flags",    labelBn: "ফিচার ফ্ল্যাগ", icon: Flag as IconFC },
      { id: "backup",       section: "backup" as Section,       label: "Backup Status",    labelBn: "ব্যাকআপ স্ট্যাটাস", icon: HardDrive as IconFC },
      { id: "integrations", section: "integrations" as Section, label: "Integrations",     labelBn: "ইন্টিগ্রেশন",   icon: Plug      as IconFC },
    ] : []),
  ];
  const links = REUSE_LINKS.filter((l) => canAccessPath(l.path));
  const navItems: NavItem[] = [...internalNav.map(({ section: _s, ...n }) => n), ...links.map((l) => ({ id: l.id, label: l.label, labelBn: l.labelBn, icon: l.icon }))];

  const onNav = (id: string) => {
    const link = links.find((l) => l.id === id);
    if (link) { navigate(link.path); return; }
    const item = internalNav.find((n) => n.id === id);
    if (item) setSection(item.section);
  };

  const LABELS: Record<Section, string> = {
    overview: lang === "bn" ? "সারসংক্ষেপ" : "Overview",
    company: lang === "bn" ? "কোম্পানি সেটিংস" : "Company Settings",
    security: lang === "bn" ? "নিরাপত্তা নীতি" : "Security Policy",
    approvals: lang === "bn" ? "অনুমোদন ম্যাট্রিক্স" : "Approval Matrix",
    seasons: lang === "bn" ? "সিজন ব্যবস্থাপনা" : "Season Management",
    sysconfig: lang === "bn" ? "সিস্টেম কনফিগারেশন" : "System Configuration",
    flags: lang === "bn" ? "ফিচার ফ্ল্যাগ" : "Feature Flags",
    backup: lang === "bn" ? "ব্যাকআপ স্ট্যাটাস" : "Backup Status",
    integrations: lang === "bn" ? "ইন্টিগ্রেশন" : "Integrations",
  };

  const body = useMemo(() => {
    switch (section) {
      case "company": return <SectionShell title={LABELS.company} subtitle={lang === "bn" ? "আপনার সংস্থার প্রোফাইল" : "Your organization profile"}><CompanySettings /></SectionShell>;
      case "security": return <SectionShell title={LABELS.security} subtitle={lang === "bn" ? "সেশন ও ইম্পারসোনেশন নীতি" : "Session & impersonation policy"}><SecurityPolicyPanel /></SectionShell>;
      case "approvals": return <SectionShell title={LABELS.approvals} subtitle={lang === "bn" ? "কনফিগারযোগ্য অনুমোদন নিয়ম" : "Configurable approval rules"}><ApprovalMatrix /></SectionShell>;
      case "seasons": return <SectionShell title={LABELS.seasons} subtitle={lang === "bn" ? "সিজন তৈরি · সক্রিয়করণ · আর্কাইভ · ডিফল্ট" : "Create · activate · archive · set default"}><SeasonManagement /></SectionShell>;
      case "sysconfig": return <SectionShell title={LABELS.sysconfig} subtitle={lang === "bn" ? "জেনেরিক কী/ভ্যালু কনফিগ · এনক্রিপশন · ক্যাটাগরি" : "Generic key/value config · encryption · categories"}><SystemConfigPanel /></SectionShell>;
      case "flags": return <SectionShell title={LABELS.flags} subtitle={lang === "bn" ? "মডিউল ও ফিচার টগল" : "Module & feature toggles"}><FeatureFlagsPanel /></SectionShell>;
      case "backup": return <SectionShell title={LABELS.backup} subtitle={lang === "bn" ? "রিড-অনলি ব্যাকআপ মনিটরিং" : "Read-only backup monitoring"}><BackupStatusPanel /></SectionShell>;
      case "integrations": return <SectionShell title={LABELS.integrations} subtitle={lang === "bn" ? "WhatsApp · ইমেইল" : "WhatsApp · Email (SMTP)"}><IntegrationHub /></SectionShell>;
      default: return (
        <div className="p-7">
          <div className="mb-5"><h2 className="text-sm font-bold text-[color:var(--erp-text-strong)]">{lang === "bn" ? "সিস্টেম প্রশাসন" : "System Administration"}</h2><p className="text-xs mt-0.5" style={{ color: ERP.muted }}>{lang === "bn" ? "সব প্রশাসনিক সেটিংস এক জায়গায়" : "All administration settings in one place"}</p></div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {internalNav.filter((n) => n.id !== "overview").map((n) => { const I = n.icon; return (
              <button key={n.id} onClick={() => setSection(n.section)} className="text-left rounded-xl p-5 transition-colors" style={{ backgroundColor: ERP.surface, border: `1px solid ${ERP.border}` }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: erpAlpha(GOLD, 9) }}><I size={16} style={{ color: GOLD }} /></div>
                <div className="text-xs font-bold text-[color:var(--erp-text-strong)]">{lang === "bn" ? n.labelBn : n.label}</div>
              </button>
            ); })}
            {links.map((l) => { const I = l.icon; return (
              <button key={l.id} onClick={() => navigate(l.path)} className="text-left rounded-xl p-5 transition-colors" style={{ backgroundColor: ERP.surfaceSoft, border: `1px solid ${ERP.border}` }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: erpAlpha(ERP.info, 9) }}><I size={16} style={{ color: ERP.info }} /></div>
                <div className="text-xs font-bold text-[color:var(--erp-text-strong)] flex items-center gap-1">{lang === "bn" ? l.labelBn : l.label}<ExternalLink size={11} style={{ color: ERP.muted }} /></div>
              </button>
            ); })}
          </div>
        </div>
      );
    }
  }, [section, lang, internalNav, links]);

  return (
    <ErpThemeProvider theme="ds"><ERPShell
      moduleId="settings"
      moduleName={lang === "bn" ? "সিস্টেম প্রশাসন" : "System Administration"}
      moduleColor={GOLD}
      moduleIcon={SettingsIcon as IconFC}
      navItems={navItems}
      activeItem={links.some((l) => l.id === section) ? "" : section}
      onItemClick={onNav}
      breadcrumb={[lang === "bn" ? "সেটিংস" : "Settings", LABELS[section]]}
      notificationCount={0}
    >
      <div className="flex flex-col h-full overflow-hidden" style={{ fontFamily: fontFor(lang) }}>
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>{body}</div>
      </div>
    </ERPShell></ErpThemeProvider>
  );
}
