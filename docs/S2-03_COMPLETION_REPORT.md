# S2-03 Completion Report — Notification Pipeline Consolidation & Expiry Scheduler Cleanup

**Date:** 2026-07-31  
**Status:** Done  
**Gaps closed:** G-08, G-09 (also covers backlog S2-06 / S2-07 / S2-08)

---

## Summary

All asynchronous notifications now flow through the existing `NotificationsService.dispatch` → BullMQ `tuba-notify` worker. Duplicate Nest `@Cron` fleet-expiry scan was removed; the sole 06:00 scheduler is BullMQ `expiry-escalation`. No second notification queue was created. Expiry business rules (30/7-day buckets, deterministic codes, escalation emit) are unchanged.

---

## Files changed

| Area | Path |
|---|---|
| Dispatch contract | `apps/api/src/notifications/notifications.constants.ts` (`code`, `literalContent`) |
| Dispatch + idempotency | `apps/api/src/notifications/notifications.service.ts` |
| Voucher notify | `apps/api/src/services/services.service.ts`, `services.module.ts` |
| Supplier reject notify | `apps/api/src/services/supplier.controller.ts` |
| Fleet expiry | `apps/api/src/fleet/expiry.service.ts`, `fleet.module.ts` |
| Scheduler comment | `apps/api/src/automation/automation.scheduler.ts` |
| Tests | `apps/api/test/notify-pipeline.e2e-spec.ts`, `fleet.e2e-spec.ts` (comment) |
| Docs | `PRODUCT_MASTER_SPEC.md`, `FEATURE_STATUS_MATRIX.md`, `IMPLEMENTATION_ROADMAP.md`, `SPRINT_BACKLOG.md`, this report |

---

## Queue changes

| Queue | Change |
|---|---|
| `tuba-notify` | **Reused** — voucher, supplier reject, fleet expiry now enqueue `send` jobs here |
| `tuba-automation` | **Unchanged** — still owns repeatable `expiry-escalation` at `0 6 * * *` |
| New queues | **None** |

Nest in-process cron job `fleet-expiry-scan` **removed**.

---

## API changes

| Endpoint | Change |
|---|---|
| `POST /fleet/expiry/scan` | Behavior preserved; alerts created via `dispatch` (worker delivery) instead of `createMany` |
| Other HTTP routes | No signature changes |

---

## Tests

| Coverage | Where |
|---|---|
| Notification delivery (IN_APP → DELIVERED) | `notify-pipeline.e2e-spec.ts`, existing `notifications.e2e-spec.ts` |
| Idempotent codes / no duplicate notifications | `notify-pipeline.e2e-spec.ts`, `fleet.e2e-spec.ts` |
| Retry / queue recovery (attempts: 4 on send jobs) | `notify-pipeline.e2e-spec.ts` |
| Expiry execution + no duplicate processing | `notify-pipeline.e2e-spec.ts` |
| Nest cron absent; BullMQ scheduler present | `notify-pipeline.e2e-spec.ts` |
| Voucher notification row still created | `services-workflow.e2e-spec.ts` (existing) |

---

## Risks

| Risk | Mitigation |
|---|---|
| Fleet expiry volume enqueues many small jobs at 06:00 | Same scan logic as before; worker concurrency 8; codes prevent re-doubling |
| `literalContent` bypasses templates for voucher/reject/expiry | Intentional — preserves prior copy; automation still uses templates |
| Process restart before worker drains | BullMQ + Redis; jobs persist; attempts/backoff unchanged |
| Residual Nest `ScheduleModule` | Harmless; no fleet cron registered |

---

## Rollback

1. Revert the S2-03 commit(s) on API.  
2. Redeploy previous API image.  
3. No DB migration in this ticket — no schema rollback required.  
4. If only Nest cron must return temporarily: restore `@Cron` on `ExpiryService.scheduled` **or** keep BullMQ-only (preferred). Do not run both.

---

## Stop

S2-03 only. Next Sprint 2 tickets (Finance/Automation unhide, OCR e2e, etc.) untouched.
