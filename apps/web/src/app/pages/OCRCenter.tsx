import { useState, useEffect, useMemo, useRef, type ReactNode } from "react";
import {
  Upload, ScanLine, AlertCircle, FileText, RefreshCw,
  Loader2, Check, ShieldCheck, ShieldAlert, Copy, ChevronDown, Link2,
} from "lucide-react";
import { api, ApiError, isLoggedIn, getStoredUser } from "../lib/api";
import { hasPermission, P } from "../lib/rbac";
import { EmptyState, LoadingSkeleton, ErrorState } from "../components/States";
import { ERPShell, type IconFC } from "../components/ERPShell";
import {
  ErpPageTemplate, ErpButton, ErpSearchBar, ErpFilterPanel, ErpDataTable,
  ErpPagination, ErpDrawer, ErpStatusChip, erpToast,
  type ErpColumn, type ErpStatusKind,
} from "../components/erp";
import { useLang } from "../lib/LangContext";
import { fontFor } from "@tuba/shared";

const OCR = "#6366F1"; // indigo — OCR module accent (unchanged Figma token)
const NAVY = "#0B1E3F";

// ─── Types (match the real /ocr backend) ──────────────────────────────────────
interface OcrField { field: string; value: string | null; confidence: number; low: boolean; overriddenValue?: string | null }
interface OcrMeta { mrz?: boolean; checks?: { field: string; ok: boolean }[]; mrzLines?: string[] }
interface OcrDoc {
  id: string; code: string; documentType: string; reviewStatus: string; fileName: string;
  extractedFields: OcrField[]; validation: { meta?: OcrMeta } | null;
  confidenceScore: number | null; mrzDiscrepancy: boolean;
  duplicateOfId: string | null; duplicateOfPassengerId: string | null;
  groupId: string | null; createdAt: string; processedAt: string | null;
  group?: { id: string; code: string; name: string } | null;
  passengers?: Array<{ id: string; code: string; name: string; passportNo: string }>;
}
interface OcrListItem {
  id: string; code: string; documentType: string; reviewStatus: string; confidenceScore: number | null;
  mrzDiscrepancy: boolean; duplicateOfId: string | null; duplicateOfPassengerId: string | null;
  fileName: string; groupId: string | null; createdAt: string; processedAt: string | null;
  group?: { id: string; code: string; name: string } | null;
  _count?: { passengers: number };
}
interface GroupOpt { id: string; code: string; name: string }

const FIELD_LABEL: Record<string, string> = {
  name: "Full Name", passportNo: "Passport No", nationality: "Nationality", dob: "Date of Birth",
  sex: "Sex", passportExpiry: "Passport Expiry", issuingCountry: "Issuing Country", personalNumber: "Personal No",
};
const FIELD_ORDER = ["name", "passportNo", "nationality", "dob", "sex", "passportExpiry", "issuingCountry", "personalNumber"];

// Canonical passenger fields — always rendered as editable inputs so an incomplete
// OCR scan degrades to manual entry. required = enforced by the backend toPassengerDto.
const CANON_FIELDS: { key: string; label: string; required: boolean; kind: "text" | "date" | "sex" }[] = [
  { key: "name",          label: "Full Name",       required: true,  kind: "text" },
  { key: "passportNo",    label: "Passport No",     required: true,  kind: "text" },
  { key: "nationality",   label: "Nationality",     required: true,  kind: "text" },
  { key: "dob",           label: "Date of Birth",   required: false, kind: "date" },
  { key: "sex",           label: "Sex",             required: true,  kind: "sex"  },
  { key: "passportExpiry",label: "Passport Expiry", required: false, kind: "date" },
  { key: "issuingCountry",label: "Issuing Country", required: false, kind: "text" },
  { key: "personalNumber",label: "Personal No",     required: false, kind: "text" },
];
/** T001-07 — Nusuk Groups List → Group Number fields. */
const NUSUK_FIELDS: { key: string; label: string; required: boolean; kind: "text" | "date" | "sex" }[] = [
  { key: "nusukGroupNumber", label: "Nusuk Group Number", required: true,  kind: "text" },
  { key: "groupName",        label: "Group Name",         required: false, kind: "text" },
  { key: "consulate",        label: "Consulate",          required: false, kind: "text" },
  { key: "paxCount",         label: "Pax Count",          required: false, kind: "text" },
  { key: "agentCode",        label: "Agent Code",         required: false, kind: "text" },
  { key: "departDate",       label: "Depart Date",        required: false, kind: "date" },
  { key: "returnDate",       label: "Return Date",        required: false, kind: "date" },
];
const fieldsForDoc = (documentType: string) =>
  documentType === "NUSUK_GROUP_LIST" ? NUSUK_FIELDS : CANON_FIELDS;
const normSex = (v: string) => { const t = (v || "").trim().toUpperCase(); return t.startsWith("M") ? "M" : t.startsWith("F") ? "F" : ""; };
const isoDate = (v: string) => (/^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : "");

const errMsg = (e: unknown, f: string) => (e instanceof ApiError ? e.message : f);
const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── Small UI atoms (Figma design tokens) ─────────────────────────────────────
function ConfBar({ pct }: { pct: number }) {
  const c = pct >= 90 ? "#16A34A" : pct >= 60 ? "#B45309" : "#DC2626";
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-14 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "#EEF1F6" }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: c }} />
      </div>
      <span className="text-[9px] font-bold" style={{ color: c, fontFamily: "var(--font-mono)" }}>{pct}%</span>
    </div>
  );
}
function ocrStatusKind(s: string): ErpStatusKind {
  if (s === "APPROVED") return "approved";
  if (s === "REJECTED") return "rejected";
  if (s === "PENDING") return "pending";
  if (s === "IN_REVIEW") return "info";
  return "info";
}

function StatusPill({ s }: { s: string }) {
  const labels: Record<string, string> = {
    PENDING: "Processing",
    IN_REVIEW: "In Review",
    APPROVED: "Approved",
    REJECTED: "Rejected",
  };
  return <ErpStatusChip status={ocrStatusKind(s)} label={labels[s] ?? s} />;
}

// ─── Shared review body: real fields + confidence + MRZ + duplicate + actions ──
function OcrReviewBody({ doc, defaultGroupId, groups, onDone }: {
  doc: OcrDoc; defaultGroupId?: string | null; groups: GroupOpt[]; onDone: (r: "approved" | "rejected") => void;
}) {
  const isNusuk = doc.documentType === "NUSUK_GROUP_LIST";
  const canon = fieldsForDoc(doc.documentType);
  const origVal = (f: OcrField) => String(f.overriddenValue ?? f.value ?? "");
  const byKey = useMemo(() => {
    const m: Record<string, OcrField> = {};
    for (const f of doc.extractedFields ?? []) m[f.field] = f;
    return m;
  }, [doc]);
  const rawText = byKey.rawText ? origVal(byKey.rawText) : "";
  const [vals, setVals] = useState<Record<string, string>>(() =>
    Object.fromEntries(canon.map((c) => {
      const v = byKey[c.key] ? origVal(byKey[c.key]) : "";
      return [c.key, c.kind === "sex" ? normSex(v) : c.kind === "date" ? isoDate(v) : v];
    })),
  );
  const [showRaw, setShowRaw] = useState(false);
  const [groupId, setGroupId] = useState(defaultGroupId ?? doc.groupId ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const meta = doc.validation?.meta;
  const mrzOk = !!meta?.mrz && !doc.mrzDiscrepancy;
  const dup = doc.duplicateOfPassengerId || doc.duplicateOfId;
  const overall = Math.round((doc.confidenceScore ?? 0) * 100);
  const approved = doc.reviewStatus === "APPROVED";
  const rejected = doc.reviewStatus === "REJECTED";
  const done = approved || rejected;
  // UX only — API still enforces REVIEW_OCR_QUEUE (S1-01).
  const canReview = hasPermission(P.REVIEW_OCR_QUEUE);

  const submitApprove = async (passengerId?: string) => {
    if (doc.documentType === "PASSPORT" && !groupId) {
      setErr("Passport → Mutamer requires a Group. Select the target group before approving.");
      return;
    }
    setBusy(true); setErr(null);
    try {
      const changed = canon
        .map((c) => ({ field: c.key, value: (vals[c.key] ?? "").trim() }))
        .filter((o) => o.value !== "" && o.value !== (byKey[o.field] ? origVal(byKey[o.field]).trim() : ""));
      if (changed.length) await api.post(`/ocr/documents/${doc.id}/override`, { fields: changed });
      const res = await api.post<{
        passenger?: { code: string } | null;
        group?: { code: string; nusukGroupNumber?: string | null } | null;
        mode?: string | null;
      }>(
        `/ocr/documents/${doc.id}/approve`,
        { ...(groupId && !isNusuk ? { groupId } : {}), ...(passengerId ? { passengerId } : {}) },
      );
      if (isNusuk) {
        erpToast.success(
          res?.mode === "update"
            ? `Group ${res.group?.code ?? ""} updated from Nusuk list`
            : `Group ${res.group?.code ?? ""} opened (Nusuk ${res.group?.nusukGroupNumber ?? ""})`,
        );
      } else if (res?.mode === "attach") erpToast.success(`OCR attached to Mutamer ${res.passenger?.code ?? ""}`.trim());
      else erpToast.success(res?.passenger ? `Mutamer ${res.passenger.code} created from passport` : "Approved");
      onDone("approved");
    } catch (e) { setErr(errMsg(e, "Approve failed")); } finally { setBusy(false); }
  };
  const approve = () => void submitApprove();
  const attachExisting = () => {
    if (!doc.duplicateOfPassengerId) return;
    void submitApprove(doc.duplicateOfPassengerId);
  };
  const reject = async () => {
    setBusy(true); setErr(null);
    try { await api.post(`/ocr/documents/${doc.id}/reject`, {}); erpToast.success("Document rejected"); onDone("rejected"); }
    catch (e) { setErr(errMsg(e, "Reject failed")); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      {/* Confidence / MRZ banner */}
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl" style={
        isNusuk
          ? { backgroundColor: "#2563EB0D", border: "1px solid #2563EB30" }
          : mrzOk
            ? { backgroundColor: "#16A34A0D", border: "1px solid #16A34A30" }
            : { backgroundColor: "#DC26260D", border: "1px solid #DC262630" }
      }>
        {isNusuk
          ? <FileText size={15} style={{ color: "#2563EB" }} />
          : mrzOk ? <ShieldCheck size={15} style={{ color: "#16A34A" }} /> : <ShieldAlert size={15} style={{ color: "#DC2626" }} />}
        <span className="text-xs font-semibold" style={{ color: isNusuk ? "#2563EB" : mrzOk ? "#16A34A" : "#DC2626" }}>
          {isNusuk
            ? "Nusuk Group List → approve opens / updates Group Number"
            : mrzOk ? "MRZ validated — check digits pass" : doc.mrzDiscrepancy ? "MRZ discrepancy — verify fields before approving" : "No MRZ read — verify manually"}
        </span>
        <div className="flex-1" />
        <span className="text-[10px]" style={{ color: "rgba(11,30,63,0.58)" }}>Overall confidence</span>
        <ConfBar pct={overall} />
      </div>

      {/* Duplicate warning — T001-06 attach path for Excel Mutamer twin */}
      {!isNusuk && dup && (
        <div className="flex items-start gap-2.5 px-4 py-2.5 rounded-xl" style={{ backgroundColor: "#B4530912", border: "1px solid #B4530930" }}>
          <Copy size={14} style={{ color: "#B45309" }} className="mt-0.5 shrink-0" />
          <div className="text-[11px]" style={{ color: "#B45309" }}>
            {doc.duplicateOfPassengerId
              ? "This passport is already on an existing Mutamer (e.g. Excel import). Attach OCR to that Mutamer — do not create a duplicate."
              : "A pending OCR document with this passport already exists. Review before approving."}
          </div>
        </div>
      )}

      {/* Editable fields — passport Mutamer OR Nusuk Group List */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(11,30,63,0.11)" }}>
        {canon.map((c, i) => {
          const ex = byKey[c.key];
          const backed = !!ex && String(ex.overriddenValue ?? ex.value ?? "").trim() !== "";
          const low = !!ex?.low;
          return (
            <div key={c.key} className="flex items-center gap-3 px-4 py-2.5" style={{ borderBottom: i < canon.length - 1 ? "1px solid rgba(11,30,63,0.07)" : undefined, backgroundColor: low ? "#DC26260A" : undefined }}>
              <div className="w-28 shrink-0 text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(11,30,63,0.5)" }}>
                {c.label}{c.required && <span style={{ color: "#DC2626" }}> *</span>}
              </div>
              {c.kind === "sex" ? (
                <select value={vals.sex ?? ""} onChange={(e) => setVals((v) => ({ ...v, sex: e.target.value }))} disabled={done || !canReview}
                  className="flex-1 px-2.5 py-1.5 text-xs rounded-lg focus:outline-none disabled:opacity-70"
                  style={{ backgroundColor: "#F5F7FA", border: `1px solid ${low ? "#DC262640" : "rgba(11,30,63,0.12)"}`, color: NAVY }}>
                  <option value="">— Select —</option>
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                </select>
              ) : (
                <input type={c.kind === "date" ? "date" : "text"} value={vals[c.key] ?? ""}
                  onChange={(e) => setVals((v) => ({ ...v, [c.key]: e.target.value }))} disabled={done || !canReview}
                  placeholder={backed ? undefined : "Manual entry"}
                  className="flex-1 px-2.5 py-1.5 text-xs rounded-lg focus:outline-none disabled:opacity-70"
                  style={{ backgroundColor: "#F5F7FA", border: `1px solid ${low ? "#DC262640" : "rgba(11,30,63,0.12)"}`, color: c.kind === "date" ? "rgba(11,30,63,0.76)" : NAVY }} />
              )}
              <div className="shrink-0 w-24 text-right">
                {backed
                  ? <div className="flex items-center justify-end gap-1">{low && <AlertCircle size={12} style={{ color: "#DC2626" }} />}<ConfBar pct={Math.round((ex.confidence ?? 0) * 100)} /></div>
                  : <span className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: "rgba(11,30,63,0.4)" }}>Manual entry</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Raw OCR text — collapsible read-only reference for transcribing an incomplete scan */}
      {rawText.trim() !== "" && (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(11,30,63,0.11)" }}>
          <button type="button" onClick={() => setShowRaw((v) => !v)} className="w-full flex items-center justify-between px-4 py-2.5 text-left" style={{ backgroundColor: "#FBFCFD" }}>
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(11,30,63,0.58)" }}>Raw OCR text (reference)</span>
            <ChevronDown size={13} style={{ color: "rgba(11,30,63,0.5)", transform: showRaw ? "rotate(180deg)" : undefined }} />
          </button>
          {showRaw && (
            <pre className="px-4 py-3 text-[10px] whitespace-pre-wrap max-h-40 overflow-y-auto" style={{ color: "rgba(11,30,63,0.66)", fontFamily: "var(--font-mono)", borderTop: "1px solid rgba(11,30,63,0.08)" }}>{rawText}</pre>
          )}
        </div>
      )}

      {/* Group target — Passport → Mutamer only (Nusuk list *creates* the Group) */}
      {doc.documentType === "PASSPORT" && !done && (
        <div>
          <label className="text-[9px] font-bold uppercase tracking-widest block mb-1.5" style={{ color: "rgba(11,30,63,0.5)" }}>
            Passport → Mutamer · target Group <span style={{ color: "#DC2626" }}>*</span>
          </label>
          {defaultGroupId ? (
            <div className="px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: "#F5F7FA", border: "1px solid rgba(11,30,63,0.12)", color: NAVY }}>
              {groups.find((g) => g.id === (defaultGroupId ?? ""))?.code
                ?? doc.group?.code
                ?? "This group"}
              <span className="block text-[10px] mt-0.5" style={{ color: "rgba(11,30,63,0.55)" }}>
                OCR will create or attach a Mutamer in this Group. Passport OCR cannot open a new Group Number.
              </span>
            </div>
          ) : (
            <>
              <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className="w-full px-3 py-2 text-xs rounded-lg focus:outline-none" style={{ backgroundColor: "#F5F7FA", border: "1px solid rgba(11,30,63,0.12)", color: NAVY }}>
                <option value="">— Select a Group (required) —</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.code} — {g.name}</option>)}
              </select>
              <p className="text-[10px] mt-1.5" style={{ color: "rgba(11,30,63,0.55)" }}>
                Required: approve creates a Mutamer in the selected Group (or attaches to an existing one).
              </p>
            </>
          )}
        </div>
      )}

      {err && <div className="px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", color: "#DC2626" }}>{err}</div>}

      {done ? (
        <div className="text-center text-xs py-1" style={{ color: approved ? "#16A34A" : "#DC2626" }}>
          {approved
            ? (isNusuk
              ? `✓ Approved — Group ${doc.group?.code ?? "linked"} from Nusuk list.`
              : (doc.passengers?.length
                ? `✓ Approved — linked to Mutamer ${doc.passengers.map((p) => p.code).join(", ")}.`
                : "✓ Approved — Mutamer intake completed."))
            : "Rejected."}
        </div>
      ) : canReview ? (
        <div className="flex flex-col gap-2">
          {doc.documentType === "PASSPORT" && doc.duplicateOfPassengerId && (
            <button disabled={busy} onClick={attachExisting} className="w-full py-2.5 rounded-xl text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-2" style={{ backgroundColor: "#0D9488", color: "white" }}>
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />} Attach OCR to existing Mutamer
            </button>
          )}
          <div className="flex gap-2.5">
            <button disabled={busy} onClick={() => void reject()} className="px-4 py-2.5 rounded-xl text-xs font-bold disabled:opacity-50" style={{ border: "1px solid rgba(239,68,68,0.3)", color: "#DC2626", backgroundColor: "rgba(239,68,68,0.06)" }}>Reject</button>
            <button
              disabled={busy || (!!doc.duplicateOfPassengerId && doc.documentType === "PASSPORT")}
              onClick={approve}
              title={doc.duplicateOfPassengerId && !isNusuk ? "Use Attach for existing Mutamer — create is blocked to prevent duplicates" : undefined}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ backgroundColor: OCR, color: "white" }}
            >
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              {isNusuk ? "Approve & Open Group" : "Approve & Create Mutamer"}
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center text-xs py-2 px-3 rounded-xl" style={{ color: "rgba(11,30,63,0.66)", backgroundColor: "#F5F7FA", border: "1px solid rgba(11,30,63,0.1)" }}>
          {isNusuk
            ? "Submitted for ops review. Staff with OCR review access approve to open the Group Number."
            : "Submitted for ops review. Staff with OCR review access approve into the selected Group."}
        </div>
      )}
    </div>
  );
}

// ─── Modal → ErpDrawer adapter (ESP-01) ───────────────────────────────────────
function Modal({ title, sub, onClose, children, width = "w-[560px]" }: { title: string; sub?: string; onClose: () => void; children: ReactNode; width?: string }) {
  const maxWidth = width.includes("720") || width.includes("lg") ? 720 : 560;
  return (
    <ErpDrawer
      open
      onClose={onClose}
      title={title}
      subtitle={sub}
      maxWidth={maxWidth}
      footer={<ErpButton variant="secondary" onClick={onClose}>Close</ErpButton>}
    >
      {children}
    </ErpDrawer>
  );
}

// ─── Reusable intake modal: upload → poll(~7s) → review. Exported for the agent flow. ──
export function OcrIntakeModal({ groupId, groups: groupsIn, onClose, onApproved, documentType = "PASSPORT" }: {
  groupId?: string | null;
  groups?: GroupOpt[];
  onClose: () => void;
  onApproved?: () => void;
  /** T001-07 — PASSPORT (default) or NUSUK_GROUP_LIST when flag enabled. */
  documentType?: "PASSPORT" | "NUSUK_GROUP_LIST";
}) {
  type Phase = "upload" | "processing" | "review" | "error";
  const isNusuk = documentType === "NUSUK_GROUP_LIST";
  const [phase, setPhase] = useState<Phase>("upload");
  const [doc, setDoc] = useState<OcrDoc | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [groups, setGroups] = useState<GroupOpt[]>(groupsIn ?? []);
  const fileRef = useRef<HTMLInputElement>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    if (!groupsIn && !groupId && !isNusuk) api.get<GroupOpt[]>("/groups").then((g) => alive.current && setGroups(g)).catch(() => {});
    return () => { alive.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setPhase("processing"); setErr(null);
    try {
      const up = await api.uploadWithFields<{ documentId: string }>(
        isNusuk ? "/uploads?kind=OTHER" : "/uploads?kind=PASSPORT",
        file,
        {},
      );
      const reg = await api.post<{ id: string }>("/ocr/documents", {
        uploadedFileId: up.documentId,
        documentType,
        ...(!isNusuk && groupId ? { groupId } : {}),
      });
      for (let i = 0; i < 15; i++) {
        await sleep(2000);
        if (!alive.current) return;
        const d = await api.get<OcrDoc>(`/ocr/documents/${reg.id}`);
        if ((d.extractedFields && d.extractedFields.length) || (d.reviewStatus !== "PENDING")) {
          if (!alive.current) return;
          setDoc(d); setPhase("review"); return;
        }
      }
      setErr("OCR is taking longer than usual. It will appear in the review queue shortly."); setPhase("error");
    } catch (e) { if (alive.current) { setErr(errMsg(e, "Upload / OCR failed")); setPhase("error"); } }
  };

  return (
    <Modal
      title={isNusuk ? "Nusuk Group List OCR" : "Passport OCR"}
      sub={isNusuk
        ? "Group List → Group Number · upload → extract → review → approve opens Group"
        : "Passport → Mutamer · requires Group · upload → extract → review → approve"}
      onClose={onClose}
    >
      {phase === "upload" && (
        <div>
          <label className="flex flex-col items-center gap-3 p-8 rounded-2xl cursor-pointer" style={{ border: `2px dashed ${OCR}35`, backgroundColor: `${OCR}06` }}>
            <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${OCR}18` }}><Upload size={20} style={{ color: OCR }} /></div>
            <div className="text-center">
              <div className="text-sm font-semibold text-[#0B1E3F]">
                {isNusuk ? "Click to choose a Nusuk Groups List image or PDF" : "Click to choose a passport image or PDF"}
              </div>
              <div className="text-xs mt-0.5" style={{ color: "rgba(11,30,63,0.58)" }}>
                {isNusuk ? "JPG, PNG, PDF · Max 10 MB · Groups List screen" : "JPG, PNG, PDF · Max 10 MB · MRZ page"}
              </div>
            </div>
          </label>
          <p className="text-[10px] mt-3 text-center" style={{ color: "rgba(11,30,63,0.5)" }}>
            {isNusuk
              ? "Nusuk Group Number and related fields are extracted. Staff approve to create or update the Group."
              : "Fields are auto-extracted and MRZ-validated. You review and correct before it creates a passenger."}
          </p>
        </div>
      )}
      {phase === "processing" && (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <Loader2 size={30} className="animate-spin" style={{ color: OCR }} />
          <div className="text-sm font-semibold text-[#0B1E3F]">Processing… (~7 seconds)</div>
          <div className="text-xs max-w-[320px]" style={{ color: "rgba(11,30,63,0.58)" }}>Reading the document, extracting fields and validating the MRZ checksum. This runs on the server.</div>
        </div>
      )}
      {phase === "review" && doc && (
        <OcrReviewBody doc={doc} defaultGroupId={groupId ?? undefined} groups={groups} onDone={(r) => { if (r === "approved") onApproved?.(); onClose(); }} />
      )}
      {phase === "error" && (
        <div className="py-6"><ErrorState tone="light" message={err ?? "Something went wrong."} onRetry={() => { setErr(null); setPhase("upload"); }} /></div>
      )}
    </Modal>
  );
}

// ─── OCR Center page: real review queue + intake ──────────────────────────────
function OCRCenterBody() {
  const authed = isLoggedIn();
  const [rows, setRows] = useState<OcrListItem[] | null>(null);
  const [loading, setLoading] = useState(authed);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [openDoc, setOpenDoc] = useState<OcrDoc | null>(null);
  const [openLoading, setOpenLoading] = useState(false);
  const [showIntake, setShowIntake] = useState(false);
  const [groups, setGroups] = useState<GroupOpt[]>([]);
  /** T001-07 — Group List mode only when API flag ENABLE_NUSUK_GROUP_LIST_OCR is on. */
  const [nusukEnabled, setNusukEnabled] = useState(false);
  const [intakeMode, setIntakeMode] = useState<"PASSPORT" | "NUSUK_GROUP_LIST">("PASSPORT");

  const load = () => {
    if (!isLoggedIn()) { setLoading(false); return; }
    setLoading(true); setError(false);
    api.get<OcrListItem[]>("/ocr/documents")
      .then((d) => { setRows(d); setError(false); })
      .catch(() => { setRows(null); setError(true); })
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    const t = setTimeout(() => {
      load();
      api.get<GroupOpt[]>("/groups").then(setGroups).catch(() => {});
      api.get<{ nusukGroupListOcr?: boolean }>("/ocr/capabilities")
        .then((c) => setNusukEnabled(!!c.nusukGroupListOcr))
        .catch(() => setNusukEnabled(false));
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!openId) { setOpenDoc(null); return; }
    setOpenLoading(true);
    api.get<OcrDoc>(`/ocr/documents/${openId}`).then(setOpenDoc).catch(() => setOpenDoc(null)).finally(() => setOpenLoading(false));
  }, [openId]);

  const all = rows ?? [];
  const filtered = all.filter((r) => {
    const mf = filter === "all" || r.reviewStatus === filter;
    const mq = !q || r.code.toLowerCase().includes(q.toLowerCase()) || (r.fileName ?? "").toLowerCase().includes(q.toLowerCase());
    return mf && mq;
  });
  const kpis = [
    { l: "In Review", v: all.filter((r) => r.reviewStatus === "IN_REVIEW").length, c: "#2563EB" },
    { l: "Processing", v: all.filter((r) => r.reviewStatus === "PENDING").length, c: "#B45309" },
    { l: "Approved", v: all.filter((r) => r.reviewStatus === "APPROVED").length, c: "#16A34A" },
    { l: "Flagged", v: all.filter((r) => r.mrzDiscrepancy || r.duplicateOfId || r.duplicateOfPassengerId).length, c: "#DC2626" },
  ];

  const tableState: ReactNode = !authed ? <EmptyState tone="light" title="Sign in" hint="OCR documents are per-account." />
    : loading ? <LoadingSkeleton tone="light" rows={6} />
    : error ? <ErrorState tone="light" onRetry={load} />
    : all.length === 0 ? <EmptyState tone="light" title="No documents to review" hint="Scan a passport (or Nusuk Group List when enabled) to get started." icon={<ScanLine size={30} style={{ color: "rgba(11,30,63,0.35)" }} />} />
    : filtered.length === 0 ? <EmptyState tone="light" title="No matching documents" hint="Try a different status filter or search." />
    : null;

  const { lang } = useLang();
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const pageSize = 25;
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  const columns: ErpColumn<OcrListItem>[] = [
    {
      id: "doc",
      header: lang === "bn" ? "ডক" : "Doc",
      cell: (r) => (
        <div>
          <div className="text-xs font-semibold font-mono" style={{ color: OCR }}>{r.code}</div>
          <div className="text-[9px] truncate max-w-[160px]" style={{ color: "rgba(11,30,63,0.5)" }}>{r.fileName}</div>
        </div>
      ),
    },
    {
      id: "type",
      header: lang === "bn" ? "ধরন" : "Type",
      cell: (r) =>
        r.documentType === "PASSPORT"
          ? "Passport → Mutamer"
          : r.documentType === "NUSUK_GROUP_LIST"
            ? "Nusuk → Group"
            : r.documentType,
    },
    { id: "group", header: lang === "bn" ? "গ্রুপ" : "Group", cell: (r) => <span className="font-mono">{r.group?.code ?? "—"}</span> },
    { id: "status", header: lang === "bn" ? "স্ট্যাটাস" : "Status", cell: (r) => <StatusPill s={r.reviewStatus} /> },
    {
      id: "conf",
      header: lang === "bn" ? "কনফিডেন্স" : "Confidence",
      cell: (r) => (r.confidenceScore != null ? <ConfBar pct={Math.round(r.confidenceScore * 100)} /> : <span style={{ color: "rgba(11,30,63,0.4)" }}>—</span>),
    },
    {
      id: "flags",
      header: lang === "bn" ? "ফ্ল্যাগ" : "Flags",
      cell: (r) => {
        const flag = r.mrzDiscrepancy || r.duplicateOfId || r.duplicateOfPassengerId;
        return flag
          ? <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#DC262615", color: "#DC2626" }}><AlertCircle size={9} /> {r.mrzDiscrepancy ? "MRZ" : "Dup"}</span>
          : <Check size={12} style={{ color: "#16A34A" }} />;
      },
    },
    { id: "created", header: lang === "bn" ? "তৈরি" : "Created", cell: (r) => fmtDate(r.createdAt) },
  ];

  return (
    <div style={{ fontFamily: fontFor(lang) }}>
      <ErpPageTemplate
        title={lang === "bn" ? "ওসিআর সেন্টার" : "OCR Center"}
        subtitle={
          nusukEnabled
            ? (lang === "bn" ? "পাসপোর্ট → মুতামির · নুসুক গ্রুপ লিস্ট → গ্রুপ" : "Modes: Passport → Mutamer · Nusuk Group List → Group Number")
            : (lang === "bn" ? "পাসপোর্ট → মুতামির (গ্রুপ প্রয়োজন)" : "Passport → Mutamer (requires Group) · extract → MRZ → review")
        }
        primaryAction={
          <div className="flex items-center gap-2">
            {nusukEnabled && (
              <div className="flex gap-0.5 p-1 rounded-xl" style={{ backgroundColor: "#FBFCFD", border: "1px solid rgba(11,30,63,0.11)" }}>
                {([
                  { k: "PASSPORT" as const, label: "Passport" },
                  { k: "NUSUK_GROUP_LIST" as const, label: "Group List" },
                ]).map((m) => (
                  <ErpButton
                    key={m.k}
                    size="sm"
                    variant={intakeMode === m.k ? "primary" : "ghost"}
                    onClick={() => setIntakeMode(m.k)}
                    style={intakeMode === m.k ? { backgroundColor: OCR, color: "white" } : undefined}
                  >
                    {m.label}
                  </ErpButton>
                ))}
              </div>
            )}
            <ErpButton
              variant="primary"
              icon={<ScanLine size={13} />}
              onClick={() => setShowIntake(true)}
              style={{ backgroundColor: OCR, color: "white" }}
            >
              {nusukEnabled && intakeMode === "NUSUK_GROUP_LIST"
                ? (lang === "bn" ? "গ্রুপ লিস্ট স্ক্যান" : "New Group List Scan")
                : (lang === "bn" ? "পাসপোর্ট স্ক্যান" : "New Passport Scan")}
            </ErpButton>
          </div>
        }
        secondaryAction={
          <ErpButton variant="outline" icon={<RefreshCw size={12} />} onClick={load}>
            {lang === "bn" ? "রিফ্রেশ" : "Refresh"}
          </ErpButton>
        }
        toolbar={
          <div className="flex flex-col gap-3 w-full">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {kpis.map((k) => (
                <div key={k.l} className="rounded-xl p-3" style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(11,30,63,0.11)" }}>
                  <div className="text-lg font-bold font-mono" style={{ color: k.c }}>{loading || error ? "—" : k.v}</div>
                  <div className="text-[10px]" style={{ color: "rgba(11,30,63,0.58)" }}>{k.l}</div>
                </div>
              ))}
            </div>
            <ErpSearchBar
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
              onClear={() => { setQ(""); setPage(1); }}
              placeholder={lang === "bn" ? "কোড বা ফাইল…" : "Search code or file…"}
              lang={lang}
            />
            <ErpFilterPanel open={filtersOpen} onOpenChange={setFiltersOpen} lang={lang} activeCount={filter === "all" ? 0 : 1}>
              <div className="flex flex-wrap gap-1.5">
                {["all", "IN_REVIEW", "PENDING", "APPROVED", "REJECTED"].map((f) => (
                  <ErpButton
                    key={f}
                    size="sm"
                    variant={filter === f ? "primary" : "outline"}
                    onClick={() => { setFilter(f); setPage(1); }}
                    style={filter === f ? { backgroundColor: OCR, color: "white" } : undefined}
                  >
                    {f === "all" ? "All" : f === "IN_REVIEW" ? "In Review" : f === "PENDING" ? "Processing" : f.charAt(0) + f.slice(1).toLowerCase()}
                  </ErpButton>
                ))}
              </div>
            </ErpFilterPanel>
          </div>
        }
        footer={<ErpPagination page={page} pageSize={pageSize} total={filtered.length} onPageChange={setPage} lang={lang} />}
      >
        {tableState ? (
          <div className="rounded-xl p-2" style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(11,30,63,0.11)" }}>{tableState}</div>
        ) : (
          <ErpDataTable
            columns={columns}
            rows={pageRows}
            rowKey={(r) => r.id}
            lang={lang}
            onRowClick={(r) => setOpenId(r.id)}
            emptyTitle={lang === "bn" ? "কোনো মিল নেই" : "No matching documents"}
            rowActions={(r) => (
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <ErpButton size="sm" variant="ghost" onClick={() => setOpenId(r.id)}>
                  {lang === "bn" ? "খুলুন" : "Open"}
                </ErpButton>
                {r.reviewStatus === "PENDING" && (
                  <ErpButton
                    size="sm"
                    variant="outline"
                    icon={<RefreshCw size={12} />}
                    onClick={() => {
                      void api.post(`/ocr/documents/${r.id}/reprocess`, {})
                        .then(() => { erpToast.success(lang === "bn" ? "পুনরায় প্রসেস কিউ হয়েছে" : "Reprocess queued", lang); load(); })
                        .catch((e) => erpToast.error(errMsg(e, lang === "bn" ? "রিপ্রসেস ব্যর্থ" : "Reprocess failed"), lang));
                    }}
                  >
                    {lang === "bn" ? "রিপ্রসেস" : "Reprocess"}
                  </ErpButton>
                )}
              </div>
            )}
          />
        )}
      </ErpPageTemplate>

      {showIntake && (
        <OcrIntakeModal
          groups={groups}
          documentType={nusukEnabled ? intakeMode : "PASSPORT"}
          onClose={() => setShowIntake(false)}
          onApproved={load}
        />
      )}
      {openId && (
        <Modal
          title={openDoc?.documentType === "NUSUK_GROUP_LIST" ? "Review Nusuk Group List" : "Review Document"}
          sub={openDoc?.code}
          onClose={() => setOpenId(null)}
        >
          {openLoading || !openDoc ? <div className="py-8"><LoadingSkeleton tone="light" rows={6} /></div>
            : <OcrReviewBody doc={openDoc} groups={groups} onDone={() => { setOpenId(null); load(); }} />}
        </Modal>
      )}
    </div>
  );
}

/** UI-02 — OCR Center uses the shared app shell; Advanced Tools → OCR lands here. */
export default function OCRCenter() {
  return (
    <ERPShell
      moduleId="ocr"
      moduleName="OCR Center"
      moduleColor={OCR}
      moduleIcon={ScanLine as IconFC}
      navItems={[]}
      activeItem=""
      onItemClick={() => undefined}
      breadcrumb={[]}
      userName={getStoredUser()?.name ?? "OCR Reviewer"}
      userRole={getStoredUser()?.roleName ?? "Staff"}
    >
      <OCRCenterBody />
    </ERPShell>
  );
}
