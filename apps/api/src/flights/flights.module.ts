import { Module } from "@nestjs/common";
import { FlightsController } from "./flights.controller";
import { FlightsService } from "./flights.service";
import { FlightMasterController } from "./flight-master.controller";
import { FlightMasterService } from "./flight-master.service";
import { OperationalFlightController } from "./operational-flight.controller";
import { OperationalFlightService } from "./operational-flight.service";
import { GroundOpsController } from "./ground-ops.controller";
import { GroundOpsService } from "./ground-ops.service";
import { MeetAssistController } from "./meet-assist.controller";
import { MeetAssistService } from "./meet-assist.service";
import { CommandCenterController } from "./command-center.controller";
import { CommandCenterService } from "./command-center.service";
import { OpsModule } from "../ops/ops.module";

@Module({
  imports: [OpsModule],
  controllers: [FlightsController, FlightMasterController, OperationalFlightController, GroundOpsController, MeetAssistController, CommandCenterController],
  providers: [FlightsService, FlightMasterService, OperationalFlightService, GroundOpsService, MeetAssistService, CommandCenterService],
  exports: [FlightMasterService, OperationalFlightService],
})
export class FlightsModule {}
