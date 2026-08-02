import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { VISA_PIPELINE_STATES } from "./visa-pipeline.machine";

export const GENDERS = ["MALE", "FEMALE"] as const;
export const VISA_STATES = ["PENDING", "APPROVED", "REJECTED"] as const;
export const CONFIRM_STATES = ["PENDING", "CONFIRMED"] as const;
export const MOH_STATES = ["PENDING", "CLEARED"] as const;

/** Shared Mutamer / Excel foundation fields (T001-04). All optional for backward compatibility. */
const mutamerFieldDecorators = () => {
  // Decorators applied on class properties below — this comment documents intent.
};

void mutamerFieldDecorators;

export class CreatePassengerDto {
  @IsString() @MinLength(2) @MaxLength(160) name!: string;
  @IsOptional() @IsString() @MaxLength(160) nameBn?: string;
  @IsString() @MinLength(3) @MaxLength(40) passportNo!: string;
  @IsOptional() @IsDateString() passportExpiry?: string;
  @IsString() @MinLength(2) @MaxLength(60) nationality!: string;
  @IsIn(GENDERS) gender!: (typeof GENDERS)[number];
  @IsOptional() @IsDateString() dob?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsString() @MaxLength(10) seat?: string;

  // ── T001-04 Mutamer Excel foundation ──────────────────────────────────────
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(130) age?: number;
  @IsOptional() @IsString() @MaxLength(40) mainEaCode?: string;
  @IsOptional() @IsString() @MaxLength(160) mainEaName?: string;
  @IsOptional() @IsString() @MaxLength(40) subEaCode?: string;
  @IsOptional() @IsString() @MaxLength(160) subEaName?: string;
  @IsOptional() @IsString() @MaxLength(80) biometricStatus?: string;
  @IsOptional() @IsString() @MaxLength(80) visaNumber?: string;
  @IsOptional() @IsString() @MaxLength(80) mofaNumber?: string;
  @IsOptional() @IsString() @MaxLength(80) mutamerType?: string;
  /** Business sheet wording; maps into visaStatus when recognizable. */
  @IsOptional() @IsString() @MaxLength(120) visaStatusLabel?: string;
}

/** Bulk add — backs the Excel-import path (column contract in mutamer-excel.contract). */
export class BulkPassengersDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => CreatePassengerDto)
  passengers!: CreatePassengerDto[];
}

export class UpdatePassengerDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(160) name?: string;
  @IsOptional() @IsString() @MaxLength(160) nameBn?: string;
  @IsOptional() @IsString() @MinLength(3) @MaxLength(40) passportNo?: string;
  @IsOptional() @IsDateString() passportExpiry?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(60) nationality?: string;
  @IsOptional() @IsIn(GENDERS) gender?: (typeof GENDERS)[number];
  @IsOptional() @IsDateString() dob?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsString() @MaxLength(10) seat?: string;
  @IsOptional() @IsIn(VISA_STATES) visaStatus?: (typeof VISA_STATES)[number];
  @IsOptional() @IsIn(CONFIRM_STATES) hotelStatus?: (typeof CONFIRM_STATES)[number];
  @IsOptional() @IsIn(CONFIRM_STATES) transportStatus?: (typeof CONFIRM_STATES)[number];
  @IsOptional() @IsIn(MOH_STATES) mohStatus?: (typeof MOH_STATES)[number];

  // ── T001-04 Mutamer Excel foundation ──────────────────────────────────────
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(130) age?: number;
  @IsOptional() @IsString() @MaxLength(40) mainEaCode?: string;
  @IsOptional() @IsString() @MaxLength(160) mainEaName?: string;
  @IsOptional() @IsString() @MaxLength(40) subEaCode?: string;
  @IsOptional() @IsString() @MaxLength(160) subEaName?: string;
  @IsOptional() @IsString() @MaxLength(80) biometricStatus?: string;
  @IsOptional() @IsString() @MaxLength(80) visaNumber?: string;
  @IsOptional() @IsString() @MaxLength(80) mofaNumber?: string;
  @IsOptional() @IsString() @MaxLength(80) mutamerType?: string;
  @IsOptional() @IsString() @MaxLength(120) visaStatusLabel?: string;
  /** T002-05 slim embassy / custody fields (staff PATCH). */
  @IsOptional() @IsString() @MaxLength(120) embassyRef?: string;
  @IsOptional() @IsDateString() embassySubmittedAt?: string | null;
  @IsOptional() @IsDateString() passportReturnedAt?: string | null;
}

/** T002-03/05 — Mutamer Visa Pipeline transition (staff / Visa Desk only). */
export class VisaTransitionDto {
  @IsIn([...VISA_PIPELINE_STATES]) to!: (typeof VISA_PIPELINE_STATES)[number];
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
  @IsOptional() @IsString() @MaxLength(80) visaNumber?: string;
  @IsOptional() @IsString() @MaxLength(80) biometricStatus?: string;
  @IsOptional() @IsBoolean() custodyConfirmed?: boolean;
  /** T002-05 — embassy file / consulate reference (Passenger.embassyRef). */
  @IsOptional() @IsString() @MaxLength(120) embassyRef?: string;
  /** T002-05 — activate/update VisaRequest.embassy or Group consulate label. */
  @IsOptional() @IsString() @MaxLength(160) embassy?: string;
  /** T002-05 — optional override; defaults to now when entering EMBASSY. */
  @IsOptional() @IsDateString() embassySubmittedAt?: string;
  /** T002-06 — mutamer MOFA Number (process identity; ≠ MOFA Processing Bill). */
  @IsOptional() @IsString() @MaxLength(80) mofaNumber?: string;
  /** T002-06 — when true, mofaNumber is required (complete MOFA desk info). */
  @IsOptional() @IsBoolean() completeMofa?: boolean;
}
