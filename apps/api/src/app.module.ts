import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { LoggingInterceptor } from "./common/interceptors/logging.interceptor";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { CompaniesModule } from "./companies/companies.module";
import { GroupsModule } from "./groups/groups.module";
import { HealthModule } from "./health/health.module";
import { StorageModule } from "./storage/storage.module";
import { UploadsModule } from "./uploads/uploads.module";
import { UsersModule } from "./users/users.module";
import { EnquiriesModule } from "./enquiries/enquiries.module";
import { RatesModule } from "./rates/rates.module";
import { FlightsModule } from "./flights/flights.module";
import { WorkflowModule } from "./workflow/workflow.module";
import { ImpersonationModule } from "./impersonation/impersonation.module";
import { IntegrationsModule } from "./integrations/integrations.module";
import { ServicesModule } from "./services/services.module";
import { FinanceModule } from "./finance/finance.module";
import { OpsModule } from "./ops/ops.module";
import { FleetModule } from "./fleet/fleet.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { AutomationModule } from "./automation/automation.module";
import { DashboardsModule } from "./dashboards/dashboards.module";
import { DocumentsModule } from "./documents/documents.module";
import { OcrModule } from "./ocr/ocr.module";
import { MetricsModule } from "./metrics/metrics.module";
import { MetricsInterceptor } from "./metrics/metrics.interceptor";
import { AuditModule } from "./audit/audit.module";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { PermissionsGuard } from "./common/guards/permissions.guard";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot({ wildcard: true, delimiter: "." }), // domain events → automation engine
    // Rate limiting: lenient global DoS net (200/min); auth + uploads tightened per-route.
    // Skipped in tests (e2e hammers the API from one IP).
    ThrottlerModule.forRoot({
      skipIf: () => process.env.NODE_ENV === "test",
      throttlers: [{ name: "default", ttl: 60_000, limit: 200 }],
    }),
    PrismaModule,
    StorageModule,
    AuthModule,
    CompaniesModule,
    GroupsModule,
    UploadsModule,
    UsersModule,
    EnquiriesModule,
    RatesModule,
    ServicesModule,
    FinanceModule,
    OpsModule,
    FlightsModule,
    WorkflowModule,
    ImpersonationModule,
    IntegrationsModule,
    FleetModule,
    NotificationsModule,
    AutomationModule,
    DashboardsModule,
    DocumentsModule,
    OcrModule,
    AuditModule,
    MetricsModule,
    HealthModule,
  ],
  providers: [
    // Guard order matters: rate-limit first, then authenticate, then permission-check.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: MetricsInterceptor },
  ],
})
export class AppModule {}
