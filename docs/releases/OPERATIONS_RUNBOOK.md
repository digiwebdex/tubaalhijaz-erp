# Operations Runbook — Release Companion (v2.0)

**Audience:** Day-2 ops / on-call  
**Primary ops bible (commands, secrets hygiene, Figma):** root [`RUNBOOK.md`](../../RUNBOOK.md)  
**This file:** release-oriented quick reference aligned to ESP-06 readiness. Do **not** duplicate secrets here.

**Host:** `187.77.144.38` · **App:** `/var/www/TUBAALHIJAZ` · **Compose:** `infra/`

---

## 1. Service map

| Component | Container / unit | Port (loopback) |
|-----------|------------------|-----------------|
| API + workers | `tuba-alhijaz-api-1` | `127.0.0.1:3210` |
| Web SPA | `tuba-alhijaz-web-1` | `127.0.0.1:8095` |
| Postgres | `tuba-alhijaz-postgres-1` | internal |
| Redis (BullMQ) | `tuba-alhijaz-redis-1` | internal · DB 3 |
| MinIO | `tuba-alhijaz-minio-1` | `127.0.0.1:9000` |
| Nginx TLS | host nginx | `443` / `80` |
| Backup | `tuba-backup.timer` / `.service` | — |
| Prometheus | `tuba-prometheus` | internal 9090 |
| Grafana | `tuba-grafana` | `127.0.0.1:3007` |

Public URLs: `https://tubaalhijaz.com` · API `https://tubaalhijaz.com/api`.

---

## 2. Health checks (copy/paste)

```bash
cd /var/www/TUBAALHIJAZ/infra
docker compose -f docker-compose.prod.yml ps
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3210/health
curl -sS -o /dev/null -w '%{http_code}\n' https://tubaalhijaz.com/api/health
curl -sS -o /dev/null -w '%{http_code}\n' https://tubaalhijaz.com/api/metrics   # expect 404
systemctl is-active tuba-backup.timer nginx
docker logs tuba-alhijaz-api-1 2>&1 | grep -E 'worker listening|ERROR' | tail -20
```

Workers expected: `tuba-automation`, `tuba-notify`, `tuba-ocr`.

---

## 3. Queues

BullMQ queues (Redis DB 3): `tuba-automation`, `tuba-notify`, `tuba-ocr`.

```bash
docker exec tuba-alhijaz-redis-1 redis-cli -n 3 LLEN bull:tuba-automation:failed
docker exec tuba-alhijaz-redis-1 redis-cli -n 3 LLEN bull:tuba-notify:failed
docker exec tuba-alhijaz-redis-1 redis-cli -n 3 LLEN bull:tuba-ocr:failed
```

Failed jobs: inspect via Super Admin / Automation UI when permitted, or Redis. No separate DLQ product — failed lists are the holding area; retries use job `attempts`/`backoff` configured in producers.

Scheduled: Day-85 sweep and other repeatables registered at API boot (`AutomationScheduler`).

---

## 4. Logs

| Source | Where |
|--------|-------|
| API / workers | `docker logs -f tuba-alhijaz-api-1` |
| Web | `docker logs tuba-alhijaz-web-1` |
| Nginx | `/var/log/nginx/tubaalhijaz.access.log` · `.error.log` |
| Backup | `/var/log/tuba-backup.log` |
| Grafana | `docker logs tuba-grafana` |

---

## 5. Critical env (names only)

| Variable | Expected prod |
|----------|----------------|
| `COOKIE_SECURE` | `true` |
| `REFRESH_COOKIE_PATH` | `/api/auth` |
| `BIND_ADDR` | `127.0.0.1` |
| `VITE_API_URL` | `https://tubaalhijaz.com/api` (baked into web) |
| `WEB_ORIGIN` / `CORS_ORIGIN` | `https://tubaalhijaz.com` |
| `API_IMAGE_TAG` | current release (e.g. `esp06-20260802`) |

Never paste secret values into tickets or docs.

---

## 6. Feature flags (ops toggles)

| Flag | Default intent |
|------|----------------|
| `ENABLE_NUSUK_GROUP_LIST_OCR` | off until SOP |
| `VISA_REQUIRE_PASSPORT_RETURN` | off until SOP |
| `ENABLE_MOFA_PROCESSING_BILL` | off until Finance enables |
| `REQUIRE_HAJI_WHATSAPP` | off unless required |

Change → recreate API container to pick up env.

---

## 7. Monitoring

```bash
cd /var/www/TUBAALHIJAZ/infra
docker compose -f docker-compose.monitoring.yml ps
# Grafana (loopback): http://127.0.0.1:3007/  (subpath config may require /grafana/)
```

Prometheus scrapes `api:3210/metrics` on docker network (not public).

---

## 8. Common incidents

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| 401 after 15m, refresh fails | Cookie Path / Secure mismatch | Confirm `REFRESH_COOKIE_PATH=/api/auth`, `COOKIE_SECURE=true`; user re-login |
| API unhealthy | Migrate fail / OOM / DB down | `docker logs api`; check postgres; rollback image if needed |
| OCR stuck | Worker/OCR provider | Logs `OcrWorker`; queue failed length; reprocess with permission |
| Day-85 silent | Cron/repeatable missing | Restart API; check AutomationScheduler log |
| Disk full | Images/build cache | `docker system df`; prune unused; protect MinIO/pg volumes |

---

## 9. Deploy / rollback / DR pointers

| Topic | Doc |
|-------|-----|
| Deploy order + smoke | [`DEPLOYMENT_CHECKLIST.md`](./DEPLOYMENT_CHECKLIST.md) |
| Backup / restore | [`DISASTER_RECOVERY.md`](./DISASTER_RECOVERY.md) + `RUNBOOK.md` §3 |
| Soft flag rollback | [`TRANSFORM_001/ROLLBACK.md`](./TRANSFORM_001/ROLLBACK.md) |
| UAT / business GO | [`docs/uat/GO_LIVE_READINESS.md`](../uat/GO_LIVE_READINESS.md) |
| Security matrix | [`docs/stabilization/ESP_04_SECURITY_AUDIT.md`](../stabilization/ESP_04_SECURITY_AUDIT.md) |

---

## 10. Contacts / escalation

Fill for your org:

| Role | Name | Channel |
|------|------|---------|
| IT on-call | | |
| Operations Manager | | |
| Managing Director (DR approve) | | |
