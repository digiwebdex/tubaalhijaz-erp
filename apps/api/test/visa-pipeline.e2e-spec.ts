// T002-03 — Visa Processing Workflow Engine (e2e)
// Pipeline transitions on Passenger via POST /passengers/:id/visa-transition.

import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { setupApp } from "../src/setup-app";
import { PrismaService } from "../src/prisma/prisma.service";

const AGENT = { email: "ahmad@rashidi-travel.com", password: "Demo@123" };
const OPS = { email: "ops@tubalhijaz.com", password: "Demo@123" };

describe("T002-03 Visa Pipeline (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<INestApplication["getHttpServer"]>;
  let agentTok: string;
  let opsTok: string;
  let passengerId: string;
  let groupId: string;

  const login = async (creds: { email: string; password: string }) =>
    (await request(http).post("/auth/login").send(creds).expect(200)).body.accessToken as string;
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    setupApp(app);
    await app.init();
    http = app.getHttpServer();
    prisma = app.get(PrismaService);
    [agentTok, opsTok] = await Promise.all([login(AGENT), login(OPS)]);

    const group = await prisma.group.findFirstOrThrow({
      where: { code: "GRP-1446-2401" },
      include: { passengers: { take: 1, orderBy: { code: "asc" } } },
    });
    groupId = group.id;
    passengerId = group.passengers[0].id;

    await prisma.passenger.update({
      where: { id: passengerId },
      data: {
        visaPipelineStatus: "NEW",
        visaNumber: null,
        biometricStatus: null,
        visaStatus: "PENDING",
        visaStatusLabel: "Visa Not Issued",
        visaRejectReason: null,
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("Scenario 1 — NEW → MOFA PASS", async () => {
    const res = await request(http)
      .post(`/passengers/${passengerId}/visa-transition`)
      .set(auth(opsTok))
      .send({ to: "MOFA" })
      .expect(201);
    expect(res.body.from).toBe("NEW");
    expect(res.body.to).toBe("MOFA");
    expect(res.body.gateAssist).toBeDefined();

    const audit = await prisma.auditLog.findFirst({
      where: { entityId: passengerId, module: "VisaPipeline", action: "UPDATE" },
      orderBy: { createdAt: "desc" },
    });
    expect(audit).toBeTruthy();
    expect((audit?.after as { to?: string })?.to).toBe("MOFA");
  });

  it("Scenario 2 — MOFA → EMBASSY PASS", async () => {
    const res = await request(http)
      .post(`/passengers/${passengerId}/visa-transition`)
      .set(auth(opsTok))
      .send({ to: "EMBASSY", embassyRef: "EMB-T002-03-REG" })
      .expect(201);
    expect(res.body.from).toBe("MOFA");
    expect(res.body.to).toBe("EMBASSY");
  });

  it("walks EMBASSY → … → PROCESSING", async () => {
    for (const step of [
      { to: "BIOMETRIC", biometricStatus: "Registered" },
      { to: "SUBMITTED" },
      { to: "PROCESSING" },
    ]) {
      await request(http)
        .post(`/passengers/${passengerId}/visa-transition`)
        .set(auth(opsTok))
        .send(step)
        .expect(201);
    }
    const p = await prisma.passenger.findUniqueOrThrow({ where: { id: passengerId } });
    expect(p.visaPipelineStatus).toBe("PROCESSING");
  });

  it("Scenario 3 — PROCESSING → ISSUED PASS", async () => {
    const res = await request(http)
      .post(`/passengers/${passengerId}/visa-transition`)
      .set(auth(opsTok))
      .send({ to: "ISSUED", visaNumber: "V-T002-03-E2E" })
      .expect(201);
    expect(res.body.to).toBe("ISSUED");
    const p = await prisma.passenger.findUniqueOrThrow({ where: { id: passengerId } });
    expect(p.visaNumber).toBe("V-T002-03-E2E");
    expect(p.visaStatus).toBe("APPROVED");
  });

  it("Scenario 4 — ISSUED → PASSPORT_RETURNED PASS", async () => {
    const res = await request(http)
      .post(`/passengers/${passengerId}/visa-transition`)
      .set(auth(opsTok))
      .send({ to: "PASSPORT_RETURNED", custodyConfirmed: true })
      .expect(201);
    expect(res.body.to).toBe("PASSPORT_RETURNED");
  });

  it("Scenario 5 — invalid NEW → ISSUED REJECT + audit", async () => {
    // Reset another passenger to NEW for invalid attempt
    const other = await prisma.passenger.findFirstOrThrow({
      where: { groupId, id: { not: passengerId } },
    });
    await prisma.passenger.update({
      where: { id: other.id },
      data: { visaPipelineStatus: "NEW", visaNumber: null },
    });

    await request(http)
      .post(`/passengers/${other.id}/visa-transition`)
      .set(auth(opsTok))
      .send({ to: "ISSUED", visaNumber: "X" })
      .expect(400);

    const audit = await prisma.auditLog.findFirst({
      where: { entityId: other.id, module: "VisaPipeline", action: "REJECT" },
      orderBy: { createdAt: "desc" },
    });
    expect(audit).toBeTruthy();
    expect((audit?.after as { attemptedTo?: string })?.attemptedTo).toBe("ISSUED");
  });

  it("Scenario 6 — Agent attempts transition → 403 PASS", async () => {
    await request(http)
      .post(`/passengers/${passengerId}/visa-transition`)
      .set(auth(agentTok))
      .send({ to: "COMPLETED" })
      .expect(403);
  });

  it("desk worklist exposes pipeline status + allowedNext", async () => {
    const res = await request(http)
      .get("/ops/visa/mutamers")
      .query({ visaState: "PASSPORT_RETURNED", pageSize: 50 })
      .set(auth(opsTok))
      .expect(200);
    expect(res.body.items.some((r: { id: string }) => r.id === passengerId)).toBe(true);
    const row = res.body.items.find((r: { id: string }) => r.id === passengerId);
    expect(row.visaPipelineStatus || row.visaState).toBe("PASSPORT_RETURNED");
    expect(Array.isArray(row.allowedNext)).toBe(true);
    expect(row.allowedNext).toContain("COMPLETED");
  });
});
