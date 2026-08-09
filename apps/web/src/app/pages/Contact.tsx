import { useState, type FormEvent } from "react";
import { api } from "../lib/api";
import { MapPin, Phone, Mail, Clock, Send, ChevronDown, CheckCircle } from "lucide-react";
import { useLang } from "../lib/LangContext";
import { fontFor, lineHeightFor } from "../lib/i18n";

const NAVY = "#0F1326";
const INK  = "#E2E8F5";
const GOLD = "#C8943A";
const WARM = "#07091A";

function GeometricPattern({ opacity = 0.04 }: { opacity?: number }) {
  return (
    <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg" style={{ opacity }}>
      <defs>
        <pattern id="ct-geo" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
          <path d="M30 0L60 15V45L30 60L0 45V15Z" fill="none" stroke={GOLD} strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#ct-geo)" />
    </svg>
  );
}

const ENQUIRY_TYPES = {
  en: [
    { val: "agent",    label: "Travel Agent" },
    { val: "supplier", label: "Supplier" },
    { val: "pilgrim",  label: "Pilgrim Group" },
    { val: "other",    label: "Other" },
  ],
  bn: [
    { val: "agent",    label: "ট্রাভেল এজেন্ট" },
    { val: "supplier", label: "সরবরাহকারী" },
    { val: "pilgrim",  label: "যাত্রী গ্রুপ" },
    { val: "other",    label: "অন্যান্য" },
  ],
};

const SUBJECTS = {
  en: ["Select a topic…", "Become a Travel Agent Partner", "Supplier Registration", "Visa Processing Services", "Hotel Accommodation", "Transport & Fleet", "Catering Services", "Finance & Billing Enquiry", "ERP Platform Demo Request", "Other Enquiry"],
  bn: ["বিষয় নির্বাচন করুন…", "ট্রাভেল এজেন্ট অংশীদার হন", "সরবরাহকারী নিবন্ধন", "ভিসা প্রক্রিয়াকরণ সেবা", "হোটেল আবাসন", "পরিবহন ও ফ্লিট", "ক্যাটারিং সেবা", "অর্থ ও চালান জিজ্ঞাসা", "ERP প্ল্যাটফর্ম ডেমো অনুরোধ", "অন্যান্য জিজ্ঞাসা"],
};

const CONTACT_DETAILS = {
  en: [
    { icon: MapPin,  label: "Headquarters",     value: "King Abdulaziz Rd, Al Aziziyah\nMakkah Al-Mukarramah 24231, KSA" },
    { icon: Phone,   label: "Operations Line",  value: "+966 12 XXX XXXX\nAvailable 24/7 during Umrah season" },
    { icon: Mail,    label: "Email",             value: "operations@tubalhijaz.com\npartners@tubalhijaz.com" },
    { icon: Clock,   label: "Business Hours",   value: "Sunday – Thursday: 8:00 – 17:00 AST\nRamadan/Hajj: Extended 24/7 ops" },
  ],
  bn: [
    { icon: MapPin,  label: "সদর দফতর",           value: "কিং আব্দুলাজিজ রোড, আল আজিজিয়া\nমক্কা আল-মুকাররামা ২৪২৩১, KSA" },
    { icon: Phone,   label: "অপারেশন লাইন",       value: "+৯৬৬ ১২ XXX XXXX\nউমরাহ মৌসুমে ২৪/৭ উপলব্ধ" },
    { icon: Mail,    label: "ইমেইল",               value: "operations@tubalhijaz.com\npartners@tubalhijaz.com" },
    { icon: Clock,   label: "কার্যালয়ের সময়",    value: "রবিবার – বৃহস্পতিবার: সকাল ৮:০০ – বিকেল ৫:০০\nরমজান/হজ: বর্ধিত ২৪/৭ অপারেশন" },
  ],
};

export default function Contact() {
  const { lang } = useLang();
  const ff = fontFor(lang);
  const lh = lineHeightFor(lang, "body");
  const lhH = lineHeightFor(lang, "heading");
  const isBn = lang === "bn";

  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ name: "", company: "", email: "", subject: "", message: "", type: "agent" });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const t = (form.type || "").toUpperCase();
    const type = ["AGENT", "SUPPLIER", "PILGRIM", "OTHER"].includes(t) ? t : "OTHER";
    try {
      await api.post("/enquiries", {
        type,
        name: form.name,
        company: form.company || undefined,
        email: form.email,
        subject: form.subject,
        message: form.message,
      });
    } catch {
      /* public lead capture is best-effort */
    }
    setSubmitted(true);
  };

  const enquiryTypes = ENQUIRY_TYPES[lang];
  const subjects = SUBJECTS[lang];
  const contactDetails = CONTACT_DETAILS[lang];

  return (
    <div style={{ backgroundColor: WARM }}>
      {/* Hero */}
      <section className="relative pt-28 pb-16 overflow-hidden" style={{ backgroundColor: NAVY }}>
        <GeometricPattern opacity={0.05} />
        <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10 text-center">
          <div className="text-xs font-bold uppercase tracking-[0.2em] mb-5" style={{ color: GOLD, fontFamily: ff }}>
            {isBn ? "যোগাযোগ করুন" : "Get in Touch"}
          </div>
          <h1 className="text-5xl font-bold text-white mb-4" style={{ fontFamily: ff, lineHeight: lhH }}>
            {isBn
              ? <><span style={{ color: GOLD }}>তুবা আল হিজাজের</span> সাথে অংশীদারিত্ব করুন</>
              : <>Partner with <span style={{ color: GOLD }}>TUBA AL HIJAZ</span></>
            }
          </h1>
          <p className="text-lg max-w-xl mx-auto" style={{ color: "rgba(15,19,38,0.78)", fontFamily: ff, lineHeight: lh }}>
            {isBn
              ? "আপনি অপারেশন অংশীদার খুঁজছেন একটি ট্রাভেল এজেন্সি, সেবা নিবন্ধন করছেন একজন সরবরাহকারী, বা জিজ্ঞাসা করছেন একটি যাত্রী গ্রুপ — আমরা সাহায্য করতে এখানে আছি।"
              : "Whether you're a travel agency seeking an operations partner, a supplier registering your services, or a pilgrim group with an enquiry — we're here to help."
            }
          </p>
        </div>
      </section>

      {/* Form + Info */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
            {/* Form */}
            <div className="bg-[#0F1326] rounded-xl border shadow-sm overflow-hidden" style={{ borderColor: `${NAVY}08` }}>
              <div className="px-8 py-6 border-b" style={{ borderColor: `${NAVY}08`, backgroundColor: "#0F1326" }}>
                <div className="text-xs font-bold uppercase tracking-[0.2em] mb-1" style={{ color: GOLD, fontFamily: ff }}>
                  {isBn ? "অনুসন্ধান ফর্ম" : "Enquiry Form"}
                </div>
                <div className="text-xl font-bold" style={{ color: INK, fontFamily: ff, lineHeight: lhH }}>
                  {isBn ? "আমাদের একটি বার্তা পাঠান" : "Send Us a Message"}
                </div>
              </div>

              {submitted ? (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5" style={{ backgroundColor: `${GOLD}15` }}>
                    <CheckCircle size={28} style={{ color: GOLD }} />
                  </div>
                  <h3 className="text-xl font-bold mb-3" style={{ color: INK, fontFamily: ff }}>
                    {isBn ? "বার্তা পাওয়া গেছে" : "Message Received"}
                  </h3>
                  <p className="text-sm" style={{ color: "#A8B8D8", fontFamily: ff, lineHeight: lh }}>
                    {isBn
                      ? "আপনার অনুসন্ধানের জন্য ধন্যবাদ। আমাদের দল একটি কার্যদিবসের মধ্যে সাড়া দেবে।"
                      : "Thank you for your enquiry. Our team will respond within one business day."
                    }
                  </p>
                  <button onClick={() => setSubmitted(false)} className="mt-6 text-xs font-semibold" style={{ color: GOLD, fontFamily: ff }}>
                    {isBn ? "আরেকটি বার্তা পাঠান" : "Send another message"}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="p-8 space-y-5">
                  {/* Enquiry Type */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: INK, fontFamily: ff }}>
                      {isBn ? "আমি একজন" : "I am a"}
                    </label>
                    <div className="flex gap-2 flex-wrap">
                      {enquiryTypes.map((t) => (
                        <button
                          key={t.val}
                          type="button"
                          onClick={() => setForm({ ...form, type: t.val })}
                          className="flex-1 py-2 rounded-lg text-xs font-semibold border-2 transition-all"
                          style={{
                            fontFamily: ff,
                            ...(form.type === t.val
                              ? { backgroundColor: NAVY, borderColor: NAVY, color: "white" }
                              : { borderColor: `${NAVY}15`, color: "#5A6A8A" })
                          }}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold mb-1.5" style={{ color: INK, fontFamily: ff }}>
                        {isBn ? "পূর্ণ নাম *" : "Full Name *"}
                      </label>
                      <input required type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder={isBn ? "আপনার পূর্ণ নাম" : "Your full name"}
                        className="w-full px-3 py-2.5 text-sm rounded-xl border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1"
                        style={{ borderColor: `${NAVY}18`, backgroundColor: "#0F1326", color: INK, fontFamily: ff, outlineColor: GOLD }} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1.5" style={{ color: INK, fontFamily: ff }}>
                        {isBn ? "কোম্পানি / এজেন্সি" : "Company / Agency"}
                      </label>
                      <input type="text" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })}
                        placeholder={isBn ? "আপনার প্রতিষ্ঠান" : "Your organisation"}
                        className="w-full px-3 py-2.5 text-sm rounded-xl border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1"
                        style={{ borderColor: `${NAVY}18`, backgroundColor: "#0F1326", color: INK, fontFamily: ff, outlineColor: GOLD }} />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: INK, fontFamily: ff }}>
                      {isBn ? "ইমেইল ঠিকানা *" : "Email Address *"}
                    </label>
                    <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="you@yourcompany.com"
                      className="w-full px-3 py-2.5 text-sm rounded-xl border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1"
                      style={{ borderColor: `${NAVY}18`, backgroundColor: "#0F1326", color: INK, fontFamily: ff, outlineColor: GOLD }} />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: INK, fontFamily: ff }}>
                      {isBn ? "বিষয় *" : "Subject *"}
                    </label>
                    <div className="relative">
                      <select required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}
                        className="w-full px-3 py-2.5 text-sm rounded-xl border appearance-none transition pr-9 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1"
                        style={{ borderColor: `${NAVY}18`, backgroundColor: "#0F1326", color: form.subject ? NAVY : "#5A6A8A", fontFamily: ff, outlineColor: GOLD }}>
                        {subjects.map((s, i) => (
                          <option key={i} value={i === 0 ? "" : s}>{s}</option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#5A6A8A" }} />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: INK, fontFamily: ff }}>
                      {isBn ? "বার্তা *" : "Message *"}
                    </label>
                    <textarea required rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })}
                      placeholder={isBn ? "আপনার জিজ্ঞাসা বিস্তারিত বর্ণনা করুন…" : "Describe your enquiry in detail…"}
                      className="w-full px-3 py-2.5 text-sm rounded-xl border transition resize-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1"
                      style={{ borderColor: `${NAVY}18`, backgroundColor: "#0F1326", color: INK, fontFamily: ff, outlineColor: GOLD }} />
                  </div>

                  <button
                    type="submit"
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm transition-all hover:opacity-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                    style={{ backgroundColor: NAVY, color: "white", fontFamily: ff, outlineColor: GOLD }}
                  >
                    <Send size={14} aria-hidden />
                    {isBn ? "বার্তা পাঠান" : "Send Message"}
                  </button>

                  <div className="text-center text-xs" style={{ color: "#5A6A8A", fontFamily: ff }}>
                    {isBn ? "আমরা সব জিজ্ঞাসার একটি কার্যদিবসের মধ্যে সাড়া দিই (AST)।" : "We respond to all enquiries within one business day (AST)."}
                  </div>
                </form>
              )}
            </div>

            {/* Office Info */}
            <div className="space-y-8">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.2em] mb-5" style={{ color: GOLD, fontFamily: ff }}>
                  {isBn ? "যোগাযোগের তথ্য" : "Contact Details"}
                </div>
                <div className="space-y-4">
                  {contactDetails.map((item) => (
                    <div key={item.label} className="flex items-start gap-4 p-4 rounded-xl bg-[#0F1326] border" style={{ borderColor: `${NAVY}08` }}>
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${GOLD}15` }}>
                        <item.icon size={16} style={{ color: GOLD }} />
                      </div>
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: INK, fontFamily: ff }}>{item.label}</div>
                        <div className="text-sm whitespace-pre-line" style={{ color: "#A8B8D8", fontFamily: ff, lineHeight: lh }}>{item.value}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Map */}
              <div className="rounded-xl overflow-hidden border" style={{ borderColor: `${NAVY}08` }}>
                <div className="h-64 relative flex items-center justify-center" style={{ backgroundColor: "#1C2444" }}>
                  <div className="absolute inset-0">
                    <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <line key={`h${i}`} x1="0" y1={`${(i + 1) * 12.5}%`} x2="100%" y2={`${(i + 1) * 12.5}%`} stroke="rgba(226,232,245,0.08)" strokeWidth="1" />
                      ))}
                      {Array.from({ length: 10 }).map((_, i) => (
                        <line key={`v${i}`} x1={`${(i + 1) * 10}%`} y1="0" x2={`${(i + 1) * 10}%`} y2="100%" stroke="rgba(226,232,245,0.08)" strokeWidth="1" />
                      ))}
                    </svg>
                  </div>
                  <div className="relative z-10 flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center shadow-lg" style={{ backgroundColor: NAVY }}>
                      <MapPin size={18} style={{ color: GOLD }} />
                    </div>
                    <div className="mt-2 px-3 py-1.5 rounded-lg shadow text-xs font-semibold bg-[#0F1326]" style={{ color: INK, fontFamily: ff }}>
                      TUBA AL HIJAZ HQ
                    </div>
                    <div className="text-[10px] mt-1" style={{ color: "#5A6A8A", fontFamily: ff }}>
                      {isBn ? "মক্কা আল-মুকাররামা" : "Makkah Al-Mukarramah"}
                    </div>
                  </div>
                </div>
                <div className="px-5 py-3 bg-[#0F1326] text-center">
                  <div className="text-xs" style={{ color: "#5A6A8A", fontFamily: ff }}>
                    {isBn ? "চিত্রের জন্য মানচিত্র · সঠিক দিকনির্দেশনার জন্য যোগাযোগ করুন" : "Map for illustration · Contact us for precise directions"}
                  </div>
                </div>
              </div>

              {/* Saudi offices list */}
              <div className="bg-[#0F1326] rounded-xl border p-6" style={{ borderColor: `${NAVY}08` }}>
                <div className="text-xs font-bold uppercase tracking-[0.2em] mb-4" style={{ color: GOLD, fontFamily: ff }}>
                  {isBn ? "সৌদি অফিস" : "Saudi Offices"}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { en: "Makkah",  bn: "মক্কা",  roleEn: "Headquarters", roleBn: "সদর দফতর",       flag: "🕌" },
                    { en: "Jeddah",  bn: "জেদ্দা", roleEn: "Airport Ops",  roleBn: "বিমানবন্দর অপস", flag: "✈️" },
                    { en: "Madinah", bn: "মদিনা",  roleEn: "Northern Hub", roleBn: "উত্তর হাব",       flag: "🌙" },
                    { en: "Riyadh",  bn: "রিয়াদ", roleEn: "Corporate",    roleBn: "কর্পোরেট",        flag: "🏢" },
                  ].map((o) => (
                    <div key={o.en} className="flex items-center gap-2.5 p-3 rounded-xl" style={{ backgroundColor: "#0F1326" }}>
                      <span className="text-xl">{o.flag}</span>
                      <div>
                        <div className="text-xs font-bold" style={{ color: INK, fontFamily: ff }}>{isBn ? o.bn : o.en}</div>
                        <div className="text-[10px]" style={{ color: "#5A6A8A", fontFamily: ff }}>{isBn ? o.roleBn : o.roleEn}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
