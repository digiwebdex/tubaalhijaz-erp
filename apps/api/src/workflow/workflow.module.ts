import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { WorkflowController } from "./workflow.controller";
import { ApprovalRuleController } from "./approval-rule.controller";
import { SlaController } from "./sla.controller";
import { WorkflowService } from "./workflow.service";

@Module({
  imports: [NotificationsModule],
  controllers: [WorkflowController, ApprovalRuleController, SlaController],
  providers: [WorkflowService],
})
export class WorkflowModule {}
