import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query,
} from "@nestjs/common";
import {
  IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min,
} from "class-validator";
import {
  DriverStatus, InsuranceStatus, LocationSource, MaintenanceType,
  VehicleDocType, VehicleStatus, VehicleType,
} from "@prisma/client";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { AuthUser, CurrentUser } from "../common/decorators/current-user.decorator";
import { FleetService } from "./fleet.service";
import { ExpiryService } from "./expiry.service";

const VEHICLE_TYPES = ["SEDAN", "VAN", "HIACE", "COASTER", "BUS"];
const VEHICLE_STATES = ["ACTIVE", "MAINTENANCE", "RETIRED"];
const DRIVER_STATES = ["AVAILABLE", "ON_DUTY", "EN_ROUTE", "STANDBY", "OFF_DUTY"];
const DOC_TYPES = ["REGISTRATION", "INSPECTION", "OPERATING_CARD", "PERMIT", "OTHER"];
const MAINT_TYPES = ["PREVENTIVE", "REPAIR", "INSPECTION"];
const INS_STATES = ["ACTIVE", "EXPIRED", "CANCELLED"];

class CreateVehicleDto {
  @IsString() @MaxLength(40) code!: string;
  @IsIn(VEHICLE_TYPES) type!: VehicleType;
  @IsOptional() @IsString() @MaxLength(20) plateNo?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100) seats?: number;
  @IsOptional() @IsIn(VEHICLE_STATES) status?: VehicleStatus;
  @IsOptional() @IsString() supplierId?: string;
  @IsOptional() @IsString() @MaxLength(400) notes?: string;
}
class UpdateVehicleDto {
  @IsOptional() @IsString() @MaxLength(40) code?: string;
  @IsOptional() @IsIn(VEHICLE_TYPES) type?: VehicleType;
  @IsOptional() @IsString() @MaxLength(20) plateNo?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100) seats?: number;
  @IsOptional() @IsIn(VEHICLE_STATES) status?: VehicleStatus;
  @IsOptional() @IsString() supplierId?: string;
  @IsOptional() @IsString() @MaxLength(400) notes?: string;
}

class CreateDriverDto {
  @IsString() @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(120) nameBn?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsString() @MaxLength(40) licenseNo?: string;
  @IsOptional() @IsDateString() licenseExpiry?: string;
  @IsOptional() @IsIn(DRIVER_STATES) status?: DriverStatus;
  @IsOptional() @IsString() supplierId?: string;
}
class UpdateDriverDto extends CreateDriverDto {
  @IsOptional() @IsString() @MaxLength(120) declare name: string;
}

class DocumentDto {
  @IsIn(DOC_TYPES) type!: VehicleDocType;
  @IsOptional() @IsString() @MaxLength(60) docNo?: string;
  @IsOptional() @IsDateString() issueDate?: string;
  @IsDateString() expiryDate!: string;
  @IsOptional() @IsString() fileId?: string;
  @IsOptional() @IsString() @MaxLength(300) notes?: string;
}

class FuelDto {
  @IsString() vehicleId!: string;
  @IsOptional() @IsString() driverId?: string;
  @IsDateString() date!: string;
  @IsNumber() @Min(0) liters!: number;
  @IsNumber() @Min(0) cost!: number;
  @IsOptional() @IsInt() @Min(0) odometerKm?: number;
  @IsOptional() @IsString() @MaxLength(300) notes?: string;
}

class CreateMaintenanceDto {
  @IsString() vehicleId!: string;
  @IsIn(MAINT_TYPES) type!: MaintenanceType;
  @IsString() @MaxLength(400) description!: string;
  @IsDateString() date!: string;
  @IsOptional() @IsNumber() @Min(0) cost?: number;
  @IsOptional() @IsInt() @Min(0) odometerKm?: number;
  @IsOptional() @IsDateString() nextDueDate?: string;
  @IsOptional() @IsString() @MaxLength(160) workshop?: string;
}
class UpdateMaintenanceDto {
  @IsOptional() @IsIn(MAINT_TYPES) type?: MaintenanceType;
  @IsOptional() @IsString() @MaxLength(400) description?: string;
  @IsOptional() @IsDateString() date?: string;
  @IsOptional() @IsNumber() @Min(0) cost?: number;
  @IsOptional() @IsInt() @Min(0) odometerKm?: number;
  @IsOptional() @IsDateString() nextDueDate?: string;
  @IsOptional() @IsString() @MaxLength(160) workshop?: string;
}

class CreateInsuranceDto {
  @IsString() vehicleId!: string;
  @IsString() @MaxLength(160) provider!: string;
  @IsString() @MaxLength(60) policyNo!: string;
  @IsDateString() startDate!: string;
  @IsDateString() endDate!: string;
  @IsOptional() @IsNumber() @Min(0) premium?: number;
  @IsOptional() @IsIn(INS_STATES) status?: InsuranceStatus;
}
class UpdateInsuranceDto {
  @IsOptional() @IsString() @MaxLength(160) provider?: string;
  @IsOptional() @IsString() @MaxLength(60) policyNo?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsNumber() @Min(0) premium?: number;
  @IsOptional() @IsIn(INS_STATES) status?: InsuranceStatus;
}

class AssignDto {
  @IsOptional() @IsString() vehicleId?: string;
  @IsOptional() @IsString() driverId?: string;
}

const toDate = (s?: string) => (s ? new Date(s) : undefined);

@Controller("fleet")
@RequirePermissions("MANAGE_FLEET")
export class FleetController {
  constructor(
    private readonly fleet: FleetService,
    private readonly expiry: ExpiryService,
  ) {}

  // ── Dashboard / reports ─────────────────────────────────────────────────────
  @Get("dashboard") dashboard() { return this.fleet.dashboard(); }
  @Get("cost-trend") costTrend(@Query("months") months?: string) {
    return this.fleet.costTrend(months ? Math.min(24, Math.max(1, +months)) : 6);
  }
  @Get("expiring") expiring(@Query("days") days?: string) {
    return this.fleet.expiring(days ? Math.min(365, Math.max(1, +days)) : 30);
  }
  @Post("expiry/scan") scan(@Query("days") days?: string) {
    return this.expiry.runScan(days ? Math.min(365, Math.max(1, +days)) : 30);
  }

  // ── Vehicles ────────────────────────────────────────────────────────────────
  @Get("vehicles") listVehicles(
    @Query("status") status?: VehicleStatus, @Query("type") type?: VehicleType,
  ) { return this.fleet.listVehicles(status, type); }
  @Get("vehicles/:id") getVehicle(@Param("id") id: string) { return this.fleet.getVehicle(id); }
  @Post("vehicles") createVehicle(@Body() dto: CreateVehicleDto) { return this.fleet.createVehicle(dto); }
  @Patch("vehicles/:id") updateVehicle(@Param("id") id: string, @Body() dto: UpdateVehicleDto) {
    return this.fleet.updateVehicle(id, dto);
  }
  @Delete("vehicles/:id") deleteVehicle(@Param("id") id: string) { return this.fleet.deleteVehicle(id); }

  // ── Vehicle documents ───────────────────────────────────────────────────────
  @Get("vehicles/:id/documents") listDocs(@Param("id") id: string) { return this.fleet.listDocuments(id); }
  @Post("vehicles/:id/documents") addDoc(@Param("id") id: string, @Body() dto: DocumentDto) {
    return this.fleet.addDocument(id, { ...dto, issueDate: toDate(dto.issueDate), expiryDate: new Date(dto.expiryDate) });
  }
  @Patch("documents/:docId") updateDoc(@Param("docId") docId: string, @Body() dto: Partial<DocumentDto>) {
    const { issueDate, expiryDate, ...rest } = dto;
    return this.fleet.updateDocument(docId, {
      ...rest,
      ...(issueDate !== undefined && { issueDate: toDate(issueDate) }),
      ...(expiryDate !== undefined && { expiryDate: new Date(expiryDate) }),
    });
  }
  @Delete("documents/:docId") deleteDoc(@Param("docId") docId: string, @CurrentUser() user: AuthUser) { return this.fleet.deleteDocument(docId, user.sub); }

  // ── Drivers ─────────────────────────────────────────────────────────────────
  @Get("drivers") listDrivers(@Query("status") status?: DriverStatus) { return this.fleet.listDrivers(status); }
  @Post("drivers") createDriver(@Body() dto: CreateDriverDto) {
    return this.fleet.createDriver({ ...dto, licenseExpiry: toDate(dto.licenseExpiry) });
  }
  @Patch("drivers/:id") updateDriver(@Param("id") id: string, @Body() dto: UpdateDriverDto) {
    const { licenseExpiry, ...rest } = dto;
    return this.fleet.updateDriver(id, {
      ...rest, ...(licenseExpiry !== undefined && { licenseExpiry: toDate(licenseExpiry) }),
    });
  }
  @Delete("drivers/:id") deleteDriver(@Param("id") id: string) { return this.fleet.deleteDriver(id); }

  // ── Fuel ────────────────────────────────────────────────────────────────────
  @Get("fuel") listFuel(@Query("vehicleId") vehicleId?: string) { return this.fleet.listFuel(vehicleId); }
  @Post("fuel") addFuel(@Body() dto: FuelDto) {
    return this.fleet.addFuel({ ...dto, date: new Date(dto.date) });
  }
  @Delete("fuel/:id") deleteFuel(@Param("id") id: string) { return this.fleet.deleteFuel(id); }

  // ── Maintenance ─────────────────────────────────────────────────────────────
  @Get("maintenance") listMaint(@Query("vehicleId") vehicleId?: string) { return this.fleet.listMaintenance(vehicleId); }
  @Post("maintenance") addMaint(@Body() dto: CreateMaintenanceDto) {
    return this.fleet.addMaintenance({ ...dto, date: new Date(dto.date), nextDueDate: toDate(dto.nextDueDate) });
  }
  @Patch("maintenance/:id") updateMaint(@Param("id") id: string, @Body() dto: UpdateMaintenanceDto) {
    const { date, nextDueDate, ...rest } = dto;
    return this.fleet.updateMaintenance(id, {
      ...rest,
      ...(date !== undefined && { date: new Date(date) }),
      ...(nextDueDate !== undefined && { nextDueDate: toDate(nextDueDate) }),
    });
  }
  @Delete("maintenance/:id") deleteMaint(@Param("id") id: string) { return this.fleet.deleteMaintenance(id); }

  // ── Insurance ───────────────────────────────────────────────────────────────
  @Get("insurance") listIns(@Query("vehicleId") vehicleId?: string) { return this.fleet.listInsurance(vehicleId); }
  @Post("insurance") addIns(@Body() dto: CreateInsuranceDto) {
    return this.fleet.addInsurance({ ...dto, startDate: new Date(dto.startDate), endDate: new Date(dto.endDate) });
  }
  @Patch("insurance/:id") updateIns(@Param("id") id: string, @Body() dto: UpdateInsuranceDto) {
    const { startDate, endDate, ...rest } = dto;
    return this.fleet.updateInsurance(id, {
      ...rest,
      ...(startDate !== undefined && { startDate: new Date(startDate) }),
      ...(endDate !== undefined && { endDate: new Date(endDate) }),
    });
  }
  @Delete("insurance/:id") deleteIns(@Param("id") id: string) { return this.fleet.deleteInsurance(id); }

  // ── GPS map + trail ─────────────────────────────────────────────────────────
  @Get("map") map() { return this.fleet.map(); }
  @Get("vehicles/:id/trail") trail(@Param("id") id: string) { return this.fleet.locationTrail(id); }

  // ── Dispatch assignment ─────────────────────────────────────────────────────
  @Get("dispatches") dispatches() { return this.fleet.assignableDispatches(); }
  @Post("dispatches/:id/assign") assign(@Param("id") id: string, @Body() dto: AssignDto) {
    return this.fleet.assignDispatch(id, dto.vehicleId, dto.driverId);
  }
}

// ── GPS ingest — kept at the exact path the spec names (POST /vehicles/:id/location).
// MVP is manual/simulated fixes; a Phase-2 hardware tracker posts the same shape.
class LocationDto {
  @IsNumber() @Min(-90) @Max(90) lat!: number;
  @IsNumber() @Min(-180) @Max(180) lng!: number;
  @IsOptional() @IsString() @MaxLength(120) label?: string;
  @IsOptional() @IsInt() @Min(0) @Max(300) speedKmh?: number;
  @IsOptional() @IsIn(["MANUAL", "DEVICE"]) source?: LocationSource;
}

@Controller("vehicles")
@RequirePermissions("MANAGE_FLEET")
export class VehicleGpsController {
  constructor(private readonly fleet: FleetService) {}

  @Post(":id/location") updateLocation(@Param("id") id: string, @Body() dto: LocationDto) {
    return this.fleet.updateLocation(id, dto);
  }
}
