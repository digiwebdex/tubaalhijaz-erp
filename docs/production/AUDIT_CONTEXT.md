# CENTRALIZED REQUEST-SCOPED AUDIT CONTEXT (CLS) — v2.1 (LOCAL)
Security-critical fix. Built on Node `AsyncLocalStorage` (no new dependency), mirroring the codebase's existing tenant-context pattern. Verified. No deploy/commit/push.

## 1. Architecture
```
HTTP request
  │
  ├─ setup-app: app.use → auditContext.run({ correlationId=UUID, ip, userAgent }, next)   ← ALS scope opens
  │
  ├─ ThrottlerGuard → JwtAuthGuard.seedTenant():                                           ← runs INSIDE the ALS scope
  │       auditContext.getStore().actualUserId   = user.impersonatorSub ?? user.sub
  │                              .actingAsUserId  = user.impersonatorSub ? user.sub : null
  │                              .actorLabel      = "<admin> on behalf of <agent>" (if impersonating)
  │                              .sessionId/.correlationId = user.impersonationSessionId (if impersonating)
  │
  ├─ Controller → Service.doWork()
  │       └─ AuditService.log({ action, module, entityType, entityId, before, after, reason?, workflowId? })
  │              └─ reads auditContext.getStore() → auto-fills actor / actingAs / ip / userAgent / correlationId / workflowId
  │                 writes ONE AuditLog row.  Developers pass ONLY domain fields.
  │
  └─ ALS scope closes at response.

Background job / BullMQ / Cron (no request):  no ALS store → AuditService.log() writes actorLabel="System".
  A job may set an explicit identity via runWithAudit({ actorLabel:"System (Cron)" }, fn).
```
Impersonation is impossible to misattribute: the actor is derived from the token's impersonator claim in ONE place (the guard), read automatically by every write — a developer cannot forget or spoof it.

## 2. Files Changed
New: `common/audit-context.ts` (ALS store + `setAuditWorkflowId` + `runWithAudit`).
Edited (core): `setup-app.ts` (audit middleware), `common/guards/jwt-auth.guard.ts` (seed identity + impersonation), `audit/audit.service.ts` (shared `log()`), `audit/audit.module.ts` (`@Global`).
Edited (writers → shared `AuditService.log`, actor now automatic): `groups/groups.service.ts`, `groups/passengers.service.ts`, `services/services.service.ts`, `flights/flights.service.ts`, `ocr/ocr.service.ts` (create), `uploads/uploads.controller.ts` (confirm). These cover every **agent-reachable** audit site (the ones an impersonating admin can trigger).
Backups: `/root/tuba-local-bak/*.bak-audit*`.

## 3. Threat Model
| Threat | Mitigation |
|---|---|
| **Privilege escalation** (impersonation grants admin powers) | Actor identity comes from the token's `impersonatorSub`; the acted-as agent's own permissions still gate the request (PermissionsGuard reads `user.sub`=agent). Audit records the admin — no power gained, full attribution. |
| **Audit bypass under impersonation** | Actor is stamped by the guard into ALS and read by every `AuditService.log`; scattered `auditLog.create` at agent-reachable sites were converted, so an impersonated edit **cannot** record as the agent. Verified: edit via impersonation token → actor=ADMIN, actingAs=AGENT. |
| **Token replay / forgery** | HS256 with the server `JWT_SECRET`; a forged/altered token fails signature (verified: wrong-secret token → 401). Impersonation tokens (F01) will be short-lived + no-refresh per the locked design. |
| **Session fixation** | Per-request `correlationId` (UUID); under impersonation it binds to the `impersonationSessionId`, so all session actions correlate and can't be cross-attributed. |
| **Context leak across requests** | `AsyncLocalStorage.run` scopes the store to a single request's async chain; no shared mutable global — concurrent requests get isolated stores. |
| **Spoofed IP/UA** | Captured from request headers for audit only (never a trust boundary); `x-forwarded-for` first hop recorded. |

## 4. Regression Results
- Audit-context suite **11/11**: normal request auto-captures actor/ip/userAgent/correlationId (no manual passing); impersonation token → actor=ADMIN, actingAs=AGENT, correlationId=session-id.
- Workflow **16/16** (audit still written, now context-aware).
- Flights **21/21** (uses the refactored audit — no breakage).
- TypeScript clean; API boots clean (no EADDRINUSE); nothing existing broke.

## Residual (non-security, mechanical)
Staff-only audit sites (companies, fleet, ops, users, invoice, rates, payment-slip *review*, visa-pipeline, auth, booking-confirmation, mutamer-import) still use direct `auditLog.create`. Impersonation **cannot reach these** (they require staff permissions an impersonated agent lacks), so their actor is always correct — but they should adopt `AuditService.log` for consistent ip/userAgent/correlation capture. Follow-up, not a security gap.
