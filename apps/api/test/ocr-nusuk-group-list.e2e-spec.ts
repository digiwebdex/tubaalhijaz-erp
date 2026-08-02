// T001-07 — Nusuk Group List OCR → approve opens/updates Group (feature-flagged)

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

function nusukStub(nusuk: string, name = "OCR Group Party"): OcrResult {
  return {
    fullText: `Group Number: ${nusuk}\nGroup Name: ${name}\nConsulate: Dhaka\nPax: 25`,
    words: [],
    meanConfidence: 0.91,
    provider: "stub",
    structured: {
      nusukGroupNumber: nusuk,
      groupName: name,
      consulate: "Dhaka",
      paxCount: "25",
      agentCode: "EA-OCR",
      departDate: "2026-10-01",
      returnDate: "2026-10-15",
    },
  };
}

describe("T001-07 Nusuk Group List OCR (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<INestApplication["getHttpServer"]>;
  let agentA: string;
  let ops: string;
  let annotateImpl: () => Promise<OcrResult>;
  const cleanupDocIds: string[] = [];
  const cleanupFileIds: string[] = [];
  const cleanupGroupIds: string[] = [];
  const prevFlag = process.env.ENABLE_NUSUK_GROUP_LIST_OCR;

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
    process.env.ENABLE_NUSUK_GROUP_LIST_OCR = "true";
    annotateImpl = async () => nusukStub("NUSUK-INIT");

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
    [agentA, ops] = await Promise.all([
      login("ahmad@rashidi-travel.com"),
      login("ops@tubalhijaz.com"),
    ]);
  });

  afterAll(async () => {
    if (prevFlag === undefined) delete process.env.ENABLE_NUSUK_GROUP_LIST_OCR;
    else process.env.ENABLE_NUSUK_GROUP_LIST_OCR = prevFlag;
    for (const id of cleanupDocIds) await prisma.ocrDocument.delete({ where: { id } }).catch(() => undefined);
    for (const id of cleanupFileIds) await prisma.uploadedFile.delete({ where: { id } }).catch(() => undefined);
    for (const id of cleanupGroupIds) {
      await prisma.passenger.deleteMany({ where: { groupId: id } }).catch(() => undefined);
      await prisma.group.delete({ where: { id } }).catch(() => undefined);
    }
    await app.close();
  });

  async function uploadAndCreate(nusuk: string, name?: string) {
    annotateImpl = async () => nusukStub(nusuk, name);
    const up = await request(http)
      .post("/uploads?kind=OTHER")
      .set(auth(agentA))
      .attach("file", PNG, { filename: "nusuk.png", contentType: "image/png" })
      .expect(201);
    cleanupFileIds.push(up.body.documentId);
    const created = await request(http)
      .post("/ocr/documents")
      .set(auth(agentA))
      .send({ uploadedFileId: up.body.documentId, documentType: "NUSUK_GROUP_LIST" })
      .expect(201);
    cleanupDocIds.push(created.body.id);
    await waitFor(async () => {
      const d = await prisma.ocrDocument.findUnique({ where: { id: created.body.id } });
      return d?.reviewStatus === "IN_REVIEW" ? d : null;
    });
    return created.body.id as string;
  }

  it("capabilities reports nusukGroupListOcr when flag on", async () => {
    const res = await request(http).get("/ocr/capabilities").set(auth(ops)).expect(200);
    expect(res.body.nusukGroupListOcr).toBe(true);
    expect(res.body.passportOcr).toBe(true);
  });

  it("flag off rejects NUSUK_GROUP_LIST create", async () => {
    process.env.ENABLE_NUSUK_GROUP_LIST_OCR = "false";
    const up = await request(http)
      .post("/uploads?kind=OTHER")
      .set(auth(agentA))
      .attach("file", PNG, { filename: "off.png", contentType: "image/png" })
      .expect(201);
    cleanupFileIds.push(up.body.documentId);
    const res = await request(http)
      .post("/ocr/documents")
      .set(auth(agentA))
      .send({ uploadedFileId: up.body.documentId, documentType: "NUSUK_GROUP_LIST" })
      .expect(400);
    expect(String(res.body.message)).toMatch(/disabled/i);
    process.env.ENABLE_NUSUK_GROUP_LIST_OCR = "true";
  });

  it("approve creates Group with Nusuk number + links OCR + audit", async () => {
    const nusuk = `NUSUK-T07-${Date.now()}`;
    const id = await uploadAndCreate(nusuk, "Created From OCR");
    const detail = await request(http).get(`/ocr/documents/${id}`).set(auth(agentA)).expect(200);
    const fields = detail.body.extractedFields as Array<{ field: string; value: string | null }>;
    expect(fields.some((f) => f.field === "nusukGroupNumber" && f.value === nusuk)).toBe(true);

    const approve = await request(http)
      .post(`/ocr/documents/${id}/approve`)
      .set(auth(ops))
      .send({})
      .expect(201);
    expect(approve.body.mode).toBe("create");
    expect(approve.body.group?.id).toBeTruthy();
    expect(approve.body.group?.nusukGroupNumber).toBe(nusuk);
    cleanupGroupIds.push(approve.body.group.id);

    const g = await prisma.group.findUniqueOrThrow({ where: { id: approve.body.group.id } });
    expect(g.nusukGroupNumber).toBe(nusuk);
    expect(g.name).toBe("Created From OCR");
    expect(g.consulate).toBe("Dhaka");
    expect(g.paxCount).toBe(25);

    const doc = await prisma.ocrDocument.findUniqueOrThrow({ where: { id } });
    expect(doc.groupId).toBe(g.id);
    expect(doc.reviewStatus).toBe("APPROVED");

    const audit = await prisma.auditLog.findFirst({
      where: { module: "OCR", action: "APPROVE", entityId: id },
      orderBy: { createdAt: "desc" },
    });
    expect((audit?.after as { mode?: string })?.mode).toBe("create");
  });

  it("duplicate Nusuk updates existing Group (no second Group)", async () => {
    const nusuk = `NUSUK-UPD-${Date.now()}`;
    const firstId = await uploadAndCreate(nusuk, "First Name");
    const first = await request(http)
      .post(`/ocr/documents/${firstId}/approve`)
      .set(auth(ops))
      .send({})
      .expect(201);
    cleanupGroupIds.push(first.body.group.id);
    const groupId = first.body.group.id as string;

    const secondId = await uploadAndCreate(nusuk, "Updated Name");
    const second = await request(http)
      .post(`/ocr/documents/${secondId}/approve`)
      .set(auth(ops))
      .send({})
      .expect(201);
    expect(second.body.mode).toBe("update");
    expect(second.body.group.id).toBe(groupId);

    const count = await prisma.group.count({ where: { nusukGroupNumber: nusuk } });
    expect(count).toBe(1);
    const g = await prisma.group.findUniqueOrThrow({ where: { id: groupId } });
    expect(g.name).toBe("Updated Name");
  });

  it("passport approve path still works (regression)", async () => {
    annotateImpl = async () => ({
      fullText: "PP",
      words: [],
      meanConfidence: 0.92,
      provider: "stub",
      structured: {
        name: "REGRESSION PAX",
        passportNo: `RP${Date.now().toString().slice(-8)}`,
        nationality: "BGD",
        dob: "1991-01-01",
        sex: "M",
        passportExpiry: "2031-01-01",
        issuingCountry: "BGD",
        personalNumber: null,
      },
    });
    const groupAId = (await prisma.group.findFirstOrThrow({ where: { code: "GRP-1446-2891" } })).id;
    const up = await request(http)
      .post("/uploads?kind=PASSPORT")
      .set(auth(agentA))
      .attach("file", PNG, { filename: "pp.png", contentType: "image/png" })
      .expect(201);
    cleanupFileIds.push(up.body.documentId);
    const created = await request(http)
      .post("/ocr/documents")
      .set(auth(agentA))
      .send({ uploadedFileId: up.body.documentId, documentType: "PASSPORT", groupId: groupAId })
      .expect(201);
    cleanupDocIds.push(created.body.id);
    await waitFor(async () => {
      const d = await prisma.ocrDocument.findUnique({ where: { id: created.body.id } });
      return d?.reviewStatus === "IN_REVIEW" ? d : null;
    });
    const approve = await request(http)
      .post(`/ocr/documents/${created.body.id}/approve`)
      .set(auth(ops))
      .send({ groupId: groupAId })
      .expect(201);
    expect(approve.body.passenger?.id).toBeTruthy();
    await prisma.passenger.delete({ where: { id: approve.body.passenger.id } }).catch(() => undefined);
  });
});
