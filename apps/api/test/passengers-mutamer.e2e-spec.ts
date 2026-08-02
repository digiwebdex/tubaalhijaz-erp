// T001-04 — Passenger Mutamer foundation fields (e2e)
// Covers: additive fields on create/bulk/patch, visaStatusLabel mapping,
// backward-compatible legacy payload, duplicate passport guard, audit, tenancy.

import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { setupApp } from "../src/setup-app";
import { PrismaService } from "../src/prisma/prisma.service";
import {
  MUTAMER_EXCEL_COLUMNS,
  mapVisaStatusEnumToLabel,
  mapVisaStatusLabelToEnum,
} from "../src/groups/mutamer-excel.contract";

const AGENT = { email: "ahmad@rashidi-travel.com", password: "Demo@123" };
const OTHER = { email: "office@alnoor-pilgrim.com", password: "Demo@123" };

describe("T001-04 Passenger Mutamer foundation (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<INestApplication["getHttpServer"]>;
  let agentTok: string;
  let otherTok: string;
  let groupId: string;
  const passengerIds: string[] = [];

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
    [agentTok, otherTok] = await Promise.all([login(AGENT), login(OTHER)]);

    const g = await request(http)
      .post("/groups")
      .set(auth(agentTok))
      .send({
        name: "T001-04 Mutamer Host",
        destination: "MAKKAH",
        visaType: "UMRAH",
        maxCapacity: 40,
      })
      .expect(201);
    groupId = g.body.id;
  });

  afterAll(async () => {
    if (passengerIds.length) {
      await prisma.auditLog.deleteMany({
        where: { entityType: "Passenger", entityId: { in: passengerIds } },
      });
      await prisma.passenger.deleteMany({ where: { id: { in: passengerIds } } });
    }
    if (groupId) {
      await prisma.auditLog.deleteMany({
        where: { OR: [{ entityId: groupId }, { entityType: "Group", entityId: groupId }] },
      });
      await prisma.group.delete({ where: { id: groupId } }).catch(() => undefined);
    }
    await app.close();
  });

  it("excel contract metadata covers Mutamer / Main EA / Sub EA / MOFA columns", () => {
    const fields = new Set(MUTAMER_EXCEL_COLUMNS.map((c) => c.apiField));
    for (const f of ["name", "age", "passportNo", "mainEaCode", "subEaCode", "mofaNumber", "biometricStatus", "mutamerType", "visaStatusLabel"]) {
      expect(fields.has(f as never)).toBe(true);
    }
    expect(mapVisaStatusLabelToEnum("Visa Not Issued")).toBe("PENDING");
    expect(mapVisaStatusLabelToEnum("Visa Issued")).toBe("APPROVED");
    expect(mapVisaStatusEnumToLabel("PENDING")).toBe("Visa Not Issued");
  });

  it("legacy create without Mutamer fields still works (backward compatible)", async () => {
    const res = await request(http)
      .post(`/groups/${groupId}/passengers`)
      .set(auth(agentTok))
      .send({
        name: "Legacy Mutamer",
        passportNo: `LEG${Date.now()}`,
        nationality: "Bangladesh",
        gender: "MALE",
      })
      .expect(201);
    passengerIds.push(res.body.id);
    expect(res.body.age).toBeNull();
    expect(res.body.mainEaCode).toBeNull();
    expect(res.body.visaStatus).toBe("PENDING");
  });

  it("creates Mutamer with Excel foundation fields + maps visaStatusLabel → enum + audit", async () => {
    const passport = `MUT${Date.now()}`;
    const res = await request(http)
      .post(`/groups/${groupId}/passengers`)
      .set(auth(agentTok))
      .send({
        name: "Karim Mutamer",
        passportNo: passport,
        nationality: "Bangladesh",
        gender: "MALE",
        age: 42,
        mainEaCode: "1004492",
        mainEaName: "Tuba Al Hijaz",
        subEaCode: "SUB-01",
        subEaName: "Bengal United",
        biometricStatus: "Registered",
        visaNumber: "V-99881",
        mofaNumber: "MOFA-4411",
        mutamerType: "B2B",
        visaStatusLabel: "Visa Not Issued",
      })
      .expect(201);
    passengerIds.push(res.body.id);
    expect(res.body.age).toBe(42);
    expect(res.body.mainEaCode).toBe("1004492");
    expect(res.body.subEaName).toBe("Bengal United");
    expect(res.body.biometricStatus).toBe("Registered");
    expect(res.body.mofaNumber).toBe("MOFA-4411");
    expect(res.body.mutamerType).toBe("B2B");
    expect(res.body.visaStatusLabel).toBe("Visa Not Issued");
    expect(res.body.visaStatus).toBe("PENDING");

    const list = await request(http).get(`/groups/${groupId}/passengers`).set(auth(agentTok)).expect(200);
    const row = list.body.find((p: { id: string }) => p.id === res.body.id);
    expect(row.mofaNumber).toBe("MOFA-4411");

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: "Passenger", entityId: res.body.id, action: "CREATE", module: "Passengers" },
    });
    expect(audit).toBeTruthy();
  });

  it("bulk accepts Mutamer fields; duplicate passport still rejected", async () => {
    const base = Date.now();
    const bulk = await request(http)
      .post(`/groups/${groupId}/passengers/bulk`)
      .set(auth(agentTok))
      .send({
        passengers: [
          {
            name: "Bulk One",
            passportNo: `B1${base}`,
            nationality: "Bangladesh",
            gender: "FEMALE",
            age: 30,
            mofaNumber: "M1",
            visaStatusLabel: "Visa Issued",
          },
          {
            name: "Bulk Two",
            passportNo: `B2${base}`,
            nationality: "Bangladesh",
            gender: "MALE",
            subEaCode: "SUB-9",
          },
        ],
      })
      .expect(201);
    const rows = Array.isArray(bulk.body) ? bulk.body : [bulk.body];
    rows.forEach((r: { id: string }) => passengerIds.push(r.id));
    const issued = rows.find((r: { name: string }) => r.name === "Bulk One");
    expect(issued.visaStatus).toBe("APPROVED");
    expect(issued.visaStatusLabel).toBe("Visa Issued");

    await request(http)
      .post(`/groups/${groupId}/passengers`)
      .set(auth(agentTok))
      .send({
        name: "Dup",
        passportNo: `B1${base}`,
        nationality: "Bangladesh",
        gender: "MALE",
      })
      .expect(400);
  });

  it("PATCH updates Mutamer fields and syncs label → enum", async () => {
    const created = await request(http)
      .post(`/groups/${groupId}/passengers`)
      .set(auth(agentTok))
      .send({
        name: "Patch Target",
        passportNo: `PAT${Date.now()}`,
        nationality: "Bangladesh",
        gender: "MALE",
      })
      .expect(201);
    passengerIds.push(created.body.id);

    const patched = await request(http)
      .patch(`/passengers/${created.body.id}`)
      .set(auth(agentTok))
      .send({
        age: 55,
        biometricStatus: "Completed",
        visaStatusLabel: "Visa Issued",
        mutamerType: "B2B",
      })
      .expect(200);
    expect(patched.body.age).toBe(55);
    expect(patched.body.biometricStatus).toBe("Completed");
    expect(patched.body.visaStatus).toBe("APPROVED");

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: "Passenger", entityId: created.body.id, action: "UPDATE" },
    });
    expect(audit).toBeTruthy();
  });

  it("other agent cannot list or write into the group (tenancy)", async () => {
    await request(http).get(`/groups/${groupId}/passengers`).set(auth(otherTok)).expect(404);
    await request(http)
      .post(`/groups/${groupId}/passengers`)
      .set(auth(otherTok))
      .send({
        name: "Intruder",
        passportNo: `X${Date.now()}`,
        nationality: "Bangladesh",
        gender: "MALE",
      })
      .expect(404);
  });
});
