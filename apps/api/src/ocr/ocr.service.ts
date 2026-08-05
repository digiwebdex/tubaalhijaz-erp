import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Queue } from "bullmq";
import type { OcrDocument, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { StorageService } from "../storage/storage.service";
import { PassengersService } from "../groups/passengers.service";
import { GroupsService } from "../groups/groups.service";
import type { CreatePassengerDto } from "../groups/passengers.dto";
import type { AuthUser } from "../common/decorators/current-user.decorator";
import { buildEvent, EV } from "../automation/events";
import { VisionClient, type OcrProvider } from "./vision.client";
import { GeminiClient } from "./gemini.client";
import { extract, type ExtractedField } from "./parsers";
import { OCR_CONF, OCR_JOB, OCR_QUEUE, isNusukGroupListOcrEnabled, type OcrJobData } from "./ocr.constants";
import type { ApproveOcrDto, CreateOcrDto, ListOcrQueryDto, OverrideFieldDto, RejectOcrDto } from "./ocr.dto";

/** Read a field's effective value (override wins over the extracted value). */
function valueOf(fields: ExtractedField[], name: string): string | null {
  const f = fields.find((x) => x.field === name);
  return (f?.overriddenValue ?? f?.value) ?? null;
}
function fieldsOf(json: Prisma.JsonValue | null | undefined): ExtractedField[] {
  return Array.isArray(json) ? (json as unknown as ExtractedField[]) : [];
}
function passportNoOf(json: Prisma.JsonValue | null | undefined): string | null {
  const v = valueOf(fieldsOf(json), "passportNo");
  return v ? v.trim().toUpperCase() : null;
}
function buildChecks(fields: ExtractedField[], mrzDiscrepancy: boolean) {
  const checks = fields
    .filter((f) => f.field !== "rawText")
    .map((f) => ({ field: f.field, present: f.value != null, confidence: f.confidence, low: f.low }));
  checks.push({ field: "mrz", present: !mrzDiscrepancy, confidence: mrzDiscrepancy ? 0 : 1, low: mrzDiscrepancy });
  return checks;
}

@Injectable()
export class OcrService {
  private readonly log = new Logger("OcrService");

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditSvc: AuditService,
    private readonly storage: StorageService,
    private readonly vision: VisionClient,
    private readonly gemini: GeminiClient,
    private readonly passengers: PassengersService,
    private readonly groups: GroupsService,
    private readonly events: EventEmitter2,
    @Inject(OCR_QUEUE) private readonly queue: Queue<OcrJobData>,
  ) {}

  /** T001-07 — feature flags for OCR Center mode switch (no new permission). */
  capabilities() {
    return {
      nusukGroupListOcr: isNusukGroupListOcrEnabled(),
      passportOcr: true,
    };
  }

  /** Register an uploaded file for OCR and enqueue the pipeline job. */
  async create(dto: CreateOcrDto, user: AuthUser) {
    if (dto.documentType === "NUSUK_GROUP_LIST" && !isNusukGroupListOcrEnabled()) {
      throw new BadRequestException(
        "Nusuk Group List OCR is disabled. Set ENABLE_NUSUK_GROUP_LIST_OCR=true to enable.",
      );
    }

    const file = await this.prisma.uploadedFile.findUnique({ where: { id: dto.uploadedFileId } });
    if (!file) throw new NotFoundException("Uploaded file not found");

    // ESP-04 — tenants may only OCR files they uploaded or that are stamped to their company.
    // Platform staff (companyId null) may bind any file for ops intake. No existence leak on deny.
    if (user.companyId) {
      const owned =
        file.uploadedById === user.sub ||
        (file.companyId != null && file.companyId === user.companyId);
      if (!owned) throw new NotFoundException("Uploaded file not found");
    }

    // T001-06 — when group is supplied at intake, bind OCR doc to that Group (tenant-checked).
    // NUSUK_GROUP_LIST creates the Group on approve — ignore inbound groupId for that type.
    let groupId: string | null = dto.documentType === "NUSUK_GROUP_LIST" ? null : (dto.groupId ?? null);
    if (groupId) {
      const group = await this.prisma.scoped.group.findUnique({
        where: { id: groupId },
        select: { id: true, tenantId: true },
      });
      if (!group) throw new NotFoundException("Group not found");
      if (user.companyId && user.companyId !== group.tenantId) {
        throw new NotFoundException("Group not found");
      }
      groupId = group.id;
    }

    const tenantId = user.companyId ?? file.companyId ?? null;
    const code = await this.nextCode();
    const doc = await this.prisma.ocrDocument.create({
      data: {
        code,
        documentType: dto.documentType,
        fileUrl: `${file.bucket}/${file.storageKey}`,
        fileName: file.fileName,
        tenantId,
        groupId,
        uploadedById: user.sub,
        reviewStatus: "PENDING",
      },
    });
    await this.queue.add(
      OCR_JOB,
      { ocrDocumentId: doc.id },
      { attempts: 3, backoff: { type: "exponential", delay: 2000 }, removeOnComplete: 500, removeOnFail: 1000 },
    );
    await this.auditSvc.log({
      action: "CREATE",
      module: "OCR",
      entityType: "OcrDocument",
      entityId: doc.id,
      after: {
        code: doc.code,
        documentType: doc.documentType,
        groupId,
        intake:
          doc.documentType === "PASSPORT"
            ? "Passport → Mutamer (requires Group on approve)"
            : doc.documentType === "NUSUK_GROUP_LIST"
              ? "Nusuk Group List → Group on approve"
              : null,
      },
    });
    this.log.log(`queued OCR ${doc.code} (${doc.documentType})`);
    return {
      id: doc.id,
      code: doc.code,
      documentType: doc.documentType,
      reviewStatus: doc.reviewStatus,
      groupId,
    };
  }

  private async nextCode(): Promise<string> {
    const last = await this.prisma.ocrDocument.findFirst({ orderBy: { code: "desc" }, select: { code: true } });
    const n = last ? Number.parseInt(last.code.replace(/\D/g, ""), 10) || 0 : 0;
    return `OCR-${String(n + 1).padStart(4, "0")}`;
  }

  /**
   * Choose the OCR engine. `OCR_PROVIDER` (gemini | google-vision) wins; else use
   * whichever is configured, preferring Gemini (works without Cloud billing).
   */
  private pickProvider(): OcrProvider {
    const choice = (process.env.OCR_PROVIDER || (this.gemini.configured ? "gemini" : "google-vision")).toLowerCase();
    return choice === "gemini" ? this.gemini : this.vision;
  }

  /** Worker entrypoint: run the full pipeline for one document. */
  async process(ocrDocumentId: string): Promise<void> {
    const doc = await this.prisma.ocrDocument.findUnique({ where: { id: ocrDocumentId } });
    if (!doc) {
      this.log.warn(`process: OcrDocument ${ocrDocumentId} no longer exists`);
      return;
    }
    try {
      if (!doc.fileUrl) throw new Error(`OcrDocument ${doc.code} has no fileUrl`);
      const slash = doc.fileUrl.indexOf("/");
      const bucket = doc.fileUrl.slice(0, slash);
      const key = doc.fileUrl.slice(slash + 1);
      const bytes = await this.storage.read(bucket, key);

      const provider = this.pickProvider();
      const ocr = await provider.annotate(bytes, { dense: doc.documentType === "PASSPORT", documentType: doc.documentType });
      const ex = extract(doc.documentType, ocr);
      const dup = await this.detectDuplicate(doc, ex.fields);

      const autoAccept =
        ex.confidenceScore >= OCR_CONF.ACCEPT &&
        !ex.mrzDiscrepancy &&
        !dup.duplicateOfPassengerId &&
        !dup.duplicateOfId;

      const validation: Prisma.InputJsonValue = {
        provider: ex.provider,
        checks: buildChecks(ex.fields, ex.mrzDiscrepancy),
        duplicate: dup.summary as Prisma.InputJsonValue,
        autoAccept,
        meanConfidence: ocr.meanConfidence,
        meta: ex.meta as Prisma.InputJsonValue,
      };

      await this.prisma.ocrDocument.update({
        where: { id: doc.id },
        data: {
          extractedFields: ex.fields as unknown as Prisma.InputJsonValue,
          validation,
          confidenceScore: ex.confidenceScore,
          mrzDiscrepancy: ex.mrzDiscrepancy,
          duplicateOfId: dup.duplicateOfId,
          duplicateOfPassengerId: dup.duplicateOfPassengerId,
          reviewStatus: "IN_REVIEW",
          processedAt: new Date(),
        },
      });

      this.events.emit(
        EV.OCR_COMPLETED,
        buildEvent(EV.OCR_COMPLETED, {
          tenantId: doc.tenantId,
          entityType: "OcrDocument",
          entityId: doc.id,
          title: `OCR ${doc.code} (${doc.documentType}) ready for review`,
          data: {
            code: doc.code,
            documentType: doc.documentType,
            confidence: ex.confidenceScore,
            autoAccept,
            duplicate: Boolean(dup.duplicateOfPassengerId || dup.duplicateOfId),
          },
        }),
      );
      this.log.log(`processed OCR ${doc.code}: confidence=${ex.confidenceScore.toFixed(2)} autoAccept=${autoAccept}`);
    } catch (err) {
      // Persist last error for ops visibility, then rethrow so BullMQ retries (G-10 / S2-06).
      const message = err instanceof Error ? err.message : String(err);
      const prev =
        doc.validation && typeof doc.validation === "object" && !Array.isArray(doc.validation)
          ? (doc.validation as Record<string, unknown>)
          : {};
      await this.prisma.ocrDocument.update({
        where: { id: doc.id },
        data: {
          validation: {
            ...prev,
            lastError: message,
            failedAt: new Date().toISOString(),
          } as Prisma.InputJsonValue,
        },
      }).catch(() => undefined);
      throw err;
    }
  }

  /**
   * Re-enqueue a PENDING document after provider/storage failure (ops recovery).
   * Does not change extraction/approve/reject rules — only restarts the worker job.
   */
  async reprocess(id: string, user: AuthUser) {
    const doc = await this.prisma.scoped.ocrDocument.findUnique({
      where: { id },
      select: { id: true, code: true, reviewStatus: true, validation: true },
    });
    if (!doc) throw new NotFoundException("OCR document not found");
    if (doc.reviewStatus !== "PENDING") {
      throw new BadRequestException("Only PENDING documents can be reprocessed (failed jobs stay PENDING)");
    }
    await this.queue.add(
      OCR_JOB,
      { ocrDocumentId: doc.id },
      { attempts: 3, backoff: { type: "exponential", delay: 2000 }, removeOnComplete: 500, removeOnFail: 1000 },
    );
    await this.prisma.auditLog.create({
      data: {
        actorUserId: user.sub,
        action: "PROCESS",
        module: "OCR",
        entityType: "OcrDocument",
        entityId: id,
        after: { code: doc.code, reviewStatus: doc.reviewStatus, requeued: true },
      },
    }).catch(() => undefined);
    this.log.log(`re-queued OCR ${doc.code}`);
    return { id: doc.id, code: doc.code, reviewStatus: doc.reviewStatus, queued: true };
  }

  /** Passport-number duplicate detection: existing passengers + pending OCR docs. */
  private async detectDuplicate(doc: OcrDocument, fields: ExtractedField[]) {
    const passportNo = valueOf(fields, "passportNo")?.trim().toUpperCase() ?? null;
    let duplicateOfPassengerId: string | null = null;
    let duplicateOfId: string | null = null;
    const summary: Record<string, unknown> = { passportNo };
    if (passportNo) {
      const pax = await this.prisma.passenger.findFirst({
        where: { passportNo, ...(doc.tenantId ? { tenantId: doc.tenantId } : {}) },
        select: { id: true, code: true, group: { select: { code: true } } },
      });
      if (pax) {
        duplicateOfPassengerId = pax.id;
        summary.passenger = { id: pax.id, code: pax.code, group: pax.group?.code ?? null };
      }
      const recent = await this.prisma.ocrDocument.findMany({
        where: {
          id: { not: doc.id },
          documentType: "PASSPORT",
          reviewStatus: { in: ["PENDING", "IN_REVIEW"] },
          ...(doc.tenantId ? { tenantId: doc.tenantId } : {}),
        },
        select: { id: true, code: true, extractedFields: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      const hit = recent.find((r) => passportNoOf(r.extractedFields) === passportNo);
      if (hit) {
        duplicateOfId = hit.id;
        summary.ocrDocument = { id: hit.id, code: hit.code };
      }
    }
    return { duplicateOfPassengerId, duplicateOfId, summary };
  }

  // ── Review queue ────────────────────────────────────────────────────────────
  list(query: ListOcrQueryDto) {
    return this.prisma.scoped.ocrDocument.findMany({
      where: {
        ...(query.reviewStatus ? { reviewStatus: query.reviewStatus } : {}),
        ...(query.documentType ? { documentType: query.documentType } : {}),
        ...(query.groupId ? { groupId: query.groupId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true, code: true, documentType: true, reviewStatus: true, confidenceScore: true,
        mrzDiscrepancy: true, duplicateOfId: true, duplicateOfPassengerId: true,
        fileName: true, groupId: true, createdAt: true, processedAt: true,
        group: { select: { id: true, code: true, name: true } },
        _count: { select: { passengers: true } },
      },
    });
  }

  async get(id: string) {
    const doc = await this.prisma.scoped.ocrDocument.findUnique({
      where: { id },
      include: {
        group: { select: { id: true, code: true, name: true } },
        passengers: { select: { id: true, code: true, name: true, passportNo: true } },
      },
    });
    if (!doc) throw new NotFoundException("OCR document not found");
    return doc;
  }

  async override(id: string, overrides: OverrideFieldDto[], user: AuthUser) {
    const doc = await this.prisma.scoped.ocrDocument.findUnique({
      where: { id },
      select: { id: true, code: true, tenantId: true, extractedFields: true },
    });
    if (!doc) throw new NotFoundException("OCR document not found");
    const map = new Map<string, ExtractedField>(fieldsOf(doc.extractedFields).map((f) => [f.field, { ...f }]));
    for (const o of overrides) {
      const cur = map.get(o.field) ?? { field: o.field, value: null, confidence: 0, low: false };
      cur.overriddenValue = o.value;
      map.set(o.field, cur);
    }
    const merged = [...map.values()];
    await this.prisma.ocrDocument.update({
      where: { id },
      data: { extractedFields: merged as unknown as Prisma.InputJsonValue },
    });
    await this.prisma.auditLog.create({
      data: {
        actorUserId: user.sub,
        action: "UPDATE",
        module: "OCR",
        entityType: "OcrDocument",
        entityId: id,
        after: { code: doc.code, fields: overrides.map((o) => o.field) },
      },
    }).catch(() => undefined);
    return { id, fields: merged };
  }

  /**
   * Approve:
   * - PASSPORT → Mutamer create/attach (T001-06)
   * - NUSUK_GROUP_LIST → create/update Group via GroupsService (T001-07, feature-flagged)
   */
  async approve(id: string, dto: ApproveOcrDto, user: AuthUser) {
    const doc = await this.prisma.scoped.ocrDocument.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException("OCR document not found");
    if (doc.reviewStatus === "APPROVED") throw new BadRequestException("Already approved");

    if (doc.documentType === "NUSUK_GROUP_LIST" && !isNusukGroupListOcrEnabled()) {
      throw new BadRequestException(
        "Nusuk Group List OCR is disabled. Set ENABLE_NUSUK_GROUP_LIST_OCR=true to enable.",
      );
    }

    let passenger: { id: string; code: string } | null = null;
    let group: { id: string; code: string; nusukGroupNumber: string | null } | null = null;
    let mode: "create" | "attach" | "update" | null = null;
    let groupId: string | null = null;
    let groupCode: string | null = null;

    if (doc.documentType === "NUSUK_GROUP_LIST") {
      const result = await this.approveNusukGroupList(doc, dto, user);
      group = result.group;
      mode = result.mode;
      groupId = result.group.id;
      groupCode = result.group.code;
      this.events.emit(
        EV.OCR_GROUP_COMMITTED,
        buildEvent(EV.OCR_GROUP_COMMITTED, {
          tenantId: result.tenantId,
          companyId: result.tenantId,
          entityType: "Group",
          entityId: groupId,
          recipientUserId: user.sub,
          title: `Group list OCR committed for ${groupCode}`,
          data: {
            code: groupCode,
            nusukGroupNumber: group.nusukGroupNumber,
            mode,
            ocrCode: doc.code,
            approvedBy: user.email,
          },
        }),
      );
    } else if (doc.documentType === "PASSPORT") {
      groupId = dto.groupId ?? doc.groupId;
      if (!groupId) {
        throw new BadRequestException(
          "Passport → Mutamer requires a Group. Select a group before approving (OCR cannot create a Group from a passport).",
        );
      }
      const group = await this.prisma.scoped.group.findUnique({
        where: { id: groupId },
        select: { id: true, code: true, tenantId: true },
      });
      if (!group) throw new NotFoundException("Group not found");
      if (user.companyId && user.companyId !== group.tenantId) {
        throw new NotFoundException("Group not found");
      }
      groupCode = group.code;

      // Persist group attachment on the OCR document when chosen at approve time.
      if (doc.groupId !== groupId) {
        await this.prisma.ocrDocument.update({ where: { id }, data: { groupId } });
      }

      const pdto = this.toPassengerDto(fieldsOf(doc.extractedFields));

      if (dto.passengerId) {
        mode = "attach";
        const existing = await this.prisma.scoped.passenger.findUnique({ where: { id: dto.passengerId } });
        if (!existing || existing.groupId !== groupId) {
          throw new BadRequestException("Mutamer not found in the selected Group — cannot attach OCR");
        }
        if (existing.ocrDocumentId && existing.ocrDocumentId !== id) {
          throw new BadRequestException(
            `Mutamer ${existing.code} is already linked to another OCR document — no silent overwrite`,
          );
        }
        if (existing.passportNo !== pdto.passportNo) {
          throw new BadRequestException(
            `Passport ${pdto.passportNo} does not match Mutamer ${existing.code} (${existing.passportNo})`,
          );
        }
        // Fill only blank identity fields from OCR; never overwrite Excel values silently.
        const patch: Prisma.PassengerUpdateInput = {
          ocrDocument: { connect: { id } },
        };
        if (!existing.passportExpiry && pdto.passportExpiry) {
          patch.passportExpiry = new Date(pdto.passportExpiry);
        }
        if (!existing.dob && pdto.dob) patch.dob = new Date(pdto.dob);
        if (existing.age == null && pdto.age != null) patch.age = pdto.age;
        const updatedPax = await this.prisma.passenger.update({
          where: { id: existing.id },
          data: patch,
          select: { id: true, code: true },
        });
        passenger = updatedPax;
        await this.prisma.auditLog.create({
          data: {
            actorUserId: user.sub,
            action: "UPDATE",
            module: "Passengers",
            entityType: "Passenger",
            entityId: existing.id,
            after: {
              ocrDocumentId: id,
              ocrCode: doc.code,
              attachment: "ocr_attach",
              groupId,
              groupCode,
            },
          },
        }).catch(() => undefined);
      } else {
        mode = "create";
        if (doc.duplicateOfPassengerId) {
          throw new BadRequestException(
            `Passport already registered on an existing Mutamer. Approve with passengerId=${doc.duplicateOfPassengerId} to attach this OCR result, or reject the scan.`,
          );
        }
        const created = await this.passengers.create(groupId, [pdto], user);
        const row = Array.isArray(created) ? created[0] : created;
        passenger = { id: row.id, code: row.code };
      }
    }

    const updated = await this.prisma.ocrDocument.update({
      where: { id },
      data: {
        reviewStatus: "APPROVED",
        reviewedById: user.sub,
        processedAt: doc.processedAt ?? new Date(),
        ...(passenger && mode === "create" ? { passengers: { connect: { id: passenger.id } } } : {}),
        ...(groupId ? { groupId } : {}),
      },
    });
    await this.prisma.auditLog.create({
      data: {
        actorUserId: user.sub,
        action: "APPROVE",
        module: "OCR",
        entityType: "OcrDocument",
        entityId: id,
        after: {
          code: doc.code,
          documentType: doc.documentType,
          reviewStatus: "APPROVED",
          mode,
          groupId,
          groupCode,
          nusukGroupNumber: group?.nusukGroupNumber ?? null,
          passengerId: passenger?.id ?? null,
          passengerCode: passenger?.code ?? null,
        },
      },
    }).catch(() => undefined);
    return {
      id: updated.id,
      reviewStatus: updated.reviewStatus,
      passenger,
      group,
      mode,
      groupId,
      groupCode,
    };
  }

  /**
   * T001-07 — approve Nusuk Groups List → create or update Group (Nusuk uniqueness).
   * Duplicate Nusuk numbers cannot open a second Group; existing row is updated.
   */
  private async approveNusukGroupList(
    doc: OcrDocument,
    dto: ApproveOcrDto,
    user: AuthUser,
  ): Promise<{
    group: { id: string; code: string; nusukGroupNumber: string | null };
    mode: "create" | "update";
    tenantId: string;
  }> {
    const fields = fieldsOf(doc.extractedFields);
    const nusukRaw = valueOf(fields, "nusukGroupNumber");
    if (!nusukRaw || nusukRaw.trim().length < 3) {
      throw new BadRequestException(
        "Cannot open Group: Nusuk Group Number missing — override it first",
      );
    }
    const nusukGroupNumber = nusukRaw.trim().toUpperCase().replace(/\s+/g, "");
    const groupName = valueOf(fields, "groupName")?.trim() || `Nusuk ${nusukGroupNumber}`;
    const consulate = valueOf(fields, "consulate")?.trim() || undefined;
    const agentCode = valueOf(fields, "agentCode")?.trim() || undefined;
    const departDate = valueOf(fields, "departDate")?.trim() || undefined;
    const returnDate = valueOf(fields, "returnDate")?.trim() || undefined;
    const paxParsed = Number.parseInt((valueOf(fields, "paxCount") ?? "").replace(/\D/g, ""), 10);
    const paxCount = Number.isFinite(paxParsed) && paxParsed >= 0 ? paxParsed : undefined;

    const existing = await this.prisma.group.findFirst({
      where: { nusukGroupNumber },
      select: { id: true, code: true, tenantId: true, nusukGroupNumber: true, maxCapacity: true },
    });

    if (existing) {
      // Tenancy: agents may only update their own company's group.
      if (user.companyId && user.companyId !== existing.tenantId) {
        throw new BadRequestException(
          `Nusuk group number ${nusukGroupNumber} already exists on another company — duplicate blocked`,
        );
      }
      const maxCapacity =
        paxCount != null && paxCount > existing.maxCapacity ? paxCount : undefined;
      const updated = await this.groups.update(
        existing.id,
        {
          name: groupName,
          ...(consulate !== undefined ? { consulate } : {}),
          ...(paxCount != null ? { paxCount } : {}),
          ...(maxCapacity != null ? { maxCapacity } : {}),
          ...(departDate ? { departDate } : {}),
          ...(returnDate ? { returnDate } : {}),
          ...(agentCode ? { uploadedByLabel: agentCode } : {}),
        },
        user,
      );
      return {
        group: {
          id: updated.id,
          code: updated.code,
          nusukGroupNumber: updated.nusukGroupNumber,
        },
        mode: "update",
        tenantId: updated.tenantId,
      };
    }

    const tenantId = user.companyId ?? dto.tenantId ?? doc.tenantId ?? undefined;
    if (!user.companyId && !tenantId) {
      throw new BadRequestException(
        "tenantId is required for staff to open a Group from Nusuk Group List OCR",
      );
    }

    const created = await this.groups.create(
      {
        name: groupName,
        destination: "MAKKAH_MADINAH",
        visaType: "UMRAH",
        packageType: "STANDARD",
        nusukGroupNumber,
        ...(consulate ? { consulate } : {}),
        ...(paxCount != null ? { paxCount, maxCapacity: Math.max(paxCount, 40) } : { maxCapacity: 40 }),
        ...(departDate ? { departDate } : {}),
        ...(returnDate ? { returnDate } : {}),
        ...(agentCode ? { uploadedByLabel: agentCode } : {}),
        ...(tenantId ? { tenantId } : {}),
      },
      user,
    );

    return {
      group: {
        id: created.id,
        code: created.code,
        nusukGroupNumber: created.nusukGroupNumber,
      },
      mode: "create",
      tenantId: created.tenantId,
    };
  }

  private toPassengerDto(fields: ExtractedField[]): CreatePassengerDto {
    const v = (name: string) => valueOf(fields, name);
    const sex = (v("sex") ?? "").trim().toUpperCase();
    const gender: "MALE" | "FEMALE" | undefined =
      sex === "M" || sex === "MALE" ? "MALE" : sex === "F" || sex === "FEMALE" ? "FEMALE" : undefined;
    const name = v("name");
    const passportNo = v("passportNo");
    const nationality = v("nationality");
    if (!name || name.trim().length < 2) {
      throw new BadRequestException("Cannot create Mutamer: name missing — override it first");
    }
    if (!passportNo || passportNo.trim().length < 3) {
      throw new BadRequestException("Cannot create Mutamer: passport number missing — override it first");
    }
    if (!nationality || nationality.trim().length < 2) {
      throw new BadRequestException("Cannot create Mutamer: nationality missing — override it first");
    }
    if (!gender) {
      throw new BadRequestException("Cannot create Mutamer: sex missing/ambiguous — override it (M/F) first");
    }
    const dob = v("dob");
    const expiry = v("passportExpiry");
    let age: number | undefined;
    if (dob) {
      const d = new Date(dob);
      if (!Number.isNaN(d.getTime())) {
        const years = Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
        if (years >= 0 && years <= 130) age = years;
      }
    }
    return {
      name: name.trim(),
      passportNo: passportNo.trim().toUpperCase(),
      nationality: nationality.trim(),
      gender,
      ...(dob ? { dob } : {}),
      ...(expiry ? { passportExpiry: expiry } : {}),
      ...(age != null ? { age } : {}),
    } as CreatePassengerDto;
  }

  async reject(id: string, dto: RejectOcrDto, user: AuthUser) {
    const doc = await this.prisma.scoped.ocrDocument.findUnique({
      where: { id },
      select: { id: true, code: true, tenantId: true },
    });
    if (!doc) throw new NotFoundException("OCR document not found");
    const updated = await this.prisma.ocrDocument.update({
      where: { id },
      data: { reviewStatus: "REJECTED", reviewedById: user.sub },
    });
    await this.prisma.auditLog.create({
      data: {
        actorUserId: user.sub,
        action: "REJECT",
        module: "OCR",
        entityType: "OcrDocument",
        entityId: id,
        after: { code: doc.code, reviewStatus: "REJECTED", reason: dto.reason ?? null },
      },
    }).catch(() => undefined);
    return { id: updated.id, reviewStatus: updated.reviewStatus, reason: dto.reason ?? null };
  }
}
