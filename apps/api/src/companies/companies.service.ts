import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { CompanyType, VerificationStatus } from "@prisma/client";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { PrismaService } from "../prisma/prisma.service";
import { AuthUser } from "../common/decorators/current-user.decorator";
import { EV, buildEvent } from "../automation/events";

/** Legal verification-status transitions (AgentProfile/Company state machine). */
const TRANSITIONS: Record<VerificationStatus, VerificationStatus[]> = {
  PENDING: ["UNDER_REVIEW", "REJECTED"],
  UNDER_REVIEW: ["VERIFIED", "REJECTED"],
  REJECTED: ["UNDER_REVIEW"], // resubmission path
  VERIFIED: ["SUSPENDED"],
  SUSPENDED: ["VERIFIED"],
};

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  list(filters: { type?: CompanyType; status?: VerificationStatus }) {
    return this.prisma.company.findMany({
      where: {
        ...(filters.type ? { type: filters.type } : {}),
        ...(filters.status ? { verificationStatus: filters.status } : {}),
      },
      include: {
        supplierProfile: { select: { type: true } },
        _count: { select: { groups: true, users: true } },
      },
      orderBy: { joinedAt: "desc" },
    });
  }

  async findOne(id: string, caller: AuthUser) {
    // Cross-tenant read requires staff; tenants may read only themselves.
    if (caller.companyId && caller.companyId !== id) {
      throw new ForbiddenException("Not your company");
    }
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: {
        agentProfile: { include: { guarantors: true } },
        supplierProfile: true,
        bankAccounts: true,
        uploadedFiles: {
          select: { id: true, kind: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true },
          orderBy: { createdAt: "asc" },
        },
        users: { select: { id: true, email: true, name: true, status: true, lastLoginAt: true } },
        _count: { select: { groups: true, users: true } },
      },
    });
    if (!company) throw new NotFoundException("Company not found");
    return company;
  }

  async update(
    id: string,
    data: { name?: string; nameBn?: string; city?: string; email?: string; phone?: string },
    actor: AuthUser,
    ip?: string,
  ) {
    const before = await this.prisma.company.findUnique({ where: { id } });
    if (!before) throw new NotFoundException("Company not found");
    const [updated] = await this.prisma.$transaction([
      this.prisma.company.update({ where: { id }, data }),
      this.prisma.auditLog.create({
        data: {
          actorUserId: actor.sub,
          action: "UPDATE",
          module: "Companies",
          entityType: "Company",
          entityId: id,
          before: { name: before.name, city: before.city, email: before.email, phone: before.phone },
          after: data,
          ip,
        },
      }),
    ]);
    return updated;
  }

  async transitionVerification(
    id: string,
    status: VerificationStatus,
    reason: string | undefined,
    actor: AuthUser,
    ip?: string,
  ) {
    const company = await this.prisma.company.findUnique({ where: { id } });
    if (!company) throw new NotFoundException("Company not found");

    const allowed = TRANSITIONS[company.verificationStatus] ?? [];
    if (!allowed.includes(status)) {
      throw new BadRequestException(
        `Illegal transition ${company.verificationStatus} → ${status}. Allowed: ${allowed.join(", ") || "none"}`,
      );
    }
    if (status === "REJECTED" && !reason) {
      throw new BadRequestException("A rejection reason is required");
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.company.update({
        where: { id },
        data: {
          verificationStatus: status,
          rejectionReason: status === "REJECTED" ? reason : null,
        },
      }),
      this.prisma.auditLog.create({
        data: {
          actorUserId: actor.sub,
          action: status === "VERIFIED" ? "APPROVE" : status === "REJECTED" ? "REJECT" : "UPDATE",
          module: "Companies",
          entityType: "Company",
          entityId: id,
          before: { verificationStatus: company.verificationStatus },
          after: { verificationStatus: status, ...(reason ? { reason } : {}) },
          ip,
        },
      }),
    ]);

    // Decision side-effects: automation run log + notification event record.
    if (status === "VERIFIED" || status === "REJECTED") {
      await this.recordDecisionSideEffects(updated, status, reason, actor).catch((e) =>
        // side-effects must never break the decision itself
        console.error("[companies] decision side-effects failed:", e),
      );
    }
    return updated;
  }

  /**
   * On approval/rejection, EMIT a domain event and let the Automation Engine
   * decide what happens (Phase 10). Nothing is hardcoded here anymore — a seeded
   * rule (agent.approved → SEND_NOTIFICATION) queues the welcome message, and any
   * number of additional rules can hang off the same event with zero code change.
   */
  private recordDecisionSideEffects(
    company: { id: string; code: string; name: string; email: string | null; type: CompanyType },
    status: "VERIFIED" | "REJECTED",
    reason: string | undefined,
    actor: AuthUser,
  ) {
    const key = status === "VERIFIED" ? EV.AGENT_APPROVED : EV.AGENT_REJECTED;
    this.events.emit(
      key,
      buildEvent(key, {
        tenantId: company.id,
        companyId: company.id,
        entityType: "Company",
        entityId: company.id,
        recipientAddress: company.email,
        title:
          status === "VERIFIED"
            ? `Registration approved — ${company.code}`
            : `Registration rejected — ${company.code}`,
        data: {
          code: company.code,
          name: company.name,
          type: company.type,
          reason: reason ?? null,
          decidedBy: actor.email,
        },
      }),
    );
    return Promise.resolve();
  }
}
