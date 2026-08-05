// ─── Domain event catalog ────────────────────────────────────────────────────
// Services emit these through NestJS EventEmitter2 (global). The Automation
// dispatcher subscribes, matches enabled AutomationRules on `eventKey`, and
// enqueues BullMQ jobs. Nothing downstream is hardcoded into the emitting
// service — that's the whole point: approving an agent emits `agent.approved`
// and the rule engine decides what happens next.

export const EV = {
  AGENT_REGISTERED: "agent.registered",
  AGENT_APPROVED: "agent.approved",
  AGENT_REJECTED: "agent.rejected",
  SUPPLIER_REGISTERED: "supplier.registered",
  GROUP_CREATED: "group.created",
  GROUP_COMPLETED: "group.completed",
  /** T001-02 — emitted when any readiness gate flips. Notify rules land in T001-08. */
  GROUP_GATES_CHANGED: "group.gates.changed",
  OCR_COMPLETED: "passenger.ocr.completed",
  /** T001-08 — Nusuk group-list OCR approved (create or update Group). */
  OCR_GROUP_COMMITTED: "group.ocr.committed",
  IMPORT_COMPLETED: "group.import.completed",
  SERVICE_STATUS_CHANGED: "service.status.changed",
  BOOKING_CONFIRMED: "booking.confirmed",
  INVOICE_GENERATED: "invoice.generated",
  VOUCHER_GENERATED: "voucher.generated",
  DOCUMENT_EXPIRING: "document.expiring",
  /** T002-03 — every pipeline transition (incl. no-op). Not a notify spam key. */
  PASSENGER_VISA_TRANSITIONED: "passenger.visa.transitioned",
  /** T002-03 emit → T002-04 AR-VISA-01 → NotificationEvent VISA_APPROVED */
  VISA_APPROVED: "visa.approved",
  /** T002-03 emit → T002-04 AR-VISA-02 → NotificationEvent VISA_REJECTED */
  VISA_REJECTED: "visa.rejected",
  /** T002-05 emit → AR-VISA-03 → NotificationEvent PASSPORT_RETURNED */
  VISA_PASSPORT_RETURNED: "visa.passport.returned",
  /**
   * T002-08 — Long Stay crossed day-85 (DUE) or day-90 (ESCALATED). Emitted by
   * the daily sweep only; `data.stage` gates AR-LS-85 vs AR-LS-90.
   */
  LONGSTAY_DAY85: "longstay.day85",
  /** Flight Management — operational status transition (board + rule engine). */
  FLIGHT_STATUS_CHANGED: "flight.status.changed",
  /** Flight Management — a flight was assigned to a group. */
  FLIGHT_ASSIGNED: "flight.assigned",
} as const;

export type EventKey = (typeof EV)[keyof typeof EV];
export const ALL_EVENT_KEYS: readonly string[] = Object.values(EV);
export const isEventKey = (k: unknown): k is EventKey =>
  typeof k === "string" && (ALL_EVENT_KEYS as string[]).includes(k);

/** The shape every domain emit carries. `data` is matched against rule conditions. */
export interface DomainPayload {
  key: EventKey;
  at: string;
  tenantId?: string | null; // company the event belongs to (notification routing)
  companyId?: string | null;
  entityType?: string; // "Company" | "Group" | "HotelBooking" | …
  entityId?: string;
  recipientUserId?: string | null;
  recipientAddress?: string | null; // email/phone when notifying externally
  title?: string; // human summary, used as a notification title fallback
  data: Record<string, unknown>; // event-specific fields (status, service, bookingId…)
}

/** Build a well-formed payload. `at` is stamped here so callers stay terse. */
export function buildEvent(
  key: EventKey,
  fields: Omit<DomainPayload, "key" | "at"> & { data?: Record<string, unknown> },
): DomainPayload {
  return { key, at: new Date().toISOString(), ...fields, data: fields.data ?? {} };
}
