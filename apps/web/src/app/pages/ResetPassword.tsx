import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { Loader2, ArrowLeft, CheckCircle2, ShieldCheck } from "lucide-react";
import { api, ApiError } from "../lib/api";

const GOLD = "#C9A24B";
const NAVY = "#0B1E3F";
const inputStyle = { backgroundColor: "#F5F7FA", border: "1px solid rgba(11,30,63,0.15)", color: NAVY } as const;

/** Password recovery. `?token=…` → set a new password; otherwise → request a reset link. */
export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const requestLink = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setSent(true);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not send reset link");
    } finally {
      setLoading(false);
    }
  };

  const doReset = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) return toast.error("Passwords do not match");
    if (password.length < 8) return toast.error("Password must be at least 8 characters");
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, newPassword: password });
      toast.success("Password reset — please sign in with your new password");
      navigate("/login");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "This reset link is invalid or has expired");
    } finally {
      setLoading(false);
    }
  };

  const submitBtn = (label: string) => (
    <button type="submit" disabled={loading} className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60 transition" style={{ backgroundColor: GOLD, color: NAVY }}>
      {loading ? <Loader2 size={16} className="animate-spin" /> : null} {label}
    </button>
  );

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "#F5F7FA" }}>
      <div className="w-full max-w-md rounded-2xl p-8 shadow-sm" style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(11,30,63,0.11)" }}>
        <div className="flex items-center gap-2 mb-6">
          <ShieldCheck size={22} style={{ color: GOLD }} />
          <span className="text-sm font-bold" style={{ color: NAVY }}>TUBA AL HIJAZ</span>
        </div>

        {token ? (
          <form onSubmit={doReset}>
            <h1 className="text-lg font-bold mb-1" style={{ color: NAVY }}>Set a new password</h1>
            <p className="text-xs mb-5" style={{ color: "rgba(11,30,63,0.58)" }}>Choose a new password for your account.</p>
            <label className="text-xs font-semibold" style={{ color: "rgba(11,30,63,0.76)" }}>New password</label>
            <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full mt-1 mb-3 px-4 py-3 text-sm rounded-xl focus:outline-none" style={inputStyle} />
            <label className="text-xs font-semibold" style={{ color: "rgba(11,30,63,0.76)" }}>Confirm password</label>
            <input type="password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" className="w-full mt-1 mb-5 px-4 py-3 text-sm rounded-xl focus:outline-none" style={inputStyle} />
            {submitBtn("Reset password")}
          </form>
        ) : sent ? (
          <div className="text-center py-4">
            <CheckCircle2 size={40} className="mx-auto mb-3" style={{ color: "#16A34A" }} />
            <h1 className="text-lg font-bold mb-1" style={{ color: NAVY }}>Check your email</h1>
            <p className="text-xs" style={{ color: "rgba(11,30,63,0.58)" }}>If an account exists for that email, a reset link has been sent. It expires in 30 minutes.</p>
          </div>
        ) : (
          <form onSubmit={requestLink}>
            <h1 className="text-lg font-bold mb-1" style={{ color: NAVY }}>Forgot your password?</h1>
            <p className="text-xs mb-5" style={{ color: "rgba(11,30,63,0.58)" }}>Enter your account email and we will send a reset link.</p>
            <label className="text-xs font-semibold" style={{ color: "rgba(11,30,63,0.76)" }}>Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="w-full mt-1 mb-5 px-4 py-3 text-sm rounded-xl focus:outline-none" style={inputStyle} />
            {submitBtn("Send reset link")}
          </form>
        )}

        <Link to="/login" className="mt-5 flex items-center justify-center gap-1.5 text-xs font-semibold" style={{ color: "rgba(11,30,63,0.58)" }}>
          <ArrowLeft size={13} /> Back to sign in
        </Link>
      </div>
    </div>
  );
}
