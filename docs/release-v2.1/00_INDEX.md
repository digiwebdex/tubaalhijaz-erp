# TUBA AL HIJAZ — v2.1 Release Package · INDEX

**Release:** v2.1 Enterprise ERP (workflow · approval · locking · versioning · audit · notification · impersonation + flight management)
**Status:** RELEASE CANDIDATE — development CLOSED, code frozen. Release-engineering artifacts only.
**Prepared on:** 2026-08-05 · from the LOCAL-verified clone `/root/tuba-local`
**Golden rule:** No code / schema / UI changes. These documents are the deploy contract.

| # | Document | Purpose |
|---|----------|---------|
| 01 | Production Deployment Plan | End-to-end deploy sequence, prerequisites, env, build/release steps |
| 02 | Migration Execution Order | The exact ordered migration set + apply command + verification |
| 03 | Rollback Plan | How to revert app + how to handle the (additive) migrations |
| 04 | Smoke Test | Fast go/no-go checks immediately after deploy |
| 05 | Post-Deployment Verification | Deeper functional confirmation of the v2.1 layer |
| 06 | Monitoring Checklist | What to watch, thresholds, and where |
| 07 | Production Incident Runbook | Triage + response for likely failure modes |
| 08 | v2.1 Release Notes | What shipped, for stakeholders |
| 09 | Go / No-Go Checklist | Single-page gate to authorize release |

## Release identity
- **Migrations (v2.1 set, in order):** `flight_management_module` → `agent_ops_group_locking` → `audit_correlation` → `v21_enterprise_capabilities` → `integration_config` (all additive).
- **New routes:** `/agent-operations`, `/audit-center`, `/approvals`, `/sla-dashboard`, `/wasender-config`, `/notification-center`, `/template-manager`, `/inbox`, `/my-workflow` + global impersonation banner.
- **Verification basis:** backend suites green · Phase 4 pixel QA 27/27 clean · UAT 12/12.

## Owner-only decisions still open before GO
1. Production secrets (JWT/DB/MinIO) — must NOT reuse dev values.
2. WaSender production credentials.
3. SLA hours / approval matrix / notification templates seeding per business policy.
4. Confirm go-live blockers from v2.0.1 (P-01 public Redis/PG exposure, P-02 UAT super-admin in prod DB) are resolved.
