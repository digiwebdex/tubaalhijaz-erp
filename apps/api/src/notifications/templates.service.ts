import { Injectable } from "@nestjs/common";
import { NotificationChannel } from "@prisma/client";
import { renderTemplate, type NotifTemplate } from "@tuba/shared";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Resolves a rendered { subject, body } for an event/channel/language. Prefers a
 * DB `MessageTemplate` row (edited in the Notification Center) and falls back to
 * the shared bilingual catalog in @tuba/shared.
 */
@Injectable()
export class TemplateService {
  constructor(private readonly prisma: PrismaService) {}

  async render(
    eventKey: string | null | undefined,
    channel: NotificationChannel,
    lang: "bn" | "en",
    vars: Record<string, unknown>,
  ): Promise<NotifTemplate> {
    let override: { subject: string | null; body: string } | undefined;
    if (eventKey) {
      const ev = await this.prisma.notificationEvent.findUnique({ where: { key: eventKey }, select: { id: true } });
      if (ev) {
        const tpl = await this.prisma.messageTemplate.findUnique({
          where: { eventId_channel_lang: { eventId: ev.id, channel, lang } },
          select: { subject: true, body: true },
        });
        if (tpl) override = tpl;
      }
    }
    return renderTemplate(eventKey, lang, vars, override);
  }
}
