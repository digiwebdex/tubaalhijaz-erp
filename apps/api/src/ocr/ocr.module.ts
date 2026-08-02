import { Inject, Module, type OnModuleDestroy } from "@nestjs/common";
import { Queue } from "bullmq";
import { GroupsModule } from "../groups/groups.module";
import { OcrController } from "./ocr.controller";
import { OcrService } from "./ocr.service";
import { OcrProcessor } from "./ocr.processor";
import { VisionClient } from "./vision.client";
import { GeminiClient } from "./gemini.client";
import { OCR_BULL_PREFIX, OCR_QUEUE, OCR_QUEUE_NAME, makeOcrConnection } from "./ocr.constants";

/**
 * Document OCR pipeline. Domain event `passenger.ocr.completed` (EV.OCR_COMPLETED)
 * is emitted when a document is processed, so automation rules can react.
 * PrismaService + StorageService + EventEmitter2 are global; GroupsModule is
 * imported for PassengersService (passenger auto-fill on approve).
 */
@Module({
  imports: [GroupsModule],
  controllers: [OcrController],
  providers: [
    OcrService,
    OcrProcessor,
    VisionClient,
    GeminiClient,
    {
      provide: OCR_QUEUE,
      useFactory: () => new Queue(OCR_QUEUE_NAME, { connection: makeOcrConnection(), prefix: OCR_BULL_PREFIX }),
    },
  ],
})
export class OcrModule implements OnModuleDestroy {
  constructor(@Inject(OCR_QUEUE) private readonly queue: Queue) {}
  async onModuleDestroy() {
    await this.queue.close();
  }
}
