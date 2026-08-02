import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ServiceRequestStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuthUser, CurrentUser } from "../common/decorators/current-user.decorator";
import { ServicesService } from "./services.service";
import { SERVICE_KEYS, ServiceKey } from "./service-types";
import {
  CreateAdditionalServiceDto,
  CreateCateringBookingDto,
  CreateHotelBookingDto,
  CreateTransportBookingDto,
  CreateVisaRequestDto,
  ServiceTransitionDto,
} from "./dto";

function parseService(service: string): ServiceKey {
  if (!SERVICE_KEYS.includes(service as ServiceKey)) {
    throw new BadRequestException(`Unknown service '${service}' — use ${SERVICE_KEYS.join("|")}`);
  }
  return service as ServiceKey;
}

@Controller()
export class ServicesController {
  constructor(
    private readonly services: ServicesService,
    private readonly prisma: PrismaService,
  ) {}

  /** Hotel catalogue for the request screen. */
  @Get("hotels")
  hotels(@Query("city") city?: string) {
    return this.prisma.scoped.hotel.findMany({
      where: city ? { city } : undefined,
      orderBy: [{ available: "desc" }, { stars: "desc" }],
    });
  }

  /** Verified Umrah Companies for Group / VisaRequest linkage (T002-01). */
  @Get("services/umrah-companies")
  umrahCompanies() {
    return this.services.listUmrahCompanies();
  }

  // ── agent create endpoints (fields mirror AgentPortalServices.tsx) ─────────
  @Post("services/visa")
  createVisa(@Body() dto: CreateVisaRequestDto, @CurrentUser() user: AuthUser) {
    return this.services.createVisa(dto, user);
  }

  @Post("services/hotel")
  createHotel(@Body() dto: CreateHotelBookingDto, @CurrentUser() user: AuthUser) {
    return this.services.createHotel(dto, user);
  }

  @Post("services/transport")
  createTransport(@Body() dto: CreateTransportBookingDto, @CurrentUser() user: AuthUser) {
    return this.services.createTransport(dto, user);
  }

  @Post("services/catering")
  createCatering(@Body() dto: CreateCateringBookingDto, @CurrentUser() user: AuthUser) {
    return this.services.createCatering(dto, user);
  }

  @Post("services/additional")
  createAdditional(@Body() dto: CreateAdditionalServiceDto, @CurrentUser() user: AuthUser) {
    return this.services.createAdditional(dto, user);
  }

  // ── reads ──────────────────────────────────────────────────────────────────
  /** All five pipelines for one group (status trackers). */
  @Get("services/summary")
  summary(@Query("groupId") groupId: string) {
    if (!groupId) throw new BadRequestException("groupId is required");
    return this.services.summary(groupId);
  }

  @Get("services/:service")
  list(
    @Param("service") service: string,
    @Query("groupId") groupId?: string,
    @Query("status") status?: ServiceRequestStatus,
  ) {
    return this.services.list(parseService(service), { groupId, status });
  }

  /** Ops/staff state-machine transition (agents: cancel only). */
  @Patch("services/:service/:id/status")
  transition(
    @Param("service") service: string,
    @Param("id") id: string,
    @Body() dto: ServiceTransitionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.services.transition(parseService(service), id, dto.status, dto, user);
  }

  /** Agent-side voucher list (tenant-scoped automatically). */
  @Get("vouchers")
  vouchers(@Query("groupId") groupId?: string) {
    return this.prisma.scoped.voucher.findMany({
      where: groupId ? { groupId } : undefined,
      include: { group: { select: { code: true, name: true } } },
      orderBy: { issueDate: "desc" },
      take: 100,
    });
  }
}
