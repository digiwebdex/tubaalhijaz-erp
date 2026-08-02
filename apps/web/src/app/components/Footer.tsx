import { Link } from "react-router";
import { MapPin, Phone, Mail, ExternalLink } from "lucide-react";
import { useLang } from "../lib/LangContext";
import { fontFor, lineHeightFor } from "../lib/i18n";
import { ImageWithFallback } from "@/app/components/figma/ImageWithFallback";
// Light-ink variant for dark surfaces (see Nav.tsx for why the old JPEG plus a
// brightness/invert filter rendered as a solid white box).
import logoImg from "@/assets/logo-light.png";

const NAVY = "#0B1E3F";
const GOLD = "#C9A24B";

const SERVICES = {
  en: ["Visa Processing", "Hotel Accommodation", "Ground Transport", "Catering & Meals", "Finance & Billing", "Fleet Management", "Operations Dispatch", "Document Services"],
  bn: ["ভিসা প্রক্রিয়াকরণ", "হোটেল আবাসন", "স্থল পরিবহন", "ক্যাটারিং ও খাবার", "অর্থ ও চালান", "ফ্লিট ম্যানেজমেন্ট", "অপারেশন ডিসপ্যাচ", "ডকুমেন্ট সেবা"],
};

const CONTACT = {
  en: [
    { icon: MapPin, text: "King Abdulaziz Rd, Al Aziziyah\nMakkah Al-Mukarramah, KSA" },
    { icon: Phone, text: "+966 12 XXX XXXX" },
    { icon: Mail, text: "operations@tubalhijaz.com" },
  ],
  bn: [
    { icon: MapPin, text: "কিং আব্দুলাজিজ রোড, আল আজিজিয়া\nমক্কা আল-মুকাররামা, KSA" },
    { icon: Phone, text: "+৯৬৬ ১২ XXX XXXX" },
    { icon: Mail, text: "operations@tubalhijaz.com" },
  ],
};

export default function Footer() {
  const { lang } = useLang();
  const ff = fontFor(lang);
  const lh = lineHeightFor(lang, "body");
  const isBn = lang === "bn";

  return (
    <footer style={{ backgroundColor: "#F5F7FA" }}>
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
          {/* Company */}
          <div>
            <div className="flex items-center gap-3 mb-5">
              <ImageWithFallback
                src={logoImg}
                alt="TUBA ALHIJAZ"
                className="h-10 w-auto object-contain"
              />
            </div>
            <div className="text-sm mb-6" style={{ color: "rgba(11,30,63,0.66)", fontFamily: ff, lineHeight: lh }}>
              {isBn
                ? "সৌদি আরবে উমরাহ ও হজ অপারেশনের জন্য বিশ্বস্ত গ্রাউন্ড হ্যান্ডলিং অংশীদার।"
                : "Trusted ground handling partner for Umrah and Hajj operations across the Kingdom of Saudi Arabia."
              }
            </div>
            <div className="flex items-center gap-3">
              {["NUSUK", "MOFA", "MHU"].map((badge) => (
                <div
                  key={badge}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-widest border"
                  style={{ borderColor: "rgba(201,162,75,0.2)", color: "rgba(201,162,75,0.5)" }}
                >
                  {badge}
                </div>
              ))}
            </div>
          </div>

          {/* Services */}
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.2em] mb-5" style={{ color: GOLD, fontFamily: ff }}>
              {isBn ? "সেবাসমূহ" : "Services"}
            </div>
            <div className="space-y-2.5">
              {SERVICES[lang].map((s) => (
                <div key={s} className="text-sm cursor-pointer transition-colors" style={{ color: "rgba(11,30,63,0.66)", fontFamily: ff }}>
                  {s}
                </div>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.2em] mb-5" style={{ color: GOLD, fontFamily: ff }}>
              {isBn ? "যোগাযোগ" : "Contact"}
            </div>
            <div className="space-y-4">
              {CONTACT[lang].map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <item.icon size={14} className="mt-0.5 shrink-0" style={{ color: GOLD }} />
                  <span className="text-sm whitespace-pre-line" style={{ color: "rgba(11,30,63,0.66)", fontFamily: ff, lineHeight: lh }}>
                    {item.text}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-6 pt-6 border-t" style={{ borderColor: "rgba(11,30,63,0.11)" }}>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold"
                style={{ backgroundColor: GOLD, color: NAVY, fontFamily: ff }}
              >
                {isBn ? "এজেন্ট ও সাপ্লায়ার পোর্টাল" : "Agent & Supplier Portal"}
                <ExternalLink size={13} />
              </Link>
            </div>
          </div>
        </div>

        <div
          className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8 border-t"
          style={{ borderColor: "rgba(11,30,63,0.11)" }}
        >
          <div className="text-xs" style={{ color: "rgba(11,30,63,0.50)", fontFamily: ff }}>
            {isBn
              ? "© ১৪৪৬হি / ২০২৫ তুবা আল হিজাজ গ্রাউন্ড হ্যান্ডলিং। সর্বস্বত্ব সংরক্ষিত।"
              : "© 1446H / 2025 TUBA AL HIJAZ Ground Handling. All rights reserved."
            }
          </div>
          <div className="flex items-center gap-4">
            {[
              { en: "Privacy Policy", bn: "গোপনীয়তা নীতি", to: null },
              { en: "Terms of Service", bn: "সেবার শর্তাবলি", to: null },
            ].map((item) => (
              item.to
                ? <Link key={item.en} to={item.to} className="text-xs" style={{ color: "rgba(11,30,63,0.38)", fontFamily: ff }}>{isBn ? item.bn : item.en}</Link>
                : <span key={item.en} className="text-xs cursor-pointer" style={{ color: "rgba(11,30,63,0.50)", fontFamily: ff }}>{isBn ? item.bn : item.en}</span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
