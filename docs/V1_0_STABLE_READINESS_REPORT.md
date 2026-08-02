# TUBA AL HIJAZ — v1.0 Stable Readiness Report

**Date:** 2026-07-31 (validation window ~03:59–04:05 UTC)  
**Mode:** Audit only — **no application code changes**  
**Scope:** Post–Sprint 2 product validation (backend, frontend, OCR, finance, automation, notifications, audit, vault, uploads, RBAC, WebSockets, queues, Docker, nginx, backups, monitoring, documentation)  
**Prior artifacts:** [`PRODUCTION_GO_LIVE_REPORT.md`](./PRODUCTION_GO_LIVE_REPORT.md) (Sprint 1 GO @ 86/100) · Sprint 2 completion reports S2-01…S2-06

---

## 1. Executive Summary

Sprint 2 **implementation work in the workspace** is largely complete for the core operator unlock and async stability tickets (**S2-01…S2-06**). Against **current source**, the automated suite is **19 / 19 suites, 243 / 243 tests** green; API typecheck, Nest build, web Vite build, and FE RBAC selftest all pass.

However, **live production is still on `rc1-20260731` images built before Sprint 2 code landed.** Live API returns **404** for `POST /ocr/documents/:id/reprocess`; live web bundle lacks Finance/Automation ERP screen strings present in the freshly built workspace `dist`. Four Sprint 2 backlog items remain **Todo** (S2-02b, S2-10, S2-11, S2-12). Monitoring stack remains down.

**Verdict: NO-GO for declaring production v1.0 Stable.**

Workspace source is **release-candidate quality for a v1.0 Stable tag after image rebuild/redeploy** and disposition of remaining P1 items. Live production today remains a **Sprint 1 RC** with accepted residuals from the go-live report, not a Sprint 2 / v1.0 Stable cut.

---

## 2. Production Readiness Score

### Combined score: **74 / 100** — **NO-GO** for v1.0 Stable (live)

| Dimension | Weight | Score | Notes |
|---|---:|---:|---|
| Compile / production build (source) | 12 | 100 | shared + API `nest build` + web `vite build` OK |
| Automated tests (source) | 15 | 100 | **243/243** e2e; FE `rbac.selftest` OK |
| Sprint 2 feature completeness (source) | 12 | 85 | Core S2-01…S2-06 done; S2-02b/10/11/12 open |
| Live deploy = Sprint 2 source | 18 | 25 | Live still `rc1-20260731`; missing reprocess + Finance/Automation UI |
| Runtime security hygiene (live) | 10 | 85 | HTTPS, cookie Secure, metrics edge deny, ops/notify WS in source; live API pre-S2-02 image for notify WS |
| Backups / restore | 10 | 90 | Timer active; Jul 31 run success; offsite still optional |
| Observability | 8 | 15 | Monitoring compose not running |
| Operator product surface (live) | 8 | 40 | Portals/ops/OCR live on RC1; Finance/Automation not on live web |
| Documentation accuracy | 7 | 75 | Sprint 2 reports + SoT updates present; backlog still shows open S2 tickets |

**Source-only readiness (if images were rebuilt today):** ~**88 / 100** — strong candidate for Stable **after** redeploy + P1 disposition.

---

## 3. Validation Results

### 3.1 Automated suite & builds (workspace source)

| Check | Result | Evidence |
|---|---|---|
| API e2e (ephemeral Postgres/Redis + MinIO network) | ✅ PASS | **19 suites / 243 tests** |
| API `tsc --noEmit` | ✅ PASS | Clean |
| API `nest build` | ✅ PASS | `dist/main.js` present |
| Web `vite build` | ✅ PASS | `dist/` produced (~1.6 MB JS) |
| FE RBAC selftest | ✅ PASS | `rbac.selftest: OK` |
| OCR pipeline e2e (S2-06) | ✅ PASS | Passport/visa/invoice, retry, reprocess, audit, tenancy |
| Notify pipeline e2e (S2-03) | ✅ PASS | Included in full suite |
| Finance / automation / rbac e2e | ✅ PASS | Role matrices green |

### 3.2 Live smoke (production stack)

| Check | Result | Evidence |
|---|---|---|
| Containers | ✅ PASS | api/web/postgres/redis/minio **healthy** |
| API `/health` | ✅ PASS | 200 |
| Web `:8095/` | ✅ PASS | 200 |
| HTTPS site + `/api/health` | ✅ PASS | 200 |
| Edge `/api/metrics` | ✅ PASS | **404** (deny) |
| Loopback `/metrics` | ✅ PASS (expected) | 200 for docker-network scrape |
| Live image tags | ⚠️ STALE vs S2 | `tuba-alhijaz/*:rc1-20260731` (created 2026-07-30 ~22:51 UTC) |
| `POST …/ocr/…/reprocess` on live | ❌ FAIL | **404** Cannot POST — S2-06 not deployed |
| Live web Finance/Automation UI | ❌ FAIL | Bundle lacks “Receivables (AR)” / “Automation Rules”; workspace dist has them |
| Demo-user permission matrix on live | ⚪ N/A | Prod DB has **2** real users only (prod seed); demo accounts absent (expected) |
| `COOKIE_SECURE` | ✅ PASS | `true` |
| Notify creds on live | ✅ PASS (safe) | `WASENDER` / `SMTP_HOST` blank |
| OCR provider live | ✅ INFO | `OCR_PROVIDER=gemini` |

### 3.3 Module audit (source vs live)

| Area | Source status | Live status | Notes |
|---|---|---|---|
| **Backend** | ✅ Strong | ⚠️ RC1 | Nest modules complete; live image pre–S2-03…06 |
| **Frontend** | ✅ Strong | ⚠️ RC1 | Routes wire FinanceERP + AutomationNotifications; live bundle does not |
| **OCR** | ✅ Strong | ⚠️ Partial | Review gate live on RC1; e2e + reprocess + lastError only in source |
| **Finance** | ✅ Strong | ⚠️ API only | `/finance/*` APIs on RC1; staff UI not on live web |
| **Automation** | ✅ Strong | ⚠️ API only | Rules/queues on RC1; admin UI not on live web |
| **Notifications** | ✅ Strong | ⚠️ Mixed | Pipeline consolidation in source; live may predate S2-02/S2-03 |
| **Audit Logs** | ✅ Read API + UI (S2-01) | ✅ If RC1 included S2-01 | Write breadth still sparse (**S2-02b Todo**) |
| **Documents Vault** | ✅ | ✅ | S1-06; e2e green |
| **Uploads** | ✅ Confirm harden | ✅ | Payment-slip magic-byte still open (**S2-11**) |
| **RBAC** | ✅ | ✅ | API PermissionsGuard + FE UX gates; e2e matrix green |
| **WebSockets** | ✅ Source | ⚠️ Deploy lag | `/ops` + `/notifications` JWT in source (S1-03 / S2-02) |
| **Queues / BullMQ** | ✅ | ✅ | Live Redis db3: `tuba-automation`, `tuba-notify`, `tuba-ocr`; `expiry-escalation` repeatables present |
| **Docker** | ✅ | ✅ | Prod compose healthy |
| **Nginx** | ✅ | ✅ | TLS + `/api` proxy; metrics deny |
| **Backups** | ✅ | ✅ | Timer active; Jul 31 success after RC fix |
| **Monitoring** | ❌ | ❌ | No Grafana/Prometheus/Loki containers |
| **Documentation** | ✅ Improved | ⚠️ | Sprint 2 reports exist; open-ticket honesty required |

### 3.4 Route verification (workspace `routes.tsx`)

| Path | Element | Gate |
|---|---|---|
| `/` … `/contact` | Marketing | Public |
| `/login`, `/auth-onboarding` | Auth | Public |
| `/agent-portal`, `/supplier-portal` | Portals | Tenancy UX |
| `/ops-control`, `/ops-departments` | Ops | `VIEW_DASHBOARD` |
| `/finance-erp` | **FinanceERP** | `FINANCIAL_REPORTS` |
| `/fleet-erp` | FleetERP | `MANAGE_FLEET` |
| `/ocr-center` | OCRCenter | `REVIEW_OCR_QUEUE` |
| `/automation` | **AutomationNotifications** | `CONFIGURE_WORKFLOWS` |
| `/dashboards` | Dashboards | `VIEW_DASHBOARD` |
| `/super-admin` | SuperAdmin | Staff perms (any-of) |
| `/workflow-map`, `/mobile-apps`, `/tablet`, `/design-system`, `/i18n-system` | ComingSoon | Spec / out of Stable scope |

### 3.5 Permission verification (source e2e — authoritative)

| Role | Finance dashboard | Automation rules | OCR review list | Audit logs |
|---|---|---|---|---|
| SUPER_ADMIN | allow | allow | allow | allow |
| OPS_STAFF | 403 | allow | allow | 403* |
| FINANCE_STAFF | allow | 403 | 403 | allow |
| AGENT | 403 | 403 | 403 | 403 |
| SUPPLIER | 403 | 403 | 403 | 403 |

\*OPS lacks `ACCESS_AUDIT_LOGS` by seed (by design).

FE UX mirrors the same keys via `apps/web/src/app/lib/rbac.ts` (selftest green).

---

## 4. Remaining Risks

| Severity | Risk | Impact |
|---|---|---|
| **Critical** | Live images ≠ Sprint 2 workspace | Operators do not get Finance/Automation UI or OCR reprocess on production until rebuild/redeploy |
| **High** | Monitoring stack down | No Prom/Grafana/alerting — incidents rely on health/logs |
| **High** | Open P1: staging/CI verify (**S2-10**) | No signed-off staging path / GHCR gate confirmation in this audit |
| **Medium** | Open P1: payment-slip magic-byte (**S2-11**) | Content-type spoof risk on agent slip uploads |
| **Medium** | Open P1: notify template vars (**S2-12**) | Wrong/empty WhatsApp/email copy when channels enabled |
| **Medium** | Open P1: audit write breadth (**S2-02b**) | Login/upload gaps; OCR approve/reject already audited |
| **Medium** | Offsite backups unset | On-box MinIO only |
| **Medium** | Notify channels blank in prod | IN_APP works; WA/Email stub/skip (safe, but not “full messaging Stable”) |
| **Low** | SuperAdmin nested ComingSoon screens | Workflow/AI/OCR/settings placeholders remain |
| **Low** | Public ComingSoon routes | `/mobile-apps` etc. unauthenticated |
| **Low** | Web bundle size warning | ~1.6 MB main chunk — perf debt, not a blocker |

---

## 5. Technical Debt

1. **Deploy lag** — workspace ahead of `rc1-20260731` images (must become a release discipline item).  
2. **Sparse audit writes** outside OCR approve/reject/override and selected company flows.  
3. **Payment-slip upload** skips shared `validateUpload` magic-byte path.  
4. **Notification template / automation `vars` alignment** incomplete.  
5. **Non-passport OCR** still generic regex (honest limitation; parsers backlog Sprint 3).  
6. **`autoAccept` computed but unused** — human review always.  
7. **Monitoring compose** unused in production.  
8. **Residual phase-doc drift** (SCHEMA roles, older AUTOMATION claims) — track S1-08 / doc hygiene.  
9. **No git metadata** in `/var/www/TUBAALHIJAZ` on this host (not a git checkout) — release provenance relies on image tags.  
10. **Frontend chunking** — Vite size warning.

---

## 6. Known Limitations (product)

| Limitation | Status |
|---|---|
| Enquiry / Contact API | Not shipped (Sprint 3) |
| Password reset | Not shipped (Sprint 3) |
| Excel import | Not shipped |
| Full ERP i18n | Mostly English UI |
| ZATCA / SADAD / NUSUK deep integration | Marketing / backlog only |
| Hardware GPS / driver mobile apps | ComingSoon / planned |
| WhatsApp / Email in production | Credentials intentionally blank (fail-safe) |
| Finance chart series (cash trend) | SampleDataBanner when not wired — statements/ledgers live |
| Workflow map / design-system routes | ComingSoon by design |

---

## 7. Sprint 2 backlog honesty

| Status | Tickets |
|---|---|
| **Done** | S2-01, S2-02, S2-03 (+b), S2-04, S2-05, S2-06 (+b), S2-07, S2-08, S2-09 |
| **Todo (blocks “Sprint 2 complete” claim)** | **S2-02b**, **S2-10**, **S2-11**, **S2-12** |

Claiming “Sprint 2 complete” in a stakeholder sense requires either finishing these four or an explicit **waive/defer** decision recorded in the backlog.

---

## 8. Release Checklist — v1.0 Stable

### Must (before GO)

- [ ] Rebuild API + web images from current Sprint 2 workspace  
- [ ] Deploy to production; confirm image digests/tags ≠ stale `rc1` only  
- [ ] Smoke: `POST /ocr/documents/:id/reprocess` returns non-404 for staff (404 id OK; route exists)  
- [ ] Smoke: authenticated `FINANCE_STAFF` loads Finance Dashboard UI (not ComingSoon)  
- [ ] Smoke: authenticated `OPS_STAFF` loads Automation Rules UI  
- [ ] Smoke: `/notifications` WS rejects anonymous (S2-02 live)  
- [ ] Confirm `/api/metrics` still edge-denied after deploy  
- [ ] Confirm backup timer success post-deploy  
- [ ] Tag release (`v1.0.0` or `stable-20260731`) and record in RUNBOOK  

### Should (same release train or explicit waive)

- [ ] Close or waive **S2-10** (staging/CI verify)  
- [ ] Close or waive **S2-11** (payment-slip validateUpload)  
- [ ] Close or waive **S2-12** (template vars)  
- [ ] Close or waive **S2-02b** (audit write breadth)  
- [ ] Bring up monitoring stack **or** written waive with owner  

### Nice

- [ ] Offsite backup credentials  
- [ ] Code-split web bundle  
- [ ] SuperAdmin ComingSoon cleanup (OCR/settings deep links)

---

## 9. GO / NO-GO for v1.0 Stable

| Question | Answer |
|---|---|
| Is workspace source ready for a Stable cut? | **CONDITIONAL YES** — after remaining P1 disposition (or written waives) |
| Is **live production** v1.0 Stable today? | **NO** |
| **Decision** | **NO-GO** |

### Why NO-GO

1. **Deploy mismatch:** production runs `rc1-20260731`; Sprint 2 UI/API surfaces are not live.  
2. **Open Sprint 2 P1 tickets:** S2-02b, S2-10, S2-11, S2-12.  
3. **Observability gap:** monitoring stack not running.  

### Path to GO

1. Build & deploy images from current tree.  
2. Re-run live smoke checklist (§8 Must).  
3. Finish or formally waive S2-02b / S2-10 / S2-11 / S2-12.  
4. Decide monitoring: bring up or waive with owner + date.  
5. Re-score; expect **≥ 88** and **GO** if Must items pass.

---

## 10. Evidence appendix

| Item | Value |
|---|---|
| E2E | 19 suites, 243 passed (2026-07-31 ephemeral harness) |
| Live API image | `tuba-alhijaz/tuba-alhijaz-api:rc1-20260731` |
| Live web image | `tuba-alhijaz/tuba-alhijaz-web:rc1-20260731` |
| Live reprocess probe | HTTP 404 |
| Workspace dist Finance markers | “Receivables (AR)” present; live absent |
| Backup timer | active; last Finished 2026-07-31 02:00:23 UTC |
| Monitoring containers | none |
| Queues in Redis db3 | `tuba-automation`, `tuba-notify`, `tuba-ocr` + expiry-escalation repeatables |
| HTTPS | tubaalhijaz.com 200; `/api/metrics` 404 |

---

*End of v1.0 Stable Readiness Report. Audit only — no code modified.*
