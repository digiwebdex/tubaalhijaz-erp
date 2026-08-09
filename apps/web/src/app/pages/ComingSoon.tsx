import { useLocation, Link } from "react-router";
import { AlertCircle, ArrowLeft } from "lucide-react";

// Honest "not in this release" page. No fabricated data.
const NAVY = "var(--erp-text-strong)";
const GOLD = "#C6A15B";

const TITLES: Record<string, { bn: string; en: string }> = {
  "/ops-departments": { bn: "অপারেশনস ডিপার্টমেন্ট", en: "Operations Departments" },
  "/workflow-map": { bn: "ওয়ার্কফ্লো ম্যাপ", en: "Workflow Map" },
  "/mobile-apps": { bn: "মোবাইল অ্যাপস", en: "Mobile Apps" },
  "/tablet": { bn: "ট্যাবলেট কনসোল", en: "Tablet Console" },
  "/design-system": { bn: "ডিজাইন সিস্টেম", en: "Design System" },
  "/i18n-system": { bn: "ভাষা সিস্টেম", en: "i18n System" },
};

export default function ComingSoon() {
  const { pathname } = useLocation();
  const title = TITLES[pathname] ?? { bn: "এই মডিউল", en: "This module" };
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
      style={{ backgroundColor: "#F7F5F1", fontFamily: "'Noto Sans Bengali', 'Hind Siliguri', system-ui, sans-serif" }}
    >
      <div
        className="flex items-center justify-center w-16 h-16 rounded-xl mb-6"
        style={{ backgroundColor: `${GOLD}1A`, border: `1px solid ${GOLD}40` }}
      >
        <AlertCircle size={28} style={{ color: GOLD }} />
      </div>
      <h1 className="text-2xl font-bold mb-2" style={{ color: NAVY }}>
        {title.bn}
      </h1>
      <p className="text-sm max-w-md mb-2" style={{ color: "rgba(11,30,63,0.58)" }}>
        এই মডিউল এখনও কনফিগার করা হয়নি।
      </p>
      <p className="text-xs max-w-md mb-8" style={{ color: "rgba(11,30,63,0.45)" }}>
        {title.en} is not part of the current production release.
      </p>
      <Link
        to="/"
        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm border-2 transition-all hover:opacity-80"
        style={{ borderColor: NAVY, color: NAVY }}
      >
        <ArrowLeft size={16} /> হোমে ফিরুন
      </Link>
    </div>
  );
}
