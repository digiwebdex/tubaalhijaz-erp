import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  UploadedFile as UploadedFileDec,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Throttle } from "@nestjs/throttler";
import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import { ServiceRequestStatus, UploadKind } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { validateUpload } from "../storage/file-type";
import { AuthUser, CurrentUser } from "../common/decorators/current-user.decorator";
import { ServicesService } from "./services.service";
import { SERVICE_META, ServiceKey } from "./service-types";
import { RejectBookingDto } from "./dto";
import { WalletService } from "../finance/wallet.service";
import { NotificationsService } from "../notifications/notifications.service";

const SUPPLIER_SERVICES: ServiceKey[] = ["hotel", "transport", "catering"];

function parseSupplierService(service: string): ServiceKey {
  if (!SUPPLIER_SERVICES.includes(service as ServiceKey)) {
    throw new BadRequestException(`Unknown supplier service '${service}' — use hotel|transport|catering`);
  }
  return service as ServiceKey;
}

const fmt = (d: Date | null | undefined) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : null;

/** Supplier voucher/invoice upload metadata (multipart fields). */
class SupplierUploadDto {
  @IsOptional() @IsString() @MaxLength(60) invoiceNo?: string;
  @IsOptional() @IsString() @MaxLength(20) amountExVat?: string;
  @IsOptional() @IsString() @MaxLength(80) servicePeriod?: string;
  @IsOptional() @IsIn(["HOTEL", "TRANSPORT", "CATERING", "ZIYARAH"]) voucherType?: string;
  @IsOptional() @IsString() @MaxLength(40) issueDate?: string;
  @IsOptional() @IsString() @MaxLength(40) expiry?: string;
  @IsOptional() @IsString() @MaxLength(300) notes?: string;
}

/**
 * Supplier Portal endpoints. All queries run through the tenant-scoped client,
 * so a supplier only ever sees bookings where supplierId = their company.
 */
@Controller("supplier")
export class SupplierController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly services: ServicesService,
    private readonly storage: StorageService,
    private readonly wallet: WalletService,
    private readonly notifications: NotificationsService,
  ) {}

  private assertSupplierOrStaff(user: AuthUser) {
    if (user.companyType === "AGENT") throw new ForbiddenException("Supplier portal only");
  }

  /** Unified incoming-bookings list across hotel/transport/catering. */
  @Get("bookings")
  async bookings(@CurrentUser() user: AuthUser, @Query("status") status?: ServiceRequestStatus) {
    this.assertSupplierOrStaff(user);
    const where = status ? { status } : {};
    const include = {
      group: { select: { code: true, name: true, paxCount: true, tenant: { select: { name: true } } } },
    } as const;

    const [hotel, transport, catering] = await Promise.all([
      this.prisma.scoped.hotelBooking.findMany({
        where, include: { ...include, hotel: { select: { name: true } } }, orderBy: { createdAt: "desc" },
      }),
      this.prisma.scoped.transportBooking.findMany({ where, include, orderBy: { createdAt: "desc" } }),
      this.prisma.scoped.cateringBooking.findMany({ where, include, orderBy: { createdAt: "desc" } }),
    ]);

    const rows = [
      ...hotel.map((b) => ({
        service: "hotel" as const,
        id: b.id,
        code: b.code,
        status: b.status,
        statusReason: b.statusReason,
        group: b.group.code,
        groupName: b.group.name,
        agent: b.group.tenant.name,
        pax: b.group.paxCount,
        detail: `${b.doubleRooms} Double + ${b.tripleRooms} Triple${b.singleRooms ? ` + ${b.singleRooms} Single` : ""} rooms · ${String(b.mealPlan).replace(/_/g, " ")}${b.hotel ? ` · ${b.hotel.name}` : ""}`,
        dateFrom: fmt(b.checkIn),
        dateTo: fmt(b.checkOut),
        nights: b.nights,
        amount: b.totalAmount ? Number(b.totalAmount) : null,
        createdAt: b.createdAt,
      })),
      ...transport.map((b) => ({
        service: "transport" as const,
        id: b.id,
        code: b.code,
        status: b.status,
        statusReason: b.statusReason,
        group: b.group.code,
        groupName: b.group.name,
        agent: b.group.tenant.name,
        pax: b.group.paxCount,
        detail: `${b.vehicleCount}× ${b.vehicleType} · ${b.departurePoint} → ${b.destination}`,
        dateFrom: fmt(b.departAt),
        dateTo: fmt(b.returnAt),
        nights: null as number | null,
        amount: b.totalAmount ? Number(b.totalAmount) : null,
        createdAt: b.createdAt,
      })),
      ...catering.map((b) => ({
        service: "catering" as const,
        id: b.id,
        code: b.code,
        status: b.status,
        statusReason: b.statusReason,
        group: b.group.code,
        groupName: b.group.name,
        agent: b.group.tenant.name,
        pax: b.group.paxCount,
        detail: `${String(b.mealPlan).replace(/_/g, " ")} · Halal ${b.halalCount} / Veg ${b.vegetarianCount} / Diab ${b.diabeticCount}`,
        dateFrom: fmt(b.startDate),
        dateTo: fmt(b.endDate),
        nights: null as number | null,
        amount: b.totalAmount ? Number(b.totalAmount) : null,
        createdAt: b.createdAt,
      })),
    ];
    return rows.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }

  /** Accept an assigned booking → CONFIRMED → voucher generated → VOUCHER_ISSUED. */
  @Post("bookings/:service/:id/accept")
  async accept(@Param("service") service: string, @Param("id") id: string, @CurrentUser() user: AuthUser) {
    const key = parseSupplierService(service);
    this.assertSupplierOrStaff(user);
    // scoped lookup — a supplier can only reach their own assigned rows
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = await (this.prisma.scoped as any)[SERVICE_META[key].model].findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Booking not found");
    if (row.status !== "ASSIGNED") {
      throw new BadRequestException(`Only ASSIGNED bookings can be accepted (current: ${row.status})`);
    }

    // Atomic guard: only ONE racing accept flips ASSIGNED→CONFIRMED. A retry /
    // double-click that loses the race gets a 0-count update and stops here,
    // so the wallet auto-deduct fires exactly once.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const flipped = await (this.prisma as any)[SERVICE_META[key].model].updateMany({
      where: { id, status: "ASSIGNED" },
      data: { status: "CONFIRMED", statusReason: null },
    });
    if (flipped.count !== 1) {
      throw new BadRequestException("Booking is no longer awaiting acceptance");
    }
    await this.prisma.auditLog.create({
      data: {
        actorUserId: user.sub, action: "APPROVE", module: "SupplierPortal",
        entityType: SERVICE_META[key].model, entityId: id,
        after: { code: row.code, from: "ASSIGNED", to: "CONFIRMED" },
      },
    });

    // Auto-deduct the agent's wallet on confirmation (idempotent; never blocks accept)
    let charged: { charged: boolean; amount: number } = { charged: false, amount: 0 };
    if (row.totalAmount && Number(row.totalAmount) > 0) {
      charged = await this.wallet
        .autoDeductForBooking(row.tenantId, Number(row.totalAmount), {
          refType: SERVICE_META[key].model,
          refId: id,
          description: `${SERVICE_META[key].label} — ${row.code}`,
          groupId: row.groupId,
          createdById: user.sub,
        })
        .catch((e) => {
          console.error("[supplier] wallet auto-deduct failed:", e);
          return { charged: false, amount: 0 };
        });
    }

    // Acceptance triggers the Voucher Generator (BRN + PDF + link back to group)
    const voucher = await this.services.ensureVoucher(key, id, user);
    return {
      status: "VOUCHER_ISSUED",
      voucher: { id: voucher.id, code: voucher.code, fileId: voucher.fileId },
      walletCharged: charged.charged ? charged.amount : 0,
    };
  }

  /** Reject with a mandatory reason. */
  @Post("bookings/:service/:id/reject")
  async reject(
    @Param("service") service: string,
    @Param("id") id: string,
    @Body() dto: RejectBookingDto,
    @CurrentUser() user: AuthUser,
  ) {
    const key = parseSupplierService(service);
    this.assertSupplierOrStaff(user);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = await (this.prisma.scoped as any)[SERVICE_META[key].model].findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Booking not found");
    if (row.status !== "ASSIGNED") {
      throw new BadRequestException(`Only ASSIGNED bookings can be rejected (current: ${row.status})`);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updated = await (this.prisma as any)[SERVICE_META[key].model].update({
      where: { id }, data: { status: "REJECTED", statusReason: dto.reason },
    });
    await this.prisma.auditLog.create({
      data: {
        actorUserId: user.sub, action: "REJECT", module: "SupplierPortal",
        entityType: SERVICE_META[key].model, entityId: id,
        after: { code: row.code, reason: dto.reason },
      },
    });
    // Async delivery via tuba-notify (S2-03) — no direct NotificationLog create.
    await this.notifications.dispatch({
      channels: ["IN_APP"],
      literalContent: true,
      tenantId: row.tenantId,
      title: `Booking rejected — ${row.code}`,
      body: `The supplier rejected ${row.code}: ${dto.reason}`,
    });
    return updated;
  }

  /** Supplier voucher / invoice uploads for a booking. */
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post("bookings/:service/:id/upload")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 10 * 1024 * 1024 } }))
  async upload(
    @Param("service") service: string,
    @Param("id") id: string,
    @Query("type") type: "voucher" | "invoice",
    @UploadedFileDec() file: Express.Multer.File | undefined,
    @Body() body: SupplierUploadDto,
    @CurrentUser() user: AuthUser,
  ) {
    const key = parseSupplierService(service);
    this.assertSupplierOrStaff(user);
    if (!file) throw new BadRequestException("No file provided (multipart field: file)");
    if (type !== "voucher" && type !== "invoice") {
      throw new BadRequestException("type must be voucher|invoice");
    }
    // content scan (magic bytes) — this path bypassed /uploads, so scan here too
    const scan = validateUpload(file.buffer, file.mimetype);
    if (!scan.ok) throw new BadRequestException(`Rejected: ${scan.reason}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = await (this.prisma.scoped as any)[SERVICE_META[key].model].findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Booking not found");
    if (!["CONFIRMED", "VOUCHER_ISSUED", "COMPLETED"].includes(row.status)) {
      throw new BadRequestException("Uploads are allowed after the booking is accepted");
    }

    const stored = await this.storage.store(file.originalname || `${type}.pdf`, file.buffer, file.mimetype);
    const amountExVat = body.amountExVat ? Number(body.amountExVat) : undefined;
    const created = await this.prisma.uploadedFile.create({
      data: {
        bucket: stored.bucket,
        storageKey: stored.storageKey,
        fileName: file.originalname || `${type}.pdf`,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        kind: (type === "voucher" ? "VOUCHER" : "INVOICE") as UploadKind,
        companyId: user.companyId, // the supplier's document shelf
        uploadedById: user.sub,
        meta: {
          bookingService: key,
          bookingId: id,
          bookingCode: row.code,
          ...(type === "invoice"
            ? {
                invoiceNo: body.invoiceNo,
                amountExVat,
                vatAmount: amountExVat !== undefined ? +(amountExVat * 0.15).toFixed(2) : undefined,
                total: amountExVat !== undefined ? +(amountExVat * 1.15).toFixed(2) : undefined,
                servicePeriod: body.servicePeriod,
              }
            : { voucherType: body.voucherType, issueDate: body.issueDate, expiry: body.expiry }),
          notes: body.notes,
        },
      },
    });
    return { documentId: created.id, storageKey: created.storageKey, kind: created.kind, meta: created.meta };
  }

  /** Recent supplier uploads (voucher/invoice shelves). */
  @Get("uploads")
  uploads(@CurrentUser() user: AuthUser, @Query("kind") kind?: "VOUCHER" | "INVOICE") {
    this.assertSupplierOrStaff(user);
    return this.prisma.uploadedFile.findMany({
      where: {
        companyId: user.companyId ?? undefined,
        ...(kind ? { kind } : { kind: { in: ["VOUCHER", "INVOICE"] } }),
      },
      orderBy: { createdAt: "desc" },
      take: 25,
    });
  }
}
