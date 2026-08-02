import IORedis from "ioredis";

/** DI token for the OCR BullMQ Queue. */
export const OCR_QUEUE = "OCR_QUEUE";
/** BullMQ queue + job names. Own queue, shares the VPS Redis db3 namespace. */
export const OCR_QUEUE_NAME = "tuba-ocr";
export const OCR_BULL_PREFIX = "tuba";
export const OCR_JOB = "OCR_PROCESS";

export interface OcrJobData {
  ocrDocumentId: string;
}

/** Per-field confidence policy (0..1). */
export const OCR_CONF = {
  /** >= this → a field is treated as high-confidence. */
  ACCEPT: 0.9,
  /** < this → a field is flagged `low` for reviewer attention. */
  LOW: 0.6,
} as const;

/**
 * T001-07 — Nusuk Group List OCR (approve → Group).
 * Default OFF: type rejected at create/approve and hidden in UI until enabled.
 */
export function isNusukGroupListOcrEnabled(): boolean {
  const v = (process.env.ENABLE_NUSUK_GROUP_LIST_OCR ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

/**
 * A BullMQ-ready ioredis connection from REDIS_URL. Workers REQUIRE
 * `maxRetriesPerRequest: null` (BullMQ blocks otherwise); the queue side keeps a
 * bounded retry. Mirrors the automation engine's helper (same Redis, db3).
 */
export function makeOcrConnection(forWorker = false): IORedis {
  const url = process.env.REDIS_URL ?? "redis://127.0.0.1:6399/3";
  return new IORedis(url, {
    maxRetriesPerRequest: forWorker ? null : 3,
    enableReadyCheck: true,
  });
}
