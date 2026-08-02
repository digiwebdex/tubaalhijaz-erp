// T002-08 — Day-85 Compliance Engine (e2e)
// Architecture: "Day-85 Compliance Pack | Cron + multi-party notify + red cards".
// Derived from entry date + 85 (§8), notified via LONGSTAY_DAY85 to Host/Agent/
// Tuba (§9), swept by the daily automation cron (§11), no public mutate API (§7).

import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { setupApp } from "../src/setup-app";
import { PrismaService } from "../src/prisma/prisma.service";
import { OpsService } from "../src/ops/ops.service";
import { day85View, day85NotifyCode, DAY85_DUE, DAY85_ESCALATE } from "../src/ops/day85";
import { ensureVisaNotificationPack } from "../src/automation/visa-notification.pack";

const AGENT = { email: "ahmad@rashidi-travel.com", password: "Demo@123" };
const OPS = { email: "ops@tubalhijaz.com", password: "Demo@123" };
const DAY = 86_400_000;

async function waitFor<T>(fn: () => Promise<T | null | undefined>, ms = 25000, step = 300): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const r = await fn();
    if (r) return r;
    if (Date.now() > end) throw new Error("waitFor timed out");
    await new Promise((s) => setTimeout(s, step));
  }
}

describe("T002-08 Day-85 Compliance Engine (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ops: OpsService;
  let http: ReturnType<INestApplication["getHttpServer"]>;
  let agentTok: string;
  let opsTok: string;
  let groupId: string;
  let approachingId: string; // day ~80 — desk marker only
  let dueId: string; // day ~86 — reminder
  let escalateId: string; // day ~92 — escalation
  const cleanupIds: string[] = [];

  const login = async (c: { email: string; password: string }) =>
    (await request(http).post("/auth/login").send(c).expect(200)).body.accessToken as string;
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  /** Create a Long Stay with the host registered and a back-dated Kingdom entry. */
  const makeStay = async (label: string, daysAgo: number) => {
    const now = Date.now();
    const created = await request(http)
      .post("/ops/long-stays")
      .set(auth(opsTok))
      .send({
        groupId,
        hotelName: `T002-08 ${label}`,
        city: "Makkah",
        nights: 90,
        checkIn: new Date(now - daysAgo * DAY).toISOString(),
        checkOut: new Date(now + (90 - daysAgo) * DAY).toISOString(),
        pax: 4,
        registerHost: true,
        hostName: `Host ${label}`,
        hostWhatsapp: "+966501110000",
        entryDate: new Date(now - daysAgo * DAY).toISOString(),
      })
      .expect(201);
    cleanupIds.push(created.body.id);
    return created.body as { id: string; code: string; day85: { stage: string; dayCount: number } };
  };

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    setupApp(app);
    await app.init();
    http = app.getHttpServer();
    prisma = app.get(PrismaService);
    ops = app.get(OpsService);

    await ensureVisaNotificationPack(prisma);
    [agentTok, opsTok] = await Promise.all([login(AGENT), login(OPS)]);

    const group = await prisma.group.findFirstOrThrow({ where: { code: "GRP-1446-2401" } });
    groupId = group.id;
    await prisma.group.update({ where: { id: groupId }, data: { visaType: "LONG_STAY" } });
  });

  afterAll(async () => {
    for (const id of cleanupIds) {
      await prisma.auditLog.deleteMany({ where: { entityType: "LongStay", entityId: id } }).catch(() => undefined);
      await prisma.longStay.delete({ where: { id } }).catch(() => undefined);
    }
    await prisma.group
      .update({ where: { id: groupId }, data: { visaType: "UMRAH" } })
      .catch(() => undefined);
    await app.close();
  });

  // ── Unit: the compliance calculator ────────────────────────────────────────
  it("Unit — day85View derives stage, due date and red card from entry + 85", () => {
    const now = new Date("2026-06-01T00:00:00.000Z");
    const entryAt = (days: number) => new Date(now.getTime() - days * DAY);

    expect(day85View({ entryDate: null }, now).stage).toBe("NOT_TRACKED");
    expect(day85View({ entryDate: entryAt(10) }, now).stage).toBe("TRACKING");
    expect(day85View({ entryDate: entryAt(80) }, now).stage).toBe("APPROACHING");

    const due = day85View({ entryDate: entryAt(DAY85_DUE) }, now);
    expect(due.stage).toBe("DUE");
    expect(due.redCard).toBe(true);
    expect(due.dayCount).toBe(DAY85_DUE);
    expect(due.daysToDue).toBe(0);
    expect(due.dueAt?.toISOString()).toBe(now.toISOString());

    const esc = day85View({ entryDate: entryAt(DAY85_ESCALATE + 2) }, now);
    expect(esc.stage).toBe("ESCALATED");
    expect(esc.redCard).toBe(true);

    // Resolution wins over the clock, whichever way it is recorded.
    expect(day85View({ entryDate: entryAt(95), exitDate: now }, now).resolvedBy).toBe("EXIT_DATE");
    expect(day85View({ entryDate: entryAt(95), status: "COMPLETED" }, now).stage).toBe("RESOLVED");
    expect(day85View({ entryDate: entryAt(95), renewal: "APPROVED" }, now).redCard).toBe(false);
    expect(day85NotifyCode("ls1", "DUE")).toBe("LS85-ls1-DUE");
  });

  // ── Automation wiring ──────────────────────────────────────────────────────
  it("Automation — AR-LS-85 / AR-LS-90 / SYS_LONGSTAY_DAY85 seeded and enabled", async () => {
    const reminder = await prisma.automationRule.findUnique({ where: { code: "AR-LS-85" } });
    expect(reminder?.enabled).toBe(true);
    expect(reminder?.eventKey).toBe("longstay.day85");
    expect(reminder?.conditions).toEqual([{ path: "data.stage", op: "eq", value: "DUE" }]);

    const escalation = await prisma.automationRule.findUnique({ where: { code: "AR-LS-90" } });
    expect(escalation?.enabled).toBe(true);
    expect((escalation?.actions as Array<{ type: string }>).map((a) => a.type)).toEqual(
      expect.arrayContaining(["SEND_NOTIFICATION", "ESCALATE"]),
    );

    const cron = await prisma.automationRule.findUnique({ where: { code: "SYS_LONGSTAY_DAY85" } });
    expect(cron?.cronExpr).toBe("15 6 * * *");

    const event = await prisma.notificationEvent.findUnique({ where: { key: "LONGSTAY_DAY85" } });
    expect(event).toMatchObject({ whatsapp: true, email: true, inApp: true });

    const catalog = await request(http).get("/automation/overview").set(auth(opsTok)).expect(200);
    expect(catalog.body.catalog.events).toEqual(expect.arrayContaining(["longstay.day85"]));
  });

  // ── Scenario 1 ─────────────────────────────────────────────────────────────
  it("Scenario 1 — Long Stay approaching Day-85 PASS", async () => {
    const stay = await makeStay("approaching", 80);
    approachingId = stay.id;
    expect(stay.day85.stage).toBe("APPROACHING");
    expect(stay.day85.dayCount).toBe(80);

    const board = await request(http)
      .get("/ops/long-stays")
      .query({ day85: "APPROACHING" })
      .set(auth(opsTok))
      .expect(200);
    expect((board.body as Array<{ id: string }>).some((l) => l.id === approachingId)).toBe(true);

    // Approaching is a desk marker only — it must never notify.
    await ops.day85Sweep();
    const row = await prisma.longStay.findUniqueOrThrow({ where: { id: approachingId } });
    expect(row.day85NotifiedAt).toBeNull();
  });

  // ── Scenario 2 ─────────────────────────────────────────────────────────────
  it("Scenario 2 — Reminder triggered PASS", async () => {
    const stay = await makeStay("due", 86);
    dueId = stay.id;
    expect(stay.day85.stage).toBe("DUE");

    const t0 = new Date();
    const message = await ops.day85Sweep();
    expect(message).toMatch(/day-85 sweep/);

    const row = await prisma.longStay.findUniqueOrThrow({ where: { id: dueId } });
    expect(row.day85NotifiedAt).toBeTruthy();

    const log = await waitFor(() =>
      prisma.notificationLog.findFirst({
        where: {
          createdAt: { gte: t0 },
          event: { key: "LONGSTAY_DAY85" },
          code: { startsWith: day85NotifyCode(dueId, "DUE") },
        },
      }),
    );
    expect(log).toBeTruthy();

    // Host leg — WhatsApp to the registered host number (Host is not a login user).
    const hostLog = await waitFor(() =>
      prisma.notificationLog.findFirst({
        where: { code: `${day85NotifyCode(dueId, "DUE")}-EXT`, channel: "WHATSAPP" },
      }),
    );
    expect(hostLog.recipientAddress).toBe("+966501110000");

    const run = await waitFor(() =>
      prisma.automationRunLog.findFirst({
        where: { eventKey: "longstay.day85", status: "OK", rule: { code: "AR-LS-85" } },
        orderBy: { startedAt: "desc" },
      }),
    );
    expect(run).toBeTruthy();

    // Idempotent: a second sweep must not re-emit for an already-stamped stay.
    const runAudits = () =>
      prisma.auditLog.count({ where: { module: "Day85Compliance", entityId: dueId, action: "RUN" } });
    const before = await runAudits();
    await ops.day85Sweep();
    expect(await runAudits()).toBe(before);
    expect((await prisma.longStay.findUniqueOrThrow({ where: { id: dueId } })).day85NotifiedAt).toEqual(
      row.day85NotifiedAt,
    );
  });

  it("Escalation — day ≥ 90 raises the AR-LS-90 leg once", async () => {
    const stay = await makeStay("escalated", 92);
    escalateId = stay.id;
    expect(stay.day85.stage).toBe("ESCALATED");

    await ops.day85Sweep();
    const escalationAudit = await prisma.auditLog.findFirst({
      where: {
        module: "Day85Compliance",
        entityId: escalateId,
        after: { path: ["stage"], equals: "ESCALATED" },
      },
    });
    expect(escalationAudit).toBeTruthy();

    const run = await waitFor(() =>
      prisma.automationRunLog.findFirst({
        where: { eventKey: "longstay.day85", rule: { code: "AR-LS-90" } },
        orderBy: { startedAt: "desc" },
      }),
    );
    expect(run).toBeTruthy();

    const auditCount = () =>
      prisma.auditLog.count({
        where: { module: "Day85Compliance", entityId: escalateId, action: "RUN" },
      });
    const before = await auditCount();
    await ops.day85Sweep();
    expect(await auditCount()).toBe(before);
  });

  // ── Scenario 3 ─────────────────────────────────────────────────────────────
  it("Scenario 3 — Resolved before deadline PASS", async () => {
    const stay = await makeStay("resolve", 82);
    const res = await request(http)
      .patch(`/ops/long-stays/${stay.id}`)
      .set(auth(opsTok))
      .send({ exitDate: new Date().toISOString() })
      .expect(200);

    expect(res.body.day85.stage).toBe("RESOLVED");
    expect(res.body.day85.redCard).toBe(false);
    expect(res.body.day85.resolvedBy).toBe("EXIT_DATE");

    const resolveAudit = await prisma.auditLog.findFirst({
      where: {
        module: "Day85Compliance",
        entityId: stay.id,
        after: { path: ["event"], equals: "DAY85_RESOLVED" },
      },
    });
    expect(resolveAudit).toBeTruthy();

    // A resolved stay drops out of the sweep even once it passes day 85.
    await prisma.longStay.update({
      where: { id: stay.id },
      data: { entryDate: new Date(Date.now() - 95 * DAY) },
    });
    await ops.day85Sweep();
    const row = await prisma.longStay.findUniqueOrThrow({ where: { id: stay.id } });
    expect(row.day85NotifiedAt).toBeNull();
  });

  it("Validation — invalid manual compliance operations rejected", async () => {
    // No public Day-85 mutate API (architecture §7): the marker is not writable.
    await request(http)
      .patch(`/ops/long-stays/${dueId}`)
      .set(auth(opsTok))
      .send({ day85NotifiedAt: null })
      .expect(400);

    await request(http)
      .patch(`/ops/long-stays/${dueId}`)
      .set(auth(opsTok))
      .send({ exitDate: new Date(Date.now() - 200 * DAY).toISOString() })
      .expect(400);

    await request(http)
      .get("/ops/long-stays")
      .query({ day85: "NOT_A_STAGE" })
      .set(auth(opsTok))
      .expect(400);
  });

  // ── Scenario 4 ─────────────────────────────────────────────────────────────
  it("Scenario 4 — Agent attempts update → 403 PASS", async () => {
    await request(http)
      .patch(`/ops/long-stays/${dueId}`)
      .set(auth(agentTok))
      .send({ exitDate: new Date().toISOString() })
      .expect(403);

    await request(http)
      .patch(`/ops/long-stays/${escalateId}`)
      .set(auth(agentTok))
      .send({ status: "COMPLETED" })
      .expect(403);
  });

  // ── Scenario 5 ─────────────────────────────────────────────────────────────
  it("Scenario 5 — Audit created PASS", async () => {
    const notified = await prisma.auditLog.findFirst({
      where: { module: "Day85Compliance", entityId: dueId, action: "RUN" },
      orderBy: { createdAt: "desc" },
    });
    expect(notified).toBeTruthy();
    expect(notified?.actorLabel).toBe("System (Cron)");
    expect(notified?.entityType).toBe("LongStay");
    const after = notified?.after as { event?: string; stage?: string; dayCount?: number };
    expect(after.event).toBe("DAY85_NOTIFIED");
    expect(after.stage).toBe("DUE");
    expect(after.dayCount).toBeGreaterThanOrEqual(DAY85_DUE);
  });

  it("Regression — Visa Desk shows the day-85 marker; host register untouched", async () => {
    const desk = await request(http)
      .get("/ops/visa/mutamers")
      .query({ groupId, visaType: "LONG_STAY", pageSize: 5 })
      .set(auth(opsTok))
      .expect(200);
    const row = (desk.body.items as Array<{
      longStayHost?: { hostComplete?: boolean; day85?: { stage: string } };
    }>)[0];
    expect(row?.longStayHost?.hostComplete).toBe(true);
    expect(row?.longStayHost?.day85?.stage).toBeTruthy();

    const board = await request(http).get("/ops/long-stays").set(auth(opsTok)).expect(200);
    const all = board.body as Array<{ id: string; hostName: string | null; day85: { stage: string } }>;
    expect(all.find((l) => l.id === dueId)?.hostName).toBe("Host due");
    expect(all.every((l) => typeof l.day85?.stage === "string")).toBe(true);
  });
});
