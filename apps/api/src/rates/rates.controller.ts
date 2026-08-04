import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post } from "@nestjs/common";
import { IsBoolean, IsDateString, IsIn, IsNumber, IsOptional, IsString, MaxLength, Min } from "class-validator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { AuthUser, CurrentUser } from "../common/decorators/current-user.decorator";
import { PrismaService } from "../prisma/prisma.service";

const UNITS = ["PER_VEHICLE", "PER_SEAT", "PER_PERSON", "PER_SERVICE", "PER_TRIP"];

class TransportRateDto {
  @IsIn(["SEDAN", "VAN", "HIACE", "COASTER", "BUS"]) vehicleType!: string;
  @IsOptional() @IsString() @MaxLength(160) route?: string;
  @IsIn(["ONE_WAY", "ROUND_TRIP"]) tripType!: string;
  @IsIn(UNITS) unit!: string;
  @IsOptional() @IsString() @MaxLength(3) currency?: string;
  @IsNumber() @Min(0) price!: number;
  @IsOptional() @IsDateString() effectiveFrom?: string;
  @IsOptional() @IsDateString() effectiveTo?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}
class VisaRateDto {
  @IsIn(["UMRAH", "LONG_STAY", "HAJJ"]) visaType!: string;
  @IsOptional() @IsIn(["A", "B", "C"]) visaCategory?: string;
  @IsOptional() @IsString() @MaxLength(80) country?: string;
  @IsIn(["NORMAL", "EXPRESS", "VIP"]) processingType!: string;
  @IsOptional() @IsString() @MaxLength(3) currency?: string;
  @IsNumber() @Min(0) price!: number;
  @IsOptional() @IsDateString() effectiveFrom?: string;
  @IsOptional() @IsDateString() effectiveTo?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}
class AdditionalRateDto {
  @IsIn(["WHEELCHAIR", "VIP_LOUNGE", "SIM_CARD", "INSURANCE", "PHOTOGRAPHY", "INTERPRETER", "CURRENCY_EXCHANGE", "OTHER"]) serviceType!: string;
  @IsIn(UNITS) unit!: string;
  @IsOptional() @IsString() @MaxLength(3) currency?: string;
  @IsNumber() @Min(0) price!: number;
  @IsOptional() @IsDateString() effectiveFrom?: string;
  @IsOptional() @IsDateString() effectiveTo?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

/** Rate-card administration (B-10). Staff-gated. Prices live ONLY here. */
@Controller("rate-cards")
@RequirePermissions("MANAGE_SYSTEM_SETTINGS")
export class RatesController {
  constructor(private readonly prisma: PrismaService) {}

  private audit(user: AuthUser, action: "CREATE" | "UPDATE" | "DELETE", model: string, id: string, before: object, after: object) {
    return this.prisma.auditLog.create({ data: { actorUserId: user.sub, action, module: "RateCards", entityType: model, entityId: id, before: before as never, after: after as never } });
  }
  private dates(d: { effectiveFrom?: string; effectiveTo?: string }) {
    return {
      ...(d.effectiveFrom ? { effectiveFrom: new Date(d.effectiveFrom) } : {}),
      ...(d.effectiveTo !== undefined ? { effectiveTo: d.effectiveTo ? new Date(d.effectiveTo) : null } : {}),
    };
  }

  // ── TRANSPORT ──
  @Get("transport") listT() { return this.prisma.transportRate.findMany({ orderBy: { createdAt: "desc" } }); }
  @Post("transport") async createT(@Body() d: TransportRateDto, @CurrentUser() u: AuthUser) {
    const row = await this.prisma.transportRate.create({ data: { vehicleType: d.vehicleType as never, route: d.route, tripType: d.tripType as never, unit: d.unit as never, currency: d.currency ?? "SAR", price: d.price, active: d.active ?? true, ...this.dates(d) } });
    await this.audit(u, "CREATE", "TransportRate", row.id, {}, { ...d }); return row;
  }
  @Patch("transport/:id") async updateT(@Param("id") id: string, @Body() d: Partial<TransportRateDto>, @CurrentUser() u: AuthUser) {
    const before = await this.prisma.transportRate.findUnique({ where: { id } }); if (!before) throw new NotFoundException("Rate not found");
    const row = await this.prisma.transportRate.update({ where: { id }, data: { ...(d.price !== undefined ? { price: d.price } : {}), ...(d.active !== undefined ? { active: d.active } : {}), ...(d.route !== undefined ? { route: d.route } : {}), ...(d.currency ? { currency: d.currency } : {}), ...this.dates(d) } });
    await this.audit(u, "UPDATE", "TransportRate", id, { price: before.price, active: before.active }, { ...d }); return row;
  }
  @Delete("transport/:id") async delT(@Param("id") id: string, @CurrentUser() u: AuthUser) { await this.prisma.transportRate.delete({ where: { id } }); await this.audit(u, "DELETE", "TransportRate", id, { id }, {}); return { ok: true }; }

  // ── VISA ──
  @Get("visa") listV() { return this.prisma.visaRate.findMany({ orderBy: { createdAt: "desc" } }); }
  @Post("visa") async createV(@Body() d: VisaRateDto, @CurrentUser() u: AuthUser) {
    const row = await this.prisma.visaRate.create({ data: { visaType: d.visaType as never, visaCategory: (d.visaCategory ?? null) as never, country: d.country ?? "SA", processingType: d.processingType as never, currency: d.currency ?? "SAR", price: d.price, active: d.active ?? true, ...this.dates(d) } });
    await this.audit(u, "CREATE", "VisaRate", row.id, {}, { ...d }); return row;
  }
  @Patch("visa/:id") async updateV(@Param("id") id: string, @Body() d: Partial<VisaRateDto>, @CurrentUser() u: AuthUser) {
    const before = await this.prisma.visaRate.findUnique({ where: { id } }); if (!before) throw new NotFoundException("Rate not found");
    const row = await this.prisma.visaRate.update({ where: { id }, data: { ...(d.price !== undefined ? { price: d.price } : {}), ...(d.active !== undefined ? { active: d.active } : {}), ...(d.country ? { country: d.country } : {}), ...(d.currency ? { currency: d.currency } : {}), ...this.dates(d) } });
    await this.audit(u, "UPDATE", "VisaRate", id, { price: before.price, active: before.active }, { ...d }); return row;
  }
  @Delete("visa/:id") async delV(@Param("id") id: string, @CurrentUser() u: AuthUser) { await this.prisma.visaRate.delete({ where: { id } }); await this.audit(u, "DELETE", "VisaRate", id, { id }, {}); return { ok: true }; }

  // ── ADDITIONAL ──
  @Get("additional") listA() { return this.prisma.additionalServiceRate.findMany({ orderBy: { createdAt: "desc" } }); }
  @Post("additional") async createA(@Body() d: AdditionalRateDto, @CurrentUser() u: AuthUser) {
    const row = await this.prisma.additionalServiceRate.create({ data: { serviceType: d.serviceType as never, unit: d.unit as never, currency: d.currency ?? "SAR", price: d.price, active: d.active ?? true, ...this.dates(d) } });
    await this.audit(u, "CREATE", "AdditionalServiceRate", row.id, {}, { ...d }); return row;
  }
  @Patch("additional/:id") async updateA(@Param("id") id: string, @Body() d: Partial<AdditionalRateDto>, @CurrentUser() u: AuthUser) {
    const before = await this.prisma.additionalServiceRate.findUnique({ where: { id } }); if (!before) throw new NotFoundException("Rate not found");
    const row = await this.prisma.additionalServiceRate.update({ where: { id }, data: { ...(d.price !== undefined ? { price: d.price } : {}), ...(d.active !== undefined ? { active: d.active } : {}), ...(d.currency ? { currency: d.currency } : {}), ...this.dates(d) } });
    await this.audit(u, "UPDATE", "AdditionalServiceRate", id, { price: before.price, active: before.active }, { ...d }); return row;
  }
  @Delete("additional/:id") async delA(@Param("id") id: string, @CurrentUser() u: AuthUser) { await this.prisma.additionalServiceRate.delete({ where: { id } }); await this.audit(u, "DELETE", "AdditionalServiceRate", id, { id }, {}); return { ok: true }; }
}
