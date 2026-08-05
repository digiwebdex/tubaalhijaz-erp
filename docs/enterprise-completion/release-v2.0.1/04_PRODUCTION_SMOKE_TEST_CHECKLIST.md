# 04 · PRODUCTION SMOKE TEST CHECKLIST — v2.0.1 (run immediately post-deploy, ~5 min)
Base: `https://tubaalhijaz.com`. Stop and consider rollback on any ❌.

## Platform
- [ ] `GET /api/health` → 200 `{status:"ok"}`.
- [ ] Web app loads (`/`), no white screen; browser console clean on the login page.
- [ ] Both containers `:v2.0.1` and `healthy` (`docker ps`).

## Auth
- [ ] Staff login works (real staff account) → dashboard.
- [ ] Agent login works → agent portal.
- [ ] **New:** `/login` → "Forgot password?" → `/reset-password` renders; submitting an email shows the confirmation (no error). (Actual email requires SMTP.)

## Core money path (read-only smoke — no writes)
- [ ] Finance staff: Finance dashboard, P&L, Balance Sheet, Invoices all load.
- [ ] Agent: wallet + statement load.
- [ ] **New:** SUPER_ADMIN opens `/rate-cards` → page renders, lists tabs (transport/visa/additional).

## Per-portal
- [ ] Agent portal: groups list loads; open a group; service tabs load.
- [ ] Supplier portal: incoming bookings list loads.
- [ ] Ops: groups/arrivals/dispatches boards load.

## Quick RBAC sanity
- [ ] Agent cannot reach a staff-only screen (redirected / no data), no crash.

If all ✅ → proceed to 05 (deeper verification) and 06 (monitoring watch). If any ❌ → 03 (rollback).
