import { Module } from "@nestjs/common";
import { OpsModule } from "../ops/ops.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { FleetController, VehicleGpsController } from "./fleet.controller";
import { FleetService } from "./fleet.service";
import { ExpiryService } from "./expiry.service";

@Module({
  imports: [
    OpsModule, // OpsGateway → live dispatch-board push on assignment
    NotificationsModule, // expiry alerts → tuba-notify via dispatch (S2-03)
  ],
  controllers: [FleetController, VehicleGpsController],
  providers: [FleetService, ExpiryService],
  exports: [FleetService, ExpiryService], // AutomationModule's scheduled expiry sweep uses both
})
export class FleetModule {}
