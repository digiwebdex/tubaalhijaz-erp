# TUBA AL HIJAZ ERP — RELEASE PACKAGE v2.0.1 (Release Candidate)
Status: **RC — development frozen.** Prepared LOCAL. **Not deployed / committed / pushed.** Awaiting deployment approval.

## What this package is
The complete, self-contained set of documents to deploy v2.0.1 to production safely and roll it back if needed. Nothing here changes code or infrastructure — it is documentation + checklists for the owner/ops to execute after approval.

## Contents (in `docs/enterprise-completion/release-v2.0.1/`)
| # | Document | Purpose |
|---|---|---|
| 00 | RELEASE_PACKAGE_v2.0.1.md | This index + go/no-go gate. |
| 01 | PRODUCTION_DEPLOYMENT_RUNBOOK.md | Step-by-step production deploy. |
| 02 | DATABASE_MIGRATION_PLAN.md | The 2 additive migrations, apply + verify. |
| 03 | ROLLBACK_PLAN.md | Fast code rollback (+ DB restore last-resort). |
| 04 | PRODUCTION_SMOKE_TEST_CHECKLIST.md | 5-min post-deploy smoke. |
| 05 | POST_DEPLOYMENT_VERIFICATION_CHECKLIST.md | Deeper feature/security/accounting checks. |
| 06 | MONITORING_CHECKLIST.md | 60-min + 24-h watch, alert thresholds. |
| 07 | RELEASE_NOTES_v2.0.1.md | User-facing change summary. |
Companion (parent folder): `MASTER_BUG_REGISTER.md`, `FINAL_COMPLETION_REPORT.md`, `ERP_COMPLETION_REPORT.md`, `FINAL_GAP_REPORT.md`.

## Release contents (what ships)
- **Code:** billing (rate cards, pricing resolver, override, unified BookingConfirmationService), password reset, enquiries/lead capture, ops/user/super-admin security fixes. New modules: pricing, rates, enquiries, booking-confirmation; new pages: ResetPassword, RateCards.
- **DB:** migrations `20260803195529_add_password_reset_token`, `20260803211614_billing_rate_cards`.
- **Config:** no new required env; `SMTP_*` optional (email delivery).
- **Image tag:** `v2.0.1` (git tag `v2.0.1`).

## Quality gate (LOCAL) — MET
Critical=0 · High=0 · Medium=0-or-documented · Broken Workflow=0 · Dead Button=0 · Broken Nav=0 · Console Errors=0 · Unhandled Exceptions=0 · Accounting ✓ · Billing ✓ · Automation ✓ · TypeScript ✓ · Production-Ready (Local)=YES.

## GO / NO-GO for production (must ALL be checked at deploy time)
- [ ] Deployment approval explicitly given by owner.
- [ ] **P-01** stray public datastores removed + firewall on.
- [ ] **P-02** UAT super-admin disabled in prod DB.
- [ ] Source committed + tagged `v2.0.1` (reproducible).
- [ ] Fresh, confirmed DB backup exists.
- [ ] Rollback tags recorded (Runbook §2).
- [ ] Maintenance window agreed.
- [ ] SMTP decision made (configure now, or accept stub-safe reset emails).

## Execution order on approval
1) Pre-flight gates (00 GO/NO-GO) → 2) Runbook (01) → migrations auto-apply, verify (02) → 3) Smoke (04) → 4) Post-deploy verification (05) → 5) Monitoring watch (06). Any failure → Rollback (03).

**Until approval: everything stays LOCAL. No deploy, no commit, no push.**
