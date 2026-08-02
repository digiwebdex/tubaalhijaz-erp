# T002-04 Completion — Approval / Rejection Notifications

**Task:** T002-04 (TRANSFORM-002)  
**Date:** 2026-08-01  
**Status:** Complete — stopped before T002-05

---

## Prompt vs architecture

The implementation prompt titled this task “MOFA Processing Workflow.”  
Architecture §17 defines:

> **T002-04** Approval/Rejection notifications | Wire `VISA_APPROVED` / `VISA_REJECTED`

**Contract followed = architecture.** MOFA completeness / MOFA Bill is **T002-06**. Embassy / Passport Return is **T002-05**.

---

## 1. Exact Scope

Quoted from `analysis/TRANSFORM_002_ARCHITECTURE.md` §17:

> **T002-04** Approval/Rejection notifications | Wire `VISA_APPROVED` / `VISA_REJECTED`

Supporting contract §9:

| Business event | Channels | Recipients | Key |
|----------------|----------|------------|-----|
| Pipeline → ISSUED | WA + Email + In-App | Agent tenant + Admin staff | `VISA_APPROVED` |
| Pipeline → REJECTED | WA + Email + In-App | Agent + Admin | `VISA_REJECTED` |

Domain emits already exist from T002-03. This pack only wires AutomationRules → Notification dispatch.

**Not in this pack:** MOFA fields/bill, Embassy, Passport Return, Day-85, government APIs, reports, new queues.

---

## 2. Reuse Declaration

| Category | Items |
|----------|--------|
| **Reused** | Passenger pipeline emit (`visa.approved` / `visa.rejected`), NotificationEvent keys, MessageTemplates / `@tuba/shared` catalog, Automation dispatcher + BullMQ, NotificationsService, intake fan-out pattern (Agent matrix + staff IN_APP), AuditLog (unchanged), RBAC, Visa Desk |
| **Extended** | AutomationProcessor ensure-on-boot; seeds; shared VISA_* template copy (honesty); emit payload vars (`code`, `groupCode`, …) |
| **New modules** | None — helper `visa-notification.pack.ts` inside Automation (same pattern as intake pack) |
| **Untouched** | Visa state machine rules, MOFA bill, Embassy SOP, Finance, Long Stay, Day-85, OCR |

---

## 3. Business Workflow

1. Visa Desk transitions mutamer → **ISSUED** or **REJECTED** (T002-03).  
2. `VisaPipelineService` emits `visa.approved` / `visa.rejected` with tenant + template vars.  
3. Dispatcher matches **AR-VISA-01** / **AR-VISA-02**.  
4. Worker `SEND_NOTIFICATION` with `notifyPolicy: "visa"`:  
   - Agent company → matrix channels (WA / Email / In-App per event flags)  
   - SUPER_ADMIN + OPS_STAFF → IN_APP  
5. Intermediate transitions (MOFA, BIOMETRIC, …) do **not** fire VISA_* notify (no spam).

---

## 4. Business Scenario Validation

| Scenario | Result |
|----------|--------|
| ISSUED → `VISA_APPROVED` logs (agent + staff) | **PASS** |
| REJECTED → `VISA_REJECTED` logs | **PASS** |
| Intermediate states do not create VISA_APPROVED | **PASS** |
| Agent transition attempt → 403 | **PASS** |
| AR-VISA-01/02 enabled + catalog events | **PASS** |
| Desk mutamer board regression | **PASS** |

---

## 5. Business Impact

- Agents and Ops receive material visa issue/reject notifications.  
- Seeded `VISA_*` templates are live (no longer orphaned).  
- Skip-safe WA (no `WASENDER_API_KEY`) remains non-fatal (existing channel pattern).  
- Honesty: templates describe staff-issued / rejected status — no fake live MOFA API claim.

---

## 6. Files Changed

| Path | Change |
|------|--------|
| `apps/api/src/automation/visa-notification.pack.ts` | **New** — ensure events/templates/AR-VISA-01…02 |
| `apps/api/src/automation/automation.processor.ts` | Boot ensure + `notifyPolicy: visa` + renderBody |
| `apps/api/src/groups/visa-pipeline.service.ts` | Richer emit vars for templates |
| `apps/api/src/automation/events.ts` | Comment clarity |
| `packages/shared/src/notifications.ts` | Passenger-centric VISA_* copy |
| `apps/api/prisma/seed.ts` / `seed.prod.ts` | AR-VISA-01/02 |
| `apps/api/test/visa-notifications.e2e-spec.ts` | E2e pack |
| `docs/T002_04_COMPLETION.md` | This note |

---

## 7. Database Changes

None (schema). Runtime upserts:

- `NotificationEvent` `VISA_APPROVED` / `VISA_REJECTED`  
- `MessageTemplate` rows from shared catalog  
- `AutomationRule` `AR-VISA-01`, `AR-VISA-02`

---

## 8. Migration

**None.**

---

## 9. API Changes

**None.** Reuses `POST /passengers/:id/visa-transition` emits.

---

## 10. UI Changes

**None.** Bell / existing Notification Center consumes logs.

---

## 11. RBAC Changes

**None.** Transition still staff-only; notify fan-out uses tenant + staff roles.

---

## 12. Audit Changes

**None** beyond T002-03 transition audits. Notification delivery uses `NotificationLog` + `AutomationRunLog`.

---

## 13. Events

| Domain key | Rule | NotificationEvent |
|------------|------|-------------------|
| `visa.approved` | AR-VISA-01 | `VISA_APPROVED` |
| `visa.rejected` | AR-VISA-02 | `VISA_REJECTED` |
| `passenger.visa.transitioned` | *(no rule)* | — |

No new queue; reuse Automation + Notify BullMQ workers.

---

## 14. Tests Executed

| Suite | Result |
|-------|--------|
| `visa-notifications.e2e-spec.ts` | **5 PASS** |
| `visa-pipeline.e2e-spec.ts` + machine | **18 PASS** (regression) |

---

## 15. Risks

| Risk | Mitigation |
|------|------------|
| Notify volume if many ISSUED flips | Material states only; no BIOMETRIC spam |
| WA without API key | Non-fatal channel (existing) |
| Prompt/architecture mismatch on “MOFA” | Documented; MOFA deferred to T002-06 |

---

## 16. Manual Verification

1. Ops → transition mutamer to **ISSUED** with visa number.  
2. Agent Notification Center / WA / Email shows visa issued for mutamer code.  
3. Ops IN_APP bell receives copy.  
4. Transition another mutamer to **REJECTED** with reason → reject notify.  
5. Automation overview lists `visa.approved` / `visa.rejected`; rules AR-VISA-* enabled.

---

## 17. Rollback

1. Disable / delete `AR-VISA-01` and `AR-VISA-02` (or redeploy prior API image — pack ensure will re-upsert).  
2. Emits remain harmless without rules.  
3. No DB migration to reverse.

---

## STOP

**T002-05 (Embassy & Passport SOP-gated) was not started.**  
**MOFA Processing / Bill (T002-06) was not started.**
