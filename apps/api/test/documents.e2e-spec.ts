// ─── Storage + Document Vault (e2e) ──────────────────────────────────────────
// Runs against the real local MinIO (MINIO_ENDPOINT in .env). Confirms:
//   • the storage backend is MinIO and uploads actually persist there
//   • magic-byte content scanning rejects spoofed / disallowed files
//   • presigned direct browser→MinIO upload + confirm
//   • Document Vault versioning (new upload of a type supersedes, never overwrites)
//     + expiry tracking + version history

import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { setupApp } from "../src/setup-app";
import { PrismaService } from "../src/prisma/prisma.service";
import { StorageService } from "../src/storage/storage.service";

const AGENT = { email: "ahmad@rashidi-travel.com", password: "Demo@123" };
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);
const iso = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

describe("Storage + Document Vault (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let storage: StorageService;
  let http: ReturnType<INestApplication["getHttpServer"]>;
  let agent: string;
  const created: string[] = [];

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    setupApp(app);
    await app.init();
    http = app.getHttpServer();
    prisma = app.get(PrismaService);
    storage = app.get(StorageService);
    agent = (await request(http).post("/auth/login").send(AGENT).expect(200)).body.accessToken;
  });

  afterAll(async () => {
    for (const id of created) await prisma.uploadedFile.delete({ where: { id } }).catch(() => undefined);
    await app.close();
  });

  it("uses the MinIO backend", () => {
    expect(storage.backend).toBe("minio");
  });

  // ── real persistence ─────────────────────────────────────────────────────────
  it("a multipart upload persists to MinIO and streams back", async () => {
    const res = await request(http).post("/uploads?kind=TRADE_LICENSE").set(auth(agent))
      .attach("file", PDF, { filename: "licence.pdf", contentType: "application/pdf" }).expect(201);
    created.push(res.body.documentId);
    const row = await prisma.uploadedFile.findUniqueOrThrow({ where: { id: res.body.documentId } });

    // object really exists in MinIO, and round-trips byte-for-byte through storage
    const stat = await storage.stat(row.bucket, row.storageKey);
    expect(stat?.size).toBe(PDF.length);
    const back = await storage.read(row.bucket, row.storageKey);
    expect(back.equals(PDF)).toBe(true);
  });

  // ── content scanning ─────────────────────────────────────────────────────────
  it("rejects a content-type-spoofed file (text bytes declared image/png)", async () => {
    await request(http).post("/uploads").set(auth(agent))
      .attach("file", Buffer.from("this is definitely not a png"), { filename: "x.png", contentType: "image/png" })
      .expect(400);
  });

  it("rejects a disallowed mime type", async () => {
    await request(http).post("/uploads").set(auth(agent))
      .attach("file", PDF, { filename: "x.zip", contentType: "application/zip" }).expect(400);
  });

  // ── presigned direct upload ──────────────────────────────────────────────────
  it("presigned direct browser→MinIO upload + confirm", async () => {
    const presign = await request(http).post("/uploads/presign").set(auth(agent))
      .send({ fileName: "scan.pdf", mimeType: "application/pdf", kind: "OWNER_ID" }).expect(201);
    created.push(presign.body.documentId);
    expect(presign.body.uploadUrl).toContain("http");

    // browser would PUT straight to MinIO — do exactly that
    const put = await fetch(presign.body.uploadUrl, { method: "PUT", body: PDF });
    expect(put.ok).toBe(true);

    expect(typeof presign.body.confirmToken).toBe("string");
    const confirm = await request(http).post(`/uploads/${presign.body.documentId}/confirm`).set(auth(agent))
      .send({ confirmToken: presign.body.confirmToken }).expect(201);
    expect(confirm.body.sizeBytes).toBe(PDF.length);
    const row = await prisma.uploadedFile.findUniqueOrThrow({ where: { id: presign.body.documentId } });
    expect(row.scanStatus).toBe("CLEAN");
  });

  // ── Document Vault versioning ────────────────────────────────────────────────
  it("a new upload of the same document type creates a version, not an overwrite", async () => {
    const up = (buf: Buffer, name: string, exp?: string) => {
      let r = request(http).post("/documents").set(auth(agent)).field("kind", "COMPANY_LOGO");
      if (exp) r = r.field("expiryDate", exp);
      return r.attach("file", buf, { filename: name, contentType: name.endsWith("png") ? "image/png" : "application/pdf" });
    };

    const v1 = await up(PNG, "logo-v1.png", iso(60)).expect(201);
    created.push(v1.body.documentId);
    expect(v1.body.version).toBe(1);

    const v2 = await up(PDF, "logo-v2.pdf", iso(90)).expect(201);
    created.push(v2.body.documentId);
    expect(v2.body.version).toBe(2);
    expect(v2.body.supersedes).toBe(v1.body.documentId);

    // v1 is superseded, not deleted
    const v1row = await prisma.uploadedFile.findUniqueOrThrow({ where: { id: v1.body.documentId } });
    expect(v1row.isLatest).toBe(false);

    // vault returns only the latest, with a version count + expiry severity
    const vault = await request(http).get("/documents?kind=COMPANY_LOGO").set(auth(agent)).expect(200);
    const item = vault.body.find((d: { id: string }) => d.id === v2.body.documentId);
    expect(item).toBeDefined();
    expect(item.versionCount).toBe(2);
    expect(item.severity).toBe("OK"); // expires in 90d

    // history shows both versions, newest first
    const hist = await request(http).get("/documents/versions?kind=COMPANY_LOGO").set(auth(agent)).expect(200);
    const mine = hist.body.filter((h: { id: string }) => [v1.body.documentId, v2.body.documentId].includes(h.id));
    expect(mine.length).toBe(2);
    expect(mine.find((h: { version: number }) => h.version === 2).isLatest).toBe(true);
  });
});
