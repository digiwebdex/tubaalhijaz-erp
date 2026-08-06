import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { NotificationsService } from "../notifications/notifications.service";
import { auditContext } from "../common/audit-context";
import type { AuthUser } from "../common/decorators/current-user.decorator";

const DEFAULT_MINUTES = 30;

/** F01 — secure admin impersonation. Actual user stays the admin; working context becomes the agent. */
@Injectable()
export class ImpersonationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    private readonly notify: NotificationsService,
  ) {}

  private async maxMinutes(): Promise<number> {
    const p = await this.prisma.securityPolicy.findUnique({ where: { key: "default" } });
    return p?.impersonationMaxMinutes ?? DEFAULT_MINUTES;
  }

  // ── Agent search (company / name / email / mobile / code / status) ──────────
  async listAgents(f: { q?: string; companyId?: string; status?: string }) {
    const where: Prisma.UserWhereInput = { company: { type: "AGENT" } };
    if (f.companyId) where.companyId = f.companyId;
    if (f.status) where.status = f.status as never;
    if (f.q) {
      const s = f.q;
      where.OR = [
        { name: { contains: s, mode: "insensitive" } },
        { email: { contains: s, mode: "insensitive" } },
        { phone: { contains: s, mode: "insensitive" } },
        { code: { contains: s, mode: "insensitive" } },
      ];
    }
    const rows = await this.prisma.user.findMany({
      where, orderBy: { name: "asc" }, take: 100,
      select: { id: true, code: true, name: true, email: true, phone: true, status: true, company: { select: { id: true, name: true } } },
    });
    return rows;
  }

  // ── Start ────────────────────────────────────────────────────────────────────
  async start(admin: AuthUser, dto: { agentUserId: string; reason: string }) {
    if (!dto.reason?.trim()) throw new BadRequestException("A reason is required to start impersonation");
    const agent = await this.prisma.user.findUnique({ where: { id: dto.agentUserId }, include: { role: true, company: true } });
    if (!agent) throw new NotFoundException("Agent not found");
    if (agent.company?.type !== "AGENT") throw new BadRequestException("Only agent accounts can be impersonated");
    if (agent.status !== "ACTIVE") throw new BadRequestException("Agent account is not active");

    const ctx = auditContext.getStore();
    const session = await this.prisma.impersonationSession.create({
      data: { adminUserId: admin.sub, agentUserId: agent.id, reason: dto.reason.trim(), ip: ctx?.ip ?? null, userAgent: ctx?.userAgent ?? null },
    });

    // No privilege escalation: token carries the AGENT's identity/role/company only.
    const payload = {
      sub: agent.id, email: agent.email, role: agent.role.key, companyId: agent.companyId, companyType: "AGENT",
      impersonatorSub: admin.sub, impersonatorEmail: admin.email, impersonationSessionId: session.id,
    };
    const minutes = await this.maxMinutes();
    // Short-lived, NO refresh token issued.
    const accessToken = await this.jwt.signAsync(payload, { expiresIn: `${minutes}m` });

    await this.audit.log({
      action: "PROCESS", module: "Impersonation", entityType: "User", entityId: agent.id, reason: dto.reason.trim(),
      after: { event: "IMPERSONATION_STARTED", sessionId: session.id, agent: agent.email }, workflowId: session.id,
    });

    const expiresAt = new Date(session.startedAt.getTime() + minutes * 60_000);
    return {
      accessToken, tokenType: "Bearer", expiresInSeconds: minutes * 60,
      session: {
        id: session.id, reason: session.reason, startedAt: session.startedAt, expiresAt,
        admin: { id: admin.sub, email: admin.email },
        agent: { id: agent.id, name: agent.name, email: agent.email, code: agent.code },
      },
    };
  }

  // ── Active session (for the banner) ──────────────────────────────────────────
  async active(user: AuthUser) {
    if (!user.impersonationSessionId) return { impersonating: false as const };
    const s = await this.prisma.impersonationSession.findUnique({ where: { id: user.impersonationSessionId } });
    if (!s || s.endedAt) return { impersonating: false as const };
    const [admin, agent] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: s.adminUserId }, select: { id: true, name: true, email: true } }),
      this.prisma.user.findUnique({ where: { id: s.agentUserId }, select: { id: true, name: true, email: true, code: true } }),
    ]);
    const minutes = await this.maxMinutes();
    const expiresAt = new Date(s.startedAt.getTime() + minutes * 60_000);
    return {
      impersonating: true as const, sessionId: s.id, reason: s.reason, startedAt: s.startedAt, expiresAt,
      remainingSeconds: Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000)), admin, agent,
    };
  }

  // ── Stop (+ summary + one notification to the agent) ────────────────────────
  async stop(user: AuthUser) {
    if (!user.impersonationSessionId) throw new BadRequestException("Not in an impersonation session");
    const session = await this.prisma.impersonationSession.findUnique({ where: { id: user.impersonationSessionId } });
    if (!session) throw new NotFoundException("Session not found");
    if (session.endedAt) return { ok: true, alreadyEnded: true, actionCount: session.actionCount ?? 0, summary: session.summary ?? "" };

    const rows = await this.prisma.auditLog.findMany({ where: { correlationId: session.id }, orderBy: { createdAt: "asc" } });
    const domain = rows.filter((r) => r.module !== "Impersonation");
    const actionCount = domain.length;
    const parts = domain.map((r) => `${r.action} ${r.module}/${r.entityType}`);
    const summary = parts.length ? Array.from(new Set(parts)).slice(0, 20).join("; ") : "No changes made";

    await this.prisma.impersonationSession.update({ where: { id: session.id }, data: { endedAt: new Date(), actionCount, summary } });
    await this.audit.log({
      action: "PROCESS", module: "Impersonation", entityType: "User", entityId: session.agentUserId,
      after: { event: "IMPERSONATION_ENDED", sessionId: session.id, actionCount }, workflowId: session.id,
    });

    // Exactly ONE summary notification to the agent (per the locked design — no per-action spam during impersonation).
    await this.notify
      .dispatch({
        recipientUserId: session.agentUserId, channels: ["IN_APP", "EMAIL", "WHATSAPP"], priority: "NORMAL", literalContent: true,
        title: "Administrator account access — summary",
        body: `An administrator accessed your account (reason: ${session.reason}). ${actionCount} action(s) were performed: ${summary}.`,
      })
      .catch(() => undefined);

    return { ok: true, actionCount, summary };
  }

  // ── Force logout (revokes all refresh tokens) ────────────────────────────────
  async forceLogout(userId: string) {
    const res = await this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await this.audit.log({ action: "PROCESS", module: "Security", entityType: "User", entityId: userId, after: { event: "FORCE_LOGOUT", revoked: res.count } });
    return { ok: true, revoked: res.count };
  }

  // ── Security policy (force-logout / impersonation limits) ────────────────────
  async getPolicy() {
    return this.prisma.securityPolicy.upsert({ where: { key: "default" }, create: { key: "default" }, update: {} });
  }
  async setPolicy(dto: { impersonationMaxMinutes?: number; forceLogoutOnRoleChange?: boolean; forceLogoutOnLock?: boolean; maxSessionMinutes?: number | null }) {
    const data: Prisma.SecurityPolicyUpdateInput = {};
    if (dto.impersonationMaxMinutes !== undefined) data.impersonationMaxMinutes = dto.impersonationMaxMinutes;
    if (dto.forceLogoutOnRoleChange !== undefined) data.forceLogoutOnRoleChange = dto.forceLogoutOnRoleChange;
    if (dto.forceLogoutOnLock !== undefined) data.forceLogoutOnLock = dto.forceLogoutOnLock;
    if (dto.maxSessionMinutes !== undefined) data.maxSessionMinutes = dto.maxSessionMinutes;
    return this.prisma.securityPolicy.upsert({ where: { key: "default" }, create: { key: "default", ...(data as object) }, update: data });
  }
}
