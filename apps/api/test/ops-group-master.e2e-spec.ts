// T001-09 — Ops Group Master board projection + staff gate toggle (e2e)

import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { setupApp } from "../src/setup-app";
import { PrismaService } from "../src/prisma/prisma.service";

const PW = "Demo@123";
const OPS = { email: "ops@tubalhijaz.com", password: PW };
const AGENT = { email: "ahmad@rashidi-travel.com", password: PW };

describe("T001-09 Ops Group Master (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<INestApplication["getHttpServer"]>;
  let opsTok: string;
  let agentTok: string;
  const cleanupIds: string[] = [];

  const login = async (c: { email: string; password: string }) =>
    (await request(http).post("/auth/login").send(c).expect(200)).body.accessToken as string;
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    setupApp(app);
    await app.init();
    http = app.getHttpServer();
    prisma = app.get(PrismaService);
    [opsTok, agentTok] = await Promise.all([login(OPS), login(AGENT)]);
  });

  afterAll(async () => {
    for (const id of cleanupIds) {
      await prisma.passenger.deleteMany({ where: { groupId: id } }).catch(() => undefined);
      await prisma.group.delete({ where: { id } }).catch(() => undefined);
    }
    await app.close();
  });

  it("GET /ops/groups projects name + foundation + four gates", async () => {
    const created = await request(http)
      .post("/groups")
      .set(auth(agentTok))
      .send({
        name: `Ops Master Board ${Date.now()}`,
        destination: "MAKKAH_MADINAH",
        visaType: "UMRAH",
        packageType: "STANDARD",
        maxCapacity: 40,
        paxCount: 12,
        hajiWhatsapp: "+8801700000099",
        nusukGroupNumber: `NUSUK-T09-${Date.now()}`,
        gateVisa: false,
        gatePackage: true,
        gatePayment: false,
        gateBill: false,
      })
      .expect(201);
    cleanupIds.push(created.body.id);

    const res = await request(http).get("/ops/groups").set(auth(opsTok)).expect(200);
    const row = res.body.find((g: { id: string }) => g.id === created.body.id);
    expect(row).toBeTruthy();
    expect(row.name).toBe(created.body.name);
    expect(row.nusukGroupNumber).toBe(created.body.nusukGroupNumber);
    expect(row.agent).toBeTruthy();
    expect(row.pax).toBe(12);
    expect(row.visaType).toBe("UMRAH");
    expect(row.packageType).toBe("STANDARD");
    expect(row.hajiWhatsapp).toContain("880");
    expect(typeof row.uploadedByLabel === "string" || row.uploadedByLabel === null).toBe(true);
    expect(row.gateVisa).toBe(false);
    expect(row.gatePackage).toBe(true);
    expect(row.gatePayment).toBe(false);
    expect(row.gateBill).toBe(false);
  });

  it("Staff toggles readiness gates via PATCH /groups/:id (board contract)", async () => {
    const created = await request(http)
      .post("/groups")
      .set(auth(agentTok))
      .send({
        name: `Gate Toggle ${Date.now()}`,
        destination: "MAKKAH_MADINAH",
        visaType: "HAJJ",
        packageType: "PREMIUM",
        maxCapacity: 40,
        hajiWhatsapp: "+8801700000098",
      })
      .expect(201);
    cleanupIds.push(created.body.id);

    await request(http)
      .patch(`/groups/${created.body.id}`)
      .set(auth(opsTok))
      .send({ gateVisa: true })
      .expect(200);

    await request(http)
      .patch(`/groups/${created.body.id}`)
      .set(auth(opsTok))
      .send({ gatePayment: true, gateBill: true })
      .expect(200);

    const row = await prisma.group.findUniqueOrThrow({ where: { id: created.body.id } });
    expect(row.gateVisa).toBe(true);
    expect(row.gatePayment).toBe(true);
    expect(row.gateBill).toBe(true);

    const audit = await prisma.auditLog.findFirst({
      where: { module: "Groups", entityId: created.body.id, action: "UPDATE" },
      orderBy: { createdAt: "desc" },
    });
    expect(audit).toBeTruthy();
  });

  it("Agent cannot list Ops Group Master (RBAC regression)", async () => {
    await request(http).get("/ops/groups").set(auth(agentTok)).expect(403);
  });
});
