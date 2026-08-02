import { AuditAction } from "@prisma/client";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

const ACTIONS = Object.values(AuditAction) as string[];

/** Query for GET /audit-logs — read-only list over existing AuditLog rows. */
export class ListAuditLogsQueryDto {
  @IsOptional() @IsString() from?: string; // ISO date/datetime
  @IsOptional() @IsString() to?: string;

  /** Filter by actor user id (query alias: `user`). */
  @IsOptional() @IsString() @MaxLength(40) user?: string;
  @IsOptional() @IsString() @MaxLength(40) actorUserId?: string;

  @IsOptional() @IsIn(ACTIONS) action?: AuditAction;
  @IsOptional() @IsString() @MaxLength(80) module?: string;

  /** Entity type filter (query alias: `entity`). */
  @IsOptional() @IsString() @MaxLength(80) entity?: string;
  @IsOptional() @IsString() @MaxLength(80) entityType?: string;
  @IsOptional() @IsString() @MaxLength(80) entityId?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;

  /** `createdAt:desc` (default) or `createdAt:asc`. */
  @IsOptional() @IsIn(["createdAt:desc", "createdAt:asc"]) sort?: "createdAt:desc" | "createdAt:asc";
}
