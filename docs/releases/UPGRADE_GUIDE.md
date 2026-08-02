# Upgrade Guide — TUBA AL HIJAZ ERP v2.0.0

**Audience:** IT / release operator  
**From:** any prior host image (`stable-20260731`, `rc1-20260731`, or untagged tree)  
**To:** **v2.0.0** (tag + current prod images)  
**No application code changes in ESP-07** — this guide documents the upgrade already applied / how to align another environment.

---

## 1. Target runtime

| Piece | Target |
|-------|--------|
| Git tag | `v2.0.0` |
| API image | `tuba-alhijaz/tuba-alhijaz-api:esp06-20260802` (or rebuild from `v2.0.0` source) |
| Web image | `tuba-alhijaz/tuba-alhijaz-web:stable-20260731` (until next web rebuild) |
| Env | `COOKIE_SECURE=true`, `REFRESH_COOKIE_PATH=/api/auth`, `BIND_ADDR=127.0.0.1` |

---

## 2. Pre-upgrade

1. Confirm nightly dump exists (`/var/backups/tuba/`).  
2. Record current `API_IMAGE_TAG` / `WEB_IMAGE_TAG`.  
3. Read [`KNOWN_ISSUES.md`](./KNOWN_ISSUES.md) and [`DEPLOYMENT_CHECKLIST.md`](./DEPLOYMENT_CHECKLIST.md).  
4. Schedule user **re-login** (cookie Path).

---

## 3. Upgrade steps (production host pattern)

```bash
cd /var/www/TUBAALHIJAZ
# Ensure tag / source at v2.0.0
git fetch --tags   # when remote exists
git checkout v2.0.0

cd infra
# Persist API tag if using local build:
# API_IMAGE_TAG=esp06-20260802 already set on this host
grep -E 'COOKIE_SECURE|REFRESH_COOKIE_PATH|API_IMAGE_TAG' .env

docker compose -f docker-compose.prod.yml up -d api
# optional web:
# docker compose -f docker-compose.prod.yml up -d web

docker compose -f docker-compose.prod.yml ps
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3210/health
docker exec tuba-alhijaz-api-1 printenv REFRESH_COOKIE_PATH   # expect /api/auth

# Monitoring (if down):
docker compose -f docker-compose.monitoring.yml up -d
```

API container runs `prisma migrate deploy` on boot (forward-only).

---

## 4. Post-upgrade smoke

| Check | Expect |
|-------|--------|
| `https://…/api/health` | 200 |
| `https://…/api/metrics` | 404 |
| Workers in API logs | automation / notify / ocr |
| Failed queue lengths | ~0 |
| Staff + agent login | OK |
| After ~15m idle | refresh still works (cookie Path) |

---

## 5. User communication

- All users: **log out and log in once** after cookie Path deploy.  
- No password reset required for this upgrade.  
- Feature flags unchanged unless ops intentionally enables SOP flags.

---

## 6. Rollback

```bash
cd /var/www/TUBAALHIJAZ/infra
sed -i 's/^API_IMAGE_TAG=.*/API_IMAGE_TAG=stable-20260731/' .env
docker compose -f docker-compose.prod.yml up -d api
```

If a future migration must be undone: restore DB dump — see [`DISASTER_RECOVERY.md`](./DISASTER_RECOVERY.md). Do not invent down-migrations.

---

## 7. Staging / new environment

1. Copy `infra/.env.example` → `.env` with strong secrets.  
2. Set `REFRESH_COOKIE_PATH` to match how the browser reaches auth (`/api/auth` behind nginx prefix; `/auth` for direct API).  
3. `compose up` → migrate → seed (non-prod) → smoke.  
4. Start monitoring compose if required.

---

## 8. After v2.0.0

Complete human UAT (`docs/uat/`) and business signatures (`FINAL_SIGNOFF.md`) to clear release conditions. Enable offsite backups when approved.
