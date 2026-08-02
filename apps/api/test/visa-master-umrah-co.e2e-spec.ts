// T002-01 — Visa Master & Umrah Co linkage (e2e)
// Covers: HAJJ on POST /services/visa; embassy activation; umrahCompanyId on
// Group + VisaRequest; catalogue GET /services/umrah-companies; rejection of
// non-UMRAH_COMPANY suppliers; inherit from Group when omitted on visa create.

import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { setupApp } from "../src/setup-app";
import { PrismaService } from "../src/prisma/prisma.service";

const AGENT = { email: "ahmad@rashidi-travel.com", password: "Demo@123" };
const OPS = { email: "ops@tubalhijaz.com", password: "Demo@123" };

describe("T002-01 Visa Master & Umrah Co (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<INestApplication["getHttpServer"]>;
  let agentTok: string;
  let opsTok: string;
  let umrahCoId: string;
  let hotelSupId: string;
  const groupIds: string[] = [];
  const visaIds: string[] = [];

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

    const umrahCo = await prisma.company.findFirst({
      where: { supplierProfile: { type: "UMRAH_COMPANY" } },
    });
    if (!umrahCo) {
      // Seed may not have been re-run; create a minimal Umrah Co for this suite.
      const created = await prisma.company.create({
        data: {
          code: `SUP-UMR-T002-${Date.now().toString().slice(-4)}`,
          type: "SUPPLIER",
          name: "T002 Test Umrah Co",
          verificationStatus: "VERIFIED",
          supplierProfile: { create: { type: "UMRAH_COMPANY" } },
        },
      });
      umrahCoId = created.id;
    } else {
      umrahCoId = umrahCo.id;
    }

    const hotel = await prisma.company.findFirstOrThrow({
      where: { supplierProfile: { type: "HOTEL" } },
    });
    hotelSupId = hotel.id;
  });

  afterAll(async () => {
    if (visaIds.length) {
      await prisma.auditLog.deleteMany({
        where: { entityType: "VisaRequest", entityId: { in: visaIds } },
      });
      await prisma.visaRequest.deleteMany({ where: { id: { in: visaIds } } });
    }
    if (groupIds.length) {
      await prisma.auditLog.deleteMany({
        where: { entityType: "Group", entityId: { in: groupIds } },
      });
      await prisma.group.deleteMany({ where: { id: { in: groupIds } } });
    }
    await app.close();
  });

  it("GET /services/umrah-companies lists verified UMRAH_COMPANY suppliers", async () => {
    const res = await request(http)
      .get("/services/umrah-companies")
      .set(auth(agentTok))
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((c: { id: string }) => c.id === umrahCoId)).toBe(true);
    expect(res.body.every((c: { id: string }) => c.id !== hotelSupId)).toBe(true);
  });

  it("creates Group with umrahCompanyId and writes CREATE audit", async () => {
    const res = await request(http)
      .post("/groups")
      .set(auth(agentTok))
      .send({
        name: "T002-01 Umrah Co Group",
        destination: "MAKKAH",
        visaType: "UMRAH",
        umrahCompanyId: umrahCoId,
        consulate: "Dhaka",
      })
      .expect(201);
    groupIds.push(res.body.id);
    expect(res.body.umrahCompanyId).toBe(umrahCoId);
    expect(res.body.umrahCompany?.id).toBe(umrahCoId);

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: "Group", entityId: res.body.id, action: "CREATE" },
      orderBy: { createdAt: "desc" },
    });
    expect(audit).toBeTruthy();
    expect((audit?.after as { umrahCompanyId?: string })?.umrahCompanyId).toBe(umrahCoId);
  });

  it("rejects Group umrahCompanyId that is not UMRAH_COMPANY", async () => {
    await request(http)
      .post("/groups")
      .set(auth(agentTok))
      .send({
        name: "T002-01 Bad Umrah Co",
        destination: "MAKKAH",
        visaType: "UMRAH",
        umrahCompanyId: hotelSupId,
      })
      .expect(400);
  });

  it("POST /services/visa accepts HAJJ + embassy + umrahCompanyId", async () => {
    const g = await request(http)
      .post("/groups")
      .set(auth(agentTok))
      .send({
        name: "T002-01 Hajj Visa Batch",
        destination: "MAKKAH_MADINAH",
        visaType: "HAJJ",
        hajiWhatsapp: "+8801711000001",
        consulate: "Dhaka Consulate",
      })
      .expect(201);
    groupIds.push(g.body.id);

    const res = await request(http)
      .post("/services/visa")
      .set(auth(agentTok))
      .send({
        groupId: g.body.id,
        visaType: "HAJJ",
        embassy: "Saudi Embassy Dhaka",
        umrahCompanyId: umrahCoId,
        mohCategory: "A",
        nusukRef: "NK-T002-01",
      })
      .expect(201);
    visaIds.push(res.body.id);
    expect(res.body.visaType).toBe("HAJJ");
    expect(res.body.embassy).toBe("Saudi Embassy Dhaka");
    expect(res.body.umrahCompanyId).toBe(umrahCoId);

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: "VisaRequest", entityId: res.body.id, action: "CREATE" },
      orderBy: { createdAt: "desc" },
    });
    expect(audit).toBeTruthy();
    expect((audit?.after as { visaType?: string })?.visaType).toBe("HAJJ");
  });

  it("inherits umrahCompanyId and embassy from Group when omitted on visa create", async () => {
    const g = await request(http)
      .post("/groups")
      .set(auth(agentTok))
      .send({
        name: "T002-01 Inherit Co",
        destination: "MAKKAH",
        visaType: "UMRAH",
        umrahCompanyId: umrahCoId,
        consulate: "Inherited Consulate",
      })
      .expect(201);
    groupIds.push(g.body.id);

    const res = await request(http)
      .post("/services/visa")
      .set(auth(agentTok))
      .send({
        groupId: g.body.id,
        visaType: "UMRAH",
        mohCategory: "B",
      })
      .expect(201);
    visaIds.push(res.body.id);
    expect(res.body.umrahCompanyId).toBe(umrahCoId);
    expect(res.body.embassy).toBe("Inherited Consulate");
  });

  it("PATCH /groups clears umrahCompanyId with null", async () => {
    const g = await request(http)
      .post("/groups")
      .set(auth(agentTok))
      .send({
        name: "T002-01 Clear Co",
        destination: "MAKKAH",
        visaType: "UMRAH",
        umrahCompanyId: umrahCoId,
      })
      .expect(201);
    groupIds.push(g.body.id);

    const patched = await request(http)
      .patch(`/groups/${g.body.id}`)
      .set(auth(agentTok))
      .send({ umrahCompanyId: null })
      .expect(200);
    expect(patched.body.umrahCompanyId).toBeNull();
  });

  it("ops Group Master projection includes umrahCompanyId", async () => {
    const res = await request(http).get("/ops/groups").set(auth(opsTok)).expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    // Additive field present on rows (may be null for legacy groups).
    expect(res.body.length).toBeGreaterThan(0);
    expect("umrahCompanyId" in res.body[0]).toBe(true);
  });
});
