// ─── Ops WebSocket auth (S1-03) ──────────────────────────────────────────────
// /ops requires JWT + VIEW_DASHBOARD; tenant (agent) JWTs are rejected.

import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { io, Socket } from "socket.io-client";
import { AppModule } from "../src/app.module";
import { setupApp } from "../src/setup-app";

const PW = "Demo@123";

function connectOps(baseUrl: string, token?: string): Promise<{ socket: Socket; ok: boolean; err?: string }> {
  return new Promise((resolve) => {
    const socket = io(`${baseUrl}/ops`, {
      transports: ["websocket"],
      reconnection: false,
      timeout: 4000,
      auth: token ? { token } : {},
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

describe("Ops WebSocket auth (e2e)", () => {
  let app: INestApplication;
  let baseUrl: string;
  let http: ReturnType<INestApplication["getHttpServer"]>;
  let opsTok = "";
  let agentTok = "";

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    setupApp(app);
    await app.listen(0);
    const addr = app.getHttpServer().address();
    baseUrl = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
    http = app.getHttpServer();
    opsTok = (await request(http).post("/auth/login").send({ email: "ops@tubalhijaz.com", password: PW }).expect(200)).body.accessToken;
    agentTok = (await request(http).post("/auth/login").send({ email: "ahmad@rashidi-travel.com", password: PW }).expect(200)).body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it("valid staff JWT connects and stays in the ops room", async () => {
    const socket = io(`${baseUrl}/ops`, {
      transports: ["websocket"],
      reconnection: false,
      auth: { token: opsTok },
    });
    const ack = await new Promise<{ userId?: string }>((resolve, reject) => {
      socket.on("connected", (p) => resolve(p));
      socket.on("connect_error", (e) => reject(e));
      setTimeout(() => reject(new Error("connect/ack timeout")), 4000);
    });
    expect(socket.connected).toBe(true);
    expect(ack.userId).toBeTruthy();
    socket.disconnect();
  });

  it("missing JWT is rejected", async () => {
    const { socket, ok } = await connectOps(baseUrl);
    expect(ok).toBe(false);
    expect(socket.connected).toBe(false);
    socket.disconnect();
  });

  it("invalid JWT is rejected", async () => {
    const { socket, ok } = await connectOps(baseUrl, "not.a.valid.jwt");
    expect(ok).toBe(false);
    expect(socket.connected).toBe(false);
    socket.disconnect();
  });

  it("agent (cross-tenant) JWT cannot subscribe", async () => {
    const { socket, ok } = await connectOps(baseUrl, agentTok);
    expect(ok).toBe(false);
    expect(socket.connected).toBe(false);
    socket.disconnect();
  });

  it("authorized board still receives flight.status after auth", async () => {
    const socket = io(`${baseUrl}/ops`, {
      transports: ["websocket"],
      reconnection: false,
      auth: { token: opsTok },
    });
    await new Promise<void>((resolve, reject) => {
      socket.on("connect", () => resolve());
      socket.on("connect_error", reject);
      setTimeout(() => reject(new Error("connect timeout")), 4000);
    });

    const board = await request(http).get("/ops/arrivals").set({ Authorization: `Bearer ${opsTok}` }).expect(200);
    const target = board.body.find((r: { status: string }) => r.status !== "LANDING") ?? board.body[0];
    expect(target).toBeTruthy();

    const received = new Promise<{ row: { id: string; status: string } }>((resolve, reject) => {
      socket.on("flight.status", (payload) => resolve(payload));
      setTimeout(() => reject(new Error("no flight.status")), 5000);
    });

    await request(http)
      .patch(`/ops/flights/${target.id}/status`)
      .set({ Authorization: `Bearer ${opsTok}` })
      .send({ status: "LANDING" })
      .expect(200);

    const evt = await received;
    expect(evt.row.id).toBe(target.id);

    await request(http)
      .patch(`/ops/flights/${target.id}/status`)
      .set({ Authorization: `Bearer ${opsTok}` })
      .send({ status: target.status })
      .expect(200);
    socket.disconnect();
  });
});
