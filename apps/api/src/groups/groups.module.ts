import { Module } from "@nestjs/common";
import { GroupsController } from "./groups.controller";
import { GroupsService } from "./groups.service";
import { GroupPassengersController, PassengersController } from "./passengers.controller";
import { PassengersService } from "./passengers.service";
import { MutamerImportService } from "./mutamer-import.service";
import { VisaPipelineService } from "./visa-pipeline.service";

@Module({
  controllers: [GroupsController, GroupPassengersController, PassengersController],
  providers: [GroupsService, PassengersService, MutamerImportService, VisaPipelineService],
  exports: [GroupsService, PassengersService, MutamerImportService, VisaPipelineService],
})
export class GroupsModule {}
