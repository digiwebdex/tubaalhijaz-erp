import { Inject, Module, type OnModuleDestroy } from "@nestjs/common";
import { Queue } from "bullmq";
import { FinanceModule } from "../finance/finance.module";
import { ServicesModule } from "../services/services.module";
import { FleetModule } from "../fleet/fleet.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { OpsModule } from "../ops/ops.module";
import { AutomationController } from "./automation.controller";
import { AutomationService } from "./automation.service";
import { AutomationDispatcher } from "./automation.dispatcher";
import { AutomationProcessor } from "./automation.processor";
import { AutomationScheduler } from "./automation.scheduler";
import { AUTOMATION_QUEUE, BULL_PREFIX, QUEUE_NAME, makeConnection } from "./automation.constants";

/**
 * The rule + queue engine. Domain events (EventEmitter2) → AutomationDispatcher
 * → BullMQ jobs (VPS Redis) → AutomationProcessor. StorageService is global;
 * EventEmitterModule is registered globally in AppModule. Finance/Services/Fleet/
 * Ops are imported so job handlers can reuse their real services.
 */
@Module({
  imports: [FinanceModule, ServicesModule, FleetModule, NotificationsModule, OpsModule],
  controllers: [AutomationController],
  providers: [
    AutomationService,
    AutomationDispatcher,
    AutomationProcessor,
    AutomationScheduler,
    {
      provide: AUTOMATION_QUEUE,
      useFactory: () => new Queue(QUEUE_NAME, { connection: makeConnection(), prefix: BULL_PREFIX }),
    },
  ],
  exports: [AutomationService],
})
export class AutomationModule implements OnModuleDestroy {
  constructor(@Inject(AUTOMATION_QUEUE) private readonly queue: Queue) {}
  async onModuleDestroy() {
    await this.queue.close();
  }
}
