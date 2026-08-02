# Go-Live Readiness — TUBA AL HIJAZ ERP

**Sprint:** ESP-05  
**Package date:** 2026-08-02  
**Type:** Decision framework (documentation only — no implementation in ESP-05)  

Inputs:

- [`UAT_MASTER_PLAN.md`](./UAT_MASTER_PLAN.md)  
- [`UAT_TEST_CASES.md`](./UAT_TEST_CASES.md) (executed)  
- [`UAT_EXECUTION_CHECKLIST.md`](./UAT_EXECUTION_CHECKLIST.md)  
- [`UAT_BUG_REGISTER.md`](./UAT_BUG_REGISTER.md) (frozen)  
- [`UAT_SIGNOFF.md`](./UAT_SIGNOFF.md)  
- Prior: `docs/releases/TRANSFORM_002_RELEASE_CERTIFICATION.md`, `docs/PRODUCTION_GO_LIVE_REPORT.md`, `docs/stabilization/ESP_04_SECURITY_AUDIT.md`, `docs/ui/UI_12_CERTIFICATION.md`

---

## 1. Go-Live criteria (mandatory)

| # | Criterion | Required |
|---|-----------|----------|
| G1 | **Critical** bugs open | **0** |
| G2 | **High** bugs open | **0** |
| G3 | **Medium** bugs | All **Accepted** with named owner + target date, **or** Fixed |
| G4 | **Low** bugs | **Documented** in bug register |
| G5 | UAT suites Agent / Ops / Visa / LS / Finance / CEO | Executed (or formally deferred in writing) |
| G6 | Department sign-offs | Ops, Visa, Finance, IT, MD complete on [`UAT_SIGNOFF.md`](./UAT_SIGNOFF.md) |
| G7 | Feature flags for go-live recorded | Passport-return, MOFA bill, Group-list OCR, Haji WhatsApp |
| G8 | Runtime health | API/Web healthy; workers up; backups per RUNBOOK |
| G9 | Security deploy notes | ESP-04 refresh cookie Path applied if serving under `/api` |

**Pass rule:** G1–G9 satisfied → eligible for **GO** or **GO WITH CONDITIONS** (conditions only for G3/G7/G9 operational notes — never to waive G1/G2).

---

## 2. Scoring worksheet (fill at freeze)

| Gate | Result | Evidence |
|------|--------|----------|
| G1 Critical = 0 | ☐ Pass ☐ Fail | Bug register totals |
| G2 High = 0 | ☐ Pass ☐ Fail | Bug register totals |
| G3 Medium accepted | ☐ Pass ☐ Fail | Register owners |
| G4 Low documented | ☐ Pass ☐ Fail | Register |
| G5 Suites executed | ☐ Pass ☐ Fail | Checklist P1–P6 |
| G6 Sign-offs | ☐ Pass ☐ Fail | UAT_SIGNOFF |
| G7 Flags recorded | ☐ Pass ☐ Fail | Checklist header |
| G8 Runtime health | ☐ Pass ☐ Fail | IT attestation |
| G9 Security Path | ☐ Pass ☐ Fail ☐ N/A | ESP-04 / env |

---

## 3. Decision options

| Decision | When |
|----------|------|
| **GO** | All gates Pass; MD signs GO; no material conditions |
| **GO WITH CONDITIONS** | G1–G2 Pass; Medium accepted; written conditions (flags, training, deferred restore drill, etc.) |
| **NO-GO** | Any Critical/High open; or any required signatory Rejects; or core suites not run |

**Decision (record after UAT):** ☐ GO ☐ GO WITH CONDITIONS ☐ NO-GO  

**Date:** _______________ **MD:** _______________ **IT:** _______________

---

## 4. Pre-existing technical posture (context — not a substitute for UAT)

| Source | Posture |
|--------|---------|
| TRANSFORM-002 certification | Technical **GO WITH ACCEPTED RISKS**; human business signatures were pending |
| UI-12 | **Conditional** kit certification — legacy chrome on some modules |
| ESP-01…03 | Legacy kit migration / cleanup / performance — non-blocking for UAT journeys above |
| ESP-04 | Security fixes verified; **container recreate** may still be needed for cookie Path |

UAT must still be **executed by humans**; automated e2e PASS does not close this form.

---

## 5. Open risks to track into go-live

| Risk | Mitigation |
|------|------------|
| No live visa government API | Train desks; marketing claims already constrained |
| Thin live operational data | Seed UAT; ramp agents carefully |
| Flag-gated MOFA bill / passport return | Explicit On/Off on sign-off |
| Day-85 cron timing | Test on staging with controlled entry dates |
| WA provider skips | In-app/email fallback; document |
| Restore drill deferred | Schedule post-go-live drill per RUNBOOK |
| UI legacy modules | Do not block GO unless UAT proves journey failure |

---

## 6. Recommendations

1. Run ESP-05 UAT on **staging** first, then a short **production-smoke** with disposable test groups.  
2. Complete [`UAT_SIGNOFF.md`](./UAT_SIGNOFF.md) and freeze the bug register before MD decision.  
3. Apply ESP-04 `REFRESH_COOKIE_PATH=/api/auth` and force re-login before blaming session failures.  
4. Keep Transformation-003 **stopped** until MD records GO / GO WITH CONDITIONS.  
5. After GO: schedule backup restore drill; monitor Day-85 first production week; track Medium owners weekly.

---

## 7. Rollback posture (if NO-GO or post-GO incident)

- Prefer image digest / known-good tag rollback per `docs/releases/TRANSFORM_001/ROLLBACK.md` and RUNBOOK.  
- Do not “fix forward” Critical tenancy/security defects without a tracked change window.  
- ESP-05 itself has **no code rollback** (docs only).

---

## 8. Final report (ESP-05)

| # | Item | Summary |
|---|------|---------|
| 1 | Scope | Human UAT of implemented Agent→Ops→Visa→LS→Finance→CEO flows; no code |
| 2 | UAT coverage | 42 cases (AGT 9 · OPS 8 · VIS 8 · LS 4 · FIN 9 · CEO 4) |
| 3 | Departments | Operations, Visa, Finance, IT, Managing Director (+ Agent lead) |
| 4 | Business scenarios | Operation Map stages mapped in master plan §6 |
| 5 | Deliverables | Six files under `docs/uat/` |
| 6 | Open risks | §5 + certification residual risks |
| 7 | Go-Live criteria | §1 G1–G9 (Critical/High = 0) |
| 8 | Recommendations | §6 |

**STOP:** Documentation only. No implementation, bug fixing, features, or UI changes in ESP-05.
