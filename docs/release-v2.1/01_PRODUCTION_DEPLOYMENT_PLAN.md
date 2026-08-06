# 01 · PRODUCTION DEPLOYMENT PLAN — v2.1

**Objective:** Promote the frozen v2.1 Release Candidate to production with zero code changes.
**Architecture:** pnpm monorepo — `packages/shared` (build first), `apps/api` (NestJS 11 + Prisma 6), `apps/web` (React 18 + Vite). Datastores: PostgreSQL, Redis, MinIO/S3.
**Deploy window:** low-traffic window; expect a short API restart. Web is static and can be swapped atomically.

---

## 0. Roles
- **Release Lead** — runs the sequence, holds the Go/No-Go.
- **DBA** — executes migrations (Doc 02).
- **On-call** — watches monitoring (Doc 06), ready for rollback (Doc 03).

## 1. Pre-Deployment Prerequisites (all must be TRUE)
1. Go/No-Go checklist (Doc 09) signed.
2. **Full database backup taken and restore-tested** (mandatory — this is the rollback anchor).
3. Production secrets set (NOT dev values): `JWT_SECRET`, `DATABASE_URL`, `MINIO_ACCESS_KEY`/`MINIO_SECRET_KEY`.
4. WaSender production credentials available (can be entered post-deploy via WaSender Config screen).
5. Current production app version/image tag recorded for rollback.
6. Maintenance/notice posted if policy requires.

## 2. Required Environment Variables (names — set real production values)
**API:** `NODE_ENV=production`, `HOST`, `PORT`, `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_DAYS`, `CORS_ORIGIN`, `WEB_ORIGIN`, `COOKIE_SECURE=true`, `REFRESH_COOKIE_PATH`, `REDIS_URL`, `MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_USE_SSL`, `STORAGE_BUCKET`.
**WaSender (optional at boot — can be set later in-app, stored AES-256-GCM encrypted):** `WASENDER_API_URL`, `WASENDER_API_KEY`, `WASENDER_DEFAULT_COUNTRY`, `WASENDER_DEVICE_ID`.
**Web build-time:** `VITE_API_URL` (production API origin).

## 3. Build (from a clean checkout of the frozen RC)
```bash
pnpm install --frozen-lockfile
pnpm build:shared                      # packages/shared MUST build first
pnpm --filter @tuba/api build          # → apps/api/dist
pnpm --filter @tuba/web build          # → apps/web/dist (uses VITE_API_URL)
```
Gate: both builds succeed; `tsc --noEmit` clean (already verified on RC).

## 4. Deployment Sequence
1. **Backup** confirmed (Step 1.2).
2. **Apply migrations** — follow Doc 02 exactly (`prisma migrate deploy`). Migrations do **not** auto-run on API boot; they are applied deliberately here.
3. **Deploy API** — ship `apps/api/dist` (or image), start with `node dist/main.js` (`start:prod`). Confirm process healthy.
4. **Deploy Web** — publish `apps/web/dist` to the static host/CDN (atomic swap). Purge CDN cache if applicable.
5. **Health check** — `GET /health` returns 200.
6. **Smoke test** — run Doc 04.
7. **Post-deploy verification** — run Doc 05.
8. **Configure WaSender** (if not via env) — WaSender Config screen → save credentials → live status green → test send.
9. **Seed policy config** — SLA hours, approval matrix, notification templates per business policy (see Doc 05 §Config).
10. **Enable monitoring** — Doc 06.
11. **Announce** — release complete; on-call remains for the observation window.

## 5. Deployment Characteristics
- **Migrations are additive** (new enums/tables/columns; nullable or defaulted) → the previous API version keeps running against the migrated DB during the window (expand phase). This makes the DB migration safe to run before the app swap.
- **No destructive DDL** in the v2.1 set → forward-only; no data backfill required for existing rows.
- **Impersonation tokens** are 30-min and non-refreshable; no session migration needed.

## 6. Abort Criteria (→ Rollback, Doc 03)
- Migration fails or partially applies.
- `/health` not 200 after API start.
- Any smoke-test **critical** check fails.
- Auth/login broken for staff or agents.

## 7. Sign-off
- [ ] Build succeeded · [ ] Migrations applied (Doc 02) · [ ] Health 200 · [ ] Smoke pass (Doc 04) · [ ] Post-deploy pass (Doc 05) · [ ] Monitoring on (Doc 06)
- Release Lead: __________  Date/Time: __________
