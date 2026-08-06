# 06 · MONITORING CHECKLIST — v2.0.1
Watch closely for the first **60 minutes**, then a lighter check at **24 h**.

## First 60 minutes
- [ ] `GET /api/health` polled every ~1 min stays 200.
- [ ] `docker ps` — api/web/postgres/redis/minio all `healthy`, no restart loops (`docker inspect -f '{{.RestartCount}}' tuba-alhijaz-api-1`).
- [ ] API logs clean: `docker logs --since 15m tuba-alhijaz-api-1 | grep -iE "error|unhandled|prisma.*(P20|P10)|ECONN" | head` — no unexpected errors, no repeated migration errors.
- [ ] Auth: real logins succeed; no spike in 401/403 beyond expected RBAC.
- [ ] Queues (BullMQ/Redis): jobs draining, not backing up — check the automation/notification worker logs.
- [ ] No 5xx in nginx access/error logs: `tail -f /var/log/nginx/error.log`.
- [ ] TLS + domain serving correctly (`curl -sI https://tubaalhijaz.com | head -1`).

## Dashboards (if Prometheus/Grafana stack is up)
- [ ] Grafana reachable (`/grafana/`), API up target green in Prometheus.
- [ ] Watch: request error rate, p95 latency, container CPU/mem, Postgres connections, Redis memory.

## 24-hour check
- [ ] Nightly backup ran and produced a **non-empty** dump: `ls -lh /var/backups/tuba | tail -2`; `systemctl status tuba-backup.timer`.
- [ ] Off-box/MinIO copy present (if configured).
- [ ] No disk pressure (`df -h`), no error accumulation in logs over 24 h.
- [ ] Accounting invariant still holds (GL debit=credit) after a day of real traffic.

## Alert thresholds (suggested)
- API health non-200 for >2 consecutive checks → page.
- Container restart count increasing → investigate.
- 5xx rate >1% or p95 latency >2× baseline → investigate.
- Nightly backup missing/zero-byte → page (regression against the known empty-gzip failure class).
