// ─── Shared API contract types ────────────────────────────────────────────────
// Entity types + validation schemas will be added here in the schema/API design
// phase (source of truth: docs/AUDIT.md entity inventory).

/** Response shape of GET /health on the API. */
export interface ApiHealthResponse {
  status: "ok";
  service: string;
  time: string;
  uptimeSec: number;
}
