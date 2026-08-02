import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import type { Queue } from "bullmq";
import { AUTOMATION_QUEUE, SCHED } from "./automation.constants";
import type { JobData } from "./actions";

/**
 * Registers the repeatable (cron) system jobs on the BullMQ queue. Uses
 * `upsertJobScheduler` so re-registering on every boot is idempotent — no
 * duplicate schedules pile up. All three are real BullMQ repeatables backed by
 * the VPS Redis (survive process restarts).
 */
@Injectable()
export class AutomationScheduler implements OnModuleInit {
  private readonly log = new Logger("AutomationScheduler");

  constructor(@Inject(AUTOMATION_QUEUE) private readonly queue: Queue<JobData>) {}

  async onModuleInit() {
    const schedules: Array<[string, string, string]> = [
      ["daily-backup", "0 2 * * *", SCHED.DAILY_BACKUP], // 02:00 every day
      ["cloud-backup", "0 3 * * 0", SCHED.CLOUD_BACKUP], // 03:00 every Sunday
      // Sole 06:00 expiry schedule (S2-03) — Nest @Cron twin removed from ExpiryService.
      ["expiry-escalation", "0 6 * * *", SCHED.EXPIRY],
      // T002-08 — day-85 compliance sweep. Runs after expiry so the two 06:00
      // sweeps don't contend for the same worker slot.
      ["longstay-day85", "15 6 * * *", SCHED.DAY85],
    ];
    for (const [id, pattern, name] of schedules) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (this.queue as any).upsertJobScheduler(id, { pattern }, { name, data: {} });
    }
    this.log.log(`registered ${schedules.length} repeatable jobs`);
  }
}
