// T001-01 — Group Nusuk identity & HAJJ (e2e)
// Covers: HAJJ visa type, Nusuk uniqueness, additive fields, audit, tenancy,
// WhatsApp flag (REQUIRE_HAJI_WHATSAPP), backward-compatible create without new fields.

import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { setupApp } from "../src/setup-app";
import { PrismaService } from "../src/prisma/prisma.service";

const AGENT = { email: "ahmad@rashidi-travel.com", password: "Demo@123" };
const OPS = { email: "ops@tubalhijaz.com", password: "Demo@123" };
const OTHER_AGENT = { email: "office@alnoor-pilgrim.com", password: "Demo@123" };

describe("T001-01 Group Nusuk identity & HAJJ (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<INestApplication["getHttpServer"]>;
  let agentTok: string;
  let opsTok: string;
  let otherTok: string;
  let rashidiId: string;
  const createdIds: string[] = [];

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
    [agentTok, opsTok, otherTok] = await Promise.all([login(AGENT), login(OPS), login(OTHER_AGENT)]);
    const rashidi = await prisma.company.findFirstOrThrow({ where: { code: "AGT-1446-4827" } });
    rashidiId = rashidi.id;
  });

  afterAll(async () => {
    if (createdIds.length) {
      await prisma.auditLog.deleteMany({
        where: { entityType: "Group", entityId: { in: createdIds } },
      });
      await prisma.group.deleteMany({ where: { id: { in: createdIds } } });
    }
    delete process.env.REQUIRE_HAJI_WHATSAPP;
    await app.close();
  });

  it("legacy create without Nusuk fields still works (backward compatible)", async () => {
    const res = await request(http)
      .post("/groups")
      .set(auth(agentTok))
      .send({
        name: "T001 Legacy Compat",
        destination: "MAKKAH",
        visaType: "UMRAH",
      })
      .expect(201);
    createdIds.push(res.body.id);
    expect(res.body.code).toMatch(/^GRP-/);
    expect(res.body.visaType).toBe("UMRAH");
    expect(res.body.nusukGroupNumber).toBeNull();
    expect(res.body.uploadedByUserId).toBeTruthy();
  });

  it("creates HAJJ group with Nusuk spine fields and writes CREATE audit", async () => {
    const nusuk = `NUSUK-T001-${Date.now()}`;
    const res = await request(http)
      .post("/groups")
      .set(auth(agentTok))
      .send({
        name: "T001 Hajj Spine",
        destination: "MAKKAH_MADINAH",
        visaType: "HAJJ",
        packageType: "PREMIUM",
        nusukGroupNumber: nusuk,
        hajiWhatsapp: "+966501112233",
        consulate: "Dhaka",
        servicesValue: 12500.5,
        uploadedByLabel: "Rashidi Ops Desk",
      })
      .expect(201);
    createdIds.push(res.body.id);
    expect(res.body.visaType).toBe("HAJJ");
    expect(res.body.nusukGroupNumber).toBe(nusuk);
    expect(res.body.hajiWhatsapp).toBe("+966501112233");
    expect(res.body.consulate).toBe("Dhaka");
    expect(Number(res.body.servicesValue)).toBeCloseTo(12500.5);
    expect(res.body.uploadedByLabel).toBe("Rashidi Ops Desk");
    expect(res.body.uploadedByUser).toBeTruthy();

    const got = await request(http).get(`/groups/${res.body.id}`).set(auth(agentTok)).expect(200);
    expect(got.body.nusukGroupNumber).toBe(nusuk);

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: "Group", entityId: res.body.id, action: "CREATE", module: "Groups" },
      orderBy: { createdAt: "desc" },
    });
    expect(audit).toBeTruthy();
    expect(audit!.actorUserId).toBeTruthy();
    expect((audit!.after as { nusukGroupNumber?: string })?.nusukGroupNumber).toBe(nusuk);
  });

  it("rejects duplicate Nusuk group number with 409", async () => {
    const nusuk = `NUSUK-DUP-${Date.now()}`;
    const first = await request(http)
      .post("/groups")
      .set(auth(agentTok))
      .send({
        name: "T001 Dup A",
        destination: "MAKKAH",
        visaType: "UMRAH",
        nusukGroupNumber: nusuk,
        hajiWhatsapp: "+8801711000001",
      })
      .expect(201);
    createdIds.push(first.body.id);

    await request(http)
      .post("/groups")
      .set(auth(agentTok))
      .send({
        name: "T001 Dup B",
        destination: "MAKKAH",
        visaType: "UMRAH",
        nusukGroupNumber: nusuk,
        hajiWhatsapp: "+8801711000002",
      })
      .expect(409);
  });

  it("staff can create HAJJ for a named tenant; agent cannot create for another company", async () => {
    const nusuk = `NUSUK-STAFF-${Date.now()}`;
    const staff = await request(http)
      .post("/groups")
      .set(auth(opsTok))
      .send({
        name: "T001 Staff Hajj",
        destination: "MAKKAH",
        visaType: "HAJJ",
        tenantId: rashidiId,
        nusukGroupNumber: nusuk,
        hajiWhatsapp: "+966509998877",
      })
      .expect(201);
    createdIds.push(staff.body.id);
    expect(staff.body.tenantId).toBe(rashidiId);

    await request(http)
      .post("/groups")
      .set(auth(otherTok))
      .send({
        name: "T001 Cross Tenant",
        destination: "MAKKAH",
        visaType: "UMRAH",
        tenantId: rashidiId,
      })
      .expect(403);
  });

  it("PATCH updates spine fields and writes UPDATE audit", async () => {
    const created = await request(http)
      .post("/groups")
      .set(auth(agentTok))
      .send({
        name: "T001 Patch Base",
        destination: "MADINAH",
        visaType: "LONG_STAY",
      })
      .expect(201);
    createdIds.push(created.body.id);

    const nusuk = `NUSUK-PATCH-${Date.now()}`;
    const patched = await request(http)
      .patch(`/groups/${created.body.id}`)
      .set(auth(agentTok))
      .send({
        visaType: "HAJJ",
        nusukGroupNumber: nusuk,
        hajiWhatsapp: "+966500001111",
        consulate: "Chittagong",
      })
      .expect(200);
    expect(patched.body.visaType).toBe("HAJJ");
    expect(patched.body.nusukGroupNumber).toBe(nusuk);

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: "Group", entityId: created.body.id, action: "UPDATE", module: "Groups" },
      orderBy: { createdAt: "desc" },
    });
    expect(audit).toBeTruthy();
  });

  it("REQUIRE_HAJI_WHATSAPP=true rejects HAJJ/UMRAH without WhatsApp; LONG_STAY still ok", async () => {
    process.env.REQUIRE_HAJI_WHATSAPP = "true";
    try {
      await request(http)
        .post("/groups")
        .set(auth(agentTok))
        .send({
          name: "T001 Flag Hajj Missing WA",
          destination: "MAKKAH",
          visaType: "HAJJ",
        })
        .expect(400);

      await request(http)
        .post("/groups")
        .set(auth(agentTok))
        .send({
          name: "T001 Flag Umrah Missing WA",
          destination: "MAKKAH",
          visaType: "UMRAH",
        })
        .expect(400);

      const ok = await request(http)
        .post("/groups")
        .set(auth(agentTok))
        .send({
          name: "T001 Flag Long Stay",
          destination: "MAKKAH",
          visaType: "LONG_STAY",
        })
        .expect(201);
      createdIds.push(ok.body.id);

      const withWa = await request(http)
        .post("/groups")
        .set(auth(agentTok))
        .send({
          name: "T001 Flag Hajj With WA",
          destination: "MAKKAH",
          visaType: "HAJJ",
          hajiWhatsapp: "+966511122233",
        })
        .expect(201);
      createdIds.push(withWa.body.id);
    } finally {
      delete process.env.REQUIRE_HAJI_WHATSAPP;
    }
  });

  it("agent cannot read another agent's group (tenancy / RBAC)", async () => {
    const mine = await request(http)
      .post("/groups")
      .set(auth(agentTok))
      .send({
        name: "T001 Tenant Isolation",
        destination: "MAKKAH",
        visaType: "UMRAH",
        nusukGroupNumber: `NUSUK-ISO-${Date.now()}`,
      })
      .expect(201);
    createdIds.push(mine.body.id);

    await request(http).get(`/groups/${mine.body.id}`).set(auth(otherTok)).expect(404);
  });
});
