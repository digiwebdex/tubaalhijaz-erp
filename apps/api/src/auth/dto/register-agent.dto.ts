import { Type } from "class-transformer";
import {
  IsEmail,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";

class GuarantorDto {
  @IsString() @MinLength(2) @MaxLength(120)
  name!: string;

  @IsString() @MinLength(5) @MaxLength(40)
  nationalId!: string;

  @IsOptional() @IsString() @MaxLength(30)
  phone?: string;
}

/**
 * Mirrors the Agent Registration wizard (AuthOnboarding §02):
 * Step 1 Documents (files come in a later phase) → Step 2 Profile →
 * Step 3 Finance → Step 4 Guarantors → Step 5 Review & Submit.
 */
export class RegisterAgentDto {
  // Step 2 — Profile
  @IsString() @MinLength(2) @MaxLength(160)
  companyName!: string;

  @IsOptional() @IsString() @MaxLength(40)
  crNumber?: string;

  @IsString() @MinLength(2) @MaxLength(120)
  ownerName!: string;

  @IsOptional() @IsString() @MaxLength(40)
  ownerIdNumber?: string;

  @IsOptional() @IsString() @MaxLength(60)
  ownerNationality?: string;

  @IsEmail() @MaxLength(160)
  businessEmail!: string;

  @IsOptional() @IsUrl({ require_protocol: false }) @MaxLength(200)
  website?: string;

  @IsOptional() @IsString() @MaxLength(30)
  phone?: string;

  @IsOptional() @IsString() @MaxLength(80)
  city?: string;

  // Step 3 — Finance
  @IsOptional() @IsString() @MaxLength(80)
  bankName?: string;

  @IsOptional() @IsString() @MaxLength(40)
  accountNumber?: string;

  @IsOptional() @IsString() @MaxLength(40)
  iban?: string;

  // Step 4 — Guarantors + reference agent
  @IsOptional() @ValidateNested() @Type(() => GuarantorDto)
  guarantor1?: GuarantorDto;

  @IsOptional() @ValidateNested() @Type(() => GuarantorDto)
  guarantor2?: GuarantorDto;

  @IsOptional() @IsString() @MaxLength(160)
  referenceAgencyName?: string;

  @IsOptional() @IsString() @MaxLength(40)
  referenceAgentCode?: string;

  /**
   * Login password. The UI wizard has no password field (credentials are
   * issued on approval), so this is optional — when omitted the API
   * generates a temporary password and returns it once in the response.
   */
  @IsOptional() @IsString() @MinLength(8) @MaxLength(128)
  password?: string;

  // Uploaded document ids (from POST /uploads) — claimed and linked on submit
  @IsOptional() @IsString() tradeLicenseFileId?: string;
  @IsOptional() @IsString() ownerIdFileId?: string;
  @IsOptional() @IsString({ each: true }) officePhotoFileIds?: string[];
  @IsOptional() @IsString() logoFileId?: string;
  @IsOptional() @IsString() chequeFileId?: string;
  @IsOptional() @IsString() depositFileId?: string;
}
