# TRANSFORM-002 — Final Checklist (T002-10)

**Date:** 2026-08-01  
**Architecture:** Smoke across pipeline + LS + bill; sign-off  
**Code freeze:** No feature / schema / API / UI changes

Use this as the operator runbook for the acceptance gate. Mark each box during the certification window.

---

## A. Pre-flight (docs)

| # | Check | Done |
|---|-------|:----:|
| A1 | Read `analysis/TRANSFORM_002_ARCHITECTURE.md` §17 T002-10 | ☑ |
| A2 | Confirm T001-01…10 completion docs present | ☑ |
| A3 | Confirm T002-01…09 completion docs present | ☑ |
| A4 | Confirm T001 release pack under `docs/releases/TRANSFORM_001/` | ☑ |
| A5 | Create T002 release pack (this folder’s four files) | ☑ |

---

## B. Automated regression

| # | Check | Done | Evidence |
|---|-------|:----:|----------|
| B1 | API `tsc --noEmit` | ☑ | PASS |
| B2 | Web `tsc --noEmit` | ☑ | PASS |
| B3 | `nest build` | ☑ | PASS |
| B4 | `vite build` | ☑ | PASS |
| B5 | Full e2e (`test:e2e` / jest e2e runInBand) | ☑ | **378/378** |
| B6 | Pipeline + embassy + visa notify suites | ☑ | PASS |
| B7 | Long Stay host + Day-85 suites | ☑ | PASS |
| B8 | MOFA processing + dashboards suites | ☑ | PASS |
| B9 | T001 smoke + intake notify + OCR suites | ☑ | PASS |
| B10 | RBAC agent 403 on `/dashboards/*` and staff desks | ☑ | PASS |

---

## C. Production runtime

| # | Check | Done | Evidence |
|---|-------|:----:|----------|
| C1 | `docker compose ps` — api/web/postgres/redis/minio healthy | ☑ | Healthy |
| C2 | API `/health` 200 | ☑ | ok |
| C3 | Web 200 behind nginx | ☑ | 200 |
| C4 | HTTPS nginx config test + :443 listen | ☑ | OK |
| C5 | `COOKIE_SECURE=true` | ☑ | Set |
| C6 | Workers: automation / notify / OCR listening | ☑ | Boot logs |
| C7 | 4 repeatable jobs registered (incl. day-85) | ☑ | Scheduler log |
| C8 | BullMQ failed depths = 0 | ☑ | Redis LLEN |
| C9 | AR-VISA-01…03 + AR-LS-85/90 + SYS_LONGSTAY_DAY85 enabled | ☑ | Live DB |
| C10 | Migrations through `longstay_day85` applied | ☑ | `_prisma_migrations` |
| C11 | Feature flag decisions recorded (defaults OK) | ☑ | Cert §3 |
| C12 | Nightly backup timer active + recent `.sql.gz` | ☑ | `tuba-backup.timer` |
| C13 | Rollback image `rc1-20260731` present | ☑ | `docker images` |
| C14 | Running image digests recorded | ☑ | Cert §3 |
| C15 | Destructive restore drill | ☐ | **Deferred** (RUNBOOK §3) |

---

## D. Business smoke (human — pending signatures)

| # | Check | Done |
|---|-------|:----:|
| D1 | Staff login → Visa Desk walk one mutamer transition | ☐ |
| D2 | Confirm agent cannot transition / cannot open `/dashboards` | ☐ |
| D3 | Long Stay host register + entry date → Day-85 marker visible | ☐ |
| D4 | Dashboard Visa & Compliance KPIs match desk | ☐ |
| D5 | Finance decision on MOFA Bill flag recorded | ☐ |
| D6 | Visa SOP decision on passport-return flag recorded | ☐ |
| D7 | Sign `TRANSFORM_002_BUSINESS_SIGNOFF.md` | ☐ |

---

## E. Documentation currency

| # | Check | Done | Note |
|---|-------|:----:|------|
| E1 | Architecture matches implemented pipeline / LS / bill | ☑ | |
| E2 | Completion docs T001+T002 present | ☑ | |
| E3 | `docs/DASHBOARDS.md` includes `/visa` | ☑ | |
| E4 | RUNBOOK backup/restore current | ☑ | |
| E5 | Feature Status Matrix updated for T002 | ☐ | **Deferred** |
| E6 | User Guide published | ☐ | **Deferred** |
| E7 | Honesty copy (no Direct NUSUK/MOFA API sync) | ☑ | T002-09 |

---

## F. Release decision gate

| # | Check | Done |
|---|-------|:----:|
| F1 | Technical recommendation recorded | ☑ **GO WITH ACCEPTED RISKS** |
| F2 | Residual risks published (nothing hidden) | ☑ |
| F3 | Business signatures collected | ☐ |
| F4 | Explicit written hold on Transformation-003 | ☑ |

---

## G. If a blocking defect appears

1. **STOP** feature work.  
2. Record defect in certification addendum.  
3. Fix **only** if Managing Director / IT Manager explicitly approve a freeze exception.  
4. Re-run the failing suite + full e2e before re-certifying.

---

## Quick commands (read-only / non-destructive)

```bash
# Health
curl -s http://127.0.0.1:3210/health

# Containers
docker ps --format '{{.Names}}\t{{.Status}}' | grep tuba

# Migrations
docker exec tuba-alhijaz-postgres-1 psql -U tuba -d tubaalhijaz \
  -c "SELECT migration_name FROM _prisma_migrations ORDER BY finished_at;"

# Automation rules
docker exec tuba-alhijaz-postgres-1 psql -U tuba -d tubaalhijaz \
  -c "SELECT code, enabled FROM \"AutomationRule\" WHERE code LIKE 'AR-VISA%' OR code LIKE 'AR-LS%' OR code LIKE 'SYS_LONG%';"

# Queue failed depths
docker exec tuba-alhijaz-redis-1 redis-cli LLEN tuba:tuba-automation:failed
docker exec tuba-alhijaz-redis-1 redis-cli LLEN tuba:tuba-notify:failed

# E2e (against e2e DB — not production)
# cd apps/api && pnpm test:e2e   # with DATABASE_URL / REDIS_URL / MinIO as in RUNBOOK
```

**Do not** run DROP DATABASE restore against production without an approved change window.
