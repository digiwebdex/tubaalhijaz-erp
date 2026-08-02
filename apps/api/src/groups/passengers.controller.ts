import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { PassengersService } from "./passengers.service";
import { MutamerImportService } from "./mutamer-import.service";
import { VisaPipelineService } from "./visa-pipeline.service";
import {
  BulkPassengersDto,
  CreatePassengerDto,
  UpdatePassengerDto,
  VisaTransitionDto,
} from "./passengers.dto";
import { MutamerImportCommitDto, MutamerImportPreviewDto } from "./mutamer-import.dto";

/**
 * Pilgrim manifest. Nested under the group because a passenger has no meaning
 * outside one, and because the group is what carries the tenant — see
 * PassengersService for the tenancy and paxCount notes.
 */
@Controller("groups/:groupId/passengers")
export class GroupPassengersController {
  constructor(
    private readonly passengers: PassengersService,
    private readonly mutamerImport: MutamerImportService,
  ) {}

  @Get()
  list(@Param("groupId") groupId: string, @CurrentUser() user: AuthUser) {
    return this.passengers.list(groupId, user);
  }

  @Post()
  create(@Param("groupId") groupId: string, @Body() dto: CreatePassengerDto, @CurrentUser() user: AuthUser) {
    return this.passengers.create(groupId, [dto], user);
  }

  /** Legacy bulk JSON path (kept for backward compatibility). */
  @Post("bulk")
  bulk(@Param("groupId") groupId: string, @Body() dto: BulkPassengersDto, @CurrentUser() user: AuthUser) {
    return this.passengers.create(groupId, dto.passengers, user);
  }

  /** T001-05 — preview Mutamer Excel/CSV (no DB writes). */
  @Post("import/preview")
  importPreview(
    @Param("groupId") groupId: string,
    @Body() dto: MutamerImportPreviewDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.mutamerImport.preview(groupId, dto, user);
  }

  /** T001-05 — confirm import (transactional, all-or-nothing). */
  @Post("import/commit")
  importCommit(
    @Param("groupId") groupId: string,
    @Body() dto: MutamerImportCommitDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.mutamerImport.commit(groupId, dto, user);
  }
}

/** Flat routes for editing a passenger once you already hold its id. */
@Controller("passengers")
export class PassengersController {
  constructor(
    private readonly passengers: PassengersService,
    private readonly visaPipeline: VisaPipelineService,
  ) {}

  /**
   * T002-03 — Mutamer Visa Pipeline transition.
   * Staff only (`VIEW_DASHBOARD`); agents are forbidden inside the service too.
   */
  @Post(":id/visa-transition")
  @RequirePermissions("VIEW_DASHBOARD")
  visaTransition(
    @Param("id") id: string,
    @Body() dto: VisaTransitionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.visaPipeline.transition(id, dto, user);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdatePassengerDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.passengers.update(id, dto, user);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.passengers.remove(id, user);
  }
}
