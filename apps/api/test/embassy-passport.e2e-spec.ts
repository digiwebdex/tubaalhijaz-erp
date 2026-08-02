// T002-05 — Embassy & Passport (SOP-gated) e2e
// Embassy fields, PASSPORT_RETURNED custody, VISA_REQUIRE_PASSPORT_RETURN flag.

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

describe("T002-05 Embassy & Passport SOP (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<INestApplication["getHttpServer"]>;
  let agentTok: string;
  let opsTok: string;
  let tenantId: string;
  let passengerId: string;
  let groupId: string;
  let passengerCode: string;
  const prevFlag = process.env.VISA_REQUIRE_PASSPORT_RETURN;

  const login = async (c: { email: string; password: string }) =>
    (await request(http).post("/auth/login").send(c).expect(200)).body.accessToken as string;
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  const reset = async (id: string) => {
    await prisma.passenger.update({
      where: { id },
      data: {
        visaPipelineStatus: "NEW",
        visaNumber: null,
        biometricStatus: null,
        visaStatus: "PENDING",
        visaStatusLabel: "Visa Not Issued",
        visaRejectReason: null,
        embassyRef: null,
        embassySubmittedAt: null,
        passportReturnedAt: null,
      },
    });
  };

  const walk = async (id: string, to: string, extra: Record<string, unknown> = {}) =>
    request(http)
      .post(`/passengers/${id}/visa-transition`)
      .set(auth(opsTok))
      .send({ to, ...extra })
      .expect(201);

  beforeAll(async () => {
    process.env.VISA_REQUIRE_PASSPORT_RETURN = "false";
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
      include: { passengers: { take: 1, orderBy: { code: "asc" } } },
    });
    groupId = group.id;
    passengerId = group.passengers[0].id;
    passengerCode = group.passengers[0].code;
    await reset(passengerId);
  });

  afterAll(async () => {
    if (prevFlag === undefined) delete process.env.VISA_REQUIRE_PASSPORT_RETURN;
    else process.env.VISA_REQUIRE_PASSPORT_RETURN = prevFlag;
    await app.close();
  });

  it("Scenario 1 — Passport submitted to Embassy (→ EMBASSY + embassyRef)", async () => {
    await walk(passengerId, "MOFA");
    const res = await walk(passengerId, "EMBASSY", {
      embassyRef: "EMB-DHK-T002-05",
      embassy: "Saudi Embassy Dhaka",
    });
    expect(res.body.to).toBe("EMBASSY");
    expect(res.body.embassyRef).toBe("EMB-DHK-T002-05");
    expect(res.body.embassySubmittedAt).toBeTruthy();

    const p = await prisma.passenger.findUniqueOrThrow({ where: { id: passengerId } });
    expect(p.embassyRef).toBe("EMB-DHK-T002-05");
    expect(p.embassySubmittedAt).toBeTruthy();

    const audit = await prisma.auditLog.findFirst({
      where: { entityId: passengerId, module: "VisaPipeline", action: "UPDATE" },
      orderBy: { createdAt: "desc" },
    });
    expect((audit?.after as { embassyRef?: string })?.embassyRef).toBe("EMB-DHK-T002-05");
  });

  it("Scenario 2 — Embassy processing updated (noop + notes / patch ref)", async () => {
    const res = await walk(passengerId, "EMBASSY", {
      embassyRef: "EMB-DHK-T002-05-UPD",
      notes: "Consulate chase follow-up",
    });
    expect(res.body.to).toBe("EMBASSY");
    expect(res.body.noop).toBe(true);
    expect(res.body.embassyRef).toBe("EMB-DHK-T002-05-UPD");

    const desk = await request(http)
      .get("/ops/visa/mutamers")
      .query({ groupId, visaState: "EMBASSY", pageSize: 50 })
      .set(auth(opsTok))
      .expect(200);
    expect(desk.body.sop).toBeDefined();
    const row = (desk.body.items as Array<{ id: string; embassyRef?: string }>).find(
      (r) => r.id === passengerId,
    );
    expect(row?.embassyRef).toBe("EMB-DHK-T002-05-UPD");
  });

  it("Scenario 3 — Passport returned (ISSUED → PASSPORT_RETURNED)", async () => {
    await walk(passengerId, "BIOMETRIC", { biometricStatus: "Registered" });
    await walk(passengerId, "SUBMITTED");
    await walk(passengerId, "PROCESSING");
    await walk(passengerId, "ISSUED", { visaNumber: "V-T002-05-EMB" });

    const t0 = new Date();
    const res = await walk(passengerId, "PASSPORT_RETURNED", { custodyConfirmed: true });
    expect(res.body.to).toBe("PASSPORT_RETURNED");
    expect(res.body.passportReturnedAt).toBeTruthy();

    const p = await prisma.passenger.findUniqueOrThrow({ where: { id: passengerId } });
    expect(p.passportReturnedAt).toBeTruthy();

    const log = await waitFor(() =>
      prisma.notificationLog.findFirst({
        where: {
          createdAt: { gte: t0 },
          event: { key: "PASSPORT_RETURNED" },
          OR: [{ tenantId }, { recipientUserId: { not: null } }],
          body: { contains: passengerCode },
        },
      }),
    );
    expect(log).toBeTruthy();
  });

  it("Scenario 4 — Invalid workflow rejected", async () => {
    // PASSPORT_RETURNED before ISSUED (from NEW)
    await reset(passengerId);
    const bad = await request(http)
      .post(`/passengers/${passengerId}/visa-transition`)
      .set(auth(opsTok))
      .send({ to: "PASSPORT_RETURNED", custodyConfirmed: true })
      .expect(400);
    expect(String(bad.body.message ?? bad.body.error ?? "")).toMatch(/not allowed|FORBIDDEN/i);

    // EMBASSY without context
    await walk(passengerId, "MOFA");
    await request(http)
      .post(`/passengers/${passengerId}/visa-transition`)
      .set(auth(opsTok))
      .send({ to: "EMBASSY" })
      .expect(400);

    // SOP flag: ISSUED → COMPLETED blocked
    process.env.VISA_REQUIRE_PASSPORT_RETURN = "true";
    await walk(passengerId, "EMBASSY", { embassyRef: "EMB-FLAG" });
    await walk(passengerId, "BIOMETRIC", { biometricStatus: "Registered" });
    await walk(passengerId, "SUBMITTED");
    await walk(passengerId, "PROCESSING");
    await walk(passengerId, "ISSUED", { visaNumber: "V-FLAG" });
    await request(http)
      .post(`/passengers/${passengerId}/visa-transition`)
      .set(auth(opsTok))
      .send({ to: "COMPLETED" })
      .expect(400);
    process.env.VISA_REQUIRE_PASSPORT_RETURN = "false";
  });

  it("Scenario 5 — Agent attempts update → 403", async () => {
    await request(http)
      .post(`/passengers/${passengerId}/visa-transition`)
      .set(auth(agentTok))
      .send({ to: "EMBASSY", embassyRef: "X" })
      .expect(403);

    await request(http)
      .patch(`/passengers/${passengerId}`)
      .set(auth(agentTok))
      .send({ embassyRef: "AGENT-HACK" })
      .expect(403);
  });
});
