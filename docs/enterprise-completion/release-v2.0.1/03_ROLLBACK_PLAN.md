# 03 · ROLLBACK PLAN — v2.0.1
Trigger: smoke test fails, health red, or a Sev-1 defect within the watch window.

## Rollback targets (fill in from Runbook §2 BEFORE deploying)
- Previous API tag: `________________`  (e.g. the last `esp06-*`/`prod-audit-*` you recorded)
- Previous WEB tag: `________________`

## ⚠ Footgun
Compose resolves `WEB_IMAGE_TAG`/`API_IMAGE_TAG` **before** `IMAGE_TAG`. Editing `IMAGE_TAG` alone does NOTHING. You MUST set the WEB/API vars.

## Code rollback (fast, ~30–60s) — this is the primary path
Because the v2.0.1 migrations are **additive/backward-compatible**, the previous images run cleanly against the migrated DB — **no DB rollback needed.**
```bash
cd /var/www/TUBAALHIJAZ/infra
PREV_API=<previous_api_tag>; PREV_WEB=<previous_web_tag>
sed -i "s/^API_IMAGE_TAG=.*/API_IMAGE_TAG=$PREV_API/; s/^WEB_IMAGE_TAG=.*/WEB_IMAGE_TAG=$PREV_WEB/" .env
API_IMAGE_TAG=$PREV_API WEB_IMAGE_TAG=$PREV_WEB docker compose -f docker-compose.prod.yml up -d api web
docker ps --format '{{.Names}}\t{{.Image}}\t{{.Status}}' | grep tuba-alhijaz   # back on previous tags, healthy
curl -sf https://tubaalhijaz.com/api/health && echo ROLLED_BACK_OK
```
The new tables/columns remain but are unused by the old code (harmless). No new rate-card data affects old flows (old code ignores it).

## DB restore (ONLY if data corruption is suspected — rare; last resort)
Forward-only migrations are NOT auto-reversed. Restore the pre-deploy dump:
```bash
# newest dump captured in Runbook §4 / Migration Plan pre-step:
LATEST=$(ls -t /var/backups/tuba/*.sql.gz | head -1); echo "$LATEST"
# stop api to quiesce writes, restore, restart:
docker compose -f docker-compose.prod.yml stop api
gunzip -c "$LATEST" | docker exec -i tuba-alhijaz-postgres-1 psql -U tuba -d tubaalhijaz
docker compose -f docker-compose.prod.yml start api
```
(Restore replays the schema+data as of the backup; then bring code to a matching tag.)

## Post-rollback
- [ ] Health green, smoke test passes on the previous version.
- [ ] Note the failure cause; do not re-attempt until fixed.
