// ─── Notifications WebSocket auth (S2-02) ────────────────────────────────────
// /notifications requires JWT; rooms from JWT only; query spoof rejected.

import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { io, Socket } from "socket.io-client";
import { AppModule } from "../src/app.module";
import { setupApp } from "../src/setup-app";
import { PrismaService } from "../src/prisma/prisma.service";
import { NotificationsGateway } from "../src/notifications/notifications.gateway";

const PW = "Demo@123";

function connectNotify(
  baseUrl: string,
  opts: { token?: string; query?: Record<string, string>; bearer?: string } = {},
): Promise<{ socket: Socket; ok: boolean; err?: string }> {
  return new Promise((resolve) => {
    const extraHeaders: Record<string, string> = {};
    if (opts.bearer) extraHeaders.Authorization = `Bearer ${opts.bearer}`;
    const socket = io(`${baseUrl}/notifications`, {
      transports: ["websocket"],
      reconnection: false,
      timeout: 4000,
      auth: opts.token ? { token: opts.token } : {},
      query: opts.query,
      extraHeaders,
    });
    let settled = false;
    const done = (ok: boolean, err?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ socket, ok, err });
    };
    const timer = setTimeout(() => done(false, "timeout"), 4500);
    socket.on("connect", () => done(true));
    socket.on("connect_error", (e) => done(false, e.message));
  });
}

describe("Notifications WebSocket auth (e2e)", () => {
  let app: INestApplication;
  let baseUrl: string;
  let http: ReturnType<INestApplication["getHttpServer"]>;
  let prisma: PrismaService;
  let gateway: NotificationsGateway;
  let agentTok = "";
  let agentBTok = "";
  let agentUserId = "";
  let agentCompanyId = "";
  let agentBCompanyId = "";

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    setupApp(app);
    await app.listen(0);
    const addr = app.getHttpServer().address();
    baseUrl = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
    http = app.getHttpServer();
    prisma = app.get(PrismaService);
    gateway = app.get(NotificationsGateway);

    agentTok = (
      await request(http).post("/auth/login").send({ email: "ahmad@rashidi-travel.com", password: PW }).expect(200)
    ).body.accessToken;
    agentBTok = (
      await request(http).post("/auth/login").send({ email: "office@alnoor-pilgrim.com", password: PW }).expect(200)
    ).body.accessToken;

    const a = await prisma.user.findFirstOrThrow({
      where: { email: "ahmad@rashidi-travel.com" },
      select: { id: true, companyId: true },
    });
    const b = await prisma.user.findFirstOrThrow({
      where: { email: "office@alnoor-pilgrim.com" },
      select: { companyId: true },
    });
    agentUserId = a.id;
    agentCompanyId = a.companyId!;
    agentBCompanyId = b.companyId!;
  });

  afterAll(async () => {
    await app.close();
  });

  it("anonymous connection is rejected", async () => {
    const { socket, ok } = await connectNotify(baseUrl);
    expect(ok).toBe(false);
    expect(socket.connected).toBe(false);
    socket.disconnect();
  });

  it("invalid JWT is rejected", async () => {
    const { socket, ok } = await connectNotify(baseUrl, { token: "not.a.valid.jwt" });
    expect(ok).toBe(false);
    expect(socket.connected).toBe(false);
    socket.disconnect();
  });

  it("authenticated user connects with auth.token", async () => {
    const socket = io(`${baseUrl}/notifications`, {
      transports: ["websocket"],
      reconnection: false,
      auth: { token: agentTok },
    });
    const ack = await new Promise<{ userId?: string; tenantId?: string | null }>((resolve, reject) => {
      socket.on("connected", (p) => resolve(p));
      socket.on("connect_error", (e) => reject(e));
      setTimeout(() => reject(new Error("connect/ack timeout")), 4000);
    });
    expect(socket.connected).toBe(true);
    expect(ack.userId).toBe(agentUserId);
    expect(ack.tenantId).toBe(agentCompanyId);
    socket.disconnect();
  });

  it("Bearer Authorization header is accepted when auth.token omitted", async () => {
    const { socket, ok } = await connectNotify(baseUrl, { bearer: agentTok });
    expect(ok).toBe(true);
    expect(socket.connected).toBe(true);
    socket.disconnect();
  });

  it("cross-tenant query spoof (foreign tenantId) is rejected", async () => {
    const { socket, ok } = await connectNotify(baseUrl, {
      token: agentTok,
      query: { tenantId: agentBCompanyId },
    });
    expect(ok).toBe(false);
    expect(socket.connected).toBe(false);
    socket.disconnect();
  });

  it("cross-tenant query spoof (foreign userId) is rejected", async () => {
    const other = await prisma.user.findFirstOrThrow({
      where: { email: "office@alnoor-pilgrim.com" },
      select: { id: true },
    });
    const { socket, ok } = await connectNotify(baseUrl, {
      token: agentTok,
      query: { userId: other.id },
    });
    expect(ok).toBe(false);
    expect(socket.connected).toBe(false);
    socket.disconnect();
  });

  it("authenticated user receives notification events for their user room", async () => {
    const socket = io(`${baseUrl}/notifications`, {
      transports: ["websocket"],
      reconnection: false,
      auth: { token: agentTok },
    });
    await new Promise<void>((resolve, reject) => {
      socket.on("connect", () => resolve());
      socket.on("connect_error", reject);
      setTimeout(() => reject(new Error("connect timeout")), 4000);
    });

    const received = new Promise<{ id: string; title: string }>((resolve, reject) => {
      socket.on("notification", (p) => resolve(p));
      setTimeout(() => reject(new Error("no notification")), 4000);
    });

    gateway.pushToUser(agentUserId, {
      id: "e2e-ws-ping",
      title: "S2-02 ping",
      body: "hello",
      priority: "NORMAL",
      createdAt: new Date().toISOString(),
    });

    const evt = await received;
    expect(evt.title).toBe("S2-02 ping");
    socket.disconnect();
  });

  it("tenant A does not receive pushes targeted at tenant B", async () => {
    const socket = io(`${baseUrl}/notifications`, {
      transports: ["websocket"],
      reconnection: false,
      auth: { token: agentTok },
    });
    await new Promise<void>((resolve, reject) => {
      socket.on("connect", () => resolve());
      socket.on("connect_error", reject);
      setTimeout(() => reject(new Error("connect timeout")), 4000);
    });

    let leaked = false;
    socket.on("notification", () => {
      leaked = true;
    });

    gateway.pushToTenant(agentBCompanyId, {
      id: "e2e-other-tenant",
      title: "Other tenant",
      priority: "NORMAL",
      createdAt: new Date().toISOString(),
    });

    await new Promise((r) => setTimeout(r, 800));
    expect(leaked).toBe(false);
    socket.disconnect();
  });

  it("reconnect with fresh auth.token succeeds", async () => {
    const socket = io(`${baseUrl}/notifications`, {
      transports: ["websocket"],
      reconnection: false,
      auth: { token: agentTok },
    });
    await new Promise<void>((resolve, reject) => {
      socket.on("connect", () => resolve());
      socket.on("connect_error", reject);
      setTimeout(() => reject(new Error("first connect timeout")), 4000);
    });
    socket.disconnect();

    const again = await connectNotify(baseUrl, { token: agentTok });
    expect(again.ok).toBe(true);
    again.socket.disconnect();
  });
});
