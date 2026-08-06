import { Controller, Get, Header, Param, Post, Query } from "@nestjs/common";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { NotificationAdminService, type HistoryFilter } from "./notification-admin.service";

/** Administration → Notification Center (all channels). Staff-gated. */
@Controller("admin/notifications")
@RequirePermissions("MANAGE_SYSTEM_SETTINGS")
export class NotificationAdminController {
  constructor(private readonly svc: NotificationAdminService) {}

  @Get()
  history(@Query() q: { channel?: string; status?: string; q?: string; take?: string; skip?: string }) {
    const f: HistoryFilter = { channel: q.channel, status: q.status, q: q.q, take: q.take ? +q.take : undefined, skip: q.skip ? +q.skip : undefined };
    return this.svc.history(f);
  }

  @Get("export.csv")
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", 'attachment; filename="notifications.csv"')
  export(@Query() q: { channel?: string; status?: string; q?: string }) {
    return this.svc.exportCsv({ channel: q.channel, status: q.status, q: q.q });
  }

  @Post(":id/retry") retry(@Param("id") id: string) { return this.svc.retry(id); }
  @Post("retry-all-failed") retryAll() { return this.svc.retryAllFailed(); }
}
