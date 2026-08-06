import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { createHash } from "crypto";
import { ApprovalStatus, GroupTimelineEvent, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import type { AuthUser } from "../common/decorators/current-user.decorator";

export interface WfMeta { ip?: string | null; userAgent?: string | null }

/**
 * Group approval / locking workflow + timeline + audit + notifications.
 * DRAFT → SUBMITTED → PENDING_APPROVAL → APPROVED(+lock) → COMPLETED → ARCHIVED
 * branches: RETURNED (re-edit), REJECTED. Locked groups are read-only for the agent
 * except service requests; changes go through a Change Request → admin approval → unlock.
 */
@Injectable()
export class WorkflowService {
  constructor(private readonly prisma: PrismaService, private readonly notify: NotificationsService) {}

  // ── identity helpers (impersonation-aware) ─────────────────────────────────
  private actualActor(u: AuthUser): string { return u.impersonatorSub ?? u.sub; }        // the real human (admin under impersonation)
  private actingAs(u: AuthUser): string | null { return u.impersonatorSub ? u.sub : null; } // the agent, only under impersonation
  private isImpersonating(u: AuthUser): boolean { return !!u.impersonatorSub; }

  private async audit(u: AuthUser, action: "CREATE" | "UPDATE" | "APPROVE" | "REJECT", entityType: string, entityId: string, before: object, after: object, meta: WfMeta, reason?: string, workflowId?: string) {
    await this.prisma.auditLog.create({
      data: {
        actorUserId: this.actualActor(u), actingAsUserId: this.actingAs(u),
        action, module: "Workflow", entityType, entityId,
        before: before as never, after: after as never,
        ip: meta.ip ?? null, userAgent: meta.userAgent ?? null,
        reason: reason ?? null, correlationId: u.impersonationSessionId ?? null, workflowId: workflowId ?? entityId,
      },
    });
  }

  private async timeline(groupId: string, event: GroupTimelineEvent, u: AuthUser, note?: string) {
    await this.prisma.groupTimelineEntry.create({
      data: {
        groupId, event, actorUserId: this.actualActor(u), actingAsUserId: this.actingAs(u),
        actorLabel: this.isImpersonating(u) ? `${u.email} on behalf of Agent` : u.email,
        note: note ?? null, correlationId: u.impersonationSessionId ?? null,
      },
    });
  }

  private async staffApproverIds(): Promise<string[]> {
    const rows = await this.prisma.user.findMany({
      where: { role: { key: { in: ["SUPER_ADMIN", "OPS_STAFF"] } }, status: "ACTIVE" }, select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  /** Notify the group's agent. Suppressed while an admin is impersonating that agent (design #7). */
  private async notifyAgent(group: { uploadedByUserId: string | null; tenantId: string; code: string }, u: AuthUser, title: string, body: string) {
    if (this.isImpersonating(u)) return; // audit captured it; a single summary is sent when impersonation ends
    if (!group.uploadedByUserId) return;
    await this.notify.dispatch({ recipientUserId: group.uploadedByUserId, tenantId: group.tenantId, title, body, literalContent: true, channels: ["IN_APP", "EMAIL", "WHATSAPP"], priority: "NORMAL" });
  }

  private async notifyStaff(title: string, body: string) {
    const ids = await this.staffApproverIds();
    await Promise.all(ids.map((id) => this.notify.dispatch({ recipientUserId: id, title, body, literalContent: true, channels: ["IN_APP", "EMAIL", "WHATSAPP"], priority: "NORMAL" }).catch(() => undefined)));
  }

  private async load(id: string) {
    const g = await this.prisma.group.findUnique({ where: { id }, select: { id: true, code: true, name: true, tenantId: true, uploadedByUserId: true, approvalStatus: true, locked: true, lockType: true } });
    if (!g) throw new NotFoundException("Group not found");
    return g;
  }
  private assertOwnerOrStaff(g: { tenantId: string }, u: AuthUser) {
    if (u.companyType === "AGENT" && u.companyId !== g.tenantId) throw new ForbiddenException("Not your group");
  }

  // ── transitions ────────────────────────────────────────────────────────────
  async submit(id: string, u: AuthUser, meta: WfMeta) {
    const g = await this.load(id); this.assertOwnerOrStaff(g, u);
    if (!["DRAFT", "RETURNED"].includes(g.approvalStatus)) throw new BadRequestException(`Cannot submit from ${g.approvalStatus}`);
    await this.prisma.group.update({ where: { id }, data: { approvalStatus: "PENDING_APPROVAL", submittedAt: new Date() } });
    await this.timeline(id, "SUBMITTED", u, "Submitted for approval");
    await this.audit(u, "UPDATE", "Group", id, { approvalStatus: g.approvalStatus }, { approvalStatus: "PENDING_APPROVAL" }, meta);
    await this.notifyStaff(`Group ${g.code} submitted`, `${g.name} is pending your approval.`);
    return this.status(id);
  }

  async approve(id: string, u: AuthUser, meta: WfMeta) {
    const g = await this.load(id);
    if (g.approvalStatus !== "PENDING_APPROVAL") throw new BadRequestException(`Cannot approve from ${g.approvalStatus}`);
    const rule = await this.matchRule(id);                                  // configurable matrix — no hardcoded levels
    const submittedAt = (await this.prisma.group.findUnique({ where: { id }, select: { submittedAt: true } }))?.submittedAt ?? new Date(0);
    const sig = await this.recordApproval(id, u, rule.level);               // server-generated digital signature
    const signatures = await this.prisma.groupApproval.count({ where: { groupId: id, createdAt: { gte: submittedAt } } });
    await this.audit(u, "APPROVE", "Group", id, { approvalStatus: g.approvalStatus }, { level: rule.level, signatures, required: rule.minApprovals, signatureHash: sig.signatureHash }, meta);
    if (signatures < rule.minApprovals) {                                   // multi-level: stay pending until enough signatures
      await this.timeline(id, "APPROVED", u, `Approval ${signatures}/${rule.minApprovals} (level ${rule.level})`);
      return { ...(await this.status(id)), pendingSignatures: rule.minApprovals - signatures };
    }
    await this.snapshot(id, "APPROVED", u, "Approved version");             // immutable version
    await this.prisma.group.update({ where: { id }, data: { approvalStatus: "APPROVED", locked: true, lockType: "SOFT", approvedAt: new Date(), approvedByUserId: u.sub, lockedAt: new Date() } });
    await this.timeline(id, "APPROVED", u, "Approved"); await this.timeline(id, "LOCKED", u, "Soft-locked after approval");
    const full = await this.prisma.group.findUnique({ where: { id }, select: { uploadedByUserId: true, tenantId: true, code: true } });
    if (full) await this.notifyAgent(full, u, `Group ${g.code} approved`, `Your group was approved and is now locked. Service requests remain open; use a Change Request to modify locked data.`);
    return this.status(id);
  }

  async reject(id: string, u: AuthUser, reason: string, meta: WfMeta) {
    const g = await this.load(id);
    if (g.approvalStatus !== "PENDING_APPROVAL") throw new BadRequestException(`Cannot reject from ${g.approvalStatus}`);
    if (!reason?.trim()) throw new BadRequestException("Reason is required");
    await this.prisma.group.update({ where: { id }, data: { approvalStatus: "REJECTED", returnReason: reason } });
    await this.timeline(id, "REJECTED", u, reason);
    await this.audit(u, "REJECT", "Group", id, { approvalStatus: g.approvalStatus }, { approvalStatus: "REJECTED" }, meta, reason);
    const full = await this.prisma.group.findUnique({ where: { id }, select: { uploadedByUserId: true, tenantId: true, code: true } });
    if (full) await this.notifyAgent(full, u, `Group ${g.code} rejected`, `Reason: ${reason}`);
    return this.status(id);
  }

  async returnForCorrection(id: string, u: AuthUser, reason: string, meta: WfMeta) {
    const g = await this.load(id);
    if (g.approvalStatus !== "PENDING_APPROVAL") throw new BadRequestException(`Cannot return from ${g.approvalStatus}`);
    if (!reason?.trim()) throw new BadRequestException("Reason is required");
    await this.prisma.group.update({ where: { id }, data: { approvalStatus: "RETURNED", locked: false, returnReason: reason } });
    await this.timeline(id, "RETURNED", u, reason);
    await this.audit(u, "UPDATE", "Group", id, { approvalStatus: g.approvalStatus }, { approvalStatus: "RETURNED" }, meta, reason);
    const full = await this.prisma.group.findUnique({ where: { id }, select: { uploadedByUserId: true, tenantId: true, code: true } });
    if (full) await this.notifyAgent(full, u, `Group ${g.code} returned for correction`, `Reason: ${reason}`);
    return this.status(id);
  }

  async unlock(id: string, u: AuthUser, reason: string, meta: WfMeta) {
    const g = await this.load(id);
    if (!g.locked) throw new BadRequestException("Group is not locked");
    if (!reason?.trim()) throw new BadRequestException("Reason is required");
    if (g.lockType === "HARD" && u.role !== "SUPER_ADMIN") throw new ForbiddenException("Hard-locked (FINALIZED) groups can only be unlocked by a Super Admin");
    await this.prisma.group.update({ where: { id }, data: { locked: false, lockType: null, approvalStatus: "RETURNED", returnReason: reason } });
    await this.timeline(id, "UNLOCKED", u, reason);
    await this.audit(u, "UPDATE", "Group", id, { locked: true }, { locked: false }, meta, reason);
    const full = await this.prisma.group.findUnique({ where: { id }, select: { uploadedByUserId: true, tenantId: true, code: true } });
    if (full) await this.notifyAgent(full, u, `Group ${g.code} unlocked`, `An administrator unlocked your group for edits. Reason: ${reason}`);
    return this.status(id);
  }

  async complete(id: string, u: AuthUser, meta: WfMeta) {
    const g = await this.load(id);
    if (g.approvalStatus !== "APPROVED") throw new BadRequestException(`Cannot complete from ${g.approvalStatus}`);
    await this.prisma.group.update({ where: { id }, data: { approvalStatus: "COMPLETED" } });
    await this.timeline(id, "COMPLETED", u); await this.audit(u, "UPDATE", "Group", id, { approvalStatus: g.approvalStatus }, { approvalStatus: "COMPLETED" }, meta);
    return this.status(id);
  }

  async archive(id: string, u: AuthUser, meta: WfMeta) {
    const g = await this.load(id);
    if (g.approvalStatus !== "COMPLETED") throw new BadRequestException(`Cannot archive from ${g.approvalStatus}`);
    await this.prisma.group.update({ where: { id }, data: { approvalStatus: "ARCHIVED" } });
    await this.timeline(id, "ARCHIVED", u); await this.audit(u, "UPDATE", "Group", id, { approvalStatus: g.approvalStatus }, { approvalStatus: "ARCHIVED" }, meta);
    return this.status(id);
  }

  // ── change requests ──────────────────────────────────────────────────────────
  async createChangeRequest(groupId: string, u: AuthUser, dto: { field?: string; description: string }, meta: WfMeta) {
    const g = await this.load(groupId); this.assertOwnerOrStaff(g, u);
    if (!g.locked) throw new BadRequestException("Change requests apply only to locked groups; edit it directly.");
    if (!dto.description?.trim()) throw new BadRequestException("Description is required");
    const cr = await this.prisma.changeRequest.create({ data: { groupId, requestedByUserId: this.actualActor(u), field: dto.field ?? null, description: dto.description } });
    await this.timeline(groupId, "CHANGE_REQUESTED", u, dto.description);
    await this.audit(u, "CREATE", "ChangeRequest", cr.id, {}, { field: dto.field, description: dto.description }, meta, undefined, groupId);
    await this.notifyStaff(`Change request on ${g.code}`, dto.description);
    return cr;
  }

  async decideChangeRequest(id: string, u: AuthUser, decision: "APPROVED" | "REJECTED", reason: string, meta: WfMeta) {
    const cr = await this.prisma.changeRequest.findUnique({ where: { id } });
    if (!cr) throw new NotFoundException("Change request not found");
    if (cr.status !== "PENDING") throw new BadRequestException(`Already ${cr.status}`);
    await this.prisma.changeRequest.update({ where: { id }, data: { status: decision, decidedByUserId: u.sub, decisionReason: reason ?? null, decidedAt: new Date() } });
    const g = await this.load(cr.groupId);
    if (decision === "APPROVED") {
      await this.prisma.group.update({ where: { id: cr.groupId }, data: { locked: false, approvalStatus: "RETURNED" } });
      await this.timeline(cr.groupId, "CHANGE_APPROVED", u, reason); await this.timeline(cr.groupId, "UNLOCKED", u, "Unlocked for approved change request");
    } else {
      await this.timeline(cr.groupId, "CHANGE_REJECTED", u, reason);
    }
    await this.audit(u, decision === "APPROVED" ? "APPROVE" : "REJECT", "ChangeRequest", id, { status: "PENDING" }, { status: decision }, meta, reason, cr.groupId);
    const full = await this.prisma.group.findUnique({ where: { id: cr.groupId }, select: { uploadedByUserId: true, tenantId: true, code: true } });
    if (full) await this.notifyAgent(full, u, `Change request ${decision.toLowerCase()} on ${g.code}`, decision === "APPROVED" ? `Approved — your group is unlocked for the requested edit.` : `Rejected. ${reason ?? ""}`);
    return this.prisma.changeRequest.findUnique({ where: { id } });
  }

  async listChangeRequests(groupId: string) {
    return this.prisma.changeRequest.findMany({ where: { groupId }, orderBy: { createdAt: "desc" } });
  }

  // ── reads ──────────────────────────────────────────────────────────────────
  async status(id: string) {
    const g = await this.prisma.group.findUnique({ where: { id }, select: { id: true, code: true, approvalStatus: true, locked: true, lockType: true, submittedAt: true, approvedAt: true, lockedAt: true, returnReason: true } });
    if (!g) throw new NotFoundException("Group not found");
    return g;
  }
  async timelineOf(groupId: string) {
    return this.prisma.groupTimelineEntry.findMany({ where: { groupId }, orderBy: { createdAt: "asc" } });
  }

  // ── Phase 2: configurable approval matrix ────────────────────────────────────
  private async matchRule(groupId: string): Promise<{ level: number; minApprovals: number; requiredRole: string | null }> {
    const g = await this.prisma.group.findUnique({ where: { id: groupId }, select: { paxCount: true, visaType: true, packageType: true } });
    if (!g) return { level: 1, minApprovals: 1, requiredRole: null };
    const rules = await this.prisma.approvalRule.findMany({ where: { active: true }, orderBy: { level: "desc" } });
    const m = rules.find((r) =>
      (r.minPax == null || g.paxCount >= r.minPax) &&
      (r.visaType == null || r.visaType === g.visaType) &&
      (r.packageType == null || r.packageType === g.packageType),
    );
    return m ? { level: m.level, minApprovals: m.minApprovals, requiredRole: m.requiredRole } : { level: 1, minApprovals: 1, requiredRole: null };
  }

  // ── Phase 2: server-generated digital signature ──────────────────────────────
  private async recordApproval(groupId: string, u: AuthUser, level: number) {
    const approver = this.actualActor(u);
    const ts = new Date().toISOString();
    const raw = `${approver}|${u.role}|${groupId}|${ts}|${groupId}|${process.env.JWT_SECRET ?? "dev-secret"}`;
    const signatureHash = createHash("sha256").update(raw).digest("hex");
    return this.prisma.groupApproval.create({ data: { groupId, level, approverUserId: approver, signatureHash, reason: `role=${u.role}; ts=${ts}` } });
  }

  async approvals(groupId: string) {
    return this.prisma.groupApproval.findMany({ where: { groupId }, orderBy: { createdAt: "asc" }, select: { id: true, level: true, approverUserId: true, signatureHash: true, reason: true, createdAt: true } });
  }

  // ── Phase 2: immutable version history ───────────────────────────────────────
  private async snapshot(groupId: string, event: string, u: AuthUser, note?: string) {
    const g = await this.prisma.group.findUnique({ where: { id: groupId }, include: { passengers: { select: { id: true, code: true, name: true, passportNo: true, visaPipelineStatus: true } } } });
    if (!g) return;
    const last = await this.prisma.groupVersion.findFirst({ where: { groupId }, orderBy: { version: "desc" }, select: { version: true } });
    const version = (last?.version ?? 0) + 1;
    await this.prisma.groupVersion.create({ data: { groupId, version, snapshot: g as unknown as Prisma.InputJsonValue, changedByUserId: this.actualActor(u), actingAsUserId: this.actingAs(u), reason: note ?? event } });
  }

  async versions(groupId: string) {
    return this.prisma.groupVersion.findMany({ where: { groupId }, orderBy: { version: "desc" }, select: { id: true, version: true, changedByUserId: true, actingAsUserId: true, reason: true, createdAt: true } });
  }

  // ── Phase 2: before/after — ALWAYS from immutable snapshots, never live data ──
  async diffVersions(groupId: string, a: number, b: number) {
    const [va, vb] = await Promise.all([
      this.prisma.groupVersion.findUnique({ where: { groupId_version: { groupId, version: a } } }),
      this.prisma.groupVersion.findUnique({ where: { groupId_version: { groupId, version: b } } }),
    ]);
    if (!va || !vb) throw new NotFoundException("Version not found");
    const A = (va.snapshot ?? {}) as Record<string, unknown>;
    const B = (vb.snapshot ?? {}) as Record<string, unknown>;
    const keys = Array.from(new Set([...Object.keys(A), ...Object.keys(B)]));
    const diff: Record<string, { from: unknown; to: unknown }> = {};
    for (const k of keys) {
      if (JSON.stringify(A[k]) !== JSON.stringify(B[k])) diff[k] = { from: A[k] ?? null, to: B[k] ?? null };
    }
    return { from: { version: a, at: va.createdAt }, to: { version: b, at: vb.createdAt }, changed: Object.keys(diff), diff };
  }

  // ── Phase 2: finalize → HARD lock (only Super Admin can later unlock) ─────────
  async finalize(id: string, u: AuthUser, meta: WfMeta) {
    const g = await this.load(id);
    if (g.approvalStatus !== "APPROVED") throw new BadRequestException("Only approved groups can be finalized");
    await this.prisma.group.update({ where: { id }, data: { locked: true, lockType: "HARD" } });
    await this.timeline(id, "LOCKED", u, "FINALIZED (hard lock)");
    await this.audit(u, "UPDATE", "Group", id, { lockType: g.lockType }, { lockType: "HARD", finalized: true }, meta);
    return this.status(id);
  }

  // ── Phase 2: bulk approval — one real workflow per group (never bypass) ───────
  async bulkApprove(ids: string[], u: AuthUser, meta: WfMeta) {
    const results: Array<{ id: string; ok: boolean; error?: string }> = [];
    for (const id of ids) {
      try { await this.approve(id, u, meta); results.push({ id, ok: true }); }
      catch (e) { results.push({ id, ok: false, error: (e as Error).message }); }
    }
    return { total: ids.length, approved: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, results };
  }
}
