# PRODUCTION READINESS — TUBA AL HIJAZ ERP v2.0

**Program:** Enterprise Stabilization **ESP-06**  
**Certification date:** 2026-08-02  
**Type:** Release engineering & operational readiness audit  
**Code freeze (business):** No business-logic / schema / API-contract / UI / RBAC / workflow / automation / finance / visa / Long Stay rule changes in this sprint  

**SSOT inputs:** `docs/releases/*`, `docs/stabilization/*`, `docs/uat/*`, `docs/ui/*`, live host evidence  

Companion package:

| Document | Purpose |
|----------|---------|
| [`DEPLOYMENT_CHECKLIST.md`](./DEPLOYMENT_CHECKLIST.md) | Pre/during/post deploy steps |
| [`DISASTER_RECOVERY.md`](./DISASTER_RECOVERY.md) | Backup / restore / RTO notes |
| [`OPERATIONS_RUNBOOK.md`](./OPERATIONS_RUNBOOK.md) | Day-2 ops (points to root `RUNBOOK.md`) |
| [`RELEASE_NOTES_v2.0.md`](./RELEASE_NOTES_v2.0.md) | What ships as v2.0 |

---

## 1. Scope

Verify production deployment readiness of the ERP stack (compose, DB, API/Web, workers, storage, monitoring, backup/restore, rollback).  

**Allowed fixes:** verified deployment / operational issues only.  

**ESP-06 ops fixes applied this session:**

1. Rebuilt & deployed API image `tuba-alhijaz/tuba-alhijaz-api:esp06-20260802` (includes ESP-04 `REFRESH_COOKIE_PATH` + related security hardening already in source).  
2. Confirmed live env `REFRESH_COOKIE_PATH=/api/auth`, `COOKIE_SECURE=true`.  
3. Started monitoring stack (`docker-compose.monitoring.yml`) — was down.  
4. Scratch-DB restore verification of latest nightly dump — **PASS**.

---

## 2. Infrastructure status (live 2026-08-02)

| Check | Result | Evidence |
|-------|--------|----------|
| Compose prod stack | **PASS** | api/web/postgres/redis/minio healthy; bind `127.0.0.1` |
| Restart policy | **PASS** | `unless-stopped` on app services |
| Memory limits | **PASS** | api 768M · web 128M · postgres 768M · redis 256M · minio 512M |
| CPU limits | **PASS** | api 1.0 CPU (compose deploy limits) |
| Disk | **PASS** | root ~56% used · ~43G free |
| Host memory | **PASS** | ~7.8G · ~4.3G available |
| Swap | **CONDITION** | Swap **0B** — OOM risk under spike |
| Volumes | **PASS** | `pgdata`, `redisdata`, `miniodata` present |
| e2e leftover containers | **CONDITION** | `tuba-e2e-pg` / `tuba-e2e-redis` still Up (non-prod; reclaim optional) |

### API / Web images

| Service | Tag | Status |
|---------|-----|--------|
| API | `esp06-20260802` | Healthy; workers listening |
| Web | `stable-20260731` | Healthy (no ESP-06 web rebuild required for cookie fix) |

---

## 3. Database

| Check | Result | Notes |
|-------|--------|-------|
| Migrations | **PASS** | Through `20260801170000_longstay_day85` |
| Indexes | **PASS** | 204 public indexes |
| Connections | **PASS** | `max_connections=100`; ~11 active at sample |
| Nightly backup timer | **PASS** | `tuba-backup.timer` active; next ~02:00 UTC |
| Latest dump | **PASS** | `/var/backups/tuba/tubaalhijaz-20260802-020247.sql.gz` + MinIO daily/weekly |
| Scratch restore | **PASS** | Restored to `tuba_restore_test`; User=2 Group=2; dropped |
| Offsite copy | **CONDITION** | `offsite=disabled` in backup log |
| Destructive prod restore drill | **NOT RUN** | Documented; deferred (accepted risk) |

---

## 4. Web / API security & edge

| Check | Result | Notes |
|-------|--------|-------|
| HTTPS | **PASS** | Let’s Encrypt + Cloudflare; home 200 |
| `/api/health` | **PASS** | 200 via nginx |
| `/api/metrics` edge | **PASS** | **404** deny (S1-04) |
| Security headers | **PASS** | nosniff, SAMEORIGIN, Referrer-Policy |
| Gzip | **PASS** | `content-encoding: gzip` on home |
| Cache-Control SPA | **PASS** | `no-cache` on HTML |
| `COOKIE_SECURE` | **PASS** | `true` in container |
| `REFRESH_COOKIE_PATH` | **PASS** (after ESP-06 deploy) | `/api/auth` live |
| CORS | **PASS** | `CORS_ORIGIN=https://tubaalhijaz.com` |
| JWT TTL | **PASS** | `15m` |
| JWT weak secret boot guard | **PASS** | ESP-04 code in `esp06` image |

---

## 5. Workers & queues

| Check | Result |
|-------|--------|
| `tuba-automation` / `tuba-notify` / `tuba-ocr` listening | **PASS** |
| Repeatable jobs registered (4, incl. Day-85) | **PASS** (boot log) |
| Failed queue depths (sample) | **PASS** (0) |
| Dead-letter product | **N/A** — BullMQ failed lists; no separate DLQ product |

---

## 6. Monitoring

| Check | Result |
|-------|--------|
| Prometheus / Grafana / exporters / cAdvisor | **PASS** (started ESP-06) |
| Prometheus `api` scrape | **PASS** (`health: up`) |
| Grafana loopback | **PASS** `127.0.0.1:3007` |
| Nginx access/error logs | **PASS** `/var/log/nginx/tubaalhijaz.*.log` |
| App logs | **PASS** `docker logs tuba-alhijaz-api-1` |

---

## 7. Storage

| Check | Result |
|-------|--------|
| MinIO healthy | **PASS** |
| Buckets | **PASS** `tuba-docs`, `tuba-backups` |
| MinIO data size | **PASS** ~8.1M (thin prod) |
| Upload validation | **PASS** (ESP-04 audit) — MIME/size/magic-byte |

---

## 8. Documentation & UAT gates

| Gate | Status |
|------|--------|
| TRANSFORM-001/002 technical cert | PASS (prior) |
| UI-12 | Conditional kit pass |
| ESP-01…04 | Documented; ESP-04 now **deployed** on API |
| ESP-05 UAT package | **Prepared** — human execution / signatures **not frozen** |
| TRANSFORM business sign-off | **Pending** human |

---

## 9. Remaining risks

| ID | Risk | Severity | Mitigation |
|----|------|----------|------------|
| R1 | Human UAT / MD sign-off incomplete | High (process) | Execute `docs/uat/*` before business GO |
| R2 | Offsite backups disabled | High (DR) | Configure `OFFSITE_*` or external copy |
| R3 | No destructive restore drill | Medium | Schedule per DR doc |
| R4 | Swap disabled | Medium | Add swap or raise memory alerts |
| R5 | Thin production data | Low | Expected early ops |
| R6 | Docker image/build cache disk (~16G images) | Medium | Periodic prune of unused tags |
| R7 | e2e containers left running | Low | Stop when idle |
| R8 | Web image lag vs API ESP-06 | Low | Rebuild web when shipping ESP-03 bundle to prod if not already baked |
| R9 | No live government visa API | Accepted | Staff updates only |

---

## 10. GO / NO-GO decision

### Scoring

| Dimension | Score | Notes |
|-----------|-------|-------|
| Infrastructure | **PASS** | Healthy stack + limits |
| Security | **PASS** | HTTPS, cookies Path fixed, metrics denied, ESP-04 API live |
| Performance | **PASS w/ watch** | ESP-03 web may still be prior image; host load low |
| Documentation | **PASS** | This package + RUNBOOK + UAT pack |
| Operations | **PASS** | Workers, timers, monitoring up |
| Monitoring | **PASS** | Stack started; scrape OK |
| Backups | **PASS w/ conditions** | Nightly + scratch restore OK; offsite off |
| Recovery | **CONDITIONAL** | Scratch restore verified; prod drill deferred |

### Decision

# **GO WITH CONDITIONS**

**Technical / operational production readiness:** YES for continued production operation of the current ERP (v2.0 stack on this host).

**Conditions (must track):**

1. Complete human UAT + [`docs/uat/UAT_SIGNOFF.md`](../uat/UAT_SIGNOFF.md) before declaring **business** go-live complete.  
2. Enable offsite backup or document explicit MD acceptance of on-box-only DR.  
3. Schedule destructive restore drill within 30 days.  
4. Users must **re-login** after ESP-06 API deploy (cookie Path change).  
5. Add swap or memory alert runbook note.  

**Not NO-GO** because: stack healthy, migrations current, backups producing restorable dumps, workers up, security cookie Path fixed & verified in container, monitoring restored.

---

## 11. Rollback readiness

| Path | Ready? |
|------|--------|
| Soft flag rollback (OCR / WA / MOFA bill) | **YES** — see TRANSFORM rollback docs |
| API image rollback to `stable-20260731` / `rc1-20260731` | **YES** — local images present |
| Web image rollback | **YES** — prior tags local |
| Schema reverse | **NO** (forward-only) — restore dump instead |
| Backup → scratch verified | **YES** (ESP-06) |

---

## 12. Final report

1. **Scope** — §1  
2. **Infrastructure** — §2  
3. **Deployment readiness** — API `esp06-20260802` live; checklist in companion doc  
4. **Backup & recovery** — nightly OK; scratch restore OK; offsite/prod drill conditional  
5. **Monitoring** — stack started; API target up  
6. **Remaining risks** — §9  
7. **Decision** — **GO WITH CONDITIONS**  
8. **Rollback readiness** — §11  

**STOP:** No features, no redesign, no business-rule changes in ESP-06.
