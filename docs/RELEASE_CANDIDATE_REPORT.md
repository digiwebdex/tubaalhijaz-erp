# TUBA AL HIJAZ — Release Candidate Validation Report

**Date:** 2026-07-31  
**Scope:** Full-project audit after Sprint 1 implementation close  
**Mode:** Audit only — **no code or config changes**  
**Workspace:** `/var/www/TUBAALHIJAZ`  
**Companions:** [`SPRINT1_COMPLETION_REPORT.md`](./SPRINT1_COMPLETION_REPORT.md), [`SPRINT_BACKLOG.md`](./SPRINT_BACKLOG.md), [`DOCUMENT_CONFLICTS.md`](./DOCUMENT_CONFLICTS.md)

---

## 1. Executive Summary

Sprint 1 **source** is in good shape: TypeScript clean, production builds succeed, Docker images build, Prisma migrate deploy applies all **11** migrations, and the full API e2e suite is **204/204 green** (including OCR RBAC, upload confirm, ops WS auth). Frontend RBAC selftest passes. Nginx edge correctly denies `/api/metrics` (404).

The **live production stack is not an RC** of that source:

| Live | Tag / state |
|---|---|
| API | `tuba-alhijaz/tuba-alhijaz-api:web-m11` (healthy, 3d) |
| Web | `tuba-alhijaz/tuba-alhijaz-web:web-m17` (healthy, 36h) |
| `.env` tags | `IMAGE_TAG` / `API_IMAGE_TAG` / `WEB_IMAGE_TAG` = `web-m13` (drift vs running) |
| Postgres / Redis / MinIO | Healthy; bind `127.0.0.1` |
| Monitoring compose | **Not running** |
| `tuba-backup.service` | **Failed** (`203/EXEC`); `backup.sh` has **CRLF** + non-executable mode |

**Recommendation: NO-GO** for promoting this host to a Sprint 1 Release Candidate until backups work, Sprint 1 API/web images are deployed and smoked, and `COOKIE_SECURE` is corrected for HTTPS.

---

## 2. Production Readiness Score (0–100)

### **Score: 58 / 100**

| Dimension | Weight | Score | Notes |
|---|---:|---:|---|
| Compile / production build | 15 | 100 | shared + web + api build OK |
| Automated tests | 15 | 100 | 15 suites / 204 tests passed |
| Sprint 1 security in **source** | 15 | 95 | OCR, upload confirm, ops WS, FE RBAC, vault, metrics nginx |
| Live deploy = RC source | 15 | 25 | API still `web-m11`; tag drift vs `.env` |
| Backups / restore posture | 15 | 10 | systemd backup failed; no reliable nightly dump |
| Runtime security hygiene | 10 | 40 | `COOKIE_SECURE=false`; notifications WS unauthenticated |
| Observability | 5 | 20 | Prometheus/Grafana stack not running |
| Operator product surface | 5 | 40 | Finance/Automation UI ComingSoon (Sprint 2) |
| Documentation accuracy | 5 | 55 | Sprint SoT mostly OK; residual stale rows in GAP/PRODUCT |

Weighted total ≈ **58**.

---

## 3. Critical Issues

| # | Issue | Evidence |
|---|---|---|
| C1 | **Database backup pipeline broken** | `tuba-backup.timer` active; `tuba-backup.service` failed since ≥ 2026-07-30 with `status=203/EXEC`. `infra/backup.sh` is mode `664` and **CRLF** (`file` reports CRLF line terminators). `/var/backups/tuba/` empty. |
| C2 | **Live API image predates Sprint 1 security** | Running `api:web-m11` while Sprint 1 code lives in workspace. RC cannot be claimed on this host until API (and matching web) images are rebuilt/redeployed and smoked. |
| C3 | **BullMQ “daily backup” is not a real dump** | Scheduler reports OK with ~254B JSON manifests when `pg_dump` is absent from the API image — false confidence if operators treat queue job as backup. |

---

## 4. High Priority Issues

| # | Issue | Evidence |
|---|---|---|
| H1 | **`COOKIE_SECURE=false` on HTTPS production** | Live API env `COOKIE_SECURE=false` while site is served over TLS (`https://tubaalhijaz.com`). Refresh cookies lack `Secure`. |
| H2 | **Notifications WebSocket unauthenticated** | `apps/api/src/notifications/notifications.gateway.ts` joins rooms from handshake query `userId`/`tenantId` with no JWT. SPA currently uses REST polling only — surface still exists if clients connect. |
| H3 | **Monitoring stack not running** | `docker-compose.monitoring.yml` has no live containers; no Prometheus/Grafana/exporters on host. |
| H4 | **Dual 06:00 fleet expiry schedulers** | Nest `@Cron` in `fleet/expiry.service.ts` **and** BullMQ `expiry-escalation` in automation scheduler — tracked as S2-08 / G-09. Idempotent notify codes mitigate double-alerts but dual scan remains. |
| H5 | **Image tag drift** | Running api `web-m11` / web `web-m17` vs `.env` `web-m13`. Bare compose redeploy risk. |
| H6 | **Orphan seeded permissions** | `ACCESS_AUDIT_LOGS`, `API_KEY_ACCESS` seeded and role-assigned but **no** `@RequirePermissions` route enforcement (audit read API missing — Sprint 2). |
| H7 | **SoT doc rows still claim Sprint 1 gaps open** | `PRODUCT_MASTER_SPEC.md` L84 (“Frontend does not yet hide modules”); L115 Documents “UI partially hidden”; `GAP_ANALYSIS.md` §2 Ops WS 🔴, Frontend authz 🔴; §4 Security AuthZ UI / OCR authz 🔴 — contradict G-register, code, and `SPRINT1_COMPLETION_REPORT.md`. |

---

## 5. Medium Priority Issues

| # | Issue | Evidence |
|---|---|---|
| M1 | Staff **FinanceERP** / **AutomationNotifications** still route-`ComingSoon` | Intentional Sprint 2; APIs live — operator expectation risk. |
| M2 | Public ComingSoon routes without `RequireAuth` | `/mobile-apps`, `/tablet`, `/design-system`, `/i18n-system`. |
| M3 | Upload multipart/presign remain `@Public()` | Confirm hardened (S1-02); residual anonymous abuse surface. |
| M4 | FE `EDIT_FINANCIAL_RECORDS` unused in UX gates | API still enforces; SPA write UX not permission-filtered. |
| M5 | Offsite backup vars unset | `OFFSITE_*` missing from live `.env`. |
| M6 | `minio/minio:latest` unpinned | Non-reproducible pulls. |
| M7 | Notify SMTP / WhatsApp env blank | Stub/skip delivery — OK if intentional for this host. |
| M8 | Redis exporter (when monitoring starts) targets db0 | BullMQ uses Redis **db3** in prod compose — metric gap. |
| M9 | Phase-doc drift (**S1-08**) | SCHEMA roles/migrations, AUTOMATION “OCR pending”, AUDIT routes, HARDENING IP claim, web README npm — see `DOCUMENT_CONFLICTS.md`. |
| M10 | Large web bundle warning | Vite chunk ~1.47 MB; not a functional fail. |

---

## 6. Low Priority Issues

| # | Issue |
|---|---|
| L1 | AgentPortal `support` + several group-detail tabs still ComingSoon |
| L2 | SuperAdmin nested OCR/Automation/Audit/AI/Settings ComingSoon |
| L3 | Prisma package.json seed config deprecation warning (Prisma 7 migration note) |
| L4 | Jest `forceExit` / open-handle warning after e2e |
| L5 | No root `README.md` / `CHANGELOG` |
| L6 | Workspace has no `.git` on this host (cannot verify ignore/remote from git) |
| L7 | Compose default `BIND_ADDR=0.0.0.0` in file; live correctly overrides to `127.0.0.1` |

---

## 7. Test Results

### Frontend

| Check | Result |
|---|---|
| `pnpm --filter @tuba/web typecheck` | **PASS** |
| `pnpm --filter @tuba/web test:rbac` (`rbac.selftest.ts`) | **PASS** (`rbac.selftest: OK`) |

### Backend e2e (ephemeral Postgres + Redis on `tuba-alhijaz_tuba`; MinIO from live stack; `OCR_PROVIDER=stub`)

| Suite | Result |
|---|---|
| `auth.e2e-spec.ts` | PASS |
| `rbac.e2e-spec.ts` | PASS |
| `ocr-rbac.e2e-spec.ts` | PASS |
| `upload-confirm.e2e-spec.ts` | PASS |
| `ops-ws-auth.e2e-spec.ts` | PASS |
| `ops.e2e-spec.ts` | PASS |
| `documents.e2e-spec.ts` | PASS |
| `finance.e2e-spec.ts` | PASS |
| `fleet.e2e-spec.ts` | PASS |
| `dashboards.e2e-spec.ts` | PASS |
| `notifications.e2e-spec.ts` | PASS |
| `automation.e2e-spec.ts` | PASS |
| `services-workflow.e2e-spec.ts` | PASS |
| `registration-pipeline.e2e-spec.ts` | PASS |
| `critical-path.e2e-spec.ts` | PASS |

**Totals: 15 suites passed, 204 tests passed, 0 failed** (≈38s, `--runInBand`).

### Domain coverage exercised by e2e

Auth · RBAC · OCR review perms · Uploads confirm · Documents vault · Finance · Ops REST · Ops WS auth · Fleet · Dashboards · Notifications · Automation · Registration · Service workflows · Critical payment/audit path.

---

## 8. Build Results

| Check | Result |
|---|---|
| `pnpm --filter @tuba/shared build` | **PASS** |
| `pnpm --filter @tuba/api lint` (`tsc --noEmit`) | **PASS** |
| `pnpm --filter @tuba/web typecheck` | **PASS** |
| `pnpm build` (shared + web Vite + api Nest) | **PASS** (web chunk-size warning only) |
| `docker build -f infra/Dockerfile.api` | **PASS** (tagged temporarily `tuba-rc-audit-api:tmp`, then removed) |
| `docker build -f infra/Dockerfile.web` | **PASS** (tagged temporarily `tuba-rc-audit-web:tmp`, then removed) |
| Prisma `migrate deploy` (e2e DB) | **PASS** — all 11 migrations applied |
| Prisma `migrate status` (live prod DB) | **PASS** — schema up to date |
| Broken imports (routes → pages) | **None found** |

---

## 9. Deployment Checklist

### Pre-deploy (blockers)

- [ ] Fix `infra/backup.sh` (LF endings, executable bit); confirm `tuba-backup.service` succeeds
- [ ] Verify a new `.sql.gz` lands in MinIO / local staging; document restore dry-run (`RUNBOOK.md`)
- [ ] Do **not** treat BullMQ backup job as DB backup until it runs real `pg_dump`
- [ ] Set `COOKIE_SECURE=true` in `infra/.env` for HTTPS
- [ ] Align `API_IMAGE_TAG` / `WEB_IMAGE_TAG` / `IMAGE_TAG` with images about to ship
- [ ] Rebuild API + web images from current Sprint 1 workspace
- [ ] Confirm host nginx still has `location ^~ /api/metrics { deny all; return 404; }`
- [ ] Decide: start `docker-compose.monitoring.yml` **or** written waiver
- [ ] Decide: authenticate/disable notifications WS **or** written waiver until a client ships

### Deploy

- [ ] `docker compose -f infra/docker-compose.prod.yml pull/build` with intended tags
- [ ] Deploy API then web (or both); confirm healthchecks green
- [ ] Confirm `prisma migrate deploy` on API boot (no pending migrations)
- [ ] Reload nginx if vhost changed (`nginx -t && systemctl reload nginx`)

### Post-deploy verification

- [ ] Execute §10 Smoke Test Checklist
- [ ] Confirm Prometheus scrape still hits `api:3210/metrics` if monitoring enabled
- [ ] Record IMAGE tags + timestamp in ops log / future CHANGELOG

---

## 10. Smoke Test Checklist

### Edge / health

- [ ] `GET /health` → 200 (loopback API)
- [ ] `GET https://<host>/api/metrics` → **404** (not Prometheus text)
- [ ] `GET http://127.0.0.1:3210/metrics` → 200 only on loopback/docker-net (intentional)

### Auth / RBAC

- [ ] Login AGENT / OPS_STAFF / FINANCE_STAFF / SUPER_ADMIN
- [ ] AGENT home → `/agent-portal`; cannot open Ops/Fleet via nav
- [ ] AGENT Documents Vault lists/uploads via `/documents`
- [ ] AGENT `POST /ocr/documents/:id/approve` → **403**
- [ ] OPS_STAFF OCR approve/reject → **200** path (with fixture)
- [ ] Upload confirm without `confirmToken` / foreign id → fail (not silent finalize)

### Realtime / ops

- [ ] OpsControl connects with JWT; without token → `connect_error`
- [ ] Agent JWT cannot join `/ops`

### Finance / fleet / dashboards (sanity)

- [ ] Staff with `VIEW_DASHBOARD` opens `/dashboards`
- [ ] Fleet ERP loads for `MANAGE_FLEET` roles
- [ ] `/finance-erp` and `/automation` still ComingSoon until Sprint 2 (expected)

### Cookies

- [ ] After `COOKIE_SECURE=true` deploy: refresh cookie has `Secure` on HTTPS

### Backups

- [ ] Manual `tuba-backup.service` start succeeds
- [ ] Artifact size ≫ 254 bytes and is valid gzip SQL

---

## 11. Rollback Checklist

| Layer | Action |
|---|---|
| API / web images | Redeploy previous known-good `API_IMAGE_TAG` / `WEB_IMAGE_TAG` per `RUNBOOK.md` |
| Nginx metrics deny | Reverting the deny restores public scrape — **avoid** unless emergency observability debugging |
| DB | Restore from last **valid** `pg_dump` (not BullMQ JSON). If no valid dump exists, rollback of data is **not available** — this is why C1 blocks GO |
| Env (`COOKIE_SECURE`) | Revert `.env` and recreate API container |
| Sprint 1 API features | Rolling API back to `web-m11` removes OCR/upload/ops WS hardenings — only with explicit acceptance |
| Docs-only | N/A for runtime |

**Rollback readiness today: WEAK** — image rollback possible; **data restore not proven** while backups fail.

---

## 12. GO / NO-GO Recommendation

### **NO-GO**

Do **not** declare a Sprint 1 production Release Candidate on this host until Critical items are cleared.

| Gate | Status |
|---|---|
| Source builds + TypeScript | GO |
| Automated e2e (204) | GO |
| Prisma migrations (source + live DB) | GO |
| Docker image build validation | GO |
| Nginx TLS + metrics deny | GO |
| Sprint 1 security **in live API** | **NO-GO** (image lag) |
| Real DB backups + restore proof | **NO-GO** |
| Cookie Secure on HTTPS | **NO-GO** |
| Monitoring (or waiver) | **NO-GO** / waive |
| Operator UIs (Finance/Automation) | Not required for Sprint 1 RC; Sprint 2 |

### Minimum path to GO (ops + deploy; out of scope for this audit)

1. Repair and verify `backup.sh` / systemd backup; keep one restore dry-run note.  
2. Set `COOKIE_SECURE=true`.  
3. Build/deploy API + web from current workspace; smoke §10.  
4. Start monitoring **or** sign a written observability waiver.  
5. Optionally waive notifications WS + dual expiry in writing until Sprint 2 tickets.

### Codebase verdict (separate from live host)

The **repository after Sprint 1** is a credible **engineering RC** for the Sprint 1 security/honesty slice (compile, tests, Docker build, migrations). The **deployed system** is not yet that RC.

---

## Appendix A — Area validation matrix

| Area | Source status | Live status | Notes |
|---|---|---|---|
| Backend | Strong | Stale image | Nest modules present; e2e green |
| Frontend | Strong | Partial (web-m17) | RBAC + vault in source; confirm live tag includes S1-05/06 |
| Database | 11 migrations applied live | Healthy | |
| Prisma | Schema 57 models; migrate OK | Up to date | |
| RBAC | 11 seeded; 9 route-enforced | Depends on API image | 2 orphans |
| Authentication | JWT + refresh e2e | Live login assumed | Cookie Secure issue |
| Authorization | PermissionsGuard + Sprint 1 gates | Verify post-redeploy | |
| OCR | Review gated; e2e | Verify post-redeploy | Full pipeline e2e still Sprint 2 |
| Uploads | confirmToken e2e | Verify post-redeploy | |
| Documents | Vault e2e + AgentPortal wire | Verify post-redeploy | |
| Notifications | REST e2e; channels stub-capable | WS ungated | |
| Automation | Rules/queues e2e | Dual expiry remains | |
| Finance | API e2e; UI ComingSoon | API live | |
| Operations | REST + WS auth e2e | Verify WS on new API | |
| Fleet | e2e | Dual expiry | |
| Dashboards | e2e | | |
| Queues / BullMQ | ocr / automation / notify | Live Redis db3 | |
| WebSockets | `/ops` auth; `/notifications` open | | |
| Storage | MinIO healthy | | |
| Docker | Builds OK; prod stack healthy | Tag drift | |
| Nginx | Conf + live metrics 404 | OK | |
| Monitoring | Config present | **Down** | |
| Backups | Script broken | **Failed** | |
| Environment | Core keys present | Cookie/offsite gaps | |
| Documentation | Sprint closeout OK | Residual SoT stale rows + S1-08 | |

---

## Appendix B — Route / permission snapshot

- **Routes:** 21 leaf paths; **7** ComingSoon at router; **11** private with path UX gates.  
- **Broken route imports:** none.  
- **Dead vault map:** fixed in source (S1-06).  
- **Permissions seeded:** 11. **API-enforced:** 9. **Orphans:** `ACCESS_AUDIT_LOGS`, `API_KEY_ACCESS`.  
- **Duplicate service stacks:** none material; dual expiry is dual *scheduler*, not dual product module.

---

## Appendix C — Validation environment

- Host Node via `docker run node:22-slim` + Corepack `pnpm@11.13.1` (host lacked system pnpm/npm).  
- E2e DB: ephemeral `postgres:16-alpine` + `redis:7-alpine` on network `tuba-alhijaz_tuba`.  
- Temporary RC audit images built then removed.  
- No application source files modified for this audit (this report only).

---

*End of Release Candidate Report — audit only.*
