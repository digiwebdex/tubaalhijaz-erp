# T002-08 Completion — Day-85 Compliance Engine

**Task:** T002-08 (TRANSFORM-002)
**Date:** 2026-08-01
**Status:** Complete — stopped before T002-09

---

## Architecture overrides prompt

The prompt titled this “Day-85 Compliance Engine” and sketched a generic
reminder/escalation workflow. Architecture §17 defines:

> **T002-08** Day-85 Compliance Pack | Cron + multi-party notify + red cards

**Contract followed = architecture.** Differences from the prompt:

| Prompt said | Architecture said | What shipped |
|-------------|-------------------|--------------|
| “Compliance tracking” (implying stored state) | §8 “Derived from entry date + 85; store `day85NotifiedAt`” | Stage is **derived**, only the notify stamp is persisted (one nullable column) |
| “Reject invalid manual operations” | §7 “Day-85 — **No public mutate API** — Automation job + dashboard read APIs” | No Day-85 mutate endpoint at all; the marker is unwritable (400) and resolution rides the existing `PATCH /ops/long-stays/:id` |
| “Escalation (if defined)” | §12 “Long Stay red cards (**day-85/90**)”, §2.2 “~90 days” | Escalation defined as the day-90 line (`AR-LS-90` → SEND_NOTIFICATION EMERGENCY + ESCALATE) |
| Passenger-level workflow | §2.2 / §8 — Long Stay is the tracked entity (Group `visaType=LONG_STAY` + `LongStay` row) | Compliance attaches to `LongStay`; the Visa Desk mutamer rows surface it through the existing group projection |

No business rule was invented beyond the thresholds the architecture states
(85 due, ~90 escalate). The 7-day “APPROACHING” pre-window is a **desk marker
only** — it never notifies (§3.4 “no keystroke spam”).

---

## 1. Exact Scope

Quoted from `analysis/TRANSFORM_002_ARCHITECTURE.md`:

> §17 — | 8 | **T002-08** Day-85 Compliance Pack | Cron + multi-party notify + red cards |

Supporting clauses that form the contract:

> §2.2 — “Track Absher / entry–exit / duration (~90 days). At day 85 → Host + Agent + Tuba (WA + Email) + dashboard red cards.”
> §7 — “Day-85 | No public mutate API — Automation job + dashboard read APIs”
> §8 — “Day-85 | Derived from entry date + 85; store `day85NotifiedAt`”
> §9 — “Long Stay day-85 | **WA + Email + In-App** | Host phone, Agent, Tuba official | New `LONGSTAY_DAY85`”
> §11 — “Day-85 sweep | Cron (e.g. daily 06:00) | Find LS groups/mutamers at day≥85; notify; set red-card flag” … “Reuse BullMQ Automation worker + Notification dispatch.” … “`Document.expiring` — **Do not** overload for day-85”
> §12 — “Long Stay red cards (day-85/90) | Ops + Agent (scoped) | LongStay + day85 flag”
> §14 — “Day-85 miss | Critical | Scheduled job + red cards + acceptance tests”
> §18 — “AD-T002-06 | Day-85 via Automation cron + red cards”

---

## 2. Architecture Contract

| Item | Implementation |
|------|----------------|
| Due calculation | `entryDate + 85` (derived, `apps/api/src/ops/day85.ts`) |
| Escalation line | `entryDate + 90` |
| Persisted state | `LongStay.day85NotifiedAt` only |
| Red card | `stage ∈ {DUE, ESCALATED}` |
| Resolution | `exitDate` set **or** `status=COMPLETED` **or** `renewal=APPROVED` |
| Sweep | BullMQ repeatable `SCHED_DAY85` (`15 6 * * *`) → `OpsService.day85Sweep()` |
| Notify | Domain event `longstay.day85` → `AR-LS-85` / `AR-LS-90` → `LONGSTAY_DAY85` |
| Recipients | Agent tenant (matrix), Tuba staff (In-App), Host (WhatsApp, external leg) |
| Mutate API | **None** — read projection + existing LongStay PATCH for resolution |
| Audit | `AuditLog.module = "Day85Compliance"` |

---

## 3. Reuse Declaration

**Reused unchanged**

- `Passenger`, `Group`, Visa Pipeline state machine, Visa Desk board
- `LongStay` model and `/ops/long-stays` endpoints (T002-07)
- Automation engine: `AutomationDispatcher`, `AutomationProcessor`, BullMQ queue `tuba-automation`, `evaluateConditions`
- Notification engine: `NotificationsService.dispatch`, `NotificationEvent`/`MessageTemplate` matrix, WhatsApp/Email/In-App channels, deterministic `code` de-duplication
- `AuditLog`, `PermissionsGuard` + `VIEW_DASHBOARD`, staff-only Long Stay guard
- `OpsGateway` live broadcast

**Extended**

- `LongStay` — one nullable column `day85NotifiedAt`
- `OpsService` — day-85 projection, read filter, date validation, `day85Sweep()`
- `OpsModule` — now exports `OpsService` for the worker
- `AutomationScheduler` / `automation.constants` — one more repeatable job
- `AutomationProcessor` — cron branch + external-recipient leg + `notifyCode` pass-through + `longstay.day85` body copy
- `visa-notification.pack.ts` — `LONGSTAY_DAY85` event, `AR-LS-85`, `AR-LS-90`, `SYS_LONGSTAY_DAY85`
- `packages/shared` notification templates — `LONGSTAY_DAY85` (en/bn)
- Ops Control → Long Stay screen; Ops Departments → Visa Desk drawer

**New modules:** none. One new helper file (`ops/day85.ts`, pure functions) and one new test file.

**Intentionally untouched:** Finance/MOFA bill, Hotel, OCR, Reports/Dashboards
(T002-09), `document.expiring` fleet sweep, government APIs, Agent portal
mutations, intake pipeline.

---

## 4. Business Workflow

```
Passenger (Group.visaType = LONG_STAY)
   ↓
LongStay row + Host register + Kingdom entryDate            (T002-07)
   ↓
day 78–84   APPROACHING   desk marker only, no notify
   ↓
day ≥ 85    DUE           red card → AR-LS-85 → LONGSTAY_DAY85
                          → Host WhatsApp + Agent (WA/Email/In-App) + Tuba In-App
                          → day85NotifiedAt stamped, AuditLog RUN
   ↓
day ≥ 90    ESCALATED     red card → AR-LS-90 → EMERGENCY notify + ESCALATE
   ↓
RESOLVED    exitDate recorded / status COMPLETED / renewal APPROVED
                          → red card cleared, AuditLog UPDATE (DAY85_RESOLVED)
```

The sweep is idempotent: `DUE` fires once (stamp), `ESCALATED` fires once
(compliance audit row), and every dispatch carries a deterministic
`NotificationLog.code` (`LS85-<id>-<stage>-{AGENT|STAFF-<uid>|EXT}`) so a replayed
job cannot double-message the Host.

---

## 5. Business Scenario Validation

| # | Scenario | Result |
|---|----------|--------|
| 1 | Long Stay approaching Day-85 | **PASS** — day 80 → `APPROACHING`, appears under `?day85=APPROACHING`, sweep does not notify |
| 2 | Reminder triggered | **PASS** — day 86 → `DUE`, `day85NotifiedAt` stamped, `LONGSTAY_DAY85` logs for agent + staff + Host WhatsApp, `AR-LS-85` run OK, second sweep is a no-op |
| 3 | Resolved before deadline | **PASS** — exit recorded → `RESOLVED`, red card cleared, `DAY85_RESOLVED` audit, sweep skips even past day 95 |
| 4 | Agent attempts update | **PASS** — 403 on `PATCH /ops/long-stays/:id` (exit + status) |
| 5 | Audit created | **PASS** — `Day85Compliance` RUN row, actor `System (Cron)`, `event=DAY85_NOTIFIED`, stage + dayCount recorded |
| + | Escalation | **PASS** — day 92 → `ESCALATED`, `AR-LS-90` (EMERGENCY + ESCALATE) fires once |
| + | Invalid manual ops | **PASS** — `day85NotifiedAt` in body → 400, `exitDate < entryDate` → 400, unknown `day85` filter → 400 |

---

## 6. Business Impact

- The ~90-day Long Stay overstay risk (§14 “Day-85 miss | **Critical**”) is now
  machine-enforced rather than desk memory: the clock starts at Kingdom entry
  and the reminder reaches the Host on WhatsApp, the Agent on their channel
  matrix, and Tuba staff on the in-app bell.
- Ops sees the red cards on the existing Long Stay board and on the Visa Desk
  mutamer drawer, with a filter to work the queue.
- Resolution is a single existing action (record the exit) and is fully audited,
  so “who cleared this and when” is answerable.

---

## 7. Files Changed

**Backend**

| File | Change |
|------|--------|
| `apps/api/prisma/schema.prisma` | `LongStay.day85NotifiedAt` |
| `apps/api/prisma/migrations/20260801170000_longstay_day85/migration.sql` | new (additive) |
| `apps/api/src/ops/day85.ts` | **new** — pure compliance calculator |
| `apps/api/src/ops/ops.service.ts` | projection, filter, date validation, resolution audit, `day85Sweep()`, `day85Audit()` |
| `apps/api/src/ops/ops.controller.ts` | `GET /ops/long-stays?day85=` |
| `apps/api/src/ops/ops.module.ts` | exports `OpsService` |
| `apps/api/src/automation/events.ts` | `LONGSTAY_DAY85` |
| `apps/api/src/automation/automation.constants.ts` | `SCHED.DAY85` + `SYS_LONGSTAY_DAY85` |
| `apps/api/src/automation/automation.scheduler.ts` | repeatable `15 6 * * *` |
| `apps/api/src/automation/automation.processor.ts` | cron branch, external Host leg, `notifyCode`, `longstay` policy, body copy |
| `apps/api/src/automation/automation.module.ts` | imports `OpsModule` |
| `apps/api/src/automation/visa-notification.pack.ts` | `LONGSTAY_DAY85`, `AR-LS-85`, `AR-LS-90`, `SYS_LONGSTAY_DAY85`, conditions/cron in upsert |
| `apps/api/prisma/seed.ts`, `seed.prod.ts` | rule parity |
| `packages/shared/src/notifications.ts` | `LONGSTAY_DAY85` templates (en/bn) |
| `apps/api/test/day85-compliance.e2e-spec.ts` | **new** — 10 tests |

**Frontend**

| File | Change |
|------|--------|
| `apps/web/src/app/pages/OpsControl.tsx` | Day-85 column, red-card counter, stage filters, drawer panel, resolve action |
| `apps/web/src/app/pages/OpsDepartments.tsx` | Day-85 row + red-card banner in the Visa Desk mutamer drawer |

---

## 8. Database Changes

```
LongStay.day85NotifiedAt  TIMESTAMP(3) NULL
```

Nothing else. No new table, no enum, no index change, no backfill.

---

## 9. Migration

`20260801170000_longstay_day85` — `ADD COLUMN IF NOT EXISTS`, additive and
backward compatible (architecture principle 9). Applied to the e2e database and
the live `tubaalhijaz` database; recorded in `_prisma_migrations`.

---

## 10. API Changes

| Endpoint | Change |
|----------|--------|
| `GET /ops/long-stays` | Each row gains `day85 { stage, dayCount, dueAt, escalateAt, daysToDue, redCard, resolved, resolvedBy, notifiedAt }`; new optional `?day85=<stage>|red` filter (400 on unknown value) |
| `GET /ops/visa/mutamers` | `longStayHost` gains the same `day85` block |
| `PATCH /ops/long-stays/:id` | Unchanged surface; now validates `exitDate ≥ entryDate` and `exitDate` requires `entryDate`, and writes a compliance audit row on resolution |

**No Day-85 mutate endpoint exists** (architecture §7). `day85NotifiedAt` is
rejected by the global `forbidNonWhitelisted` validation pipe (400).

---

## 11. UI Changes

Reused screens only — no Day-85 screen was created.

- **Ops Control → Long Stay:** Day-85 column (`🔴 D<n> · STAGE`), red-card
  counter, `All / Red cards / Approaching / Resolved` filters, drawer section
  with entry date, due date, exit, notified-at, and a “Record exit / resolve”
  action that calls the existing PATCH.
- **Ops Departments → Visa Desk drawer:** Day-85 row and a red-card banner for
  `LONG_STAY` mutamers, pointing back to Ops Control for resolution.
- **Automation admin:** `AR-LS-85`, `AR-LS-90`, `SYS_LONGSTAY_DAY85` are visible
  through the existing rule list (§6 “Day-85 rule visibility”).

---

## 12. RBAC Changes

None. Existing controls carry the feature:

- `/ops/*` is gated by `@RequirePermissions("VIEW_DASHBOARD")` (agents/suppliers lack it).
- `createLongStay` / `updateLongStay` throw `ForbiddenException` for any caller with a `companyId` → agents get **403** on resolution attempts.
- The sweep runs as the system actor with no user session and no HTTP surface.

---

## 13. Audit Changes

New audit module `Day85Compliance` on `entityType = "LongStay"`:

| Action | Actor | `after` payload |
|--------|-------|-----------------|
| `RUN` | `actorLabel = "System (Cron)"` | `event=DAY85_NOTIFIED`, `stage`, `dayCount`, `dueAt`, `escalateAt`, `group`, `hostName`, `hostWhatsapp`, `hostComplete`, `notifyCode` |
| `UPDATE` | staff user | `event=DAY85_RESOLVED`, `resolvedBy`, `stageBefore`, `stageAfter`, `dayCount`, `wasRedCard`, `notifiedAt` |

The existing `OpsControl` LongStay audit additionally records `day85Stage`.
The `ESCALATED` audit row doubles as the escalation de-duplication key.

---

## 14. Event Changes

One new domain event on the existing bus:

```
longstay.day85   data: { code, stage, dayCount, daysToDue, dueAt, escalateAt,
                         entryDate, groupCode, groupName, agent,
                         hostName, hostWhatsapp, notifyCode }
```

Emitted only by `day85Sweep()`. No new queue — `tuba-automation` and
`tuba-notify` are reused. `document.expiring` was **not** overloaded (§11).

---

## 15. Automation Changes

| Rule | Event | Condition | Actions |
|------|-------|-----------|---------|
| `AR-LS-85` | `longstay.day85` | `data.stage = DUE` | `SEND_NOTIFICATION` (`LONGSTAY_DAY85`, policy `longstay`) |
| `AR-LS-90` | `longstay.day85` | `data.stage = ESCALATED` | `SEND_NOTIFICATION` (EMERGENCY) + `ESCALATE` |
| `SYS_LONGSTAY_DAY85` | cron | — | Run-log handle for the sweep (`15 6 * * *`) |

Scheduler: BullMQ repeatable `longstay-day85` at 06:15 daily (15 minutes after
the existing expiry sweep so the two do not contend). Seeded idempotently on
boot by `ensureVisaNotificationPack` and present in both seed scripts.

The `SEND_NOTIFICATION` handler gained a generic **external recipient leg**: when
a domain event carries `recipientAddress`, the notification also goes to that
phone/email. This is how the Host — who is not a login user — is reached.

---

## 16. Tests Executed

`apps/api/test/day85-compliance.e2e-spec.ts` — 10 tests, all pass:

1. Unit — `day85View` stages, due date, red card, resolution precedence, notify code
2. Automation — `AR-LS-85` / `AR-LS-90` / `SYS_LONGSTAY_DAY85` / `LONGSTAY_DAY85` seeded, event in `/automation/overview` catalog
3. Scenario 1 — approaching (no notify)
4. Scenario 2 — reminder + Host WhatsApp log + run log + idempotency
5. Escalation — day-90 leg fires once
6. Scenario 3 — resolved before deadline, sweep skips
7. Validation — unwritable marker, bad date order, bad filter
8. Scenario 4 — agent 403
9. Scenario 5 — audit content
10. Regression — Visa Desk marker + host register intact

Full regression: **38 suites / 373 tests passed** (`pnpm --filter api test:e2e`
equivalent, run in band). API and Web `tsc --noEmit` clean.

---

## 17. Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Long Stay rows without `entryDate` are invisible to the sweep | Medium | `NOT_TRACKED` is shown explicitly in both UIs; entry date is part of the T002-07 host register flow |
| Missing/incorrect Host WhatsApp silently drops the Host leg | Medium | `hostComplete` is recorded in the compliance audit; `REQUIRE_LONGSTAY_HOST_WHATSAPP` already blocks host registration without a number |
| WhatsApp channel unconfigured | Low | T001 skip-safe pattern — send is marked PENDING, never fatal |
| Escalation de-dupe depends on the audit row | Low | Audit writes are synchronous in the sweep and covered by a test; a duplicated dispatch is still blocked by the unique notification code |
| Clock/timezone drift on day boundaries | Low | Whole-day flooring from the stored entry timestamp; a ±1 day boundary shift only moves the alert by one sweep and the day-90 leg still fires |

---

## 18. Manual Verification

1. Ops Control → Long Stay: open a `LONG_STAY` group’s stay, register the host, set the Kingdom entry date ~86 days back.
2. The row shows `🔴 D86 · DUE` and the red-card counter increments; the `Red cards` filter isolates it.
3. Trigger the sweep (wait for 06:15, or run the repeatable job) and confirm:
   - `day85NotifiedAt` is stamped (drawer “Notified”),
   - Notifications → logs contain `LONGSTAY_DAY85` for the agent tenant, staff bell and the Host number,
   - Automation → `AR-LS-85` shows an OK run.
4. Ops Departments → Visa Desk: open a mutamer in that group — the drawer shows the Day-85 row and the red-card banner.
5. Click “Record exit / resolve”, enter today’s date — stage becomes `RESOLVED`, the red card clears.
6. Audit Logs: filter `Day85Compliance` — a `RUN` row by “System (Cron)” and an `UPDATE` row (`DAY85_RESOLVED`) by the staff user.
7. As an agent, `PATCH /ops/long-stays/:id` → 403. Sending `day85NotifiedAt` as staff → 400.

---

## 19. Rollback

1. **Automation:** disable `AR-LS-85`, `AR-LS-90` (and `SYS_LONGSTAY_DAY85`) in `/automation` — the sweep then produces no notifications. Removing the repeatable job: `queue.removeJobScheduler("longstay-day85")`.
2. **Code:** revert the files in §7. The only cross-module coupling is `AutomationModule → OpsModule`; reverting `automation.processor.ts`, `automation.module.ts`, `automation.constants.ts`, `automation.scheduler.ts` and `ops.module.ts` restores the previous graph.
3. **Database:** the column is additive and nullable — it can be left in place. To remove: `ALTER TABLE "LongStay" DROP COLUMN "day85NotifiedAt";` plus deleting the `20260801170000_longstay_day85` row from `_prisma_migrations`.
4. **Seeded rows:** `DELETE FROM "AutomationRule" WHERE code IN ('AR-LS-85','AR-LS-90','SYS_LONGSTAY_DAY85');` and, if desired, the `LONGSTAY_DAY85` `NotificationEvent` with its templates.

No data loss on rollback — the compliance trail lives in `AuditLog`, which is untouched.
