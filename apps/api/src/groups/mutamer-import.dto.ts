import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";
import { CreatePassengerDto } from "./passengers.dto";
import { MUTAMER_IMPORT_MAX_ROWS } from "./mutamer-excel.contract";

/** Preview: send file as UTF-8 CSV text OR base64 (csv/xlsx). */
export class MutamerImportPreviewDto {
  @IsString() @MinLength(1) @MaxLength(260) fileName!: string;

  /** Raw CSV text (preferred for .csv). */
  @IsOptional() @IsString() @MaxLength(8_000_000) csvText?: string;

  /** Base64 of file bytes (required for .xlsx; optional for csv). */
  @IsOptional() @IsString() @MaxLength(12_000_000) contentBase64?: string;

  @IsOptional() @IsIn(["csv", "xlsx", "auto"]) format?: "csv" | "xlsx" | "auto";
}

/** Commit: re-send validated rows from preview + confirmation. Server re-validates. */
export class MutamerImportCommitDto {
  @IsString() @MinLength(1) @MaxLength(260) fileName!: string;
  @IsString() @MinLength(16) @MaxLength(128) fileHash!: string;

  /** Must be true — prevents accidental commits. */
  @IsBoolean() confirm!: boolean;

  /** When true, re-import the same fileHash (admin override). Default false. */
  @IsOptional() @IsBoolean() force?: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MUTAMER_IMPORT_MAX_ROWS)
  @ValidateNested({ each: true })
  @Type(() => CreatePassengerDto)
  passengers!: CreatePassengerDto[];
}
