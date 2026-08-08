import { Controller, Get, Param, Query } from "@nestjs/common";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { CommandCenterService } from "./command-center.service";

/**
 * Phase 10F — Flight Operations Command Center (read-only orchestration).
 * All mutations stay on their owning phase's endpoints (10B status, 10D dispatch,
 * 10E Meet & Assist) so there is one write path and one audit trail per domain.
 * Reuses the existing MANAGE_FLIGHTS permission — no new permission.
 */
@Controller("command-center")
@RequirePermissions("MANAGE_FLIGHTS")
export class CommandCenterController {
  constructor(private readonly svc: CommandCenterService) {}

  @Get("overview") overview(@Query("date") date?: string) { return this.svc.overview(date); }
  @Get("board") board(@Query() q: Record<string, string>) { return this.svc.board(q); }
  @Get("exceptions") exceptions(@Query("date") date?: string) { return this.svc.exceptions(date); }
  @Get("options") options() { return this.svc.options(); }
  @Get("flights/:id") detail(@Param("id") id: string) { return this.svc.detail(id); }
}
