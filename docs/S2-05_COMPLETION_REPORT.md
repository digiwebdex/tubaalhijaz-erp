# S2-05 Completion Report — Enable Automation Admin

**Date:** 2026-07-31  
**Status:** Done  
**Gap closed:** G-07

---

## Summary

Automation Admin is reachable at `/automation`. Existing `AutomationNotifications.tsx` (live `/automation/*` + notification config APIs when authenticated) was wired into the router. SuperAdmin “Automation Engine” nav redirects to the same module. No rewrite, redesign, queue changes, or automation-logic changes. Unauthorized roles are blocked by UX (`CONFIGURE_WORKFLOWS`) and by API `@RequirePermissions("CONFIGURE_WORKFLOWS")`.

---

## Audit (pre-change)

| Layer | Finding |
|---|---|
| Page | `AutomationNotifications.tsx` — rules / notification center / run log; authed → live APIs |
| Route | Was `ComingSoon` at `/automation` |
| Nav | ERPShell bell link + SuperAdmin sidebar already gated; SA screen was ComingSoon |
| RBAC (UX) | `rbac.ts` maps `/automation` → `CONFIGURE_WORKFLOWS` |
| API | `AutomationController` class-level `CONFIGURE_WORKFLOWS` |
| Workers / queues | Existing BullMQ `tuba-automation` + `tuba-notify` — unchanged |
| Seed | `SUPER_ADMIN`, `OPS_STAFF` hold `CONFIGURE_WORKFLOWS`; `FINANCE_STAFF` / tenants do not |

---

## Files changed

| Path | Change |
|---|---|
| `apps/web/src/app/routes.tsx` | `/automation` → `<AutomationNotifications />` |
| `apps/web/src/app/pages/SuperAdmin.tsx` | Automation nav → `<Navigate to="/automation" />` |
| `apps/web/src/app/lib/rbac.selftest.ts` | Role matrix + SA nav filter for automation |
| `apps/api/test/automation.e2e-spec.ts` | Role matrix on `GET /automation/rules` |
| Docs | backlog, roadmap, matrix, master spec, gap analysis, this report |

---

## DB changes

None.

---

## API changes

None (existing `/automation/*` unchanged).

---

## UI changes

| Item | Detail |
|---|---|
| Route | ComingSoon removed for `/automation` |
| Page | Existing AutomationNotifications (no component replacement) |
| SuperAdmin | Automation Engine item redirects to `/automation` |
| Permissions | `RequireAuth` + `canAccessPath("/automation")` |

---

## Tests

| Suite | Coverage |
|---|---|
| `rbac.selftest.ts` | SUPER_ADMIN / OPS allow; FINANCE / AGENT / SUPPLIER deny |
| `automation.e2e-spec.ts` | Same role matrix on `GET /automation/rules` |
| `rbac.e2e-spec.ts` (existing) | Full role × Automation rules matrix |

---

## Risks

| Risk | Mitigation |
|---|---|
| Notification Center tabs need `MANAGE_SYSTEM_SETTINGS` for some endpoints | Pre-existing; Ops with only `CONFIGURE_WORKFLOWS` still manage rules/runs; SuperAdmin has both |
| Nested ERPShell if SA rendered AutomationNotifications inline | Avoided via `Navigate` |
| Accidental rule toggles by Ops | Existing confirm/toast UX; API audit of mutations unchanged |

---

## Rollback

1. Revert `routes.tsx` to `priv(<ComingSoon />, "/automation")`.  
2. Revert SuperAdmin `AutomationScreen` to `SAComingSoon`.  
3. Redeploy web image.  
4. No DB/API/queue rollback.

---

## Stop

S2-05 only. Remaining Sprint 2 tickets (OCR e2e, staging, etc.) untouched.
