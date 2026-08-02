#!/usr/bin/env bash
# TUBA AL HIJAZ — daily DB backup (Phase 18, item 4).
# pg_dump the tubaalhijaz DB → gzip → on-box MinIO (daily/ + weekly/ on Sundays)
# → optional off-VPS (Backblaze B2 / S3) → retention (daily 14d, weekly 90d)
# → log the run into AutomationRunLog so it shows in the automation UI.
# Real pg_dump (the postgres image has the client); this fulfils Phase-10's
# SYS_DAILY_BACKUP / SYS_CLOUD_BACKUP intent for real. Driven by tuba-backup.timer.
set -euo pipefail

INFRA=/var/www/TUBAALHIJAZ/infra
ENV_FILE="$INFRA/.env"
NET=tuba-alhijaz_tuba
PG=tuba-alhijaz-postgres-1
OUT=/var/backups/tuba
STAMP=$(date -u +%Y%m%d-%H%M%S)
DOW=$(date -u +%u)   # 7 = Sunday

# read one var from .env WITHOUT `source` (values may contain spaces / < > ).
# `|| true` so a missing (e.g. optional OFFSITE_*) key doesn't trip `set -e`.
env_get() { { grep -E "^$1=" "$ENV_FILE" || true; } | head -1 | cut -d= -f2-; }
PGUSER=$(env_get POSTGRES_USER); PGDB=$(env_get POSTGRES_DB)
MU=$(env_get MINIO_ROOT_USER); MP=$(env_get MINIO_ROOT_PASSWORD)
OFF_EP=$(env_get OFFSITE_ENDPOINT); OFF_KEY=$(env_get OFFSITE_KEY)
OFF_SEC=$(env_get OFFSITE_SECRET); OFF_BUCKET=$(env_get OFFSITE_BUCKET)

mkdir -p "$OUT"
FILE="tubaalhijaz-$STAMP.sql.gz"

# 1. dump
docker exec "$PG" pg_dump -U "$PGUSER" -d "$PGDB" --no-owner --no-privileges | gzip > "$OUT/$FILE"
BYTES=$(stat -c%s "$OUT/$FILE")

# helper: run mc on the tuba network with the on-box MinIO alias 'local'
mc() { docker run --rm --network "$NET" -e MC_HOST_local="http://$MU:$MP@minio:9000" -v "$OUT":/b minio/mc "$@"; }

# 2. on-box MinIO (daily always; weekly copy on Sundays)
mc mb --ignore-existing local/tuba-backups >/dev/null 2>&1 || true
mc cp "/b/$FILE" "local/tuba-backups/daily/$FILE"
if [ "$DOW" = "7" ]; then mc cp "/b/$FILE" "local/tuba-backups/weekly/$FILE"; fi

# 3. OFF-VPS copy (enable by setting OFFSITE_* in .env — Backblaze B2 / any S3)
OFFSITE_STATUS="disabled"
if [ -n "$OFF_EP" ] && [ -n "$OFF_KEY" ]; then
  docker run --rm -e MC_HOST_off="https://$OFF_KEY:$OFF_SEC@$OFF_EP" -v "$OUT":/b minio/mc \
    cp "/b/$FILE" "off/$OFF_BUCKET/daily/$FILE" && OFFSITE_STATUS="pushed"
fi

# 4. retention
mc rm --recursive --force --older-than 14d local/tuba-backups/daily/  >/dev/null 2>&1 || true
mc rm --recursive --force --older-than 90d local/tuba-backups/weekly/ >/dev/null 2>&1 || true
find "$OUT" -name '*.sql.gz' -mtime +2 -delete   # local staging kept short

# 5. record in AutomationRunLog (visible in the automation history UI once seeded)
docker exec "$PG" psql -U "$PGUSER" -d "$PGDB" -q -c \
 "INSERT INTO \"AutomationRunLog\" (id,\"ruleId\",\"eventKey\",action,status,\"durationMs\",message,\"startedAt\")
  SELECT md5(random()::text||clock_timestamp()::text), r.id,'cron','RUN_BACKUP','OK',0,
         'pg_dump ${BYTES} bytes → MinIO (offsite: ${OFFSITE_STATUS})', now()
  FROM \"AutomationRule\" r WHERE r.code='SYS_DAILY_BACKUP' LIMIT 1;" >/dev/null 2>&1 || true

echo "$(date -u +%FT%TZ) backup OK: $FILE (${BYTES} bytes) offsite=${OFFSITE_STATUS}"
