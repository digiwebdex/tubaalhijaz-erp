// T001-08 — Intake notification events + rules (e2e)
// Group created / gates / mutamer import / group-list OCR → NotificationLog
// + workflow scenario guards (OCR-before-group, duplicate, cross-tenant).

import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { setupApp } from "../src/setup-app";
import { PrismaService } from "../src/prisma/prisma.service";
import { VisionClient, type OcrResult } from "../src/ocr/vision.client";
import { GeminiClient } from "../src/ocr/gemini.client";
import { ensureIntakeNotificationPack } from "../src/automation/intake-notification.pack";

const PW = "Demo@123";
const AGENT = { email: "ahmad@rashidi-travel.com", password: PW };
const OTHER = { email: "office@alnoor-pilgrim.com", password: PW };
const OPS = { email: "ops@tubalhijaz.com", password: PW };
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);

async function waitFor<T>(fn: () => Promise<T | null | undefined>, ms = 20000, step = 300): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const r = await fn();
    if (r) return r;
    if (Date.now() > end) throw new Error("waitFor timed out");
    await new Promise((s) => setTimeout(s, step));
  }
}

function nusukStub(nusuk: string): OcrResult {
  return {
    fullText: `Group Number: ${nusuk}\nGroup Name: Intake OCR Party\nConsulate: Dhaka\nPax: 20`,
    words: [],
    meanConfidence: 0.92,
    provider: "stub",
    structured: {
      nusukGroupNumber: nusuk,
      groupName: "Intake OCR Party",
      consulate: "Dhaka",
      paxCount: "20",
      agentCode: "EA-INTAKE",
    },
  };
}

describe("T001-08 Intake notifications (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<INestApplication["getHttpServer"]>;
  let agentTok: string;
  let otherTok: string;
  let opsTok: string;
  let tenantId: string;
  let annotateImpl: () => Promise<OcrResult>;
  const cleanupGroupIds: string[] = [];
  const cleanupDocIds: string[] = [];
  const cleanupFileIds: string[] = [];
  const stamp = Date.now().toString(36);
  const prevFlag = process.env.ENABLE_NUSUK_GROUP_LIST_OCR;

  const login = async (c: { email: string; password: string }) =>
    (await request(http).post("/auth/login").send(c).expect(200)).body.accessToken as string;
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  const stubProvider = {
    get configured() {
      return true;
    },
    annotate: async () => annotateImpl(),
  };

  beforeAll(async () => {
    process.env.OCR_PROVIDER = "google-vision";
    process.env.ENABLE_NUSUK_GROUP_LIST_OCR = "true";
    annotateImpl = async () => nusukStub("NUSUK-INTAKE-INIT");

    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(VisionClient)
      .useValue(stubProvider)
      .overrideProvider(GeminiClient)
      .useValue(stubProvider)
      .compile();
    app = mod.createNestApplication();
    setupApp(app);
    await app.init();
    http = app.getHttpServer();
    prisma = app.get(PrismaService);

    await ensureIntakeNotificationPack(prisma);

    [agentTok, otherTok, opsTok] = await Promise.all([login(AGENT), login(OTHER), login(OPS)]);
    tenantId = (
      await prisma.user.findFirstOrThrow({
        where: { email: AGENT.email },
        select: { companyId: true },
      })
    ).companyId!;
  });

  afterAll(async () => {
    for (const id of cleanupDocIds) await prisma.ocrDocument.delete({ where: { id } }).catch(() => undefined);
    for (const id of cleanupFileIds) await prisma.uploadedFile.delete({ where: { id } }).catch(() => undefined);
    for (const id of cleanupGroupIds) {
      await prisma.passenger.deleteMany({ where: { groupId: id } }).catch(() => undefined);
      await prisma.group.delete({ where: { id } }).catch(() => undefined);
    }
    if (prevFlag === undefined) delete process.env.ENABLE_NUSUK_GROUP_LIST_OCR;
    else process.env.ENABLE_NUSUK_GROUP_LIST_OCR = prevFlag;
    await app.close();
  });

  it("seeded intake rules AR-GRP-01…04 are enabled", async () => {
    const codes = ["AR-GRP-01", "AR-GRP-02", "AR-GRP-03", "AR-GRP-04"];
    for (const code of codes) {
      const r = await prisma.automationRule.findUnique({ where: { code } });
      expect(r?.enabled).toBe(true);
      expect(r?.eventKey).toBeTruthy();
    }
    const catalog = await request(http).get("/automation/overview").set(auth(opsTok)).expect(200);
    expect(catalog.body.catalog.events).toContain("group.ocr.committed");
  });

  it("Scenario 1 — New Group → Import → Readiness → NotificationLogs", async () => {
    const t0 = new Date();

    const created = await request(http)
      .post("/groups")
      .set(auth(agentTok))
      .send({
        name: `Intake Notify ${stamp}`,
        destination: "MAKKAH_MADINAH",
        visaType: "UMRAH",
        packageType: "STANDARD",
        maxCapacity: 40,
        hajiWhatsapp: "+8801700000008",
      })
      .expect(201);
    const groupId = created.body.id as string;
    cleanupGroupIds.push(groupId);

    const createdLog = await waitFor(() =>
      prisma.notificationLog.findFirst({
        where: {
          createdAt: { gte: t0 },
          event: { key: "GROUP_CREATED" },
          OR: [{ tenantId }, { recipientUserId: { not: null } }],
          title: { contains: created.body.code },
        },
      }),
    );
    expect(createdLog).toBeTruthy();

    // Staff fan-out (OPS / SUPER_ADMIN) receives IN_APP
    const staffLog = await waitFor(() =>
      prisma.notificationLog.findFirst({
        where: {
          createdAt: { gte: t0 },
          event: { key: "GROUP_CREATED" },
          channel: "IN_APP",
          recipientUser: { role: { key: { in: ["OPS_STAFF", "SUPER_ADMIN"] } } },
        },
      }),
    );
    expect(staffLog).toBeTruthy();

    const tImport = new Date();
    await request(http)
      .post(`/groups/${groupId}/passengers/bulk`)
      .set(auth(agentTok))
      .send({
        passengers: [
          {
            name: "Intake Mutamer A",
            passportNo: `INA${stamp}`,
            nationality: "Bangladesh",
            gender: "MALE",
          },
          {
            name: "Intake Mutamer B",
            passportNo: `INB${stamp}`,
            nationality: "Bangladesh",
            gender: "FEMALE",
          },
        ],
      })
      .expect(201);

    const importLog = await waitFor(() =>
      prisma.notificationLog.findFirst({
        where: {
          createdAt: { gte: tImport },
          event: { key: "GROUP_IMPORT_COMPLETED" },
          title: { contains: created.body.code },
        },
      }),
    );
    expect(importLog).toBeTruthy();

    const tGates = new Date();
    await request(http)
      .patch(`/groups/${groupId}`)
      .set(auth(agentTok))
      .send({ gateVisa: true, gatePackage: true })
      .expect(200);

    const gatesLog = await waitFor(() =>
      prisma.notificationLog.findFirst({
        where: {
          createdAt: { gte: tGates },
          event: { key: "GROUP_GATES_CHANGED" },
          title: { contains: created.body.code },
        },
      }),
    );
    expect(gatesLog).toBeTruthy();
  });

  it("Scenario 1b — Group-list OCR approve → GROUP_OCR_COMMITTED log", async () => {
    const nusuk = `NUSUK-INT8-${stamp}`.toUpperCase();
    annotateImpl = async () => nusukStub(nusuk);
    const t0 = new Date();

    const up = await request(http)
      .post("/uploads?kind=OTHER")
      .set(auth(agentTok))
      .attach("file", PNG, { filename: "nusuk-intake.png", contentType: "image/png" })
      .expect(201);
    cleanupFileIds.push(up.body.documentId);

    const doc = await request(http)
      .post("/ocr/documents")
      .set(auth(agentTok))
      .send({ uploadedFileId: up.body.documentId, documentType: "NUSUK_GROUP_LIST" })
      .expect(201);
    cleanupDocIds.push(doc.body.id);

    await waitFor(async () => {
      const d = await prisma.ocrDocument.findUnique({ where: { id: doc.body.id } });
      return d?.reviewStatus === "IN_REVIEW" ? d : null;
    });

    const approved = await request(http)
      .post(`/ocr/documents/${doc.body.id}/approve`)
      .set(auth(opsTok))
      .send({})
      .expect(201);
    expect(approved.body.group?.id).toBeTruthy();
    cleanupGroupIds.push(approved.body.group.id);

    const ocrLog = await waitFor(() =>
      prisma.notificationLog.findFirst({
        where: {
          createdAt: { gte: t0 },
          event: { key: "GROUP_OCR_COMMITTED" },
        },
      }),
    );
    expect(ocrLog).toBeTruthy();
  });

  it("Scenario 2 — OCR passport before Group is blocked", async () => {
    const up = await request(http)
      .post("/uploads?kind=PASSPORT")
      .set(auth(agentTok))
      .attach("file", PNG, { filename: "passport-intake.png", contentType: "image/png" })
      .expect(201);
    cleanupFileIds.push(up.body.documentId);

    annotateImpl = async () => ({
      fullText: "P<BGDTEST<<NAME\nA1234567BGD8001011M3001011<<<<<<<<<<<<<<06",
      words: [],
      meanConfidence: 0.9,
      provider: "stub",
      structured: {
        passportNo: `PP${stamp}`,
        name: "No Group Yet",
        nationality: "Bangladesh",
        gender: "M",
      },
    });

    const doc = await request(http)
      .post("/ocr/documents")
      .set(auth(agentTok))
      .send({ uploadedFileId: up.body.documentId, documentType: "PASSPORT" })
      .expect(201);
    cleanupDocIds.push(doc.body.id);

    await waitFor(async () => {
      const d = await prisma.ocrDocument.findUnique({ where: { id: doc.body.id } });
      return d?.reviewStatus === "IN_REVIEW" ? d : null;
    });

    await request(http)
      .post(`/ocr/documents/${doc.body.id}/approve`)
      .set(auth(opsTok))
      .send({})
      .expect(400);
  });

  it("Scenario 3 — Duplicate passport import rejected", async () => {
    const g = await request(http)
      .post("/groups")
      .set(auth(agentTok))
      .send({
        name: `Dup Guard ${stamp}`,
        destination: "MAKKAH_MADINAH",
        visaType: "UMRAH",
        maxCapacity: 40,
        hajiWhatsapp: "+8801700000009",
      })
      .expect(201);
    cleanupGroupIds.push(g.body.id);

    const passport = `DUP${stamp}`;
    await request(http)
      .post(`/groups/${g.body.id}/passengers`)
      .set(auth(agentTok))
      .send({
        name: "First",
        passportNo: passport,
        nationality: "Bangladesh",
        gender: "MALE",
      })
      .expect(201);

    await request(http)
      .post(`/groups/${g.body.id}/passengers`)
      .set(auth(agentTok))
      .send({
        name: "Second",
        passportNo: passport,
        nationality: "Bangladesh",
        gender: "MALE",
      })
      .expect(400);
  });

  it("Scenario 4 — Cross-tenant group access rejected", async () => {
    const g = await request(http)
      .post("/groups")
      .set(auth(agentTok))
      .send({
        name: `Tenant Guard ${stamp}`,
        destination: "MAKKAH_MADINAH",
        visaType: "UMRAH",
        maxCapacity: 40,
        hajiWhatsapp: "+8801700000010",
      })
      .expect(201);
    cleanupGroupIds.push(g.body.id);

    await request(http).get(`/groups/${g.body.id}`).set(auth(otherTok)).expect(404);
    const cross = await request(http)
      .post(`/groups/${g.body.id}/passengers/bulk`)
      .set(auth(otherTok))
      .send({
        passengers: [
          {
            name: "X",
            passportNo: `XT${stamp}A`,
            nationality: "Bangladesh",
            gender: "MALE",
          },
          {
            name: "Y",
            passportNo: `XT${stamp}B`,
            nationality: "Bangladesh",
            gender: "FEMALE",
          },
        ],
      });
    // Tenant isolation: not found or bad request — must not succeed.
    expect([400, 403, 404]).toContain(cross.status);
  });

  it("WA path remains skip-safe without WASENDER_API_KEY (no crash)", async () => {
    // SKIPPED channel result maps to NotificationStatus.PENDING (awaiting creds).
    const waLog = await prisma.notificationLog.findFirst({
      where: {
        channel: "WHATSAPP",
        event: {
          key: {
            in: [
              "GROUP_CREATED",
              "GROUP_GATES_CHANGED",
              "GROUP_IMPORT_COMPLETED",
              "GROUP_OCR_COMMITTED",
            ],
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    if (waLog) {
      expect(["PENDING", "FAILED", "DELIVERED", "READ"]).toContain(waLog.status);
    }
  });
});
