import { Link } from "react-router";
import {
  FileCheck, Building, Bus, UtensilsCrossed, Wallet, Truck,
  ArrowRight, Check, Zap, ChevronRight
} from "lucide-react";
import { useLang } from "../lib/LangContext";
import { fontFor, lineHeightFor } from "../lib/i18n";

const NAVY = "#0B1E3F";
const GOLD = "#C9A24B";
const WARM = "#F4F1EC";

const SERVICES = [
  {
    id: "visa", icon: FileCheck, color: "#0D9488", bg: "#F0FDFA",
    image: "https://images.unsplash.com/photo-1768831822158-e34bd8fc87a9?auto=format&fit=crop&w=800&q=80",
    stat: { value: "94.8%" },
    en: {
      name: "Visa Processing", headline: "Fastest Visa Turnaround in the Kingdom", statLabel: "Approval Rate",
      desc: "Our Visa Desk manages mutamer applications end-to-end — OCR passport and Nusuk group-list intake, staff-updated pipeline status, Umrah Co coordination and agent notifications. Status advances are attributable desk updates; there is no live NUSUK or MOFA government API in this platform.",
      features: ["Staff-updated mutamer visa pipeline (no live gov API)","Automated OCR passport data extraction","Bulk group visa application processing","Real-time desk status tracking per pilgrim","Multi-nationality document validation","Rejection analysis and resubmission workflow"],
      cta: "Enquire About Visa Processing",
    },
    bn: {
      name: "ভিসা প্রক্রিয়াকরণ", headline: "সৌদি আরবে সবচেয়ে দ্রুত ভিসা প্রক্রিয়া", statLabel: "অনুমোদনের হার",
      desc: "আমাদের ভিসা ডেস্ক মুতামির আবেদন শুরু থেকে শেষ পর্যন্ত পরিচালনা করে — OCR পাসপোর্ট ও Nusuk গ্রুপ-তালিকা ইনটেক, স্টাফ-আপডেটেড পাইপলাইন স্ট্যাটাস, উমরাহ কোম্পানি সমন্বয় এবং এজেন্ট নোটিফিকেশন। স্ট্যাটাস অগ্রগতি ডেস্ক আপডেট; এই প্ল্যাটফর্মে কোনো লাইভ NUSUK বা MOFA সরকারি API নেই।",
      features: ["স্টাফ-আপডেটেড মুতামির ভিসা পাইপলাইন (কোনো লাইভ সরকারি API নেই)","স্বয়ংক্রিয় OCR পাসপোর্ট তথ্য নিষ্কাশন","গ্রুপ ভিসা আবেদন একসাথে প্রক্রিয়াকরণ","প্রতি যাত্রীর ডেস্ক স্ট্যাটাস ট্র্যাকিং","বহু-জাতীয়তা ডকুমেন্ট যাচাইকরণ","প্রত্যাখ্যান বিশ্লেষণ ও পুনরায় দাখিল প্রক্রিয়া"],
      cta: "ভিসা সেবা সম্পর্কে জানুন",
    },
  },
  {
    id: "hotel", icon: Building, color: "#2563EB", bg: "#EFF6FF",
    image: "https://images.unsplash.com/photo-1677129667171-92abd8740fa3?auto=format&fit=crop&w=800&q=80",
    stat: { value: "200+" },
    en: {
      name: "Hotel Accommodation", headline: "Curated Stays, Steps from the Haram", statLabel: "Hotel Partners",
      desc: "We coordinate accommodation for pilgrim groups across 200+ partner hotels in Makkah and Madinah. From budget lodges to premium properties, every booking is managed through our unified reservation platform with room-level tracking.",
      features: ["200+ partner hotels in Makkah and Madinah","Room-level pilgrim assignment and tracking","Group block reservations management","Check-in/check-out logistics coordination","Star-rating and distance-from-Haram filtering","Real-time occupancy dashboard"],
      cta: "Enquire About Hotel Accommodation",
    },
    bn: {
      name: "হোটেল আবাসন", headline: "হারামের পাশে যত্নশীল আবাসন ব্যবস্থা", statLabel: "হোটেল অংশীদার",
      desc: "আমরা মক্কা ও মদিনায় ২০০+ অংশীদার হোটেলে যাত্রী গ্রুপের আবাসন সমন্বয় করি। বাজেট লজ থেকে প্রিমিয়াম প্রপার্টি পর্যন্ত, প্রতিটি বুকিং রুম-স্তরের ট্র্যাকিং সহ আমাদের একীভূত রিজার্ভেশন প্ল্যাটফর্মের মাধ্যমে পরিচালিত হয়।",
      features: ["মক্কা ও মদিনায় ২০০+ অংশীদার হোটেল","রুম-স্তরে যাত্রী বরাদ্দ ও ট্র্যাকিং","গ্রুপ ব্লক রিজার্ভেশন ব্যবস্থাপনা","চেক-ইন/চেক-আউট লজিস্টিক্স সমন্বয়","স্টার রেটিং ও হারাম দূরত্ব ফিল্টারিং","রিয়েল-টাইম আসন সংখ্যা ড্যাশবোর্ড"],
      cta: "হোটেল সেবা সম্পর্কে জানুন",
    },
  },
  {
    id: "transport", icon: Bus, color: "#EA580C", bg: "#FFF7ED",
    image: "https://images.unsplash.com/photo-1508053803120-e3e60f3f9674?auto=format&fit=crop&w=800&q=80",
    stat: { value: "300+" },
    en: {
      name: "Ground Transport", headline: "Airport to Masha'er, Every Transfer Covered", statLabel: "Fleet Vehicles",
      desc: "TUBA AL HIJAZ operates and coordinates a fleet of 300+ vehicles for pilgrim movement between King Abdulaziz International Airport, accommodations, and all Hajj and Umrah sites. GPS tracking on every journey.",
      features: ["300+ vehicle managed fleet","GPS real-time vehicle tracking","Airport meet & greet with name boards","Mina/Arafat/Muzdalifah seasonal routing","Air-conditioned coaches and vans","24-hour dispatch operations center"],
      cta: "Enquire About Transport",
    },
    bn: {
      name: "স্থলপথ পরিবহন", headline: "বিমানবন্দর থেকে মাশায়ের — প্রতিটি যাত্রা নিশ্চিত", statLabel: "ফ্লিট যানবাহন",
      desc: "তুবা আল হিজাজ কিং আব্দুলাজিজ আন্তর্জাতিক বিমানবন্দর, আবাসন এবং হজ ও উমরাহ সকল স্থানের মধ্যে যাত্রী চলাচলের জন্য ৩০০+ যানবাহনের বহর পরিচালনা ও সমন্বয় করে। প্রতিটি যাত্রায় GPS ট্র্যাকিং।",
      features: ["৩০০+ যানবাহনের পরিচালিত বহর","GPS রিয়েল-টাইম যানবাহন ট্র্যাকিং","নামের বোর্ড সহ বিমানবন্দর অভ্যর্থনা","মিনা/আরাফাত/মুযদালিফা মৌসুমী রুটিং","এয়ার-কন্ডিশন্ড কোচ ও ভ্যান","২৪ ঘণ্টা প্রেরণ অপারেশন কেন্দ্র"],
      cta: "পরিবহন সেবা সম্পর্কে জানুন",
    },
  },
  {
    id: "catering", icon: UtensilsCrossed, color: "#9333EA", bg: "#FAF5FF",
    image: "https://images.unsplash.com/photo-1576842546422-60562b9242ae?auto=format&fit=crop&w=800&q=80",
    stat: { value: "100%" },
    en: {
      name: "Catering & Meals", headline: "Halal-Certified Meals for Every Pilgrim", statLabel: "Halal Certified",
      desc: "From simple meal packages to full banquet-style group catering, our certified suppliers provide consistent, halal-assured food services with dietary accommodation tracking for each pilgrim group.",
      features: ["100% halal-certified supply chain","Per-pilgrim dietary requirement tracking","Breakfast, lunch and dinner packages","In-room and group hall delivery options","Seasonal menus for Ramadan and Hajj","Supplier quality audit and rating system"],
      cta: "Enquire About Catering",
    },
    bn: {
      name: "খাদ্য ও পানীয়", headline: "প্রতিটি যাত্রীর জন্য হালাল-প্রত্যয়িত খাবার", statLabel: "হালাল সার্টিফাইড",
      desc: "সাধারণ মিল প্যাকেজ থেকে পূর্ণ ব্যাংকুয়েট-স্টাইল গ্রুপ ক্যাটারিং পর্যন্ত, আমাদের সার্টিফাইড সরবরাহকারীরা প্রতিটি যাত্রী গ্রুপের জন্য খাদ্যতালিকা ট্র্যাকিং সহ সামঞ্জস্যপূর্ণ হালাল-নিশ্চিত খাদ্য সেবা প্রদান করে।",
      features: ["১০০% হালাল-প্রত্যয়িত সরবরাহ শৃঙ্খল","প্রতি যাত্রীর খাদ্যতালিকার প্রয়োজনীয়তা ট্র্যাকিং","সকালের নাস্তা, দুপুর ও রাতের খাবার প্যাকেজ","রুমে ও গ্রুপ হলে ডেলিভারি বিকল্প","রমজান ও হজের জন্য মৌসুমী মেনু","সরবরাহকারী মান নিরীক্ষা ও রেটিং সিস্টেম"],
      cta: "ক্যাটারিং সেবা সম্পর্কে জানুন",
    },
  },
  {
    id: "finance", icon: Wallet, color: "#16A34A", bg: "#F0FDF4",
    image: "https://images.unsplash.com/photo-1783261289464-3aca4b7ee008?auto=format&fit=crop&w=800&q=80",
    stat: { value: "SAR 1B+" },
    en: {
      name: "Finance & Billing", headline: "Transparent Financial Control Across Every Group", statLabel: "Processed Annually",
      desc: "Our finance module consolidates all service costs into a unified billing dashboard — with per-group cost breakdowns, supplier payment management, and multi-currency support for international agency partners.",
      features: ["Multi-currency billing (SAR, USD, EUR, GBP)","Per-pilgrim and per-group cost breakdown","Supplier invoice management and matching","Payment milestone and installment tracking","Automated financial reconciliation","Audit-ready export for Saudi ZATCA compliance"],
      cta: "Enquire About Finance Module",
    },
    bn: {
      name: "অর্থ ও চালান", headline: "প্রতিটি গ্রুপে স্বচ্ছ আর্থিক নিয়ন্ত্রণ", statLabel: "বার্ষিক প্রক্রিয়াকৃত",
      desc: "আমাদের আর্থিক মডিউল সকল সেবা খরচকে একটি একীভূত বিলিং ড্যাশবোর্ডে একত্রিত করে — গ্রুপ-ভিত্তিক খরচ বিভাজন, সরবরাহকারী পেমেন্ট ব্যবস্থাপনা এবং আন্তর্জাতিক এজেন্সি অংশীদারদের জন্য বহু-মুদ্রা সমর্থন সহ।",
      features: ["বহু-মুদ্রা বিলিং (SAR, USD, EUR, GBP)","প্রতি যাত্রী ও গ্রুপ খরচ বিভাজন","সরবরাহকারী চালান ব্যবস্থাপনা ও মেলানো","পেমেন্ট মাইলস্টোন ও কিস্তি ট্র্যাকিং","স্বয়ংক্রিয় আর্থিক রিকনসিলিয়েশন","সৌদি ZATCA সম্মতির জন্য অডিট-প্রস্তুত রপ্তানি"],
      cta: "আর্থিক মডিউল সম্পর্কে জানুন",
    },
  },
  {
    id: "fleet", icon: Truck, color: "#475569", bg: "#F8FAFC",
    image: "https://images.unsplash.com/photo-1768961869826-cb62a2dd93b1?auto=format&fit=crop&w=800&q=80",
    stat: { value: "99.2%" },
    en: {
      name: "Fleet Management", headline: "Every Vehicle Accounted For, Every Journey", statLabel: "Fleet Uptime",
      desc: "Full lifecycle fleet management — from vehicle onboarding and driver assignment to preventive maintenance scheduling and seasonal deployment planning. Fully integrated with the transport dispatch module.",
      features: ["Full vehicle lifecycle tracking","Driver certification and license management","Preventive maintenance scheduling","Fuel consumption and cost reporting","Seasonal fleet scaling and decommissioning","Ministry of Transport compliance reporting"],
      cta: "Enquire About Fleet Management",
    },
    bn: {
      name: "ফ্লিট ব্যবস্থাপনা", headline: "প্রতিটি যানবাহন, প্রতিটি যাত্রায় হিসাবভুক্ত", statLabel: "ফ্লিট আপটাইম",
      desc: "সম্পূর্ণ জীবনচক্র ফ্লিট ব্যবস্থাপনা — যানবাহন অন্তর্ভুক্তি ও চালক বরাদ্দ থেকে প্রতিরোধমূলক রক্ষণাবেক্ষণ সময়সূচি এবং মৌসুমী মোতায়েন পরিকল্পনা পর্যন্ত। পরিবহন প্রেরণ মডিউলের সাথে সম্পূর্ণ একীভূত।",
      features: ["সম্পূর্ণ যানবাহন জীবনচক্র ট্র্যাকিং","চালক সার্টিফিকেশন ও লাইসেন্স ব্যবস্থাপনা","প্রতিরোধমূলক রক্ষণাবেক্ষণ সময়সূচি","জ্বালানি ব্যবহার ও খরচ প্রতিবেদন","মৌসুমী ফ্লিট স্কেলিং ও ডিকমিশনিং","পরিবহন মন্ত্রণালয় সম্মতি প্রতিবেদন"],
      cta: "ফ্লিট ব্যবস্থাপনা সম্পর্কে জানুন",
    },
  },
];

function GeometricPattern({ opacity = 0.04 }: { opacity?: number }) {
  return (
    <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg" style={{ opacity }}>
      <defs>
        <pattern id="svc-geo" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
          <path d="M30 0L60 15V45L30 60L0 45V15Z" fill="none" stroke={GOLD} strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#svc-geo)" />
    </svg>
  );
}

export default function Services() {
  const { lang } = useLang();
  const ff = fontFor(lang);
  const lh = lineHeightFor(lang, "body");
  const lhH = lineHeightFor(lang, "heading");
  const isBn = lang === "bn";

  return (
    <div style={{ backgroundColor: WARM }}>
      {/* Hero */}
      <section className="relative pt-28 pb-20 overflow-hidden" style={{ backgroundColor: NAVY }}>
        <GeometricPattern opacity={0.05} />
        <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6 border text-xs font-bold uppercase tracking-[0.2em]" style={{ borderColor: `${GOLD}40`, backgroundColor: `${GOLD}10`, color: GOLD, fontFamily: ff }}>
            <Zap size={11} />
            {isBn ? "ছয়টি সমন্বিত সেবা বিভাগ" : "Six Integrated Service Lines"}
          </div>
          <h1 className="text-5xl font-bold text-white mb-4" style={{ lineHeight: lhH, fontFamily: ff }}>
            {isBn ? <>শুরু থেকে শেষ <span style={{ color: GOLD }}>উমরাহ সেবা</span></> : <>End-to-End <span style={{ color: GOLD }}>Umrah Services</span></>}
          </h1>
          <p className="text-lg max-w-2xl mx-auto" style={{ color: "rgba(255,255,255,0.78)", fontFamily: ff, lineHeight: lh }}>
            {isBn
              ? "একজন যাত্রী ভিসা পাওয়ার মুহূর্ত থেকে নিরাপদে বাড়ি ফেরা পর্যন্ত — তুবা আল হিজাজ প্রতিটি অপারেশনাল স্তর যত্নের সাথে পরিচালনা করে।"
              : "From the moment a pilgrim receives their visa to their safe return home — TUBA AL HIJAZ handles every operational layer with precision and care."
            }
          </p>
        </div>
      </section>

      {/* Icon index — Bangla-first, consistent spacing */}
      <section className="pt-12 pb-4" aria-label={isBn ? "সেবা সূচি" : "Services index"}>
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {SERVICES.map((svc) => {
              const s = svc[lang];
              return (
                <a
                  key={svc.id}
                  href={`#${svc.id}`}
                  className="rounded-xl p-3 text-center transition-all hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{ backgroundColor: "#FFFFFF", border: `1px solid ${NAVY}10`, outlineColor: GOLD }}
                >
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-2" style={{ backgroundColor: svc.bg }} aria-hidden>
                    <svc.icon size={18} style={{ color: svc.color }} />
                  </div>
                  <div className="text-[11px] font-bold leading-snug" style={{ color: NAVY, fontFamily: ff }}>{s.name}</div>
                </a>
              );
            })}
          </div>
        </div>
      </section>

      {/* Service detail blocks */}
      <section className="py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 space-y-16 md:space-y-20">
          {SERVICES.map((svc, i) => {
            const s = svc[lang];
            return (
              <div id={svc.id} key={svc.id} className={`scroll-mt-24 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-12 items-center ${i % 2 === 1 ? "lg:grid-flow-dense" : ""}`}>
                {/* Image */}
                <div className={`relative ${i % 2 === 1 ? "lg:col-start-2" : ""}`}>
                  <div className="rounded-xl overflow-hidden aspect-[4/3] shadow-xl">
                    <img src={svc.image} alt={s.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0" style={{ background: `linear-gradient(to top, rgba(11,30,63,0.55) 0%, transparent 50%)` }} />
                  </div>
                  <div className="absolute -top-4 -right-4 w-16 h-16 rounded-xl flex items-center justify-center shadow-lg border-2 border-white" style={{ backgroundColor: svc.bg }}>
                    <svc.icon size={26} style={{ color: svc.color }} />
                  </div>
                  <div className="absolute bottom-5 left-5 bg-white rounded-xl px-4 py-3 shadow-lg">
                    <div className="text-2xl font-bold" style={{ color: svc.color }}>{svc.stat.value}</div>
                    <div className="text-xs font-medium text-gray-500" style={{ fontFamily: ff }}>{s.statLabel}</div>
                  </div>
                </div>

                {/* Content */}
                <div className={i % 2 === 1 ? "lg:col-start-1 lg:row-start-1" : ""}>
                  <div className="text-xs font-bold uppercase tracking-[0.2em] mb-4" style={{ color: svc.color, fontFamily: ff }}>
                    {s.name}
                  </div>
                  <h2 className="text-3xl font-bold mb-4" style={{ color: NAVY, fontFamily: ff, lineHeight: lhH }}>
                    {s.headline}
                  </h2>
                  <p className="text-base mb-8" style={{ color: "#6B7280", fontFamily: ff, lineHeight: lh }}>
                    {s.desc}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-8">
                    {s.features.map((f) => (
                      <div key={f} className="flex items-start gap-2.5">
                        <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: `${svc.color}15` }}>
                          <Check size={10} style={{ color: svc.color }} />
                        </div>
                        <span className="text-sm" style={{ color: "#374151", fontFamily: ff, lineHeight: lh }}>{f}</span>
                      </div>
                    ))}
                  </div>
                  <Link to="/contact" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all" style={{ backgroundColor: svc.color, color: "white", fontFamily: ff }}>
                    {s.cta}
                    <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 relative overflow-hidden" style={{ backgroundColor: NAVY }}>
        <GeometricPattern />
        <div className="relative z-10 max-w-3xl mx-auto px-6 lg:px-10 text-center">
          <h2 className="text-4xl font-bold text-white mb-4" style={{ fontFamily: ff, lineHeight: lhH }}>
            {isBn ? "ছয়টি সেবা, একটি প্ল্যাটফর্ম" : "All Six Services, One Platform"}
          </h2>
          <p className="text-lg mb-10" style={{ color: "rgba(255,255,255,0.78)", fontFamily: ff, lineHeight: lh }}>
            {isBn
              ? "আমাদের ERP প্ল্যাটফর্ম প্রতিটি সেবা বিভাগকে একটি অপারেশন ড্যাশবোর্ডের অধীনে একত্রিত করে — আপনার দলকে সম্পূর্ণ দৃশ্যমানতা ও নিয়ন্ত্রণ দেয়।"
              : "Our ERP platform unifies every service line under a single operations dashboard — giving your team complete visibility and control."
            }
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/contact" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-base" style={{ backgroundColor: GOLD, color: NAVY, fontFamily: ff }}>
              {isBn ? "ডেমো অনুরোধ করুন" : "Request a Demo"} <ArrowRight size={16} />
            </Link>
            <Link to="/login" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-base border-2" style={{ borderColor: "rgba(255,255,255,0.30)", color: "white", fontFamily: ff }}>
              {isBn ? "এজেন্ট লগইন" : "Agent Login"} <ChevronRight size={16} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
