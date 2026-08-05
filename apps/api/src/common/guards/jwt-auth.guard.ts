import { ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthGuard } from "@nestjs/passport";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { AuthUser } from "../decorators/current-user.decorator";
import { tenantContext } from "../tenant-context";
import { auditContext } from "../audit-context";

/**
 * Global JWT guard. Routes marked @Public() skip authentication.
 * On success it seeds the AsyncLocalStorage tenant context, which the
 * Prisma extension uses to scope EVERY query in the request — the
 * multi-tenant guard is therefore global, not per-endpoint.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Public routes stay reachable anonymously, but if a Bearer token is sent
    // we validate it and seed tenancy (needed so /uploads can stamp ownership).
    if (isPublic) {
      const req = context.switchToHttp().getRequest<{ headers?: { authorization?: string } }>();
      const auth = req.headers?.authorization;
      if (!auth?.startsWith("Bearer ")) return true;
      const ok = (await super.canActivate(context)) as boolean;
      if (ok) this.seedTenant(context);
      return ok;
    }

    const ok = (await super.canActivate(context)) as boolean;
    if (ok) this.seedTenant(context);
    return ok;
  }

  private seedTenant(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const user = req.user as AuthUser | undefined;
    const store = tenantContext.getStore();
    if (user && store) {
      store.userId = user.sub;
      store.roleKey = user.role;
      store.companyId = user.companyId;
      store.companyType = user.companyType;
    }
    const astore = auditContext.getStore();
    if (user && astore) {
      astore.actualUserId = user.impersonatorSub ?? user.sub;
      astore.actingAsUserId = user.impersonatorSub ? user.sub : null;
      astore.actorLabel = user.impersonatorSub ? `${user.impersonatorEmail ?? "admin"} on behalf of ${user.email}` : null;
      if (user.impersonationSessionId) { astore.sessionId = user.impersonationSessionId; astore.correlationId = user.impersonationSessionId; }
    }
  }
}
