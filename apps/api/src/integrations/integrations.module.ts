import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { IntegrationsController } from "./integrations.controller";
import { IntegrationsService } from "./integrations.service";

@Module({ imports: [NotificationsModule], controllers: [IntegrationsController], providers: [IntegrationsService] })
export class IntegrationsModule {}
