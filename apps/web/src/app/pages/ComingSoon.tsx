import { useLocation, Link } from "react-router";
import { Clock, ArrowLeft } from "lucide-react";

// On-brand "not in this release" page. Renders for out-of-scope routes so no real
// user ever lands on a frozen mock screen. No data, live or mock, is shown here.
const NAVY = "#0B1E3F";
const GOLD = "#C6A15B";

const TITLES: Record<string, string> = {
  "/ops-departments": "Operations Departments",
  "/workflow-map": "Workflow Map",
  "/mobile-apps": "Mobile Apps",
  "/tablet": "Tablet Console",
};

export default function ComingSoon() {
  const { pathname } = useLocation();
  const title = TITLES[pathname] ?? "This module";
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
      style={{ backgroundColor: "#F7F5F1" }}
    >
      <div
        className="flex items-center justify-center w-16 h-16 rounded-2xl mb-6"
        style={{ backgroundColor: `${GOLD}1A`, border: `1px solid ${GOLD}40` }}
      >
        <Clock size={28} style={{ color: GOLD }} />
      </div>
      <h1 className="text-2xl font-bold mb-2" style={{ color: NAVY }}>
        {title} — coming soon
      </h1>
      <p className="text-sm max-w-md mb-8" style={{ color: "rgba(11,30,63,0.58)" }}>
        This module isn&rsquo;t part of the current release. It will be available in an upcoming update.
      </p>
      <Link
        to="/"
        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm border-2 transition-all hover:opacity-80"
        style={{ borderColor: NAVY, color: NAVY }}
      >
        <ArrowLeft size={16} /> Back to home
      </Link>
    </div>
  );
}
