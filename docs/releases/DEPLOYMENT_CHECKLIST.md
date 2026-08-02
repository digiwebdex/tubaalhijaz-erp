# Deployment Checklist — TUBA AL HIJAZ ERP v2.0

**Audience:** IT / release engineer  
**Host:** production VPS · app dir `/var/www/TUBAALHIJAZ` · compose `infra/docker-compose.prod.yml`  
**Authority:** [`PRODUCTION_READINESS.md`](./PRODUCTION_READINESS.md) · root [`RUNBOOK.md`](../../RUNBOOK.md)  
**Shorthand:** `cd /var/www/TUBAALHIJAZ/infra` · `dc='docker compose -f docker-compose.prod.yml'`

---

## 0. Pre-flight (every release)

| # | Step | Done |
|---|------|:----:|
| 0.1 | Announce maintenance window if downtime expected | ☐ |
| 0.2 | Confirm latest nightly dump exists under `/var/backups/tuba/` | ☐ |
| 0.3 | `df -h` — root has ≥20% free | ☐ |
| 0.4 | Note current tags: `grep -E 'IMAGE_TAG|API_IMAGE_TAG|WEB_IMAGE_TAG' .env` | ☐ |
| 0.5 | Confirm `COOKIE_SECURE=true`, `REFRESH_COOKIE_PATH=/api/auth`, `BIND_ADDR=127.0.0.1` | ☐ |
| 0.6 | Confirm feature flags intentional (Group-list OCR / passport-return / MOFA bill / Haji WA) | ☐ |
| 0.7 | CI green **or** local build validated | ☐ |

---

## 1. Deployment order (mandatory)

Do **not** reverse order unless rolling back.

| Order | Action |
|------:|--------|
| 1 | Pull/sync source or images |
| 2 | Ensure postgres / redis / minio healthy |
| 3 | Deploy **API** (runs `prisma migrate deploy` on boot) |
| 4 | Wait API **healthy** + workers listening |
| 5 | Deploy **Web** (if web image changed) |
| 6 | Smoke tests (§3) |
| 7 | Optional: `docker compose -f docker-compose.monitoring.yml up -d` |
| 8 | Record tags + time in change log |

### Manual build-on-box (current bootstrap)

```bash
cd /var/www/TUBAALHIJAZ
# sync source as needed
cd infra
# Example API-only release (ESP-06 pattern):
API_IMAGE_TAG=esp06-YYYYMMDD docker compose -f docker-compose.prod.yml build api
# Persist tag:
sed -i 's/^API_IMAGE_TAG=.*/API_IMAGE_TAG=esp06-YYYYMMDD/' .env
docker compose -f docker-compose.prod.yml up -d api
docker compose -f docker-compose.prod.yml ps
```

### CI / GHCR path (when registry wired)

```bash
cd /var/www/TUBAALHIJAZ/infra
export REGISTRY=ghcr.io/<owner> API_IMAGE_TAG=<sha> WEB_IMAGE_TAG=<sha>
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

---

## 2. Post-deploy verification

| # | Check | Command / expect | Done |
|---|-------|------------------|:----:|
| 2.1 | API health | `curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:3210/health` → 200 | ☐ |
| 2.2 | Edge health | `curl … https://tubaalhijaz.com/api/health` → 200 | ☐ |
| 2.3 | Web | `https://tubaalhijaz.com/` → 200 | ☐ |
| 2.4 | Metrics denied | `https://tubaalhijaz.com/api/metrics` → 404 | ☐ |
| 2.5 | Cookie Path | `docker exec tuba-alhijaz-api-1 printenv REFRESH_COOKIE_PATH` → `/api/auth` | ☐ |
| 2.6 | Workers | `docker logs tuba-alhijaz-api-1 2>&1 \| grep 'worker listening'` → automation/notify/ocr | ☐ |
| 2.7 | Migrations | `docker exec … psql … -c "SELECT migration_name FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 1"` | ☐ |
| 2.8 | Failed queues | Redis `LLEN bull:tuba-*:failed` ≈ 0 (or known) | ☐ |
| 2.9 | Monitoring | Prometheus target `api` up (if stack running) | ☐ |

---

## 3. Smoke test (minimum)

| # | Scenario | Pass |
|---|----------|:----:|
| S1 | Staff login (admin portal) | ☐ |
| S2 | Agent login (agent portal) | ☐ |
| S3 | `/groups` list for agent (tenant-scoped) | ☐ |
| S4 | `/dashboards` or Ops Today for staff | ☐ |
| S5 | After access JWT expiry (~15m) or forced refresh: session still works (**cookie Path**) | ☐ |
| S6 | OCR Center list for ops (`REVIEW_OCR_QUEUE`) | ☐ |

If cookie Path changed: instruct all users to **log out and log in once**.

---

## 4. Rollback steps (image)

```bash
cd /var/www/TUBAALHIJAZ/infra
# Example: revert API to previous tag
sed -i 's/^API_IMAGE_TAG=.*/API_IMAGE_TAG=stable-20260731/' .env
docker compose -f docker-compose.prod.yml up -d api
# Verify health + workers
```

⚠️ **Migrations are forward-only.** If a release applied a bad migration, restore from backup ([`DISASTER_RECOVERY.md`](./DISASTER_RECOVERY.md)) — do not invent down-migrations in production.

Soft rollback (flags): see `docs/releases/TRANSFORM_001/ROLLBACK.md`.

---

## 5. ESP-06 applied (record)

| Item | Value |
|------|-------|
| Date | 2026-08-02 |
| API tag | `esp06-20260802` |
| Web tag | `stable-20260731` (unchanged) |
| Ops fixes | Cookie Path env+code live; monitoring stack started; scratch restore verified |
| Follow-up | Human UAT sign-off; offsite backups; prod restore drill |

---

## 6. Sign-off (IT)

| Role | Name | Date | Initials |
|------|------|------|----------|
| Deployer | | | |
| Verifier | | | |
