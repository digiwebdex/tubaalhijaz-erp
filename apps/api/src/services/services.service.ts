import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, ServiceRequestStatus } from "@prisma/client";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { PrismaService } from "../prisma/prisma.service";
import { PricingService } from "./pricing.service";
import { BookingConfirmationService } from "./booking-confirmation.service";
import { StorageService } from "../storage/storage.service";
import { AuthUser } from "../common/decorators/current-user.decorator";
import { VoucherGeneratorService } from "./voucher-generator.service";
import { InvoiceService } from "../finance/invoice.service";
import { NotificationsService } from "../notifications/notifications.service";
import { EV, buildEvent } from "../automation/events";
import {
  CATERING_PLAN_PRICE,
  SERVICE_META,
  SERVICE_TRANSITIONS,
  ServiceKey,
} from "./service-types";
import {
  CreateAdditionalServiceDto,
  CreateCateringBookingDto,
  CreateHotelBookingDto,
  CreateTransportBookingDto,
  CreateVisaRequestDto,
} from "./dto";

const D = (v: number | string) => new Prisma.Decimal(v);
const VAT_RATE = 0.15;
const fmt = (d: Date | null | undefined) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

@Injectable()
export class ServicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly pdf: VoucherGeneratorService,
    private readonly invoices: InvoiceService,
    private readonly events: EventEmitter2,
    private readonly notifications: NotificationsService,
    private readonly pricing: PricingService,
    private readonly bookingConfirmation: BookingConfirmationService,
  ) {}

  /** Scoped delegate for a service model (tenant/supplier scoping applies automatically). */
  private scopedModel(service: ServiceKey) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (this.prisma.scoped as any)[SERVICE_META[service].model];
  }
  private rawModel(service: ServiceKey) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (this.prisma as any)[SERVICE_META[service].model];
  }

  private async seasonYear(): Promise<number> {
    const s = await this.prisma.season.findFirst({ where: { isActive: true } });
    return s?.hijriYear ?? 1446;
  }

  private async uniqueCode(service: ServiceKey): Promise<string> {
    for (let i = 0; i < 10; i++) {
      const code = `${SERVICE_META[service].codePrefix}-${String(1000 + Math.floor(Math.random() * 9000))}`;
      const exists = await this.rawModel(service).findUnique({ where: { code } });
      if (!exists) return code;
    }
    throw new BadRequestException("Could not allocate a request code");
  }

  /** Pick the supplier the request is routed to (MVP auto-routing; ops can re-route). */
  private async routeSupplier(service: ServiceKey, preferredId?: string | null): Promise<string | null> {
    if (preferredId) return preferredId;
    const type = SERVICE_META[service].supplierType;
    if (!type) return null;
    const supplier = await this.prisma.company.findFirst({
      where: { type: "SUPPLIER", verificationStatus: "VERIFIED", supplierProfile: { type } },
      orderBy: { code: "asc" },
    });
    return supplier?.id ?? null;
  }

  private async loadGroup(groupId: string) {
    const group = await this.prisma.scoped.group.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException("Group not found");
    return group;
  }

  /** T002-01 — Umrah Co must be a verified SUPPLIER with supplierProfile.type=UMRAH_COMPANY. */
  private async assertUmrahCompany(companyId: string | null | undefined) {
    if (!companyId) return;
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: { supplierProfile: { select: { type: true } } },
    });
    if (!company) throw new BadRequestException("Unknown umrahCompanyId");
    if (company.type !== "SUPPLIER" || company.supplierProfile?.type !== "UMRAH_COMPANY") {
      throw new BadRequestException("umrahCompanyId must reference a UMRAH_COMPANY supplier");
    }
    if (company.verificationStatus !== "VERIFIED") {
      throw new BadRequestException("Umrah Company must be VERIFIED");
    }
  }

  /** Catalogue of verified Umrah Companies for Group / VisaRequest pickers (T002-01). */
  listUmrahCompanies() {
    return this.prisma.company.findMany({
      where: {
        type: "SUPPLIER",
        verificationStatus: "VERIFIED",
        supplierProfile: { type: "UMRAH_COMPANY" },
      },
      select: { id: true, code: true, name: true, nameBn: true, city: true, country: true },
      orderBy: { name: "asc" },
    });
  }

  // ── creates (agent side; fields mirror the UI screens) ─────────────────────
  async createVisa(dto: CreateVisaRequestDto, user: AuthUser) {
    const group = await this.loadGroup(dto.groupId);
    const embassy =
      dto.embassy?.trim() || group.consulate?.trim() || null;
    const umrahCompanyId = dto.umrahCompanyId?.trim() || group.umrahCompanyId || null;
    await this.assertUmrahCompany(umrahCompanyId);
    const pricing = await this.pricing.priceVisa({ visaType: dto.visaType, visaCategory: dto.mohCategory ?? null, pax: group.paxCount });

    const created = await this.prisma.scoped.visaRequest.create({
      data: {
        code: await this.uniqueCode("visa"),
        tenantId: group.tenantId,
        groupId: group.id,
        seasonId: group.seasonId,
        visaType: dto.visaType,
        applicationYearHijri: dto.applicationYearHijri ?? String(await this.seasonYear()),
        nusukRef: dto.nusukRef,
        muallimNo: dto.muallimNo,
        mahramWaiverNo: dto.mahramWaiverNo,
        mohCategory: dto.mohCategory,
        embassy,
        umrahCompanyId,
        notes: dto.notes,
        status: "REQUESTED",
        submittedAt: new Date(),
        ...(pricing ?? {}),
      },
      include: {
        umrahCompany: { select: { id: true, code: true, name: true } },
        group: { select: { id: true, code: true, name: true } },
      },
    });
    await this.audit(user, "CREATE", "VisaRequest", created.id, {
      code: created.code,
      group: group.code,
      visaType: created.visaType,
      embassy: created.embassy,
      umrahCompanyId: created.umrahCompanyId,
    });
    return created;
  }

  async createHotel(dto: CreateHotelBookingDto, user: AuthUser) {
    const group = await this.loadGroup(dto.groupId);
    const checkIn = new Date(dto.checkIn);
    const checkOut = new Date(dto.checkOut);
    const nights = Math.max(1, Math.round((checkOut.getTime() - checkIn.getTime()) / 86_400_000));
    const hotel = dto.hotelId
      ? await this.prisma.hotel.findUnique({ where: { id: dto.hotelId } })
      : null;
    if (dto.hotelId && !hotel) throw new NotFoundException("Hotel not found");
    if (hotel && !hotel.available) throw new BadRequestException(`${hotel.name} is fully booked`);

    const rooms = dto.doubleRooms + dto.tripleRooms + (dto.singleRooms ?? 0);
    const rate = hotel?.pricePerNight ?? null;
    const subtotal = rate ? Number(rate) * rooms * nights : null;
    const supplierId = await this.routeSupplier("hotel", hotel?.supplierId);

    const created = await this.prisma.scoped.hotelBooking.create({
      data: {
        code: await this.uniqueCode("hotel"),
        tenantId: group.tenantId,
        groupId: group.id,
        hotelId: hotel?.id,
        supplierId,
        checkIn,
        checkOut,
        nights,
        doubleRooms: dto.doubleRooms,
        tripleRooms: dto.tripleRooms,
        singleRooms: dto.singleRooms ?? 0,
        mealPlan: dto.mealPlan,
        ratePerRoom: rate,
        subtotal: subtotal !== null ? D(subtotal) : null,
        vatAmount: subtotal !== null ? D(subtotal * 0.15) : null,
        totalAmount: subtotal !== null ? D(subtotal * 1.15) : null,
        specialRequests: dto.specialRequests,
        status: supplierId ? "ASSIGNED" : "REQUESTED",
      },
    });
    await this.audit(user, "CREATE", "HotelBooking", created.id, { code: created.code, group: group.code });
    return created;
  }

  async createTransport(dto: CreateTransportBookingDto, user: AuthUser) {
    const group = await this.loadGroup(dto.groupId);
    const supplierId = await this.routeSupplier("transport");
    const pricing = await this.pricing.priceTransport({ vehicleType: dto.vehicleType, tripType: dto.returnAt ? "ROUND_TRIP" : "ONE_WAY", vehicleCount: dto.vehicleCount });
    const created = await this.prisma.scoped.transportBooking.create({
      data: {
        code: await this.uniqueCode("transport"),
        tenantId: group.tenantId,
        groupId: group.id,
        supplierId,
        vehicleType: dto.vehicleType,
        vehicleCount: dto.vehicleCount,
        departurePoint: dto.departurePoint,
        destination: dto.destination,
        stopPoints: dto.stopPoints,
        departAt: new Date(dto.departAt),
        returnAt: dto.returnAt ? new Date(dto.returnAt) : null,
        ...(pricing ?? {}),
        status: supplierId ? "ASSIGNED" : "REQUESTED",
      },
    });
    await this.audit(user, "CREATE", "TransportBooking", created.id, { code: created.code, group: group.code });
    return created;
  }

  async createCatering(dto: CreateCateringBookingDto, user: AuthUser) {
    const group = await this.loadGroup(dto.groupId);
    const startDate = dto.startDate ? new Date(dto.startDate) : group.departDate;
    const endDate = dto.endDate ? new Date(dto.endDate) : group.returnDate;
    const days =
      startDate && endDate
        ? Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000))
        : null;
    const price = CATERING_PLAN_PRICE[dto.mealPlan] ?? null;
    const total = price !== null && days !== null ? price * group.paxCount * days : null;
    const supplierId = await this.routeSupplier("catering");

    const created = await this.prisma.scoped.cateringBooking.create({
      data: {
        code: await this.uniqueCode("catering"),
        tenantId: group.tenantId,
        groupId: group.id,
        supplierId,
        mealPlan: dto.mealPlan,
        pricePerPaxDay: price !== null ? D(price) : null,
        halalCount: dto.halalCount ?? group.paxCount,
        vegetarianCount: dto.vegetarianCount ?? 0,
        diabeticCount: dto.diabeticCount ?? 0,
        specialInstructions: dto.specialInstructions,
        startDate,
        endDate,
        // Store VAT-INCLUSIVE total (matches hotel's convention) so the wallet
        // auto-deduct on confirmation equals the invoice total on completion.
        totalAmount: total !== null ? D(total * (1 + VAT_RATE)) : null,
        status: supplierId ? "ASSIGNED" : "REQUESTED",
      },
    });
    await this.audit(user, "CREATE", "CateringBooking", created.id, { code: created.code, group: group.code });
    return created;
  }

  async createAdditional(dto: CreateAdditionalServiceDto, user: AuthUser) {
    const group = await this.loadGroup(dto.groupId);
    const pricing = await this.pricing.priceAdditional({ serviceType: dto.serviceType, beneficiaries: dto.beneficiaries });
    const created = await this.prisma.scoped.additionalServiceRequest.create({
      data: {
        code: await this.uniqueCode("additional"),
        tenantId: group.tenantId,
        groupId: group.id,
        serviceType: dto.serviceType,
        beneficiaries: dto.beneficiaries,
        priority: dto.priority,
        description: dto.description,
        requestedFor: dto.requestedFor ? new Date(dto.requestedFor) : null,
        ...(pricing ?? {}),
        status: "REQUESTED",
      },
    });
    await this.audit(user, "CREATE", "AdditionalServiceRequest", created.id, { code: created.code, group: group.code });
    return created;
  }

  // ── reads ──────────────────────────────────────────────────────────────────
  async list(service: ServiceKey, filters: { groupId?: string; status?: ServiceRequestStatus }) {
    const rows = await this.scopedModel(service).findMany({
      where: {
        ...(filters.groupId ? { groupId: filters.groupId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      },
      include: {
        group: { select: { id: true, code: true, name: true, paxCount: true } },
        ...(SERVICE_META[service].supplierType
          ? { supplier: { select: { id: true, code: true, name: true } } }
          : {}),
        ...(service === "hotel" ? { hotel: { select: { id: true, name: true, stars: true } } } : {}),
        ...(service === "visa"
          ? { umrahCompany: { select: { id: true, code: true, name: true } } }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return this.attachVouchers(service, rows as Array<{ id: string }>);
  }

  /** All five pipelines for one group — powers the Agent Portal status trackers. */
  async summary(groupId: string) {
    const [visa, hotel, transport, catering, additional] = await Promise.all([
      this.list("visa", { groupId }),
      this.list("hotel", { groupId }),
      this.list("transport", { groupId }),
      this.list("catering", { groupId }),
      this.list("additional", { groupId }),
    ]);
    return { visa, hotel, transport, catering, additional };
  }

  private async attachVouchers<T extends { id: string }>(service: ServiceKey, rows: T[]) {
    if (!SERVICE_META[service].voucherType || rows.length === 0) return rows;
    const vouchers = await this.prisma.voucher.findMany({
      where: { refType: SERVICE_META[service].model, refId: { in: rows.map((r) => r.id) } },
      select: { id: true, code: true, refId: true, fileId: true, status: true, issueDate: true, validUntil: true },
    });
    const byRef = new Map(vouchers.map((v) => [v.refId, v]));
    return rows.map((r) => ({ ...r, voucher: byRef.get(r.id) ?? null }));
  }

  // ── state machine ──────────────────────────────────────────────────────────
  async transition(
    service: ServiceKey,
    id: string,
    next: ServiceRequestStatus,
    opts: { reason?: string; supplierId?: string },
    user: AuthUser,
  ) {
    const row = await this.scopedModel(service).findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Request not found");

    // Role rules: agents may only cancel; suppliers must use /supplier endpoints.
    if (user.companyType === "AGENT" && next !== "CANCELLED") {
      throw new ForbiddenException("Agents can only cancel their requests");
    }
    if (user.companyType === "SUPPLIER") {
      throw new ForbiddenException("Suppliers act via the supplier endpoints (accept/reject)");
    }

    const allowed = SERVICE_TRANSITIONS[row.status as ServiceRequestStatus] ?? [];
    if (!allowed.includes(next)) {
      throw new BadRequestException(
        `Illegal transition ${row.status} → ${next}. Allowed: ${allowed.join(", ") || "none"}`,
      );
    }
    if (next === "REJECTED" && !opts.reason) {
      throw new BadRequestException("A reason is required when rejecting");
    }

    if (next === "CONFIRMED") {
      return this.bookingConfirmation.confirm(service, id, user);
    }

    let supplierId: string | undefined;
    if (next === "ASSIGNED" && SERVICE_META[service].supplierType) {
      supplierId = opts.supplierId ?? row.supplierId ?? (await this.routeSupplier(service)) ?? undefined;
      if (!supplierId) throw new BadRequestException("No supplier available — pass supplierId");
    }

    const updated = await this.rawModel(service).update({
      where: { id },
      data: {
        status: next,
        statusReason: next === "REJECTED" || next === "CANCELLED" ? (opts.reason ?? null) : null,
        ...(supplierId ? { supplierId } : {}),
      },
    });
    await this.audit(user, "UPDATE", SERVICE_META[service].model, id, {
      code: row.code, from: row.status, to: next, ...(opts.reason ? { reason: opts.reason } : {}),
    });

    // Domain events → automation rules react (notify agent, confirm voucher, …).
    const tenantId = (row as { tenantId?: string }).tenantId ?? null;
    const groupId = (row as { groupId?: string }).groupId ?? null;
    const evData = { service, status: next, from: row.status, code: row.code, bookingId: id, groupId };
    this.events.emit(
      EV.SERVICE_STATUS_CHANGED,
      buildEvent(EV.SERVICE_STATUS_CHANGED, { tenantId, entityType: SERVICE_META[service].model, entityId: id, title: `${row.code} → ${next}`, data: evData }),
    );

    // Staff moving CONFIRMED → VOUCHER_ISSUED generates the voucher if missing
    if (next === "VOUCHER_ISSUED" && SERVICE_META[service].voucherType) {
      await this.ensureVoucher(service, id, user);
    }
    // Completing a service auto-generates the invoice (Automation Engine rule;
    // the rule *engine* itself is formalized in Phase 10). Never blocks the transition.
    if (next === "COMPLETED") {
      await this.invoices
        .autoInvoiceOnCompletion(service, id, user.sub)
        .catch((e) => console.error("[services] auto-invoice failed:", e));
    }
    return updated;
  }

  // ── voucher generation pipeline (accept-triggered) ─────────────────────────
  /** Staff price override for the priced services (transport/visa/additional). */
  async overridePrice(service: ServiceKey, id: string, price: number, reason: string, user: AuthUser) {
    if (!["transport", "visa", "additional"].includes(service)) {
      throw new BadRequestException("Price override is available for transport, visa and additional services only");
    }
    const model = SERVICE_META[service].model;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = await (this.prisma as any)[model].findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Booking not found");
    const subtotal = +Number(price).toFixed(2);
    const vatAmount = +(subtotal * 0.15).toFixed(2);
    const totalAmount = +(subtotal + vatAmount).toFixed(2);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updated = await (this.prisma as any)[model].update({
      where: { id },
      data: { unitPrice: subtotal, subtotal, vatAmount, totalAmount, priceOverridden: true, priceOverrideReason: reason },
    });
    await this.prisma.auditLog.create({
      data: {
        actorUserId: user.sub,
        action: "UPDATE",
        module: "Services",
        entityType: model,
        entityId: id,
        before: { subtotal: row.subtotal, totalAmount: row.totalAmount, priceOverridden: row.priceOverridden } as never,
        after: { subtotal, totalAmount, priceOverridden: true, reason, overriddenBy: user.sub } as never,
      },
    });
    return updated;
  }

  async ensureVoucher(service: ServiceKey, bookingId: string, actor: AuthUser) {
    const meta = SERVICE_META[service];
    if (!meta.voucherType) throw new BadRequestException(`${meta.label} has no voucher`);

    const existing = await this.prisma.voucher.findFirst({
      where: { refType: meta.model, refId: bookingId },
    });
    if (existing) return existing;

    const row = await this.rawModel(service).findUnique({
      where: { id: bookingId },
      include: {
        group: { include: { tenant: { select: { name: true } } } },
        supplier: { select: { name: true } },
        ...(service === "hotel" ? { hotel: { select: { name: true } } } : {}),
      },
    });
    if (!row) throw new NotFoundException("Booking not found");
    const year = await this.seasonYear();

    // BRN: reuse the booking's BRN or create one (links group ⇄ contract)
    let brn =
      service === "hotel"
        ? await this.prisma.bRN.findFirst({ where: { hotelBookingId: bookingId } })
        : await this.prisma.bRN.findFirst({ where: { groupId: row.groupId, serviceScope: meta.label } });
    if (!brn) {
      let brnCode = "";
      for (let i = 0; i < 10; i++) {
        brnCode = `BRN-${year}-${String(1000 + Math.floor(Math.random() * 9000))}`;
        if (!(await this.prisma.bRN.findUnique({ where: { code: brnCode } }))) break;
      }
      brn = await this.prisma.bRN.create({
        data: {
          code: brnCode,
          tenantId: row.tenantId,
          groupId: row.groupId,
          hotelBookingId: service === "hotel" ? bookingId : undefined,
          serviceScope: meta.label,
          detail: `${meta.label} · ${row.code}`,
          status: "PROCESSING",
        },
      });
    }

    // Voucher code VCH-{year}-{groupSerial}-{SVC}
    const groupSerial = String(row.group.code).split("-").pop();
    let voucherCode = `VCH-${year}-${groupSerial}-${meta.voucherSuffix}`;
    for (let i = 2; await this.prisma.voucher.findUnique({ where: { code: voucherCode } }); i++) {
      voucherCode = `VCH-${year}-${groupSerial}-${meta.voucherSuffix}${i}`;
    }

    const { details, validUntil } = this.voucherDetails(service, row);
    const pdfBytes = await this.pdf.generate({
      voucherNo: voucherCode,
      brnCode: brn.code,
      typeLabel: `${meta.label.split(" ")[0]} Voucher`,
      groupCode: row.group.code,
      groupName: row.group.name,
      agentName: row.group.tenant.name,
      supplierName: row.supplier?.name ?? "TUBA AL HIJAZ Operations",
      pax: row.group.paxCount,
      issueDate: new Date(),
      validUntil,
      details,
    });

    const stored = await this.storage.store(`${voucherCode}.pdf`, Buffer.from(pdfBytes), "application/pdf");
    const file = await this.prisma.uploadedFile.create({
      data: {
        bucket: stored.bucket,
        storageKey: stored.storageKey,
        fileName: `${voucherCode}.pdf`,
        mimeType: "application/pdf",
        sizeBytes: pdfBytes.length,
        kind: "VOUCHER",
        companyId: row.tenantId, // the agent downloads it from their portal
        meta: { bookingService: service, bookingId, brn: brn.code },
      },
    });

    const voucher = await this.prisma.voucher.create({
      data: {
        code: voucherCode,
        type: meta.voucherType,
        tenantId: row.tenantId,
        groupId: row.groupId,
        refType: meta.model,
        refId: bookingId,
        fileId: file.id,
        issueDate: new Date(),
        validUntil,
        status: "ISSUED",
        payload: {
          brn: brn.code,
          group: row.group.code,
          agent: row.group.tenant.name,
          supplier: row.supplier?.name ?? null,
          pax: row.group.paxCount,
          details,
        },
      },
    });

    await this.prisma.$transaction([
      this.rawModel(service).update({ where: { id: bookingId }, data: { status: "VOUCHER_ISSUED" } }),
      this.prisma.bRN.update({ where: { id: brn.id }, data: { status: "FULFILLED" } }),
    ]);

    // Async delivery via tuba-notify (S2-03) — no direct NotificationLog create.
    await this.notifications.dispatch({
      eventKey: "HOTEL_BOOKING_CONFIRMED",
      channels: ["IN_APP"],
      literalContent: true,
      tenantId: row.tenantId,
      title: `Voucher ready — ${voucherCode}`,
      body: `${meta.label} ${row.code} for ${row.group.code} confirmed. Voucher ${voucherCode} is ready to download.`,
    });

    await this.audit(actor, "CREATE", "Voucher", voucher.id, { code: voucherCode, booking: row.code, brn: brn.code });

    // Voucher issued → automation (e.g. GENERATE_QR) reacts.
    this.events.emit(
      EV.VOUCHER_GENERATED,
      buildEvent(EV.VOUCHER_GENERATED, {
        tenantId: row.tenantId, entityType: "Voucher", entityId: voucher.id,
        title: `Voucher ${voucherCode}`,
        data: { voucherId: voucher.id, voucherCode, code: voucherCode, service, bookingId, brn: brn.code },
      }),
    );
    return voucher;
  }

  private voucherDetails(service: ServiceKey, row: Record<string, never> | any): {
    details: Array<{ label: string; value: string }>;
    validUntil: Date | null;
  } {
    if (service === "hotel") {
      return {
        validUntil: row.checkOut,
        details: [
          { label: "Hotel / Location", value: row.hotel?.name ?? "As arranged by TUBA Operations" },
          { label: "Check-in", value: fmt(row.checkIn) },
          { label: "Check-out", value: fmt(row.checkOut) },
          { label: "Nights", value: String(row.nights) },
          {
            label: "Rooms",
            value: `${row.doubleRooms} Double + ${row.tripleRooms} Triple${row.singleRooms ? ` + ${row.singleRooms} Single` : ""}`,
          },
          { label: "Meal Plan", value: String(row.mealPlan).replace(/_/g, " ") },
          ...(row.totalAmount ? [{ label: "Total (incl. VAT 15%)", value: `SAR ${Number(row.totalAmount).toLocaleString()}` }] : []),
        ],
      };
    }
    if (service === "transport") {
      return {
        validUntil: row.returnAt ?? row.departAt,
        details: [
          { label: "Vehicles", value: `${row.vehicleCount}× ${String(row.vehicleType)}` },
          { label: "Pickup", value: row.departurePoint },
          { label: "Destination", value: row.destination },
          { label: "Departure", value: fmt(row.departAt) },
          { label: "Return", value: fmt(row.returnAt) },
          ...(row.stopPoints ? [{ label: "Stop Points", value: row.stopPoints }] : []),
        ],
      };
    }
    // catering
    return {
      validUntil: row.endDate,
      details: [
        { label: "Meal Plan", value: String(row.mealPlan).replace(/_/g, " ") },
        { label: "Service Period", value: `${fmt(row.startDate)} – ${fmt(row.endDate)}` },
        {
          label: "Dietary",
          value: `Halal ${row.halalCount} · Vegetarian ${row.vegetarianCount} · Diabetic ${row.diabeticCount}`,
        },
        ...(row.pricePerPaxDay ? [{ label: "Rate", value: `SAR ${Number(row.pricePerPaxDay)} / pax / day` }] : []),
        ...(row.totalAmount ? [{ label: "Total", value: `SAR ${Number(row.totalAmount).toLocaleString()}` }] : []),
      ],
    };
  }

  private audit(user: AuthUser, action: "CREATE" | "UPDATE", entityType: string, entityId: string, after: object) {
    return this.prisma.auditLog.create({
      data: { actorUserId: user.sub, action, module: "Services", entityType, entityId, after: after as never },
    });
  }
}
