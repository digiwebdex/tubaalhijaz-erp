import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { NOTIF_TEMPLATES } from "@tuba/shared";

/**
 * T001-08 — idempotent intake notification pack.
 * Upserts NotificationEvent rows, MessageTemplates (from shared catalog),
 * and AutomationRules AR-GRP-01…04 so existing DBs get rules without a full reseed.
 */

const INTAKE_EVENTS: Array<{
  key: string;
  labelEn: string;
  labelBn: string;
  whatsapp: boolean;
  email: boolean;
  inApp: boolean;
}> = [
  {
    key: "GROUP_CREATED",
    labelEn: "Group Created",
    labelBn: "গ্রুপ তৈরি হয়েছে",
    whatsapp: true,
    email: true,
    inApp: true,
  },
  {
    key: "GROUP_GATES_CHANGED",
    labelEn: "Group Readiness Gates Changed",
    labelBn: "গ্রুপ প্রস্তুতি গেট পরিবর্তিত",
    whatsapp: true,
    email: true,
    inApp: true,
  },
  {
    key: "GROUP_IMPORT_COMPLETED",
    labelEn: "Mutamer Import Completed",
    labelBn: "মুতামির আমদানি সম্পন্ন",
    whatsapp: true,
    email: true,
    inApp: true,
  },
  {
    key: "GROUP_OCR_COMMITTED",
    labelEn: "Nusuk Group List OCR Committed",
    labelBn: "নুসুক গ্রুপ তালিকা OCR প্রতিশ্রুত",
    whatsapp: true,
    email: true,
    inApp: true,
  },
];

const INTAKE_RULES: Array<{
  code: string;
  category: string;
  name: string;
  nameBn: string;
  trigger: string;
  eventKey: string;
  actions: unknown[];
}> = [
  {
    code: "AR-GRP-01",
    category: "Group",
    name: "Group Created → Notify",
    nameBn: "গ্রুপ তৈরি",
    trigger: "Group created",
    eventKey: "group.created",
    actions: [
      {
        type: "SEND_NOTIFICATION",
        params: {
          eventKey: "GROUP_CREATED",
          title: "New group created",
          notifyPolicy: "intake",
        },
      },
    ],
  },
  {
    code: "AR-GRP-02",
    category: "Group",
    name: "Gates Changed → Notify",
    nameBn: "গেট পরিবর্তন",
    trigger: "Group readiness gates changed",
    eventKey: "group.gates.changed",
    actions: [
      {
        type: "SEND_NOTIFICATION",
        params: {
          eventKey: "GROUP_GATES_CHANGED",
          title: "Group readiness gates updated",
          notifyPolicy: "intake",
        },
      },
    ],
  },
  {
    code: "AR-GRP-03",
    category: "Group",
    name: "Mutamer Import → Notify",
    nameBn: "মুতামির আমদানি",
    trigger: "Mutamer bulk import completed",
    eventKey: "group.import.completed",
    actions: [
      {
        type: "SEND_NOTIFICATION",
        params: {
          eventKey: "GROUP_IMPORT_COMPLETED",
          title: "Mutamer import completed",
          notifyPolicy: "intake",
        },
      },
    ],
  },
  {
    code: "AR-GRP-04",
    category: "Group",
    name: "Group List OCR → Notify",
    nameBn: "গ্রুপ তালিকা OCR",
    trigger: "Nusuk group-list OCR approved",
    eventKey: "group.ocr.committed",
    actions: [
      {
        type: "SEND_NOTIFICATION",
        params: {
          eventKey: "GROUP_OCR_COMMITTED",
          title: "Group list OCR committed",
          notifyPolicy: "intake",
        },
      },
    ],
  },
];

const TEMPLATE_CHANNELS = ["IN_APP", "WHATSAPP", "EMAIL"] as const;

export async function ensureIntakeNotificationPack(prisma: PrismaClient): Promise<void> {
  const eventIds: Record<string, string> = {};

  for (const e of INTAKE_EVENTS) {
    const row = await prisma.notificationEvent.upsert({
      where: { key: e.key },
      create: {
        key: e.key,
        labelEn: e.labelEn,
        labelBn: e.labelBn,
        priority: "NORMAL",
        whatsapp: e.whatsapp,
        email: e.email,
        inApp: e.inApp,
      },
      update: {
        labelEn: e.labelEn,
        labelBn: e.labelBn,
        whatsapp: e.whatsapp,
        email: e.email,
        inApp: e.inApp,
      },
    });
    eventIds[e.key] = row.id;
  }

  for (const key of Object.keys(eventIds)) {
    const catalog = NOTIF_TEMPLATES[key];
    if (!catalog) continue;
    for (const channel of TEMPLATE_CHANNELS) {
      for (const lang of ["en", "bn"] as const) {
        const tpl = catalog[lang] ?? catalog.en;
        await prisma.messageTemplate.upsert({
          where: {
            eventId_channel_lang: {
              eventId: eventIds[key],
              channel,
              lang,
            },
          },
          create: {
            eventId: eventIds[key],
            channel,
            lang,
            subject: tpl.subject,
            body: tpl.body,
          },
          update: {
            subject: tpl.subject,
            body: tpl.body,
          },
        });
      }
    }
  }

  for (const r of INTAKE_RULES) {
    await prisma.automationRule.upsert({
      where: { code: r.code },
      create: {
        code: r.code,
        category: r.category,
        name: r.name,
        nameBn: r.nameBn,
        trigger: r.trigger,
        eventKey: r.eventKey,
        conditionExpr: null,
        conditions: Prisma.JsonNull,
        actions: r.actions as Prisma.InputJsonValue,
        enabled: true,
      },
      update: {
        name: r.name,
        nameBn: r.nameBn,
        trigger: r.trigger,
        eventKey: r.eventKey,
        actions: r.actions as Prisma.InputJsonValue,
        enabled: true,
      },
    });
  }
}

/** Domain event keys covered by the intake notification pack. */
export const INTAKE_DOMAIN_EVENTS = [
  "group.created",
  "group.gates.changed",
  "group.import.completed",
  "group.ocr.committed",
] as const;

export function isIntakeDomainEvent(key: string): boolean {
  return (INTAKE_DOMAIN_EVENTS as readonly string[]).includes(key);
}
