import { useState, type ReactNode } from "react";
import {
  Plane, Building, Bus, UtensilsCrossed, Wallet, Truck,
  FileText, ScanLine, Bell, LayoutDashboard, Zap, User,
  Building2, BookOpen, FileCheck, ChevronRight, ChevronDown,
  ChevronLeft, ChevronUp, Search, Globe, Check, X, Clock,
  Upload, Loader2, MoreHorizontal, Settings, LogOut, MapPin,
  Calendar, TrendingUp, TrendingDown, Filter, AlignLeft,
  Users, Layers, Package, Star, LayoutGrid, CheckCircle,
  AlertCircle, Info, ArrowUp, ArrowDown, Eye, Plus,
  ArrowRight, Home
} from "lucide-react";

const NAVY = "#0B1E3F";
const GOLD = "#C9A24B";
const WARM = "#F4F1EC";

const MODULES = [
  { id: "visa", name: "Visa", ar: "التأشيرة", icon: FileCheck, color: "#0D9488", bg: "#F0FDFA", tx: "#0F766E", count: 23 },
  { id: "hotel", name: "Hotel", ar: "الفندق", icon: Building, color: "#2563EB", bg: "#EFF6FF", tx: "#1D4ED8", count: 8 },
  { id: "transport", name: "Transport", ar: "النقل", icon: Bus, color: "#EA580C", bg: "#FFF7ED", tx: "#C2410C", count: 12 },
  { id: "catering", name: "Catering", ar: "التموين", icon: UtensilsCrossed, color: "#9333EA", bg: "#FAF5FF", tx: "#7E22CE", count: 0 },
  { id: "finance", name: "Finance", ar: "المالية", icon: Wallet, color: "#16A34A", bg: "#F0FDF4", tx: "#15803D", count: 5 },
  { id: "fleet", name: "Fleet", ar: "الأسطول", icon: Truck, color: "#475569", bg: "#F8FAFC", tx: "#334155", count: 3 },
  { id: "dispatch", name: "Dispatch / Ops", ar: "العمليات", icon: Zap, color: "#DC4E2A", bg: "#FEF3EE", tx: "#C2410C", count: 7 },
  { id: "documents", name: "Documents", ar: "الوثائق", icon: FileText, color: "#4F46E5", bg: "#EEF2FF", tx: "#4338CA", count: 15 },
];

const STATUSES = [
  { key: "pending", label: "Pending", ar: "قيد الانتظار", bg: "#FFFBEB", border: "#B45309", tx: "#92400E", dot: "#D97706" },
  { key: "verified", label: "Verified", ar: "تم التحقق", bg: "#F0FDF4", border: "#16A34A", tx: "#14532D", dot: "#16A34A" },
  { key: "rejected", label: "Rejected", ar: "مرفوض", bg: "#FEF2F2", border: "#DC2626", tx: "#991B1B", dot: "#DC2626" },
  { key: "in_progress", label: "In Progress", ar: "قيد التنفيذ", bg: "#EFF6FF", border: "#2563EB", tx: "#1E40AF", dot: "#2563EB" },
  { key: "completed", label: "Completed", ar: "مكتمل", bg: "#F0FDFA", border: "#99F6E4", tx: "#115E59", dot: "#0D9488" },
];

const NAVY_SCALE = [
  { n: "50", v: "#EEF2F8" }, { n: "100", v: "#D6E0EF" }, { n: "200", v: "#ADC2DF" },
  { n: "300", v: "#6E94C0" }, { n: "400", v: "#3D6498" }, { n: "500", v: "#1E3F7A" },
  { n: "600", v: "#162D5A" }, { n: "700", v: "#0F2048" }, { n: "800", v: "#0A1533" },
  { n: "900", v: "#05091F" },
];
const GOLD_SCALE = [
  { n: "50", v: "#FBF5E6" }, { n: "100", v: "#F5E9C8" }, { n: "200", v: "#EDD397" },
  { n: "300", v: "#E2B966" }, { n: "400", v: "#D9A84E" }, { n: "500", v: "#C9A24B" },
  { n: "600", v: "#A87D2F" }, { n: "700", v: "#855E1E" }, { n: "800", v: "#5E4115" },
  { n: "900", v: "#3A270C" },
];
const GRAY_SCALE = [
  { n: "50", v: "#F9FAFB" }, { n: "100", v: "#F3F4F6" }, { n: "200", v: "#E5E7EB" },
  { n: "300", v: "#D1D5DB" }, { n: "400", v: "#9CA3AF" }, { n: "500", v: "#6B7280" },
  { n: "600", v: "#4B5563" }, { n: "700", v: "#374151" }, { n: "800", v: "#1F2937" },
  { n: "900", v: "#111827" },
];
const STATUS_COLORS = [
  { name: "Success", hex: "#16A34A", bg: "#F0FDF4", tx: "#14532D", label: "Confirmed" },
  { name: "Warning", hex: "#D97706", bg: "#FFFBEB", tx: "#92400E", label: "Pending" },
  { name: "Danger", hex: "#DC2626", bg: "#FEF2F2", tx: "#991B1B", label: "Rejected" },
  { name: "Info", hex: "#2563EB", bg: "#EFF6FF", tx: "#1E40AF", label: "Processing" },
];
const TYPE_SCALE = [
  { name: "Display", cls: "text-5xl font-bold", sample: "Ground Operations Management", meta: "48px · Bold" },
  { name: "H1", cls: "text-4xl font-bold", sample: "Umrah Season 1446H Overview", meta: "36px · Bold" },
  { name: "H2", cls: "text-3xl font-semibold", sample: "Visa Processing Dashboard", meta: "28px · Semibold" },
  { name: "H3", cls: "text-2xl font-semibold", sample: "Hotel Accommodation Status", meta: "22px · Semibold" },
  { name: "H4", cls: "text-lg font-semibold", sample: "Pilgrim Transport Schedule — Makkah Zone A", meta: "18px · Semibold" },
  { name: "Body Large", cls: "text-lg font-normal", sample: "Managing pilgrim logistics across Makkah, Madinah and Jeddah with full operational visibility.", meta: "18px · Regular" },
  { name: "Body Regular", cls: "text-base font-normal", sample: "Visa application submitted for review. Documentation pending verification by Ministry of Hajj and Umrah.", meta: "16px · Regular" },
  { name: "Body Small", cls: "text-sm font-normal", sample: "Status updated by operations supervisor. Awaiting confirmation from transport coordinator.", meta: "14px · Regular" },
  { name: "Caption", cls: "text-xs font-normal", sample: "Last updated: 14 Dhul Hijja 1446H · 12:34 AST · System ID: OPS-9827", meta: "12px · Regular" },
  { name: "Label / Overline", cls: "text-xs font-semibold uppercase tracking-[0.15em]", sample: "MODULE STATUS · VISA PROCESSING · ACTIVE", meta: "11px · Semibold · Uppercase" },
];
const SPACING_SCALE = [4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96];
const ICON_SHEET = [
  { name: "Passport", module: "Identity", icon: BookOpen },
  { name: "Visa", module: "Visa", icon: FileCheck },
  { name: "Flight", module: "Transport", icon: Plane },
  { name: "Hotel", module: "Hotel", icon: Building },
  { name: "Transport", module: "Transport", icon: Bus },
  { name: "Catering", module: "Catering", icon: UtensilsCrossed },
  { name: "Finance", module: "Finance", icon: Wallet },
  { name: "Fleet", module: "Fleet", icon: Truck },
  { name: "Document", module: "Documents", icon: FileText },
  { name: "OCR / Scan", module: "Documents", icon: ScanLine },
  { name: "Notification", module: "System", icon: Bell },
  { name: "Dashboard", module: "System", icon: LayoutDashboard },
  { name: "Dispatch", module: "Ops", icon: Zap },
  { name: "User", module: "System", icon: User },
  { name: "Supplier", module: "Finance", icon: Building2 },
  { name: "Location", module: "Transport", icon: MapPin },
  { name: "Calendar", module: "System", icon: Calendar },
  { name: "Search", module: "System", icon: Search },
  { name: "Filter", module: "System", icon: Filter },
  { name: "Settings", module: "System", icon: Settings },
];
const TABLE_DATA = [
  { id: "VA-1446-001", name: "Ahmad Al-Rashidi", nameAr: "أحمد الراشدي", passport: "SA901234567", nat: "Saudi Arabia", date: "14 Dhul Hijja 1446", status: "verified" },
  { id: "VA-1446-002", name: "Fatima Karimi", nameAr: "فاطمة كريمي", passport: "IR234567890", nat: "Iran", date: "14 Dhul Hijja 1446", status: "pending" },
  { id: "VA-1446-003", name: "Hassan Al-Bakri", nameAr: "حسن البكري", passport: "EG345678901", nat: "Egypt", date: "13 Dhul Hijja 1446", status: "in_progress" },
  { id: "VA-1446-004", name: "Aisha Mohammed", nameAr: "عائشة محمد", passport: "PK456789012", nat: "Pakistan", date: "13 Dhul Hijja 1446", status: "rejected" },
  { id: "VA-1446-005", name: "Omar Al-Turki", nameAr: "عمر التركي", passport: "TR567890123", nat: "Turkey", date: "12 Dhul Hijja 1446", status: "completed" },
];
const NAV_SECTIONS = [
  { id: "brand", label: "Brand Identity", icon: Star, color: GOLD },
  { id: "colors", label: "Color System", icon: Layers, color: "#0D9488" },
  { id: "typography", label: "Typography", icon: AlignLeft, color: "#2563EB" },
  { id: "spacing", label: "Spacing & Grid", icon: LayoutGrid, color: "#475569" },
  { id: "components", label: "Components", icon: Package, color: "#9333EA" },
  { id: "icons", label: "Iconography", icon: Eye, color: "#EA580C" },
];

function LogoMark({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <path d="M14.5 3H33.5L45 14.5V33.5L33.5 45H14.5L3 33.5V14.5L14.5 3Z" fill={NAVY} />
      <path d="M13 15H35V19H27V34H21V19H13V15Z" fill={GOLD} />
      <circle cx="37" cy="11" r="4" fill="none" stroke={GOLD} strokeWidth="1.5" opacity="0.7" />
      <circle cx="38.5" cy="9.8" r="3.2" fill={NAVY} />
      <circle cx="37" cy="11" r="1" fill={GOLD} opacity="0.5" />
    </svg>
  );
}
function Btn({ variant = "primary", size = "md", disabled = false, loading = false, children, className = "", onClick }: { variant?: "primary"|"accent"|"secondary"|"ghost"|"danger"; size?: "sm"|"md"|"lg"; disabled?: boolean; loading?: boolean; children: ReactNode; className?: string; onClick?: () => void; }) {
  const base = "inline-flex items-center justify-center font-semibold tracking-tight transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed select-none whitespace-nowrap";
  const v = { primary: "text-white hover:bg-[#162D5A]", accent: "hover:bg-[#DDB96A]", secondary: "border-2 hover:text-[#0B1E3F] bg-transparent", ghost: "hover:bg-[#EDE9E3] bg-transparent", danger: "bg-[#DC2626] text-white hover:bg-[#B91C1C]" };
  const s = { sm: "text-xs px-3 py-1.5 rounded gap-1.5", md: "text-sm px-4 py-2 rounded-lg gap-2", lg: "text-base px-6 py-3 rounded-lg gap-2.5" };
  const st: React.CSSProperties = variant==="primary"?{backgroundColor:NAVY}:variant==="accent"?{backgroundColor:GOLD,color:NAVY}:variant==="secondary"?{borderColor:NAVY,color:NAVY}:variant==="ghost"?{color:NAVY}:{};
  return (
    <button className={`${base} ${v[variant]} ${s[size]} ${className}`} disabled={disabled||loading} onClick={onClick} style={st}>
      {loading && <Loader2 className="animate-spin" size={size==="sm"?12:size==="lg"?16:14} />}
      {children}
    </button>
  );
}
function StatusBadge({ status }: { status: string }) {
  const s = STATUSES.find(x => x.key === status) ?? STATUSES[0];
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border" style={{ backgroundColor: s.bg, borderColor: s.border, color: s.tx }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.dot }} />
      {s.label}
    </span>
  );
}
function SL({ num, label }: { num: number; label: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span className="text-xs font-bold tracking-[0.25em] uppercase" style={{ color: GOLD }}>{String(num).padStart(2,"0")}</span>
      <span className="h-px w-6" style={{ backgroundColor: GOLD, opacity: 0.5 }} />
      <span className="text-xs font-bold tracking-[0.12em] uppercase text-[#6B7280]">{label}</span>
    </div>
  );
}
function SH({ children }: { children: ReactNode }) { return <h2 className="text-3xl font-bold mb-3 leading-tight" style={{ color: NAVY }}>{children}</h2>; }
function SD({ children }: { children: ReactNode }) { return <p className="text-sm leading-relaxed text-[#6B7280] mb-10 max-w-2xl">{children}</p>; }
function SubL({ children }: { children: ReactNode }) {
  return <div className="text-xs font-bold uppercase tracking-widest mb-4 mt-8 pb-3 border-b" style={{ color: GOLD, borderColor: `${GOLD}25` }}>{children}</div>;
}
function DW({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="bg-white rounded-xl border mb-5" style={{ borderColor: `${NAVY}12` }}>
      <div className="px-5 py-2.5 border-b text-xs font-bold uppercase tracking-widest" style={{ borderColor: `${NAVY}10`, color: `${NAVY}70` }}>{label}</div>
      <div className="p-5">{children}</div>
    </div>
  );
}
function Div() { return <div className="my-14 h-px" style={{ backgroundColor: `${GOLD}25` }} />; }

function BrandSection() {
  return (
    <section id="brand" className="pt-2 pb-16 scroll-mt-6">
      <SL num={1} label="Brand Identity" />
      <SH>Brand Identity</SH>
      <SD>Core visual identity for TUBA AL HIJAZ Ground Handling. Deep Navy commands institutional authority; Warm Gold marks distinction and heritage. Together they reference Islamic architectural precision while projecting the reliability expected of Hajj and Umrah infrastructure.</SD>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
        <div className="rounded-xl p-8 flex flex-col items-center gap-5" style={{ backgroundColor: NAVY }}>
          <LogoMark size={56} />
          <div className="text-center">
            <div className="text-white font-bold text-lg tracking-widest">TUBA AL HIJAZ</div>
            <div className="text-sm font-medium mt-1.5" style={{ color: GOLD, fontFamily: "var(--font-arabic)" }} lang="ar" dir="rtl">طوبى الحجاز</div>
            <div className="text-xs mt-3 tracking-[0.2em] uppercase" style={{ color: "rgba(255,255,255,0.72)" }}>Ground Handling Excellence</div>
          </div>
          <div className="text-xs mt-1 font-mono" style={{ color: "rgba(255,255,255,0.55)" }}>Dark / Primary</div>
        </div>
        <div className="rounded-xl p-8 flex flex-col items-center gap-5 border" style={{ backgroundColor: "#F4F1EC", borderColor: `${NAVY}15` }}>
          <LogoMark size={56} />
          <div className="text-center">
            <div className="font-bold text-lg tracking-widest" style={{ color: NAVY }}>TUBA AL HIJAZ</div>
            <div className="text-sm font-medium mt-1.5" style={{ color: GOLD, fontFamily: "var(--font-arabic)" }} lang="ar" dir="rtl">طوبى الحجاز</div>
            <div className="text-xs mt-3 tracking-[0.2em] uppercase" style={{ color: "#9CA3AF" }}>Umrah Operations</div>
          </div>
          <div className="text-xs mt-1 font-mono text-[#9CA3AF]">Light / Secondary</div>
        </div>
        <div className="rounded-xl p-8 flex flex-col items-center justify-center gap-6 border bg-white" style={{ borderColor: `${NAVY}12` }}>
          <div className="flex items-end gap-5"><LogoMark size={64} /><LogoMark size={48} /><LogoMark size={32} /><LogoMark size={24} /></div>
          <div className="text-xs font-mono text-[#9CA3AF]">64 / 48 / 32 / 24 px</div>
          <div className="text-xs uppercase tracking-widest text-[#9CA3AF] font-semibold">Mark Scale</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-5">
        <div className="rounded-xl overflow-hidden border bg-white" style={{ borderColor: `${NAVY}12` }}>
          <div className="h-20" style={{ backgroundColor: NAVY }} />
          <div className="p-4"><div className="font-bold text-sm" style={{ color: NAVY }}>Deep Navy</div><div className="text-xs mt-1 font-mono" style={{ color: GOLD }}>HEX #0B1E3F</div><div className="text-xs text-[#6B7280] mt-1">Headers · Navigation · Primary text · Structural elements</div></div>
        </div>
        <div className="rounded-xl overflow-hidden border bg-white" style={{ borderColor: `${NAVY}12` }}>
          <div className="h-20" style={{ backgroundColor: GOLD }} />
          <div className="p-4"><div className="font-bold text-sm" style={{ color: NAVY }}>Warm Gold</div><div className="text-xs mt-1 font-mono" style={{ color: GOLD }}>HEX #C9A24B</div><div className="text-xs text-[#6B7280] mt-1">Active states · Brand marks · CTAs · Section accents</div></div>
        </div>
      </div>
    </section>
  );
}

function ColorSection() {
  return (
    <section id="colors" className="pt-2 pb-16 scroll-mt-6">
      <SL num={2} label="Color System" /><SH>Color System</SH>
      <SD>A structured token system covering brand primaries, module identifiers, semantic status colors, and a full neutral gray scale. Module colors provide instant visual recognition across portals. Dark mode tokens are tuned for low-light Ops Control Room environments.</SD>
      <SubL>Navy Scale</SubL>
      <div className="flex rounded-xl overflow-hidden border mb-3" style={{ borderColor: `${NAVY}12` }}>
        {NAVY_SCALE.map(s => (<div key={s.n} className="flex-1"><div className="h-16" style={{ backgroundColor: s.v }} /><div className="py-2 px-1 bg-white text-center"><div className="text-[9px] font-bold text-[#374151]">{s.n}</div><div className="text-[8px] font-mono text-[#9CA3AF] mt-0.5">{s.v}</div></div></div>))}
      </div>
      <SubL>Gold Scale</SubL>
      <div className="flex rounded-xl overflow-hidden border mb-3" style={{ borderColor: `${NAVY}12` }}>
        {GOLD_SCALE.map(s => (<div key={s.n} className="flex-1"><div className="h-16" style={{ backgroundColor: s.v }} /><div className="py-2 px-1 bg-white text-center"><div className="text-[9px] font-bold text-[#374151]">{s.n}</div><div className="text-[8px] font-mono text-[#9CA3AF] mt-0.5">{s.v}</div></div></div>))}
      </div>
      <SubL>Module Identity Colors</SubL>
      <div className="grid grid-cols-4 gap-3 mb-2">
        {MODULES.map(m => (<div key={m.id} className="rounded-xl overflow-hidden border bg-white" style={{ borderColor: `${NAVY}10` }}><div className="h-12 flex items-center justify-center" style={{ backgroundColor: m.color }}><m.icon size={20} color="white" /></div><div className="p-3"><div className="text-xs font-bold" style={{ color: NAVY }}>{m.name}</div><div className="text-[10px] font-mono mt-0.5" style={{ color: m.color }}>{m.color}</div><div className="text-[10px] mt-1 font-medium" style={{ color: m.tx, backgroundColor: m.bg, padding: "2px 6px", borderRadius: 4, display: "inline-block" }}>{m.ar}</div></div></div>))}
      </div>
      <SubL>Semantic Status Colors</SubL>
      <div className="grid grid-cols-4 gap-3 mb-4">
        {STATUS_COLORS.map(s => (<div key={s.name} className="rounded-xl overflow-hidden border bg-white" style={{ borderColor: `${NAVY}10` }}><div className="h-10" style={{ backgroundColor: s.hex }} /><div className="p-3"><div className="text-xs font-bold" style={{ color: NAVY }}>{s.name}</div><div className="text-[10px] font-mono mt-0.5" style={{ color: s.hex }}>{s.hex}</div><span className="text-[10px] font-semibold mt-1 px-1.5 py-0.5 rounded" style={{ backgroundColor: s.bg, color: s.tx, display: "inline-block" }}>{s.label}</span></div></div>))}
      </div>
      <SubL>Neutral Gray Scale (9-step)</SubL>
      <div className="flex rounded-xl overflow-hidden border mb-6" style={{ borderColor: `${NAVY}12` }}>
        {GRAY_SCALE.map(s => (<div key={s.n} className="flex-1"><div className="h-14" style={{ backgroundColor: s.v, border: s.n==="50"?"1px solid #E5E7EB":undefined }} /><div className="py-2 px-1 bg-white text-center border-t" style={{ borderColor: "#F3F4F6" }}><div className="text-[9px] font-bold text-[#374151]">{s.n}</div><div className="text-[8px] font-mono text-[#9CA3AF] mt-0.5">{s.v}</div></div></div>))}
      </div>
      <SubL>Dark Mode — Ops Control Room</SubL>
      <div className="rounded-xl overflow-hidden border" style={{ borderColor: `${NAVY}20` }}>
        <div className="p-6" style={{ backgroundColor: "#F5F7FA" }}>
          <div className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: GOLD }}>Ops Control Room · Dark Theme</div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[{label:"Background",hex:"#F5F7FA"},{label:"Card / Panel",hex:"#FFFFFF"},{label:"Elevated Surface",hex:"#162D5A"}].map(t => (
              <div key={t.label} className="rounded-lg p-3 border" style={{ backgroundColor: t.hex, borderColor: "rgba(201,162,75,0.15)" }}>
                <div className="w-full h-8 rounded mb-2" style={{ backgroundColor: t.hex, border: "1px solid rgba(201,162,75,0.2)" }} />
                <div className="text-xs font-semibold" style={{ color: "#0B1E3F" }}>{t.label}</div>
                <div className="text-xs font-mono mt-0.5" style={{ color: GOLD }}>{t.hex}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap">
            {MODULES.slice(0,6).map(m => (<div key={m.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border" style={{ borderColor: `${m.color}40`, backgroundColor: `${m.color}15`, color: m.color }}><m.icon size={12} />{m.name}</div>))}
          </div>
        </div>
      </div>
    </section>
  );
}

function TypographySection() {
  return (
    <section id="typography" className="pt-2 pb-16 scroll-mt-6">
      <SL num={3} label="Typography" /><SH>Typography Scale</SH>
      <SD>Plus Jakarta Sans as the primary UI face — humanist proportions with strong legibility across all weights. Noto Sans Arabic for all Arabic-script content with full RTL support. JetBrains Mono for data values, reference IDs, and system labels.</SD>
      <DW label="Font Families">
        <div className="space-y-5">
          <div>
            <div className="text-xs font-mono text-[#9CA3AF] mb-2">Plus Jakarta Sans — Primary UI</div>
            <div className="text-3xl font-bold" style={{ color: NAVY }}>ABCDEFGHIJKLMNOPQRSTUVWXYZ</div>
            <div className="text-2xl font-normal mt-1" style={{ color: NAVY }}>abcdefghijklmnopqrstuvwxyz · 0123456789</div>
            <div className="flex gap-4 mt-3 flex-wrap">{[300,400,500,600,700,800].map(w=><span key={w} className="text-sm" style={{fontWeight:w,color:NAVY}}>Weight {w}</span>)}</div>
          </div>
          <div className="border-t pt-5" style={{ borderColor: `${NAVY}10` }}>
            <div className="text-xs font-mono text-[#9CA3AF] mb-2">Noto Sans Arabic — Arabic Script</div>
            <div className="text-2xl font-bold text-right" style={{ color: NAVY, fontFamily: "var(--font-arabic)", direction: "rtl" }} lang="ar">إدارة العمليات الأرضية لخدمات الحج والعمرة</div>
            <div className="text-base mt-2 text-right" style={{ color: "#6B7280", fontFamily: "var(--font-arabic)", direction: "rtl" }} lang="ar">نظام متكامل لإدارة الموارد · التأشيرات · الفنادق · النقل · التموين</div>
          </div>
          <div className="border-t pt-5" style={{ borderColor: `${NAVY}10` }}>
            <div className="text-xs font-mono text-[#9CA3AF] mb-2">JetBrains Mono — Data / System Labels</div>
            <div className="text-sm" style={{ fontFamily: "var(--font-mono)", color: NAVY }}>VA-1446-001 · SA901234567 · 2024-06-15T12:34:00+03:00</div>
            <div className="text-xs mt-1" style={{ fontFamily: "var(--font-mono)", color: "#6B7280" }}>STATUS: VERIFIED · MODULE: VISA · SESSION: OPS-9827</div>
          </div>
        </div>
      </DW>
      <DW label="Type Scale — English">
        <div className="space-y-6">
          {TYPE_SCALE.map(t => (
            <div key={t.name} className="flex items-baseline gap-6 border-b pb-5 last:border-0 last:pb-0" style={{ borderColor: `${NAVY}08` }}>
              <div className="w-32 shrink-0"><div className="text-xs font-bold" style={{ color: NAVY }}>{t.name}</div><div className="text-[10px] font-mono text-[#9CA3AF] mt-0.5">{t.meta}</div></div>
              <div className={`${t.cls} leading-snug`} style={{ color: NAVY }}>{t.sample}</div>
            </div>
          ))}
        </div>
      </DW>
      <DW label="Bilingual Specimen — Arabic / English">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className="text-xs font-mono text-[#9CA3AF] mb-3">English · LTR</div>
            <div className="text-xl font-bold mb-1" style={{ color: NAVY }}>Visa Processing Module</div>
            <div className="text-sm text-[#6B7280] leading-relaxed">Application submitted by operations supervisor. Awaiting Ministry approval within 48 hours.</div>
            <div className="flex items-center gap-2 mt-3"><StatusBadge status="pending" /><span className="text-xs font-mono text-[#9CA3AF]">VA-1446-002</span></div>
          </div>
          <div dir="rtl" lang="ar">
            <div className="text-xs font-mono text-[#9CA3AF] mb-3" dir="ltr">Arabic · RTL</div>
            <div className="text-xl font-bold mb-1" style={{ color: NAVY, fontFamily: "var(--font-arabic)" }}>وحدة معالجة التأشيرات</div>
            <div className="text-sm text-[#6B7280] leading-relaxed" style={{ fontFamily: "var(--font-arabic)" }}>تم تقديم الطلب من قبل مشرف العمليات. بانتظار موافقة الوزارة خلال ٤٨ ساعة.</div>
            <div className="flex items-center gap-2 mt-3 justify-end"><span className="text-xs font-mono text-[#9CA3AF]" dir="ltr">VA-1446-002</span><StatusBadge status="pending" /></div>
          </div>
        </div>
      </DW>
    </section>
  );
}

function SpacingSection() {
  return (
    <section id="spacing" className="pt-2 pb-16 scroll-mt-6">
      <SL num={4} label="Spacing & Grid" /><SH>Spacing & Grid System</SH>
      <SD>8px base unit across all spacing decisions. 12-column desktop grid at 1440px, 8-column tablet at 834px, 4-column mobile at 390px. Consistent rhythm creates the visual order required for an ops-critical interface.</SD>
      <DW label="Spacing Scale — 8px Base Unit">
        <div className="space-y-3">
          {SPACING_SCALE.map(s => (
            <div key={s} className="flex items-center gap-4">
              <div className="w-16 text-xs font-mono text-right shrink-0" style={{ color: NAVY }}>{s}px</div>
              <div className="h-6 rounded" style={{ width: s*2, backgroundColor: GOLD, opacity: 0.7, minWidth: 4 }} />
              <div className="text-xs text-[#9CA3AF] font-mono">space-{s/4*4} · {(s/16).toFixed(3)}rem</div>
            </div>
          ))}
        </div>
      </DW>
      <SubL>Grid Configurations</SubL>
      <div className="grid grid-cols-3 gap-4">
        {[{label:"Desktop",breakpoint:"1440px",cols:12,gutter:"24px",margin:"80px"},{label:"Tablet",breakpoint:"834px",cols:8,gutter:"20px",margin:"40px"},{label:"Mobile",breakpoint:"390px",cols:4,gutter:"16px",margin:"16px"}].map(g => (
          <div key={g.label} className="bg-white rounded-xl border p-4" style={{ borderColor: `${NAVY}12` }}>
            <div className="text-sm font-bold mb-1" style={{ color: NAVY }}>{g.label}</div>
            <div className="text-xs font-mono mb-3" style={{ color: GOLD }}>{g.breakpoint}</div>
            <div className="flex gap-0.5 mb-3 h-10">{Array.from({length:g.cols}).map((_,i)=><div key={i} className="flex-1 rounded-sm" style={{backgroundColor:i%2===0?`${GOLD}25`:`${GOLD}12`}} />)}</div>
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-[#9CA3AF]"><span>Columns</span><span className="font-bold" style={{color:NAVY}}>{g.cols}</span></div>
              <div className="flex justify-between text-[10px] text-[#9CA3AF]"><span>Gutter</span><span className="font-bold" style={{color:NAVY}}>{g.gutter}</span></div>
              <div className="flex justify-between text-[10px] text-[#9CA3AF]"><span>Margin</span><span className="font-bold" style={{color:NAVY}}>{g.margin}</span></div>
            </div>
          </div>
        ))}
      </div>
      <SubL>Border Radius Scale</SubL>
      <div className="flex gap-4 flex-wrap">
        {[{label:"sm",r:4},{label:"md",r:6},{label:"lg",r:8},{label:"xl",r:12},{label:"2xl",r:16},{label:"full",r:999}].map(r=>(
          <div key={r.label} className="flex flex-col items-center gap-2">
            <div className="w-16 h-16 bg-white border-2" style={{borderColor:NAVY,borderRadius:r.r}} />
            <div className="text-xs font-mono text-[#6B7280]">{r.label}</div>
            <div className="text-[10px] font-mono text-[#9CA3AF]">{r.r===999?"9999px":`${r.r}px`}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ComponentsSection() {
  const [activeTab, setActiveTab] = useState("Actions");
  const [sortCol, setSortCol] = useState<string|null>("id");
  const [sortAsc, setSortAsc] = useState(true);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [ocrScanning, setOcrScanning] = useState(false);
  const [step, setStep] = useState(1);
  const [filterChips, setFilterChips] = useState(["Saudi Arabia","Verified","Season 1446H"]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const tabs = ["Actions","Forms","Data","Cards","Navigation","Overlays"];
  const sortedData = [...TABLE_DATA].sort((a,b)=>{if(!sortCol)return 0;const va=(a as Record<string,string>)[sortCol]??"";const vb=(b as Record<string,string>)[sortCol]??"";return sortAsc?va.localeCompare(vb):vb.localeCompare(va);});
  const toggleSort=(col:string)=>{if(sortCol===col)setSortAsc(!sortAsc);else{setSortCol(col);setSortAsc(true);}};
  const SI=({col}:{col:string})=>sortCol===col?(sortAsc?<ArrowUp size={12}/>:<ArrowDown size={12}/>):<span className="opacity-20"><ArrowUp size={12}/></span>;
  return (
    <section id="components" className="pt-2 pb-16 scroll-mt-6">
      <SL num={5} label="Components" /><SH>Component Library</SH>
      <SD>Reusable, composable UI primitives with full variant sets. Every component carries disabled, loading, and error states. Built for bilingual layout flexibility — components adapt to RTL without structural changes.</SD>
      <div className="flex gap-1 mb-8 p-1 rounded-xl border bg-white overflow-x-auto" style={{borderColor:`${NAVY}12`}}>
        {tabs.map(t=><button key={t} onClick={()=>setActiveTab(t)} className="flex-1 text-xs font-semibold px-3 py-2 rounded-lg whitespace-nowrap transition-all" style={activeTab===t?{backgroundColor:NAVY,color:"white"}:{color:"#6B7280"}}>{t}</button>)}
      </div>
      {activeTab==="Actions"&&<>
        <DW label="Buttons — Variants">
          <div className="space-y-4">
            {(["primary","accent","secondary","ghost","danger"] as const).map(v=>(
              <div key={v} className="flex items-center gap-3 flex-wrap">
                <div className="w-24 text-xs font-mono text-[#6B7280] capitalize">{v}</div>
                <Btn variant={v} size="sm">Small</Btn><Btn variant={v} size="md">Medium</Btn><Btn variant={v} size="lg">Large</Btn>
                <Btn variant={v} size="md" disabled>Disabled</Btn><Btn variant={v} size="md" loading>Loading</Btn>
              </div>
            ))}
          </div>
        </DW>
        <DW label="Status / Verification Badges">
          <div className="space-y-4">
            <div className="flex gap-3 flex-wrap">{STATUSES.map(s=><StatusBadge key={s.key} status={s.key}/>)}</div>
            <div className="flex gap-3 flex-wrap">{STATUSES.map(s=><div key={s.key+"ar"} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border" style={{backgroundColor:s.bg,borderColor:s.border,color:s.tx}}><span className="w-1.5 h-1.5 rounded-full" style={{backgroundColor:s.dot}}/><span style={{fontFamily:"var(--font-arabic)"}} lang="ar">{s.ar}</span></div>)}</div>
          </div>
        </DW>
      </>}
      {activeTab==="Forms"&&<>
        <DW label="Input Fields">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs font-semibold mb-1.5" style={{color:NAVY}}>Full Name</label><input type="text" defaultValue="Ahmad Al-Rashidi" className="w-full px-3 py-2 text-sm rounded-lg border focus:outline-none transition" style={{borderColor:`${NAVY}20`,color:NAVY,backgroundColor:"#F8F6F2"}} /></div>
            <div><label className="block text-xs font-semibold mb-1.5" style={{color:NAVY}}>Passport Number</label><input type="text" defaultValue="SA901234567" className="w-full px-3 py-2 text-sm rounded-lg border focus:outline-none font-mono" style={{borderColor:`${GOLD}60`,color:NAVY,backgroundColor:"#F8F6F2",boxShadow:`0 0 0 2px ${GOLD}30`}} /></div>
            <div><label className="block text-xs font-semibold mb-1.5" style={{color:NAVY}}>Search Pilgrims</label><div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]"/><input type="text" placeholder="Search by name, passport, or ID…" className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border focus:outline-none" style={{borderColor:`${NAVY}20`,color:NAVY,backgroundColor:"#F8F6F2"}} /></div></div>
            <div><label className="block text-xs font-semibold mb-1.5" style={{color:NAVY}}>Nationality</label><div className="relative"><select className="w-full px-3 py-2 pr-8 text-sm rounded-lg border focus:outline-none appearance-none" style={{borderColor:`${NAVY}20`,color:NAVY,backgroundColor:"#F8F6F2"}}><option>Saudi Arabia</option><option>Egypt</option><option>Pakistan</option><option>Turkey</option></select><ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none"/></div></div>
            <div className="col-span-2"><label className="block text-xs font-semibold mb-1.5 text-[#DC2626]">Email (Error State)</label><input type="email" defaultValue="invalid-email" className="w-full px-3 py-2 text-sm rounded-lg border" style={{borderColor:"#DC2626",backgroundColor:"#FEF2F2",color:"#991B1B"}} /><div className="text-xs text-[#DC2626] mt-1 flex items-center gap-1"><AlertCircle size={11}/>Enter a valid email address</div></div>
          </div>
        </DW>
        <DW label="File Upload — Document Dropzone">
          <div className="space-y-3">
            <div className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer" style={{borderColor:`${GOLD}50`,backgroundColor:`${GOLD}08`}}>
              <Upload size={24} className="mx-auto mb-3" style={{color:GOLD}}/>
              <div className="text-sm font-semibold" style={{color:NAVY}}>Drop passport scan here</div>
              <div className="text-xs text-[#9CA3AF] mt-1">PDF, JPG, PNG · Max 10MB · OCR-ready</div>
              <Btn variant="secondary" size="sm" className="mt-4">Browse Files</Btn>
            </div>
            <div className="border-2 rounded-xl p-5 flex items-center gap-4" style={{borderColor:`${GOLD}40`,backgroundColor:`${GOLD}08`}}>
              <div className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0" style={{backgroundColor:`${GOLD}20`}}>
                {ocrScanning?<Loader2 size={20} className="animate-spin" style={{color:GOLD}}/>:<ScanLine size={20} style={{color:GOLD}}/>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold" style={{color:NAVY}}>passport_scan_ahmad.jpg</div>
                <div className="text-xs text-[#9CA3AF] mt-0.5">{ocrScanning?"Extracting data with OCR…":"Ready to scan · 2.4 MB"}</div>
                {ocrScanning&&<div className="w-full h-1.5 rounded-full mt-2 overflow-hidden" style={{backgroundColor:`${GOLD}20`}}><div className="h-full rounded-full animate-pulse" style={{width:"65%",backgroundColor:GOLD}}/></div>}
              </div>
              <button onClick={()=>setOcrScanning(!ocrScanning)} className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg" style={{backgroundColor:ocrScanning?`${NAVY}12`:NAVY,color:ocrScanning?NAVY:"white"}}>{ocrScanning?"Cancel":"Scan OCR"}</button>
            </div>
          </div>
        </DW>
      </>}
      {activeTab==="Data"&&<>
        <DW label="Data Table — Visa Applications">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b" style={{borderColor:`${NAVY}12`}}>
                <th className="pb-3 pr-3 w-8"><input type="checkbox" className="rounded" onChange={e=>setSelectedRows(e.target.checked?TABLE_DATA.map(r=>r.id):[])}/></th>
                {[{col:"id",label:"Application ID"},{col:"name",label:"Pilgrim"},{col:"passport",label:"Passport"},{col:"nat",label:"Nationality"},{col:"date",label:"Date"},{col:"status",label:"Status"}].map(h=>(
                  <th key={h.col} className="pb-3 pr-4 text-left text-xs font-bold uppercase tracking-wider cursor-pointer" style={{color:NAVY}} onClick={()=>toggleSort(h.col)}><span className="flex items-center gap-1">{h.label}<SI col={h.col}/></span></th>
                ))}
                <th className="pb-3 text-right text-xs font-bold uppercase tracking-wider" style={{color:NAVY}}>Actions</th>
              </tr></thead>
              <tbody>{sortedData.map(row=>(
                <tr key={row.id} className="border-b transition-colors" style={{borderColor:`${NAVY}08`,backgroundColor:selectedRows.includes(row.id)?`${GOLD}08`:"transparent"}}>
                  <td className="py-3 pr-3"><input type="checkbox" className="rounded" checked={selectedRows.includes(row.id)} onChange={e=>setSelectedRows(prev=>e.target.checked?[...prev,row.id]:prev.filter(x=>x!==row.id))}/></td>
                  <td className="py-3 pr-4 font-mono text-xs" style={{color:GOLD}}>{row.id}</td>
                  <td className="py-3 pr-4"><div className="font-semibold text-xs" style={{color:NAVY}}>{row.name}</div><div className="text-[10px] mt-0.5" style={{color:"#9CA3AF",fontFamily:"var(--font-arabic)"}} lang="ar">{row.nameAr}</div></td>
                  <td className="py-3 pr-4 font-mono text-xs text-[#6B7280]">{row.passport}</td>
                  <td className="py-3 pr-4 text-xs text-[#6B7280]">{row.nat}</td>
                  <td className="py-3 pr-4 text-xs text-[#6B7280]">{row.date}</td>
                  <td className="py-3 pr-4"><StatusBadge status={row.status}/></td>
                  <td className="py-3 text-right"><button className="p-1 rounded hover:bg-[#EDE9E3]"><MoreHorizontal size={14} style={{color:"#9CA3AF"}}/></button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div className="flex items-center justify-between pt-4 mt-2 border-t" style={{borderColor:`${NAVY}10`}}>
            <div className="text-xs text-[#6B7280]">Showing <span className="font-semibold" style={{color:NAVY}}>5</span> of <span className="font-semibold" style={{color:NAVY}}>2,847</span> applications</div>
            <div className="flex items-center gap-1">
              <button className="p-1.5 rounded border" style={{borderColor:`${NAVY}15`}}><ChevronLeft size={12} style={{color:NAVY}}/></button>
              {[1,2,3,"...",47].map((p,i)=><button key={i} className="px-2.5 py-1 rounded text-xs font-medium" style={p===1?{backgroundColor:NAVY,color:"white"}:{color:"#6B7280"}}>{p}</button>)}
              <button className="p-1.5 rounded border" style={{borderColor:`${NAVY}15`}}><ChevronRight size={12} style={{color:NAVY}}/></button>
            </div>
          </div>
        </DW>
        <div className="grid grid-cols-2 gap-4">
          <DW label="Empty State"><div className="py-10 text-center"><FileText size={32} className="mx-auto mb-3 opacity-20" style={{color:NAVY}}/><div className="text-sm font-semibold" style={{color:NAVY}}>No applications found</div><div className="text-xs text-[#9CA3AF] mt-1">Try adjusting your filters</div><Btn variant="secondary" size="sm" className="mt-4">Clear Filters</Btn></div></DW>
          <DW label="Loading Skeleton"><div className="space-y-3">{[1,2,3].map(i=><div key={i} className="flex gap-4 animate-pulse"><div className="w-4 h-4 rounded" style={{backgroundColor:"#EDE9E3"}}/><div className="flex-1 h-4 rounded" style={{backgroundColor:"#EDE9E3"}}/><div className="h-4 rounded w-24" style={{backgroundColor:"#EDE9E3"}}/><div className="h-4 rounded w-16" style={{backgroundColor:"#EDE9E3"}}/></div>)}</div></DW>
        </div>
      </>}
      {activeTab==="Cards"&&<>
        <SubL>KPI Cards</SubL>
        <div className="grid grid-cols-2 gap-4 mb-4">
          {[{label:"Total Pilgrims",value:"12,847",trend:"+8.3%",up:true,sub:"vs last season",color:NAVY},{label:"Visa Approvals",value:"94.2%",trend:"+2.1%",up:true,sub:"approval rate",color:"#0D9488"},{label:"Hotels Booked",value:"3,891",trend:"-3 remaining",up:false,sub:"of 4,200 capacity",color:"#2563EB"},{label:"Active Buses",value:"247",trend:"+12 today",up:true,sub:"dispatched today",color:"#EA580C"}].map(k=>(
            <div key={k.label} className="bg-white rounded-xl border p-5" style={{borderColor:`${NAVY}10`}}>
              <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{color:k.color}}>{k.label}</div>
              <div className="text-3xl font-bold mb-1" style={{color:NAVY}}>{k.value}</div>
              <div className="flex items-center gap-2"><span className={`flex items-center gap-0.5 text-xs font-semibold ${k.up?"text-green-600":"text-red-500"}`}>{k.up?<TrendingUp size={12}/>:<TrendingDown size={12}/>}{k.trend}</span><span className="text-xs text-[#9CA3AF]">{k.sub}</span></div>
            </div>
          ))}
        </div>
        <SubL>Module Cards</SubL>
        <div className="grid grid-cols-4 gap-3">
          {MODULES.slice(0,4).map(m=>(
            <div key={m.id} className="bg-white rounded-xl border p-4 cursor-pointer hover:shadow-md transition" style={{borderColor:`${NAVY}10`}}>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{backgroundColor:m.bg}}><m.icon size={18} style={{color:m.color}}/></div>
              <div className="text-sm font-bold mb-0.5" style={{color:NAVY}}>{m.name}</div>
              <div className="text-xs" style={{color:m.color,fontFamily:"var(--font-arabic)"}} lang="ar">{m.ar}</div>
              {m.count>0&&<div className="mt-3 flex items-center justify-between"><span className="text-xs text-[#9CA3AF]">Pending</span><span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{backgroundColor:m.bg,color:m.tx}}>{m.count}</span></div>}
            </div>
          ))}
        </div>
      </>}
      {activeTab==="Navigation"&&<>
        <DW label="Left Sidebar Navigation — Collapsible">
          <div className="flex gap-4 items-start">
            <div className="rounded-xl overflow-hidden transition-all duration-300 shrink-0" style={{width:sidebarCollapsed?56:220,backgroundColor:NAVY}}>
              <div className="p-3 flex items-center justify-between border-b" style={{borderColor:"rgba(11,30,63,0.11)"}}>
                {!sidebarCollapsed&&<div className="flex items-center gap-2"><LogoMark size={28}/><span className="text-xs font-bold text-white tracking-wider">TUBA AL HIJAZ</span></div>}
                {sidebarCollapsed&&<LogoMark size={28}/>}
                <button onClick={()=>setSidebarCollapsed(!sidebarCollapsed)} className="p-1 rounded opacity-60 hover:opacity-100" style={{color:"white"}}>{sidebarCollapsed?<ChevronRight size={14}/>:<ChevronLeft size={14}/>}</button>
              </div>
              <div className="p-2 space-y-0.5">
                <button className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg" style={{backgroundColor:`${GOLD}20`,color:GOLD}}><LayoutDashboard size={16}/>{!sidebarCollapsed&&<span className="text-xs font-semibold">Dashboard</span>}</button>
                {MODULES.slice(0,6).map(m=>(
                  <button key={m.id} className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg opacity-70 hover:opacity-100 relative" style={{color:"white"}}>
                    <m.icon size={16} style={{color:m.color}}/>
                    {!sidebarCollapsed&&<><span className="text-xs font-medium flex-1 text-left">{m.name}</span>{m.count>0&&<span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{backgroundColor:m.color,color:"white"}}>{m.count}</span>}</>}
                    {sidebarCollapsed&&m.count>0&&<span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full" style={{backgroundColor:m.color}}/>}
                  </button>
                ))}
              </div>
              <div className="p-2 mt-2 border-t space-y-0.5" style={{borderColor:"rgba(11,30,63,0.11)"}}>
                <button className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg opacity-60 hover:opacity-100" style={{color:"white"}}><Settings size={16}/>{!sidebarCollapsed&&<span className="text-xs font-medium">Settings</span>}</button>
              </div>
            </div>
            <div className="flex-1 min-w-0"><div className="text-xs text-[#9CA3AF] mb-3">Toggle sidebar with arrow button above</div><div className="space-y-2">{[1,2,3].map(i=><div key={i} className="h-8 rounded-lg animate-pulse" style={{backgroundColor:"#EDE9E3"}}/>)}</div></div>
          </div>
        </DW>
        <DW label="Filter / Chip Bar">
          <div className="flex items-center gap-2 flex-wrap">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border" style={{borderColor:`${NAVY}20`,color:NAVY,backgroundColor:"#F4F1EC"}}><Filter size={12}/>Add Filter</button>
            {filterChips.map(chip=>(
              <span key={chip} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border" style={{backgroundColor:`${GOLD}15`,borderColor:`${GOLD}40`,color:NAVY}}>
                {chip}<button onClick={()=>setFilterChips(prev=>prev.filter(c=>c!==chip))}><X size={11}/></button>
              </span>
            ))}
          </div>
        </DW>
        <DW label="Tabs">
          <div>{["All Applications","Pending Review","Approved","Rejected"].map((t,i)=>(
            <button key={t} className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold border-b-2 transition" style={i===0?{borderColor:GOLD,color:NAVY}:{borderColor:"transparent",color:"#9CA3AF"}}>
              {t}{i===1&&<span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold" style={{backgroundColor:"#FFFBEB",color:"#92400E"}}>23</span>}
            </button>
          ))}</div>
        </DW>
      </>}
      {activeTab==="Overlays"&&<>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <DW label="Trigger Controls">
            <div className="space-y-3">
              <Btn variant="primary" className="w-full" onClick={()=>setModalOpen(true)}><Eye size={14}/>Open Modal</Btn>
              <Btn variant="secondary" className="w-full" onClick={()=>setDrawerOpen(true)}><ChevronLeft size={14}/>Open Drawer</Btn>
            </div>
          </DW>
          <DW label="Stepper / Wizard">
            <div className="flex items-center justify-between mb-6 relative">
              <div className="absolute top-4 left-0 right-0 h-0.5" style={{backgroundColor:"#EDE9E3"}}/>
              <div className="absolute top-4 left-0 h-0.5 transition-all" style={{backgroundColor:GOLD,width:`${((step-1)/3)*100}%`}}/>
              {["Upload","OCR","Ministry","Approval"].map((label,i)=>(
                <div key={label} className="flex flex-col items-center gap-1.5 relative z-10">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all" style={i+1<step?{backgroundColor:GOLD,borderColor:GOLD,color:NAVY}:i+1===step?{backgroundColor:NAVY,borderColor:NAVY,color:"white"}:{backgroundColor:"white",borderColor:"#D1D5DB",color:"#9CA3AF"}}>
                    {i+1<step?<Check size={14}/>:i+1}
                  </div>
                  <div className="text-[10px] font-medium" style={{color:i+1<=step?NAVY:"#9CA3AF"}}>{label}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 justify-center">
              <Btn variant="ghost" size="sm" onClick={()=>setStep(Math.max(1,step-1))} disabled={step===1}><ChevronLeft size={14}/>Back</Btn>
              <Btn variant="primary" size="sm" onClick={()=>setStep(Math.min(4,step+1))} disabled={step===4}>{step===4?"Complete":"Continue"}<ChevronRight size={14}/></Btn>
            </div>
          </DW>
        </div>
        <DW label="Toast Notifications">
          <div className="space-y-2">
            {[{type:"success",icon:CheckCircle,msg:"Visa application VA-1446-001 approved successfully.",color:"#16A34A",bg:"#F0FDF4"},{type:"warning",icon:AlertCircle,msg:"Passport expiry within 30 days — 12 pilgrims affected.",color:"#D97706",bg:"#FFFBEB"},{type:"error",icon:X,msg:"Document upload failed. File size exceeds 10MB limit.",color:"#DC2626",bg:"#FEF2F2"},{type:"info",icon:Info,msg:"Visa Desk pipeline updated. 847 mutamer records reviewed.",color:"#2563EB",bg:"#EFF6FF"}].map(t=>(
              <div key={t.type} className="flex items-center gap-3 px-4 py-3 rounded-xl border" style={{backgroundColor:t.bg,borderColor:`${t.color}25`}}>
                <t.icon size={16} style={{color:t.color,flexShrink:0}}/><span className="text-xs font-medium flex-1" style={{color:NAVY}}>{t.msg}</span><button className="text-[#9CA3AF]"><X size={12}/></button>
              </div>
            ))}
          </div>
        </DW>
      </>}
      {modalOpen&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{backgroundColor:"rgba(6,15,32,0.75)"}} onClick={()=>setModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{borderColor:`${NAVY}10`}}>
              <div><div className="text-xs font-bold uppercase tracking-widest mb-0.5" style={{color:GOLD}}>Visa Application</div><div className="font-bold text-base" style={{color:NAVY}}>Review — VA-1446-002</div></div>
              <button onClick={()=>setModalOpen(false)} className="p-1.5 rounded-lg hover:bg-[#EDE9E3]"><X size={16} style={{color:NAVY}}/></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[{label:"Pilgrim",value:"Fatima Karimi"},{label:"Passport",value:"IR234567890"},{label:"Nationality",value:"Iran"},{label:"Status",value:<StatusBadge status="pending"/>}].map(f=>(
                  <div key={f.label}><div className="text-xs text-[#9CA3AF] mb-0.5">{f.label}</div><div className="font-medium" style={{color:NAVY}}>{f.value}</div></div>
                ))}
              </div>
              <textarea className="w-full px-3 py-2 text-sm rounded-lg border resize-none focus:outline-none" rows={3} placeholder="Add review notes…" style={{borderColor:`${NAVY}15`,color:NAVY,backgroundColor:"#F8F6F2"}}/>
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t" style={{borderColor:`${NAVY}08`,backgroundColor:"#F8F6F2"}}>
              <Btn variant="ghost" onClick={()=>setModalOpen(false)}>Cancel</Btn>
              <Btn variant="danger"><X size={14}/>Reject</Btn>
              <Btn variant="accent"><Check size={14}/>Approve</Btn>
            </div>
          </div>
        </div>
      )}
      {drawerOpen&&(
        <div className="fixed inset-0 z-50 flex justify-end" style={{backgroundColor:"rgba(6,15,32,0.5)"}} onClick={()=>setDrawerOpen(false)}>
          <div className="h-full w-80 bg-white shadow-2xl overflow-auto" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white" style={{borderColor:`${NAVY}10`}}>
              <div className="font-bold text-sm" style={{color:NAVY}}>Pilgrim Details</div>
              <button onClick={()=>setDrawerOpen(false)} className="p-1.5 rounded-lg hover:bg-[#EDE9E3]"><X size={14} style={{color:NAVY}}/></button>
            </div>
            <div className="p-5 space-y-5">
              <div className="flex items-center gap-3 p-4 rounded-xl" style={{backgroundColor:"#F4F1EC"}}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold" style={{backgroundColor:NAVY,color:GOLD}}>AK</div>
                <div><div className="font-bold text-sm" style={{color:NAVY}}>Ahmad Al-Rashidi</div><div className="text-xs text-[#9CA3AF]">SA901234567 · Saudi Arabia</div></div>
              </div>
              {["Visa Status","Hotel Assignment","Transport Route","Catering Group"].map((item,i)=>(
                <div key={item} className="flex items-center justify-between py-3 border-b" style={{borderColor:`${NAVY}08`}}>
                  <span className="text-sm text-[#6B7280]">{item}</span><StatusBadge status={["verified","completed","in_progress","pending"][i]}/>
                </div>
              ))}
              <Btn variant="primary" className="w-full justify-center">View Full Profile <ArrowRight size={14}/></Btn>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function IconographySection() {
  return (
    <section id="icons" className="pt-2 pb-16 scroll-mt-6">
      <SL num={6} label="Iconography" /><SH>Iconography</SH>
      <SD>Lucide React outline icon set — consistent 2px stroke weight, 24px default canvas. Each icon maps to a named ERP module or system function for consistent visual grammar across all portals.</SD>
      <DW label="Icon Sheet — Module & System Icons · Outline Style · 24px">
        <div className="grid grid-cols-5 gap-3">
          {ICON_SHEET.map(item=>{
            const mod=MODULES.find(m=>m.name===item.module||m.id===item.module.toLowerCase());
            const iconColor=mod?.color??NAVY;
            return (
              <div key={item.name} className="flex flex-col items-center gap-2.5 p-4 rounded-xl border hover:shadow-sm" style={{borderColor:`${NAVY}10`,backgroundColor:"white"}}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{backgroundColor:mod?mod.bg:"#EDE9E3"}}><item.icon size={20} style={{color:iconColor}}/></div>
                <div className="text-center"><div className="text-xs font-semibold" style={{color:NAVY}}>{item.name}</div><div className="text-[10px] font-medium mt-0.5" style={{color:iconColor}}>{item.module}</div></div>
              </div>
            );
          })}
        </div>
      </DW>
      <SubL>Module Icon Swatch — With Color Context</SubL>
      <div className="grid grid-cols-8 gap-2">
        {MODULES.map(m=>(<div key={m.id} className="flex flex-col items-center gap-2 p-3 rounded-xl" style={{backgroundColor:m.bg,border:`1px solid ${m.color}20`}}><m.icon size={22} style={{color:m.color}}/><div className="text-[10px] font-bold text-center" style={{color:m.tx}}>{m.name}</div></div>))}
      </div>
    </section>
  );
}

export default function DesignSystem() {
  const [activeSection, setActiveSection] = useState("brand");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const scrollTo = (id: string) => { setActiveSection(id); document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }); };
  return (
    <div className="min-h-screen" style={{ backgroundColor: WARM, fontFamily: "var(--font-sans)" }}>
      <header className="fixed top-0 left-0 right-0 z-40 flex items-center gap-4 px-4 h-14 border-b" style={{ backgroundColor: NAVY, borderColor: "rgba(11,30,63,0.11)" }}>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 rounded-lg" style={{ color: "rgba(255,255,255,0.80)" }}>{sidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}</button>
        <div className="flex items-center gap-2.5"><LogoMark size={30} /><div><div className="text-white font-bold text-sm tracking-widest leading-none">TUBA AL HIJAZ</div><div className="text-[9px] font-bold uppercase tracking-[0.2em] leading-none mt-0.5" style={{ color: GOLD }}>Enterprise ERP · Design System</div></div></div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ backgroundColor: `${GOLD}20`, color: GOLD }}>v1.0 · 1446H</span>
          <a href="/" className="text-xs px-3 py-1.5 rounded-lg font-semibold transition" style={{ backgroundColor: "#F5F7FA", color: "rgba(11,30,63,0.76)" }}>← Website</a>
        </div>
      </header>
      <aside className="fixed top-14 left-0 bottom-0 z-30 overflow-y-auto transition-all duration-300 border-r" style={{ width: sidebarOpen ? 220 : 0, backgroundColor: NAVY, borderColor: "rgba(11,30,63,0.11)", overflow: sidebarOpen ? "auto" : "hidden" }}>
        <nav className="p-3 pt-4">
          <div className="text-[9px] font-bold uppercase tracking-[0.2em] px-2 mb-3" style={{ color: "rgba(255,255,255,0.55)" }}>Sections</div>
          {NAV_SECTIONS.map(item => (
            <button key={item.id} onClick={() => scrollTo(item.id)} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left mb-0.5 transition-all" style={activeSection === item.id ? { backgroundColor: `${GOLD}18`, borderLeft: `3px solid ${GOLD}`, paddingLeft: 9, color: GOLD } : { color: "rgba(255,255,255,0.80)", borderLeft: "3px solid transparent" }}>
              <item.icon size={15} style={{ color: activeSection === item.id ? GOLD : item.color, opacity: activeSection === item.id ? 1 : 0.7 }} /><span className="text-xs font-semibold">{item.label}</span>
            </button>
          ))}
          <div className="mt-8 pt-4 border-t" style={{ borderColor: "rgba(11,30,63,0.11)" }}>
            <div className="text-[9px] font-bold uppercase tracking-[0.2em] px-2 mb-3" style={{ color: "rgba(255,255,255,0.55)" }}>ERP Modules</div>
            {MODULES.map(m => (<div key={m.id} className="flex items-center gap-2 px-3 py-2 rounded-lg mb-0.5 opacity-60"><m.icon size={13} style={{ color: m.color }} /><span className="text-xs text-white flex-1">{m.name}</span>{m.count > 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${m.color}30`, color: m.color }}>{m.count}</span>}</div>))}
          </div>
        </nav>
      </aside>
      <main className="transition-all duration-300 pt-14 min-h-screen" style={{ marginLeft: sidebarOpen ? 220 : 0 }}>
        <div className="max-w-4xl mx-auto px-8 py-10">
          <div className="rounded-xl p-8 mb-12 relative overflow-hidden" style={{ backgroundColor: NAVY }}>
            <div className="absolute inset-0 opacity-5"><svg width="100%" height="100%"><pattern id="geo" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M30 0L60 15V45L30 60L0 45V15Z" fill="none" stroke={GOLD} strokeWidth="0.5"/><circle cx="30" cy="30" r="4" fill="none" stroke={GOLD} strokeWidth="0.5"/></pattern><rect width="100%" height="100%" fill="url(#geo)"/></svg></div>
            <div className="relative z-10 flex items-center justify-between flex-wrap gap-6">
              <div><div className="text-xs font-bold uppercase tracking-[0.25em] mb-2" style={{ color: GOLD }}>Master Design System · Release 1.0</div><h1 className="text-3xl font-bold text-white mb-2">TUBA AL HIJAZ ERP</h1><div className="text-base font-medium" style={{ color: "rgba(255,255,255,0.80)" }}>نظام إدارة موارد المؤسسة لخدمات الحج والعمرة</div><p className="text-sm max-w-xl mt-3" style={{ color: "rgba(255,255,255,0.72)" }}>Enterprise visual language for a premium, bilingual Arabic/English ground handling operations platform.</p></div>
              <div className="flex flex-col gap-3">{[{label:"Color Tokens",count:"32+"},{label:"Components",count:"40+"},{label:"Icon Glyphs",count:"20+"}].map(stat=><div key={stat.label} className="flex items-center gap-3"><div className="text-2xl font-bold" style={{ color: GOLD }}>{stat.count}</div><div className="text-xs text-white/50 font-medium">{stat.label}</div></div>)}</div>
            </div>
          </div>
          <BrandSection /><Div/><ColorSection /><Div/><TypographySection /><Div/><SpacingSection /><Div/><ComponentsSection /><Div/><IconographySection />
          <div className="mt-16 pt-8 border-t text-center" style={{ borderColor: `${GOLD}20` }}><LogoMark size={32}/><div className="text-xs font-bold tracking-widest mt-3" style={{ color: NAVY }}>TUBA AL HIJAZ</div><div className="text-[10px] text-[#9CA3AF] mt-1 font-mono">Enterprise ERP Design System · v1.0 · Season 1446H</div></div>
        </div>
      </main>
    </div>
  );
}
