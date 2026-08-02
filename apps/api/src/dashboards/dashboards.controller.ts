import { BadRequestException, Controller, Get, Query } from "@nestjs/common";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { AuthUser, CurrentUser } from "../common/decorators/current-user.decorator";
import { PrismaService } from "../prisma/prisma.service";
import { DashboardsService } from "./dashboards.service";

/**
 * Staff dashboards overview (route /dashboards). All figures are live aggregates.
 * The Agent/Supplier tabs show a representative tenant: the caller's own company
 * if they have one, else the first company of that type (staff viewing).
 */
@Controller("dashboards")
@RequirePermissions("VIEW_DASHBOARD")
export class DashboardsController {
  constructor(
    private readonly dashboards: DashboardsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get("ceo") ceo() { return this.dashboards.ceo(); }
  @Get("ops") ops() { return this.dashboards.ops(); }
  /** T002-09 — Visa / MOFA / Long-Stay backlog widgets (architecture §12). Read-only. */
  @Get("visa") visa() { return this.dashboards.visa(); }
  @Get("finance") finance() { return this.dashboards.finance(); }
  @Get("dispatch") dispatch() { return this.dashboards.dispatch(); }
  @Get("arrivals") arrivals(@Query("date") date?: string) { return this.dashboards.board("ARRIVAL", date); }
  @Get("departures") departures(@Query("date") date?: string) { return this.dashboards.board("DEPARTURE", date); }

  @Get("agent") async agent(@CurrentUser() user: AuthUser, @Query("companyId") companyId?: string) {
    return this.dashboards.agent(await this.resolveCompany("AGENT", user, companyId));
  }
  @Get("supplier") async supplier(@CurrentUser() user: AuthUser, @Query("companyId") companyId?: string) {
    return this.dashboards.supplier(await this.resolveCompany("SUPPLIER", user, companyId));
  }

  private async resolveCompany(type: "AGENT" | "SUPPLIER", user: AuthUser, queryId?: string): Promise<string> {
    if (queryId) return queryId;
    if (user.companyId && user.companyType === type) return user.companyId;
    const first = await this.prisma.company.findFirst({
      where: { type, ...(type === "AGENT" ? { verificationStatus: "VERIFIED" } : {}) },
      orderBy: { joinedAt: "asc" }, select: { id: true },
    });
    if (!first) throw new BadRequestException(`No ${type.toLowerCase()} company available`);
    return first.id;
  }
}
