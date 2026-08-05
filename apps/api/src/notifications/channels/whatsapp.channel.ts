import { Injectable, Logger } from "@nestjs/common";
import type { ChannelResult } from "../notifications.constants";

/**
 * WhatsApp delivery via the WASender API.
 *   POST {WASENDER_API_URL}/send-message
 *   Authorization: Bearer {WASENDER_API_KEY}
 *   { to: "+E.164", text: "..." }  →  { success, data:{ msgId, jid, status } }
 * With no API key the channel reports SKIPPED (dev/test stub) so nothing breaks.
 */
@Injectable()
export class WhatsAppChannel {
  private readonly log = new Logger("WhatsAppChannel");
  private readonly baseUrl = process.env.WASENDER_API_URL ?? "https://www.wasenderapi.com/api";
  private readonly apiKey = process.env.WASENDER_API_KEY;
  private readonly defaultCountry = process.env.WASENDER_DEFAULT_COUNTRY ?? "+966";

  /** E.164 normalize: bare local numbers get the default country code. */
  private normalize(to: string): string {
    let n = to.trim().replace(/[\s()-]/g, "");
    if (n.startsWith("00")) n = "+" + n.slice(2);
    if (!n.startsWith("+")) n = this.defaultCountry.replace(/[^0-9+]/g, "") + n.replace(/^0+/, "");
    return n;
  }

  get configured() {
    return !!this.apiKey;
  }

  async send(to: string | null | undefined, text: string): Promise<ChannelResult> {
    if (!this.apiKey) return { status: "SKIPPED", error: "WASENDER_API_KEY not set" };
    if (!to) return { status: "FAILED", error: "no recipient phone number" };
    to = this.normalize(to);
    try {
      const res = await fetch(`${this.baseUrl}/send-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({ to, text }),
      });
      const body = (await res.json().catch(() => null)) as
        | { success?: boolean; message?: string; data?: { msgId?: number | string; status?: string } }
        | null;
      if (!res.ok || body?.success === false) {
        return { status: "FAILED", error: body?.message ?? `HTTP ${res.status}` };
      }
      return { status: "SENT", providerId: body?.data?.msgId != null ? String(body.data.msgId) : undefined };
    } catch (e) {
      return { status: "FAILED", error: (e as Error).message };
    }
  }
}
