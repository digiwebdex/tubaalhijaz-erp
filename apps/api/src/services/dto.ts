import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";
import {
  AdditionalServiceType,
  MealPlan,
  MohCategory,
  Priority,
  ServiceRequestStatus,
  VehicleType,
  VisaType,
} from "@prisma/client";

// Field sets mirror AgentPortalServices.tsx exactly (one DTO per screen).

export class CreateVisaRequestDto {
  @IsString() groupId!: string;
  @IsOptional() @IsString() @MaxLength(8) applicationYearHijri?: string;
  /** T002-01 — HAJJ parity with Group.visaType (was UMRAH|LONG_STAY only). */
  @IsIn(["UMRAH", "LONG_STAY", "HAJJ"]) visaType!: VisaType;
  @IsOptional() @IsString() @MaxLength(40) nusukRef?: string;
  @IsOptional() @IsString() @MaxLength(40) muallimNo?: string;
  @IsOptional() @IsString() @MaxLength(40) mahramWaiverNo?: string;
  @IsOptional() @IsIn(["A", "B", "C"]) mohCategory?: MohCategory;
  /** Activate schema field (T002-01). Falls back to Group.consulate when omitted. */
  @IsOptional() @IsString() @MaxLength(120) embassy?: string;
  /** Optional; defaults from Group.umrahCompanyId when omitted (T002-01). */
  @IsOptional() @IsString() umrahCompanyId?: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class CreateHotelBookingDto {
  @IsString() groupId!: string;
  @IsOptional() @IsString() hotelId?: string;
  @IsDateString() checkIn!: string;
  @IsDateString() checkOut!: string;
  @IsInt() @Min(0) doubleRooms!: number;
  @IsInt() @Min(0) tripleRooms!: number;
  @IsOptional() @IsInt() @Min(0) singleRooms?: number;
  @IsIn(["FULL_BOARD", "HALF_BOARD", "BED_BREAKFAST", "ROOM_ONLY"]) mealPlan!: MealPlan;
  @IsOptional() @IsString() @MaxLength(500) specialRequests?: string;
}

export class CreateTransportBookingDto {
  @IsString() groupId!: string;
  @IsIn(["SEDAN", "HIACE", "COASTER", "BUS", "VAN"]) vehicleType!: VehicleType;
  @IsInt() @Min(1) vehicleCount!: number;
  @IsString() @MaxLength(160) departurePoint!: string;
  @IsString() @MaxLength(160) destination!: string;
  @IsDateString() departAt!: string;
  @IsOptional() @IsDateString() returnAt?: string;
  @IsOptional() @IsString() @MaxLength(300) stopPoints?: string;
}

export class CreateCateringBookingDto {
  @IsString() groupId!: string;
  @IsIn(["BREAKFAST_ONLY", "HALF_BOARD", "FULL_BOARD", "PREMIUM"]) mealPlan!: MealPlan;
  @IsOptional() @IsInt() @Min(0) halalCount?: number;
  @IsOptional() @IsInt() @Min(0) vegetarianCount?: number;
  @IsOptional() @IsInt() @Min(0) diabeticCount?: number;
  @IsOptional() @IsString() @MaxLength(500) specialInstructions?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
}

export class CreateAdditionalServiceDto {
  @IsString() groupId!: string;
  @IsIn([
    "WHEELCHAIR", "VIP_LOUNGE", "SIM_CARD", "INSURANCE",
    "PHOTOGRAPHY", "INTERPRETER", "CURRENCY_EXCHANGE", "OTHER",
  ])
  serviceType!: AdditionalServiceType;
  @IsInt() @Min(1) beneficiaries!: number;
  @IsIn(["NORMAL", "HIGH", "URGENT"]) priority!: Priority;
  @IsOptional() @IsString() @MaxLength(800) description?: string;
  @IsOptional() @IsDateString() requestedFor?: string;
}

export class ServiceTransitionDto {
  @IsIn(["REQUESTED", "ASSIGNED", "CONFIRMED", "VOUCHER_ISSUED", "COMPLETED", "REJECTED", "CANCELLED"])
  status!: ServiceRequestStatus;
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
  /** staff: route/re-route to a specific supplier when moving to ASSIGNED */
  @IsOptional() @IsString() supplierId?: string;
}

export class RejectBookingDto {
  @IsString() @MaxLength(500) reason!: string;
}
