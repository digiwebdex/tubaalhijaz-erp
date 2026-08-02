// Shared Prometheus registry + HTTP histogram (Phase 18). Scraped at GET /metrics.
import client from "prom-client";

export const registry = new client.Registry();
registry.setDefaultLabels({ service: "tuba-api" });
client.collectDefaultMetrics({ register: registry }); // process cpu/mem/eventloop/gc

export const httpDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds by method/route/status",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  registers: [registry],
});

export const httpErrors = new client.Counter({
  name: "http_requests_errors_total",
  help: "Total HTTP responses with status >= 500",
  labelNames: ["method", "route"],
  registers: [registry],
});
