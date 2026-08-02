/**
 * T002-03/05 — Mutamer Visa Pipeline state machine (pure).
 * Architecture §3.2–§3.5 + T002-05 embassy/passport SOP guards.
 * Passenger is SoT; VisaRequest batch status is separate.
 */

export const VISA_PIPELINE_STATES = [
  "NEW",
  "MOFA",
  "EMBASSY",
  "BIOMETRIC",
  "SUBMITTED",
  "PROCESSING",
  "ISSUED",
  "REJECTED",
  "PASSPORT_RETURNED",
  "COMPLETED",
  "REJECTED_CLOSED",
] as const;

export type VisaPipelineState = (typeof VISA_PIPELINE_STATES)[number];

export type TransitionOwner = "Visa Desk" | "Visa Desk / system";

export type TransitionDef = {
  from: VisaPipelineState;
  to: VisaPipelineState;
  owner: TransitionOwner;
  /** Human-readable guard summary for docs / API meta */
  guard: string;
  skip?: boolean;
};

/** Allowed edges from architecture §3.4 (+ same-state no-op handled separately). */
export const TRANSITION_MATRIX: readonly TransitionDef[] = [
  { from: "NEW", to: "MOFA", owner: "Visa Desk", guard: "Group has visa type; Umrah Co recommended" },
  { from: "NEW", to: "BIOMETRIC", owner: "Visa Desk", guard: "Skip-forward when MOFA/Embassy unused", skip: true },
  { from: "MOFA", to: "EMBASSY", owner: "Visa Desk", guard: "—" },
  { from: "MOFA", to: "BIOMETRIC", owner: "Visa Desk", guard: "Skip Embassy when SOP allows", skip: true },
  { from: "EMBASSY", to: "BIOMETRIC", owner: "Visa Desk", guard: "—" },
  { from: "BIOMETRIC", to: "SUBMITTED", owner: "Visa Desk", guard: "Biometric status recorded" },
  { from: "SUBMITTED", to: "PROCESSING", owner: "Visa Desk / system", guard: "—" },
  { from: "PROCESSING", to: "ISSUED", owner: "Visa Desk", guard: "Visa Number required" },
  { from: "PROCESSING", to: "REJECTED", owner: "Visa Desk", guard: "Reason required" },
  { from: "ISSUED", to: "PASSPORT_RETURNED", owner: "Visa Desk", guard: "Custody confirmation" },
  { from: "PASSPORT_RETURNED", to: "COMPLETED", owner: "Visa Desk", guard: "—" },
  {
    from: "ISSUED",
    to: "COMPLETED",
    owner: "Visa Desk",
    guard: "Allowed when VISA_REQUIRE_PASSPORT_RETURN is false",
    skip: true,
  },
  { from: "REJECTED", to: "BIOMETRIC", owner: "Visa Desk", guard: "Rework" },
  { from: "REJECTED", to: "SUBMITTED", owner: "Visa Desk", guard: "Rework" },
  { from: "REJECTED", to: "PROCESSING", owner: "Visa Desk", guard: "Rework" },
  { from: "REJECTED", to: "REJECTED_CLOSED", owner: "Visa Desk", guard: "Terminal" },
] as const;

const EDGE = new Map<string, TransitionDef>(
  TRANSITION_MATRIX.map((t) => [`${t.from}->${t.to}`, t]),
);

export function isVisaPipelineState(v: unknown): v is VisaPipelineState {
  return typeof v === "string" && (VISA_PIPELINE_STATES as readonly string[]).includes(v);
}

export function allowedTargets(
  from: VisaPipelineState,
  opts?: { requirePassportReturn?: boolean },
): VisaPipelineState[] {
  return TRANSITION_MATRIX.filter((t) => {
    if (t.from !== from) return false;
    // SOP: hide ISSUED → COMPLETED skip when passport-return is required.
    if (opts?.requirePassportReturn && t.from === "ISSUED" && t.to === "COMPLETED") {
      return false;
    }
    return true;
  }).map((t) => t.to);
}

export type TransitionInput = {
  from: VisaPipelineState;
  to: VisaPipelineState;
  /** When true, ISSUED → COMPLETED is forbidden (must pass PASSPORT_RETURNED). */
  requirePassportReturn: boolean;
  visaNumber?: string | null;
  biometricStatus?: string | null;
  reason?: string | null;
  custodyConfirmed?: boolean;
  notes?: string | null;
  hasVisaType?: boolean;
  /** Group.consulate | VisaRequest.embassy | prior Passenger.embassyRef */
  hasEmbassyContext?: boolean;
  embassyRef?: string | null;
  embassy?: string | null;
};

export type TransitionValidation =
  | { ok: true; def: TransitionDef | null; noop: boolean }
  | { ok: false; code: string; message: string };

export function validateTransition(input: TransitionInput): TransitionValidation {
  const { from, to } = input;

  if (!isVisaPipelineState(from) || !isVisaPipelineState(to)) {
    return { ok: false, code: "UNKNOWN_STATE", message: "Unknown pipeline state" };
  }

  // Same-state no-op (notes) — architecture §3.4
  if (from === to) {
    return { ok: true, def: null, noop: true };
  }

  if (from === "REJECTED_CLOSED") {
    return {
      ok: false,
      code: "TERMINAL",
      message: "REJECTED_CLOSED is terminal; reopen policy is out of T002",
    };
  }
  if (from === "COMPLETED") {
    return {
      ok: false,
      code: "TERMINAL",
      message: "COMPLETED cannot transition further in T002",
    };
  }

  const def = EDGE.get(`${from}->${to}`);
  if (!def) {
    return {
      ok: false,
      code: "FORBIDDEN",
      message: `Transition ${from} → ${to} is not allowed`,
    };
  }

  if (from === "NEW" && to === "MOFA" && input.hasVisaType === false) {
    return {
      ok: false,
      code: "GROUP_VISA_TYPE",
      message: "Group must have a visa type before entering MOFA",
    };
  }

  // T002-05 — EMBASSY requires consulate/embassy context or a captured embassyRef.
  if (to === "EMBASSY") {
    const ref = (input.embassyRef ?? "").trim() || (input.embassy ?? "").trim();
    if (!input.hasEmbassyContext && !ref) {
      return {
        ok: false,
        code: "EMBASSY_CONTEXT_REQUIRED",
        message:
          "Embassy/consulate context or embassyRef is required to enter EMBASSY stage",
      };
    }
  }

  if (from === "BIOMETRIC" && to === "SUBMITTED") {
    const bio = (input.biometricStatus ?? "").trim();
    if (!bio) {
      return {
        ok: false,
        code: "BIOMETRIC_REQUIRED",
        message: "Biometric status must be recorded before SUBMITTED",
      };
    }
  }

  if (from === "PROCESSING" && to === "ISSUED") {
    if (!input.visaNumber?.trim()) {
      return {
        ok: false,
        code: "VISA_NUMBER_REQUIRED",
        message: "Visa Number is required for PROCESSING → ISSUED",
      };
    }
  }

  if (from === "PROCESSING" && to === "REJECTED") {
    if (!input.reason?.trim()) {
      return {
        ok: false,
        code: "REASON_REQUIRED",
        message: "Rejection reason is required for PROCESSING → REJECTED",
      };
    }
  }

  if (from === "ISSUED" && to === "PASSPORT_RETURNED") {
    if (!input.custodyConfirmed) {
      return {
        ok: false,
        code: "CUSTODY_REQUIRED",
        message: "custodyConfirmed must be true for ISSUED → PASSPORT_RETURNED",
      };
    }
  }

  if (from === "ISSUED" && to === "COMPLETED" && input.requirePassportReturn) {
    return {
      ok: false,
      code: "PASSPORT_RETURN_REQUIRED",
      message:
        "VISA_REQUIRE_PASSPORT_RETURN is enabled; ISSUED must pass PASSPORT_RETURNED before COMPLETED",
    };
  }

  return { ok: true, def, noop: false };
}

/** Excel / T001 field echoes when advancing pipeline (§3.6). */
export function excelEchoForState(
  to: VisaPipelineState,
  ctx: { visaNumber?: string | null; biometricStatus?: string | null; reason?: string | null },
): {
  biometricStatus?: string | null;
  visaStatus?: "PENDING" | "APPROVED" | "REJECTED";
  visaStatusLabel?: string | null;
  visaRejectReason?: string | null;
} {
  switch (to) {
    case "NEW":
      return {
        biometricStatus: ctx.biometricStatus ?? null,
        visaStatus: "PENDING",
        visaStatusLabel: "Visa Not Issued",
      };
    case "MOFA":
    case "EMBASSY":
    case "SUBMITTED":
    case "PROCESSING":
      return {
        visaStatus: "PENDING",
        visaStatusLabel: "Visa Not Issued",
      };
    case "BIOMETRIC":
      return {
        biometricStatus: ctx.biometricStatus?.trim() || "Registered",
        visaStatus: "PENDING",
        visaStatusLabel: "Visa Not Issued",
      };
    case "ISSUED":
    case "PASSPORT_RETURNED":
    case "COMPLETED":
      return {
        biometricStatus: ctx.biometricStatus?.trim() || "Registered",
        visaStatus: "APPROVED",
        visaStatusLabel: "Visa Issued",
      };
    case "REJECTED":
      return {
        visaStatus: "REJECTED",
        visaStatusLabel: "Rejected",
        visaRejectReason: ctx.reason?.trim() || null,
      };
    case "REJECTED_CLOSED":
      return {
        visaStatus: "REJECTED",
        visaStatusLabel: "Rejected",
      };
    default:
      return {};
  }
}

/** Gate assist: fraction of mutamers in ISSUED / PASSPORT_RETURNED / COMPLETED. */
export function gateAssistSuggest(
  counts: { total: number; ready: number },
  threshold = 0.8,
): { suggestGateVisa: boolean; ready: number; total: number; threshold: number; ratio: number } {
  const total = counts.total;
  const ready = counts.ready;
  const ratio = total > 0 ? ready / total : 0;
  return {
    suggestGateVisa: total > 0 && ratio >= threshold,
    ready,
    total,
    threshold,
    ratio,
  };
}

export const GATE_READY_STATES: readonly VisaPipelineState[] = [
  "ISSUED",
  "PASSPORT_RETURNED",
  "COMPLETED",
];
