import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { Eye, EyeOff, ArrowRight, Shield, Globe2, Loader2, ChevronRight } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { homePathForUser } from "../lib/rbac";
import { ErrorState } from "../components/States";

const NAVY = "#0B1E3F";
const GOLD = "#C9A24B";

function LogoMark({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <path d="M14.5 3H33.5L45 14.5V33.5L33.5 45H14.5L3 33.5V14.5L14.5 3Z" fill="rgba(11,30,63,0.38)" stroke={GOLD} strokeWidth="0.5" />
      <path d="M13 15H35V19H27V34H21V19H13V15Z" fill={GOLD} />
      <circle cx="37" cy="11" r="4" fill="none" stroke={GOLD} strokeWidth="1.5" opacity="0.7" />
      <circle cx="38.5" cy="9.8" r="3.2" fill={NAVY} />
    </svg>
  );
}

function GeometricPattern() {
  return (
    <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg" style={{ opacity: 0.05 }}>
      <defs>
        <pattern id="login-geo" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
          <path d="M40 0L80 20V60L40 80L0 60V20Z" fill="none" stroke={GOLD} strokeWidth="0.6" />
          <path d="M40 16L64 28V52L40 64L16 52V28Z" fill="none" stroke={GOLD} strokeWidth="0.4" />
          <circle cx="40" cy="40" r="6" fill="none" stroke={GOLD} strokeWidth="0.4" />
          <path d="M40 10L70 25V55L40 70L10 55V25Z" fill="none" stroke={GOLD} strokeWidth="0.25" strokeDasharray="2 4" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#login-geo)" />
    </svg>
  );
}

const TABS = [
  { id: "agent", label: "Agent", ar: "وكيل السفر", desc: "Travel agency & group operator access" },
  { id: "supplier", label: "Supplier", ar: "المورد", desc: "Hotel, transport & catering suppliers" },
  { id: "admin", label: "Admin", ar: "المشرف", desc: "Internal TUBA AL HIJAZ operations" },
];

export default function Login() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("agent");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  // Sign-in failures are shown inline (below) as well as via toast — a toast
  // auto-dismisses and is easy to miss on the screen where it matters most.
  const [error, setError] = useState("");

  const activeTab = TABS.find((t) => t.id === tab)!;

  const PORTAL_LABELS: Record<string, string> = {
    agent:    "Agent Portal",
    supplier: "Supplier Portal",
    admin:    "Admin",
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const user = await api.login(email, password, tab as "agent" | "supplier" | "admin");
      // S1-05: land on first permitted path from session permissions (not a fixed admin URL).
      const dest = homePathForUser(user);
      toast.success(`Welcome to ${PORTAL_LABELS[tab] ?? "TUBA Portal"}`, {
        description: user.company?.name ?? user.name,
        duration: 3000,
      });
      navigate(dest);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Cannot reach the TUBA server — please try again.";
      setError(msg);
      toast.error("Sign in failed", { description: msg, duration: 4000 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: "#F5F7FA", fontFamily: "var(--font-sans)" }}>
      {/* Left panel — branding */}
      <div className="hidden lg:flex flex-col w-5/12 relative overflow-hidden" style={{ backgroundColor: NAVY }}>
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1768831822158-e34bd8fc87a9?auto=format&fit=crop&w=1200&q=80"
            alt="Makkah skyline"
            className="w-full h-full object-cover opacity-20"
          />
          <div className="absolute inset-0" style={{ background: `linear-gradient(to right, ${NAVY} 0%, rgba(11,30,63,0.85) 100%)` }} />
        </div>
        <GeometricPattern />

        <div className="relative z-10 flex flex-col justify-between h-full p-12">
          <div>
            <Link to="/" className="flex items-center gap-3 mb-16">
              <LogoMark size={40} />
              <div>
                <div className="text-white font-bold text-base tracking-widest">TUBA AL HIJAZ</div>
                <div className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: GOLD }}>Ground Handling</div>
              </div>
            </Link>

            <h1 className="text-4xl font-bold text-white mb-4 leading-tight">
              Enterprise Operations
              <br />
              <span style={{ color: GOLD }}>Portal</span>
            </h1>
            <p className="text-base leading-relaxed mb-10" style={{ color: "rgba(255,255,255,0.70)" }}>
              Manage visa processing, hotel bookings, transport dispatch and full financial operations for Umrah and Hajj groups from a single platform.
            </p>

            <div className="space-y-4">
              {[
                { icon: Shield, label: "Desk-Operated Visa", desc: "Staff-updated pipeline — no fake gov API" },
                { icon: Globe2, label: "Bilingual Interface", desc: "Full Arabic and English support" },
                { icon: ArrowRight, label: "Season-Scale Ready", desc: "Built for peak Hajj operations" },
              ].map((f) => (
                <div key={f.label} className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${GOLD}15` }}>
                    <f.icon size={14} style={{ color: GOLD }} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">{f.label}</div>
                    <div className="text-xs" style={{ color: "rgba(255,255,255,0.62)" }}>{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs font-bold uppercase tracking-[0.2em] mb-3" style={{ color: "rgba(255,255,255,0.50)" }}>
              Certified Platform
            </div>
            <div className="flex gap-3">
              {["NUSUK", "MOFA", "MHU"].map((badge) => (
                <div key={badge} className="px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-widest border" style={{ borderColor: `${GOLD}25`, color: `${GOLD}60` }}>
                  {badge}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 relative">
        <GeometricPattern />
        <div className="relative z-10 w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center justify-center gap-3 mb-10 lg:hidden">
            <LogoMark size={36} />
            <div>
              <div className="text-[#0B1E3F] font-bold text-sm tracking-widest">TUBA AL HIJAZ</div>
              <div className="text-[9px] font-bold uppercase tracking-[0.18em]" style={{ color: GOLD }}>Ground Handling Portal</div>
            </div>
          </div>

          <div className="text-center mb-8 lg:hidden">
            <h1 className="text-2xl font-bold text-[#0B1E3F] mb-2">Sign In</h1>
          </div>
          <div className="hidden lg:block mb-8">
            <div className="text-xs font-bold uppercase tracking-[0.2em] mb-2" style={{ color: GOLD }}>Portal Access</div>
            <h2 className="text-3xl font-bold text-[#0B1E3F]">Sign In to Your Account</h2>
          </div>

          {/* Tab selector */}
          <div className="flex gap-1 mb-8 p-1 rounded-xl" style={{ backgroundColor: "#FBFCFD", border: `1px solid rgba(11,30,63,0.11)` }}>
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => { setTab(t.id); setError(""); }}
                className="flex-1 py-2.5 rounded-lg text-xs font-bold transition-all"
                style={
                  tab === t.id
                    ? { backgroundColor: GOLD, color: NAVY }
                    : { color: "rgba(11,30,63,0.58)" }
                }
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab context */}
          <div className="mb-6 p-3 rounded-xl text-xs" style={{ backgroundColor: "rgba(201,162,75,0.08)", border: `1px solid rgba(201,162,75,0.15)`, color: "rgba(11,30,63,0.66)" }}>
            <span style={{ color: GOLD }} className="font-semibold">{activeTab.label}: </span>
            {activeTab.desc}
            <span className="ml-2 text-xs" style={{ color: "rgba(11,30,63,0.50)", fontFamily: "var(--font-arabic)" }} lang="ar" dir="rtl">{activeTab.ar}</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold mb-2" style={{ color: "rgba(11,30,63,0.76)" }}>
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={`${tab}@example.com`}
                className="w-full px-4 py-3 text-sm rounded-xl focus:outline-none transition"
                style={{
                  backgroundColor: "#F5F7FA",
                  border: `1px solid rgba(11,30,63,0.15)`,
                  color: "#0B1E3F",
                }}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold" style={{ color: "rgba(11,30,63,0.76)" }}>Password</label>
                <button type="button" onClick={() => navigate("/reset-password")} className="text-xs" style={{ color: GOLD }}>Forgot password?</button>
              </div>
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-4 py-3 pr-11 text-sm rounded-xl focus:outline-none transition"
                  style={{
                    backgroundColor: "#F5F7FA",
                    border: `1px solid rgba(11,30,63,0.15)`,
                    color: "#0B1E3F",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2"
                  style={{ color: "rgba(11,30,63,0.58)" }}
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && <ErrorState message={error} tone="light" />}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm transition-all disabled:opacity-60"
              style={{ backgroundColor: GOLD, color: NAVY }}
            >
              {loading ? (
                <><Loader2 size={16} className="animate-spin" />Signing in…</>
              ) : (
                <>Sign In as {activeTab.label}<ArrowRight size={14} /></>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t text-center space-y-4" style={{ borderColor: "rgba(11,30,63,0.11)" }}>
            <p className="text-xs" style={{ color: "rgba(11,30,63,0.58)" }}>
              New partner?{" "}
              <Link to="/auth-onboarding" style={{ color: GOLD }}>
                Apply for agent access
              </Link>
            </p>
            <p className="text-xs" style={{ color: "rgba(11,30,63,0.38)" }}>
              By signing in you agree to TUBA AL HIJAZ&apos;s{" "}
              <span style={{ color: "rgba(11,30,63,0.58)", cursor: "pointer" }}>Terms of Service</span>
              {" "}and{" "}
              <span style={{ color: "rgba(11,30,63,0.58)", cursor: "pointer" }}>Privacy Policy</span>
            </p>
            <Link to="/" className="inline-flex items-center gap-1.5 text-xs" style={{ color: "rgba(11,30,63,0.50)" }}>
              <ChevronRight size={10} className="rotate-180" />
              Back to TUBA AL HIJAZ website
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
