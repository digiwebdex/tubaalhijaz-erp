import { Module } from "@nestjs/common";
import { FinanceModule } from "../finance/finance.module";
import { OpsModule } from "../ops/ops.module";
import { DashboardsController } from "./dashboards.controller";
import { DashboardsService } from "./dashboards.service";
import { DashboardCache } from "./dashboard-cache.service";

/**
 * Live dashboard aggregations (Phase 12). Reuses the audited Finance ReportsService
 * so the numbers agree with Finance ERP, and (T002-09) the Ops Visa Desk / Long Stay
 * services so visa + day-85 KPIs agree with the screens they drill into.
 * Caches heavy rollups in Redis (short TTL).
 */
@Module({
  imports: [FinanceModule, OpsModule],
  controllers: [DashboardsController],
  providers: [DashboardsService, DashboardCache],
})
export class DashboardsModule {}
