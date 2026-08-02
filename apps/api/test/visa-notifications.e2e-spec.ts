// T002-04 — Visa Approval / Rejection notifications (e2e)
// Wire AR-VISA-01/02 → NotificationLog on ISSUED / REJECTED (Agent + Admin).

import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { setupApp } from "../src/setup-app";
import { PrismaService } from "../src/prisma/prisma.service";
import { ensureVisaNotificationPack } from "../src/automation/visa-notification.pack";

const AGENT = { email: "ahmad@rashidi-travel.com", password: "Demo@123" };
const OPS = { email: "ops@tubalhijaz.com", password: "Demo@123" };

async function waitFor<T>(fn: () => Promise<T | null | undefined>, ms = 25000, step = 300): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const r = await fn();
    if (r) return r;
    if (Date.now() > end) throw new Error("waitFor timed out");
    await new Promise((s) => setTimeout(s, step));
  }
}

describe("T002-04 Visa Approval/Rejection notifications (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<INestApplication["getHttpServer"]>;
  let agentTok: string;
  let opsTok: string;
  let tenantId: string;
  let passengerId: string;
  let rejectPassengerId: string;
  let groupId: string;
  let passengerCode: string;

  const login = async (c: { email: string; password: string }) =>
    (await request(http).post("/auth/login").send(c).expect(200)).body.accessToken as string;
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  const resetPassenger = async (id: string) => {
    await prisma.passenger.update({
      where: { id },
      data: {
        visaPipelineStatus: "NEW",
        visaNumber: null,
        biometricStatus: null,
        visaStatus: "PENDING",
        visaStatusLabel: "Visa Not Issued",
        visaRejectReason: null,
      },
    });
  };

  const walkTo = async (id: string, to: string, extra: Record<string, unknown> = {}) => {
    await request(http)
      .post(`/passengers/${id}/visa-transition`)
      .set(auth(opsTok))
      .send({ to, ...extra })
      .expect(201);
  };

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    setupApp(app);
    await app.init();
    http = app.getHttpServer();
    prisma = app.get(PrismaService);

    await ensureVisaNotificationPack(prisma);

    [agentTok, opsTok] = await Promise.all([login(AGENT), login(OPS)]);
    tenantId = (
      await prisma.user.findFirstOrThrow({
        where: { email: AGENT.email },
        select: { companyId: true },
      })
    ).companyId!;

    const group = await prisma.group.findFirstOrThrow({
      where: { code: "GRP-1446-2401" },
      include: { passengers: { take: 2, orderBy: { code: "asc" } } },
    });
    groupId = group.id;
    expect(group.passengers.length).toBeGreaterThanOrEqual(2);
    passengerId = group.passengers[0].id;
    passengerCode = group.passengers[0].code;
    rejectPassengerId = group.passengers[1].id;

    await resetPassenger(passengerId);
    await resetPassenger(rejectPassengerId);
  });

  afterAll(async () => {
    await app.close();
  });

  it("AR-VISA-01 / AR-VISA-02 enabled and catalog lists visa domain events", async () => {
    for (const code of ["AR-VISA-01", "AR-VISA-02"]) {
      const r = await prisma.automationRule.findUnique({ where: { code } });
      expect(r?.enabled).toBe(true);
      expect(r?.eventKey).toMatch(/^visa\./);
    }
    const catalog = await request(http).get("/automation/overview").set(auth(opsTok)).expect(200);
    expect(catalog.body.catalog.events).toEqual(
      expect.arrayContaining(["visa.approved", "visa.rejected"]),
    );
  });

  it("Scenario — ISSUED → VISA_APPROVED NotificationLog (agent tenant + staff)", async () => {
    const t0 = new Date();

    await walkTo(passengerId, "MOFA");
    await walkTo(passengerId, "EMBASSY");
    await walkTo(passengerId, "BIOMETRIC", { biometricStatus: "Registered" });
    await walkTo(passengerId, "SUBMITTED");
    await walkTo(passengerId, "PROCESSING");

    // Intermediate states must not spam VISA_APPROVED
    const premature = await prisma.notificationLog.count({
      where: {
        createdAt: { gte: t0 },
        event: { key: "VISA_APPROVED" },
        body: { contains: passengerCode },
      },
    });
    expect(premature).toBe(0);

    const tIssued = new Date();
    await walkTo(passengerId, "ISSUED", { visaNumber: "V-T002-04-OK" });

    const agentLog = await waitFor(() =>
      prisma.notificationLog.findFirst({
        where: {
          createdAt: { gte: tIssued },
          event: { key: "VISA_APPROVED" },
          tenantId,
          OR: [{ title: { contains: passengerCode } }, { body: { contains: passengerCode } }],
        },
      }),
    );
    expect(agentLog).toBeTruthy();
    expect(["WHATSAPP", "EMAIL", "IN_APP"]).toContain(agentLog.channel);

    const staffLog = await waitFor(() =>
      prisma.notificationLog.findFirst({
        where: {
          createdAt: { gte: tIssued },
          event: { key: "VISA_APPROVED" },
          channel: "IN_APP",
          recipientUser: { role: { key: { in: ["OPS_STAFF", "SUPER_ADMIN"] } } },
        },
      }),
    );
    expect(staffLog).toBeTruthy();

    const run = await waitFor(() =>
      prisma.automationRunLog.findFirst({
        where: {
          eventKey: "visa.approved",
          status: "OK",
          rule: { code: "AR-VISA-01" },
        },
        orderBy: { startedAt: "desc" },
      }),
    );
    expect(run).toBeTruthy();
    expect(run.startedAt.getTime()).toBeGreaterThanOrEqual(tIssued.getTime() - 1000);
  });

  it("Scenario — REJECTED → VISA_REJECTED NotificationLog", async () => {
    const t0 = new Date();
    await walkTo(rejectPassengerId, "MOFA");
    await walkTo(rejectPassengerId, "BIOMETRIC", { biometricStatus: "Registered" });
    await walkTo(rejectPassengerId, "SUBMITTED");
    await walkTo(rejectPassengerId, "PROCESSING");
    await walkTo(rejectPassengerId, "REJECTED", { reason: "Document mismatch T002-04" });

    const log = await waitFor(() =>
      prisma.notificationLog.findFirst({
        where: {
          createdAt: { gte: t0 },
          event: { key: "VISA_REJECTED" },
          OR: [{ tenantId }, { recipientUserId: { not: null } }],
          body: { contains: "Document mismatch" },
        },
      }),
    );
    expect(log).toBeTruthy();

    const run = await waitFor(() =>
      prisma.automationRunLog.findFirst({
        where: {
          eventKey: "visa.rejected",
          status: "OK",
          rule: { code: "AR-VISA-02" },
        },
        orderBy: { startedAt: "desc" },
      }),
    );
    expect(run).toBeTruthy();
    expect(run.startedAt.getTime()).toBeGreaterThanOrEqual(t0.getTime() - 1000);
  });

  it("Agent cannot transition (RBAC regression) — 403", async () => {
    const p = await prisma.passenger.findFirstOrThrow({
      where: { groupId, visaPipelineStatus: "NEW" },
    });
    await request(http)
      .post(`/passengers/${p.id}/visa-transition`)
      .set(auth(agentTok))
      .send({ to: "MOFA" })
      .expect(403);
  });

  it("desk mutamer board still lists pipeline status (regression)", async () => {
    const res = await request(http)
      .get("/ops/visa/mutamers")
      .query({ groupId })
      .set(auth(opsTok))
      .expect(200);
    expect(Array.isArray(res.body.items ?? res.body)).toBe(true);
  });
});
