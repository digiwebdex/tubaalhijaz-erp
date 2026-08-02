import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { OpsController } from "./ops.controller";
import { OpsService } from "./ops.service";
import { OpsGateway } from "./ops.gateway";

@Module({
  imports: [AuthModule], // JwtService for /ops handshake (S1-03)
  controllers: [OpsController],
  providers: [OpsService, OpsGateway, PermissionsGuard],
  // FleetModule broadcasts dispatch assignments on the gateway; the Automation
  // worker calls OpsService.day85Sweep() from the daily cron (T002-08).
  exports: [OpsGateway, OpsService],
})
export class OpsModule {}
