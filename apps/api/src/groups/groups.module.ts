import { Module } from "@nestjs/common";
import { GroupsController } from "./groups.controller";
import { GroupLockGuard } from "../common/guards/group-lock.guard";
import { GroupsService } from "./groups.service";
import { GroupPassengersController, PassengersController } from "./passengers.controller";
import { PassengersService } from "./passengers.service";
import { MutamerImportService } from "./mutamer-import.service";
import { VisaPipelineService } from "./visa-pipeline.service";

@Module({
  controllers: [GroupsController, GroupPassengersController, PassengersController],
  providers: [GroupsService, PassengersService, MutamerImportService, VisaPipelineService, GroupLockGuard],
  exports: [GroupsService, PassengersService, MutamerImportService, VisaPipelineService],
})
export class GroupsModule {}
