# Disaster Recovery — TUBA AL HIJAZ ERP

**Audience:** IT / on-call  
**Related:** root [`RUNBOOK.md`](../../RUNBOOK.md) §3 · [`PRODUCTION_READINESS.md`](./PRODUCTION_READINESS.md)  
**Last verified (scratch restore):** 2026-08-02 (ESP-06)

---

## 1. What we protect

| Asset | Location | Retention (current) |
|-------|----------|---------------------|
| PostgreSQL logical dump | `/var/backups/tuba/*.sql.gz` + MinIO `tuba-backups/daily/` | Daily ~14d (script policy) |
| Weekly dump | MinIO `tuba-backups/weekly/` | ~90d (script policy) |
| Object storage (docs/uploads) | MinIO volume `tuba-alhijaz_miniodata` | Persistent volume |
| App images | Local Docker / (future) GHCR | Keep prior tags for rollback |
| Secrets | `infra/.env` (0600, not in git) | Host + offline copy (ops-owned) |

**Not a DB backup:** BullMQ `SYS_DAILY_BACKUP` JSON manifests — ignore for restore.

---

## 2. Backup verification status

| Check | Status (ESP-06) |
|-------|-----------------|
| `tuba-backup.timer` active | **YES** |
| Recent gzip present | **YES** (`tubaalhijaz-20260802-020247.sql.gz`) |
| Uploaded to MinIO daily/weekly | **YES** (log OK) |
| Offsite (`OFFSITE_*`) | **DISABLED** — condition for full DR |
| Scratch restore | **PASS** — User/Group counts readable |
| Destructive prod restore drill | **NOT RUN** |

---

## 3. Restore procedures

### 3.1 Scratch verify (preferred — non-destructive)

```bash
FILE=$(ls -t /var/backups/tuba/tubaalhijaz-*.sql.gz | head -1)
PGU=$(grep ^POSTGRES_USER= /var/www/TUBAALHIJAZ/infra/.env | cut -d= -f2-)
docker exec tuba-alhijaz-postgres-1 psql -U "$PGU" -d postgres -c 'DROP DATABASE IF EXISTS tuba_restore_test;'
docker exec tuba-alhijaz-postgres-1 psql -U "$PGU" -d postgres -c 'CREATE DATABASE tuba_restore_test;'
gunzip -c "$FILE" | docker exec -i tuba-alhijaz-postgres-1 psql -U "$PGU" -d tuba_restore_test -v ON_ERROR_STOP=1
docker exec tuba-alhijaz-postgres-1 psql -U "$PGU" -d tuba_restore_test -c 'SELECT count(*) FROM "User";'
docker exec tuba-alhijaz-postgres-1 psql -U "$PGU" -d postgres -c 'DROP DATABASE tuba_restore_test;'
```

### 3.2 Production restore (destructive — MD/IT approval required)

1. Stop API (and preferably web) to freeze writers:  
   `cd /var/www/TUBAALHIJAZ/infra && docker compose -f docker-compose.prod.yml stop api web`  
2. Take an emergency dump of current DB (even if corrupt) before overwrite.  
3. Restore chosen `.sql.gz` into production DB per `RUNBOOK.md` §3.2 (drop/recreate or clean restore pattern used on this host).  
4. Start API/web; run smoke tests.  
5. Users re-login.

Exact destructive SQL steps remain in **`RUNBOOK.md` §3.2** — follow that copy to avoid drift.

### 3.3 MinIO / uploads loss

- If only DB restored: uploaded objects may be missing → re-upload critical docs.  
- If volume lost: restore from MinIO backup/offsite if configured; else accept data loss outside DB.

---

## 4. Application rollback (non-DR)

Prefer image tag rollback before DB restore:

```bash
cd /var/www/TUBAALHIJAZ/infra
sed -i 's/^API_IMAGE_TAG=.*/API_IMAGE_TAG=<previous>/' .env
# optionally WEB_IMAGE_TAG
docker compose -f docker-compose.prod.yml up -d api web
```

Known local API tags (ESP-06): `esp06-20260802`, `stable-20260731`, `rc1-20260731`.

Schema is **forward-only** — rolling back code after a migration may leave additive columns (usually safe) but cannot undo destructive migrations without restore.

---

## 5. Recovery objectives (targets)

| Metric | Target | Notes |
|--------|--------|-------|
| RPO | ≤ 24h | Nightly dump; improve with offsite + denser schedule if required |
| RTO (scratch-proven restore) | ≤ 1h | Small DB today; grows with data |
| RTO (full host loss) | Undefined until offsite + runbook drill | **Condition** |

---

## 6. Incident severity → action

| Scenario | First action |
|----------|--------------|
| Bad release (app bug) | Image rollback |
| Bad migration / data corruption | Stop writers → restore dump |
| Redis loss | Restart redis; queues rebuild; may lose in-flight jobs |
| MinIO loss | Restore volume/offsite; DB still authoritative for metadata |
| Host loss | Rebuild from compose + restore DB + restore MinIO + `.env` |

---

## 7. DR improvement backlog (not blocking ESP-06 GO WITH CONDITIONS)

1. Enable `OFFSITE_*` in `backup.sh` / `.env`.  
2. Quarterly **destructive** restore drill on staging or maintenance window.  
3. Document secrets offline escrow.  
4. Add swap / alerting for memory.  
5. Prune unused Docker images to protect disk headroom.

---

## 8. ESP-06 verification record

| Item | Result |
|------|--------|
| Dump file | `/var/backups/tuba/tubaalhijaz-20260802-020247.sql.gz` |
| Scratch DB | `tuba_restore_test` created → restore OK → dropped |
| Counts observed | `User=2`, `Group=2` (thin prod) |
| Operator | ESP-06 readiness run |
