import { Injectable, Logger } from "@nestjs/common";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";

const KEY = createHash("sha256").update(process.env.JWT_SECRET ?? "dev-secret").digest();
function enc(text: string): string {
  const iv = randomBytes(12); const c = createCipheriv("aes-256-gcm", KEY, iv);
  const e = Buffer.concat([c.update(text, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), e]).toString("base64");
}
function dec(b64: string): string {
  const buf = Buffer.from(b64, "base64");
  const d = createDecipheriv("aes-256-gcm", KEY, buf.subarray(0, 12)); d.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString("utf8");
}

export interface WaSaveDto { apiUrl?: string; deviceId?: string; defaultCountry?: string; apiKey?: string }

/** WaSender configuration + live status + test — all through the existing notification pipeline. */
@Injectable()
export class IntegrationsService {
  private readonly log = new Logger("Integrations");
  constructor(private readonly prisma: PrismaService, private readonly notify: NotificationsService) {}

  private async cfg() {
    const row = await this.prisma.integrationConfig.findUnique({ where: { provider: "wasender" } });
    return {
      apiUrl: row?.apiUrl || process.env.WASENDER_API_URL || "https://www.wasenderapi.com/api",
      deviceId: row?.deviceId || process.env.WASENDER_DEVICE_ID || null,
      defaultCountry: row?.defaultCountry || process.env.WASENDER_DEFAULT_COUNTRY || "+966",
      apiKey: row?.apiKeyEnc ? dec(row.apiKeyEnc) : (process.env.WASENDER_API_KEY || null),
      keyFromEnv: !row?.apiKeyEnc,
      lastTestAt: row?.lastTestAt ?? null,
      lastResponse: row?.lastResponse ?? null,
      connectionStatus: row?.connectionStatus ?? null,
    };
  }

  /** Config-page payload — never returns the raw key. */
  async getWaSender() {
    const c = await this.cfg();
    let live: string | null = null;
    if (c.apiKey) {
      try {
        const r = await fetch(`${c.apiUrl}/status`, { headers: { Authorization: `Bearer ${c.apiKey}` } });
        const b = (await r.json().catch(() => null)) as { status?: string } | null;
        live = r.ok ? (b?.status ?? "connected") : `error ${r.status}`;
      } catch (e) { live = `unreachable: ${(e as Error).message}`; }
    }
    return {
      apiUrl: c.apiUrl, deviceId: c.deviceId, defaultCountry: c.defaultCountry,
      configured: !!c.apiKey, apiKeyMasked: c.apiKey ? `••••••••${c.apiKey.slice(-4)}` : null, keyFromEnv: c.keyFromEnv,
      connectionStatus: live ?? c.connectionStatus, lastTestAt: c.lastTestAt, lastResponse: c.lastResponse,
    };
  }

  async saveWaSender(dto: WaSaveDto) {
    const data: Record<string, unknown> = {};
    if (dto.apiUrl !== undefined) data.apiUrl = dto.apiUrl;
    if (dto.deviceId !== undefined) data.deviceId = dto.deviceId;
    if (dto.defaultCountry !== undefined) data.defaultCountry = dto.defaultCountry;
    if (dto.apiKey) data.apiKeyEnc = enc(dto.apiKey); // encrypted at rest (AES-256-GCM)
    await this.prisma.integrationConfig.upsert({ where: { provider: "wasender" }, create: { provider: "wasender", ...data }, update: data });
    return this.getWaSender();
  }

  /** Resolve a safe default recipient = the device's own linked WhatsApp number. */
  private async ownNumber(apiUrl: string, apiKey: string): Promise<string | null> {
    try {
      const r = await fetch(`${apiUrl}/user`, { headers: { Authorization: `Bearer ${apiKey}` } });
      const b = (await r.json().catch(() => null)) as { data?: { id?: string } } | null;
      const id = b?.data?.id; // "966534919814:9@s.whatsapp.net"
      const num = id?.split(":")[0];
      return num ? `+${num}` : null;
    } catch { return null; }
  }

  /** Test WhatsApp Connection — sends through the existing NotificationsService.dispatch pipeline (BullMQ). */
  async test(phone?: string) {
    const c = await this.cfg();
    if (!c.apiKey) return { success: false, connectionStatus: "not configured", error: "WASENDER_API_KEY not set" };
    const to = phone || (await this.ownNumber(c.apiUrl, c.apiKey));
    if (!to) return { success: false, error: "No recipient and could not resolve the device number" };

    const { logIds } = await this.notify.dispatch({
      phone: to, channels: ["WHATSAPP"], priority: "NORMAL", literalContent: true,
      title: "WaSender test", body: `TUBA AL HIJAZ — WhatsApp connection test at ${new Date().toISOString()}. Delivered via the notification queue.`,
    });
    const logId = logIds[0];
    // Poll the NotificationLog the worker updates (proves queue + delivery + logging).
    let log = null;
    for (let i = 0; i < 12 && logId; i++) {
      log = await this.prisma.notificationLog.findUnique({ where: { id: logId } });
      if (log && log.status !== "PENDING") break;
      await new Promise((r) => setTimeout(r, 500));
    }
    const success = log?.status === "DELIVERED";
    const resp = JSON.stringify({ to, status: log?.status, providerId: log?.providerId, error: log?.error });
    await this.prisma.integrationConfig.upsert({
      where: { provider: "wasender" },
      create: { provider: "wasender", connectionStatus: success ? "connected" : "test-failed", lastTestAt: new Date(), lastResponse: resp },
      update: { connectionStatus: success ? "connected" : "test-failed", lastTestAt: new Date(), lastResponse: resp },
    });
    return { success, recipient: to, logId, status: log?.status ?? "PENDING", providerId: log?.providerId ?? null, error: log?.error ?? null };
  }
}
