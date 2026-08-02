import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { OcrService } from "./ocr.service";
import { ApproveOcrDto, CreateOcrDto, ListOcrQueryDto, OverrideOcrDto, RejectOcrDto } from "./ocr.dto";

/**
 * Document OCR + review queue. Flow: POST /uploads (multipart) to store a file,
 * then POST /ocr/documents with its id + documentType. The pipeline runs async
 * and lands the result in the review queue.
 *
 * Auth:
 * - Submit (POST) + poll status (GET :id): any authenticated tenant/staff user (JWT).
 * - Review queue list + override/approve/reject: `REVIEW_OCR_QUEUE` (existing RBAC).
 */
@Controller("ocr")
export class OcrController {
  constructor(private readonly ocr: OcrService) {}

  /** T001-07 — feature flags for OCR Center (Group List vs Passport). JWT only. */
  @Get("capabilities")
  capabilities() {
    return this.ocr.capabilities();
  }

  /** Register an uploaded file for OCR. Returns the queued OcrDocument. Agents may submit. */
  @Post("documents")
  create(@Body() dto: CreateOcrDto, @CurrentUser() user: AuthUser) {
    return this.ocr.create(dto, user);
  }

  /** Review queue — staff with REVIEW_OCR_QUEUE only. */
  @Get("documents")
  @RequirePermissions("REVIEW_OCR_QUEUE")
  list(@Query() query: ListOcrQueryDto) {
    return this.ocr.list(query);
  }

  /**
   * Full extracted result for one document.
   * Ungated beyond JWT so agents can poll their own submission (tenant-scoped).
   */
  @Get("documents/:id")
  get(@Param("id") id: string) {
    return this.ocr.get(id);
  }

  /** Correct extracted fields before approving. */
  @Post("documents/:id/override")
  @RequirePermissions("REVIEW_OCR_QUEUE")
  override(@Param("id") id: string, @Body() dto: OverrideOcrDto, @CurrentUser() user: AuthUser) {
    return this.ocr.override(id, dto.fields, user);
  }

  /**
   * Approve passport OCR → Mutamer in Group (create or attach via passengerId).
   * Requires REVIEW_OCR_QUEUE. Group required for PASSPORT.
   */
  @Post("documents/:id/approve")
  @RequirePermissions("REVIEW_OCR_QUEUE")
  approve(@Param("id") id: string, @Body() dto: ApproveOcrDto, @CurrentUser() user: AuthUser) {
    return this.ocr.approve(id, dto, user);
  }

  /** Reject and remove from the actionable queue. */
  @Post("documents/:id/reject")
  @RequirePermissions("REVIEW_OCR_QUEUE")
  reject(@Param("id") id: string, @Body() dto: RejectOcrDto, @CurrentUser() user: AuthUser) {
    return this.ocr.reject(id, dto, user);
  }

  /** Re-enqueue a PENDING document after provider failure (ops recovery — S2-06 / G-10). */
  @Post("documents/:id/reprocess")
  @RequirePermissions("REVIEW_OCR_QUEUE")
  reprocess(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.ocr.reprocess(id, user);
  }
}
