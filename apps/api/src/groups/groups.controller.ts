import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { GroupsService } from "./groups.service";
import { CreateGroupDto, UpdateGroupDto } from "./groups.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthUser } from "../common/decorators/current-user.decorator";

/**
 * Group CRUD. Groups are the root of the operational workflow — dispatch,
 * ziyarah, long-stay, services, vouchers and invoices all require a groupId —
 * so until create existed, none of those flows could be exercised.
 *
 * Reads use the tenant-SCOPED Prisma client: agents automatically see only
 * their own groups, platform staff see all — no per-endpoint tenancy code.
 * Writes derive the tenant from the caller (see GroupsService), so there is
 * deliberately no permission decorator: an agent creating a group for their
 * own agency is ordinary business, and cross-tenant writes are blocked by
 * tenancy rather than by a role check.
 */
@Controller("groups")
export class GroupsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly groups: GroupsService,
  ) {}

  @Get()
  list() {
    return this.prisma.scoped.group.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        tenant: { select: { id: true, code: true, name: true, nameBn: true } },
        season: { select: { code: true, hijriYear: true } },
        workflowStage: true,
        uploadedByUser: { select: { id: true, email: true, name: true } },
        umrahCompany: { select: { id: true, code: true, name: true, nameBn: true } },
        _count: { select: { passengers: true } },
      },
    });
  }

  @Get(":id")
  async findOne(@Param("id") id: string) {
    const group = await this.prisma.scoped.group.findUnique({
      where: { id },
      include: {
        tenant: { select: { id: true, code: true, name: true, nameBn: true } },
        season: { select: { code: true, hijriYear: true } },
        workflowStage: true,
        uploadedByUser: { select: { id: true, email: true, name: true } },
        umrahCompany: { select: { id: true, code: true, name: true, nameBn: true } },
        passengers: { orderBy: { code: "asc" }, take: 50 },
        flightInfos: true,
        _count: { select: { passengers: true } },
      },
    });
    if (!group) throw new NotFoundException("Group not found");
    return group;
  }

  @Post()
  create(@Body() dto: CreateGroupDto, @CurrentUser() user: AuthUser) {
    return this.groups.create(dto, user);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateGroupDto, @CurrentUser() user: AuthUser) {
    return this.groups.update(id, dto, user);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.groups.remove(id);
  }
}
