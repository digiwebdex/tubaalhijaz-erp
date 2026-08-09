import { Link } from "react-router";
import { MapPin, ArrowRight, CheckCircle } from "lucide-react";
import { useLang } from "../lib/LangContext";
import { fontFor, lineHeightFor } from "../lib/i18n";

const NAVY = "#0B1E3F";
const GOLD = "#C9A24B";
const WARM = "#F4F1EC";

function GeometricPattern({ opacity = 0.04 }: { opacity?: number }) {
  return (
    <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg" style={{ opacity }}>
      <defs>
        <pattern id="about-geo" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
          <path d="M30 0L60 15V45L30 60L0 45V15Z" fill="none" stroke={GOLD} strokeWidth="0.5" />
          <circle cx="30" cy="30" r="4" fill="none" stroke={GOLD} strokeWidth="0.4" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#about-geo)" />
    </svg>
  );
}

const MILESTONES = {
  en: [
    { year: "2006", title: "Founded in Jeddah",    desc: "TUBA AL HIJAZ established by Hajj industry veterans to address the gap in enterprise-grade ground handling for Umrah groups." },
    { year: "2011", title: "Ministry Partnership",  desc: "Became an officially registered Ministry of Hajj and Umrah partner operator, aligning ground-handling processes with official Umrah and Hajj frameworks." },
    { year: "2015", title: "Fleet Expansion",        desc: "Grew our managed transport fleet to 150 vehicles, covering full airport-to-accommodation-to-Haram routing for major travel agency groups." },
    { year: "2019", title: "Digital Platform Launch",desc: "Launched the first version of our integrated ERP platform, consolidating visa, hotel, transport and finance operations into one interface." },
    { year: "2023", title: "NUSUK Integration",      desc: "Completed full NUSUK platform integration, enabling automated pilgrim permit processing and real-time visa status synchronization." },
    { year: "2025", title: "1 Million Pilgrims",      desc: "Reached the milestone of 1 million cumulative pilgrims served across Umrah and Hajj seasons since founding." },
  ],
  bn: [
    { year: "২০০৬", title: "জেদ্দায় প্রতিষ্ঠা",          desc: "হজ শিল্পের অভিজ্ঞ ব্যক্তিদের দ্বারা তুবা আল হিজাজ প্রতিষ্ঠিত হয় উমরাহ গ্রুপের জন্য এন্টারপ্রাইজ-গ্রেড গ্রাউন্ড হ্যান্ডলিংয়ের শূন্যতা পূরণ করতে।" },
    { year: "২০১১", title: "মন্ত্রণালয় অংশীদারিত্ব",      desc: "হজ ও উমরাহ মন্ত্রণালয়ের অফিসিয়াল নিবন্ধিত অংশীদার অপারেটর হিসেবে স্বীকৃতি পায়, সরকারি সিস্টেমের সাথে সরাসরি API সংযোগ সক্ষম করে।" },
    { year: "২০১৫", title: "ফ্লিট সম্প্রসারণ",              desc: "পরিচালিত পরিবহন বহর ১৫০টি যানবাহনে বৃদ্ধি পায়, প্রধান ট্রাভেল এজেন্সি গ্রুপের জন্য বিমানবন্দর থেকে আবাসন থেকে হারাম পর্যন্ত সম্পূর্ণ রুটিং কভার করে।" },
    { year: "২০১৯", title: "ডিজিটাল প্ল্যাটফর্ম উদ্বোধন", desc: "আমাদের একীভূত ERP প্ল্যাটফর্মের প্রথম সংস্করণ চালু করা হয়, ভিসা, হোটেল, পরিবহন ও আর্থিক অপারেশন একটি ইন্টারফেসে একত্রিত করে।" },
    { year: "২০২৩", title: "NUSUK সংযোগ",                   desc: "সম্পূর্ণ NUSUK প্ল্যাটফর্ম সংযোগ সম্পন্ন হয়, স্বয়ংক্রিয় যাত্রী পারমিট প্রক্রিয়াকরণ এবং রিয়েল-টাইম ভিসা স্ট্যাটাস সমন্বয় সক্ষম করে।" },
    { year: "২০২৫", title: "১০ লাখ যাত্রী",                 desc: "প্রতিষ্ঠার পর থেকে উমরাহ ও হজ মৌসুমে মোট ১০ লাখ যাত্রীকে সেবা প্রদানের মাইলফলক অর্জন করে।" },
  ],
};

const LEADERSHIP = [
  { name: "H.E. Khalid Al-Rashidi", role: { en: "Chief Executive Officer",   bn: "প্রধান নির্বাহী কর্মকর্তা" }, tenure: { en: "Founding Member · 2006–Present", bn: "প্রতিষ্ঠাতা সদস্য · ২০০৬–বর্তমান" } },
  { name: "Eng. Faisal Al-Zahrani", role: { en: "Chief Operations Officer",   bn: "প্রধান পরিচালন কর্মকর্তা" }, tenure: { en: "2009–Present",                   bn: "২০০৯–বর্তমান" } },
  { name: "Dr. Amal Al-Qurashi",   role: { en: "Chief Financial Officer",    bn: "প্রধান আর্থিক কর্মকর্তা" },  tenure: { en: "2015–Present",                   bn: "২০১৫–বর্তমান" } },
  { name: "Mr. Tariq Al-Otaibi",   role: { en: "VP, Technology & ERP",       bn: "ভিপি, প্রযুক্তি ও ERP" },    tenure: { en: "2018–Present",                   bn: "২০১৮–বর্তমান" } },
];

const OFFICES = [
  { city: { en: "Makkah Al-Mukarramah", bn: "মক্কা আল-মুকাররামা" }, role: { en: "Headquarters",    bn: "সদর দফতর" },       addr: "King Abdulaziz Rd, Al Aziziyah", icon: "🕌" },
  { city: { en: "Jeddah",               bn: "জেদ্দা" },              role: { en: "Airport Ops",      bn: "বিমানবন্দর অপস" }, addr: "KAIA Terminal, North Zone",     icon: "✈️" },
  { city: { en: "Madinah",              bn: "মদিনা" },               role: { en: "Northern Hub",     bn: "উত্তর হাব" },       addr: "King Fahad Rd, Al Khalidiyah",  icon: "🌙" },
  { city: { en: "Riyadh",               bn: "রিয়াদ" },              role: { en: "Corporate Office",  bn: "কর্পোরেট অফিস" },  addr: "King Fahad District, KAFD",     icon: "🏢" },
];

export default function About() {
  const { lang } = useLang();
  const ff = fontFor(lang);
  const lh = lineHeightFor(lang, "body");
  const lhH = lineHeightFor(lang, "heading");
  const isBn = lang === "bn";
  const milestones = MILESTONES[lang];

  return (
    <div style={{ backgroundColor: WARM }}>
      {/* Hero */}
      <section className="relative pt-28 pb-20 overflow-hidden">
        <div className="absolute inset-0">
          <img src="https://images.unsplash.com/photo-1780657432436-58c4fefcde41?auto=format&fit=crop&w=2000&q=80" alt="Saudi architecture" className="w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: `linear-gradient(to right, rgba(6,15,32,0.96) 0%, rgba(11,30,63,0.82) 60%, rgba(11,30,63,0.5) 100%)` }} />
        </div>
        <GeometricPattern opacity={0.04} />
        <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10">
          <div className="max-w-2xl">
            <div className="text-xs font-bold uppercase tracking-[0.2em] mb-5" style={{ color: GOLD, fontFamily: ff }}>
              {isBn ? "আমাদের গল্প" : "Our Story"}
            </div>
            <h1 className="text-5xl font-bold text-white mb-5" style={{ lineHeight: lhH, fontFamily: ff }}>
              {isBn
                ? <>{`প্রায় দুই দশকের`}<br /><span style={{ color: GOLD }}>পবিত্র সেবা</span></>
                : <>Nearly Two Decades of<br /><span style={{ color: GOLD }}>Sacred Service</span></>
              }
            </h1>
            <p className="text-lg" style={{ color: "rgba(255,255,255,0.78)", fontFamily: ff, lineHeight: lh }}>
              {isBn
                ? "২০০৬ সালে জেদ্দায় প্রতিষ্ঠিত, তুবা আল হিজাজ একটি স্থানীয় পরিবহন সমন্বয়কারী থেকে উমরাহ ও হজ অপারেশনের জন্য সৌদি আরবের সবচেয়ে ব্যাপক এন্টারপ্রাইজ গ্রাউন্ড হ্যান্ডলিং প্ল্যাটফর্মে পরিণত হয়েছে।"
                : "Founded in Jeddah in 2006, TUBA AL HIJAZ has grown from a local transport coordinator into the Kingdom's most comprehensive enterprise ground handling platform for Umrah and Hajj operations."
              }
            </p>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 relative overflow-hidden" style={{ backgroundColor: NAVY }}>
        <GeometricPattern />
        <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { val: "2.4M+", en: "Pilgrims Served",    bn: "হাজি ও উমরাহকারী সেবা" },
              { val: "18+",   en: "Years in Operation",  bn: "বছরের পরিচালনা অভিজ্ঞতা" },
              { val: "47",    en: "Partner Countries",   bn: "অংশীদার দেশ" },
              { val: "300+",  en: "Team Members",        bn: "দলের সদস্য" },
            ].map((s) => (
              <div key={s.en}>
                <div className="text-4xl font-bold mb-1.5" style={{ color: GOLD }}>{s.val}</div>
                <div className="text-sm font-semibold text-white" style={{ fontFamily: ff, lineHeight: lh }}>
                  {isBn ? s.bn : s.en}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission / Vision */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.2em] mb-5" style={{ color: GOLD, fontFamily: ff }}>
                {isBn ? "আমাদের লক্ষ্য" : "Our Mission"}
              </div>
              <h2 className="text-3xl font-bold mb-5" style={{ color: NAVY, fontFamily: ff, lineHeight: lhH }}>
                {isBn ? "তীর্থযাত্রীর প্রতিটি অভিজ্ঞতাকে উন্নীত করা" : "Elevating Every Aspect of the Pilgrim's Journey"}
              </h2>
              <p className="text-base mb-6" style={{ color: "#6B7280", fontFamily: ff, lineHeight: lh }}>
                {isBn
                  ? "আমরা নিশ্চিত করতে বিদ্যমান যে সৌদি আরবে আগত প্রতিটি যাত্রী প্রথম ডকুমেন্ট জমা থেকে শেষ যাত্রা পর্যন্ত নিরবচ্ছিন্ন, মর্যাদাপূর্ণ লজিস্টিক্যাল সহায়তা পায়। আমাদের লক্ষ্য হলো উমরাহর অপারেশনাল স্তরকে অদৃশ্য করে তোলা, যাতে যাত্রীরা সম্পূর্ণভাবে তাদের আধ্যাত্মিক উদ্দেশ্যে মনোযোগ দিতে পারেন।"
                  : "We exist to ensure that every pilgrim arriving in the Kingdom receives seamless, dignified logistical support — from their first document submission to their final journey home. Our mission is to make the operational layer of Umrah invisible, so pilgrims can focus entirely on their spiritual purpose."
                }
              </p>
              <div className="space-y-3">
                {(isBn
                  ? ["মন্ত্রণালয়-সম্মত ডকুমেন্টেশন ও ভিসা প্রক্রিয়াকরণ", "প্রিমিয়াম পরিবহন ও আবাসন সমন্বয়", "স্বচ্ছ, অডিট-প্রস্তুত আর্থিক ব্যবস্থাপনা", "দ্বিভাষিক বাংলা/ইংরেজি পরিচালনা সহায়তা"]
                  : ["Ministry-compliant documentation and visa processing", "Premium transport and accommodation coordination", "Transparent, audit-ready financial management", "Bilingual Bengali/English operational support"]
                ).map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <CheckCircle size={16} className="shrink-0 mt-0.5" style={{ color: GOLD }} />
                    <span className="text-sm" style={{ color: "#374151", fontFamily: ff, lineHeight: lh }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.2em] mb-5" style={{ color: GOLD, fontFamily: ff }}>
                {isBn ? "আমাদের দৃষ্টিভঙ্গি" : "Our Vision"}
              </div>
              <h2 className="text-3xl font-bold mb-5" style={{ color: NAVY, fontFamily: ff, lineHeight: lhH }}>
                {isBn ? "সৌদি ভিশন ২০৩০ — ধর্মীয় পর্যটন নেতৃত্ব" : "Saudi Vision 2030 — Religious Tourism Leadership"}
              </h2>
              <p className="text-base mb-6" style={{ color: "#6B7280", fontFamily: ff, lineHeight: lh }}>
                {isBn
                  ? "বার্ষিক ৩ কোটি উমরাহ যাত্রী আয়োজনের সৌদি আরবের ভিশন ২০৩০ লক্ষ্যমাত্রার সাথে সামঞ্জস্য রেখে, তুবা আল হিজাজ সেই উচ্চাভিলাষ সমর্থন করতে ডিজিটাল ও পরিচালনামূলক অবকাঠামো নির্মাণ করছে।"
                  : "Aligned with Saudi Arabia's Vision 2030 goal of hosting 30 million Umrah pilgrims annually, TUBA AL HIJAZ is building the digital and operational infrastructure to support that ambition — while maintaining the hospitality standards that the Holy Cities demand."
                }
              </p>
              <div className="p-6 rounded-xl border-l-4" style={{ backgroundColor: "#F8F5F0", borderLeftColor: GOLD }}>
                <div className="text-sm italic" style={{ color: "#374151", fontFamily: ff, lineHeight: lh }}>
                  {isBn
                    ? '"আমাদের প্ল্যাটফর্ম শুধু একটি ERP নয় — এটি ২০৩০ সালের মধ্যে ৩ কোটি যাত্রীকে সেবা দেওয়ার সৌদি উচ্চাভিলাষের জন্য পরিচালনামূলক ভিত্তি।"'
                    : '"Our platform is not just an ERP — it is the operational foundation for the Kingdom\'s ambition to serve 30 million pilgrims by 2030."'
                  }
                </div>
                <div className="text-xs font-bold mt-3" style={{ color: NAVY, fontFamily: ff }}>— H.E. Khalid Al-Rashidi, {isBn ? "CEO" : "CEO"}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-20" style={{ backgroundColor: "#F0EDE8" }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="text-center mb-14">
            <div className="text-xs font-bold uppercase tracking-[0.2em] mb-4" style={{ color: GOLD, fontFamily: ff }}>
              {isBn ? "কোম্পানির ইতিহাস" : "Company History"}
            </div>
            <h2 className="text-4xl font-bold" style={{ color: NAVY, fontFamily: ff, lineHeight: lhH }}>
              {isBn ? "২০০৬ সাল থেকে আমাদের যাত্রা" : "Our Journey Since 2006"}
            </h2>
          </div>
          <div className="relative">
            <div className="absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 hidden md:block" style={{ backgroundColor: `${GOLD}30` }} />
            <div className="space-y-8 md:space-y-0">
              {milestones.map((m, i) => (
                <div key={m.year} className={`flex gap-8 items-start md:w-1/2 ${i % 2 === 0 ? "md:ml-auto md:pl-8" : "md:mr-auto md:pr-8 md:flex-row-reverse md:text-right"}`}>
                  <div className="shrink-0 w-14 h-14 rounded-full flex items-center justify-center font-black text-sm border-2" style={{ backgroundColor: NAVY, borderColor: GOLD, color: GOLD, fontFamily: "var(--font-mono)" }}>
                    {m.year.slice(-2)}
                  </div>
                  <div className="bg-white rounded-xl p-5 shadow-sm border flex-1" style={{ borderColor: `${NAVY}08` }}>
                    <div className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: GOLD, fontFamily: "var(--font-mono)" }}>{m.year}</div>
                    <div className="text-base font-bold mb-2" style={{ color: NAVY, fontFamily: ff }}>{m.title}</div>
                    <div className="text-sm" style={{ color: "#6B7280", fontFamily: ff, lineHeight: lh }}>{m.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Leadership */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="text-center mb-14">
            <div className="text-xs font-bold uppercase tracking-[0.2em] mb-4" style={{ color: GOLD, fontFamily: ff }}>
              {isBn ? "নির্বাহী নেতৃত্ব" : "Executive Leadership"}
            </div>
            <h2 className="text-4xl font-bold" style={{ color: NAVY, fontFamily: ff, lineHeight: lhH }}>
              {isBn ? "প্ল্যাটফর্মের পেছনের দল" : "The Team Behind the Platform"}
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {LEADERSHIP.map((person) => (
              <div key={person.name} className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: `${NAVY}08` }}>
                <div className="h-40 flex items-center justify-center relative overflow-hidden" style={{ backgroundColor: `${NAVY}05` }}>
                  <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold border-2" style={{ backgroundColor: `${GOLD}15`, borderColor: `${GOLD}30`, color: NAVY }}>
                    {person.name.split(" ").filter((w) => /^[A-Z]/.test(w)).slice(1, 3).map((w) => w[0]).join("")}
                  </div>
                </div>
                <div className="p-5">
                  <div className="text-sm font-bold mb-0.5" style={{ color: NAVY }}>{person.name}</div>
                  <div className="text-xs font-semibold mb-1" style={{ color: GOLD, fontFamily: ff }}>{person.role[lang]}</div>
                  <div className="text-xs" style={{ color: "#9CA3AF", fontFamily: ff }}>{person.tenure[lang]}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Saudi Offices */}
      <section className="py-20 relative overflow-hidden" style={{ backgroundColor: NAVY }}>
        <GeometricPattern />
        <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10">
          <div className="text-center mb-14">
            <div className="text-xs font-bold uppercase tracking-[0.2em] mb-4" style={{ color: GOLD, fontFamily: ff }}>
              {isBn ? "সৌদি উপস্থিতি" : "Saudi Presence"}
            </div>
            <h2 className="text-4xl font-bold text-white" style={{ fontFamily: ff, lineHeight: lhH }}>
              {isBn ? "সৌদি আরব জুড়ে অপারেশন" : "Operations Across the Kingdom"}
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {OFFICES.map((office) => (
              <div key={office.city.en} className="rounded-xl border p-6" style={{ backgroundColor: "#FBFCFD", borderColor: `${GOLD}20` }}>
                <div className="text-3xl mb-4">{office.icon}</div>
                <div className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: GOLD, fontFamily: ff }}>{office.role[lang]}</div>
                <div className="text-base font-bold text-[#0B1E3F] mb-2" style={{ fontFamily: ff }}>{office.city[lang]}</div>
                <div className="flex items-start gap-2">
                  <MapPin size={12} className="mt-0.5 shrink-0" style={{ color: GOLD }} />
                  <span className="text-xs" style={{ color: "rgba(11,30,63,0.58)" }}>{office.addr}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20" style={{ backgroundColor: WARM }}>
        <div className="max-w-3xl mx-auto px-6 lg:px-10 text-center">
          <h2 className="text-4xl font-bold mb-4" style={{ color: NAVY, fontFamily: ff, lineHeight: lhH }}>
            {isBn ? "আমাদের অংশীদার নেটওয়ার্কে যোগ দিন" : "Join Our Partner Network"}
          </h2>
          <p className="text-lg mb-8" style={{ color: "#6B7280", fontFamily: ff, lineHeight: lh }}>
            {isBn
              ? "৪৭টি দেশের শত শত ট্রাভেল এজেন্সি তাদের উমরাহ গ্রুপ অপারেশনের জন্য তুবা আল হিজাজের উপর আস্থা রাখে।"
              : "Hundreds of travel agencies across 47 countries trust TUBA AL HIJAZ for their Umrah group operations."
            }
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/contact" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-base" style={{ backgroundColor: NAVY, color: "white", fontFamily: ff }}>
              {isBn ? "এজেন্ট হন" : "Become an Agent"} <ArrowRight size={16} />
            </Link>
            <Link to="/services" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-base border-2" style={{ borderColor: NAVY, color: NAVY, fontFamily: ff }}>
              {isBn ? "আমাদের সেবা" : "Our Services"}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
