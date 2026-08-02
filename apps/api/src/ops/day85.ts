// ─── T002-08 Day-85 compliance calculator ────────────────────────────────────
// Pure derivation over an existing LongStay row — no state column, no new
// entity. Architecture §8: "Day-85 | Derived from entry date + 85; store
// `day85NotifiedAt`". §12 tracks "Long Stay red cards (day-85/90)".
//
// Nothing here talks to Prisma or Nest: OpsService owns persistence, the
// Automation worker owns scheduling, this file owns the arithmetic.

/** Compliance thresholds in days since Kingdom entry (architecture §2.2 / §12). */
export const DAY85_DUE = 85;
export const DAY85_ESCALATE = 90;
/** Desk pre-warning window only — never notifies (§3.4 "no keystroke spam"). */
export const DAY85_APPROACH_WINDOW = 7;

export const DAY85_STAGES = [
  "NOT_TRACKED", // no entry date captured yet
  "TRACKING", // inside the stay, day-85 still far
  "APPROACHING", // within the desk pre-warning window
  "DUE", // day ≥ 85 — red card + multi-party notify
  "ESCALATED", // day ≥ 90 — overstay risk, emergency escalation
  "RESOLVED", // exited / completed / renewal approved
] as const;
export type Day85Stage = (typeof DAY85_STAGES)[number];

const DAY_MS = 86_400_000;

export interface Day85Input {
  entryDate?: Date | null;
  exitDate?: Date | null;
  status?: string | null; // LongStayStatus
  renewal?: string | null; // RenewalStatus
  day85NotifiedAt?: Date | null;
}

export interface Day85View {
  stage: Day85Stage;
  /** Days elapsed since Kingdom entry (0 on the entry day itself). */
  dayCount: number | null;
  /** entryDate + 85d — the compliance deadline. */
  dueAt: Date | null;
  /** entryDate + 90d — the escalation line. */
  escalateAt: Date | null;
  /** Negative once the deadline has passed. */
  daysToDue: number | null;
  /** Ops/Visa Desk red card (architecture §12). */
  redCard: boolean;
  resolved: boolean;
  /** Why the record counts as resolved — audit/UX copy. */
  resolvedBy: "EXIT_DATE" | "COMPLETED" | "RENEWAL_APPROVED" | null;
  notifiedAt: Date | null;
}

const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY_MS);

/** Whole days elapsed between two instants (floored, never negative-rounded). */
export function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / DAY_MS);
}

function resolution(row: Day85Input): Day85View["resolvedBy"] {
  if (row.exitDate) return "EXIT_DATE";
  if (row.status === "COMPLETED") return "COMPLETED";
  if (row.renewal === "APPROVED") return "RENEWAL_APPROVED";
  return null;
}

/**
 * Derive the compliance picture for one Long Stay. `now` is injectable so the
 * sweep, the API projection and the tests all agree on a single clock.
 */
export function day85View(row: Day85Input, now: Date = new Date()): Day85View {
  const resolvedBy = resolution(row);
  const entry = row.entryDate ?? null;

  if (!entry) {
    return {
      stage: resolvedBy ? "RESOLVED" : "NOT_TRACKED",
      dayCount: null,
      dueAt: null,
      escalateAt: null,
      daysToDue: null,
      redCard: false,
      resolved: Boolean(resolvedBy),
      resolvedBy,
      notifiedAt: row.day85NotifiedAt ?? null,
    };
  }

  const dueAt = addDays(entry, DAY85_DUE);
  const escalateAt = addDays(entry, DAY85_ESCALATE);
  const dayCount = daysBetween(entry, now);
  const daysToDue = daysBetween(now, dueAt);

  const stage: Day85Stage = resolvedBy
    ? "RESOLVED"
    : dayCount >= DAY85_ESCALATE
      ? "ESCALATED"
      : dayCount >= DAY85_DUE
        ? "DUE"
        : dayCount >= DAY85_DUE - DAY85_APPROACH_WINDOW
          ? "APPROACHING"
          : "TRACKING";

  return {
    stage,
    dayCount,
    dueAt,
    escalateAt,
    daysToDue,
    redCard: stage === "DUE" || stage === "ESCALATED",
    resolved: Boolean(resolvedBy),
    resolvedBy,
    notifiedAt: row.day85NotifiedAt ?? null,
  };
}

/** Deterministic NotificationLog code root — makes re-sends idempotent. */
export function day85NotifyCode(longStayId: string, stage: Day85Stage): string {
  return `LS85-${longStayId}-${stage}`;
}

export const isDay85Stage = (v: unknown): v is Day85Stage =>
  typeof v === "string" && (DAY85_STAGES as readonly string[]).includes(v);
