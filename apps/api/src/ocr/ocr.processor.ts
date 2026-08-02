import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Job, Worker } from "bullmq";
import { OcrService } from "./ocr.service";
import { OCR_BULL_PREFIX, OCR_QUEUE_NAME, makeOcrConnection, type OcrJobData } from "./ocr.constants";

/**
 * BullMQ worker for the OCR queue. Runs in the same process as the API (like the
 * automation worker); can be split into a dedicated worker later with no code
 * change (same queue name + Redis). Vision/network failures throw so BullMQ
 * retries per the job's backoff.
 */
@Injectable()
export class OcrProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger("OcrWorker");
  private worker?: Worker<OcrJobData>;

  constructor(private readonly ocr: OcrService) {}

  onModuleInit() {
    this.worker = new Worker<OcrJobData>(
      OCR_QUEUE_NAME,
      (job: Job<OcrJobData>) => this.ocr.process(job.data.ocrDocumentId),
      { connection: makeOcrConnection(true), prefix: OCR_BULL_PREFIX, concurrency: 3 },
    );
    this.worker.on("failed", (job, err) => this.log.warn(`ocr job ${job?.id} failed: ${err.message}`));
    this.worker.on("completed", (job) => this.log.debug(`ocr job ${job.id} done`));
    this.log.log(`worker listening on ${OCR_QUEUE_NAME}`);
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }
}
