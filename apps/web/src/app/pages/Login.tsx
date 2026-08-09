import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { homePathForUser } from "../lib/rbac";
import { ERP, ErpThemeProvider } from "../components/erp";

// Brand mark — the TUBA mosque/tower glyph, in the DS gold-dim square.
function LogoMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <path d="M13 15H35V19H27V34H21V19H13V15Z" fill={ERP.accent} />
      <circle cx="37" cy="11" r="4" fill="none" stroke={ERP.accent} strokeWidth="1.5" opacity="0.75" />
      <circle cx="38.5" cy="9.8" r="3.2" fill={ERP.canvas} />
    </svg>
  );
}

// Subtle geometric pattern, in the DS gold-on-navy language.
function GeoPattern() {
  return (
    <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg" style={{ opacity: 0.4, pointerEvents: "none" }} aria-hidden>
      <defs>
        <pattern id="login-geo" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
          <path d="M40 0L80 20V60L40 80L0 60V20Z" fill="none" stroke={ERP.accent} strokeWidth="0.5" strokeOpacity="0.10" />
          <path d="M40 16L64 28V52L40 64L16 52V28Z" fill="none" stroke={ERP.accent} strokeWidth="0.4" strokeOpacity="0.08" />
          <circle cx="40" cy="40" r="6" fill="none" stroke={ERP.accent} strokeWidth="0.4" strokeOpacity="0.08" />
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

const PORTAL_LABELS: Record<string, string> = { agent: "Agent Portal", supplier: "Supplier Portal", admin: "Admin" };

const PORTAL_STORAGE_KEY = "tuba.lastPortal";
const isPortal = (v: string | null): boolean => !!v && TABS.some((t) => t.id === v);

/**
 * Which portal tab opens preselected, most-explicit intent first:
 *   1. ?portal=... — an entry point that states its persona (e.g. the public "Agent Login" link)
 *   2. the portal of the last SUCCESSFUL sign-in on this browser, so staff arriving from an
 *      expired session or the ERP logout link are not forced to re-pick "Admin" every time
 *   3. "agent" — unchanged first-visit default for public/marketing traffic
 */
function initialPortal(search: URLSearchParams): string {
  const q = search.get("portal");
  if (isPortal(q)) return q as string;
  try {
    const saved = localStorage.getItem(PORTAL_STORAGE_KEY);
    if (isPortal(saved)) return saved as string;
  } catch {
    /* storage unavailable (private mode) — fall through to the default */
  }
  return "agent";
}

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(() => initialPortal(searchParams));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const activeTab = TABS.find((t) => t.id === tab)!;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const user = await api.login(email, password, tab as "agent" | "supplier" | "admin");
      const dest = homePathForUser(user);
      // Remember the persona only after the credentials actually worked.
      try { localStorage.setItem(PORTAL_STORAGE_KEY, tab); } catch { /* storage unavailable — non-fatal */ }
      toast.success(`Welcome to ${PORTAL_LABELS[tab] ?? "TUBA Portal"}`, { description: user.company?.name ?? user.name, duration: 3000 });
      navigate(dest);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Cannot reach the TUBA server — please try again.";
      setError(msg);
      toast.error("Sign in failed", { description: msg, duration: 4000 });
    } finally {
      setLoading(false);
    }
  };

  const fieldLabel: React.CSSProperties = { display: "block", fontFamily: ERP.font.heading, fontSize: ERP.text.size[9], fontWeight: ERP.text.weight.bold, color: ERP.muted, letterSpacing: "0.1em", marginBottom: ERP.space[1.5], textTransform: "uppercase" };
  const fieldInput: React.CSSProperties = { width: "100%", padding: `${ERP.space[2.5]}px ${ERP.space[3.5]}px`, background: ERP.surfaceSoft, border: `1px solid ${ERP.border}`, borderRadius: 8, color: ERP.navy, fontFamily: ERP.font.body, fontSize: ERP.text.size[13], outline: "none", boxSizing: "border-box" };

  return (
    <ErpThemeProvider theme="ds">
    <div style={{ minHeight: "100vh", background: ERP.canvas, display: "flex", flexDirection: "column", position: "relative" }}>
      <GeoPattern />
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: `${ERP.space[10]}px ${ERP.space[6]}px`, position: "relative", zIndex: 1 }}>
        <div style={{ width: "100%", maxWidth: 400 }}>
          {/* Brand mark */}
          <Link to="/" style={{ display: "block", textAlign: "center", marginBottom: ERP.space[8], textDecoration: "none" }}>
            <div style={{ width: 52, height: 52, borderRadius: 12, background: ERP.goldDim, border: `1px solid ${ERP.goldBrd}`, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: ERP.space[3.5] }}>
              <LogoMark size={26} />
            </div>
            <div style={{ fontFamily: ERP.font.heading, fontSize: ERP.text.size[18], fontWeight: ERP.text.weight.bold, color: ERP.navy, marginBottom: ERP.space[0.5] }}>Tuba Al-Hijaz</div>
            <div style={{ fontFamily: ERP.font.data, fontSize: ERP.text.size[10], color: ERP.accent, letterSpacing: "0.12em" }}>HAJJ ERP · GROUND HANDLING</div>
          </Link>

          {/* Card */}
          <div style={{ background: ERP.surface, border: `1px solid ${ERP.border}`, borderRadius: ERP.radius.lg, padding: `${ERP.space[7]}px ${ERP.space[7]}px ${ERP.space[6]}px`, boxShadow: ERP.shadow.lg }}>
            <div style={{ fontFamily: ERP.font.heading, fontSize: ERP.text.size[16], fontWeight: ERP.text.weight.bold, color: ERP.navy, marginBottom: ERP.space[1] }}>Welcome back</div>
            <div style={{ fontFamily: ERP.font.body, fontSize: ERP.text.size[12], color: ERP.muted, marginBottom: ERP.space[6] }}>Sign in to your TUBA AL HIJAZ portal</div>

            {/* Portal selector (segmented) */}
            <div style={{ display: "flex", gap: ERP.space[1], padding: ERP.space[1], background: ERP.surfaceSoft, border: `1px solid ${ERP.border}`, borderRadius: 8, marginBottom: ERP.space[4] }}>
              {TABS.map((t) => (
                <button key={t.id} type="button" onClick={() => { setTab(t.id); setError(""); }}
                  style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: ERP.font.heading, fontSize: ERP.text.size[11], fontWeight: ERP.text.weight.semibold, letterSpacing: "0.02em",
                    background: tab === t.id ? ERP.accent : "transparent", color: tab === t.id ? ERP.canvas : ERP.muted, transition: "background 0.15s, color 0.15s" }}>
                  {t.label}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: ERP.space[2], marginBottom: ERP.space[5], padding: ERP.space[3], background: ERP.goldDim, border: `1px solid ${ERP.goldBrd}`, borderRadius: 8 }}>
              <span style={{ fontFamily: ERP.font.body, fontSize: ERP.text.size[11], color: ERP.fgDim, lineHeight: ERP.text.leading.normal }}>
                <span style={{ color: ERP.accent, fontWeight: ERP.text.weight.semibold }}>{activeTab.label}: </span>{activeTab.desc}
              </span>
              <span lang="ar" dir="rtl" style={{ marginInlineStart: "auto", fontFamily: "var(--font-arabic)", fontSize: ERP.text.size[11], color: ERP.muted, whiteSpace: "nowrap" }}>{activeTab.ar}</span>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: ERP.space[4] }}>
                <label htmlFor="email" style={fieldLabel}>Email Address</label>
                <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={`${tab}@example.com`}
                  style={fieldInput} onFocus={(e) => (e.currentTarget.style.borderColor = ERP.accent)} onBlur={(e) => (e.currentTarget.style.borderColor = ERP.border)} />
              </div>

              <div style={{ marginBottom: ERP.space[4] }}>
                <label htmlFor="password" style={fieldLabel}>Password</label>
                <div style={{ position: "relative" }}>
                  <input id="password" type={showPwd ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••••"
                    style={{ ...fieldInput, paddingRight: ERP.space[10] }} onFocus={(e) => (e.currentTarget.style.borderColor = ERP.accent)} onBlur={(e) => (e.currentTarget.style.borderColor = ERP.border)} />
                  <button type="button" onClick={() => setShowPwd(!showPwd)} aria-label={showPwd ? "Hide password" : "Show password"}
                    style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: ERP.muted, cursor: "pointer", display: "flex" }}>
                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: ERP.space[5] }}>
                <label style={{ display: "flex", alignItems: "center", gap: ERP.space[1.5], cursor: "pointer" }}>
                  <input type="checkbox" defaultChecked style={{ accentColor: ERP.accent }} />
                  <span style={{ fontFamily: ERP.font.body, fontSize: ERP.text.size[11], color: ERP.muted }}>Remember me on this device</span>
                </label>
                <button type="button" onClick={() => navigate("/reset-password")} style={{ background: "none", border: "none", color: ERP.info, fontFamily: ERP.font.body, fontSize: ERP.text.size[11], cursor: "pointer", padding: ERP.space[0] }}>Forgot password?</button>
              </div>

              {error && (
                <div role="alert" style={{ display: "flex", gap: ERP.space[2], padding: `${ERP.space[2.5]}px ${ERP.space[3]}px`, background: ERP.destructiveDim, border: `1px solid ${ERP.destructive}`, borderRadius: 8, marginBottom: ERP.space[4] }}>
                  <span style={{ color: ERP.destructive, fontSize: ERP.text.size[12] }}>⚠</span>
                  <span style={{ fontFamily: ERP.font.body, fontSize: ERP.text.size[12], color: ERP.navy }}>{error}</span>
                </div>
              )}

              <button type="submit" disabled={loading}
                style={{ width: "100%", padding: ERP.space[3], background: ERP.accent, border: "none", borderRadius: 8, color: ERP.canvas, fontFamily: ERP.font.heading, fontSize: ERP.text.size[13], fontWeight: ERP.text.weight.bold, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: ERP.space[2] }}>
                {loading ? <><Loader2 size={16} className="animate-spin" />Signing in…</> : <>Sign In as {activeTab.label}<ArrowRight size={14} /></>}
              </button>
            </form>

            {/* Certified platform */}
            <div style={{ marginTop: ERP.space[4], padding: ERP.space[3], background: ERP.surfaceSoft, borderRadius: 8, display: "flex", alignItems: "center", gap: ERP.space[2] }}>
              <span style={{ fontFamily: ERP.font.heading, fontSize: ERP.text.size[9], fontWeight: ERP.text.weight.bold, color: ERP.muted, letterSpacing: "0.12em" }}>CERTIFIED</span>
              {["NUSUK", "MOFA", "MHU"].map((b) => (
                <span key={b} style={{ padding: `${ERP.space[0.5]}px ${ERP.space[2]}px`, borderRadius: ERP.radius.xs, border: `1px solid ${ERP.goldBrd}`, color: ERP.accent, fontFamily: ERP.font.heading, fontSize: ERP.text.size[9], fontWeight: ERP.text.weight.bold, letterSpacing: "0.08em", opacity: 0.8 }}>{b}</span>
              ))}
            </div>
          </div>

          {/* Footer links */}
          <div style={{ marginTop: ERP.space[5], textAlign: "center", display: "flex", flexDirection: "column", gap: ERP.space[2.5] }}>
            <p style={{ fontFamily: ERP.font.body, fontSize: ERP.text.size[12], color: ERP.muted, margin: ERP.space[0] }}>
              New partner? <Link to="/auth-onboarding" style={{ color: ERP.accent, textDecoration: "none" }}>Apply for agent access</Link>
            </p>
            <Link to="/" style={{ fontFamily: ERP.font.body, fontSize: ERP.text.size[11], color: ERP.muted, textDecoration: "none" }}>← Back to TUBA AL HIJAZ website</Link>
          </div>
        </div>
      </div>
    </div>
    </ErpThemeProvider>
  );
}
