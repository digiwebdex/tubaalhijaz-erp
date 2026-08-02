import IORedis from "ioredis";

export const AUTOMATION_QUEUE = "AUTOMATION_QUEUE"; // DI token for the BullMQ Queue
export const QUEUE_NAME = "tuba-automation"; // BullMQ queue name
export const BULL_PREFIX = "tuba"; // key namespace (shared VPS redis, dedicated db3)

/** Repeatable (cron) system jobs — distinct job names handled directly by the worker. */
export const SCHED = {
  DAILY_BACKUP: "SCHED_DAILY_BACKUP",
  CLOUD_BACKUP: "SCHED_CLOUD_BACKUP",
  EXPIRY: "SCHED_EXPIRY",
  /** T002-08 — Long Stay day-85 compliance sweep. */
  DAY85: "SCHED_DAY85",
} as const;
export type SchedName = (typeof SCHED)[keyof typeof SCHED];
// system rule codes the scheduled runs log against (seeded)
export const SYS_RULE_CODE: Record<SchedName, string> = {
  SCHED_DAILY_BACKUP: "SYS_DAILY_BACKUP",
  SCHED_CLOUD_BACKUP: "SYS_CLOUD_BACKUP",
  SCHED_EXPIRY: "SYS_EXPIRY_ESCALATION",
  SCHED_DAY85: "SYS_LONGSTAY_DAY85",
};

/**
 * A BullMQ-ready ioredis connection from REDIS_URL. Workers REQUIRE
 * `maxRetriesPerRequest: null` (BullMQ blocks otherwise); the queue side keeps a
 * bounded retry. Missing REDIS_URL falls back to the tunnelled dev default.
 */
export function makeConnection(forWorker = false): IORedis {
  const url = process.env.REDIS_URL ?? "redis://127.0.0.1:6399/3";
  return new IORedis(url, {
    maxRetriesPerRequest: forWorker ? null : 3,
    enableReadyCheck: true,
  });
}
