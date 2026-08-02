import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import type IORedis from "ioredis";
import { makeConnection } from "../automation/automation.constants";

/**
 * Tiny read-through cache for dashboard aggregations (VPS Redis, db3). Heavy
 * rollups (CEO/Finance) get a short TTL so a burst of page loads hits Redis, not
 * a fresh GL scan each time. Redis is best-effort: any cache error falls through
 * to a live query, so a Redis blip never breaks a dashboard.
 */
@Injectable()
export class DashboardCache implements OnModuleDestroy {
  private readonly log = new Logger("DashboardCache");
  private readonly redis: IORedis = makeConnection();
  private readonly prefix = "tuba:dash:";

  async wrap<T>(key: string, ttlSec: number, produce: () => Promise<T>): Promise<T> {
    const k = this.prefix + key;
    try {
      const hit = await this.redis.get(k);
      if (hit) return JSON.parse(hit) as T;
    } catch (e) {
      this.log.warn(`cache get failed (${key}): ${(e as Error).message}`);
    }
    const value = await produce();
    try {
      await this.redis.set(k, JSON.stringify(value), "EX", ttlSec);
    } catch {
      /* best-effort */
    }
    return value;
  }

  /** Drop cached dashboards (e.g. after a mutation) — prefix scan + del. */
  async bust(pattern = "*") {
    try {
      const keys = await this.redis.keys(this.prefix + pattern);
      if (keys.length) await this.redis.del(...keys);
    } catch {
      /* best-effort */
    }
  }

  onModuleDestroy() {
    this.redis.disconnect();
  }
}
