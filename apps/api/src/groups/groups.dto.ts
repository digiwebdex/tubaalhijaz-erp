import { Type } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from "class-validator";

export const DESTINATIONS = ["MAKKAH", "MADINAH", "MAKKAH_MADINAH"] as const;
export const VISA_TYPES = ["UMRAH", "LONG_STAY", "HAJJ"] as const;
export const PACKAGE_TYPES = ["ECONOMY", "STANDARD", "PREMIUM"] as const;
export const GROUP_STATES = [
  "PENDING",
  "IN_PROGRESS",
  "VERIFIED",
  "COMPLETED",
  "CANCELLED",
] as const;
export const OPS_STATES = ["UPCOMING", "ACTIVE", "DELAYED", "COMPLETED"] as const;

/** Visa types that require Haji WhatsApp when REQUIRE_HAJI_WHATSAPP=true. */
export const WHATSAPP_REQUIRED_VISA_TYPES: ReadonlySet<string> = new Set(["HAJJ", "UMRAH"]);

export class CreateGroupDto {
  @IsString() @MinLength(2) @MaxLength(160) name!: string;
  @IsOptional() @IsString() @MaxLength(160) nameBn?: string;

  @IsIn(DESTINATIONS) destination!: (typeof DESTINATIONS)[number];
  @IsIn(VISA_TYPES) visaType!: (typeof VISA_TYPES)[number];
  @IsOptional() @IsIn(PACKAGE_TYPES) packageType?: (typeof PACKAGE_TYPES)[number];

  @IsOptional() @IsInt() @Min(1) maxCapacity?: number;
  @IsOptional() @IsInt() @Min(0) paxCount?: number;

  @IsOptional() @IsDateString() departDate?: string;
  @IsOptional() @IsDateString() returnDate?: string;
  @IsOptional() @IsString() @MaxLength(600) notes?: string;

  /** Nusuk Group Number (business spine). Unique when set. */
  @IsOptional() @IsString() @MinLength(1) @MaxLength(64) nusukGroupNumber?: string;
  /** Haji / reference WhatsApp. Required for HAJJ/UMRAH when flag enabled. */
  @IsOptional() @IsString() @MinLength(5) @MaxLength(40) hajiWhatsapp?: string;
  @IsOptional() @IsString() @MaxLength(120) consulate?: string;
  /** Saudi Umrah Company (Company id with supplierProfile.type=UMRAH_COMPANY). T002-01. */
  @IsOptional() @IsString() umrahCompanyId?: string;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) servicesValue?: number;
  /** Defaults to the creating user when omitted. */
  @IsOptional() @IsString() uploadedByUserId?: string;
  @IsOptional() @IsString() @MaxLength(160) uploadedByLabel?: string;

  /** Readiness gates (T001-02). Default false when omitted. Strict booleans (no string coercion). */
  @IsOptional() @IsBoolean() gateVisa?: boolean;
  @IsOptional() @IsBoolean() gatePackage?: boolean;
  @IsOptional() @IsBoolean() gatePayment?: boolean;
  @IsOptional() @IsBoolean() gateBill?: boolean;

  /** Staff only — agents always create against their own company. */
  @IsOptional() @IsString() tenantId?: string;
}

export class UpdateGroupDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(160) name?: string;
  @IsOptional() @IsString() @MaxLength(160) nameBn?: string;
  @IsOptional() @IsIn(DESTINATIONS) destination?: (typeof DESTINATIONS)[number];
  @IsOptional() @IsIn(VISA_TYPES) visaType?: (typeof VISA_TYPES)[number];
  @IsOptional() @IsIn(PACKAGE_TYPES) packageType?: (typeof PACKAGE_TYPES)[number];
  @IsOptional() @IsInt() @Min(1) maxCapacity?: number;
  @IsOptional() @IsInt() @Min(0) paxCount?: number;
  @IsOptional() @IsDateString() departDate?: string;
  @IsOptional() @IsDateString() returnDate?: string;
  @IsOptional() @IsString() @MaxLength(600) notes?: string;

  /** Pass null to clear. Empty string is normalized to null in the service. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  nusukGroupNumber?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MinLength(5)
  @MaxLength(40)
  hajiWhatsapp?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(120)
  consulate?: string | null;

  /** Pass null to clear. Must be a verified UMRAH_COMPANY supplier when set. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  umrahCompanyId?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  servicesValue?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  uploadedByUserId?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(160)
  uploadedByLabel?: string | null;

  /** Readiness gates (T001-02) — VISA / PACKAGE / PAYMENT / BILL. Strict booleans. */
  @IsOptional() @IsBoolean() gateVisa?: boolean;
  @IsOptional() @IsBoolean() gatePackage?: boolean;
  @IsOptional() @IsBoolean() gatePayment?: boolean;
  @IsOptional() @IsBoolean() gateBill?: boolean;

  @IsOptional() @IsIn(GROUP_STATES) status?: (typeof GROUP_STATES)[number];
  @IsOptional() @IsIn(OPS_STATES) opsStatus?: (typeof OPS_STATES)[number];
  @IsOptional() @IsInt() @Min(1) currentStage?: number;
  @IsOptional() @IsString() @MaxLength(400) stageNote?: string;
}
