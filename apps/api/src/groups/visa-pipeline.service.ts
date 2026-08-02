import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { VisaPipelineStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthUser } from "../common/decorators/current-user.decorator";
import { buildEvent, EV } from "../automation/events";
import {
  GATE_READY_STATES,
  allowedTargets,
  excelEchoForState,
  gateAssistSuggest,
  isVisaPipelineState,
  validateTransition,
  type VisaPipelineState,
} from "./visa-pipeline.machine";

export type VisaTransitionDto = {
  to: string;
  reason?: string;
  notes?: string;
  visaNumber?: string;
  biometricStatus?: string;
  custodyConfirmed?: boolean;
  embassyRef?: string;
  embassy?: string;
  embassySubmittedAt?: string;
  mofaNumber?: string;
  completeMofa?: boolean;
};

@Injectable()
export class VisaPipelineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  /** Architecture flag — when true, ISSUED must pass PASSPORT_RETURNED. */
  requirePassportReturn(): boolean {
    const v = (process.env.VISA_REQUIRE_PASSPORT_RETURN ?? "").trim().toLowerCase();
    return v === "1" || v === "true" || v === "yes";
  }

  sopFlags() {
    return {
      requirePassportReturn: this.requirePassportReturn(),
      flag: "VISA_REQUIRE_PASSPORT_RETURN",
    };
  }

  /** Staff only — agents/suppliers must not advance the visa pipeline. */
  private assertDeskStaff(user: AuthUser) {
    if (user.companyId) {
      throw new ForbiddenException("Only Visa Desk / Ops staff may transition visa pipeline states");
    }
  }

  private async audit(
    user: AuthUser,
    action: "UPDATE" | "REJECT",
    entityId: string,
    before: object | null,
    after: object,
  ) {
    await this.prisma.auditLog
      .create({
        data: {
          actorUserId: user.sub,
          action,
          module: "VisaPipeline",
          entityType: "Passenger",
          entityId,
          before: before ?? undefined,
          after,
        },
      })
      .catch(() => undefined);
  }

  async gateAssistForGroup(groupId: string) {
    const [total, ready] = await this.prisma.$transaction([
      this.prisma.passenger.count({ where: { groupId } }),
      this.prisma.passenger.count({
        where: { groupId, visaPipelineStatus: { in: [...GATE_READY_STATES] } },
      }),
    ]);
    return gateAssistSuggest({ total, ready });
  }

  async transition(passengerId: string, dto: VisaTransitionDto, user: AuthUser) {
    this.assertDeskStaff(user);

    const passenger = await this.prisma.passenger.findUnique({
      where: { id: passengerId },
      include: {
        group: {
          select: {
            id: true,
            code: true,
            name: true,
            tenantId: true,
            visaType: true,
            umrahCompanyId: true,
            gateVisa: true,
            consulate: true,
            visaRequests: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { id: true, embassy: true },
            },
          },
        },
      },
    });
    if (!passenger) throw new NotFoundException("Passenger not found");

    const toRaw = (dto.to ?? "").trim().toUpperCase();
    if (!isVisaPipelineState(toRaw)) {
      throw new BadRequestException(
        `to must be one of the VisaPipelineStatus values`,
      );
    }
    const to = toRaw as VisaPipelineState;
    const from = passenger.visaPipelineStatus as VisaPipelineState;

    const visaNumber = dto.visaNumber?.trim() || passenger.visaNumber;
    const biometricStatus = dto.biometricStatus?.trim() || passenger.biometricStatus;
    const embassyRef = dto.embassyRef?.trim() || passenger.embassyRef;
    const embassyLabel = dto.embassy?.trim() || null;
    const mofaNumberRaw = dto.mofaNumber !== undefined
      ? dto.mofaNumber.trim().toUpperCase()
      : passenger.mofaNumber;
    const vr = passenger.group.visaRequests[0] ?? null;
    const hasEmbassyContext = !!(
      passenger.embassyRef?.trim() ||
      passenger.group.consulate?.trim() ||
      vr?.embassy?.trim()
    );

    // T002-06 — complete MOFA desk info requires MOFA Number (≠ Processing Bill).
    if (dto.completeMofa) {
      if (!mofaNumberRaw) {
        await this.audit(
          user,
          "REJECT",
          passenger.id,
          { visaPipelineStatus: from, mofaNumber: passenger.mofaNumber },
          {
            attemptedTo: to,
            code: "MOFA_NUMBER_REQUIRED",
            message: "mofaNumber is required to complete MOFA information",
            actor: user.email,
          },
        );
        throw new BadRequestException("mofaNumber is required to complete MOFA information");
      }
    }
    if (dto.mofaNumber !== undefined && !dto.mofaNumber.trim()) {
      throw new BadRequestException("mofaNumber cannot be empty");
    }

    const requirePassportReturn = this.requirePassportReturn();

    const validation = validateTransition({
      from,
      to,
      requirePassportReturn,
      visaNumber,
      biometricStatus,
      reason: dto.reason,
      custodyConfirmed: dto.custodyConfirmed,
      notes: dto.notes,
      hasVisaType: !!passenger.group.visaType,
      hasEmbassyContext,
      embassyRef: dto.embassyRef ?? passenger.embassyRef,
      embassy: embassyLabel,
    });

    if (!validation.ok) {
      await this.audit(
        user,
        "REJECT",
        passenger.id,
        { visaPipelineStatus: from },
        {
          attemptedTo: to,
          code: validation.code,
          message: validation.message,
          reason: dto.reason ?? null,
          actor: user.email,
          module: "EmbassyPassport",
        },
      );
      throw new BadRequestException(validation.message);
    }

    const echo = excelEchoForState(to, {
      visaNumber,
      biometricStatus,
      reason: dto.reason,
    });

    const now = new Date();
    let embassySubmittedAt: Date | null | undefined = undefined;
    if (to === "EMBASSY" && from !== "EMBASSY") {
      embassySubmittedAt = dto.embassySubmittedAt
        ? new Date(dto.embassySubmittedAt)
        : passenger.embassySubmittedAt ?? now;
    } else if (dto.embassySubmittedAt) {
      embassySubmittedAt = new Date(dto.embassySubmittedAt);
    }

    let passportReturnedAt: Date | null | undefined = undefined;
    if (to === "PASSPORT_RETURNED" && from !== "PASSPORT_RETURNED") {
      passportReturnedAt = now;
    }

    const updated = await this.prisma.passenger.update({
      where: { id: passenger.id },
      data: {
        visaPipelineStatus: to as VisaPipelineStatus,
        ...(echo.biometricStatus !== undefined ? { biometricStatus: echo.biometricStatus } : {}),
        ...(echo.visaStatus !== undefined ? { visaStatus: echo.visaStatus } : {}),
        ...(echo.visaStatusLabel !== undefined ? { visaStatusLabel: echo.visaStatusLabel } : {}),
        ...(echo.visaRejectReason !== undefined
          ? { visaRejectReason: echo.visaRejectReason }
          : {}),
        ...(dto.visaNumber?.trim() ? { visaNumber: dto.visaNumber.trim() } : {}),
        ...(dto.biometricStatus?.trim()
          ? { biometricStatus: dto.biometricStatus.trim() }
          : {}),
        ...(dto.embassyRef?.trim() || (to === "EMBASSY" && embassyRef)
          ? { embassyRef: (dto.embassyRef?.trim() || embassyRef) ?? undefined }
          : {}),
        ...(embassySubmittedAt !== undefined ? { embassySubmittedAt } : {}),
        ...(passportReturnedAt !== undefined ? { passportReturnedAt } : {}),
        ...(dto.mofaNumber?.trim() || dto.completeMofa
          ? { mofaNumber: mofaNumberRaw || undefined }
          : {}),
      },
    });

    // Activate/update batch VisaRequest.embassy when staff supplies embassy label.
    if (embassyLabel && vr) {
      await this.prisma.visaRequest
        .update({ where: { id: vr.id }, data: { embassy: embassyLabel } })
        .catch(() => undefined);
    }

    await this.audit(
      user,
      "UPDATE",
      passenger.id,
      {
        visaPipelineStatus: from,
        visaNumber: passenger.visaNumber,
        biometricStatus: passenger.biometricStatus,
        embassyRef: passenger.embassyRef,
        embassySubmittedAt: passenger.embassySubmittedAt,
        passportReturnedAt: passenger.passportReturnedAt,
        mofaNumber: passenger.mofaNumber,
      },
      {
        visaPipelineStatus: to,
        from,
        to,
        noop: validation.noop,
        skip: validation.def?.skip ?? false,
        reason: dto.reason ?? null,
        notes: dto.notes ?? null,
        custodyConfirmed: dto.custodyConfirmed ?? null,
        visaNumber: updated.visaNumber,
        biometricStatus: updated.biometricStatus,
        embassyRef: updated.embassyRef,
        embassySubmittedAt: updated.embassySubmittedAt,
        passportReturnedAt: updated.passportReturnedAt,
        mofaNumber: updated.mofaNumber,
        completeMofa: dto.completeMofa ?? false,
        embassy: embassyLabel,
        umrahCompanyId: passenger.group.umrahCompanyId,
        actor: user.email,
        owner: validation.def?.owner ?? "Visa Desk",
        sop: this.sopFlags(),
      },
    );

    const gateAssist = await this.gateAssistForGroup(passenger.groupId);

    this.events.emit(
      EV.PASSENGER_VISA_TRANSITIONED,
      buildEvent(EV.PASSENGER_VISA_TRANSITIONED, {
        tenantId: passenger.group.tenantId,
        companyId: passenger.group.tenantId,
        entityType: "Passenger",
        entityId: passenger.id,
        title: `Visa pipeline ${from} → ${to}`,
        data: {
          from,
          to,
          noop: validation.noop,
          groupId: passenger.group.id,
          groupCode: passenger.group.code,
          passportNo: passenger.passportNo,
          passengerCode: passenger.code,
          reason: dto.reason ?? null,
          embassyRef: updated.embassyRef,
          gateAssist,
        },
      }),
    );

    if (to === "ISSUED" && from !== "ISSUED") {
      this.events.emit(
        EV.VISA_APPROVED,
        buildEvent(EV.VISA_APPROVED, {
          tenantId: passenger.group.tenantId,
          companyId: passenger.group.tenantId,
          entityType: "Passenger",
          entityId: passenger.id,
          title: `Visa issued — ${passenger.code}`,
          data: {
            code: passenger.code,
            groupId: passenger.group.id,
            groupCode: passenger.group.code,
            group_id: passenger.group.code,
            passengerId: passenger.id,
            passengerName: passenger.name,
            passportNo: passenger.passportNo,
            visaNumber: updated.visaNumber,
          },
        }),
      );
    }
    if (to === "REJECTED" && from !== "REJECTED") {
      this.events.emit(
        EV.VISA_REJECTED,
        buildEvent(EV.VISA_REJECTED, {
          tenantId: passenger.group.tenantId,
          companyId: passenger.group.tenantId,
          entityType: "Passenger",
          entityId: passenger.id,
          title: `Visa rejected — ${passenger.code}`,
          data: {
            code: passenger.code,
            groupId: passenger.group.id,
            groupCode: passenger.group.code,
            group_id: passenger.group.code,
            passengerId: passenger.id,
            passengerName: passenger.name,
            passportNo: passenger.passportNo,
            reason: dto.reason ?? updated.visaRejectReason ?? null,
          },
        }),
      );
    }
    // T002-05 — material PASSPORT_RETURNED notify (architecture §9).
    if (to === "PASSPORT_RETURNED" && from !== "PASSPORT_RETURNED") {
      this.events.emit(
        EV.VISA_PASSPORT_RETURNED,
        buildEvent(EV.VISA_PASSPORT_RETURNED, {
          tenantId: passenger.group.tenantId,
          companyId: passenger.group.tenantId,
          entityType: "Passenger",
          entityId: passenger.id,
          title: `Passport returned — ${passenger.code}`,
          data: {
            code: passenger.code,
            groupId: passenger.group.id,
            groupCode: passenger.group.code,
            passengerId: passenger.id,
            passengerName: passenger.name,
            passportNo: passenger.passportNo,
            passportReturnedAt: updated.passportReturnedAt,
            embassyRef: updated.embassyRef,
          },
        }),
      );
    }

    return {
      id: updated.id,
      code: updated.code,
      from,
      to: updated.visaPipelineStatus,
      noop: validation.noop,
      allowedNext: allowedTargets(updated.visaPipelineStatus as VisaPipelineState, {
        requirePassportReturn,
      }),
      visaNumber: updated.visaNumber,
      biometricStatus: updated.biometricStatus,
      visaStatus: updated.visaStatus,
      visaStatusLabel: updated.visaStatusLabel,
      visaRejectReason: updated.visaRejectReason,
      embassyRef: updated.embassyRef,
      embassySubmittedAt: updated.embassySubmittedAt,
      passportReturnedAt: updated.passportReturnedAt,
      mofaNumber: updated.mofaNumber,
      sop: this.sopFlags(),
      gateAssist,
      group: {
        id: passenger.group.id,
        code: passenger.group.code,
        gateVisa: passenger.group.gateVisa,
        umrahCompanyId: passenger.group.umrahCompanyId,
        consulate: passenger.group.consulate,
      },
    };
  }
}
