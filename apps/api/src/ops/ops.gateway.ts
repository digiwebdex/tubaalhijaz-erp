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
import { PermissionsGuard } from "../common/guards/permissions.guard";
import type { JwtPayload } from "../auth/jwt.strategy";

/**
 * Live ops broadcast gateway (Socket.io, namespace `/ops`).
 * S1-03: every connection must present a valid JWT with `VIEW_DASHBOARD`.
 * Tenant users (agents/suppliers with companyId) are rejected — ops boards are
 * platform-staff / ops-wide. Event names and the `ops` room are unchanged.
 */
export type OpsEvent =
  | "flight.status"
  | "dispatch.status"
  | "dispatch.created"
  | "group.arrival"
  | "group.departure"
  | "meetassist.updated"
  | "ziyarah.changed"
  | "longstay.changed"
  | "brn.changed";

@Injectable()
@WebSocketGateway({
  namespace: "/ops",
  cors: { origin: true, credentials: true },
})
export class OpsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly log = new Logger("OpsGateway");

  @WebSocketServer() server!: Server;
  // The /ops namespace, captured from a connected client. Emitting on the raw
  // injected `server` (root namespace) would never reach /ops clients.
  private nsp?: Namespace;

  constructor(
    private readonly jwt: JwtService,
    private readonly permissions: PermissionsGuard,
  ) {}

  /**
   * Auth middleware runs before the socket joins — failed handshakes surface as
   * client `connect_error` (not a brief connect→disconnect race).
   */
  afterInit(nsp: Namespace) {
    this.nsp = nsp;
    nsp.use(async (client, next) => {
      try {
        await this.authenticate(client);
        next();
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        this.log.warn(`ops WS connection rejected sid=${client.id}: ${reason}`);
        next(new Error("Unauthorized"));
      }
    });
  }

  async handleConnection(client: Socket) {
    this.nsp = client.nsp;
    const user = client.data.user as AuthUser | undefined;
    await client.join("ops");
    client.emit("connected", { at: new Date().toISOString(), userId: user?.sub });
  }

  handleDisconnect(_client: Socket) {
    // socket.io auto-cleans room membership
  }

  /** Broadcast an event to every board in the `ops` room of the /ops namespace. */
  broadcast(event: OpsEvent, payload: unknown) {
    const target = this.nsp ?? this.server;
    target?.to("ops").emit(event, payload);
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

    // Tenant isolation: agent/supplier JWTs must not join the ops-wide room.
    if (payload.companyId) {
      throw new Error(`tenant user blocked companyId=${payload.companyId} role=${payload.role}`);
    }

    const allowed = await this.permissions.roleHasPermission(payload.role, "VIEW_DASHBOARD");
    if (!allowed) throw new Error(`missing VIEW_DASHBOARD role=${payload.role} user=${payload.sub}`);

    client.data.user = {
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      companyId: payload.companyId ?? null,
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
