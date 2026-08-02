# TUBA AL HIJAZ — Production Go-Live Report

**Date:** 2026-07-31 (UTC validation window ~22:59–23:02)  
**Mode:** Audit only — **no code or config changes**  
**Release tag:** `rc1-20260731`  
**Prior artifacts:** [`RELEASE_CANDIDATE_REPORT.md`](./RELEASE_CANDIDATE_REPORT.md) (NO-GO) → [`RC_BLOCKER_RESOLUTION.md`](./RC_BLOCKER_RESOLUTION.md) (blockers closed)

---

## 1. Executive Summary

Sprint 1 security work is **live** on production images `rc1-20260731`. RC blockers (backup, Secure cookies, image deploy) are verified closed. App stack containers are healthy; HTTPS serves the site; `/api/metrics` is edge-denied; Prisma schema is up to date; automated suite is **204/204** green; TypeScript and production builds pass.

**Verdict: GO** for Sprint 1 **secure production launch**, with **accepted residual risks** (monitoring stack down, notifications WebSocket unauthenticated, dual fleet-expiry schedulers, SoT doc drift, Sprint 2 operator UIs still ComingSoon).

---

## 2. Validation Results

| Area | Result | Evidence |
|---|---|---|
| Backup service | ✅ PASS | `backup.sh` LF + `0755`; timer **active/enabled**; last service Result=`success`; log `backup OK` 34320 bytes |
| Restore procedure | ✅ PASS | Scratch load of newest dump into `tuba_golive_restore_test` succeeded; documented in `RUNBOOK.md` §3 |
| API image version | ✅ PASS | Live `tuba-alhijaz/tuba-alhijaz-api:rc1-20260731` healthy |
| Web image version | ✅ PASS | Live `tuba-alhijaz/tuba-alhijaz-web:rc1-20260731` healthy |
| Environment variables | ✅ PASS | `COOKIE_SECURE=true`, `NODE_ENV=production`, `BIND_ADDR=127.0.0.1`, tags=`rc1-20260731`, `VITE_API_URL`/`WEB_ORIGIN` HTTPS |
| Secure cookies | ✅ PASS | Login `Set-Cookie: … HttpOnly; Secure; SameSite=Lax` |
| HTTPS | ✅ PASS | `https://tubaalhijaz.com/` 200; `/api/health` 200; cert CN=`tubaalhijaz.com` valid through 2026-10-05 |
| OCR | ✅ PASS | Live `GET /ocr/documents` 200 (staff JWT); AGENT approve → **403** `REVIEW_OCR_QUEUE`; e2e `ocr-rbac` green |
| Upload confirmation | ✅ PASS | Empty confirm → **400** (confirmToken required); e2e `upload-confirm` green |
| Documents Vault | ✅ PASS | Live `GET /documents` 200; AgentPortal maps `documents` → `DocumentsVaultScreen`; e2e `documents` green |
| Ops WebSocket | ✅ PASS | Anon → Unauthorized; JWT + `VIEW_DASHBOARD` → connect OK; e2e `ops-ws-auth` green |
| Metrics protection | ✅ PASS | Edge `/api/metrics` **404**; loopback `/metrics` 200 (scrape path) |
| RBAC | ✅ PASS | API PermissionsGuard (e2e); FE `rbac.selftest` exit 0; agent OCR 403 live |
| Docker containers | ✅ PASS | api/web/postgres/redis/minio **healthy** |
| Health endpoints | ✅ PASS | API `/health` 200; web `:8095` 200 |
| Monitoring | ⚠️ FAIL / waived | No Prometheus/Grafana/exporter containers running |
| Build artifacts | ✅ PASS | `pnpm` shared/api/web typecheck + `pnpm build` OK; images `rc1-20260731` present |
| Documentation consistency | ⚠️ CONDITIONAL | RC resolution + RUNBOOK + backlog/matrix current; PRODUCT/GAP §2/§4 + old RC report still stale in places |
| Prisma / DB | ✅ PASS | 11 migrations; live **up to date** |
| Automated e2e | ✅ PASS | **15 suites / 204 tests** passed |

---

## 3. Remaining Risks

| Severity | Risk | Notes |
|---|---|---|
| **High** | Monitoring stack not running | No Prom/Grafana/exporters — ops visibility limited to logs/health |
| **High** | Notifications WS unauthenticated | Gateway joins rooms from query params; SPA uses REST today |
| **Medium** | Dual 06:00 fleet expiry | Nest cron + BullMQ; notify codes reduce double-alerts (S2-08) |
| **Medium** | Offsite backups disabled | `OFFSITE_*` unset — on-box MinIO only |
| **Medium** | Notify channels stubbed | SMTP/WA blank → stub/skip delivery |
| **Medium** | SoT doc drift | PRODUCT L84/L115; GAP §2 Ops WS / Frontend authz; RELEASE_CANDIDATE_REPORT still reads as NO-GO snapshot |
| **Medium** | Orphan permissions | `ACCESS_AUDIT_LOGS`, `API_KEY_ACCESS` seeded, not route-enforced |
| **Low** | Finance/Automation UI ComingSoon | Intentional Sprint 2 |
| **Low** | `minio/minio:latest` unpinned | Reproducibility |
| **Low** | Public ComingSoon routes without auth | `/mobile-apps`, `/tablet`, etc. |

---

## 4. Production Readiness Score

### **Score: 86 / 100**

| Dimension | Weight | Score | Notes |
|---|---:|---:|---|
| Compile / production build | 15 | 100 | shared + web + api |
| Automated tests | 15 | 100 | 204/204 e2e |
| Sprint 1 security (source + live) | 15 | 95 | OCR, upload, ops WS, FE RBAC, vault, metrics |
| Live deploy = release tag | 15 | 95 | both services on `rc1-20260731` |
| Backups / restore | 15 | 95 | systemd OK; scratch restore OK; offsite optional |
| Runtime security hygiene | 10 | 75 | cookies/HTTPS OK; notify WS residual |
| Observability | 5 | 20 | monitoring compose not running |
| Operator product surface | 5 | 45 | core portals live; staff finance/automation hidden |
| Documentation accuracy | 5 | 60 | ops truth OK; SoT contradictions remain |

Previous RC audit: **58 / NO-GO**. Delta driven by RC-01/02/03 closure and live image alignment.

---

## 5. GO / NO-GO

### **GO**

Approve production operation on tag **`rc1-20260731`** for the Sprint 1 secure-launch scope.

| Gate | Status |
|---|---|
| RC-01 backup + restore | GO |
| RC-02 Secure cookies | GO |
| RC-03 image deploy | GO |
| Sprint 1 security live smoke | GO |
| Builds / e2e | GO |
| Monitoring | **Accepted risk** (waive or start stack in Sprint 2) |
| Notifications WS | **Accepted risk** until S2 hardening |
| Full operator ERP (Finance/Automation UI) | Not required for this GO |

**Authority for live status:** this report + `RC_BLOCKER_RESOLUTION.md` + `RUNBOOK.md`. Do not treat `RELEASE_CANDIDATE_REPORT.md` alone as current (it is a historical NO-GO snapshot).

---

## 6. Smoke Test Results

| # | Check | Result |
|---|---|---|
| 1 | API `/health` | ✅ 200 `status:ok` |
| 2 | Web local `:8095` | ✅ 200 |
| 3 | HTTPS home + `/api/health` | ✅ 200 / 200 |
| 4 | Edge `/api/metrics` | ✅ 404 |
| 5 | Loopback `/metrics` | ✅ 200 |
| 6 | Containers healthy (5 core) | ✅ |
| 7 | Images `rc1-20260731` | ✅ api + web |
| 8 | `COOKIE_SECURE=true` | ✅ |
| 9 | Login cookie `Secure`+`HttpOnly` | ✅ |
| 10 | `GET /documents` (staff JWT) | ✅ 200 |
| 11 | `GET /ocr/documents` (staff) | ✅ 200 (10 items) |
| 12 | AGENT OCR approve | ✅ 403 Missing `REVIEW_OCR_QUEUE` |
| 13 | Upload confirm without token | ✅ 400 validation |
| 14 | Ops WS anon | ✅ Unauthorized |
| 15 | Ops WS with JWT | ✅ connected |
| 16 | Backup artifact ≥ 34 KiB | ✅ |
| 17 | Scratch restore | ✅ |
| 18 | TLS cert `tubaalhijaz.com` | ✅ valid |
| 19 | E2E suite | ✅ 204 passed |
| 20 | FE RBAC selftest | ✅ exit 0 |

Ephemeral smoke users were created and **deleted** after probes.

---

## 7. Rollback Readiness

| Layer | Ready? | Method |
|---|---|---|
| API image | ✅ | `API_IMAGE_TAG=web-m11` (or prior) `compose up -d --no-deps api` |
| Web image | ✅ | `WEB_IMAGE_TAG=web-m17` (or prior) `compose up -d --no-deps web` |
| DB data | ✅ Improved | Nightly `pg_dump` gzip + `RUNBOOK.md` §3.1 scratch / §3.2 prod restore |
| Cookies / env | ✅ | Revert `COOKIE_SECURE` in `.env` + recreate api |
| Nginx metrics deny | ⚠️ Keep | Removing deny re-exposes scrape text |

**Rollback readiness: ADEQUATE** for image/env; **data restore proven** on scratch DB (not exercised against production DB in this audit).

---

## 8. Release Tag

| Field | Value |
|---|---|
| **Tag** | `rc1-20260731` |
| API | `tuba-alhijaz/tuba-alhijaz-api:rc1-20260731` |
| Web | `tuba-alhijaz/tuba-alhijaz-web:rc1-20260731` |
| Env alignment | `IMAGE_TAG` / `API_IMAGE_TAG` / `WEB_IMAGE_TAG` = `rc1-20260731` |
| Scope | Sprint 1 security + RC blocker fixes (backup, cookies, deploy) |

---

## 9. Recommended Next Sprint

**Sprint 2 — Operator readiness** (from `SPRINT_BACKLOG.md`):

1. **S2-01 → S2-03** — Audit log read API (`ACCESS_AUDIT_LOGS`) + broader writes + UI  
2. **S2-04 / S2-05** — Unhide FinanceERP + AutomationNotifications with permission gates  
3. **S2-06 → S2-08** — Unify notify dispatch; dedupe 06:00 expiry  
4. **S2-09** — Full OCR pipeline e2e  
5. **S2-10** — Staging/CI verification  

Also: start monitoring stack (or keep written waiver); harden/disable notifications WS; **S1-08** phase-doc drift if documentation must be fully GO-clean.

---

## Appendix — Automated validation commands (this run)

- `pnpm --filter @tuba/api lint` · `@tuba/web typecheck` · `@tuba/web test:rbac` · `pnpm build` → PASS  
- Ephemeral Postgres/Redis e2e → **15/15 suites, 204/204 tests** PASS  
- Live probes as §6  

---

*End of Production Go-Live Report — audit only.*
