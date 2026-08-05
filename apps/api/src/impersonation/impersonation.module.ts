import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { ImpersonationController } from "./impersonation.controller";
import { ImpersonationService } from "./impersonation.service";

@Module({ imports: [AuthModule, NotificationsModule], controllers: [ImpersonationController], providers: [ImpersonationService] })
export class ImpersonationModule {}
