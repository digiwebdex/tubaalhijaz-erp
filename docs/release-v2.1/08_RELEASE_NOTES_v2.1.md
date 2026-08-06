# 08 · RELEASE NOTES — TUBA AL HIJAZ v2.1 Enterprise ERP

**Release:** v2.1 · **Type:** Feature release (Enterprise governance layer) · **Status:** Release Candidate (frozen)
**Compatibility:** Additive schema; forward-compatible with the previous release during deploy.

---

## Highlights
v2.1 adds an **enterprise governance layer** over group operations: configurable approvals with digital signatures, immutable version history, soft/hard locking, change-request management, config-driven SLAs, a system-wide audit trail, multi-channel notifications, and secure admin impersonation.

## New Capabilities

### Approval & Governance
- **Configurable approval matrix** (`ApprovalRule`) — thresholds by pax/visa-type/package/role/level; no hardcoded levels.
- **Server-generated digital signatures** (SHA-256) on every approval; signature freshness enforced per submission cycle.
- **Immutable version history** with before/after diffs derived only from snapshots.
- **Soft / Hard locking** — soft locks are admin-unlockable; hard locks (finalize) are Super-Admin-only and never bypassed.
- **Change requests** — raise changes against locked groups; staff approve/reject through the workflow.
- **Bulk approval** — processes each group through the real engine (full audit/notification/signature per group).

### SLA & Operations
- **SLA Dashboard** — config-driven from `WorkflowStage.slaHours`; OVERDUE / AT_RISK / ON_TIME / NO_SLA classification.

### Audit & Traceability
- **Audit Center** — immutable, system-wide log with actor identity, module/action, before/after, correlation; filters + CSV export.

### Notifications
- **Notification Center** — all-channel (WhatsApp/Email/In-App) delivery history, retry, retry-all, CSV.
- **Template Manager** — per-event channel matrix + per-channel/language message templates + live test send.
- **Notification Inbox** — authorized personal feed with mark-read / mark-all.

### Integrations
- **WaSender Configuration** — WhatsApp gateway settings with API key **encrypted at rest (AES-256-GCM)**, live status, and test send.

### Admin Impersonation (F01)
- Secure, **reason-mandatory** impersonation; **30-minute** non-refreshable sessions.
- Persistent **banner + watermark**; **End Session** control; auto-expiry.
- Every impersonated action audited as **actual admin acting-as agent**.

### Flight Management
- Flight management module (schema + operations) included in this release.

## New Screens (9)
Agent Operations · Audit Center · Approval Dashboard · SLA Dashboard · WaSender Config · Notification Center · Template Manager · Notification Inbox · My Workflow (lock-aware) — plus the global impersonation banner/watermark.

## Database Changes (additive)
Five migrations (see Doc 02): `flight_management_module`, `agent_ops_group_locking`, `audit_correlation`, `v21_enterprise_capabilities`, `integration_config`. New enums (`ApprovalStatus`, `LockType`), new tables (`ApprovalRule`, `GroupApproval`, `GroupVersion`, `ChangeRequest`, `ImpersonationSession`, `IntegrationConfig`, `SecurityPolicy`, `GroupTimelineEntry`), and additive columns on `Group`, `WorkflowStage`, `AuditLog`. **No destructive changes.**

## Upgrade Notes
- Apply migrations with `prisma migrate deploy` (manual, not auto on boot) — order in Doc 02.
- Post-deploy, seed business config: SLA hours, approval-rule matrix, notification templates; set WaSender credentials.
- Set production secrets (do not reuse dev values).

## Quality / Verification
- Backend suites green; frontend 12-point checklist passed per screen via real browser interaction.
- Pixel QA: 9 screens × 3 viewports = 27 captures, all clean (0 errors/warnings/failed requests, no overflow, no polling).
- End-to-end UAT: **12/12** (full lifecycle submit → approve → lock → change-request → unlock → re-approve → finalize).

## Known Notes / Non-Goals
- Broader ERP modules (hotel/transport/visa/flight ops/finance/ledger/reports) are pre-existing; v2.1 governs the workflow layer around them.
- Load/performance testing at production scale is recommended post-deploy (not part of RC verification).
- Carry-over go-live security items from v2.0.1 (public Redis/PG exposure P-01; UAT super-admin in prod DB P-02) must be resolved by the owner before go-live.

## Constraint of Record
Entire v2.1 program built and verified **LOCAL-only** — nothing was deployed, committed, or pushed. This release package is the promotion contract.
