import { Controller, ForbiddenException, Get, Query } from "@nestjs/common";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { AuthUser, CurrentUser } from "../common/decorators/current-user.decorator";
import { AuditService } from "./audit.service";
import { ListAuditLogsQueryDto } from "./audit.dto";

/**
 * Read-only audit trail over Prisma `AuditLog`.
 *
 * Auth: `ACCESS_AUDIT_LOGS` (existing RBAC). Tenant JWTs (`companyId` set) are
 * rejected — the table is platform-scoped (no tenant column); agents must not
 * browse the global trail.
 *
 * Severity is not stored on AuditLog — no severity filter.
 */
@Controller("audit-logs")
@RequirePermissions("ACCESS_AUDIT_LOGS")
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(@Query() query: ListAuditLogsQueryDto, @CurrentUser() user: AuthUser) {
    if (user.companyId) {
      throw new ForbiddenException("Audit logs are available to internal staff only");
    }
    return this.audit.list(query);
  }
}
