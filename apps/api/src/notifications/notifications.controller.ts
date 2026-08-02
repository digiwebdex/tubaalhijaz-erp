import { Body, Controller, Get, Param, Patch, Post, Put, Query } from "@nestjs/common";
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import { NotificationChannel, NotificationPriority } from "@prisma/client";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { AuthUser, CurrentUser } from "../common/decorators/current-user.decorator";
import { NotificationsService } from "./notifications.service";

class EventToggleDto {
  @IsOptional() @IsBoolean() whatsapp?: boolean;
  @IsOptional() @IsBoolean() email?: boolean;
  @IsOptional() @IsBoolean() inApp?: boolean;
  @IsOptional() @IsIn(["LOW", "NORMAL", "EMERGENCY"]) priority?: NotificationPriority;
}
class TemplateDto {
  @IsString() eventKey!: string;
  @IsIn(["WHATSAPP", "EMAIL", "IN_APP"]) channel!: NotificationChannel;
  @IsIn(["bn", "en"]) lang!: string;
  @IsOptional() @IsString() @MaxLength(200) subject?: string;
  @IsString() @MaxLength(2000) body!: string;
}
class TestSendDto {
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() recipientUserId?: string;
  @IsOptional() @IsString() tenantId?: string;
  @IsOptional() @IsString() eventKey?: string;
  @IsOptional() @IsString() @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MaxLength(1000) body?: string;
  @IsOptional() @IsIn(["bn", "en"]) lang?: "bn" | "en";
  @IsOptional() @IsIn(["LOW", "NORMAL", "EMERGENCY"]) priority?: NotificationPriority;
}

@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  // ── Bell feed (any authenticated user — their own + their tenant's) ──────────
  @Get() feed(@CurrentUser() user: AuthUser, @Query("limit") limit?: string) {
    return this.notifications.feed(user.sub, user.companyId, limit ? +limit : 30);
  }
  @Get("unread-count") unread(@CurrentUser() user: AuthUser) {
    return this.notifications.unreadCount(user.sub, user.companyId).then((count) => ({ count }));
  }
  @Patch(":id/read") read(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.notifications.markRead(id, user.sub, user.companyId);
  }
  @Post("read-all") readAll(@CurrentUser() user: AuthUser) {
    return this.notifications.markAllRead(user.sub, user.companyId);
  }

  // ── Config: channel matrix + templates (Notification Center) ─────────────────
  @Get("events") @RequirePermissions("MANAGE_SYSTEM_SETTINGS") events() {
    return this.notifications.events();
  }
  @Patch("events/:key") @RequirePermissions("MANAGE_SYSTEM_SETTINGS") toggle(
    @Param("key") key: string, @Body() dto: EventToggleDto,
  ) {
    return this.notifications.toggleEvent(key, dto);
  }
  @Get("templates") @RequirePermissions("MANAGE_SYSTEM_SETTINGS") templates(@Query("eventKey") eventKey?: string) {
    return this.notifications.listTemplates(eventKey);
  }
  @Put("templates") @RequirePermissions("MANAGE_SYSTEM_SETTINGS") upsertTemplate(@Body() dto: TemplateDto) {
    return this.notifications.upsertTemplate(dto);
  }

  // ── Real test send (drives the live end-to-end WhatsApp/email check) ─────────
  @Post("test") @RequirePermissions("MANAGE_SYSTEM_SETTINGS") async test(@Body() dto: TestSendDto) {
    const channels: NotificationChannel[] = [];
    if (dto.phone) channels.push("WHATSAPP");
    if (dto.email) channels.push("EMAIL");
    channels.push("IN_APP");
    const res = await this.notifications.dispatch({
      eventKey: dto.eventKey,
      channels,
      priority: dto.priority ?? "NORMAL",
      tenantId: dto.tenantId,
      recipientUserId: dto.recipientUserId,
      phone: dto.phone,
      email: dto.email,
      title: dto.title ?? "TUBA AL HIJAZ test notification",
      body: dto.body ?? "This is a real end-to-end delivery test.",
      lang: dto.lang,
      vars: { title: dto.title, body: dto.body, code: "TEST", name: "Tester" },
    });
    return { queued: true, ...res };
  }
}
