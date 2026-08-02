/**
 * T002-02 — read-only Mutamer Visa Desk helpers.
 * Pipeline state machine persistence/transitions are T002-03.
 * Until then, derive a display/filter state from T001 Passenger fields (§3.6).
 */

export const DESK_VISA_STATES = [
  "NEW",
  "BIOMETRIC",
  "ISSUED",
  "REJECTED",
] as const;

export type DeskVisaState = (typeof DESK_VISA_STATES)[number];

export type PassengerVisaFields = {
  biometricStatus?: string | null;
  visaNumber?: string | null;
  visaStatus?: string | null;
  visaStatusLabel?: string | null;
};

/** Map T001 fields → desk visa state (architecture §3.6 subset). */
export function deriveDeskVisaState(p: PassengerVisaFields): DeskVisaState {
  const label = (p.visaStatusLabel ?? "").trim().toLowerCase();
  if (p.visaStatus === "REJECTED" || label.includes("reject")) return "REJECTED";

  // "Visa Not Issued" must not match the substring "issued".
  const notIssued =
    label.includes("not issued") ||
    label.includes("not-issued") ||
    label.includes("visa not");
  const looksIssued =
    p.visaStatus === "APPROVED" ||
    !!(p.visaNumber && p.visaNumber.trim()) ||
    (!notIssued && (label.includes("issued") || label.includes("approved")));
  if (looksIssued) return "ISSUED";

  const bio = (p.biometricStatus ?? "").trim().toLowerCase();
  if (bio && !isEmptyishBiometric(bio)) return "BIOMETRIC";
  return "NEW";
}

function isEmptyishBiometric(bio: string): boolean {
  return (
    bio === "" ||
    bio === "-" ||
    bio === "—" ||
    bio === "n/a" ||
    bio === "na" ||
    bio === "pending" ||
    bio === "not registered" ||
    bio === "empty"
  );
}

/**
 * T002-09 §12 "Biometric registered, visa not issued" backlog.
 * Biometric is a T001 free-text field, so reuse the same emptyish exclusions as
 * `deskVisaStateWhere`; "not issued" is read from the T002-03 pipeline column,
 * which AD-T002-01 makes the source of truth once a mutamer is on the desk.
 */
export const NOT_ISSUED_PIPELINE_STATES = [
  "NEW",
  "MOFA",
  "EMBASSY",
  "BIOMETRIC",
  "SUBMITTED",
  "PROCESSING",
] as const;

export function biometricBacklogWhere(): Record<string, unknown> {
  return {
    AND: [
      { visaPipelineStatus: { in: [...NOT_ISSUED_PIPELINE_STATES] } },
      { biometricStatus: { not: null } },
      { NOT: { biometricStatus: "" } },
      { NOT: { biometricStatus: { equals: "pending", mode: "insensitive" } } },
      { NOT: { biometricStatus: { equals: "not registered", mode: "insensitive" } } },
    ],
  };
}

/** Prisma-friendly where fragment approximating a desk visa state. */
export function deskVisaStateWhere(state: DeskVisaState): Record<string, unknown> {
  switch (state) {
    case "REJECTED":
      return {
        OR: [
          { visaStatus: "REJECTED" },
          { visaStatusLabel: { contains: "Reject", mode: "insensitive" } },
        ],
      };
    case "ISSUED":
      return {
        OR: [
          { visaStatus: "APPROVED" },
          { AND: [{ visaNumber: { not: null } }, { NOT: { visaNumber: "" } }] },
          {
            AND: [
              { visaStatusLabel: { contains: "Issued", mode: "insensitive" } },
              { NOT: { visaStatusLabel: { contains: "Not Issued", mode: "insensitive" } } },
            ],
          },
          { visaStatusLabel: { contains: "Approved", mode: "insensitive" } },
        ],
      };
    case "BIOMETRIC":
      return {
        AND: [
          { visaStatus: { not: "REJECTED" } },
          { visaStatus: { not: "APPROVED" } },
          { OR: [{ visaNumber: null }, { visaNumber: "" }] },
          { biometricStatus: { not: null } },
          { NOT: { biometricStatus: "" } },
          // Exclude emptyish biometric labels that still look "set"
          { NOT: { biometricStatus: { equals: "pending", mode: "insensitive" } } },
          { NOT: { biometricStatus: { equals: "not registered", mode: "insensitive" } } },
        ],
      };
    case "NEW":
    default:
      return {
        AND: [
          { visaStatus: { not: "REJECTED" } },
          { visaStatus: { not: "APPROVED" } },
          { OR: [{ visaNumber: null }, { visaNumber: "" }] },
          {
            OR: [
              { biometricStatus: null },
              { biometricStatus: "" },
              { biometricStatus: { equals: "pending", mode: "insensitive" } },
              { biometricStatus: { equals: "not registered", mode: "insensitive" } },
            ],
          },
        ],
      };
  }
}
