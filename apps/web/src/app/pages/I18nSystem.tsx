// ─── Bilingual Design System Reference ───────────────────────────────────────
// Bengali (বাংলা) is the DEFAULT. English is the alternative.
// All components in this file are the canonical "bilingual component pair"
// referenced in every subsequent screen.

import { useState, type ReactNode, type CSSProperties } from "react";
import {
  Globe, Type, Hash, Layers, Monitor, LayoutDashboard,
  Users, FileText, Wallet, Bell, Settings, ChevronRight,
  CheckCircle, Clock, AlertCircle, TrendingUp, Zap, ArrowUpRight,
} from "lucide-react";
import { ERPShell, type NavItem, type IconFC } from "../components/ERPShell";
import {
  type Lang, type StringKey,
  t, toLocalNum, localDate, localTime, fontFor, lineHeightFor, localSAR,
} from "../lib/i18n";

// ─── Module constants ─────────────────────────────────────────────────────────

const I18N_MOD  = "#DB2777";
const NAVY      = "#0A1628";
const CARD_BG   = "#FFFFFF";
const BORDER    = "rgba(11,30,63,0.11)";

// ─── Navigation ───────────────────────────────────────────────────────────────

type I18NScreen = "typography" | "toggle" | "numerals" | "components" | "preview";

const I18N_NAV: NavItem[] = [
  { id:"typography",  label:"Typography",        icon: Type         as IconFC },
  { id:"toggle",      label:"Language Toggle",   icon: Globe        as IconFC },
  { id:"numerals",    label:"Numerals & Dates",  icon: Hash         as IconFC },
  { id:"components",  label:"Component Library", icon: Layers       as IconFC },
  { id:"preview",     label:"Screen Preview",    icon: Monitor      as IconFC },
];

// ─── Shared layout helpers ────────────────────────────────────────────────────

function SecHead({ n, title, sub, color = I18N_MOD }: { n: string; title: string; sub: string; color?: string }) {
  return (
    <div style={{ marginBottom:28 }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:8 }}>
        <span style={{ fontSize:10, fontWeight:900, padding:"3px 10px", borderRadius:999, backgroundColor:`${color}20`, color, fontFamily:"var(--font-mono)" }}>{n}</span>
        <div style={{ flex:1, height:1, backgroundColor:"#F5F7FA" }} />
      </div>
      <h2 style={{ margin:"0 0 6px", fontSize:22, fontWeight:900, color:"#0B1E3F" }}>{title}</h2>
      <p style={{ margin:0, fontSize:12, color:"rgba(11,30,63,0.66)", lineHeight:1.6 }}>{sub}</p>
    </div>
  );
}

function BiLabel({ label, note }: { label: string; note?: string }) {
  return (
    <div style={{ padding:"6px 12px", borderRadius:"8px 8px 0 0", backgroundColor:"#FBFCFD", borderBottom:"1px solid rgba(11,30,63,0.11)", display:"flex", alignItems:"center", gap:8 }}>
      <span style={{ fontSize:9, fontWeight:900, color:"rgba(11,30,63,0.58)", textTransform:"uppercase" as const, letterSpacing:"0.08em" }}>{label}</span>
      {note && <span style={{ fontSize:8, color:"rgba(11,30,63,0.50)" }}>{note}</span>}
    </div>
  );
}

function BiCard({ children }: { children: ReactNode }) {
  return (
    <div style={{ borderRadius:12, border:"1px solid rgba(11,30,63,0.11)", overflow:"hidden", backgroundColor:CARD_BG }}>
      {children}
    </div>
  );
}

function Chip({ label, color = I18N_MOD }: { label: string; color?: string }) {
  return (
    <span style={{ fontSize:8, fontWeight:900, padding:"2px 8px", borderRadius:999, backgroundColor:`${color}18`, color, display:"inline-block", textTransform:"uppercase" as const, letterSpacing:"0.08em", fontFamily:"var(--font-mono)" }}>
      {label}
    </span>
  );
}

function InfoNote({ children }: { children: ReactNode }) {
  return (
    <div style={{ padding:"10px 14px", borderRadius:10, backgroundColor:"rgba(201,162,75,0.08)", border:"1px solid rgba(201,162,75,0.2)", fontSize:10, color:"rgba(11,30,63,0.76)", lineHeight:1.65, marginTop:12 }}>
      {children}
    </div>
  );
}

// ─── ① The Language Toggle — canonical component ──────────────────────────────
// Use this in every portal's top bar. Clicking swaps lang state immediately.

export function LangToggle({ lang, onToggle, size = "md" }: {
  lang: Lang; onToggle: () => void; size?: "sm" | "md" | "lg";
}) {
  const PAD = size === "sm" ? "2px 3px" : size === "lg" ? "4px 5px" : "3px 4px";
  const ITEM_PAD = size === "sm" ? "3px 10px" : size === "lg" ? "7px 20px" : "5px 14px";
  const FS = size === "sm" ? 9 : size === "lg" ? 13 : 11;
  return (
    <div onClick={onToggle} role="button" aria-label="Toggle language"
      style={{ display:"inline-flex", alignItems:"center", borderRadius:999, border:"1px solid rgba(11,30,63,0.15)", backgroundColor:"#F5F7FA", cursor:"pointer", padding:PAD, userSelect:"none" as const, gap: size==="sm" ? 2 : 3 }}>
      {(["bn","en"] as Lang[]).map(l => (
        <span key={l} style={{
          padding: ITEM_PAD, borderRadius:999,
          fontSize: FS, fontWeight:900, lineHeight:1.4,
          fontFamily: l === "bn" ? "var(--font-bengali)" : "var(--font-sans)",
          backgroundColor: lang === l ? I18N_MOD : "transparent",
          color: lang === l ? "white" : "rgba(11,30,63,0.58)",
          transition:"all 140ms ease",
        }}>
          {l === "bn" ? "বাং" : "EN"}
        </span>
      ))}
    </div>
  );
}

// ─── ② Bilingual text helper ──────────────────────────────────────────────────
// Returns the correct string and applies the correct font for the language.

function BT({ k, lang, style: extra }: { k: StringKey; lang: Lang; style?: CSSProperties }) {
  const lh = extra?.fontSize && +extra.fontSize >= 24 ? lineHeightFor(lang, "heading") : lineHeightFor(lang, "body");
  return (
    <span style={{ fontFamily: fontFor(lang), lineHeight: lh, ...extra }}>
      {t(k, lang)}
    </span>
  );
}

// ─── ③ Status Pill — bilingual ────────────────────────────────────────────────

const STATUS_COLORS: Partial<Record<StringKey, string>> = {
  approved:   "#16A34A",
  pending:    "#B45309",
  inProgress: "#06B6D4",
  completed:  "#16A34A",
  cancelled:  "#9CA3AF",
  active:     "#16A34A",
  onDuty:     "#16A34A",
  archived:   "#475569",
  delayed:    "#EF4444",
  urgent:     "#EF4444",
  atGate:     "#16A34A",
  enRoute:    "#06B6D4",
  inStay:     "#9333EA",
  scheduled:  "#9CA3AF",
};

export function StatusPill({ k, lang, size = "sm" }: { k: StringKey; lang: Lang; size?: "xs"|"sm" }) {
  const color = STATUS_COLORS[k] ?? I18N_MOD;
  const pad = size === "xs" ? "1px 7px" : "3px 10px";
  const fs = size === "xs" ? 8 : 9;
  return (
    <span style={{ padding: pad, borderRadius:999, fontWeight:900, fontSize: fs, fontFamily: fontFor(lang), lineHeight: 1.5, backgroundColor:`${color}18`, color, display:"inline-block", whiteSpace:"nowrap" as const }}>
      {t(k, lang)}
    </span>
  );
}

// ─── ④ Bilingual Button ───────────────────────────────────────────────────────
// IMPORTANT: width is auto/fit-content — never fixed. Bengali labels are 20-60% longer.

type BtnVariant = "primary" | "secondary" | "ghost" | "danger";

export function BiBtn({ k, lang, variant = "primary", color = I18N_MOD, size = "md", onClick }: {
  k: StringKey; lang: Lang; variant?: BtnVariant; color?: string;
  size?: "sm"|"md"|"lg"; onClick?: () => void;
}) {
  const h = size === "sm" ? 32 : size === "lg" ? 52 : 40;
  const px = size === "sm" ? 14 : size === "lg" ? 24 : 18;
  const fs = size === "sm" ? 11 : size === "lg" ? 14 : 12;
  const radius = size === "sm" ? 8 : size === "lg" ? 14 : 10;
  const styles: Record<BtnVariant, CSSProperties> = {
    primary:   { backgroundColor: color,                    color:"white",                 border:"none" },
    secondary: { backgroundColor:`${color}18`,              color,                        border:`1px solid ${color}35` },
    ghost:     { backgroundColor:"#FBFCFD",  color:"rgba(11,30,63,0.86)", border:"1px solid rgba(11,30,63,0.15)" },
    danger:    { backgroundColor:"rgba(239,68,68,0.12)",    color:"#DC2626",              border:"1px solid rgba(239,68,68,0.25)" },
  };
  return (
    <button onClick={onClick} style={{
      height:h, padding:`0 ${px}px`, borderRadius:radius, fontSize: fs, fontWeight:700, cursor:"pointer",
      fontFamily: fontFor(lang), lineHeight: lineHeightFor(lang,"body"), whiteSpace:"nowrap" as const,
      display:"inline-flex", alignItems:"center", justifyContent:"center",
      transition:"all 120ms", flexShrink:0,
      ...styles[variant],
    }}>
      {t(k, lang)}
    </button>
  );
}

// ─── ⑤ Bilingual Input ────────────────────────────────────────────────────────

export function BiInput({ labelKey, placeholderKey, lang, error = false }: {
  labelKey: StringKey; placeholderKey: StringKey; lang: Lang; error?: boolean;
}) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
      <label style={{ fontSize:11, fontWeight:700, color:"rgba(11,30,63,0.86)", fontFamily:fontFor(lang), lineHeight:lineHeightFor(lang,"body") }}>
        {t(labelKey, lang)}
      </label>
      <div style={{ padding:"10px 14px", borderRadius:10, backgroundColor:"#FBFCFD", border:`1px solid ${error?"rgba(239,68,68,0.5)":"rgba(11,30,63,0.38)"}`, fontSize:12, color:"rgba(11,30,63,0.50)", fontFamily:fontFor(lang), lineHeight:lineHeightFor(lang,"body") }}>
        {t(placeholderKey, lang)}
      </div>
      {error && (
        <span style={{ fontSize:10, color:"#DC2626", fontFamily:fontFor(lang) }}>
          {t("required", lang)}
        </span>
      )}
    </div>
  );
}

// ─── ⑥ Sidebar Nav Item — bilingual ──────────────────────────────────────────

function SideNavItem({ icon: Icon, k, lang, active = false, color = I18N_MOD }: {
  icon: typeof Globe; k: StringKey; lang: Lang; active?: boolean; color?: string;
}) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", borderRadius:10, backgroundColor:active?`${color}12`:"transparent", borderLeft:`3px solid ${active?color:"transparent"}`, cursor:"pointer", transition:"all 100ms" }}>
      <Icon size={16} style={{ color: active ? color : "rgba(11,30,63,0.50)", flexShrink:0 }} />
      <span style={{ fontSize:12, fontWeight: active ? 700 : 500, color: active ? color : "rgba(11,30,63,0.66)", fontFamily:fontFor(lang), lineHeight: lineHeightFor(lang,"body"), whiteSpace:"nowrap" as const }}>
        {t(k, lang)}
      </span>
    </div>
  );
}

// ─── ⑦ Table Header Row — bilingual ──────────────────────────────────────────

function TableHeader({ cols, lang }: { cols: StringKey[]; lang: Lang }) {
  return (
    <div style={{ display:"grid", gridTemplateColumns:`repeat(${cols.length},1fr)`, padding:"8px 16px", backgroundColor:"#FBFCFD" }}>
      {cols.map(k => (
        <span key={k} style={{ fontSize:9, fontWeight:900, color:"rgba(11,30,63,0.58)", textTransform:"uppercase" as const, letterSpacing:"0.07em", fontFamily:fontFor(lang) }}>
          {t(k, lang)}
        </span>
      ))}
    </div>
  );
}

function TableRow({ cells, lang, cols, color = I18N_MOD }: {
  cells: { text: string; statusKey?: StringKey }[]; lang: Lang; cols: number; color?: string;
}) {
  return (
    <div style={{ display:"grid", gridTemplateColumns:`repeat(${cols},1fr)`, padding:"0 16px", alignItems:"center", minHeight:48, borderBottom:"1px solid rgba(11,30,63,0.08)", cursor:"pointer" }}
      onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(11,30,63,0.38)")}
      onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}>
      {cells.map((c, i) => (
        <div key={i}>
          {c.statusKey
            ? <StatusPill k={c.statusKey} lang={lang} />
            : <span style={{ fontSize:11, color: i === 0 ? color : "rgba(11,30,63,0.86)", fontFamily: fontFor(lang), fontWeight: i === 0 ? 700 : 400, fontVariantNumeric:"tabular-nums" }}>{c.text}</span>
          }
        </div>
      ))}
    </div>
  );
}

// ─── ⑧ Stepper — bilingual ───────────────────────────────────────────────────

function Stepper({ steps, active, lang, color = I18N_MOD }: {
  steps: StringKey[]; active: number; lang: Lang; color?: string;
}) {
  return (
    <div style={{ display:"flex", alignItems:"flex-start", gap:0 }}>
      {steps.map((k, i) => {
        const isDone = i < active;
        const isNow  = i === active;
        return (
          <div key={k} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", position:"relative" as const }}>
            {/* connector line */}
            {i < steps.length - 1 && (
              <div style={{ position:"absolute" as const, left:"50%", top:12, width:"100%", height:2, backgroundColor: isDone ? color : "#EEF1F6", zIndex:0, transformOrigin:"left" }} />
            )}
            {/* circle */}
            <div style={{ width:24, height:24, borderRadius:12, zIndex:1, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", backgroundColor: isDone ? color : isNow ? `${color}25` : "rgba(11,30,63,0.38)", border:`2px solid ${isDone || isNow ? color : "rgba(11,30,63,0.38)"}` }}>
              {isDone
                ? <CheckCircle size={12} style={{ color:"white" }} />
                : <span style={{ fontSize:9, fontWeight:900, color: isNow ? color : "rgba(11,30,63,0.50)", fontFamily:"var(--font-mono)" }}>{toLocalNum(i+1, lang)}</span>
              }
            </div>
            {/* label */}
            <div style={{ marginTop:8, fontSize:9, fontWeight: isNow ? 700 : 500, color: isDone ? "rgba(11,30,63,0.76)" : isNow ? color : "rgba(11,30,63,0.50)", textAlign:"center" as const, fontFamily:fontFor(lang), lineHeight:lineHeightFor(lang,"body"), maxWidth:80, padding:"0 4px" }}>
              {t(k, lang)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── ⑨ KPI Card — bilingual with local numerals ──────────────────────────────

export function KpiCard({ labelKey, value, subValue, lang, color = I18N_MOD, delta }: {
  labelKey: StringKey; value: string; subValue?: string; lang: Lang; color?: string; delta?: string;
}) {
  const dispValue = toLocalNum(value, lang);
  const dispDelta = delta ? toLocalNum(delta, lang) : undefined;
  return (
    <div style={{ padding:"18px 20px", borderRadius:16, backgroundColor:CARD_BG, border:`1px solid ${BORDER}`, borderTop:`2px solid ${color}` }}>
      <div style={{ fontSize:10, fontWeight:700, color:"rgba(11,30,63,0.58)", fontFamily:fontFor(lang), lineHeight:lineHeightFor(lang,"body"), marginBottom:10 }}>
        {t(labelKey, lang)}
      </div>
      <div style={{ fontSize:28, fontWeight:900, color:"#0B1E3F", fontFamily: lang === "bn" ? "var(--font-bengali)" : "var(--font-mono)", lineHeight:1.1 }}>
        {dispValue}
      </div>
      {subValue && (
        <div style={{ fontSize:10, color:"rgba(11,30,63,0.66)", marginTop:4, fontFamily:fontFor(lang), lineHeight:lineHeightFor(lang,"body") }}>
          {toLocalNum(subValue, lang)}
        </div>
      )}
      {dispDelta && (
        <div style={{ display:"flex", alignItems:"center", gap:4, marginTop:8 }}>
          <ArrowUpRight size={11} style={{ color:"#16A34A" }} />
          <span style={{ fontSize:10, fontWeight:700, color:"#16A34A", fontFamily:fontFor(lang) }}>
            {dispDelta}% {t("increase", lang)}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── SCREEN 1: Typography ─────────────────────────────────────────────────────

const TYPE_SCALE = [
  { token:"Display",   enSize:40, bnSize:38, enWeight:900, bnWeight:900,  enText:"TUBA AL HIJAZ",                bnText:"তুবা আল হিজাজ" },
  { token:"H1",        enSize:28, bnSize:27, enWeight:900, bnWeight:900,  enText:"Group Management",             bnText:"গ্রুপ ব্যবস্থাপনা" },
  { token:"H2",        enSize:22, bnSize:21, enWeight:800, bnWeight:800,  enText:"Passenger List",               bnText:"যাত্রী তালিকা" },
  { token:"H3",        enSize:18, bnSize:17, enWeight:700, bnWeight:700,  enText:"Flight Details",               bnText:"ফ্লাইট বিবরণ" },
  { token:"H4",        enSize:15, bnSize:14, enWeight:700, bnWeight:700,  enText:"Status Update",                bnText:"অবস্থা আপডেট" },
  { token:"Body Lg",   enSize:15, bnSize:14, enWeight:400, bnWeight:400,  enText:"924 passengers served this season with full Hajj support.", bnText:"এই মৌসুমে ৯২৪ জন যাত্রীকে সম্পূর্ণ হজ সহায়তাসহ সেবা প্রদান করা হয়েছে।" },
  { token:"Body Reg",  enSize:13, bnSize:13, enWeight:400, bnWeight:400,  enText:"Group GRP-2891 is currently staying at Jabal Omar Hyatt, Makkah.", bnText:"গ্রুপ GRP-2891 বর্তমানে জাবাল ওমর হায়াত, মক্কায় অবস্থান করছে।" },
  { token:"Body Sm",   enSize:11, bnSize:11, enWeight:400, bnWeight:400,  enText:"Last updated: 16 July 2025, 9:41 AM",         bnText:"শেষ আপডেট: ১৬ জুলাই ২০২৫, সকাল ৯টা ৪১" },
  { token:"Caption",   enSize:10, bnSize:10, enWeight:400, bnWeight:400,  enText:"Source: TUBA AL HIJAZ Operations System",      bnText:"সূত্র: TUBA AL HIJAZ অপারেশন সিস্টেম" },
  { token:"Label",     enSize:9,  bnSize:9,  enWeight:700, bnWeight:700,  enText:"GROUP STATUS · SEASON 1446H",                  bnText:"গ্রুপ অবস্থা · মৌসুম ১৪৪৬হি" },
  { token:"Overline",  enSize:9,  bnSize:9,  enWeight:900, bnWeight:900,  enText:"TOTAL REVENUE",                                bnText:"মোট আয়" },
];

function TypographyScreen() {
  return (
    <div style={{ padding:"32px 32px 48px", maxWidth:1100, margin:"0 auto" }}>
      <SecHead n="01" title="Typography · Font Pairing" sub="Noto Sans Bengali (বাংলা) paired with Plus Jakarta Sans (English). Both fonts sit at matching optical weight across all sizes." />

      {/* Font specimens */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:36 }}>
        <BiCard>
          <BiLabel label="Noto Sans Bengali · নোটো সান্স বাংলা" note="Default language font" />
          <div style={{ padding:"20px 24px" }}>
            {[400,600,700,800,900].map(w => (
              <div key={w} style={{ marginBottom:14 }}>
                <div style={{ fontSize:9, color:"rgba(11,30,63,0.50)", fontFamily:"var(--font-mono)", marginBottom:4 }}>weight {w}</div>
                <div style={{ fontSize:22, fontWeight:w, fontFamily:"var(--font-bengali)", color:"#0B1E3F", lineHeight: lineHeightFor("bn","heading") }}>
                  তুবা আল হিজাজ · উমরাহ ও হজ
                </div>
              </div>
            ))}
          </div>
        </BiCard>
        <BiCard>
          <BiLabel label="Plus Jakarta Sans · English" note="Alternative language font" />
          <div style={{ padding:"20px 24px" }}>
            {[400,600,700,800,900].map(w => (
              <div key={w} style={{ marginBottom:14 }}>
                <div style={{ fontSize:9, color:"rgba(11,30,63,0.50)", fontFamily:"var(--font-mono)", marginBottom:4 }}>weight {w}</div>
                <div style={{ fontSize:22, fontWeight:w, fontFamily:"var(--font-sans)", color:"#0B1E3F", lineHeight: lineHeightFor("en","heading") }}>
                  TUBA AL HIJAZ · Umrah & Hajj
                </div>
              </div>
            ))}
          </div>
        </BiCard>
      </div>

      {/* Key line-height note */}
      <InfoNote>
        <strong style={{ color:"#E2B966" }}>Line-height rule:</strong> Bengali body text requires <code style={{ backgroundColor:"#F5F7FA", padding:"0 4px", borderRadius:3 }}>line-height: 1.75</code> to accommodate matras (ি, ী, ু, ূ) and consonant conjuncts above the headline. English body uses <code style={{ backgroundColor:"#F5F7FA", padding:"0 4px", borderRadius:3 }}>1.5</code>. Headings use 1.6 (Bengali) and 1.35 (English). The <code style={{ backgroundColor:"#F5F7FA", padding:"0 4px", borderRadius:3 }}>lineHeightFor(lang, level)</code> helper in <code style={{ backgroundColor:"#F5F7FA", padding:"0 4px", borderRadius:3 }}>lib/i18n.ts</code> returns the correct value.
      </InfoNote>

      {/* Full type scale */}
      <div style={{ marginTop:36 }}>
        <div style={{ display:"grid", gridTemplateColumns:"70px 1fr 1fr", gap:0, padding:"8px 16px", backgroundColor:"#FBFCFD", borderRadius:"8px 8px 0 0", borderBottom:"1px solid rgba(11,30,63,0.11)" }}>
          {["Token","বাংলা — Noto Sans Bengali","English — Plus Jakarta Sans"].map(h => (
            <span key={h} style={{ fontSize:9, fontWeight:900, color:"rgba(11,30,63,0.50)", textTransform:"uppercase" as const, letterSpacing:"0.07em" }}>{h}</span>
          ))}
        </div>
        {TYPE_SCALE.map((row, i) => (
          <div key={row.token} style={{ display:"grid", gridTemplateColumns:"70px 1fr 1fr", gap:0, padding:"14px 16px", borderBottom:"1px solid rgba(11,30,63,0.08)", backgroundColor:i%2===0?"transparent":"#EEF1F6", alignItems:"start" }}>
            <div style={{ display:"flex", flexDirection:"column" as const, gap:4, paddingTop:4 }}>
              <Chip label={row.token} />
              <span style={{ fontSize:8, color:"rgba(11,30,63,0.50)", fontFamily:"var(--font-mono)" }}>{row.enSize}px / {row.enWeight}</span>
            </div>
            <div style={{ paddingRight:24 }}>
              <div style={{ fontSize:row.bnSize, fontWeight:row.bnWeight, fontFamily:"var(--font-bengali)", color:"#0B1E3F", lineHeight: row.bnSize >= 24 ? lineHeightFor("bn","heading") : lineHeightFor("bn","body") }}>
                {row.bnText}
              </div>
            </div>
            <div>
              <div style={{ fontSize:row.enSize, fontWeight:row.enWeight, fontFamily:"var(--font-sans)", color:"rgba(11,30,63,0.94)", lineHeight: row.enSize >= 24 ? lineHeightFor("en","heading") : lineHeightFor("en","body") }}>
                {row.enText}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── SCREEN 2: Language Toggle ────────────────────────────────────────────────

function ToggleScreen() {
  const [demoLang, setDemoLang] = useState<Lang>("bn");
  return (
    <div style={{ padding:"32px 32px 48px", maxWidth:1000, margin:"0 auto" }}>
      <SecHead n="02" title="Language Toggle Component" sub={`The "বাং / EN" pill switcher lives in every portal's top bar and the mobile profile screen. Toggling swaps all UI strings instantly — no page reload.`} />

      {/* Component variants */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16, marginBottom:32 }}>
        {/* Small */}
        <BiCard>
          <BiLabel label="Small · top bar compact" />
          <div style={{ padding:"20px", display:"flex", flexDirection:"column" as const, gap:16 }}>
            <div style={{ display:"flex", alignItems:"center", gap:12, padding:"8px 12px", borderRadius:8, backgroundColor:"#FBFCFD", justifyContent:"flex-end" }}>
              <span style={{ fontSize:10, color:"rgba(11,30,63,0.58)" }}>TUBA AL HIJAZ</span>
              <div style={{ flex:1 }} />
              <LangToggle lang={demoLang} onToggle={() => setDemoLang(l => l === "bn" ? "en" : "bn")} size="sm" />
            </div>
            <p style={{ fontSize:9, color:"rgba(11,30,63,0.58)", margin:0 }}>Used in ERPShell top bar alongside notification bell and user avatar.</p>
          </div>
        </BiCard>
        {/* Medium */}
        <BiCard>
          <BiLabel label="Medium · default" />
          <div style={{ padding:"20px", display:"flex", flexDirection:"column" as const, gap:16 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", borderRadius:8, backgroundColor:"#FBFCFD" }}>
              <Globe size={14} style={{ color:"rgba(11,30,63,0.58)" }} />
              <LangToggle lang={demoLang} onToggle={() => setDemoLang(l => l === "bn" ? "en" : "bn")} size="md" />
            </div>
            <p style={{ fontSize:9, color:"rgba(11,30,63,0.58)", margin:0 }}>Default size for standalone use. Current: <strong style={{ color:I18N_MOD }}>{demoLang === "bn" ? "বাংলা" : "English"}</strong></p>
          </div>
        </BiCard>
        {/* Large / mobile */}
        <BiCard>
          <BiLabel label="Large · mobile settings" />
          <div style={{ padding:"20px", display:"flex", flexDirection:"column" as const, gap:16 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 14px", borderRadius:10, backgroundColor:"#FBFCFD" }}>
              <div>
                <div style={{ fontSize:12, fontWeight:700, color:"#0B1E3F", fontFamily:fontFor(demoLang) }}>
                  {demoLang === "bn" ? "ভাষা" : "Language"}
                </div>
                <div style={{ fontSize:9, color:"rgba(11,30,63,0.58)", marginTop:2 }}>
                  {demoLang === "bn" ? "ডিফল্ট: বাংলা" : "Default: Bengali"}
                </div>
              </div>
              <LangToggle lang={demoLang} onToggle={() => setDemoLang(l => l === "bn" ? "en" : "bn")} size="lg" />
            </div>
            <p style={{ fontSize:9, color:"rgba(11,30,63,0.58)", margin:0 }}>Used in mobile apps' Profile / Settings tab.</p>
          </div>
        </BiCard>
      </div>

      {/* Live demo strip */}
      <div style={{ borderRadius:16, border:"1px solid rgba(11,30,63,0.11)", overflow:"hidden", marginBottom:28 }}>
        <div style={{ display:"flex", alignItems:"center", gap:14, padding:"12px 20px", backgroundColor:"#FBFCFD", borderBottom:"1px solid rgba(11,30,63,0.11)" }}>
          <span style={{ fontSize:11, fontWeight:700, color:"rgba(11,30,63,0.66)" }}>Live toggle demo</span>
          <div style={{ flex:1 }} />
          <LangToggle lang={demoLang} onToggle={() => setDemoLang(l => l === "bn" ? "en" : "bn")} />
        </div>
        <div style={{ padding:"20px", display:"flex", gap:24, alignItems:"flex-start", flexWrap:"wrap" as const }}>
          {/* Nav items respond to lang */}
          <div>
            <div style={{ fontSize:9, color:"rgba(11,30,63,0.50)", marginBottom:10, fontFamily:"var(--font-mono)", textTransform:"uppercase" as const, letterSpacing:"0.07em" }}>Nav labels</div>
            {(["dashboard","groups","passengers","finance","settings"] as StringKey[]).map(k => (
              <SideNavItem key={k} icon={LayoutDashboard} k={k} lang={demoLang} active={k==="groups"} />
            ))}
          </div>
          <div>
            <div style={{ fontSize:9, color:"rgba(11,30,63,0.50)", marginBottom:10, fontFamily:"var(--font-mono)", textTransform:"uppercase" as const, letterSpacing:"0.07em" }}>Status badges</div>
            <div style={{ display:"flex", flexWrap:"wrap" as const, gap:6 }}>
              {(["approved","pending","inProgress","completed","delayed","urgent"] as StringKey[]).map(k => (
                <StatusPill key={k} k={k} lang={demoLang} />
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize:9, color:"rgba(11,30,63,0.50)", marginBottom:10, fontFamily:"var(--font-mono)", textTransform:"uppercase" as const, letterSpacing:"0.07em" }}>Buttons (auto-width)</div>
            <div style={{ display:"flex", flexWrap:"wrap" as const, gap:8 }}>
              <BiBtn k="save"    lang={demoLang} variant="primary"   />
              <BiBtn k="cancel"  lang={demoLang} variant="secondary" />
              <BiBtn k="approve" lang={demoLang} variant="primary" color="#16A34A" />
              <BiBtn k="reject"  lang={demoLang} variant="danger"    />
            </div>
          </div>
        </div>
      </div>

      <InfoNote>
        <strong style={{ color:"#E2B966" }}>Implementation rule:</strong> The toggle is a <em>client-side state swap</em> — no network request, no page reload. Pass <code style={{ backgroundColor:"#F5F7FA", padding:"0 4px", borderRadius:3 }}>lang</code> as a prop from the top-level page state (or a React context) down to every component. All string keys route through <code style={{ backgroundColor:"#F5F7FA", padding:"0 4px", borderRadius:3 }}>t(key, lang)</code>, all numerals through <code style={{ backgroundColor:"#F5F7FA", padding:"0 4px", borderRadius:3 }}>toLocalNum(n, lang)</code>. The font switches via <code style={{ backgroundColor:"#F5F7FA", padding:"0 4px", borderRadius:3 }}>fontFor(lang)</code>.
      </InfoNote>
    </div>
  );
}

// ─── SCREEN 3: Numerals & Dates ───────────────────────────────────────────────

function NumeralsScreen() {
  const [lang, setLang] = useState<Lang>("bn");
  return (
    <div style={{ padding:"32px 32px 48px", maxWidth:1000, margin:"0 auto" }}>
      <SecHead n="03" title="Numerals & Dates" sub="Default is Bengali script numerals ০–৯. Switch to Western 0–9 and English month names when language = English." />

      {/* Numeral map */}
      <BiCard>
        <BiLabel label="Bengali digit system · ০১২৩৪৫৬৭৮৯" />
        <div style={{ padding:"20px 24px" }}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(10,1fr)", gap:8, marginBottom:16 }}>
            {[0,1,2,3,4,5,6,7,8,9].map(d => (
              <div key={d} style={{ textAlign:"center" as const }}>
                <div style={{ fontSize:28, fontWeight:900, fontFamily:"var(--font-bengali)", color:"#0B1E3F", lineHeight:1.3 }}>{"০১২৩৪৫৬৭৮৯"[d]}</div>
                <div style={{ fontSize:11, color:"rgba(11,30,63,0.50)", fontFamily:"var(--font-mono)" }}>{d}</div>
              </div>
            ))}
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, paddingTop:16, borderTop:"1px solid rgba(11,30,63,0.11)" }}>
            <div>
              <div style={{ fontSize:9, color:"rgba(11,30,63,0.50)", marginBottom:6, textTransform:"uppercase" as const, letterSpacing:"0.07em" }}>Bengali numeral examples</div>
              {[["924","৯২৪"],["8,450,000","৮,৪৫,০০০০"],["19.3%","১৯.৩%"],["08:45","০৮:৪৫"],["1,247","১,২৪৭"]].map(([en,bn]) => (
                <div key={en} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:"1px solid rgba(11,30,63,0.08)" }}>
                  <span style={{ fontSize:12, color:"rgba(11,30,63,0.66)", fontFamily:"var(--font-mono)" }}>{en}</span>
                  <span style={{ fontSize:14, fontWeight:700, fontFamily:"var(--font-bengali)", color:"#0B1E3F" }}>{bn}</span>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize:9, color:"rgba(11,30,63,0.50)", marginBottom:6, textTransform:"uppercase" as const, letterSpacing:"0.07em" }}>Date format comparison</div>
              {([[16,7,2025],[1,1,1446],[28,8,2025],[31,12,2025]] as [number,number,number][]).map(([d,m,y]) => (
                <div key={`${d}${m}${y}`} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 0", borderBottom:"1px solid rgba(11,30,63,0.08)" }}>
                  <span style={{ fontSize:10, color:"rgba(11,30,63,0.58)", fontFamily:"var(--font-mono)" }}>{localDate(d,m,y,"en")}</span>
                  <span style={{ fontSize:12, fontWeight:700, fontFamily:"var(--font-bengali)", color:"#0B1E3F" }}>{localDate(d,m,y,"bn")}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </BiCard>

      {/* KPI card side-by-side with live toggle */}
      <div style={{ marginTop:28 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
          <span style={{ fontSize:11, fontWeight:700, color:"rgba(11,30,63,0.66)" }}>KPI card example — toggle to compare</span>
          <LangToggle lang={lang} onToggle={() => setLang(l => l === "bn" ? "en" : "bn")} />
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14 }}>
          <KpiCard labelKey="ytdRevenue"    value="8,450,000" subValue="SAR 8.45M" lang={lang} color="#16A34A" delta="12.4" />
          <KpiCard labelKey="activePax"     value="924"                            lang={lang} color="#06B6D4" delta="8.1"  />
          <KpiCard labelKey="activeGroups"  value="8"                              lang={lang} color="#9333EA"              />
          <KpiCard labelKey="netMargin"     value="19.3%"                          lang={lang} color="#C9A24B" delta="2.1"  />
        </div>
      </div>

      {/* Date picker preview */}
      <div style={{ marginTop:28 }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
          {(["bn","en"] as Lang[]).map(l => (
            <BiCard key={l}>
              <BiLabel label={l === "bn" ? "Date picker · বাংলা (ডিফল্ট)" : "Date picker · English (Alternative)"} />
              <div style={{ padding:"16px 20px" }}>
                <div style={{ fontSize:9, color:"rgba(11,30,63,0.58)", marginBottom:6, fontFamily:fontFor(l), textTransform:"uppercase" as const, letterSpacing:"0.06em" }}>
                  {l === "bn" ? "যাত্রার তারিখ" : "Travel Date"}
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", borderRadius:10, backgroundColor:"#FBFCFD", border:`1px solid ${I18N_MOD}40` }}>
                  <span style={{ fontSize:14, fontWeight:700, fontFamily:fontFor(l), color:"#0B1E3F", lineHeight: lineHeightFor(l,"body") }}>
                    {localDate(16, 7, 2025, l)}
                  </span>
                  <div style={{ flex:1 }} />
                  <span style={{ fontSize:10, color:"rgba(11,30,63,0.58)", fontFamily:fontFor(l) }}>
                    {localTime(9, 41, l)} {l === "bn" ? "— সকাল" : "— AM"}
                  </span>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:3, marginTop:12 }}>
                  {(l === "bn" ? ["সো","মঙ","বু","বৃ","শু","শ","র"] : ["M","T","W","T","F","S","S"]).map((d,i) => (
                    <div key={i} style={{ textAlign:"center" as const, fontSize:9, fontWeight:700, color:"rgba(11,30,63,0.50)", fontFamily:fontFor(l) }}>{d}</div>
                  ))}
                  {[...Array(31)].map((_,i) => {
                    const day = i+1;
                    const isToday = day === 16;
                    const inRange = day >= 14 && day <= 28;
                    return (
                      <div key={i} style={{ textAlign:"center" as const, fontSize:10, fontWeight: isToday ? 900 : 400, fontFamily:fontFor(l), padding:"4px 2px", borderRadius:6, backgroundColor: isToday ? I18N_MOD : inRange ? `${I18N_MOD}18` : "transparent", color: isToday ? "white" : inRange ? I18N_MOD : "rgba(11,30,63,0.66)", cursor:"pointer" }}>
                        {toLocalNum(day, l)}
                      </div>
                    );
                  })}
                </div>
              </div>
            </BiCard>
          ))}
        </div>
      </div>

      <InfoNote>
        <strong style={{ color:"#E2B966" }}>Bengali numeral encoding:</strong> Use <code style={{ backgroundColor:"#F5F7FA", padding:"0 4px", borderRadius:3 }}>toLocalNum(n, lang)</code> from <code style={{ backgroundColor:"#F5F7FA", padding:"0 4px", borderRadius:3 }}>lib/i18n.ts</code> on every number displayed in the UI. Applies to: KPI values, pagination, seat numbers, pax counts, dates, times, and invoice amounts. Never hardcode Bengali digits in JSX — always convert programmatically so the English toggle shows Western digits automatically.
      </InfoNote>
    </div>
  );
}

// ─── SCREEN 4: Component Library ─────────────────────────────────────────────

const TABLE_COLS: StringKey[] = ["groupId","agent","pax","status","stage","actions"];
const TABLE_ROWS = [
  [{ text:"GRP-2891" },{ text:"রশিদি ট্রাভেলস / Rashidi Travel" },{ text:"৪৭ / 47" },{statusKey:"inStay" as StringKey},{ text:"হোটেল / Hotel" },{ text:"▶" }],
  [{ text:"GRP-2744" },{ text:"আল-মাজদ এজেন্সি / Al-Majd" },  { text:"৩২ / 32" },{statusKey:"enRoute" as StringKey},{ text:"পরিবহন / Transport" },{ text:"▶" }],
  [{ text:"GRP-3301" },{ text:"নূর ট্রাভেলস / Nour Travels" },    { text:"৬৭ / 67" },{statusKey:"pending" as StringKey},{ text:"ভিসা / Visa" },    { text:"▶" }],
];

function ComponentsScreen() {
  return (
    <div style={{ padding:"32px 32px 48px", maxWidth:1100, margin:"0 auto" }}>
      <SecHead n="04" title="Bilingual Component Library" sub='Every component shown in both বাংলা (left, default) and English (right, alternative). Reference this section when building any new screen.' />

      {/* Buttons */}
      <div style={{ marginBottom:32 }}>
        <h3 style={{ fontSize:14, fontWeight:700, color:"rgba(11,30,63,0.76)", marginBottom:16 }}>A. Buttons — auto-width rule</h3>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
          {(["bn","en"] as Lang[]).map(l => (
            <BiCard key={l}>
              <BiLabel label={l === "bn" ? "বাংলা (ডিফল্ট)" : "English (Alternative)"} note={l === "bn" ? "~1.3–1.6× button width" : "Narrower — allow it"} />
              <div style={{ padding:"20px", display:"flex", flexWrap:"wrap" as const, gap:10 }}>
                <BiBtn k="save"         lang={l} variant="primary"   />
                <BiBtn k="cancel"       lang={l} variant="secondary" />
                <BiBtn k="approve"      lang={l} variant="primary" color="#16A34A" />
                <BiBtn k="reject"       lang={l} variant="danger"    />
                <BiBtn k="newGroup"     lang={l} variant="primary" color="#9333EA" />
                <BiBtn k="addPassenger" lang={l} variant="secondary" color="#9333EA" />
                <BiBtn k="viewMore"     lang={l} variant="ghost"     />
                <BiBtn k="signOut"      lang={l} variant="ghost"     />
              </div>
              <div style={{ padding:"0 20px 16px" }}>
                <div style={{ display:"flex", gap:8 }}>
                  <BiBtn k="save" lang={l} variant="primary" size="sm" />
                  <BiBtn k="save" lang={l} variant="primary" size="md" />
                  <BiBtn k="save" lang={l} variant="primary" size="lg" />
                </div>
                <div style={{ fontSize:9, color:"rgba(11,30,63,0.50)", marginTop:8 }}>sm / md / lg — all auto-width</div>
              </div>
            </BiCard>
          ))}
        </div>
        <InfoNote>
          <strong style={{ color:"#E2B966" }}>Width rule:</strong> Buttons use <code style={{ backgroundColor:"#F5F7FA", padding:"0 4px", borderRadius:3 }}>width: auto</code> and <code style={{ backgroundColor:"#F5F7FA", padding:"0 4px", borderRadius:3 }}>padding: 0 Xpx</code> — never a fixed pixel width. Bengali labels are 30–60% longer than English equivalents. The button grows to fit. In flex rows, use <code style={{ backgroundColor:"#F5F7FA", padding:"0 4px", borderRadius:3 }}>flex-wrap: wrap</code> so rows reflow gracefully at both widths.
        </InfoNote>
      </div>

      {/* Inputs */}
      <div style={{ marginBottom:32 }}>
        <h3 style={{ fontSize:14, fontWeight:700, color:"rgba(11,30,63,0.76)", marginBottom:16 }}>B. Inputs — label & placeholder</h3>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
          {(["bn","en"] as Lang[]).map(l => (
            <BiCard key={l}>
              <BiLabel label={l === "bn" ? "বাংলা (ডিফল্ট)" : "English (Alternative)"} />
              <div style={{ padding:"20px", display:"flex", flexDirection:"column" as const, gap:16 }}>
                <BiInput labelKey="groupName"    placeholderKey="enterGroupName" lang={l} />
                <BiInput labelKey="emailAddress" placeholderKey="enterEmail"     lang={l} />
                <BiInput labelKey="groupName"    placeholderKey="enterGroupName" lang={l} error />
              </div>
            </BiCard>
          ))}
        </div>
      </div>

      {/* Status badges */}
      <div style={{ marginBottom:32 }}>
        <h3 style={{ fontSize:14, fontWeight:700, color:"rgba(11,30,63,0.76)", marginBottom:16 }}>C. Status Badges</h3>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
          {(["bn","en"] as Lang[]).map(l => (
            <BiCard key={l}>
              <BiLabel label={l === "bn" ? "বাংলা (ডিফল্ট)" : "English (Alternative)"} />
              <div style={{ padding:"16px 20px", display:"flex", flexWrap:"wrap" as const, gap:8 }}>
                {(["approved","pending","inProgress","completed","cancelled","onDuty","active","delayed","urgent","atGate","enRoute","inStay","archived","scheduled"] as StringKey[]).map(k => (
                  <StatusPill key={k} k={k} lang={l} />
                ))}
              </div>
            </BiCard>
          ))}
        </div>
      </div>

      {/* Sidebar nav */}
      <div style={{ marginBottom:32 }}>
        <h3 style={{ fontSize:14, fontWeight:700, color:"rgba(11,30,63,0.76)", marginBottom:16 }}>D. Sidebar Navigation Labels</h3>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
          {(["bn","en"] as Lang[]).map(l => (
            <BiCard key={l}>
              <BiLabel label={l === "bn" ? "বাংলা (ডিফল্ট)" : "English (Alternative)"} />
              <div style={{ padding:"12px 8px" }}>
                {([
                  [LayoutDashboard,"dashboard"],
                  [Users,"groups"],
                  [FileText,"passengers"],
                  [Wallet,"finance"],
                  [Bell,"notifications"],
                  [Settings,"settings"],
                ] as [typeof Globe, StringKey][]).map(([Icon, k], i) => (
                  <SideNavItem key={k} icon={Icon} k={k} lang={l} active={i===1} />
                ))}
              </div>
            </BiCard>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ marginBottom:32 }}>
        <h3 style={{ fontSize:14, fontWeight:700, color:"rgba(11,30,63,0.76)", marginBottom:16 }}>E. Table Headers & Rows</h3>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
          {(["bn","en"] as Lang[]).map(l => (
            <BiCard key={l}>
              <BiLabel label={l === "bn" ? "বাংলা (ডিফল্ট)" : "English (Alternative)"} />
              <div>
                <TableHeader cols={TABLE_COLS} lang={l} />
                {TABLE_ROWS.map((row, i) => (
                  <TableRow key={i} cells={row.map(c => ({ text: l === "bn" ? (c as any).text?.split(" / ")[0] : (c as any).text?.split(" / ")[1] ?? (c as any).text, statusKey:(c as any).statusKey }))} lang={l} cols={TABLE_COLS.length} />
                ))}
              </div>
            </BiCard>
          ))}
        </div>
      </div>

      {/* Stepper */}
      <div style={{ marginBottom:32 }}>
        <h3 style={{ fontSize:14, fontWeight:700, color:"rgba(11,30,63,0.76)", marginBottom:16 }}>F. Stepper / Progress Indicator</h3>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
          {(["bn","en"] as Lang[]).map(l => (
            <BiCard key={l}>
              <BiLabel label={l === "bn" ? "বাংলা (ডিফল্ট)" : "English (Alternative)"} note="Step 3 active" />
              <div style={{ padding:"24px 20px 28px" }}>
                <Stepper steps={["agentReg","verification","agentApproval","groupCreate","paxImport"]} active={2} lang={l} />
              </div>
            </BiCard>
          ))}
        </div>
        <InfoNote>
          <strong style={{ color:"#E2B966" }}>Stepper note:</strong> Bengali step labels are taller due to line-height 1.75. Allow <code style={{ backgroundColor:"#F5F7FA", padding:"0 4px", borderRadius:3 }}>min-height</code> on the label area below each step circle so the stepper baseline stays aligned across both scripts. Step numbers use <code style={{ backgroundColor:"#F5F7FA", padding:"0 4px", borderRadius:3 }}>toLocalNum(i+1, lang)</code>.
        </InfoNote>
      </div>
    </div>
  );
}

// ─── SCREEN 5: Screen Preview (Full Dashboard in both languages) ──────────────

function MiniDash({ lang, color = "#DC4E2A" }: { lang: Lang; color?: string }) {
  const BN = lang === "bn";
  const bg = "#FFFFFF";
  return (
    <div style={{ borderRadius:16, overflow:"hidden", border:"1px solid rgba(11,30,63,0.15)", backgroundColor:bg }}>
      {/* Module header */}
      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 16px", backgroundColor:"#FBFCFD", borderBottom:"1px solid rgba(11,30,63,0.11)" }}>
        <div style={{ width:28, height:28, borderRadius:8, backgroundColor:`${color}20`, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <Zap size={14} style={{ color }} />
        </div>
        <span style={{ fontSize:13, fontWeight:900, color:"#0B1E3F", fontFamily:fontFor(lang) }}>
          {BN ? "সিইও ড্যাশবোর্ড" : "CEO Dashboard"}
        </span>
        <div style={{ flex:1 }} />
        {/* Language toggle */}
        <LangToggle lang={lang} onToggle={() => {}} size="sm" />
        {/* User avatar */}
        <div style={{ width:26, height:26, borderRadius:8, backgroundColor:"#F5F7FA", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <span style={{ fontSize:8, fontWeight:900, color:"rgba(11,30,63,0.76)" }}>AO</span>
        </div>
      </div>
      {/* KPI row */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, padding:"14px 14px 0" }}>
        {([
          ["ytdRevenue",  "৮.৪৫ মি / 8.45M",  "#16A34A", "12.4"],
          ["activePax",   "৯২৪ / 924",          "#06B6D4", "8.1"],
          ["activeGroups","৮ / 8",               "#9333EA", undefined],
          ["netMargin",   "১৯.৩% / 19.3%",       "#C9A24B", "2.1"],
        ] as [StringKey,string,string,string|undefined][]).map(([k,v,c,d]) => {
          const val = toLocalNum(v.split(" / ")[BN?0:1], lang);
          return (
            <div key={k} style={{ padding:"12px", borderRadius:12, backgroundColor:"#FBFCFD", borderTop:`2px solid ${c}` }}>
              <div style={{ fontSize:9, color:"rgba(11,30,63,0.58)", fontFamily:fontFor(lang), lineHeight:1.6, marginBottom:6 }}>{t(k, lang)}</div>
              <div style={{ fontSize:18, fontWeight:900, color:"#0B1E3F", fontFamily:lang==="bn"?"var(--font-bengali)":"var(--font-mono)", lineHeight:1.1 }}>{val}</div>
              {d && <div style={{ fontSize:9, color:"#16A34A", marginTop:4 }}>↑ {toLocalNum(d, lang)}% {t("increase",lang)}</div>}
            </div>
          );
        })}
      </div>
      {/* Mini table */}
      <div style={{ margin:"14px 14px 14px" }}>
        <div style={{ borderRadius:10, overflow:"hidden", border:"1px solid rgba(11,30,63,0.11)" }}>
          <TableHeader cols={["groupId","pax","status","stage"]} lang={lang} />
          {[
            [{text:"GRP-2891"},{text:toLocalNum("47",lang)},{statusKey:"inStay" as StringKey},{text:t("hotel",lang)}],
            [{text:"GRP-2744"},{text:toLocalNum("32",lang)},{statusKey:"enRoute" as StringKey},{text:t("transport",lang)}],
          ].map((row,i) => (
            <TableRow key={i} cells={row as any} lang={lang} cols={4} color={color} />
          ))}
        </div>
      </div>
      {/* Date footer */}
      <div style={{ padding:"8px 16px 12px", fontSize:9, color:"rgba(11,30,63,0.50)", fontFamily:fontFor(lang), borderTop:"1px solid rgba(11,30,63,0.08)" }}>
        {t("lastUpdated",lang)}: {localDate(16,7,2025,lang)} · {localTime(9,41,lang)}
      </div>
    </div>
  );
}

function PreviewScreen() {
  const [live, setLive] = useState<Lang>("bn");
  return (
    <div style={{ padding:"32px 32px 48px", maxWidth:1100, margin:"0 auto" }}>
      <SecHead n="05" title="Screen Preview — Toggle End-to-End" sub="The same CEO Dashboard shown in বাংলা (left, default) and English (right, alternative). This is the canonical reference pair for any screen." />

      {/* Live toggle */}
      <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:20 }}>
        <span style={{ fontSize:11, color:"rgba(11,30,63,0.66)" }}>Live preview:</span>
        <LangToggle lang={live} onToggle={() => setLive(l => l === "bn" ? "en" : "bn")} />
        <span style={{ fontSize:9, color:"rgba(11,30,63,0.50)" }}>
          {live === "bn" ? "বাংলা সক্রিয় — এটি ডিফল্ট অবস্থা" : "English active — alternative state"}
        </span>
      </div>

      {/* Full-width live preview */}
      <div style={{ marginBottom:36 }}>
        <MiniDash lang={live} />
      </div>

      {/* Fixed side-by-side comparison */}
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:12, fontWeight:700, color:"rgba(11,30,63,0.66)", marginBottom:16 }}>Reference pair — always shown side by side</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
              <div style={{ width:8, height:8, borderRadius:4, backgroundColor:I18N_MOD }} />
              <span style={{ fontSize:10, fontWeight:900, color:"rgba(11,30,63,0.66)", fontFamily:"var(--font-bengali)" }}>বাংলা (ডিফল্ট)</span>
            </div>
            <MiniDash lang="bn" color="#9333EA" />
          </div>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
              <div style={{ width:8, height:8, borderRadius:4, backgroundColor:"#E4E9F0" }} />
              <span style={{ fontSize:10, fontWeight:900, color:"rgba(11,30,63,0.66)" }}>English (Alternative)</span>
            </div>
            <MiniDash lang="en" color="#06B6D4" />
          </div>
        </div>
      </div>

      {/* Default state rule notice */}
      <div style={{ borderRadius:16, padding:"20px 24px", backgroundColor:`${I18N_MOD}10`, border:`1px solid ${I18N_MOD}30` }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
          <Globe size={16} style={{ color:I18N_MOD }} />
          <span style={{ fontSize:13, fontWeight:900, color:"#0B1E3F" }}>Default State Rule — All screens from this point forward</span>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
          {[
            ["1. Language","Every new screen must accept a `lang: Lang` prop (or read from context). Import `t`, `toLocalNum`, `localDate`, `fontFor` from `lib/i18n`."],
            ["2. Default","Render Bangla (বাংলা) as the primary/default state. The English toggle is always available but never the initial state."],
            ["3. Font","Apply `fontFamily: fontFor(lang)` to every text node. Apply `lineHeight: lineHeightFor(lang, level)` to body text and headings."],
            ["4. Numerals","Wrap every number display in `toLocalNum(n, lang)`. Wrap every date in `localDate(d,m,y,lang)`. Never hardcode Bengali digits."],
          ].map(([t,d]) => (
            <div key={t as string} style={{ padding:"12px 14px", borderRadius:10, backgroundColor:"#FBFCFD" }}>
              <div style={{ fontSize:10, fontWeight:900, color:I18N_MOD, marginBottom:5 }}>{t}</div>
              <div style={{ fontSize:10, color:"rgba(11,30,63,0.76)", lineHeight:1.65 }}>{d}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function I18nSystem() {
  const [screen, setScreen] = useState<I18NScreen>("typography");

  const SCREENS: Record<I18NScreen, () => ReactNode> = {
    typography: () => <TypographyScreen />,
    toggle:     () => <ToggleScreen />,
    numerals:   () => <NumeralsScreen />,
    components: () => <ComponentsScreen />,
    preview:    () => <PreviewScreen />,
  };

  return (
    <ERPShell
      moduleId="i18n"
      moduleName="Bilingual System"
      moduleColor={I18N_MOD}
      moduleIcon={Globe as IconFC}
      navItems={I18N_NAV}
      activeItem={screen}
      onItemClick={id => setScreen(id as I18NScreen)}
      breadcrumb={["Design System", "Bilingual i18n"]}
      notificationCount={0}
      userName="Abdullah Al-Otaibi"
      userRole="TUBA AL HIJAZ · Super Admin"
    >
      <div className="h-full overflow-y-auto" style={{ scrollbarWidth:"thin", scrollbarColor:"rgba(11,30,63,0.38) transparent" }}>
        {SCREENS[screen]()}
      </div>
    </ERPShell>
  );
}
