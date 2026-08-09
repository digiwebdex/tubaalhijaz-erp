import { Link } from "react-router";
import { motion, useReducedMotion } from "motion/react";
import {
  FileCheck, Building, Bus, UtensilsCrossed, Wallet, Truck,
  ArrowRight, Users, Globe2, CheckCircle, TrendingUp,
  Star, ChevronRight, MapPin, ShieldCheck, Clock
} from "lucide-react";
import { useLang } from "../lib/LangContext";
import { fontFor, lineHeightFor } from "../lib/i18n";
import HeroBackdrop from "../components/HeroBackdrop";

const NAVY = "#0F1326";
const INK  = "#E2E8F5";
const GOLD = "#C8943A";
const WARM = "#07091A";

const MODULES = [
  { id: "visa",      icon: FileCheck,       color: "#2FB8A8", bg: "rgba(47,184,168,0.10)",
    en: { name: "Visa Processing",     sub: "Desk-operated pipeline", desc: "End-to-end mutamer visa desk — OCR intake, staff-updated pipeline status, Umrah Co coordination, and agent notifications. No live government visa API." },
    bn: { name: "ভিসা প্রক্রিয়াকরণ", sub: "ডেস্ক-পরিচালিত পাইপলাইন", desc: "শুরু থেকে শেষ পর্যন্ত মুতামির ভিসা ডেস্ক — OCR ইনটেক, স্টাফ-আপডেটেড পাইপলাইন স্ট্যাটাস, উমরাহ কোম্পানি সমন্বয় এবং এজেন্ট নোটিফিকেশন। কোনো লাইভ সরকারি ভিসা API নেই।" } },
  { id: "hotel",     icon: Building,        color: "#3B7FE8", bg: "rgba(59,127,232,0.10)",
    en: { name: "Hotel Accommodation", sub: "Makkah · Madinah",      desc: "Seamless hotel booking coordination for pilgrims across Makkah, Madinah and Jeddah with occupancy management." },
    bn: { name: "হোটেল আবাসন",         sub: "মক্কা · মদিনা",        desc: "মক্কা, মদিনা ও জেদ্দায় যাত্রীদের জন্য নিরবচ্ছিন্ন হোটেল বুকিং সমন্বয় এবং আসন ব্যবস্থাপনা।" } },
  { id: "transport", icon: Bus,             color: "#E8991A", bg: "rgba(232,153,26,0.10)",
    en: { name: "Ground Transport",    sub: "Full fleet dispatch",    desc: "Full fleet dispatch and routing management for pilgrim transport between Masha'er, airports and accommodations." },
    bn: { name: "স্থলপথ পরিবহন",       sub: "সম্পূর্ণ ফ্লিট প্রেরণ", desc: "মাশায়ের, বিমানবন্দর ও আবাসনের মধ্যে যাত্রী পরিবহনের জন্য সম্পূর্ণ ফ্লিট প্রেরণ ও রুটিং ব্যবস্থাপনা।" } },
  { id: "catering",  icon: UtensilsCrossed, color: "#9B7BE8", bg: "rgba(155,123,232,0.10)",
    en: { name: "Catering & Meals",    sub: "Halal certified",        desc: "Halal-certified catering logistics with supplier management, dietary tracking and delivery coordination." },
    bn: { name: "খাদ্য ও পানীয়",       sub: "হালাল সার্টিফাইড",     desc: "সরবরাহকারী ব্যবস্থাপনা, খাদ্য ট্র্যাকিং এবং ডেলিভারি সমন্বয় সহ হালাল-প্রত্যয়িত ক্যাটারিং লজিস্টিক্স।" } },
  { id: "finance",   icon: Wallet,          color: "#22B573", bg: "rgba(34,181,115,0.10)",
    en: { name: "Finance & Billing",   sub: "Multi-currency",         desc: "Integrated financial management covering group invoicing, supplier payments and multi-currency reconciliation." },
    bn: { name: "অর্থ ও চালান",          sub: "বহু-মুদ্রা সমর্থন",    desc: "গ্রুপ ইনভয়েসিং, সরবরাহকারী পেমেন্ট এবং বহু-মুদ্রা রিকনসিলিয়েশন সমন্বিত আর্থিক ব্যবস্থাপনা।" } },
  { id: "fleet",     icon: Truck,           color: "#A8B8D8", bg: "#141830",
    en: { name: "Fleet Management",    sub: "Real-time tracking",     desc: "Real-time vehicle tracking, maintenance scheduling and driver management for your entire transport fleet." },
    bn: { name: "ফ্লিট ব্যবস্থাপনা",   sub: "রিয়েল-টাইম ট্র্যাকিং", desc: "আপনার সম্পূর্ণ পরিবহন বহরের জন্য রিয়েল-টাইম যান ট্র্যাকিং, রক্ষণাবেক্ষণ সময়সূচি এবং চালক ব্যবস্থাপনা।" } },
];

const TRUST_LOGOS = [
  { name: "NUSUK",   sub: "نسك",             en: "Official Hajj & Umrah Platform", bn: "হজ ও উমরাহ অফিসিয়াল প্ল্যাটফর্ম" },
  { name: "MOFA",    sub: "وزارة الخارجية",  en: "Ministry of Foreign Affairs",    bn: "পররাষ্ট্র মন্ত্রণালয়" },
  { name: "MUALLIM", sub: "معلم",             en: "Pilgrims Service Authority",     bn: "তীর্থযাত্রী সেবা কর্তৃপক্ষ" },
  { name: "MHU",     sub: "وزارة الحج",      en: "Ministry of Hajj & Umrah",       bn: "হজ ও উমরাহ মন্ত্রণালয়" },
  { name: "GASTAT",  sub: "هيئة الإحصاء",   en: "General Authority for Statistics",bn: "সাধারণ পরিসংখ্যান কর্তৃপক্ষ" },
];

// Hero credential rail — deliberately distinct facts from the STATS band below,
// so the two never read as the same claim repeated twice.
const HERO_PROOF = [
  { icon: MapPin,
    en: { k: "Makkah · Madinah · Jeddah", v: "Own ground teams in all three cities" },
    bn: { k: "মক্কা · মদিনা · জেদ্দা",     v: "তিন শহরেই নিজস্ব গ্রাউন্ড টিম" } },
  { icon: ShieldCheck,
    en: { k: "NUSUK · MOFA",              v: "Process-aligned operations" },
    bn: { k: "NUSUK · MOFA",              v: "প্রক্রিয়া-সংগতিপূর্ণ অপারেশন" } },
  { icon: Clock,
    en: { k: "24/7",                      v: "Season-long operations desk" },
    bn: { k: "২৪/৭",                      v: "মৌসুমজুড়ে অপারেশন ডেস্ক" } },
];

const STATS = [
  { value: "2.4M+", en: { label: "Pilgrims Served",    sub: "since 2006" }, bn: { label: "হাজি ও উমরাহকারী", sub: "২০০৬ সাল থেকে" }, icon: Users },
  { value: "94.8%", en: { label: "Visa Approval Rate", sub: "avg. last 3 seasons" }, bn: { label: "ভিসা অনুমোদনের হার", sub: "গত ৩ মৌসুমের গড়" }, icon: CheckCircle },
  { value: "18+",   en: { label: "Years Operating",    sub: "Saudi Arabia" }, bn: { label: "বছরের অভিজ্ঞতা", sub: "সৌদি আরবে" }, icon: Star },
  { value: "47",    en: { label: "Partner Countries",  sub: "worldwide" }, bn: { label: "অংশীদার দেশ", sub: "বিশ্বজুড়ে" }, icon: Globe2 },
];

const WHY_ITEMS = {
  en: [
    { title: "Staff-Updated Visa Desk",      desc: "Mutamer pipeline status is maintained by Visa Desk / Umrah Co staff — auditable, notify-on-material-change, no fake live government API claims." },
    { title: "Bilingual Operations",          desc: "Full Bengali and English support throughout — from pilgrim records to supplier contracts and official documentation." },
    { title: "Season-Scale Infrastructure",  desc: "Engineered to handle 50,000+ concurrent pilgrim records during peak Ramadan and Hajj seasons." },
    { title: "Certified Saudi Operator",     desc: "Licensed ground handling operator under Saudi Vision 2030 tourism and religious services frameworks." },
  ],
  bn: [
    { title: "স্টাফ-আপডেটেড ভিসা ডেস্ক",        desc: "মুতামির পাইপলাইন স্ট্যাটাস ভিসা ডেস্ক / উমরাহ কোম্পানি স্টাফ বজায় রাখে — অডিটেবল, গুরুত্বপূর্ণ পরিবর্তনে নোটিফাই; কোনো নকল লাইভ সরকারি API দাবি নেই।" },
    { title: "দ্বিভাষিক অপারেশন",              desc: "তীর্থযাত্রী রেকর্ড থেকে সরবরাহকারী চুক্তি এবং অফিসিয়াল ডকুমেন্টেশন পর্যন্ত সম্পূর্ণ বাংলা ও ইংরেজি সমর্থন।" },
    { title: "মৌসুম-স্কেল অবকাঠামো",           desc: "রমজান ও হজ মৌসুমে ৫০,০০০+ একযোগে তীর্থযাত্রী রেকর্ড পরিচালনার জন্য প্রকৌশলিত।" },
    { title: "সার্টিফাইড সৌদি অপারেটর",        desc: "সৌদি ভিশন ২০৩০ পর্যটন ও ধর্মীয় সেবা কাঠামোর অধীনে লাইসেন্সপ্রাপ্ত গ্রাউন্ড হ্যান্ডলিং অপারেটর।" },
  ],
};

function GeometricPattern({ opacity = 0.04 }: { opacity?: number }) {
  return (
    <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg" style={{ opacity }}>
      <defs>
        <pattern id="geo-hero" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
          <path d="M40 0L80 20V60L40 80L0 60V20Z" fill="none" stroke={GOLD} strokeWidth="0.6" />
          <path d="M40 15L65 27.5V52.5L40 65L15 52.5V27.5Z" fill="none" stroke={GOLD} strokeWidth="0.4" />
          <circle cx="40" cy="40" r="5" fill="none" stroke={GOLD} strokeWidth="0.4" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#geo-hero)" />
    </svg>
  );
}

export default function Home() {
  const { lang } = useLang();
  const ff = fontFor(lang);
  const lh = lineHeightFor(lang, "body");
  const lhH = lineHeightFor(lang, "heading");
  const lhD = lineHeightFor(lang, "display");
  const isBn = lang === "bn";
  const T = (bn: string, en: string) => (isBn ? bn : en);

  // Entrance choreography. `motion` earns its keep here only — one staggered
  // reveal on mount. Everything ambient in the hero is CSS (see HeroBackdrop).
  const reduce = useReducedMotion();
  const rise = {
    hidden: { opacity: 0, y: 26 },
    show: { opacity: 1, y: 0, transition: { duration: 0.75, ease: [0.16, 1, 0.3, 1] } },
  } as const;
  const stagger = {
    hidden: {},
    show: { transition: { staggerChildren: 0.1, delayChildren: 0.08 } },
  } as const;
  // Under prefers-reduced-motion we mount straight into the resting state.
  const initial = reduce ? "show" : "hidden";

  return (
    <div style={{ backgroundColor: WARM }}>
      {/* ─── Hero ────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        <HeroBackdrop />

        <motion.div
          className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-10 pt-32 pb-20 lg:pt-36 lg:pb-28"
          variants={stagger}
          initial={initial}
          animate="show"
        >
          <div className={isBn ? "max-w-[44rem]" : "max-w-[52rem]"}>
            {/* Eyebrow */}
            <motion.div variants={rise}>
              <div
                className="inline-flex items-center gap-2.5 pl-3 pr-4 py-2 rounded-full mb-8 border backdrop-blur-sm"
                style={{ borderColor: `${GOLD}38`, backgroundColor: "rgba(201,162,75,0.08)" }}
              >
                <span className="relative flex w-1.5 h-1.5 shrink-0">
                  <span className="thj-anim thj-ping absolute inset-0 rounded-full" style={{ backgroundColor: GOLD }} />
                  <span className="relative w-1.5 h-1.5 rounded-full" style={{ backgroundColor: GOLD }} />
                </span>
                <span
                  className={`text-[10px] sm:text-[11px] font-bold uppercase ${isBn ? "tracking-[0.08em]" : "tracking-[0.18em]"}`}
                  style={{ color: "#D9A84A", fontFamily: ff, lineHeight: 1.5 }}
                >
                  {T("২০০৬ সাল থেকে ২৪ লাখ+ তীর্থযাত্রীর আস্থা", "Trusted by 2.4M+ Pilgrims Since 2006")}
                </span>
              </div>
            </motion.div>

            {/* Headline. Bangla sets wider and taller than English at the same
                px size, so it gets its own (smaller) ramp rather than a shared one. */}
            <motion.h1
              variants={rise}
              className={`font-bold text-[#E2E8F5] mb-6 ${
                isBn
                  ? "text-[1.8rem] sm:text-[2.6rem] lg:text-[3.4rem] xl:text-[3.75rem]"
                  : "text-[2.25rem] sm:text-[3.25rem] lg:text-[4.25rem] xl:text-[4.75rem]"
              }`}
              style={{
                lineHeight: lhD,
                fontFamily: ff,
                letterSpacing: isBn ? "0" : "-0.028em",
                textWrap: "balance",
              }}
            >
              {isBn ? (
                <>
                  প্রতিটি পবিত্র যাত্রার
                  <br />
                  <span className="thj-goldtext">ভিত্তিভূমি</span>
                </>
              ) : (
                <>
                  The Ground Beneath
                  <br />
                  <span className="thj-goldtext">Every Sacred Journey</span>
                </>
              )}
            </motion.h1>

            {/* Lede */}
            <motion.p
              variants={rise}
              className={`mb-9 max-w-[38rem] ${isBn ? "text-[15px] sm:text-base" : "text-base sm:text-lg"}`}
              style={{ color: "rgba(226,232,245,0.76)", fontFamily: ff, lineHeight: lh }}
            >
              {T(
                "উমরাহ ও হজ অপারেশনের জন্য সৌদি আরবে আমাদের সম্পূর্ণ গ্রাউন্ড হ্যান্ডলিং সেবা — ভিসা ক্লিয়ারেন্স, হোটেল লজিস্টিক্স, পরিবহন প্রেরণ, ক্যাটারিং ও আর্থিক ব্যবস্থাপনা, সবই এক দায়বদ্ধ অপারেশনের অধীনে।",
                "The Kingdom's ground handling partner for Umrah and Hajj — visa clearance, hotel logistics, transport dispatch, catering and financial administration, delivered as one accountable operation."
              )}
            </motion.p>

            {/* CTAs — primary sends applicants to the agent registration wizard */}
            <motion.div variants={rise} className="flex flex-col sm:flex-row gap-3.5">
              <Link
                to="/auth-onboarding"
                className="thj-cta group relative overflow-hidden inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl font-bold text-base transition-transform duration-200 hover:-translate-y-0.5"
                style={{
                  background: `linear-gradient(135deg, #C8943A 0%, ${GOLD} 55%, #D9A84A 100%)`,
                  color: INK,
                  fontFamily: ff,
                  boxShadow: "0 10px 30px -10px rgba(201,162,75,0.55)",
                }}
              >
                <span
                  className="thj-sheen pointer-events-none absolute left-0 top-0 bottom-0 w-1/3"
                  style={{ background: "linear-gradient(90deg, transparent, #1C2444, transparent)" }}
                />
                <span className="relative">{T("এজেন্ট হন", "Become an Agent")}</span>
                <ArrowRight size={16} className="relative transition-transform duration-200 group-hover:translate-x-1" />
              </Link>

              <Link
                to="/login"
                className="thj-cta inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl font-bold text-base border backdrop-blur-sm transition-colors duration-200 hover:bg-[#0F1326]/[0.07]"
                style={{ borderColor: "rgba(226,232,245,0.22)", backgroundColor: "#141830", color: "#E2E8F5", fontFamily: ff }}
              >
                {T("সরবরাহকারী লগইন", "Supplier Login")}
                <ChevronRight size={16} />
              </Link>
            </motion.div>

            {/* Credential rail */}
            <motion.div
              variants={rise}
              className="mt-12 lg:mt-16 grid grid-cols-1 sm:grid-cols-3 gap-y-5 gap-x-2 max-w-[46rem]"
            >
              {HERO_PROOF.map((item, i) => {
                const p = item[lang];
                return (
                  <div
                    key={item.en.k}
                    className={i > 0 ? "sm:pl-5 sm:border-l" : ""}
                    style={i > 0 ? { borderColor: "rgba(226,232,245,0.15)" } : undefined}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <item.icon size={13} style={{ color: GOLD }} className="shrink-0" />
                      <span
                        className="text-[13px] font-bold text-[#E2E8F5]"
                        style={{ fontFamily: ff, lineHeight: lhH }}
                      >
                        {p.k}
                      </span>
                    </div>
                    <div
                      className="text-[11px] sm:text-xs"
                      style={{ color: "rgba(226,232,245,0.58)", fontFamily: ff, lineHeight: lh }}
                    >
                      {p.v}
                    </div>
                  </div>
                );
              })}
            </motion.div>
          </div>
        </motion.div>

        {/* Scroll cue — desktop only, so it can never collide with the rail */}
        <div className="hidden lg:flex absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex-col items-center gap-3">
          <span
            className="text-[9px] font-bold uppercase tracking-[0.28em]"
            style={{ color: "rgba(226,232,245,0.50)", fontFamily: ff }}
          >
            {T("নিচে দেখুন", "Scroll")}
          </span>
          <span className="relative block w-px h-12 overflow-hidden" style={{ backgroundColor: "#1C2444" }}>
            <span
              className="thj-anim thj-cue absolute inset-x-0 top-0 h-4"
              style={{ background: `linear-gradient(to bottom, transparent, ${GOLD})` }}
            />
          </span>
        </div>
      </section>

      {/* Trust Strip */}
      <section style={{ backgroundColor: "#0F1326", borderTop: `1px solid rgba(226,232,245,0.06)`, borderBottom: `1px solid rgba(226,232,245,0.06)` }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-8">
          <div className="text-center mb-6">
            <div className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: "#5A6A8A", fontFamily: ff }}>
              {isBn ? "সৌদি সরকারি প্ল্যাটফর্মের সাথে সংযুক্ত" : "Integrated with Saudi Government Platforms"}
            </div>
          </div>
          <div className="flex items-center justify-center gap-8 flex-wrap">
            {TRUST_LOGOS.map((logo) => (
              <div key={logo.name} className="flex flex-col items-center gap-1.5 group">
                <div className="w-20 h-14 rounded-xl border flex flex-col items-center justify-center gap-0.5 transition-all" style={{ borderColor: `${NAVY}12`, backgroundColor: "white" }}>
                  <div className="text-sm font-black tracking-wider" style={{ color: INK }}>{logo.name}</div>
                  <div className="text-[9px]" style={{ color: GOLD, fontFamily: "var(--font-arabic)" }} lang="ar">{logo.sub}</div>
                </div>
                <div className="text-[10px] text-center max-w-20 leading-tight" style={{ color: "#5A6A8A", fontFamily: ff }}>
                  {isBn ? logo.bn : logo.en}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services Overview */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="text-center mb-14">
            <div className="text-xs font-bold uppercase tracking-[0.2em] mb-4" style={{ color: GOLD, fontFamily: ff }}>
              {isBn ? "সেবা বিভাগ" : "Service Lines"}
            </div>
            <h2 className="text-4xl font-bold mb-4" style={{ color: INK, fontFamily: ff, lineHeight: lhH }}>
              {isBn ? "সম্পূর্ণ তীর্থযাত্রা লজিস্টিক্স" : "Complete Pilgrimage Logistics"}
            </h2>
            <p className="text-lg max-w-2xl mx-auto" style={{ color: "#A8B8D8", fontFamily: ff, lineHeight: lh }}>
              {isBn
                ? "ভিসা থেকে প্রস্থান পর্যন্ত উমরাহ গ্রাউন্ড অপারেশনের প্রতিটি দিক কভার করে ছয়টি সমন্বিত সেবা মডিউল।"
                : "Six integrated service modules covering every aspect of Umrah ground operations — from visa to departure."
              }
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
            {MODULES.map((mod) => {
              const m = mod[lang];
              return (
                <Link
                  key={mod.id}
                  to={`/services#${mod.id}`}
                  className="bg-[#0F1326] rounded-xl border p-6 md:p-7 transition-all duration-300 group focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 hover:shadow-md"
                  style={{ borderColor: `${NAVY}10`, outlineColor: GOLD }}
                >
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5" style={{ backgroundColor: mod.bg }} aria-hidden>
                    <mod.icon size={22} style={{ color: mod.color }} />
                  </div>
                  <h3 className="text-lg font-bold mb-1.5" style={{ color: INK, fontFamily: ff, lineHeight: lhH }}>{m.name}</h3>
                  <div className="text-xs font-bold mb-3 uppercase tracking-wide" style={{ color: mod.color, fontFamily: ff }}>
                    {m.sub}
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: "#A8B8D8", fontFamily: ff, lineHeight: lh }}>{m.desc}</p>
                  <div className="flex items-center gap-1.5 mt-5 text-xs font-semibold transition-all" style={{ color: mod.color, fontFamily: ff }}>
                    {isBn ? "আরও জানুন" : "Learn more"} <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" aria-hidden />
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="text-center mt-10">
            <Link to="/services" className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-sm border-2 transition-all" style={{ borderColor: NAVY, color: INK, fontFamily: ff }}>
              {isBn ? "সব সেবার বিস্তারিত দেখুন" : "View All Service Details"}
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Band */}
      <section className="py-20 relative overflow-hidden" style={{ backgroundColor: NAVY }}>
        <GeometricPattern opacity={0.04} />
        <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {STATS.map((stat) => {
              const s = stat[lang];
              return (
                <div key={stat.value} className="text-center">
                  <div className="text-5xl font-bold mb-2" style={{ color: GOLD }}>{stat.value}</div>
                  <div className="text-sm font-semibold text-white mb-1" style={{ fontFamily: ff }}>{s.label}</div>
                  <div className="text-xs" style={{ color: "rgba(15,19,38,0.62)", fontFamily: ff, lineHeight: lh }}>{s.sub}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Why TUBA */}
      <section className="py-24" style={{ backgroundColor: "#0F1326" }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.2em] mb-5" style={{ color: GOLD, fontFamily: ff }}>
                {isBn ? "আমাদের কেন বেছে নেবেন" : "Why Choose Us"}
              </div>
              <h2 className="text-4xl font-bold mb-6" style={{ color: INK, fontFamily: ff, lineHeight: lhH }}>
                {isBn
                  ? "পবিত্র মৌসুম অপারেশনের চাহিদার জন্য নির্মিত"
                  : "Built for the Demands of Sacred Season Operations"
                }
              </h2>
              <p className="text-base mb-8" style={{ color: "#A8B8D8", fontFamily: ff, lineHeight: lh }}>
                {isBn
                  ? "উমরাহ ও হজ গ্রুপ পরিচালনার জন্য এমন নির্ভুলতা প্রয়োজন যা স্ট্যান্ডার্ড লজিস্টিক্স প্ল্যাটফর্ম দিতে পারে না। তুবা আল হিজাজ সৌদি গ্রাউন্ড হ্যান্ডলিংয়ের জন্য বিশেষভাবে নির্মিত।"
                  : "Managing Umrah and Hajj groups demands precision that standard logistics platforms cannot deliver. TUBA AL HIJAZ is purpose-built for Saudi ground handling — bilingual, desk-operated, and season-ready."
                }
              </p>
              <div className="space-y-3">
                {WHY_ITEMS[lang].map((item) => (
                  <div
                    key={item.title}
                    className="flex gap-4 rounded-xl p-3 md:p-4"
                    style={{ backgroundColor: "#0F1326", border: `1px solid ${NAVY}0A` }}
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${GOLD}18` }} aria-hidden>
                      <CheckCircle size={14} style={{ color: GOLD }} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold mb-1" style={{ color: INK, fontFamily: ff }}>{item.title}</div>
                      <div className="text-sm" style={{ color: "#A8B8D8", fontFamily: ff, lineHeight: lh }}>{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="rounded-xl overflow-hidden aspect-[4/3] shadow-2xl">
                <img src="https://images.unsplash.com/photo-1768961869826-cb62a2dd93b1?auto=format&fit=crop&w=900&q=80" alt="Makkah skyline" className="w-full h-full object-cover" />
                <div className="absolute inset-0" style={{ background: `linear-gradient(to top, rgba(226,232,245,0.6) 0%, transparent 50%)` }} />
              </div>
              <div className="absolute -bottom-6 -left-6 bg-[#0F1326] rounded-xl shadow-xl p-5 border" style={{ borderColor: `${NAVY}08` }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${GOLD}15` }}>
                    <TrendingUp size={18} style={{ color: GOLD }} />
                  </div>
                  <div>
                    <div className="text-xs text-[#5A6A8A] mb-0.5" style={{ fontFamily: ff }}>
                      {isBn ? "মৌসুম ১৪৪৬হি পারফরম্যান্স" : "Season 1446H Performance"}
                    </div>
                    <div className="text-sm font-bold" style={{ color: INK, fontFamily: ff }}>
                      {isBn ? "+২৩% গ্রুপ প্রক্রিয়াকৃত" : "+23% groups processed"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Band */}
      <section className="py-20 relative overflow-hidden" style={{ backgroundColor: GOLD }}>
        <div className="absolute inset-0 opacity-10">
          <svg width="100%" height="100%">
            <pattern id="cta-geo" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M30 0L60 15V45L30 60L0 45V15Z" fill="none" stroke={NAVY} strokeWidth="0.8" />
            </pattern>
            <rect width="100%" height="100%" fill="url(#cta-geo)" />
          </svg>
        </div>
        <div className="relative z-10 max-w-4xl mx-auto px-6 lg:px-10 text-center">
          <h2 className="text-4xl font-bold mb-4" style={{ color: INK, fontFamily: ff, lineHeight: lhH }}>
            {isBn ? "তুবা আল হিজাজের সাথে অংশীদারিত্বের জন্য প্রস্তুত?" : "Ready to Partner with TUBA AL HIJAZ?"}
          </h2>
          <p className="text-lg mb-10 opacity-70" style={{ color: INK, fontFamily: ff, lineHeight: lh }}>
            {isBn
              ? "আমাদের একীভূত প্ল্যাটফর্মের মাধ্যমে তাদের উমরাহ অপারেশন পরিচালনাকারী শত শত ট্রাভেল এজেন্সিতে যোগ দিন।"
              : "Join hundreds of travel agencies managing their Umrah operations through our unified platform."
            }
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/auth-onboarding" className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-bold text-base transition-all" style={{ backgroundColor: NAVY, color: "white", fontFamily: ff }}>
              {isBn ? "এজেন্ট হন" : "Become an Agent"}
              <ArrowRight size={16} />
            </Link>
            <Link to="/login" className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-bold text-base border-2 transition-all" style={{ borderColor: `${NAVY}50`, color: INK, fontFamily: ff }}>
              {isBn ? "সরবরাহকারী পোর্টাল" : "Supplier Portal"}
              <ChevronRight size={16} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
