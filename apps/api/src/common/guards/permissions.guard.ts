import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PrismaService } from "../../prisma/prisma.service";
import { PERMISSIONS_KEY } from "../decorators/require-permissions.decorator";
import { AuthUser } from "../decorators/current-user.decorator";

/**
 * Global permission guard. Routes annotated with @RequirePermissions(...)
 * are checked against the caller's role→permission rows IN THE DATABASE
 * (60s in-memory cache), so the Super Admin "User & Role Management"
 * screen can grant/revoke without code changes.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  private cache = new Map<string, { perms: Set<string>; at: number }>();
  private static TTL_MS = 60_000;

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const user = context.switchToHttp().getRequest().user as AuthUser | undefined;
    if (!user) throw new ForbiddenException("No authenticated user");

    const perms = await this.permissionsForRole(user.role);
    const missing = required.filter((p) => !perms.has(p));
    if (missing.length > 0) {
      throw new ForbiddenException(`Missing permission: ${missing.join(", ")}`);
    }
    return true;
  }

  /** Reused by non-HTTP entry points (e.g. Ops WebSocket handshake). */
  async roleHasPermission(roleKey: string, permission: string): Promise<boolean> {
    const perms = await this.permissionsForRole(roleKey);
    return perms.has(permission);
  }

  private async permissionsForRole(roleKey: string): Promise<Set<string>> {
    const hit = this.cache.get(roleKey);
    if (hit && Date.now() - hit.at < PermissionsGuard.TTL_MS) return hit.perms;

    const role = await this.prisma.role.findUnique({
      where: { key: roleKey },
      include: { permissions: { include: { permission: true } } },
    });
    const perms = new Set<string>(role?.permissions.map((rp) => rp.permission.key) ?? []);
    this.cache.set(roleKey, { perms, at: Date.now() });
    return perms;
  }
}
