import { Controller, Get } from "@nestjs/common";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { PrismaService } from "../prisma/prisma.service";

/** SLA dashboard — configuration-driven from WorkflowStage.slaHours (no hardcoded hours). */
@Controller("sla")
export class SlaController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("dashboard") @RequirePermissions("VIEW_DASHBOARD")
  async dashboard() {
    const stages = await this.prisma.workflowStage.findMany({ select: { id: true, labelEn: true, slaHours: true } });
    const sla = new Map(stages.map((s) => [s.id, s.slaHours]));
    const groups = await this.prisma.group.findMany({
      where: { approvalStatus: { notIn: ["ARCHIVED", "COMPLETED"] } },
      select: { id: true, code: true, name: true, currentStage: true, stageEnteredAt: true, updatedAt: true, approvalStatus: true }, take: 500,
    });
    const now = Date.now();
    const rows = groups.map((g) => {
      const h = sla.get(g.currentStage) ?? null;
      const since = (g.stageEnteredAt ?? g.updatedAt).getTime();
      const hoursInStage = Math.round(((now - since) / 3_600_000) * 10) / 10;
      const status = h == null ? "NO_SLA" : hoursInStage > h ? "OVERDUE" : hoursInStage > h * 0.75 ? "AT_RISK" : "ON_TIME";
      return { id: g.id, code: g.code, name: g.name, stage: g.currentStage, approvalStatus: g.approvalStatus, slaHours: h, hoursInStage, status };
    });
    const summary = {
      OVERDUE: rows.filter((r) => r.status === "OVERDUE").length,
      AT_RISK: rows.filter((r) => r.status === "AT_RISK").length,
      ON_TIME: rows.filter((r) => r.status === "ON_TIME").length,
      NO_SLA: rows.filter((r) => r.status === "NO_SLA").length,
    };
    return { summary, rows };
  }
}
