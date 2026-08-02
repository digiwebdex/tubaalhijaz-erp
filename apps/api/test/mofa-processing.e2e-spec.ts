// T002-06 — MOFA completeness + MOFA Processing Bill (e2e)
// Architecture: KPIs + Invoice kind Bill Sheet. MOFA Number ≠ Bill.

import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { setupApp } from "../src/setup-app";
import { PrismaService } from "../src/prisma/prisma.service";

const AGENT = { email: "ahmad@rashidi-travel.com", password: "Demo@123" };
const OPS = { email: "ops@tubalhijaz.com", password: "Demo@123" };
const FIN = { email: "finance@tubalhijaz.com", password: "Demo@123" };

describe("T002-06 MOFA completeness + Bill (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<INestApplication["getHttpServer"]>;
  let agentTok: string;
  let opsTok: string;
  let finTok: string;
  let passengerId: string;
  let groupId: string;
  let tenantId: string;
  const prevBill = process.env.ENABLE_MOFA_PROCESSING_BILL;

  const login = async (c: { email: string; password: string }) =>
    (await request(http).post("/auth/login").send(c).expect(200)).body.accessToken as string;
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    process.env.ENABLE_MOFA_PROCESSING_BILL = "true";
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    setupApp(app);
    await app.init();
    http = app.getHttpServer();
    prisma = app.get(PrismaService);
    [agentTok, opsTok, finTok] = await Promise.all([login(AGENT), login(OPS), login(FIN)]);

    const group = await prisma.group.findFirstOrThrow({
      where: { code: "GRP-1446-2401" },
      include: { passengers: { take: 1, orderBy: { code: "asc" } } },
    });
    groupId = group.id;
    tenantId = group.tenantId;
    passengerId = group.passengers[0].id;

    await prisma.passenger.update({
      where: { id: passengerId },
      data: {
        visaPipelineStatus: "NEW",
        mofaNumber: null,
        visaNumber: null,
        biometricStatus: null,
        visaStatus: "PENDING",
        visaStatusLabel: "Visa Not Issued",
      },
    });
  });

  afterAll(async () => {
    if (prevBill === undefined) delete process.env.ENABLE_MOFA_PROCESSING_BILL;
    else process.env.ENABLE_MOFA_PROCESSING_BILL = prevBill;
    await app.close();
  });

  it("Scenario 1 — Passenger enters MOFA stage PASS", async () => {
    const res = await request(http)
      .post(`/passengers/${passengerId}/visa-transition`)
      .set(auth(opsTok))
      .send({ to: "MOFA" })
      .expect(201);
    expect(res.body.to).toBe("MOFA");
  });

  it("Scenario 2 — MOFA information completed PASS", async () => {
    const res = await request(http)
      .post(`/passengers/${passengerId}/visa-transition`)
      .set(auth(opsTok))
      .send({ to: "MOFA", mofaNumber: "MOFA-T002-06-OK", completeMofa: true })
      .expect(201);
    expect(res.body.mofaNumber).toBe("MOFA-T002-06-OK");
    const p = await prisma.passenger.findUniqueOrThrow({ where: { id: passengerId } });
    expect(p.mofaNumber).toBe("MOFA-T002-06-OK");
  });

  it("Scenario 3 — Required data missing REJECTED PASS", async () => {
    await request(http)
      .post(`/passengers/${passengerId}/visa-transition`)
      .set(auth(opsTok))
      .send({ to: "MOFA", completeMofa: true, mofaNumber: "" })
      .expect(400);

    // Clear prior MOFA so completeMofa without number fails.
    await prisma.passenger.update({
      where: { id: passengerId },
      data: { mofaNumber: null },
    });
    await request(http)
      .post(`/passengers/${passengerId}/visa-transition`)
      .set(auth(opsTok))
      .send({ to: "MOFA", completeMofa: true })
      .expect(400);

    // Restore for later scenarios
    await prisma.passenger.update({
      where: { id: passengerId },
      data: { mofaNumber: "MOFA-T002-06-OK" },
    });

    // Bill without qty/rate
    await request(http)
      .post("/finance/mofa-processing-bills")
      .set(auth(finTok))
      .send({ tenantId, groupId, qty: 0, rate: 100 })
      .expect(400);
  });

  it("Scenario 4 — Agent attempts update → 403 PASS", async () => {
    await request(http)
      .post(`/passengers/${passengerId}/visa-transition`)
      .set(auth(agentTok))
      .send({ to: "MOFA", mofaNumber: "HACK", completeMofa: true })
      .expect(403);

    await request(http)
      .patch(`/passengers/${passengerId}`)
      .set(auth(agentTok))
      .send({ mofaNumber: "HACK" })
      .expect(403);
  });

  it("Scenario 5 — Audit written PASS", async () => {
    const audit = await prisma.auditLog.findFirst({
      where: {
        entityId: passengerId,
        module: "VisaPipeline",
        action: "UPDATE",
      },
      orderBy: { createdAt: "desc" },
    });
    expect(audit).toBeTruthy();
    expect((audit?.after as { mofaNumber?: string })?.mofaNumber).toBe("MOFA-T002-06-OK");
  });

  it("MOFA completeness KPI on desk", async () => {
    // Push to ISSUED so completeness denominator counts this mutamer.
    await request(http)
      .post(`/passengers/${passengerId}/visa-transition`)
      .set(auth(opsTok))
      .send({ to: "BIOMETRIC", biometricStatus: "Registered" })
      .expect(201);
    await request(http)
      .post(`/passengers/${passengerId}/visa-transition`)
      .set(auth(opsTok))
      .send({ to: "SUBMITTED" })
      .expect(201);
    await request(http)
      .post(`/passengers/${passengerId}/visa-transition`)
      .set(auth(opsTok))
      .send({ to: "PROCESSING" })
      .expect(201);
    await request(http)
      .post(`/passengers/${passengerId}/visa-transition`)
      .set(auth(opsTok))
      .send({ to: "ISSUED", visaNumber: "V-MOFA-06" })
      .expect(201);

    const desk = await request(http)
      .get("/ops/visa/mutamers")
      .query({ groupId })
      .set(auth(opsTok))
      .expect(200);
    expect(desk.body.mofaCompleteness).toBeDefined();
    expect(desk.body.mofaCompleteness.issuedTotal).toBeGreaterThanOrEqual(1);
    expect(desk.body.mofaCompleteness.issuedWithMofa).toBeGreaterThanOrEqual(1);
    expect(String(desk.body.mofaCompleteness.note)).toMatch(/Separate from MOFA Processing Bill/i);
  });

  it("MOFA Processing Bill create + sign (≠ MOFA Number)", async () => {
    const status = await request(http)
      .get("/finance/mofa-processing-bills/status")
      .set(auth(finTok))
      .expect(200);
    expect(status.body.enabled).toBe(true);

    const created = await request(http)
      .post("/finance/mofa-processing-bills")
      .set(auth(finTok))
      .send({ tenantId, groupId, qty: 10, rate: 50 })
      .expect(201);

    expect(created.body.kind).toBe("MOFA_PROCESSING");
    expect(created.body.total).toBeGreaterThan(0);
    expect(String(created.body.notes ?? "")).toMatch(/Not mutamer MOFA Number/i);

    const signed = await request(http)
      .patch(`/finance/mofa-processing-bills/${created.body.id}/sign`)
      .set(auth(finTok))
      .send({ approvalSign: "Finance Controller T002-06" })
      .expect(200);
    expect(signed.body.approvalSign).toBe("Finance Controller T002-06");
    expect(signed.body.crDate).toBeTruthy();

    const billAudit = await prisma.auditLog.findFirst({
      where: { entityId: created.body.id, module: "MofaProcessingBill", action: "APPROVE" },
      orderBy: { createdAt: "desc" },
    });
    expect(billAudit).toBeTruthy();
  });
});
