// ─── Upload confirm IDOR hardening (S1-02) ───────────────────────────────────
// Presign returns a one-time confirmToken; confirm requires token + ownership.
// Cross-tenant / wrong token / invalid id → 404 (no existence leak).
// Registration multipart (POST /uploads) remains public and does not need confirm.

import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { setupApp } from "../src/setup-app";
import { PrismaService } from "../src/prisma/prisma.service";
import { StorageService } from "../src/storage/storage.service";

const PW = "Demo@123";
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

describe("Upload confirm IDOR gate (e2e)", () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication["getHttpServer"]>;
  let prisma: PrismaService;
  let storage: StorageService;
  let agentA = "";
  let agentB = "";
  const created: string[] = [];

  const login = async (email: string) =>
    (await request(http).post("/auth/login").send({ email, password: PW }).expect(200)).body.accessToken as string;
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    setupApp(app);
    await app.init();
    http = app.getHttpServer();
    prisma = app.get(PrismaService);
    storage = app.get(StorageService);
    agentA = await login("ahmad@rashidi-travel.com");
    agentB = await login("office@alnoor-pilgrim.com");
  });

  afterAll(async () => {
    for (const id of created) await prisma.uploadedFile.delete({ where: { id } }).catch(() => undefined);
    await app.close();
  });

  const skipIfNoPresign = () => {
    if (!storage.supportsPresigned) {
      console.warn("skipping presign tests — MinIO not configured");
      return true;
    }
    return false;
  };

  it("authorized agent: presign → PUT → confirm with token succeeds", async () => {
    if (skipIfNoPresign()) return;
    const presign = await request(http).post("/uploads/presign").set(auth(agentA))
      .send({ fileName: "a-scan.pdf", mimeType: "application/pdf", kind: "OWNER_ID" }).expect(201);
    created.push(presign.body.documentId);
    expect(presign.body.confirmToken).toHaveLength(64);

    const row = await prisma.uploadedFile.findUniqueOrThrow({ where: { id: presign.body.documentId } });
    expect(row.uploadedById).toBeTruthy();
    expect(row.companyId).toBeTruthy();
    expect(row.scanStatus).toBe("PENDING");

    const put = await fetch(presign.body.uploadUrl, { method: "PUT", body: PDF });
    expect(put.ok).toBe(true);

    const confirm = await request(http)
      .post(`/uploads/${presign.body.documentId}/confirm`)
      .set(auth(agentA))
      .send({ confirmToken: presign.body.confirmToken })
      .expect(201);
    expect(confirm.body.sizeBytes).toBe(PDF.length);

    const audits = await prisma.auditLog.findMany({
      where: { module: "Uploads", entityId: presign.body.documentId, action: "PROCESS" },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    expect(audits.some((a) => (a.after as { result?: string })?.result === "OK")).toBe(true);
  });

  it("cross-tenant confirm is rejected (404) even with a valid stolen token", async () => {
    if (skipIfNoPresign()) return;
    const presign = await request(http).post("/uploads/presign").set(auth(agentA))
      .send({ fileName: "secret.pdf", mimeType: "application/pdf" }).expect(201);
    created.push(presign.body.documentId);

    await fetch(presign.body.uploadUrl, { method: "PUT", body: PDF });

    // Agent B + victim's confirmToken → ownership / tenancy deny
    await request(http)
      .post(`/uploads/${presign.body.documentId}/confirm`)
      .set(auth(agentB))
      .send({ confirmToken: presign.body.confirmToken })
      .expect(404);

    const still = await prisma.uploadedFile.findUniqueOrThrow({ where: { id: presign.body.documentId } });
    expect(still.scanStatus).toBe("PENDING");

    const denied = await prisma.auditLog.findFirst({
      where: { module: "Uploads", entityId: presign.body.documentId },
      orderBy: { createdAt: "desc" },
    });
    expect((denied?.after as { result?: string; reason?: string })?.result).toBe("DENIED");
    expect((denied?.after as { reason?: string })?.reason).toBe("CROSS_TENANT");
  });

  it("confirm without token / wrong token / foreign id → safe failure", async () => {
    if (skipIfNoPresign()) return;
    const presign = await request(http).post("/uploads/presign").set(auth(agentA))
      .send({ fileName: "x.pdf", mimeType: "application/pdf" }).expect(201);
    created.push(presign.body.documentId);

    await request(http)
      .post(`/uploads/${presign.body.documentId}/confirm`)
      .set(auth(agentA))
      .send({})
      .expect(400); // validation: confirmToken required

    await request(http)
      .post(`/uploads/${presign.body.documentId}/confirm`)
      .set(auth(agentA))
      .send({ confirmToken: "a".repeat(64) })
      .expect(404);

    await request(http)
      .post("/uploads/nonexistent-upload-id/confirm")
      .set(auth(agentA))
      .send({ confirmToken: "b".repeat(64) })
      .expect(404);
  });

  it("expired confirm token is rejected", async () => {
    if (skipIfNoPresign()) return;
    const presign = await request(http).post("/uploads/presign").set(auth(agentA))
      .send({ fileName: "old.pdf", mimeType: "application/pdf" }).expect(201);
    created.push(presign.body.documentId);
    await fetch(presign.body.uploadUrl, { method: "PUT", body: PDF });

    const cur = await prisma.uploadedFile.findUniqueOrThrow({ where: { id: presign.body.documentId } });
    const meta = cur.meta as { confirmTokenHash?: string };
    await prisma.uploadedFile.update({
      where: { id: presign.body.documentId },
      data: {
        meta: {
          confirmTokenHash: meta.confirmTokenHash,
          confirmExpiresAt: new Date(Date.now() - 60_000).toISOString(),
        },
      },
    });

    await request(http)
      .post(`/uploads/${presign.body.documentId}/confirm`)
      .set(auth(agentA))
      .send({ confirmToken: presign.body.confirmToken })
      .expect(400);
  });

  it("anonymous (orphan) presign may confirm with token only — public wizard path", async () => {
    if (skipIfNoPresign()) return;
    const presign = await request(http).post("/uploads/presign")
      .send({ fileName: "wizard.pdf", mimeType: "application/pdf", kind: "TRADE_LICENSE" }).expect(201);
    created.push(presign.body.documentId);
    const row = await prisma.uploadedFile.findUniqueOrThrow({ where: { id: presign.body.documentId } });
    expect(row.uploadedById).toBeNull();
    expect(row.companyId).toBeNull();

    await fetch(presign.body.uploadUrl, { method: "PUT", body: PDF });
    await request(http)
      .post(`/uploads/${presign.body.documentId}/confirm`)
      .send({ confirmToken: presign.body.confirmToken })
      .expect(201);
  });

  it("registration multipart upload still works without confirm", async () => {
    const res = await request(http)
      .post("/uploads?kind=TRADE_LICENSE")
      .attach("file", PDF, { filename: "licence.pdf", contentType: "application/pdf" })
      .expect(201);
    created.push(res.body.documentId);
    expect(res.body.documentId).toBeTruthy();
    const row = await prisma.uploadedFile.findUniqueOrThrow({ where: { id: res.body.documentId } });
    expect(row.scanStatus).toBe("CLEAN");
  });
});
