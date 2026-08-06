# 02 · MIGRATION EXECUTION ORDER — v2.1

**Tooling:** Prisma 6 (`prisma migrate deploy` — non-interactive, applies only pending migrations in timestamp order).
**Mechanism:** Migrations are **NOT** auto-run on API boot. They are applied here, deliberately, before the app swap.
**Nature:** The entire v2.1 set is **additive** (new enums, tables, nullable/defaulted columns). No destructive DDL, no data backfill.

---

## 1. The v2.1 Migration Set (apply in this exact order)
Prisma applies by folder timestamp; this is the resulting order. All must show as applied.

| Order | Migration | Introduces |
|-------|-----------|-----------|
| 1 | `20260804210010_flight_management_module` | Flight management module tables/columns |
| 2 | `20260804214921_agent_ops_group_locking` | `ApprovalStatus` enum; Group locking columns (approvalStatus/locked/submittedAt/approvedAt/approvedByUserId/lockedAt/returnReason); `ChangeRequest`; `GroupTimelineEntry`; `ImpersonationSession`; AuditLog +actingAsUserId/reason/userAgent |
| 3 | `20260804220420_audit_correlation` | AuditLog +correlationId/workflowId; GroupTimelineEntry +correlationId |
| 4 | `20260804222036_v21_enterprise_capabilities` | `LockType` enum; Group +lockType/stageEnteredAt; WorkflowStage +slaHours; ImpersonationSession +actionCount/summary; `ApprovalRule`; `GroupApproval`; `GroupVersion`; `SecurityPolicy` |
| 5 | `20260804225443_integration_config` | `IntegrationConfig` (WaSender; API key AES-256-GCM encrypted at rest) |

> Everything before migration #1 (up to and including `20260803211614_billing_rate_cards`) belongs to prior releases and must already be applied in production.

## 2. Pre-flight
```bash
# 2.1 Confirm DATABASE_URL points at PRODUCTION and a backup exists.
# 2.2 Inspect pending migrations (no changes made):
npx prisma migrate status
```
Expected: the 5 migrations above listed as **not yet applied**; everything else applied.

## 3. Apply
```bash
# From apps/api with production DATABASE_URL in the environment:
npx prisma migrate deploy
```
- Runs inside its own transaction per migration; a failure stops the sequence.
- Do **not** use `migrate dev` or `db push` in production.

## 4. Verify (post-apply)
```bash
npx prisma migrate status          # all 5 now applied, 0 pending
```
Spot-check schema objects exist (read-only):
```sql
-- enums
SELECT 1 FROM pg_type WHERE typname IN ('ApprovalStatus','LockType');
-- new tables
SELECT to_regclass('"ApprovalRule"'), to_regclass('"GroupApproval"'),
       to_regclass('"GroupVersion"'), to_regclass('"ChangeRequest"'),
       to_regclass('"ImpersonationSession"'), to_regclass('"IntegrationConfig"'),
       to_regclass('"SecurityPolicy"'), to_regclass('"GroupTimelineEntry"');
-- new columns
SELECT column_name FROM information_schema.columns
 WHERE table_name='Group' AND column_name IN ('approvalStatus','locked','lockType','stageEnteredAt');
SELECT column_name FROM information_schema.columns
 WHERE table_name='WorkflowStage' AND column_name='slaHours';
```
All objects must resolve (no NULL/`to_regclass` misses).

## 5. Failure Handling
- **Migration errors mid-sequence:** stop. Do not deploy the API. Investigate; because migrations are transactional, a failed one is rolled back. Fix root cause (usually connectivity/permissions), then re-run `prisma migrate deploy`.
- **Partial state suspicion:** compare `prisma migrate status` against the table above; restore from backup if the DB is in an unexpected state (see Doc 03).

## 6. Notes
- No down-migrations are used in production. Because the set is additive, a returning older app version tolerates the new columns/tables (they are nullable/defaulted and unused by the old code). See Rollback (Doc 03).
- `IntegrationConfig` holds the WaSender key **encrypted (AES-256-GCM)**; the migration creates the table empty — credentials are set post-deploy via env or the WaSender Config screen.
