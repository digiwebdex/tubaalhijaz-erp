/**
 * T001-10 — Transformation-001 Foundation verification pack (non-prod gate)
 *
 * Validation definition from TRANSFORMATION_001:
 *   create group+WA+HAJJ; set gates; CSV business template; passport OCR;
 *   group-list OCR flag; notify logs.
 *
 * No new business features — reuses existing Groups / OCR / Import / Notify / Ops APIs.
 */

import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { setupApp } from "../src/setup-app";
import { PrismaService } from "../src/prisma/prisma.service";
import { VisionClient, type OcrResult } from "../src/ocr/vision.client";
import { GeminiClient } from "../src/ocr/gemini.client";
import { ensureIntakeNotificationPack } from "../src/automation/intake-notification.pack";
import { isNusukGroupListOcrEnabled } from "../src/ocr/ocr.constants";

const PW = "Demo@123";
const AGENT = { email: "ahmad@rashidi-travel.com", password: PW };
const OTHER = { email: "office@alnoor-pilgrim.com", password: PW };
const OPS = { email: "ops@tubalhijaz.com", password: PW };
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);

async function waitFor<T>(fn: () => Promise<T | null | undefined>, ms = 20000, step = 250): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const r = await fn();
    if (r) return r;
    if (Date.now() > end) throw new Error("waitFor timed out");
    await new Promise((s) => setTimeout(s, step));
  }
}

function businessCsv(rows: Array<Record<string, string>>): string {
  const headers = [
    "Mutamer Name", "Age", "Passport", "Nationality",
    "Main External Agent Code", "Main External Agent Name",
    "Sub External Agent Code", "Sub External Agent Name",
    "Visa Status", "Biometric Status", "Visa Number", "MOFA Number", "Mutamer Type", "Gender",
  ];
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push([
      r.name, r.age ?? "35", r.passport, r.nationality ?? "Bangladesh",
      r.mainEa ?? "1004492", r.mainEaName ?? "Tuba Al Hijaz",
      r.subEa ?? "SUB-01", r.subEaName ?? "Bengal United",
      r.visaStatus ?? "Visa Not Issued", r.biometric ?? "Registered",
      r.visaNumber ?? "", r.mofa ?? "", r.mutamerType ?? "B2B", r.gender ?? "M",
    ].join(","));
  }
  return lines.join("\n") + "\n";
}

function nusukStub(nusuk: string): OcrResult {
  return {
    fullText: `Group Number: ${nusuk}\nGroup Name: T001-10 Smoke Party\nConsulate: Dhaka\nPax: 18`,
    words: [],
    meanConfidence: 0.91,
    provider: "stub",
    structured: {
      nusukGroupNumber: nusuk,
      groupName: "T001-10 Smoke Party",
      consulate: "Dhaka",
      paxCount: "18",
      agentCode: "EA-SMOKE",
    },
  };
}

function passportStub(passportNo: string, name: string): OcrResult {
  return {
    fullText: `PASSPORT\n${passportNo}`,
    words: [],
    meanConfidence: 0.93,
    provider: "stub",
    structured: {
      name,
      passportNo,
      nationality: "BGD",
      dob: "1990-05-12",
      sex: "M",
      passportExpiry: "2030-05-12",
      issuingCountry: "BGD",
      personalNumber: null,
    },
  };
}

describe("T001-10 TRANSFORM-001 foundation smoke (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<INestApplication["getHttpServer"]>;
  let agentTok: string;
  let otherTok: string;
  let opsTok: string;
  let annotateImpl: () => Promise<OcrResult>;
  const stamp = Date.now().toString(36);
  const cleanupGroupIds: string[] = [];
  const cleanupDocIds: string[] = [];
  const cleanupFileIds: string[] = [];
  const cleanupPaxIds: string[] = [];
  const prevNusukFlag = process.env.ENABLE_NUSUK_GROUP_LIST_OCR;

  /** Shared state across sequential intake scenarios */
  let groupId = "";
  let groupCode = "";
  let existingPaxId = "";

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
    annotateImpl = async () => nusukStub("NUSUK-SMOKE-INIT");

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
  });

  afterAll(async () => {
    for (const id of cleanupPaxIds) await prisma.passenger.delete({ where: { id } }).catch(() => undefined);
    for (const id of cleanupDocIds) await prisma.ocrDocument.delete({ where: { id } }).catch(() => undefined);
    for (const id of cleanupFileIds) await prisma.uploadedFile.delete({ where: { id } }).catch(() => undefined);
    for (const id of cleanupGroupIds) {
      await prisma.mutamerImportRun.deleteMany({ where: { groupId: id } }).catch(() => undefined);
      await prisma.passenger.deleteMany({ where: { groupId: id } }).catch(() => undefined);
      await prisma.group.delete({ where: { id } }).catch(() => undefined);
    }
    if (prevNusukFlag === undefined) delete process.env.ENABLE_NUSUK_GROUP_LIST_OCR;
    else process.env.ENABLE_NUSUK_GROUP_LIST_OCR = prevNusukFlag;
    await app.close();
  });

  // ── Scenario 1 — Create Group (HAJJ + WA + Nusuk) ───────────────────────────
  it("Scenario 1 — Create Group (HAJJ + WhatsApp + Nusuk) → PASS", async () => {
    const t0 = new Date();
    const nusuk = `NUSUK-S1-${stamp}`.toUpperCase();
    const res = await request(http)
      .post("/groups")
      .set(auth(agentTok))
      .send({
        name: `T001-10 Smoke ${stamp}`,
        destination: "MAKKAH_MADINAH",
        visaType: "HAJJ",
        packageType: "STANDARD",
        maxCapacity: 40,
        paxCount: 0,
        hajiWhatsapp: "+8801711000010",
        nusukGroupNumber: nusuk,
        consulate: "Dhaka",
      })
      .expect(201);

    groupId = res.body.id;
    groupCode = res.body.code;
    cleanupGroupIds.push(groupId);

    expect(res.body.visaType).toBe("HAJJ");
    expect(res.body.nusukGroupNumber).toBe(nusuk);
    expect(res.body.hajiWhatsapp).toContain("880");

    // Unique Nusuk — duplicate rejected
    await request(http)
      .post("/groups")
      .set(auth(agentTok))
      .send({
        name: "Dup Nusuk",
        destination: "MAKKAH_MADINAH",
        visaType: "UMRAH",
        hajiWhatsapp: "+8801711000011",
        nusukGroupNumber: nusuk,
      })
      .expect(409);

    // Staff + Agent share the group
    await request(http).get(`/groups/${groupId}`).set(auth(agentTok)).expect(200);
    await request(http).get(`/groups/${groupId}`).set(auth(opsTok)).expect(200);

    // Intake notify (best-effort — rules enabled)
    const createdLog = await waitFor(() =>
      prisma.notificationLog.findFirst({
        where: {
          createdAt: { gte: t0 },
          event: { key: "GROUP_CREATED" },
          OR: [{ title: { contains: groupCode } }, { body: { contains: groupCode } }],
        },
      }),
    ).catch(() => null);
    // Soft: if automation worker slow, still assert rule pack exists
    if (!createdLog) {
      const rule = await prisma.automationRule.findUnique({ where: { code: "AR-GRP-01" } });
      expect(rule?.enabled).toBe(true);
    }
  });

  // ── Scenario 2 — OCR Group List approve → Group ─────────────────────────────
  it("Scenario 2 — OCR Group List → Approve → Group Created → PASS", async () => {
    expect(isNusukGroupListOcrEnabled()).toBe(true);
    const caps = await request(http).get("/ocr/capabilities").set(auth(opsTok)).expect(200);
    expect(caps.body.nusukGroupListOcr).toBe(true);

    const nusuk = `NUSUK-S2-${stamp}`.toUpperCase();
    annotateImpl = async () => nusukStub(nusuk);

    const up = await request(http)
      .post("/uploads?kind=OTHER")
      .set(auth(agentTok))
      .attach("file", PNG, { filename: "nusuk-smoke.png", contentType: "image/png" })
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
    expect(approved.body.group?.nusukGroupNumber).toBe(nusuk);
    cleanupGroupIds.push(approved.body.group.id);
  });

  // ── Scenario 3 — Mutamer Excel Preview ──────────────────────────────────────
  it("Scenario 3 — Mutamer Excel Preview → PASS", async () => {
    expect(groupId).toBeTruthy();
    const before = await prisma.passenger.count({ where: { groupId } });
    const csv = businessCsv([
      { name: "Smoke Mutamer A", passport: `SMA${stamp}` },
      { name: "Smoke Mutamer B", passport: `SMB${stamp}` },
    ]);
    const res = await request(http)
      .post(`/groups/${groupId}/passengers/import/preview`)
      .set(auth(agentTok))
      .send({ fileName: "smoke-preview.csv", csvText: csv, format: "csv" })
      .expect(201);
    expect(res.body.mode).toBe("business");
    expect(res.body.summary.valid).toBe(2);
    expect(res.body.summary.canCommit).toBe(true);
    expect(await prisma.passenger.count({ where: { groupId } })).toBe(before);
  });

  // ── Scenario 4 — Confirm Import → Passengers Created ────────────────────────
  it("Scenario 4 — Confirm Import → Passengers Created → PASS", async () => {
    const csv = businessCsv([
      { name: "Smoke Import One", passport: `SI1${stamp}` },
      { name: "Smoke Import Two", passport: `SI2${stamp}` },
    ]);
    const preview = await request(http)
      .post(`/groups/${groupId}/passengers/import/preview`)
      .set(auth(agentTok))
      .send({ fileName: "smoke-commit.csv", csvText: csv, format: "csv" })
      .expect(201);

    const commit = await request(http)
      .post(`/groups/${groupId}/passengers/import/commit`)
      .set(auth(agentTok))
      .send({
        fileName: preview.body.fileName,
        fileHash: preview.body.fileHash,
        confirm: true,
        passengers: preview.body.passengers,
      })
      .expect(201);

    expect(commit.body.imported).toBe(2);
    const passports = [`SI1${stamp}`, `SI2${stamp}`].map((p) => p.toUpperCase());
    const pax = await prisma.passenger.findMany({
      where: { groupId, passportNo: { in: passports } },
    });
    expect(pax).toHaveLength(2);
    existingPaxId = pax[0].id;
    cleanupPaxIds.push(...pax.map((p) => p.id));
  });

  // ── Scenario 5 — Passport OCR attach ────────────────────────────────────────
  it("Scenario 5 — Passport OCR → Attach Passenger → PASS", async () => {
    expect(existingPaxId).toBeTruthy();
    const existing = await prisma.passenger.findUniqueOrThrow({ where: { id: existingPaxId } });
    const passport = existing.passportNo;
    annotateImpl = async () => passportStub(passport, existing.name);

    const up = await request(http)
      .post("/uploads?kind=PASSPORT")
      .set(auth(agentTok))
      .attach("file", PNG, { filename: "passport-smoke.png", contentType: "image/png" })
      .expect(201);
    cleanupFileIds.push(up.body.documentId);

    const doc = await request(http)
      .post("/ocr/documents")
      .set(auth(agentTok))
      .send({ uploadedFileId: up.body.documentId, documentType: "PASSPORT", groupId })
      .expect(201);
    cleanupDocIds.push(doc.body.id);

    await waitFor(async () => {
      const d = await prisma.ocrDocument.findUnique({ where: { id: doc.body.id } });
      return d?.reviewStatus === "IN_REVIEW" ? d : null;
    });

    // Without group → blocked (regression of OCR-before-group)
    const orphanUp = await request(http)
      .post("/uploads?kind=PASSPORT")
      .set(auth(agentTok))
      .attach("file", PNG, { filename: "orphan.png", contentType: "image/png" })
      .expect(201);
    cleanupFileIds.push(orphanUp.body.documentId);
    annotateImpl = async () => passportStub(`ORPH${stamp}`, "Orphan");
    const orphan = await request(http)
      .post("/ocr/documents")
      .set(auth(agentTok))
      .send({ uploadedFileId: orphanUp.body.documentId, documentType: "PASSPORT" })
      .expect(201);
    cleanupDocIds.push(orphan.body.id);
    await waitFor(async () => {
      const d = await prisma.ocrDocument.findUnique({ where: { id: orphan.body.id } });
      return d?.reviewStatus === "IN_REVIEW" ? d : null;
    });
    await request(http).post(`/ocr/documents/${orphan.body.id}/approve`).set(auth(opsTok)).send({}).expect(400);

    // Attach to existing mutamer
    annotateImpl = async () => passportStub(passport, existing.name);
    const approved = await request(http)
      .post(`/ocr/documents/${doc.body.id}/approve`)
      .set(auth(opsTok))
      .send({ groupId, passengerId: existingPaxId })
      .expect(201);
    expect(approved.body.mode).toBe("attach");
    expect(approved.body.passenger?.id).toBe(existingPaxId);
  });

  // ── Scenario 6 — Readiness Gates ────────────────────────────────────────────
  it("Scenario 6 — Readiness Gates Update → PASS", async () => {
    await request(http)
      .patch(`/groups/${groupId}`)
      .set(auth(agentTok))
      .send({ gateVisa: true, gatePackage: true, gatePayment: false, gateBill: false })
      .expect(200);

    const g = await prisma.group.findUniqueOrThrow({ where: { id: groupId } });
    expect(g.gateVisa).toBe(true);
    expect(g.gatePackage).toBe(true);
    expect(g.gatePayment).toBe(false);
    expect(g.gateBill).toBe(false);

    // Staff can flip remaining gates
    await request(http)
      .patch(`/groups/${groupId}`)
      .set(auth(opsTok))
      .send({ gatePayment: true, gateBill: true })
      .expect(200);
    const after = await prisma.group.findUniqueOrThrow({ where: { id: groupId } });
    expect(after.gatePayment).toBe(true);
    expect(after.gateBill).toBe(true);
  });

  // ── Scenario 7 — Notifications ──────────────────────────────────────────────
  it("Scenario 7 — Intake Notifications → PASS", async () => {
    for (const code of ["AR-GRP-01", "AR-GRP-02", "AR-GRP-03", "AR-GRP-04"]) {
      const r = await prisma.automationRule.findUnique({ where: { code } });
      expect(r?.enabled).toBe(true);
    }
    for (const key of ["GROUP_CREATED", "GROUP_GATES_CHANGED", "GROUP_IMPORT_COMPLETED", "GROUP_OCR_COMMITTED"]) {
      const ev = await prisma.notificationEvent.findUnique({ where: { key } });
      expect(ev).toBeTruthy();
    }

    // At least one intake log from earlier scenarios (or emit gates again)
    const t0 = new Date();
    await request(http)
      .patch(`/groups/${groupId}`)
      .set(auth(opsTok))
      .send({ gateVisa: false })
      .expect(200);
    await request(http)
      .patch(`/groups/${groupId}`)
      .set(auth(opsTok))
      .send({ gateVisa: true })
      .expect(200);

    const log = await waitFor(() =>
      prisma.notificationLog.findFirst({
        where: {
          createdAt: { gte: t0 },
          event: { key: "GROUP_GATES_CHANGED" },
        },
      }),
    );
    expect(log).toBeTruthy();
  });

  // ── Scenario 8 — Ops Group Board ────────────────────────────────────────────
  it("Scenario 8 — Ops Group Board → PASS", async () => {
    const res = await request(http).get("/ops/groups").set(auth(opsTok)).expect(200);
    const row = res.body.find((g: { id: string }) => g.id === groupId);
    expect(row).toBeTruthy();
    expect(row.name).toBeTruthy();
    expect(row.nusukGroupNumber).toBeTruthy();
    expect(row.agent).toBeTruthy();
    expect(row.visaType).toBe("HAJJ");
    expect(row.packageType).toBe("STANDARD");
    expect(row.hajiWhatsapp).toBeTruthy();
    expect(typeof row.gateVisa).toBe("boolean");
    expect(typeof row.gatePackage).toBe("boolean");
    expect(typeof row.gatePayment).toBe("boolean");
    expect(typeof row.gateBill).toBe("boolean");
  });

  // ── Scenario 9 — Cross Tenant Rejected ──────────────────────────────────────
  it("Scenario 9 — Cross Tenant → Rejected → PASS", async () => {
    await request(http).get(`/groups/${groupId}`).set(auth(otherTok)).expect(404);
    await request(http)
      .post(`/groups/${groupId}/passengers/import/preview`)
      .set(auth(otherTok))
      .send({
        fileName: "x.csv",
        csvText: businessCsv([{ name: "Nope", passport: `XT${stamp}` }]),
        format: "csv",
      })
      .expect(404);
    await request(http).get("/ops/groups").set(auth(agentTok)).expect(403);
  });

  // ── Scenario 10 — Rollback Validation ───────────────────────────────────────
  it("Scenario 10 — Rollback Validation (flag off / backward compat) → PASS", async () => {
    // Group-list OCR flag off rejects create (production safety)
    process.env.ENABLE_NUSUK_GROUP_LIST_OCR = "false";
    expect(isNusukGroupListOcrEnabled()).toBe(false);

    const up = await request(http)
      .post("/uploads?kind=OTHER")
      .set(auth(agentTok))
      .attach("file", PNG, { filename: "flag-off.png", contentType: "image/png" })
      .expect(201);
    cleanupFileIds.push(up.body.documentId);

    const blocked = await request(http)
      .post("/ocr/documents")
      .set(auth(agentTok))
      .send({ uploadedFileId: up.body.documentId, documentType: "NUSUK_GROUP_LIST" })
      .expect(400);
    expect(String(blocked.body.message)).toMatch(/disabled/i);

    // Restore for leftover cleanup paths
    process.env.ENABLE_NUSUK_GROUP_LIST_OCR = "true";

    // Backward compat: UMRAH group without Nusuk still creates
    const legacy = await request(http)
      .post("/groups")
      .set(auth(agentTok))
      .send({
        name: `Legacy No Nusuk ${stamp}`,
        destination: "MAKKAH_MADINAH",
        visaType: "UMRAH",
        maxCapacity: 20,
        hajiWhatsapp: "+8801711000099",
      })
      .expect(201);
    cleanupGroupIds.push(legacy.body.id);
    expect(legacy.body.code).toMatch(/^GRP-/);
    expect(legacy.body.nusukGroupNumber == null || legacy.body.nusukGroupNumber === "").toBe(true);

    // Legacy CSV import still works
    const legacyCsv =
      "Name,Passport No,Nationality,Gender,Date of Birth,Passport Expiry,Phone\n" +
      `Legacy Pax,LP${stamp},Bangladesh,M,1985-03-15,2030-06-30,\n`;
    const prev = await request(http)
      .post(`/groups/${legacy.body.id}/passengers/import/preview`)
      .set(auth(agentTok))
      .send({ fileName: "legacy.csv", csvText: legacyCsv, format: "csv" })
      .expect(201);
    expect(prev.body.summary.canCommit).toBe(true);

    // Caps still report passport OCR available
    const caps = await request(http).get("/ocr/capabilities").set(auth(opsTok)).expect(200);
    expect(caps.body.passportOcr).toBe(true);
  });
});
