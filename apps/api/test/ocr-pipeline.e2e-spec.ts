// ─── OCR end-to-end pipeline (S2-06 / G-10) ───────────────────────────────────
// Stub provider (no live Vision/Gemini). Covers:
//   upload → storage → queue → extract → review → approve/reject → audit
//   passport + visa + invoice (generic extractor)
//   queue retry, failed recovery (reprocess), tenant isolation, duplicates
//   REVIEW_OCR_QUEUE gate (see also ocr-rbac.e2e-spec.ts)

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

function passportStub(passportNo = "S206PASS1"): OcrResult {
  return {
    fullText: `PASSPORT STUB\n${passportNo}`,
    words: [],
    meanConfidence: 0.92,
    provider: "stub",
    structured: {
      name: "AHMAD STUB TRAVELER",
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

function genericStub(text: string): OcrResult {
  return {
    fullText: text,
    words: [],
    meanConfidence: 0.85,
    provider: "stub",
  };
}

describe("OCR pipeline (e2e S2-06)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<INestApplication["getHttpServer"]>;
  let agentA: string, agentB: string, ops: string, finance: string;
  let groupAId: string;
  let annotateImpl: (image: Buffer, opts?: { documentType?: string }) => Promise<OcrResult>;
  let annotateCalls = 0;
  const cleanupDocIds: string[] = [];
  const cleanupFileIds: string[] = [];
  const cleanupPaxIds: string[] = [];

  const login = async (email: string) =>
    (await request(http).post("/auth/login").send({ email, password: PW }).expect(200)).body.accessToken as string;
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  const stubProvider = {
    get configured() { return true; },
    annotate: async (image: Buffer, opts?: { documentType?: string }) => {
      annotateCalls += 1;
      return annotateImpl(image, opts);
    },
  };

  beforeAll(async () => {
    process.env.OCR_PROVIDER = "google-vision"; // pick VisionClient → our stub
    annotateImpl = async () => passportStub();

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

    [agentA, agentB, ops, finance] = await Promise.all([
      login("ahmad@rashidi-travel.com"),
      login("office@alnoor-pilgrim.com"),
      login("ops@tubalhijaz.com"),
      login("finance@tubalhijaz.com"),
    ]);
    groupAId = (await prisma.group.findFirstOrThrow({ where: { code: "GRP-1446-2891" } })).id;
  });

  afterAll(async () => {
    for (const id of cleanupPaxIds) await prisma.passenger.delete({ where: { id } }).catch(() => undefined);
    for (const id of cleanupDocIds) await prisma.ocrDocument.delete({ where: { id } }).catch(() => undefined);
    for (const id of cleanupFileIds) await prisma.uploadedFile.delete({ where: { id } }).catch(() => undefined);
    await app.close();
  });

  async function uploadFile(token: string, name = "scan.png") {
    const res = await request(http)
      .post("/uploads?kind=PASSPORT")
      .set(auth(token))
      .attach("file", PNG, { filename: name, contentType: "image/png" })
      .expect(201);
    cleanupFileIds.push(res.body.documentId);
    return res.body.documentId as string;
  }

  async function createOcr(token: string, fileId: string, documentType: string, groupId?: string) {
    const res = await request(http)
      .post("/ocr/documents")
      .set(auth(token))
      .send({ uploadedFileId: fileId, documentType, ...(groupId ? { groupId } : {}) })
      .expect(201);
    cleanupDocIds.push(res.body.id);
    return res.body as { id: string; code: string; reviewStatus: string };
  }

  async function waitInReview(id: string) {
    return waitFor(async () => {
      const d = await prisma.ocrDocument.findUnique({ where: { id } });
      return d?.reviewStatus === "IN_REVIEW" ? d : null;
    });
  }

  // ── Passport happy path: upload → queue → review → approve → passenger + audit ─
  it("passport: upload → process → approve → passenger + audit log", async () => {
    annotateImpl = async () => passportStub(`PP${Date.now().toString().slice(-8)}`);
    const fileId = await uploadFile(agentA, "passport.png");
    const created = await createOcr(agentA, fileId, "PASSPORT", groupAId);
    expect(created.reviewStatus).toBe("PENDING");

    const processed = await waitInReview(created.id);
    expect(processed.confidenceScore).toBeGreaterThan(0);
    expect(processed.extractedFields).toBeTruthy();
    const validation = processed.validation as { provider?: string };
    expect(validation.provider).toBe("stub");

    // Agent can poll own doc; finance cannot review
    await request(http).get(`/ocr/documents/${created.id}`).set(auth(agentA)).expect(200);
    await request(http).get("/ocr/documents").set(auth(finance)).expect(403);

    const approve = await request(http)
      .post(`/ocr/documents/${created.id}/approve`)
      .set(auth(ops))
      .send({ groupId: groupAId })
      .expect(201);
    expect(approve.body.reviewStatus).toBe("APPROVED");
    expect(approve.body.passenger?.id).toBeTruthy();
    cleanupPaxIds.push(approve.body.passenger.id);

    // Idempotent approve rejected
    await request(http)
      .post(`/ocr/documents/${created.id}/approve`)
      .set(auth(ops))
      .send({ groupId: groupAId })
      .expect(400);

    const audit = await prisma.auditLog.findFirst({
      where: { module: "OCR", action: "APPROVE", entityId: created.id },
    });
    expect(audit).toBeTruthy();
    expect(audit!.actorUserId).toBeTruthy();
  });

  // ── Visa + Invoice (generic extractor — supported types) ─────────────────────
  it("visa OCR lands in review with generic fields", async () => {
    annotateImpl = async () => genericStub("VISA 15/07/2026 REF V2026001 AMOUNT 1,250.00 SAR");
    const fileId = await uploadFile(agentA, "visa.png");
    const created = await createOcr(agentA, fileId, "VISA");
    const doc = await waitInReview(created.id);
    const fields = doc.extractedFields as Array<{ field: string; value: string | null }>;
    expect(fields.some((f) => f.field === "rawText" && f.value?.includes("VISA"))).toBe(true);
    expect(fields.some((f) => f.field === "date" && f.value)).toBe(true);
  });

  it("invoice OCR lands in review with amount hint", async () => {
    // documentNumber regex: [A-Z]{1,3}\d{5,} — use INV90011 (no hyphen)
    annotateImpl = async () => genericStub("INVOICE INV90011 Date 01/08/2026 Total 3,450.50");
    const fileId = await uploadFile(agentA, "invoice.png");
    const created = await createOcr(agentA, fileId, "INVOICE");
    const doc = await waitInReview(created.id);
    const fields = doc.extractedFields as Array<{ field: string; value: string | null }>;
    expect(fields.some((f) => f.field === "amount" && f.value)).toBe(true);
    expect(fields.some((f) => f.field === "documentNumber" && f.value)).toBe(true);
  });

  // ── Reject + audit ───────────────────────────────────────────────────────────
  it("reject removes from actionable queue and writes audit", async () => {
    annotateImpl = async () => passportStub(`RJ${Date.now().toString().slice(-8)}`);
    const fileId = await uploadFile(agentA, "reject-pp.png");
    const created = await createOcr(agentA, fileId, "PASSPORT", groupAId);
    await waitInReview(created.id);

    const res = await request(http)
      .post(`/ocr/documents/${created.id}/reject`)
      .set(auth(ops))
      .send({ reason: "illegible scan" })
      .expect(201);
    expect(res.body.reviewStatus).toBe("REJECTED");

    const audit = await prisma.auditLog.findFirst({
      where: { module: "OCR", action: "REJECT", entityId: created.id },
    });
    expect(audit).toBeTruthy();
  });

  // ── Queue retry (transient provider failure) ─────────────────────────────────
  it("queue retries after transient provider failure then delivers IN_REVIEW", async () => {
    let failsLeft = 2;
    annotateImpl = async () => {
      if (failsLeft > 0) {
        failsLeft -= 1;
        throw new Error("stub transient Vision outage");
      }
      return passportStub(`RT${Date.now().toString().slice(-8)}`);
    };
    const before = annotateCalls;
    const fileId = await uploadFile(agentA, "retry-pp.png");
    const created = await createOcr(agentA, fileId, "PASSPORT", groupAId);

    const doc = await waitInReview(created.id);
    expect(annotateCalls - before).toBeGreaterThanOrEqual(3);
    expect(doc.reviewStatus).toBe("IN_REVIEW");
  });

  // ── Failed OCR recovery via reprocess ────────────────────────────────────────
  it("persists lastError and reprocess recovers a stuck PENDING doc", async () => {
    annotateImpl = async () => {
      throw new Error("stub permanent failure");
    };
    const fileId = await uploadFile(agentA, "fail-pp.png");
    const created = await createOcr(agentA, fileId, "PASSPORT", groupAId);

    const failed = await waitFor(async () => {
      const d = await prisma.ocrDocument.findUnique({ where: { id: created.id } });
      const v = d?.validation as { lastError?: string } | null;
      return v?.lastError ? d : null;
    }, 25000);
    expect(failed!.reviewStatus).toBe("PENDING");
    expect((failed!.validation as { lastError: string }).lastError).toContain("stub permanent");

    // Finance cannot reprocess; ops can
    await request(http).post(`/ocr/documents/${created.id}/reprocess`).set(auth(finance)).expect(403);

    annotateImpl = async () => passportStub(`RC${Date.now().toString().slice(-8)}`);
    await request(http).post(`/ocr/documents/${created.id}/reprocess`).set(auth(ops)).expect(201);

    const recovered = await waitInReview(created.id);
    expect(recovered.reviewStatus).toBe("IN_REVIEW");

    const audit = await prisma.auditLog.findFirst({
      where: {
        module: "OCR",
        action: "PROCESS",
        entityId: created.id,
        after: { path: ["requeued"], equals: true },
      },
    });
    expect(audit).toBeTruthy();
  });

  // ── Duplicate passport detection ─────────────────────────────────────────────
  it("flags duplicate passport across pending/in-review OCR docs", async () => {
    const pass = `DUP${Date.now().toString().slice(-7)}`;
    annotateImpl = async () => passportStub(pass);

    const f1 = await uploadFile(agentA, "dup1.png");
    const d1 = await createOcr(agentA, f1, "PASSPORT", groupAId);
    await waitInReview(d1.id);

    const f2 = await uploadFile(agentA, "dup2.png");
    const d2 = await createOcr(agentA, f2, "PASSPORT", groupAId);
    const second = await waitInReview(d2.id);
    expect(second.duplicateOfId).toBe(d1.id);
  });

  // ── Tenant isolation ─────────────────────────────────────────────────────────
  it("agent cannot read another tenant's OCR document", async () => {
    annotateImpl = async () => passportStub(`TN${Date.now().toString().slice(-8)}`);
    const fileId = await uploadFile(agentA, "tenant-pp.png");
    const created = await createOcr(agentA, fileId, "PASSPORT", groupAId);
    await waitInReview(created.id);

    await request(http).get(`/ocr/documents/${created.id}`).set(auth(agentA)).expect(200);
    await request(http).get(`/ocr/documents/${created.id}`).set(auth(agentB)).expect(404);
  });

  // ── Review permission regression ─────────────────────────────────────────────
  it("AGENT cannot approve; OPS can list review queue", async () => {
    annotateImpl = async () => passportStub(`GP${Date.now().toString().slice(-8)}`);
    const fileId = await uploadFile(agentA, "gate-pp.png");
    const created = await createOcr(agentA, fileId, "PASSPORT", groupAId);
    await waitInReview(created.id);

    await request(http).post(`/ocr/documents/${created.id}/approve`).set(auth(agentA)).send({ groupId: groupAId }).expect(403);
    const list = await request(http).get("/ocr/documents?reviewStatus=IN_REVIEW").set(auth(ops)).expect(200);
    expect(Array.isArray(list.body)).toBe(true);
    expect(list.body.some((r: { id: string }) => r.id === created.id)).toBe(true);
  });
});
