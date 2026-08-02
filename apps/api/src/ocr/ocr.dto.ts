import { Type } from "class-transformer";
import { IsArray, IsIn, IsOptional, IsString, MaxLength, ValidateNested } from "class-validator";
import { OcrDocumentType, OcrReviewStatus } from "@prisma/client";

const DOC_TYPES = Object.values(OcrDocumentType) as string[];
const REVIEW_STATES = Object.values(OcrReviewStatus) as string[];

export class CreateOcrDto {
  /** id of an already-uploaded file (POST /uploads returns { documentId }). */
  @IsString() uploadedFileId!: string;
  @IsIn(DOC_TYPES) documentType!: OcrDocumentType;
  /** optional group the extracted passenger is auto-filled into on approve. */
  @IsOptional() @IsString() groupId?: string;
}

export class ListOcrQueryDto {
  @IsOptional() @IsIn(REVIEW_STATES) reviewStatus?: OcrReviewStatus;
  @IsOptional() @IsIn(DOC_TYPES) documentType?: OcrDocumentType;
  @IsOptional() @IsString() groupId?: string;
}

export class OverrideFieldDto {
  @IsString() field!: string;
  @IsString() @MaxLength(500) value!: string;
}
export class OverrideOcrDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OverrideFieldDto)
  fields!: OverrideFieldDto[];
}

export class ApproveOcrDto {
  /** Target group for Mutamer create/attach (falls back to the doc's groupId). Required for PASSPORT. */
  @IsOptional() @IsString() groupId?: string;

  /**
   * T001-06 — attach OCR to an existing Mutamer (e.g. after Excel import) instead of creating a new one.
   * Passenger must belong to the selected group; passport numbers must match.
   */
  @IsOptional() @IsString() passengerId?: string;

  /**
   * T001-07 — staff creating a Group from Nusuk Group List OCR when the uploader had no company.
   * Agents ignore this (their company is always used).
   */
  @IsOptional() @IsString() tenantId?: string;
}

export class RejectOcrDto {
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}
