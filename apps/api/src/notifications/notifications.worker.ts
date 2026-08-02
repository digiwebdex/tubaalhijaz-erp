import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Worker } from "bullmq";
import { BULL_PREFIX, makeConnection } from "../automation/automation.constants";
import { NOTIFY_QUEUE_NAME } from "./notifications.constants";
import { NotificationsService, type SendJob } from "./notifications.service";

/**
 * BullMQ worker for notification delivery. Each job is one channel send for one
 * NotificationLog; failures throw so BullMQ retries (4 attempts, exp backoff).
 * Concurrency lets emergency fan-out (3 priority-1 jobs) send simultaneously.
 */
@Injectable()
export class NotificationsWorker implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger("NotificationsWorker");
  private worker?: Worker<SendJob>;

  constructor(private readonly notifications: NotificationsService) {}

  onModuleInit() {
    this.worker = new Worker<SendJob>(NOTIFY_QUEUE_NAME, (job) => this.notifications.deliverLog(job.data), {
      connection: makeConnection(true),
      prefix: BULL_PREFIX,
      concurrency: 8,
    });
    this.worker.on("failed", (job, err) => this.log.warn(`send ${job?.id} failed: ${err.message}`));
    this.log.log(`worker listening on ${NOTIFY_QUEUE_NAME}`);
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }
}
