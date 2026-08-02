import { NotificationChannel, NotificationPriority } from "@prisma/client";

export const NOTIFY_QUEUE = "NOTIFY_QUEUE"; // DI token for the BullMQ Queue
export const NOTIFY_QUEUE_NAME = "tuba-notify";

/** Result of a single channel send attempt. */
export interface ChannelResult {
  status: "SENT" | "FAILED" | "SKIPPED"; // SKIPPED = channel not configured (no creds)
  providerId?: string;
  error?: string;
}

/** A request to notify — the orchestrator fans this out to the enabled channels. */
export interface DispatchSpec {
  eventKey?: string | null; // NotificationEvent.key (drives template + channel matrix)
  channels?: NotificationChannel[]; // explicit override; else the event matrix decides
  priority?: NotificationPriority;
  tenantId?: string | null; // recipient company (routing + language)
  recipientUserId?: string | null;
  phone?: string | null; // explicit WhatsApp number (test sends / external)
  email?: string | null; // explicit email (test sends / external)
  title?: string;
  body?: string;
  vars?: Record<string, unknown>; // template variables
  lang?: "bn" | "en"; // override recipient's preferred language
  attachments?: { fileId?: string; filename?: string }[]; // PDFs pulled from storage (email)
  /** Deterministic NotificationLog.code — unique; duplicate dispatch is a no-op. */
  code?: string;
  /** Use title/body as-is (still links eventKey for eventId). For ad-hoc ops copy. */
  literalContent?: boolean;
}

// Emergency jumps the queue: BullMQ priority — lower number = higher priority.
export const jobPriority = (p?: NotificationPriority): number =>
  p === "EMERGENCY" ? 1 : p === "LOW" ? 20 : 10;

export const CHANNEL_STATUS = {
  SENT: "DELIVERED",
  FAILED: "FAILED",
  SKIPPED: "PENDING", // awaiting channel configuration
} as const;
