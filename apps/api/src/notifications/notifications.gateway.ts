import { Injectable, Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Namespace, Server, Socket } from "socket.io";
import type { AuthUser } from "../common/decorators/current-user.decorator";
import type { JwtPayload } from "../auth/jwt.strategy";

export interface InAppNotification {
  id: string;
  title: string;
  body?: string | null;
  priority: string;
  eventKey?: string | null;
  createdAt: string;
}

/**
 * In-app delivery gateway (Socket.io, namespace `/notifications`).
 *
 * S2-02: JWT-only handshake (`auth.token` preferred; Bearer / `?token=` accepted).
 * Rooms are derived from the JWT only (`user:<sub>`, optional `tenant:<companyId>`).
 * Handshake query `userId` / `tenantId` are ignored for membership; mismatched
 * spoof attempts are rejected (cross-tenant).
 *
 * Event name `notification` and push helpers are unchanged.
 * Same nsp-capture fix as Ops: emit via the `/notifications` namespace.
 */
@Injectable()
@WebSocketGateway({ namespace: "/notifications", cors: { origin: true, credentials: true } })
export class NotificationsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly log = new Logger("NotificationsGateway");

  @WebSocketServer() server!: Server;
  private nsp?: Namespace;

  constructor(private readonly jwt: JwtService) {}

  afterInit(nsp: Namespace) {
    this.nsp = nsp;
    nsp.use(async (client, next) => {
      try {
        await this.authenticate(client);
        next();
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        this.log.warn(`notifications WS rejected sid=${client.id}: ${reason}`);
        next(new Error("Unauthorized"));
      }
    });
  }

  async handleConnection(client: Socket) {
    this.nsp = client.nsp;
    const user = client.data.user as AuthUser;
    await client.join(`user:${user.sub}`);
    if (user.companyId) await client.join(`tenant:${user.companyId}`);
    client.emit("connected", {
      at: new Date().toISOString(),
      userId: user.sub,
      tenantId: user.companyId,
    });
  }

  handleDisconnect(_client: Socket) {
    // socket.io auto-cleans room membership
  }

  private target() {
    return this.nsp ?? this.server;
  }

  pushToUser(userId: string, n: InAppNotification) {
    this.target()?.to(`user:${userId}`).emit("notification", n);
  }

  pushToTenant(tenantId: string, n: InAppNotification) {
    this.target()?.to(`tenant:${tenantId}`).emit("notification", n);
  }

  private async authenticate(client: Socket): Promise<void> {
    const token = this.extractToken(client);
    if (!token) throw new Error("missing JWT");

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new Error("invalid JWT");
    }

    if (!payload?.sub || !payload.role) throw new Error("malformed JWT payload");

    const q = client.handshake.query as { userId?: string | string[]; tenantId?: string | string[] };
    const qUser = firstQuery(q.userId);
    const qTenant = firstQuery(q.tenantId);
    if (qUser && qUser !== payload.sub) {
      throw new Error(`cross-tenant userId spoof q=${qUser} jwt=${payload.sub}`);
    }
    const jwtTenant = payload.companyId ?? null;
    if (qTenant && qTenant !== jwtTenant) {
      throw new Error(`cross-tenant tenantId spoof q=${qTenant} jwt=${jwtTenant}`);
    }

    client.data.user = {
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      companyId: jwtTenant,
      companyType: payload.companyType ?? null,
    } satisfies AuthUser;
  }

  private extractToken(client: Socket): string | undefined {
    const fromAuth = (client.handshake.auth as { token?: unknown } | undefined)?.token;
    if (typeof fromAuth === "string" && fromAuth.length > 0) return fromAuth;

    const header = client.handshake.headers.authorization;
    if (typeof header === "string" && header.startsWith("Bearer ")) {
      return header.slice("Bearer ".length).trim() || undefined;
    }

    const q = client.handshake.query.token;
    if (typeof q === "string" && q.length > 0) return q;
    if (Array.isArray(q) && typeof q[0] === "string") return q[0];
    return undefined;
  }
}

function firstQuery(v: string | string[] | undefined): string | undefined {
  if (typeof v === "string" && v.length > 0) return v;
  if (Array.isArray(v) && typeof v[0] === "string" && v[0].length > 0) return v[0];
  return undefined;
}
