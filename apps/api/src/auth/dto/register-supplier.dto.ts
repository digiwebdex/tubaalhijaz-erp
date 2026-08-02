import { IsEmail, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from "class-validator";

/**
 * Mirrors the Supplier Registration wizard (AuthOnboarding §04):
 * Step 1 Company Info (+ type-specific fields) → Step 2 Documents (later phase).
 */
export class RegisterSupplierDto {
  @IsIn(["HOTEL", "TRANSPORT", "CATERING"])
  type!: "HOTEL" | "TRANSPORT" | "CATERING";

  @IsString() @MinLength(2) @MaxLength(160)
  companyName!: string;

  @IsOptional() @IsString() @MaxLength(40)
  crNumber?: string;

  @IsString() @MinLength(2) @MaxLength(120)
  contactPerson!: string;

  @IsEmail() @MaxLength(160)
  businessEmail!: string;

  @IsOptional() @IsString() @MaxLength(30)
  phone?: string;

  @IsOptional() @IsString() @MaxLength(80)
  city?: string;

  // type-specific (hotel)
  @IsOptional() @IsInt() @Min(1)
  starRating?: number;

  @IsOptional() @IsString() @MaxLength(80)
  district?: string;

  // type-specific (transport)
  @IsOptional() @IsInt() @Min(1)
  fleetSize?: number;

  @IsOptional() @IsString() @MaxLength(60)
  primaryVehicleType?: string;

  // type-specific (catering)
  @IsOptional() @IsInt() @Min(1)
  dailyMealCapacity?: number;

  @IsOptional() @IsString() @MaxLength(80)
  halalCertBody?: string;

  /** Optional for the same reason as agent registration. */
  @IsOptional() @IsString() @MinLength(8) @MaxLength(128)
  password?: string;

  // Uploaded document ids (from POST /uploads)
  @IsOptional() @IsString() tradeLicenseFileId?: string;
  @IsOptional() @IsString() certificationFileId?: string;
}
