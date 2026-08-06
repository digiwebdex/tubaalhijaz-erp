# 01 · PRODUCTION DEPLOYMENT RUNBOOK — TUBA AL HIJAZ v2.0.1
Prod host: `200.141.0.22` · Prod dir: `/var/www/TUBAALHIJAZ/infra` · Stack: `docker-compose.prod.yml` (project `tuba-alhijaz`).
Runs as `root`. **Owner executes; this session does not deploy/commit/push.** Time budget ~20 min + verification.

## 0. PRE-FLIGHT GATES (do NOT deploy until all are true)
- [ ] **P-01 resolved** — stray public datastores removed: `docker rm -f tuba-e2e-redis tuba-e2e-pg`; firewall enabled (`ufw enable`).
- [ ] **P-02 resolved** — temporary UAT `SUPER_ADMIN` disabled/rotated in the prod DB (see gap report P-02).
- [ ] Source committed + tagged so the release is reproducible (see §1).
- [ ] A fresh DB backup exists and is confirmed (see 02_DATABASE_MIGRATION_PLAN §1).
- [ ] Maintenance window agreed (brief API restart; ~30–60s API blip).
- [ ] `infra/.env` reviewed: `JWT_SECRET` strong (prod refuses weak/`dev-secret`), `WEB_ORIGIN`/`VITE_API_URL` correct. `SMTP_*` set **only if** password-reset/notification emails must actually send (feature is stub-safe without).

## 1. Commit + tag the release (reproducibility)
On the box, from `/var/www/TUBAALHIJAZ`:
```bash
git status                     # review the currently-uncommitted tree first
git add -A && git commit -m "release: v2.0.1 enterprise completion (billing rate cards, unified confirmation, password reset, security)"
git tag -a v2.0.1 -m "v2.0.1"
export REL=v2.0.1
```
> If applying this session's changes from the isolated clone, sync the changed files/migrations into `/var/www/TUBAALHIJAZ` first, then commit. New files: `apps/api/src/{pricing,booking-confirmation}.service.ts`, `apps/api/src/rates/`, `apps/api/src/enquiries/`, `apps/api/src/auth/dto/password-reset.dto.ts`, `apps/web/src/app/pages/{ResetPassword,RateCards}.tsx`; edited: auth/ops/users/services controllers+services, app.module, seed, routes, rbac, Login, Contact, SuperAdmin; migrations: `20260803195529_add_password_reset_token`, `20260803211614_billing_rate_cards`.

## 2. Capture CURRENT live tags = your rollback targets  ⚠ CRITICAL
```bash
cd /var/www/TUBAALHIJAZ/infra
docker ps --format '{{.Names}}\t{{.Image}}' | grep tuba-alhijaz   # record api+web tags NOW
grep -E '^(WEB_IMAGE_TAG|API_IMAGE_TAG|IMAGE_TAG)=' .env           # record current values
```
Write both down in the rollback plan (03). **Note:** compose resolves `WEB_IMAGE_TAG`/`API_IMAGE_TAG` BEFORE `IMAGE_TAG` — you must set those, not `IMAGE_TAG`.

## 3. Build the v2.0.1 images (on the box; registry not in use)
```bash
cd /var/www/TUBAALHIJAZ/infra
API_IMAGE_TAG=$REL WEB_IMAGE_TAG=$REL docker compose -f docker-compose.prod.yml build api web
docker images | grep -E "tuba-alhijaz-(api|web):$REL"             # confirm both built
```

## 4. Backup immediately before cutover (belt-and-suspenders)
```bash
systemctl start tuba-backup.service && tail -1 /var/log/tuba-backup.log
ls -lh /var/backups/tuba | tail -2                                 # confirm a fresh dump
```

## 5. Deploy (API first — it runs the migrations on boot — then web)
```bash
cd /var/www/TUBAALHIJAZ/infra
# persist the new tags so future `up -d` stays consistent:
sed -i "s/^API_IMAGE_TAG=.*/API_IMAGE_TAG=$REL/; s/^WEB_IMAGE_TAG=.*/WEB_IMAGE_TAG=$REL/" .env
API_IMAGE_TAG=$REL WEB_IMAGE_TAG=$REL docker compose -f docker-compose.prod.yml up -d api
# watch migrations apply on api boot:
docker logs -f tuba-alhijaz-api-1 | grep -m3 -E "migrat|Nest application|Listening"   # Ctrl-C after "successfully started"
# then the web:
API_IMAGE_TAG=$REL WEB_IMAGE_TAG=$REL docker compose -f docker-compose.prod.yml up -d web
```

## 6. Confirm health
```bash
docker ps --format '{{.Names}}\t{{.Image}}\t{{.Status}}' | grep tuba-alhijaz   # both :v2.0.1, healthy
curl -sf https://tubaalhijaz.com/api/health && echo OK
curl -sf https://tubaalhijaz.com/ >/dev/null && echo WEB_OK
```
Then run **04_PRODUCTION_SMOKE_TEST_CHECKLIST**. If smoke fails → **03_ROLLBACK_PLAN**.

## 7. (Optional) seed real rate cards
Billing prices come ONLY from rate cards (empty = transport/visa/additional stay unpriced). Add real cards via the Rate-Cards admin UI (`/rate-cards`, SUPER_ADMIN) or `POST /rate-cards/{transport|visa|additional}`.
