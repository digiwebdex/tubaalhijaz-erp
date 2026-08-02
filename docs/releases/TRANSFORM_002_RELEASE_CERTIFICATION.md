# TRANSFORM-002 — Release Certification

**Program:** Visa & Saudi Operations  
**Certification date:** 2026-08-01  
**Certifying task:** T002-10 Final Acceptance  
**Architecture contract:** “Smoke across pipeline + LS + bill; sign-off”  
**Code freeze:** Observed — no schema/API/UI/workflow changes in this task

---

## Architecture overrides prompt

> **T002-10** Final Acceptance | Smoke across pipeline + LS + bill; sign-off

Certification covers that smoke target plus packaging of production / documentation evidence required for sign-off. No feature delivery.

---

## 1. Certification Statement

I certify that, as of the evidence collected on **2026-08-01**:

1. TRANSFORM-001 (T001-01…T001-10) completion artifacts exist and automated intake smoke/regression paths pass.  
2. TRANSFORM-002 (T002-01…T002-09) completion artifacts exist and automated visa / Long Stay / MOFA bill / dashboard paths pass.  
3. Full API e2e suite: **378 / 378 PASS** (38 suites).  
4. API and Web typecheck + production builds: **PASS**.  
5. Live runtime: API/Web healthy; workers listening; migrations through Day-85 applied; automation rules for visa + day-85 enabled; backup timer active.  
6. No release-blocking defect was discovered that required a code fix under the freeze.

**Human business signatures remain pending** (`TRANSFORM_002_BUSINESS_SIGNOFF.md`).

---

## 2. Build & Test Evidence

| Artifact | Result | Notes |
|----------|--------|-------|
| `apps/api` TypeScript | PASS | `tsc --noEmit` |
| `apps/web` TypeScript | PASS | `tsc --noEmit` |
| `nest build` | PASS | |
| `vite build` | PASS | Large-chunk advisory only |
| Full e2e | **378 PASS** | Log: `/tmp/t002-10-e2e.log` (ephemeral host path) |
| Critical T002 suites | PASS | visa-pipeline, embassy-passport, visa-notifications, mofa-processing, longstay-host, day85-compliance, dashboards, visa-desk, visa-master |
| Critical T001 suites | PASS | transform-001-smoke, mutamer-import, ocr-*, intake-notifications, groups-*, ops-group-master |

---

## 3. Runtime Evidence (production compose)

| Component | Status |
|-----------|--------|
| `tuba-alhijaz-api-1` | Up / healthy — digest `sha256:b39660f8854a…` tag `stable-20260731` |
| `tuba-alhijaz-web-1` | Up / healthy — digest `sha256:387e85037a48…` tag `stable-20260731` |
| Postgres / Redis / MinIO | Healthy |
| `/health` API | HTTP 200 |
| Web origin | HTTP 200 |
| nginx HTTPS `:443` | Config OK / listening |
| `COOKIE_SECURE` | `true` |
| Workers | `tuba-automation`, `tuba-notify`, `tuba-ocr` listening |
| Repeatable jobs | 4 registered (incl. `longstay-day85` @ 06:15) |
| Queue failed depths | 0 |
| Backup timer | `active`; dumps present under `/var/backups/tuba/` |

### Feature flags (effective)

| Flag | Effective in prod container | Intent |
|------|-----------------------------|--------|
| `ENABLE_NUSUK_GROUP_LIST_OCR` | unset → **off** | SOP gate |
| `REQUIRE_HAJI_WHATSAPP` | unset → **off** | SOP gate |
| `VISA_REQUIRE_PASSPORT_RETURN` | unset → **off** | T002-05 SOP |
| `ENABLE_MOFA_PROCESSING_BILL` | unset → **off** | T002-06 Finance ready |
| `REQUIRE_LONGSTAY_HOST_WHATSAPP` | unset → **on** (code default) | T002-07 |

---

## 4. Schema / Migration Certification

Live `_prisma_migrations` includes all T001 and T002 additive migrations through:

`20260801170000_longstay_day85`

Spot-checked columns present: `Passenger.visaPipelineStatus`, `embassyRef`, `passportReturnedAt`, `LongStay.hostWhatsapp`, `day85NotifiedAt`, `Invoice.kind`, `Group.umrahCompanyId`, `gateVisa`.

---

## 5. Automation / Notification Certification

| Rule / Event | Enabled / Present |
|--------------|-------------------|
| AR-GRP-01…04 | Yes |
| AR-VISA-01 / 02 / 03 | Yes |
| AR-LS-85 / AR-LS-90 | Yes |
| SYS_LONGSTAY_DAY85 (`15 6 * * *`) | Yes |
| SYS_DAILY_BACKUP / SYS_CLOUD_BACKUP / SYS_EXPIRY_ESCALATION | Yes |
| NotificationEvent `VISA_APPROVED`, `VISA_REJECTED`, `PASSPORT_RETURNED`, `LONGSTAY_DAY85` | Yes |

---

## 6. Residual Risks Register

| ID | Risk | Disposition | Rationale |
|----|------|-------------|-----------|
| R-01 | No live government NUSUK/MOFA API | **Accepted** | Architecture principle; staff-update model |
| R-02 | MOFA Processing Bill flag off | **Accepted** | Architecture default until Finance ready; e2e proves path when enabled |
| R-03 | Passport-return SOP flag off | **Accepted** | Architecture SOP gate |
| R-04 | Image tag `stable-20260731` reused across rebuilds | **Accepted** | Prefer digest / `rc1-20260731` for rollback; document digests above |
| R-05 | `FEATURE_STATUS_MATRIX.md` stale | **Deferred** | Doc-only refresh post-sign-off; not a runtime blocker |
| R-06 | No dedicated USER_GUIDE | **Deferred** | Desks + completion docs suffice for trained Ops; guide later |
| R-07 | Destructive DB restore not drilled this cycle | **Deferred** | Procedure exists in RUNBOOK; backups present |
| R-08 | Production DB thin (few groups/pax; 0 LS/MOFA bills) | **Accepted for tech GO** / **human UAT required** | Automated gate green; business season load not yet exercised on this DB |
| R-09 | Seed still contains demo “MOFA clearance” string in API seed file | **Accepted** | Not shown on live dashboards; marketing honesty fixed in web |
| R-10 | Non-visa ComingSoon widgets remain on other dashboard cards | **Accepted** | Out of T002-09 §12 scope |
| R-11 | Fake Ministry API marketing claims | **Rejected** (removed) | T002-09 honesty copy |

---

## 7. Release Decision

### Decision: **GO WITH ACCEPTED RISKS**

**Justification**

- Architecture T002-10 smoke target (**pipeline + Long Stay + MOFA bill**) is covered by green automated suites and applied migrations.  
- Runtime workers, queues, HTTPS, cookies, backups, and notification packs are healthy.  
- Remaining gaps are **documented, non-blocking**, or **intentionally flag-gated**, and require **human business sign-off** rather than further feature work.  
- A pure **GO** (zero risks) is inappropriate while human UAT on production volumes and restore drill remain open.  
- **NO GO** is inappropriate: no blocking defect found; freeze held.

**Conditions before treating the season as fully business-certified**

1. Complete `TRANSFORM_002_BUSINESS_SIGNOFF.md` signatures.  
2. Ops/Visa/Finance walk the live desks with at least one Long Stay + one MOFA bill (flag on only if Finance ready).  
3. Prefer pinning a unique release tag/digest for the next promote (avoid ambiguous tag reuse).

---

## 8. Rollback Readiness

| Path | Ready? |
|------|--------|
| Image rollback to `rc1-20260731` | Yes (images present) |
| Image rollback by digest | Yes (record digests in this cert) |
| Disable automation rules (visa/day-85) in UI | Yes |
| Schema rollback | **No** — additive migrations stay; restore from backup if catastrophic |
| RUNBOOK restore procedure | Documented |

---

## 9. Production Readiness Score

| Dimension | Score (0–10) | Note |
|-----------|-------------:|------|
| Automated regression | 10 | 378/378 |
| Architecture completeness T002-01…09 | 9 | Delivered per completion docs |
| Runtime health | 9 | Workers/queues/HTTPS OK |
| Data / UAT readiness | 6 | Thin prod data; human UAT pending |
| Documentation currency | 7 | Release pack new; matrix/guide stale |
| Ops safety (backup/rollback) | 8 | Backups + RUNBOOK; restore undrilled |
| **Weighted readiness** | **8.2 / 10** | Supports **GO WITH ACCEPTED RISKS** |

---

## 10. Stop

Do **not** start Transformation-003 from this certification.  
No feature implementation is authorized by this document.
