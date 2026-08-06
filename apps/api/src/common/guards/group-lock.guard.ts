import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { AuthUser } from "../decorators/current-user.decorator";

/**
 * Blocks foundation/passenger mutations on a LOCKED group.
 * Only the owning AGENT (or an admin impersonating that agent — request.user is the
 * agent under impersonation) is bound; staff/ops bypass so approvals/desk work continue.
 * Service-request endpoints simply don't apply this guard, so they stay editable.
 */
@Injectable()
export class GroupLockGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const user = req.user as AuthUser | undefined;
    if (!user || user.companyType !== "AGENT") return true; // staff/unknown → not lock-bound

    const params = (req.params ?? {}) as Record<string, string>;
    const path: string = req.route?.path ?? req.url ?? "";
    let groupId: string | undefined;
    if (params.groupId) groupId = params.groupId;
    else if (params.id && /passenger/i.test(path)) {
      const pax = await this.prisma.passenger.findUnique({ where: { id: params.id }, select: { groupId: true } });
      groupId = pax?.groupId ?? undefined;
    } else if (params.id) groupId = params.id;
    if (!groupId) return true;

    const group = await this.prisma.group.findUnique({ where: { id: groupId }, select: { locked: true, tenantId: true, code: true } });
    if (group?.locked && group.tenantId === user.companyId) {
      throw new ForbiddenException(`Group ${group.code} is locked after approval. Submit a Change Request to modify it.`);
    }
    return true;
  }
}
