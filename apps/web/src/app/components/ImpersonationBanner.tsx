import { useEffect, useRef, useState } from "react";
import { ShieldAlert, LogOut } from "lucide-react";
import { api, isLoggedIn } from "../lib/api";

interface Active {
  impersonating: boolean;
  reason?: string;
  admin?: { email?: string; name?: string } | null;
  agent?: { email?: string; name?: string } | null;
  remainingSeconds?: number;
}

/**
 * Global impersonation banner + watermark. Renders only during an active
 * impersonation session; reads GET /admin/impersonation/active with the current token.
 * On "End Session" it stops the session and restores the admin token.
 */
export function ImpersonationBanner() {
  const [s, setS] = useState<Active | null>(null);
  const [remaining, setRemaining] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = () => {
    if (!isLoggedIn()) { setS(null); return; }
    api.get<Active>("/admin/impersonation/active")
      .then((a) => { setS(a?.impersonating ? a : null); if (a?.impersonating) setRemaining(a.remainingSeconds ?? 0); })
      .catch(() => setS(null));
  };
  useEffect(() => { refresh(); const id = setInterval(refresh, 30_000); return () => clearInterval(id); }, []);
  useEffect(() => {
    if (!s) { if (timer.current) clearInterval(timer.current); return; }
    timer.current = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [s]);
  useEffect(() => { if (s && remaining === 0) endSession(); /* auto-expire */ }, [remaining, s]);

  const endSession = async () => {
    try { await api.post("/admin/impersonation/stop", {}); } catch { /* token may already be expired */ }
    const adminAt = sessionStorage.getItem("tuba_admin_at");
    const adminUser = sessionStorage.getItem("tuba_admin_user");
    if (adminAt) sessionStorage.setItem("tuba_at", adminAt);
    if (adminUser) sessionStorage.setItem("tuba_user", adminUser);
    sessionStorage.removeItem("tuba_admin_at"); sessionStorage.removeItem("tuba_admin_user");
    window.location.href = "/super-admin";
  };

  if (!s) return null;
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const low = remaining < 120;

  return (
    <>
      {/* Watermark — fixed, non-interactive, diagonal repeat */}
      <div aria-hidden="true" style={{
        position: "fixed", inset: 0, zIndex: 40, pointerEvents: "none",
        backgroundImage: "repeating-linear-gradient(-45deg, rgba(220,78,42,0.06) 0 2px, transparent 2px 180px)",
      }}>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ transform: "rotate(-24deg)", fontSize: "3rem", fontWeight: 800, letterSpacing: "0.1em", color: "rgba(220,78,42,0.07)", whiteSpace: "nowrap", userSelect: "none" }}>
            IMPERSONATION · {s.agent?.email}
          </span>
        </div>
      </div>

      {/* Banner — fixed top, always visible */}
      <div role="alert" aria-live="polite" style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 60,
        background: "linear-gradient(90deg,#B91C1C,#DC4E2A)", color: "#fff",
        display: "flex", alignItems: "center", gap: 12, padding: "8px 16px", fontSize: 13, boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
      }}>
        <ShieldAlert size={18} aria-hidden="true" />
        <span style={{ fontWeight: 700 }}>You are operating as Agent {s.agent?.name || s.agent?.email}</span>
        <span style={{ opacity: 0.9 }} className="hidden sm:inline">
          · Actual admin: <b>{s.admin?.email}</b> · Acting as: <b>{s.agent?.email}</b>{s.reason ? ` · Reason: ${s.reason}` : ""}
        </span>
        <span style={{ flex: 1 }} />
        <span aria-label={`Session time remaining ${mm}:${ss}`} style={{ fontFamily: "var(--font-mono, monospace)", fontWeight: 700, background: low ? "#7f1d1d" : "rgba(0,0,0,0.2)", padding: "2px 8px", borderRadius: 6 }}>
          ⏱ {mm}:{ss}
        </span>
        <button onClick={endSession}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#fff", color: "#B91C1C", fontWeight: 700, border: "none", borderRadius: 6, padding: "5px 12px", cursor: "pointer" }}>
          <LogOut size={14} aria-hidden="true" /> End Session
        </button>
      </div>
      {/* Spacer so page content isn't hidden behind the fixed banner */}
      <div aria-hidden="true" style={{ height: 40 }} />
    </>
  );
}
