import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { NOTIF_TEMPLATES } from "@tuba/shared";

/**
 * T002-04/05/08 — idempotent visa + Long Stay compliance notification pack.
 * Upserts NotificationEvent VISA_APPROVED / VISA_REJECTED / PASSPORT_RETURNED /
 * LONGSTAY_DAY85, MessageTemplates, AutomationRules AR-VISA-01…03 + AR-LS-85/90,
 * and the SYS_LONGSTAY_DAY85 cron rule the sweep logs its runs against.
 */

const VISA_EVENTS: Array<{
  key: string;
  labelEn: string;
  labelBn: string;
  whatsapp: boolean;
  email: boolean;
  inApp: boolean;
}> = [
  {
    key: "VISA_APPROVED",
    labelEn: "Visa Approved",
    labelBn: "ভিসা অনুমোদিত",
    whatsapp: true,
    email: true,
    inApp: true,
  },
  {
    key: "VISA_REJECTED",
    labelEn: "Visa Rejected",
    labelBn: "ভিসা প্রত্যাখ্যাত",
    whatsapp: true,
    email: true,
    inApp: true,
  },
  {
    // Architecture §9 — In-App (+ WA if material)
    key: "PASSPORT_RETURNED",
    labelEn: "Passport Returned",
    labelBn: "পাসপোর্ট ফেরত",
    whatsapp: true,
    email: false,
    inApp: true,
  },
  {
    // T002-08 / architecture §9 — WA + Email + In-App to Host, Agent, Tuba.
    key: "LONGSTAY_DAY85",
    labelEn: "Long Stay Day-85 Compliance",
    labelBn: "লং স্টে ডে-৮৫ কমপ্লায়েন্স",
    whatsapp: true,
    email: true,
    inApp: true,
  },
];

const VISA_RULES: Array<{
  code: string;
  category: string;
  name: string;
  nameBn: string;
  trigger: string;
  eventKey: string | null;
  actions: unknown[];
  conditions?: unknown[];
  cronExpr?: string;
}> = [
  {
    code: "AR-VISA-01",
    category: "Visa",
    name: "Visa Issued → Notify",
    nameBn: "ভিসা ইস্যু",
    trigger: "Passenger visa pipeline → ISSUED",
    eventKey: "visa.approved",
    actions: [
      {
        type: "SEND_NOTIFICATION",
        params: {
          eventKey: "VISA_APPROVED",
          title: "Visa issued",
          notifyPolicy: "visa",
        },
      },
    ],
  },
  {
    code: "AR-VISA-02",
    category: "Visa",
    name: "Visa Rejected → Notify",
    nameBn: "ভিসা প্রত্যাখ্যান",
    trigger: "Passenger visa pipeline → REJECTED",
    eventKey: "visa.rejected",
    actions: [
      {
        type: "SEND_NOTIFICATION",
        params: {
          eventKey: "VISA_REJECTED",
          title: "Visa rejected",
          notifyPolicy: "visa",
        },
      },
    ],
  },
  {
    code: "AR-VISA-03",
    category: "Visa",
    name: "Passport Returned → Notify",
    nameBn: "পাসপোর্ট ফেরত",
    trigger: "Passenger visa pipeline → PASSPORT_RETURNED",
    eventKey: "visa.passport.returned",
    actions: [
      {
        type: "SEND_NOTIFICATION",
        params: {
          eventKey: "PASSPORT_RETURNED",
          title: "Passport returned",
          notifyPolicy: "visa",
        },
      },
    ],
  },
  {
    // T002-08 — reminder leg. Host + Agent + Tuba on the day-85 line.
    code: "AR-LS-85",
    category: "LongStay",
    name: "Long Stay Day-85 → Notify Host/Agent/Tuba",
    nameBn: "ডে-৮৫ রিমাইন্ডার",
    trigger: "Day-85 sweep: Kingdom day ≥ 85",
    eventKey: "longstay.day85",
    conditions: [{ path: "data.stage", op: "eq", value: "DUE" }],
    actions: [
      {
        type: "SEND_NOTIFICATION",
        params: {
          eventKey: "LONGSTAY_DAY85",
          title: "Long Stay day-85 compliance due",
          notifyPolicy: "longstay",
        },
      },
    ],
  },
  {
    // T002-08 — escalation leg at the ~90-day line (architecture §12 red cards).
    code: "AR-LS-90",
    category: "LongStay",
    name: "Long Stay Day-90 → Escalate",
    nameBn: "ডে-৯০ এসকেলেশন",
    trigger: "Day-85 sweep: Kingdom day ≥ 90 (overstay risk)",
    eventKey: "longstay.day85",
    conditions: [{ path: "data.stage", op: "eq", value: "ESCALATED" }],
    actions: [
      {
        type: "SEND_NOTIFICATION",
        params: {
          eventKey: "LONGSTAY_DAY85",
          title: "Long Stay overstay risk — day 90",
          notifyPolicy: "longstay",
          priority: "EMERGENCY",
        },
      },
      { type: "ESCALATE", params: { title: "Long Stay overstay risk (day 90)" } },
    ],
  },
  {
    // Cron rule row the scheduled sweep logs AutomationRunLog against, and the
    // handle Ops uses to see the job in /automation (architecture §6).
    code: "SYS_LONGSTAY_DAY85",
    category: "Sys",
    name: "Daily Day-85 Compliance Sweep",
    nameBn: "দৈনিক ডে-৮৫ স্ক্যান",
    trigger: "Schedule: 06:15 daily",
    eventKey: null,
    actions: [{ type: "SEND_NOTIFICATION", params: { eventKey: "LONGSTAY_DAY85" } }],
    cronExpr: "15 6 * * *",
  },
];

const TEMPLATE_CHANNELS = ["IN_APP", "WHATSAPP", "EMAIL"] as const;

export async function ensureVisaNotificationPack(prisma: PrismaClient): Promise<void> {
  const eventIds: Record<string, string> = {};

  for (const e of VISA_EVENTS) {
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

  for (const r of VISA_RULES) {
    const conditions = r.conditions
      ? (r.conditions as Prisma.InputJsonValue)
      : Prisma.JsonNull;
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
        conditions,
        actions: r.actions as Prisma.InputJsonValue,
        cronExpr: r.cronExpr ?? null,
        enabled: true,
      },
      update: {
        name: r.name,
        nameBn: r.nameBn,
        trigger: r.trigger,
        eventKey: r.eventKey,
        conditions,
        actions: r.actions as Prisma.InputJsonValue,
        cronExpr: r.cronExpr ?? null,
        enabled: true,
      },
    });
  }
}

/** Domain event keys covered by the visa notification pack. */
export const VISA_DOMAIN_EVENTS = [
  "visa.approved",
  "visa.rejected",
  "visa.passport.returned",
] as const;

export function isVisaDomainEvent(key: string): boolean {
  return (VISA_DOMAIN_EVENTS as readonly string[]).includes(key);
}

/** T002-08 — Long Stay compliance events (staff fan-out + external host leg). */
export const LONGSTAY_DOMAIN_EVENTS = ["longstay.day85"] as const;

export function isLongStayDomainEvent(key: string): boolean {
  return (LONGSTAY_DOMAIN_EVENTS as readonly string[]).includes(key);
}
