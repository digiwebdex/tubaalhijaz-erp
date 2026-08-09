import { useState, useEffect, useRef } from "react";
import { useLang } from "../lib/LangContext";
import { Link, useNavigate } from "react-router";
import { api, ApiError, isLoggedIn, type RegistrationResult } from "../lib/api";
import {
  Upload, CheckCircle, Loader2, Eye, EyeOff, ArrowRight, ChevronLeft,
  ScanLine, FileText, Building, Bus, UtensilsCrossed, User, Landmark,
  Users, ClipboardCheck, Shield, Globe2, AlertCircle, XCircle,
  Clock, BadgeCheck, RotateCcw, Phone, Mail, ExternalLink, Plus, Trash2,
  Camera, Home, ChevronRight, LogIn,
} from "lucide-react";

const NAVY = "var(--erp-text-strong)";
const GOLD = "var(--erp-accent)";
const DARK = "#F0F2F7";
const GREEN = "var(--erp-success)";

type DZState = "empty" | "uploading" | "done";

// ─── Utility helpers ────────────────────────────────────────────────────────

function autoUpload(set: (s: DZState) => void, delay = 1700) {
  return (s: DZState) => {
    set(s);
    if (s === "uploading") setTimeout(() => set("done"), delay);
  };
}

// ─── Geometric pattern ──────────────────────────────────────────────────────

function GeoPattern({ id, opacity = 0.05 }: { id: string; opacity?: number }) {
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity }}>
      <defs>
        <pattern id={id} x="0" y="0" width="72" height="72" patternUnits="userSpaceOnUse">
          <path d="M36 0L72 18V54L36 72L0 54V18Z" fill="none" stroke={GOLD} strokeWidth="0.5" />
          <path d="M36 14L58 25V47L36 58L14 47V25Z" fill="none" stroke={GOLD} strokeWidth="0.3" />
          <circle cx="36" cy="36" r="5" fill="none" stroke={GOLD} strokeWidth="0.3" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <path d="M14.5 3H33.5L45 14.5V33.5L33.5 45H14.5L3 33.5V14.5L14.5 3Z" fill="rgba(11,30,63,0.38)" stroke={GOLD} strokeWidth="0.5" />
      <path d="M13 15H35V19H27V34H21V19H13V15Z" fill={GOLD} />
      <circle cx="37" cy="11" r="4" fill="none" stroke={GOLD} strokeWidth="1.5" opacity="0.7" />
      <circle cx="38.5" cy="9.8" r="3.2" fill={NAVY} />
    </svg>
  );
}

// ─── StepBar ─────────────────────────────────────────────────────────────────

function StepBar({ steps, current }: { steps: { num: number; label: string }[]; current: number }) {
  return (
    <div className="flex items-center gap-0 mb-10">
      {steps.map((s, i) => {
        const done = s.num < current;
        const active = s.num === current;
        return (
          <div key={s.num} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shrink-0"
                style={
                  done
                    ? { backgroundColor: GOLD, color: NAVY }
                    : active
                    ? { backgroundColor: NAVY, color: GOLD, border: `2px solid ${GOLD}` }
                    : { backgroundColor: "var(--erp-canvas)", color: "rgba(11,30,63,0.50)", border: "1px solid rgba(11,30,63,0.15)" }
                }
              >
                {done ? <CheckCircle size={14} /> : s.num}
              </div>
              <span
                className="text-[10px] font-semibold whitespace-nowrap"
                style={{ color: done || active ? GOLD : "rgba(11,30,63,0.50)" }}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className="flex-1 h-px mx-2 mb-4"
                style={{ backgroundColor: done ? `${GOLD}50` : "rgba(11,30,63,0.38)" }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── FileDropzone ────────────────────────────────────────────────────────────

interface DropzoneProps {
  state: DZState;
  onChange: (s: DZState) => void;
  label: string;
  hint?: string;
  extracted?: { key: string; value: string }[];
  progress?: number;
  /** When provided, clicking opens a real file picker and uploads via this callback. */
  onFile?: (file: File) => Promise<unknown>;
}

function FileDropzone({ state, onChange, label, hint, extracted, progress = 68, onFile }: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  // A failed upload must say so — silently snapping back to "empty" looks like
  // the click did nothing. Uses this page's designed inline-error treatment.
  const [uploadError, setUploadError] = useState("");
  const [fileName, setFileName] = useState("");

  const handleClick = () => {
    if (state !== "empty") return;
    if (onFile) {
      inputRef.current?.click(); // real upload path — open the file picker
    } else {
      autoUpload(onChange)(("uploading") as DZState); // showcase/demo path
    }
  };

  const handleFile = async (file: File | undefined) => {
    if (!file || !onFile) return;
    setUploadError("");
    setFileName(file.name);
    onChange("uploading");
    try {
      await onFile(file);
      onChange("done");
    } catch (err) {
      setFileName("");
      setUploadError(
        err instanceof ApiError ? err.message : "Upload failed — check your connection and try again.",
      );
      onChange("empty"); // back to the empty state so the user can retry
    }
  };

  return (
    <div>
      <div className="text-xs font-semibold mb-2" style={{ color: "rgba(11,30,63,0.76)" }}>
        {label}
      </div>
      {onFile && (
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.svg,.tiff"
          className="hidden"
          onChange={(e) => { void handleFile(e.target.files?.[0]); e.target.value = ""; }}
        />
      )}
      {state === "empty" && (
        <button
          type="button"
          onClick={handleClick}
          className="w-full rounded-xl flex flex-col items-center justify-center gap-2 py-8 px-4 transition-all hover:opacity-80"
          style={{
            border: `1.5px dashed ${GOLD}40`,
            backgroundColor: `${GOLD}06`,
          }}
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${GOLD}15` }}>
            <Upload size={18} style={{ color: GOLD }} />
          </div>
          <div className="text-xs font-semibold" style={{ color: "rgba(11,30,63,0.66)" }}>
            Drop file or{" "}
            <span style={{ color: GOLD }}>browse</span>
          </div>
          {hint && <div className="text-[10px]" style={{ color: "rgba(11,30,63,0.50)" }}>{hint}</div>}
        </button>
      )}

      {state === "uploading" && (
        <div
          className="w-full rounded-xl flex flex-col items-center justify-center gap-3 py-8 px-4"
          style={{ border: `1.5px solid ${GOLD}25`, backgroundColor: `${GOLD}06` }}
        >
          <Loader2 size={20} className="animate-spin" style={{ color: GOLD }} />
          <div className="w-full max-w-[200px]">
            <div className="flex justify-between text-[10px] mb-1.5" style={{ color: "rgba(11,30,63,0.58)" }}>
              <span>Scanning document…</span>
              <span>{progress}%</span>
            </div>
            <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: "var(--erp-canvas)" }}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${progress}%`, backgroundColor: GOLD }}
              />
            </div>
          </div>
          <div className="text-[10px]" style={{ color: "rgba(11,30,63,0.50)" }}>OCR extraction in progress</div>
        </div>
      )}

      {state === "done" && (
        <div
          className="w-full rounded-xl px-4 py-4"
          style={{ border: `1.5px solid ${GREEN}35`, backgroundColor: `${GREEN}08` }}
        >
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle size={15} className="shrink-0" style={{ color: GREEN }} />
            <span className="text-xs font-bold shrink-0" style={{ color: GREEN }}>Document accepted</span>
            {/* The "OCR Complete" badge only appears when there are extracted fields
                backing it — a real upload runs no OCR, so it must not claim one. */}
            {extracted && extracted.length > 0 ? (
              <span
                className="ml-auto text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0"
                style={{ backgroundColor: `${GOLD}15`, color: GOLD, border: `1px solid ${GOLD}30` }}
              >
                <ScanLine size={9} /> OCR Complete
              </span>
            ) : fileName ? (
              <span
                className="ml-auto text-[10px] min-w-0 truncate"
                style={{ color: "rgba(11,30,63,0.58)" }}
                title={fileName}
              >
                {fileName}
              </span>
            ) : null}
          </div>
          {extracted && extracted.length > 0 && (
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
              {extracted.map((f) => (
                <div key={f.key} className="min-w-0">
                  <div className="text-[9px] uppercase tracking-widest mb-0.5" style={{ color: "rgba(11,30,63,0.50)" }}>{f.key}</div>
                  <div className="text-xs font-semibold truncate" style={{ color: GOLD }} title={f.value}>{f.value}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {uploadError && (
        <div className="mt-2 p-3 rounded-xl text-xs" style={{ backgroundColor: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", color: "var(--erp-destructive)" }}>
          {uploadError}
        </div>
      )}
    </div>
  );
}

// ─── OcrInput ────────────────────────────────────────────────────────────────

interface OcrInputProps {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  ocr?: boolean;
  placeholder?: string;
  type?: string;
}

function OcrInput({ label, value, onChange, ocr = false, placeholder, type = "text" }: OcrInputProps) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <label className="text-xs font-semibold" style={{ color: "rgba(11,30,63,0.76)" }}>{label}</label>
        {ocr && (
          <span
            className="text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full flex items-center gap-1"
            style={{ backgroundColor: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}30` }}
          >
            <ScanLine size={7} /> OCR
          </span>
        )}
      </div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3.5 py-2.5 text-sm rounded-xl focus:outline-none transition"
        style={{
          backgroundColor: ocr ? `${GOLD}0A` : "var(--erp-surface-soft)",
          border: `1px solid ${ocr ? `${GOLD}40` : "rgba(11,30,63,0.15)"}`,
          color: ocr ? GOLD : "var(--erp-text-strong)",
          borderLeft: ocr ? `3px solid ${GOLD}` : undefined,
          fontFamily: "var(--font-sans)",
        }}
        readOnly={ocr}
      />
    </div>
  );
}

// ─── WizNav ──────────────────────────────────────────────────────────────────

interface WizNavProps {
  step: number;
  maxStep: number;
  onBack: () => void;
  onNext: () => void;
  nextLabel?: string;
  loading?: boolean;
}

function WizNav({ step, maxStep, onBack, onNext, nextLabel = "Continue", loading = false }: WizNavProps) {
  return (
    <div className="flex items-center justify-between pt-6 mt-6" style={{ borderTop: "1px solid rgba(11,30,63,0.11)" }}>
      <button
        type="button"
        onClick={onBack}
        disabled={step === 1}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-30"
        style={{ border: "1px solid rgba(11,30,63,0.15)", color: "rgba(11,30,63,0.76)" }}
      >
        <ChevronLeft size={14} /> Back
      </button>
      <span className="text-xs font-mono" style={{ color: "rgba(11,30,63,0.50)", fontFamily: "var(--font-mono)" }}>
        {step} / {maxStep}
      </span>
      <button
        type="button"
        onClick={onNext}
        disabled={loading}
        className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-60"
        style={{ backgroundColor: GOLD, color: NAVY }}
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : null}
        {nextLabel} <ArrowRight size={14} />
      </button>
    </div>
  );
}

// ─── ReviewCard ───────────────────────────────────────────────────────────────

function ReviewCard({ title, rows }: { title: string; rows: { label: string; value: string; ok?: boolean }[] }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(11,30,63,0.11)" }}>
      <div className="px-4 py-2.5 text-xs font-bold uppercase tracking-widest" style={{ backgroundColor: `${GOLD}10`, color: GOLD }}>
        {title}
      </div>
      <div className="divide-y" style={{ borderColor: "rgba(11,30,63,0.08)" }}>
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <span className="text-xs shrink-0" style={{ color: "rgba(11,30,63,0.66)" }}>{r.label}</span>
            {/* Entered company / owner / guarantor names run long — truncate with the
                full value on hover rather than letting the row blow out. */}
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs font-semibold truncate" style={{ color: "var(--erp-text-strong)" }} title={r.value}>{r.value}</span>
              {r.ok !== undefined && (
                r.ok
                  ? <CheckCircle size={12} className="shrink-0" style={{ color: GREEN }} />
                  : <AlertCircle size={12} className="shrink-0" style={{ color: "var(--erp-warning)" }} />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Dropzone Component Reference (3 states side by side) ───────────────────

function DropzoneShowcase() {
  const [uploadProg, setUploadProg] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setUploadProg((p) => (p >= 85 ? 85 : p + 3)), 120);
    return () => clearInterval(t);
  }, []);

  const TL_FIELDS = [
    { key: "Company Name", value: "Rashidi Travel Co. LLC" },
    { key: "CR Number", value: "CR-1446-00923" },
    { key: "Issue Date", value: "01 Muharram 1443H" },
    { key: "Expiry Date", value: "30 Dhul Hijja 1446H" },
  ];

  return (
    <div className="mb-10 rounded-xl overflow-hidden" style={{ border: `1px solid ${GOLD}20`, backgroundColor: `${GOLD}04` }}>
      <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: `1px solid ${GOLD}15`, backgroundColor: `${GOLD}08` }}>
        <ScanLine size={13} style={{ color: GOLD }} />
        <span className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: GOLD }}>
          File Dropzone — Component Reference (3 States)
        </span>
      </div>
      <div className="grid grid-cols-3 gap-4 p-5">
        {/* Empty */}
        <div>
          <div className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: "rgba(11,30,63,0.50)" }}>
            State: Empty
          </div>
          <div
            className="w-full rounded-xl flex flex-col items-center justify-center gap-2 py-8 px-4"
            style={{ border: `1.5px dashed ${GOLD}35`, backgroundColor: `${GOLD}05` }}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${GOLD}15` }}>
              <Upload size={18} style={{ color: GOLD }} />
            </div>
            <div className="text-xs font-semibold text-center" style={{ color: "rgba(11,30,63,0.66)" }}>
              Drop file or <span style={{ color: GOLD }}>browse</span>
            </div>
            <div className="text-[10px]" style={{ color: "rgba(11,30,63,0.38)" }}>PDF, JPG, PNG — max 10 MB</div>
          </div>
        </div>

        {/* Uploading */}
        <div>
          <div className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: "rgba(11,30,63,0.50)" }}>
            State: Uploading / OCR Scan
          </div>
          <div
            className="w-full rounded-xl flex flex-col items-center justify-center gap-3 py-8 px-4"
            style={{ border: `1.5px solid ${GOLD}25`, backgroundColor: `${GOLD}06` }}
          >
            <Loader2 size={20} className="animate-spin" style={{ color: GOLD }} />
            <div className="w-full">
              <div className="flex justify-between text-[10px] mb-1.5" style={{ color: "rgba(11,30,63,0.58)" }}>
                <span>Extracting fields…</span>
                <span>{uploadProg}%</span>
              </div>
              <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: "var(--erp-canvas)" }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${uploadProg}%`, backgroundColor: GOLD }}
                />
              </div>
            </div>
            <div className="text-[10px]" style={{ color: "rgba(11,30,63,0.38)" }}>OCR extraction in progress</div>
          </div>
        </div>

        {/* Done / OCR Success */}
        <div>
          <div className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: "rgba(11,30,63,0.50)" }}>
            State: OCR Scanned — Success
          </div>
          <div
            className="w-full rounded-xl px-4 py-4"
            style={{ border: `1.5px solid ${GREEN}40`, backgroundColor: `${GREEN}08` }}
          >
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle size={14} style={{ color: GREEN }} />
              <span className="text-xs font-bold" style={{ color: GREEN }}>Document accepted</span>
              <span
                className="ml-auto text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full flex items-center gap-1"
                style={{ backgroundColor: `${GOLD}15`, color: GOLD, border: `1px solid ${GOLD}30` }}
              >
                <ScanLine size={8} /> OCR
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {TL_FIELDS.map((f) => (
                <div key={f.key}>
                  <div className="text-[8px] uppercase tracking-widest mb-0.5" style={{ color: "rgba(11,30,63,0.50)" }}>{f.key}</div>
                  <div className="text-[10px] font-semibold" style={{ color: GOLD }}>{f.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1 — Login
// ═══════════════════════════════════════════════════════════════════════════════

const LOGIN_TABS = [
  { id: "agent",    label: "Agent",    bn: "এজেন্ট",  desc: "Travel agency & group operator access" },
  { id: "supplier", label: "Supplier", bn: "সরবরাহকারী", desc: "Hotel, transport & catering partners" },
  { id: "admin",    label: "Admin",    bn: "অ্যাডমিন",  desc: "Internal TUBA AL HIJAZ operations" },
];

const PORTAL_ROUTES: Record<string, string> = {
  agent: "/agent-portal",
  supplier: "/supplier-portal",
  admin: "/super-admin",
};

// (prototype LoginSection removed — the single real login lives at /login)

const AGENT_STEPS = [
  { num: 1, label: "Documents" },
  { num: 2, label: "Profile" },
  { num: 3, label: "Finance" },
  { num: 4, label: "Guarantors" },
  { num: 5, label: "Review" },
];

function AgentRegSection() {
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);

  // Step 1
  const [tlState, setTlState] = useState<DZState>("empty");
  const [passState, setPassState] = useState<DZState>("empty");

  // Step 2
  const [officePhotoState, setOfficePhotoState] = useState<DZState>("empty");
  const [logoState, setLogoState] = useState<DZState>("empty");
  const [website, setWebsite] = useState("");
  const [bizEmail, setBizEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [crNumber, setCrNumber] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerId, setOwnerId] = useState("");

  // Step 3
  const [chequeState, setChequeState] = useState<DZState>("empty");
  const [depositState, setDepositState] = useState<DZState>("empty");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [iban, setIban] = useState("");

  // Step 4
  const [guarantors, setGuarantors] = useState([
    { name: "", nid: "", phone: "" },
    { name: "", nid: "", phone: "" },
  ]);
  const setG = (i: number, k: "name" | "nid" | "phone", v: string) =>
    setGuarantors((g) => g.map((row, idx) => (idx === i ? { ...row, [k]: v } : row)));
  const [refAgency, setRefAgency] = useState("");
  const [refCode, setRefCode] = useState("");

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [result, setResult] = useState<RegistrationResult | null>(null);

  // Real uploaded document ids (from POST /uploads), keyed by slot
  const [fileIds, setFileIds] = useState<Record<string, string>>({});
  const uploadFor =
    (slot: string, kind: Parameters<typeof api.uploadFile>[1]) => async (file: File) => {
      const r = await api.uploadFile(file, kind);
      setFileIds((f) => ({ ...f, [slot]: r.documentId }));
    };

  const tlDone = tlState === "done";
  const passDone = passState === "done";

  // NOTE: no OCR auto-fill. The upload endpoint returns no extracted fields, so
  // pre-filling these would inject demo values ("Rashidi Travel Co. LLC") into a
  // real registration the applicant cannot correct. Fields stay user-entered
  // until a real extraction API exists.

  const handleNext = async () => {
    if (step < 5) { setStep((s) => Math.min(s + 1, 5)); return; }
    // Step 5 → real submission
    setSubmitError("");
    if (!companyName || !ownerName) {
      setSubmitError("Company Name and Owner Full Name are required — upload documents in Step 1 or type them in Step 2.");
      return;
    }
    if (!bizEmail) {
      setSubmitError("Business Email (Step 2) is required — it becomes your portal login.");
      return;
    }
    setSubmitting(true);
    try {
      const g1 = guarantors[0];
      const g2 = guarantors[1];
      const res = await api.registerAgent({
        companyName,
        crNumber: crNumber || undefined,
        ownerName,
        ownerIdNumber: ownerId || undefined,
        businessEmail: bizEmail,
        website: website || undefined,
        bankName: bankName || undefined,
        accountNumber: accountNumber || undefined,
        iban: iban || undefined,
        guarantor1: g1.name && g1.nid ? { name: g1.name, nationalId: g1.nid, phone: g1.phone || undefined } : undefined,
        guarantor2: g2.name && g2.nid ? { name: g2.name, nationalId: g2.nid, phone: g2.phone || undefined } : undefined,
        referenceAgencyName: refAgency || undefined,
        referenceAgentCode: refCode || undefined,
        tradeLicenseFileId: fileIds.tl,
        ownerIdFileId: fileIds.ownerId,
        officePhotoFileIds: fileIds.office ? [fileIds.office] : undefined,
        logoFileId: fileIds.logo,
        chequeFileId: fileIds.cheque,
        depositFileId: fileIds.deposit,
      });
      setResult(res);
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Cannot reach the TUBA server — please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div>
        <div className="mb-8">
          <div className="text-xs font-bold uppercase tracking-[0.18em] mb-1" style={{ color: GOLD }}>Section 02</div>
          <h2 className="text-2xl font-bold text-[var(--erp-text-strong)]">Agent Registration</h2>
        </div>
        <div className="rounded-xl p-12 flex flex-col items-center text-center" style={{ border: `1px solid ${GREEN}30`, backgroundColor: `${GREEN}06` }}>
          <div className="w-16 h-16 rounded-xl flex items-center justify-center mb-5" style={{ backgroundColor: `${GREEN}15`, border: `1px solid ${GREEN}30` }}>
            <CheckCircle size={28} style={{ color: GREEN }} />
          </div>
          <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: GREEN }}>Application Submitted</div>
          <h3 className="text-2xl font-bold text-[var(--erp-text-strong)] mb-3">Verification Status: Pending</h3>
          <p className="text-sm max-w-sm mb-6" style={{ color: "rgba(11,30,63,0.66)" }}>
            Your agent registration has been received and is now under review by our compliance team. Expected response within 3–5 business days.
          </p>
          <div className="px-5 py-3 rounded-xl mb-8" style={{ backgroundColor: `${GOLD}10`, border: `1px solid ${GOLD}25` }}>
            <span className="text-xs" style={{ color: "rgba(11,30,63,0.58)" }}>Application ID: </span>
            <span className="text-sm font-bold" style={{ color: GOLD, fontFamily: "var(--font-mono)" }}>{result?.applicationCode ?? "—"}</span>
            {result?.tempPassword && (
              <div className="mt-1.5 pt-1.5" style={{ borderTop: `1px solid ${GOLD}20` }}>
                <span className="text-xs" style={{ color: "rgba(11,30,63,0.58)" }}>Temporary Password: </span>
                <span className="text-sm font-bold" style={{ color: GOLD, fontFamily: "var(--font-mono)" }}>{result.tempPassword}</span>
              </div>
            )}
          </div>
          <button
            onClick={() => { setSubmitted(false); setStep(1); setTlState("empty"); setPassState("empty"); setResult(null); }}
            className="text-xs flex items-center gap-1.5"
            style={{ color: "rgba(11,30,63,0.58)" }}
          >
            <RotateCcw size={11} /> Start new application
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <div className="text-xs font-bold uppercase tracking-[0.18em] mb-1" style={{ color: GOLD }}>Section 02</div>
        <h2 className="text-2xl font-bold text-[var(--erp-text-strong)]">Agent Registration</h2>
        <p className="text-sm mt-1" style={{ color: "rgba(11,30,63,0.58)" }}>5-step wizard · OCR document scanning · Inline validation</p>
      </div>

      {/* Dropzone showcase — only on step 1 */}
      {/* DropzoneShowcase removed for live launch: it showed fabricated OCR extraction (sample "Rashidi Travel Co. LLC") to real applicants */}

      <div className="rounded-xl p-8" style={{ border: "1px solid rgba(11,30,63,0.11)", backgroundColor: "var(--erp-surface)" }}>
        <StepBar steps={AGENT_STEPS} current={step} />

        {/* Step 1 — Documents */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-bold text-[var(--erp-text-strong)] mb-1">Business Documents</h3>
              <p className="text-xs" style={{ color: "rgba(11,30,63,0.58)" }}>
                Upload your Trade License and owner identity. Our OCR engine auto-extracts fields for the next step.
              </p>
            </div>
            <FileDropzone
              state={tlState}
              onChange={setTlState}
              onFile={uploadFor("tl", "TRADE_LICENSE")}
              label="Trade License (CR)"
              hint="PDF or clear photo — max 10 MB"
            />
            <FileDropzone
              state={passState}
              onChange={setPassState}
              onFile={uploadFor("ownerId", "OWNER_ID")}
              label="Owner NID / Passport"
              hint="Saudi NID or international passport scan"
            />
          </div>
        )}

        {/* Step 2 — Owner Profile */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-bold text-[var(--erp-text-strong)] mb-1">Owner Profile & Office</h3>
              <p className="text-xs" style={{ color: "rgba(11,30,63,0.58)" }}>
                {tlDone || passDone
                  ? "Your documents are attached. Confirm your company profile details below."
                  : "Complete your company profile details."}
              </p>
            </div>
            {/* `ocr` is deliberately not set: it renders the field read-only, which
                would lock the applicant out of correcting a value no OCR produced. */}
            <div className="grid grid-cols-2 gap-4">
              <OcrInput label="Company Name" value={companyName} onChange={setCompanyName} placeholder="Your company name" />
              <OcrInput label="CR Number" value={crNumber} onChange={setCrNumber} placeholder="Commercial registration no." />
              <OcrInput label="Owner Full Name" value={ownerName} onChange={setOwnerName} placeholder="As per ID / Passport" />
              <OcrInput label="Owner ID / Passport No." value={ownerId} onChange={setOwnerId} placeholder="National ID or passport number" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <OcrInput label="Business Email" value={bizEmail} onChange={setBizEmail} placeholder="contact@yourcompany.com" type="email" />
              <OcrInput label="Company Website" value={website} onChange={setWebsite} placeholder="https://yourcompany.com" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FileDropzone state={officePhotoState} onChange={setOfficePhotoState} onFile={uploadFor("office", "OFFICE_PHOTO")} label="Office Photos (min. 2)" hint="Interior + exterior shots" />
              <FileDropzone state={logoState} onChange={setLogoState} onFile={uploadFor("logo", "COMPANY_LOGO")} label="Company Logo" hint="PNG or SVG — transparent bg preferred" />
            </div>
          </div>
        )}

        {/* Step 3 — Finance */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-bold text-[var(--erp-text-strong)] mb-1">Finance & Banking</h3>
              <p className="text-xs" style={{ color: "rgba(11,30,63,0.58)" }}>Bank account details, signed cheque, and security deposit documentation.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <OcrInput label="Bank Name" value={bankName} onChange={setBankName} placeholder="e.g. Al Rajhi Bank" />
              <OcrInput label="Account Number" value={accountNumber} onChange={setAccountNumber} placeholder="14-digit account number" />
              <div className="col-span-2">
                <OcrInput label="IBAN" value={iban} onChange={setIban} placeholder="SA00 0000 0000 0000 0000 0000" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FileDropzone
                state={chequeState}
                onChange={setChequeState}
                onFile={uploadFor("cheque", "SIGNED_CHEQUE")}
                label="Signed Cheque"
                hint="Clear scan of signed/stamped cheque"
              />
              <FileDropzone
                state={depositState}
                onChange={setDepositState}
                onFile={uploadFor("deposit", "DEPOSIT_PROOF")}
                label="Security Deposit Proof"
                hint="Bank transfer receipt or bank certificate"
              />
            </div>
          </div>
        )}

        {/* Step 4 — Guarantors */}
        {step === 4 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-bold text-[var(--erp-text-strong)] mb-1">Guarantors & Reference Agent</h3>
              <p className="text-xs" style={{ color: "rgba(11,30,63,0.58)" }}>Two personal guarantors and one reference travel agent who already operates on TUBA AL HIJAZ.</p>
            </div>

            {[1, 2].map((n) => (
              <div key={n} className="rounded-xl p-5" style={{ border: "1px solid rgba(11,30,63,0.11)", backgroundColor: "var(--erp-surface)" }}>
                <div className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: GOLD }}>Guarantor {n}</div>
                <div className="grid grid-cols-3 gap-4">
                  <OcrInput label="Full Name" value={guarantors[n - 1].name} onChange={(v) => setG(n - 1, "name", v)} placeholder="Guarantor full name" />
                  <OcrInput label="National ID" value={guarantors[n - 1].nid} onChange={(v) => setG(n - 1, "nid", v)} placeholder="10-digit NID" />
                  <OcrInput label="Phone Number" value={guarantors[n - 1].phone} onChange={(v) => setG(n - 1, "phone", v)} placeholder="+966 5X XXX XXXX" />
                </div>
              </div>
            ))}

            <div className="rounded-xl p-5" style={{ border: `1px solid ${GOLD}20`, backgroundColor: `${GOLD}05` }}>
              <div className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: GOLD }}>Reference Agent</div>
              <div className="grid grid-cols-2 gap-4">
                <OcrInput label="Agency Name" value={refAgency} onChange={setRefAgency} placeholder="Existing agency on platform" />
                <OcrInput label="Agent Code" value={refCode} onChange={setRefCode} placeholder="e.g. AGT-1446-XXXX" />
              </div>
            </div>
          </div>
        )}

        {/* Step 5 — Review */}
        {step === 5 && (
          <div className="space-y-5">
            <div>
              <h3 className="text-base font-bold text-[var(--erp-text-strong)] mb-1">Review & Submit</h3>
              <p className="text-xs" style={{ color: "rgba(11,30,63,0.58)" }}>Verify all information before final submission. Once submitted, your application enters compliance review.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <ReviewCard
                title="Business Documents"
                rows={[
                  { label: "Trade License", value: tlDone ? "Uploaded" : "Not uploaded", ok: tlDone },
                  { label: "Owner NID / Passport", value: passDone ? "Uploaded" : "Not uploaded", ok: passDone },
                ]}
              />
              <ReviewCard
                title="Company Profile"
                rows={[
                  { label: "Company Name", value: companyName || "—", ok: !!companyName },
                  { label: "CR Number", value: crNumber || "—", ok: !!crNumber },
                  { label: "Business Email", value: bizEmail || "—", ok: !!bizEmail },
                  { label: "Website", value: website || "—", ok: !!website },
                ]}
              />
              <ReviewCard
                title="Banking"
                rows={[
                  { label: "Bank", value: bankName || "—", ok: !!bankName },
                  { label: "IBAN", value: iban || "—", ok: !!iban },
                  { label: "Signed Cheque", value: chequeState === "done" ? "Uploaded" : "Pending", ok: chequeState === "done" },
                  { label: "Security Deposit", value: depositState === "done" ? "Uploaded" : "Pending", ok: depositState === "done" },
                ]}
              />
              <ReviewCard
                title="Guarantors"
                rows={[
                  { label: "Guarantor 1", value: guarantors[0].name || "—", ok: !!(guarantors[0].name && guarantors[0].nid) },
                  { label: "Guarantor 2", value: guarantors[1].name || "—", ok: !!(guarantors[1].name && guarantors[1].nid) },
                  { label: "Reference Agent", value: refCode || refAgency || "—", ok: !!(refCode || refAgency) },
                ]}
              />
            </div>
            <div className="p-4 rounded-xl text-xs" style={{ backgroundColor: `${GOLD}08`, border: `1px solid ${GOLD}20` }}>
              <span style={{ color: GOLD }} className="font-semibold">Declaration: </span>
              <span style={{ color: "rgba(11,30,63,0.66)" }}>
                I confirm that all information provided is accurate and complete. I understand that false information may result in application rejection and legal action.
              </span>
            </div>
          </div>
        )}

        {submitError && (
          <div className="mt-5 p-3 rounded-xl text-xs" style={{ backgroundColor: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", color: "var(--erp-destructive)" }}>
            {submitError}
          </div>
        )}
        <WizNav
          step={step}
          maxStep={5}
          onBack={() => setStep((s) => Math.max(s - 1, 1))}
          onNext={handleNext}
          nextLabel={step === 5 ? "Submit Application" : "Continue"}
          loading={submitting}
        />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3 — Verification Status
// ═══════════════════════════════════════════════════════════════════════════════

const VERIFICATION_STATES = [
  {
    id: "pending",
    label: "Pending",
    color: "var(--erp-warning)",
    icon: Clock,
    appId: "AGT-1446-4827",
    submitted: "14 Jul 2025",
    desc: "Your application has been received and is queued for initial review.",
    timeline: [
      { label: "Application Submitted", done: true, date: "14 Jul 2025" },
      { label: "Initial Review", done: false, date: "Awaiting" },
      { label: "Document Verification", done: false, date: "Pending" },
      { label: "Compliance Approval", done: false, date: "Pending" },
    ],
  },
  {
    id: "review",
    label: "Under Review",
    color: "var(--erp-info)",
    icon: ScanLine,
    appId: "AGT-1446-3201",
    submitted: "09 Jul 2025",
    desc: "A compliance officer is currently reviewing your documents. You may be contacted for clarification.",
    timeline: [
      { label: "Application Submitted", done: true, date: "09 Jul 2025" },
      { label: "Initial Review", done: true, date: "11 Jul 2025" },
      { label: "Document Verification", done: false, current: true, date: "In Progress" },
      { label: "Compliance Approval", done: false, date: "Pending" },
    ],
  },
  {
    id: "verified",
    label: "Verified",
    color: GREEN,
    icon: BadgeCheck,
    appId: "AGT-1446-2844",
    submitted: "01 Jul 2025",
    desc: "Your registration is fully approved. Portal access has been activated.",
    timeline: [
      { label: "Application Submitted", done: true, date: "01 Jul 2025" },
      { label: "Initial Review", done: true, date: "03 Jul 2025" },
      { label: "Document Verification", done: true, date: "05 Jul 2025" },
      { label: "Compliance Approval", done: true, date: "07 Jul 2025" },
    ],
  },
  {
    id: "rejected",
    label: "Rejected",
    color: "var(--erp-destructive)",
    icon: XCircle,
    appId: "AGT-1446-1988",
    submitted: "27 Jun 2025",
    desc: "Your application was not approved. See the reason below and re-submit with corrections.",
    reason: "Trade License appears to be expired (Expiry: 30 Dhul Hijja 1445H). Please upload a valid, current license and resubmit.",
    timeline: [
      { label: "Application Submitted", done: true, date: "27 Jun 2025" },
      { label: "Initial Review", done: true, date: "29 Jun 2025" },
      { label: "Document Verification", done: false, rejected: true, date: "02 Jul 2025" },
      { label: "Compliance Approval", done: false, date: "—" },
    ],
  },
];

function VerificationSection() {
  const [active, setActive] = useState("pending");
  // Live status: when a company user is signed in, reflect their REAL
  // verification state (from /auth/me) in the tracker instead of the demo data.
  const [live, setLive] = useState<null | {
    status: string;
    appId: string;
    submitted: string;
    reason?: string;
    email?: string;
  }>(null);
  // Signed in but /auth/me failed → say so. Otherwise the tracker keeps showing
  // the demo preview and a real applicant reads it as their own status.
  const [liveError, setLiveError] = useState("");

  useEffect(() => {
    if (!isLoggedIn()) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      api
        .me()
        .then((u) => {
          if (cancelled || !u.company) return;
          const map: Record<string, string> = {
            PENDING: "pending",
            UNDER_REVIEW: "review",
            VERIFIED: "verified",
            REJECTED: "rejected",
            SUSPENDED: "rejected",
          };
          const id = map[u.company.verificationStatus] ?? "pending";
          setActive(id);
          setLive({
            status: id,
            appId: u.company.code,
            submitted: new Date(u.company.joinedAt).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            }),
            reason: u.company.rejectionReason ?? undefined,
            email: u.email,
          });
        })
        .catch((err) => {
          if (cancelled) return;
          setLiveError(
            err instanceof ApiError && err.status === 401
              ? "Your session has expired — sign in again to see your live application status."
              : "Could not load your live application status. The cards below are a preview only.",
          );
        });
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  const base = VERIFICATION_STATES.find((v) => v.id === active)!;
  const isLive = live !== null && live.status === active;
  const current = isLive
    ? { ...base, appId: live.appId, submitted: live.submitted, reason: live.reason ?? (base as { reason?: string }).reason }
    : base;

  return (
    <div>
      <div className="mb-8">
        <div className="text-xs font-bold uppercase tracking-[0.18em] mb-1" style={{ color: GOLD }}>Section 03</div>
        <h2 className="text-2xl font-bold text-[var(--erp-text-strong)]">Verification Status Tracker</h2>
        <p className="text-sm mt-1" style={{ color: "rgba(11,30,63,0.58)" }}>
          Click a card to preview each status state — Pending / Under Review / Verified / Rejected
        </p>
        {liveError && (
          <div className="mt-4 p-3 rounded-xl text-xs" style={{ backgroundColor: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", color: "var(--erp-destructive)" }}>
            {liveError}
          </div>
        )}
      </div>

      {/* 4-state selector grid */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {VERIFICATION_STATES.map((v) => {
          const Icon = v.icon;
          const isActive = v.id === active;
          return (
            <button
              key={v.id}
              onClick={() => setActive(v.id)}
              className="rounded-xl p-4 text-left transition-all"
              style={{
                border: `1px solid ${isActive ? v.color : "rgba(11,30,63,0.38)"}`,
                backgroundColor: isActive ? `${v.color}12` : "rgba(11,30,63,0.38)",
              }}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3" style={{ backgroundColor: `${v.color}18` }}>
                <Icon size={15} style={{ color: v.color }} />
              </div>
              <div className="text-xs font-bold" style={{ color: isActive ? v.color : "rgba(11,30,63,0.66)" }}>
                {v.label}
              </div>
              <div className="text-[9px] mt-0.5 font-mono" style={{ color: "rgba(11,30,63,0.50)", fontFamily: "var(--font-mono)" }}>
                {v.appId}
              </div>
            </button>
          );
        })}
      </div>

      {/* Detail panel */}
      <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${current.color}30` }}>
        {/* Header */}
        <div
          className="px-6 py-4 flex items-center gap-4"
          style={{ backgroundColor: `${current.color}10`, borderBottom: `1px solid ${current.color}20` }}
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${current.color}20` }}>
            <current.icon size={18} style={{ color: current.color }} />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-widest mb-0.5" style={{ color: current.color }}>{current.label}</div>
            <div className="text-sm font-semibold text-[var(--erp-text-strong)]">{current.desc}</div>
          </div>
          <div className="ml-auto text-right">
            <div className="text-[9px] uppercase tracking-widest mb-0.5" style={{ color: "rgba(11,30,63,0.50)" }}>Application ID</div>
            <div className="text-sm font-bold" style={{ color: GOLD, fontFamily: "var(--font-mono)" }}>{current.appId}</div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 grid grid-cols-2 gap-6" style={{ backgroundColor: "var(--erp-surface)" }}>
          {/* Timeline */}
          <div>
            <div className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "rgba(11,30,63,0.50)" }}>Timeline</div>
            <div className="space-y-0">
              {current.timeline.map((t, i) => {
                const isLast = i === current.timeline.length - 1;
                const tl = t as typeof t & { current?: boolean; rejected?: boolean };
                return (
                  <div key={t.label} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                        style={{
                          backgroundColor: t.done
                            ? `${current.color}25`
                            : tl.rejected
                            ? "#EF444420"
                            : tl.current
                            ? `${current.color}15`
                            : "rgba(11,30,63,0.38)",
                          border: `1.5px solid ${t.done ? current.color : tl.rejected ? "var(--erp-destructive)" : tl.current ? current.color : "rgba(11,30,63,0.38)"}`,
                        }}
                      >
                        {t.done ? (
                          <CheckCircle size={11} style={{ color: current.color }} />
                        ) : tl.rejected ? (
                          <XCircle size={11} style={{ color: "var(--erp-destructive)" }} />
                        ) : tl.current ? (
                          <Loader2 size={10} className="animate-spin" style={{ color: current.color }} />
                        ) : (
                          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "var(--erp-border)" }} />
                        )}
                      </div>
                      {!isLast && (
                        <div className="w-px flex-1 my-1" style={{ backgroundColor: t.done ? `${current.color}30` : "rgba(11,30,63,0.38)", minHeight: 20 }} />
                      )}
                    </div>
                    <div className="pb-4">
                      <div className="text-xs font-semibold" style={{ color: t.done || tl.current ? "var(--erp-text-strong)" : "rgba(11,30,63,0.58)" }}>
                        {t.label}
                      </div>
                      <div className="text-[10px]" style={{ color: "rgba(11,30,63,0.50)", fontFamily: "var(--font-mono)" }}>
                        {t.date}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right panel */}
          <div className="space-y-4">
            {active === "rejected" && current.reason && (
              <div className="rounded-xl p-4" style={{ backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle size={13} style={{ color: "var(--erp-destructive)" }} />
                  <span className="text-xs font-bold" style={{ color: "var(--erp-destructive)" }}>Rejection Reason</span>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: "rgba(11,30,63,0.76)" }}>{current.reason}</p>
              </div>
            )}

            {active === "rejected" && (
              <div className="space-y-2">
                <button className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold" style={{ backgroundColor: GOLD, color: NAVY }}>
                  <RotateCcw size={13} /> Re-submit Application
                </button>
                <button className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold" style={{ border: "1px solid rgba(11,30,63,0.15)", color: "rgba(11,30,63,0.76)" }}>
                  <Phone size={12} /> Contact Support
                </button>
              </div>
            )}

            {active === "verified" && (
              <div className="rounded-xl p-5" style={{ backgroundColor: `${GREEN}08`, border: `1px solid ${GREEN}30` }}>
                <div className="flex items-center gap-2 mb-3">
                  <BadgeCheck size={16} style={{ color: GREEN }} />
                  <span className="text-sm font-bold" style={{ color: GREEN }}>Portal Access Activated</span>
                </div>
                <p className="text-xs mb-4" style={{ color: "rgba(11,30,63,0.58)" }}>
                  Your TUBA AL HIJAZ agent portal is now fully active. Sign in to begin managing your pilgrim groups.
                </p>
                <Link
                  to="/login"
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold"
                  style={{ backgroundColor: GREEN, color: "var(--erp-text-strong)" }}
                >
                  <LogIn size={13} /> Go to Agent Portal
                </Link>
              </div>
            )}

            {(active === "pending" || active === "review") && (
              <div className="space-y-3">
                <div className="rounded-xl p-4" style={{ backgroundColor: "var(--erp-surface-soft)", border: "1px solid rgba(11,30,63,0.11)" }}>
                  <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(11,30,63,0.50)" }}>What Happens Next</div>
                  <div className="space-y-2 text-xs" style={{ color: "rgba(11,30,63,0.66)" }}>
                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: GOLD }} />
                      Our team reviews your documents within 3–5 business days.
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: GOLD }} />
                      You will receive an email at each stage transition.
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: GOLD }} />
                      If additional documents are needed, we will contact you directly.
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs px-3 py-2.5 rounded-xl" style={{ backgroundColor: "var(--erp-surface)", border: "1px solid rgba(11,30,63,0.11)" }}>
                  <Mail size={12} className="shrink-0" style={{ color: "rgba(11,30,63,0.50)" }} />
                  <span className="shrink-0" style={{ color: "rgba(11,30,63,0.58)" }}>Notifications sent to: </span>
                  {(() => {
                    const to = isLive && live?.email ? live.email : "ahmad@rashidi-travel.com";
                    return <span className="min-w-0 truncate" style={{ color: GOLD }} title={to}>{to}</span>;
                  })()}
                </div>
              </div>
            )}

            <div className="text-[10px] pt-2" style={{ color: "rgba(11,30,63,0.38)" }}>
              Submitted {current.submitted} · Application ID: <span style={{ fontFamily: "var(--font-mono)" }}>{current.appId}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4 — Supplier Registration
// ═══════════════════════════════════════════════════════════════════════════════

const SUPPLIER_TYPES = [
  {
    id: "hotel",
    label: "Hotel",
    ar: "فندق",
    icon: Building,
    color: "var(--erp-info)",
    desc: "Accommodation provider near the Haram",
    extra: [
      { label: "Star Rating", placeholder: "e.g. 4-star, 5-star" },
      { label: "Location / District", placeholder: "e.g. Ajyad, Al Noor, Abraj" },
    ],
    certLabel: "Hotel Classification Certificate",
    certHint: "Ministry of Tourism star classification certificate",
  },
  {
    id: "transport",
    label: "Transport",
    ar: "نقل",
    icon: Bus,
    color: "var(--erp-cat-orange)",
    desc: "Bus, van, or private car fleet operator",
    extra: [
      { label: "Fleet Size (vehicles)", placeholder: "e.g. 25" },
      { label: "Primary Vehicle Type", placeholder: "e.g. Coach, Minibus, Sedan" },
    ],
    certLabel: "Transport Operating License",
    certHint: "Ministry of Transport commercial license",
  },
  {
    id: "catering",
    label: "Catering",
    ar: "تموين",
    icon: UtensilsCrossed,
    color: "var(--erp-cat-purple)",
    desc: "Halal-certified meal preparation & delivery",
    extra: [
      { label: "Daily Capacity (meals/day)", placeholder: "e.g. 2,000" },
      { label: "Halal Certification Body", placeholder: "e.g. SFDA, GCC Halal Center" },
    ],
    certLabel: "Halal Certification",
    certHint: "Valid halal certification from an approved body",
  },
];

const SUP_STEPS = [
  { num: 1, label: "Company Info" },
  { num: 2, label: "Documents" },
];

function SupplierRegSection() {
  const [supType, setSupType] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [tlState, setTlState] = useState<DZState>("empty");
  const [certState, setCertState] = useState<DZState>("empty");

  // Company info fields (Step 1)
  const [companyName, setCompanyName] = useState("");
  const [crNumber, setCrNumber] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [bizEmail, setBizEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [extraVals, setExtraVals] = useState<string[]>(["", ""]);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [result, setResult] = useState<RegistrationResult | null>(null);
  const [fileIds, setFileIds] = useState<Record<string, string>>({});
  const uploadFor =
    (slot: string, kind: Parameters<typeof api.uploadFile>[1]) => async (file: File) => {
      const r = await api.uploadFile(file, kind);
      setFileIds((f) => ({ ...f, [slot]: r.documentId }));
    };

  const selected = SUPPLIER_TYPES.find((t) => t.id === supType);

  const handleSubmit = async () => {
    setSubmitError("");
    if (!companyName || !contactPerson || !bizEmail) {
      setSubmitError("Company Name, Contact Person and Business Email (Step 1) are required.");
      setStep(1);
      return;
    }
    const num = (s: string) => {
      const n = parseInt(s.replace(/[^\d]/g, ""), 10);
      return Number.isFinite(n) && n > 0 ? n : undefined;
    };
    setSubmitting(true);
    try {
      const res = await api.registerSupplier({
        type: (supType!.toUpperCase() as "HOTEL" | "TRANSPORT" | "CATERING"),
        companyName,
        crNumber: crNumber || undefined,
        contactPerson,
        businessEmail: bizEmail,
        phone: phone || undefined,
        city: city || undefined,
        ...(supType === "hotel"
          ? { starRating: num(extraVals[0]), district: extraVals[1] || undefined }
          : supType === "transport"
            ? { fleetSize: num(extraVals[0]), primaryVehicleType: extraVals[1] || undefined }
            : { dailyMealCapacity: num(extraVals[0]), halalCertBody: extraVals[1] || undefined }),
        tradeLicenseFileId: fileIds.tl,
        certificationFileId: fileIds.cert,
      });
      setResult(res);
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Cannot reach the TUBA server — please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div>
        <div className="mb-8">
          <div className="text-xs font-bold uppercase tracking-[0.18em] mb-1" style={{ color: GOLD }}>Section 04</div>
          <h2 className="text-2xl font-bold text-[var(--erp-text-strong)]">Supplier Registration</h2>
        </div>
        <div className="rounded-xl p-12 flex flex-col items-center text-center" style={{ border: `1px solid ${GREEN}30`, backgroundColor: `${GREEN}06` }}>
          <div className="w-16 h-16 rounded-xl flex items-center justify-center mb-5" style={{ backgroundColor: `${GREEN}15`, border: `1px solid ${GREEN}30` }}>
            <CheckCircle size={28} style={{ color: GREEN }} />
          </div>
          <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: GREEN }}>Supplier Application Submitted</div>
          <h3 className="text-2xl font-bold text-[var(--erp-text-strong)] mb-3">Under Compliance Review</h3>
          <p className="text-sm max-w-sm mb-6" style={{ color: "rgba(11,30,63,0.66)" }}>
            Your {selected?.label} supplier registration is now under review. Our procurement team will contact you within 5 business days.
          </p>
          <div className="px-5 py-3 rounded-xl mb-8" style={{ backgroundColor: `${GOLD}10`, border: `1px solid ${GOLD}25` }}>
            <span className="text-xs" style={{ color: "rgba(11,30,63,0.58)" }}>Reference: </span>
            <span className="text-sm font-bold" style={{ color: GOLD, fontFamily: "var(--font-mono)" }}>{result?.applicationCode ?? "SUP-1446-7193"}</span>
            {result?.tempPassword && (
              <div className="mt-1.5 pt-1.5" style={{ borderTop: `1px solid ${GOLD}20` }}>
                <span className="text-xs" style={{ color: "rgba(11,30,63,0.58)" }}>Temporary Password: </span>
                <span className="text-sm font-bold" style={{ color: GOLD, fontFamily: "var(--font-mono)" }}>{result.tempPassword}</span>
              </div>
            )}
          </div>
          <button onClick={() => { setSubmitted(false); setSupType(null); setStep(1); setTlState("empty"); setCertState("empty"); setResult(null); }} className="text-xs flex items-center gap-1.5" style={{ color: "rgba(11,30,63,0.58)" }}>
            <RotateCcw size={11} /> Start new application
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <div className="text-xs font-bold uppercase tracking-[0.18em] mb-1" style={{ color: GOLD }}>Section 04</div>
        <h2 className="text-2xl font-bold text-[var(--erp-text-strong)]">Supplier Registration</h2>
        <p className="text-sm mt-1" style={{ color: "rgba(11,30,63,0.58)" }}>
          Hotel / Transport / Catering — type-specific fields and document requirements
        </p>
      </div>

      {/* Type selector */}
      {!supType ? (
        <div>
          <div className="text-xs font-semibold mb-4" style={{ color: "rgba(11,30,63,0.58)" }}>Select your supplier type to begin:</div>
          <div className="grid grid-cols-3 gap-4">
            {SUPPLIER_TYPES.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setSupType(t.id)}
                  className="rounded-xl p-6 text-left transition-all hover:scale-[1.01]"
                  style={{ border: `1px solid rgba(11,30,63,0.11)`, backgroundColor: "var(--erp-surface)" }}
                >
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: `${t.color}18` }}>
                    <Icon size={22} style={{ color: t.color }} />
                  </div>
                  <div className="text-base font-bold text-[var(--erp-text-strong)] mb-1">{t.label}</div>
                  <div className="text-xs mb-2" style={{ color: t.color, fontFamily: "var(--font-arabic)" }} lang="ar" dir="rtl">{t.ar}</div>
                  <div className="text-xs leading-relaxed" style={{ color: "rgba(11,30,63,0.58)" }}>{t.desc}</div>
                  <div className="mt-4 text-xs flex items-center gap-1 font-semibold" style={{ color: t.color }}>
                    Register as {t.label} <ChevronRight size={12} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div>
          {/* Type badge bar */}
          <div className="flex items-center gap-3 mb-6 px-4 py-3 rounded-xl" style={{ backgroundColor: `${selected!.color}10`, border: `1px solid ${selected!.color}30` }}>
            <selected.icon size={16} style={{ color: selected!.color }} />
            <span className="text-sm font-bold" style={{ color: selected!.color }}>
              Registering as: {selected!.label} Supplier
            </span>
            <button
              onClick={() => { setSupType(null); setStep(1); setTlState("empty"); setCertState("empty"); }}
              className="ml-auto text-xs flex items-center gap-1"
              style={{ color: "rgba(11,30,63,0.58)" }}
            >
              <RotateCcw size={10} /> Change type
            </button>
          </div>

          <div className="rounded-xl p-8" style={{ border: "1px solid rgba(11,30,63,0.11)", backgroundColor: "var(--erp-surface)" }}>
            <StepBar steps={SUP_STEPS} current={step} />

            {step === 1 && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-base font-bold text-[var(--erp-text-strong)] mb-1">Company Information</h3>
                  <p className="text-xs" style={{ color: "rgba(11,30,63,0.58)" }}>Basic company details and {selected!.label.toLowerCase()}-specific information.</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <OcrInput label="Company Name" value={companyName} onChange={setCompanyName} placeholder="Legal company name" />
                  <OcrInput label="Commercial Registration (CR)" value={crNumber} onChange={setCrNumber} placeholder="e.g. CR-1446-XXXXX" />
                  <OcrInput label="Contact Person" value={contactPerson} onChange={setContactPerson} placeholder="Primary contact name" />
                  <OcrInput label="Business Email" value={bizEmail} onChange={setBizEmail} placeholder="operations@company.com" type="email" />
                  <OcrInput label="Phone Number" value={phone} onChange={setPhone} placeholder="+966 5X XXX XXXX" />
                  <OcrInput label="City / Region" value={city} onChange={setCity} placeholder="e.g. Makkah, Jeddah" />
                </div>
                {selected!.extra && (
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="col-span-2">
                      <div className="text-[9px] font-bold uppercase tracking-widest mb-3" style={{ color: GOLD }}>
                        {selected!.label}-specific Details
                      </div>
                    </div>
                    {selected!.extra.map((ex, i) => (
                      <OcrInput
                        key={ex.label}
                        label={ex.label}
                        value={extraVals[i]}
                        onChange={(v) => setExtraVals((vals) => vals.map((x, idx) => (idx === i ? v : x)))}
                        placeholder={ex.placeholder}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-base font-bold text-[var(--erp-text-strong)] mb-1">Document Uploads</h3>
                  <p className="text-xs" style={{ color: "rgba(11,30,63,0.58)" }}>
                    Upload your Trade License and {selected!.label.toLowerCase()}-specific certification.
                  </p>
                </div>
                <FileDropzone
                  state={tlState}
                  onChange={setTlState}
                  onFile={uploadFor("tl", "TRADE_LICENSE")}
                  label="Trade License (CR Certificate)"
                  hint="Current valid commercial registration document"
                />
                <FileDropzone
                  state={certState}
                  onChange={setCertState}
                  onFile={uploadFor("cert", "SUPPLIER_CERT")}
                  label={selected!.certLabel}
                  hint={selected!.certHint}
                />
              </div>
            )}

            {submitError && (
              <div className="mt-5 p-3 rounded-xl text-xs" style={{ backgroundColor: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", color: "var(--erp-destructive)" }}>
                {submitError}
              </div>
            )}
            <WizNav
              step={step}
              maxStep={2}
              onBack={() => step === 1 ? setSupType(null) : setStep((s) => s - 1)}
              onNext={() => step === 2 ? handleSubmit() : setStep(2)}
              nextLabel={step === 2 ? "Submit Application" : "Continue"}
              loading={submitting}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE SECTIONS nav
// ═══════════════════════════════════════════════════════════════════════════════

const PAGE_SECTIONS = [
  { id: "login", label: "Login Screen", icon: LogIn, num: "01" },
  { id: "agent-reg", label: "Agent Registration", icon: User, num: "02" },
  { id: "verification", label: "Verification Status", icon: ClipboardCheck, num: "03" },
  { id: "supplier-reg", label: "Supplier Registration", icon: Landmark, num: "04" },
];

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function AuthOnboarding() {
  return (
    <div className="min-h-screen flex flex-col" style={{ fontFamily: "var(--font-sans)", backgroundColor: DARK }}>
      {/* Top bar — logo + return to site / existing-account login */}
      <header className="sticky top-0 z-10" style={{ backgroundColor: NAVY, borderBottom: `1px solid ${GOLD}22` }}>
        <div className="max-w-4xl mx-auto w-full px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <LogoMark size={30} />
            <div>
              <div className="text-white font-bold text-xs tracking-widest">TUBA AL HIJAZ</div>
              <div className="text-[8px] font-bold uppercase tracking-[0.18em]" style={{ color: GOLD }}>Ground Handling</div>
            </div>
          </Link>
          <div className="flex items-center gap-3 text-xs">
            <Link to="/" className="hidden sm:inline" style={{ color: "rgba(255,255,255,0.66)" }}>Website</Link>
            <Link to="/login?portal=agent" className="px-3 py-1.5 rounded-lg font-semibold" style={{ backgroundColor: GOLD, color: NAVY }}>Agent Login</Link>
          </div>
        </div>
      </header>

      {/* The one real onboarding flow: the agent registration wizard (writes to the DB). */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto w-full px-8 py-12">
          <AgentRegSection />
        </div>
      </main>
    </div>
  );
}
