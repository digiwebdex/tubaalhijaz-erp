# T001-08 Completion — Intake notification events + rules

**Task:** T001-08 (TRANSFORM-001)  
**Date:** 2026-07-31  
**Stop:** Do **not** start T001-09.

## Exact T001-08 Scope (from Transformation document)

> **T001-08 — Intake notification events + rules** (maps to §1.8)  
> **Modify:** `automation/events.ts`; emit in `groups.service` (create, gate patch), `passengers.service` (bulk), `ocr.service` (group-list approve); `packages/shared/src/notifications.ts`; seed/templates; Automation rule defaults  
> **Reuse:** `NotificationsService.dispatch`, `tuba-notify`, WA/Email/In-App  
> **Change:** Ensure events for: group created, group-list OCR committed, mutamer bulk imported, gates changed; recipients Agent (tenant) + Admin staff policy  
> **Acceptance:** Each action writes NotificationLog when rules enabled; WA when creds present else skip-safe  
> **Rollback:** Disable rules; remove emits

## Reuse Declaration

| | |
|--|--|
| **Modules reused** | Groups, Passengers, Mutamer Import, OCR, Uploads, Notifications, Automation Events/Rules, AuditLog, Readiness Gates |
| **Modules extended** | `events.ts`, `automation.processor` (intake fan-out), emit sites, shared templates, seed rules AR-GRP-01…04, idempotent pack ensure |
| **New modules** | **NONE** (helper `intake-notification.pack.ts` only — not a new business module) |

## Business Workflow

| | |
|--|--|
| **Business Owner** | Ops + Agent (tenant-scoped) |
| **Triggers** | Group create · gate flip · mutamer bulk import · Nusuk group-list OCR approve |
| **Processing** | Domain emit → AutomationRule (AR-GRP-01…04) → SEND_NOTIFICATION → NotificationLog (+ WA/Email/In-App) |
| **Recipients** | Agent (`recipientUserId` / tenant) + Admin staff (SUPER_ADMIN / OPS_STAFF IN_APP) |
| **Next** | T001-09 UI polish (out of scope) |

```
New Group / OCR Group commit
        ↓
group.created  (+ group.ocr.committed when from OCR)
        ↓
Mutamer bulk import → group.import.completed
        ↓
Gate flip → group.gates.changed
        ↓
NotificationLog (Agent + Staff)  |  WA skip-safe without creds
```

## Business Scenario Validation

| # | Scenario | Expected | Result |
|---|----------|----------|--------|
| 1 | New Group → Import Mutamer → Readiness Updated | NotificationLogs for CREATE / IMPORT / GATES | Covered in e2e |
| 1b | Group-list OCR approve | `GROUP_OCR_COMMITTED` log | Covered in e2e |
| 2 | OCR passport before Group | Blocked (400) | Covered in e2e |
| 3 | Duplicate passport import | Rejected (400) | Covered in e2e |
| 4 | Cross-tenant access | Rejected (404) | Covered in e2e |

## Business Impact

**Before:** Gate-flip emit existed without rules; import notify under-fired from passengers bulk; group-list OCR approve had no commit event; Agent+Admin intake pack incomplete.  
**After:** Material intake actions produce NotificationLogs via AR-GRP-01…04; staff IN_APP fan-out; WA/Email follow NotificationEvent matrix and skip safely when unconfigured.

## Files Changed

- `apps/api/src/automation/events.ts` — `OCR_GROUP_COMMITTED`
- `apps/api/src/automation/intake-notification.pack.ts` — idempotent events/rules/templates
- `apps/api/src/automation/automation.processor.ts` — ensure pack + `notifyPolicy: intake`
- `apps/api/src/groups/groups.service.ts` — recipient on create/gates
- `apps/api/src/groups/passengers.service.ts` — bulk → `IMPORT_COMPLETED`
- `apps/api/src/groups/mutamer-import.service.ts` — recipientUserId
- `apps/api/src/ocr/ocr.service.ts` — emit on group-list approve
- `packages/shared/src/notifications.ts` — intake templates
- `apps/api/prisma/seed.ts`, `seed.prod.ts` — AR-GRP-02…04 + events
- `apps/api/src/automation/intake-notification.pack.spec.ts`
- `apps/api/test/intake-notifications.e2e-spec.ts`
- `docs/T001_08_COMPLETION.md`

## Database / Migration

| Item | Detail |
|------|--------|
| **Schema migration** | **NONE** |
| **Data** | `NotificationEvent` / `MessageTemplate` / `AutomationRule` upserts (seed + boot ensure) |

## API / UI / RBAC / Audit

| Area | Change |
|------|--------|
| API | No new routes — existing emit → automation → dispatch |
| UI | None (T001-09) |
| RBAC | Unchanged — reuse existing permissions |
| Audit | Unchanged — prior workflow audits remain; notifications via NotificationLog |

## Tests Executed

- Unit: `test/intake-notification.unit.e2e-spec.ts` — **PASS** (3)
- E2E / workflow / regression: `test/intake-notifications.e2e-spec.ts` — **PASS** (7)
- Combined: **10/10 passed** (`jest --testPathPattern=intake-notification`)

## Risks

- Dual notify on OCR create path (`group.created` + `group.ocr.committed`) — intentional material signals
- Staff fan-out capped at 50 active SUPER_ADMIN/OPS_STAFF
- Chatty WA if matrix left fully on — mitigate via Notification Center toggles / disable rules

## Manual Verification

1. Restart API (ensures AR-GRP-01…04 upsert)
2. Create Group as Agent → bell + NotificationLog `GROUP_CREATED` (staff IN_APP too)
3. Flip readiness gates → `GROUP_GATES_CHANGED`
4. Bulk passengers (≥2) or Mutamer import commit → `GROUP_IMPORT_COMPLETED`
5. Approve Nusuk Group List OCR → `GROUP_OCR_COMMITTED`
6. Without `WASENDER_API_KEY`, WA logs stay PENDING (skip-safe)

## Rollback

1. Disable AR-GRP-01…04 in Automation admin (or set `enabled: false`)
2. Redeploy prior API image (stops new emits / fan-out)
3. New event key `group.ocr.committed` is additive — safe to leave unused
