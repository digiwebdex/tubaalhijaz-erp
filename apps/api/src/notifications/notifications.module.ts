import { forwardRef, Inject, Module, type OnModuleDestroy } from "@nestjs/common";
import { Queue } from "bullmq";
import { AuthModule } from "../auth/auth.module";
import { BULL_PREFIX, makeConnection } from "../automation/automation.constants";
import { NOTIFY_QUEUE, NOTIFY_QUEUE_NAME } from "./notifications.constants";
import { NotificationsController } from "./notifications.controller";
import { NotificationAdminController } from "./notification-admin.controller";
import { NotificationAdminService } from "./notification-admin.service";
import { NotificationsService } from "./notifications.service";
import { NotificationsWorker } from "./notifications.worker";
import { NotificationsGateway } from "./notifications.gateway";
import { TemplateService } from "./templates.service";
import { WhatsAppChannel } from "./channels/whatsapp.channel";
import { EmailChannel } from "./channels/email.channel";

/**
 * Real notification delivery (Phase 11). Dispatch → per-channel NotificationLog +
 * BullMQ send jobs (VPS Redis) → worker → WhatsApp (WASender) / Email (SMTP) /
 * In-App (WS gateway). Exports NotificationsService so the Automation engine's
 * SEND_NOTIFICATION / ESCALATE actions deliver for real.
 */
@Module({
  // forwardRef: AuthModule needs NOTIFY_QUEUE to enqueue password-reset mail, and this
  // module needs AuthModule's JwtService for the /notifications handshake (S2-02).
  imports: [forwardRef(() => AuthModule)],
  controllers: [NotificationsController, NotificationAdminController],
  providers: [
    NotificationsService,
    NotificationAdminService,
    NotificationsWorker,
    NotificationsGateway,
    TemplateService,
    WhatsAppChannel,
    EmailChannel,
    {
      provide: NOTIFY_QUEUE,
      useFactory: () => new Queue(NOTIFY_QUEUE_NAME, { connection: makeConnection(), prefix: BULL_PREFIX }),
    },
  ],
  exports: [NotificationsService, EmailChannel, NOTIFY_QUEUE],
})
export class NotificationsModule implements OnModuleDestroy {
  constructor(@Inject(NOTIFY_QUEUE) private readonly queue: Queue) {}
  async onModuleDestroy() {
    await this.queue.close();
  }
}
