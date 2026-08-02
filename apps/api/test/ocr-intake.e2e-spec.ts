// T001-06 — Passport & OCR Intake Integration (e2e)
// Covers: group-required approve, create Mutamer, attach to existing, group link,
// tenancy, review RBAC regression, upload kind PASSPORT.

import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { setupApp } from "../src/setup-app";
import { PrismaService } from "../src/prisma/prisma.service";
import { VisionClient, type OcrResult } from "../src/ocr/vision.client";
import { GeminiClient } from "../src/ocr/gemini.client";

const PW = "Demo@123";
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

function passportStub(passportNo: string, name = "INTAKE MUTAMER"): OcrResult {
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

describe("T001-06 Passport OCR intake integration (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<INestApplication["getHttpServer"]>;
  let agentA: string;
  let agentB: string;
  let ops: string;
  let groupAId: string;
  let annotateImpl: () => Promise<OcrResult>;
  const cleanupDocIds: string[] = [];
  const cleanupFileIds: string[] = [];
  const cleanupPaxIds: string[] = [];

  const login = async (email: string) =>
    (await request(http).post("/auth/login").send({ email, password: PW }).expect(200)).body.accessToken as string;
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  const stubProvider = {
    get configured() {
      return true;
    },
    annotate: async () => annotateImpl(),
  };

  beforeAll(async () => {
    process.env.OCR_PROVIDER = "google-vision";
    annotateImpl = async () => passportStub("T006BASE");

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

    [agentA, agentB, ops] = await Promise.all([
      login("ahmad@rashidi-travel.com"),
      login("office@alnoor-pilgrim.com"),
      login("ops@tubalhijaz.com"),
    ]);
    groupAId = (await prisma.group.findFirstOrThrow({ where: { code: "GRP-1446-2891" } })).id;
  });

  afterAll(async () => {
    for (const id of cleanupPaxIds) await prisma.passenger.delete({ where: { id } }).catch(() => undefined);
    for (const id of cleanupDocIds) await prisma.ocrDocument.delete({ where: { id } }).catch(() => undefined);
    for (const id of cleanupFileIds) await prisma.uploadedFile.delete({ where: { id } }).catch(() => undefined);
    await app.close();
  });

  async function uploadPassport(token: string) {
    const res = await request(http)
      .post("/uploads?kind=PASSPORT")
      .set(auth(token))
      .attach("file", PNG, { filename: "pp.png", contentType: "image/png" })
      .expect(201);
    cleanupFileIds.push(res.body.documentId);
    const file = await prisma.uploadedFile.findUniqueOrThrow({ where: { id: res.body.documentId } });
    expect(file.kind).toBe("PASSPORT");
    return res.body.documentId as string;
  }

  async function createAndWait(token: string, fileId: string, groupId?: string) {
    const res = await request(http)
      .post("/ocr/documents")
      .set(auth(token))
      .send({ uploadedFileId: fileId, documentType: "PASSPORT", ...(groupId ? { groupId } : {}) })
      .expect(201);
    cleanupDocIds.push(res.body.id);
    await waitFor(async () => {
      const d = await prisma.ocrDocument.findUnique({ where: { id: res.body.id } });
      return d?.reviewStatus === "IN_REVIEW" ? d : null;
    });
    return res.body.id as string;
  }

  it("upload kind PASSPORT is stored (not OTHER)", async () => {
    await uploadPassport(agentA);
  });

  it("passport approve without groupId returns clear Mutamer/Group error", async () => {
    const pp = `NG${Date.now().toString().slice(-8)}`;
    annotateImpl = async () => passportStub(pp);
    const fileId = await uploadPassport(agentA);
    const id = await createAndWait(agentA, fileId); // no group on create

    const res = await request(http)
      .post(`/ocr/documents/${id}/approve`)
      .set(auth(ops))
      .send({})
      .expect(400);
    expect(String(res.body.message)).toMatch(/Passport → Mutamer requires a Group/i);
  });

  it("passport approve with groupId creates Mutamer + links OCR + audit", async () => {
    const pp = `CR${Date.now().toString().slice(-8)}`;
    annotateImpl = async () => passportStub(pp, "CREATED MUTAMER");
    const fileId = await uploadPassport(agentA);
    const id = await createAndWait(agentA, fileId, groupAId);

    const detail = await request(http).get(`/ocr/documents/${id}`).set(auth(agentA)).expect(200);
    expect(detail.body.groupId).toBe(groupAId);
    expect(detail.body.group?.code).toBe("GRP-1446-2891");

    const approve = await request(http)
      .post(`/ocr/documents/${id}/approve`)
      .set(auth(ops))
      .send({ groupId: groupAId })
      .expect(201);
    expect(approve.body.mode).toBe("create");
    expect(approve.body.passenger?.id).toBeTruthy();
    expect(approve.body.groupCode).toBe("GRP-1446-2891");
    cleanupPaxIds.push(approve.body.passenger.id);

    const pax = await prisma.passenger.findUniqueOrThrow({ where: { id: approve.body.passenger.id } });
    expect(pax.ocrDocumentId).toBe(id);
    expect(pax.passportNo).toBe(pp);
    expect(pax.age).toBeGreaterThan(0);

    const audit = await prisma.auditLog.findFirst({
      where: { module: "OCR", action: "APPROVE", entityId: id },
      orderBy: { createdAt: "desc" },
    });
    expect(audit).toBeTruthy();
    const after = audit!.after as { mode?: string; groupId?: string };
    expect(after.mode).toBe("create");
    expect(after.groupId).toBe(groupAId);

    const list = await request(http).get(`/groups/${groupAId}/passengers`).set(auth(agentA)).expect(200);
    const row = (list.body as Array<{ id: string; ocrDocumentId: string | null }>).find((p) => p.id === pax.id);
    expect(row?.ocrDocumentId).toBe(id);
  });

  it("attach OCR to existing Mutamer (Excel twin) — no duplicate create", async () => {
    const pp = `AT${Date.now().toString().slice(-8)}`;
    const existing = await request(http)
      .post(`/groups/${groupAId}/passengers`)
      .set(auth(agentA))
      .send({
        name: "Excel Mutamer",
        passportNo: pp,
        nationality: "Bangladesh",
        gender: "MALE",
        mainEaCode: "1004492",
        subEaCode: "SUB-01",
        visaStatusLabel: "Visa Not Issued",
      })
      .expect(201);
    cleanupPaxIds.push(existing.body.id);
    expect(existing.body.ocrDocumentId).toBeNull();

    annotateImpl = async () => passportStub(pp, "EXCEL MUTAMER");
    const fileId = await uploadPassport(agentA);
    const id = await createAndWait(agentA, fileId, groupAId);

    const doc = await prisma.ocrDocument.findUniqueOrThrow({ where: { id } });
    expect(doc.duplicateOfPassengerId).toBe(existing.body.id);

    // Create path blocked
    await request(http)
      .post(`/ocr/documents/${id}/approve`)
      .set(auth(ops))
      .send({ groupId: groupAId })
      .expect(400);

    const attach = await request(http)
      .post(`/ocr/documents/${id}/approve`)
      .set(auth(ops))
      .send({ groupId: groupAId, passengerId: existing.body.id })
      .expect(201);
    expect(attach.body.mode).toBe("attach");
    expect(attach.body.passenger.id).toBe(existing.body.id);

    const pax = await prisma.passenger.findUniqueOrThrow({ where: { id: existing.body.id } });
    expect(pax.ocrDocumentId).toBe(id);
    expect(pax.mainEaCode).toBe("1004492"); // Excel fields preserved
    expect(pax.passportExpiry).toBeTruthy(); // blank filled from OCR

    const paxAudit = await prisma.auditLog.findFirst({
      where: { module: "Passengers", entityType: "Passenger", entityId: existing.body.id, action: "UPDATE" },
      orderBy: { createdAt: "desc" },
    });
    expect(paxAudit).toBeTruthy();
  });

  it("tenant isolation — other agent cannot bind OCR to foreign group", async () => {
    const pp = `TN${Date.now().toString().slice(-8)}`;
    annotateImpl = async () => passportStub(pp);
    const fileId = await uploadPassport(agentB);
    await request(http)
      .post("/ocr/documents")
      .set(auth(agentB))
      .send({ uploadedFileId: fileId, documentType: "PASSPORT", groupId: groupAId })
      .expect(404);
  });

  it("tenant isolation — other agent cannot OCR a foreign uploaded file (ESP-04)", async () => {
    const fileId = await uploadPassport(agentA);
    await request(http)
      .post("/ocr/documents")
      .set(auth(agentB))
      .send({ uploadedFileId: fileId, documentType: "PASSPORT", groupId: groupAId })
      .expect(404);
  });

  it("REVIEW_OCR_QUEUE still required for approve (regression)", async () => {
    const pp = `RB${Date.now().toString().slice(-8)}`;
    annotateImpl = async () => passportStub(pp);
    const fileId = await uploadPassport(agentA);
    const id = await createAndWait(agentA, fileId, groupAId);
    await request(http)
      .post(`/ocr/documents/${id}/approve`)
      .set(auth(agentA))
      .send({ groupId: groupAId })
      .expect(403);
  });

  it("review queue lists group attachment for intake", async () => {
    const res = await request(http)
      .get("/ocr/documents")
      .query({ documentType: "PASSPORT", groupId: groupAId })
      .set(auth(ops))
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    if (res.body.length) {
      expect(res.body[0]).toHaveProperty("group");
    }
  });
});
