# BUSINESS PROCESS AUDIT — TUBA AL HIJAZ (v2.1, LOCAL, read-only)
Date 2026-08-05. Evidence-based (SSH inspection + live DB + prior 4-way tests). No code changed.

## 1. Business Flow Diagram (evidence per stage)
```
Customer→Agent→Ops→Visa→Flight→Hotel→Transport→Catering→Payment→Finance→Supplier→Documents→Dispatch→Airport→Completed→Archived
```
| Stage | DB | API | Workflow | Notify(WA/Email/InApp) | Timeline | Audit | RBAC | Reports | State |
|---|---|---|---|---|---|---|---|---|---|
| Agent/Group | ✅ Group | ✅ /groups | ✅ Draft→…→Archived | ✅ (verified) | ✅ | ✅ | ✅ | ✅ | READY |
| Passenger | ✅ | ✅ /passengers | lock-enforced | via group | ✅ | ✅ | ✅ | ✅ | READY |
| Visa | ✅ VisaRequest+pipeline | ✅ | desk states | ✅ events | partial | ✅ | ✅ | ✅ | READY |
| Flight | ✅ FlightInfo+Assignment | ✅ /flights (21/21) | status+meet-assist | events | via ops | ✅ | ✅ | ✅ | READY |
| Hotel/Transport/Catering | ✅ bookings | ✅ /services | supplier-accept unified | ✅ | — | ✅ | ✅ | ✅ | READY |
| Payment/Wallet/Invoice/Ledger | ✅ | ✅ /finance | prepaid deduct + GL | ✅ | — | ✅ | ✅ | ✅ | READY (GL balanced) |
| Supplier | ✅ | ✅ /supplier | accept/reject/upload | ✅ | — | ✅ | ✅ | — | READY |
| Documents/OCR | ✅ vault | ✅ /ocr | review queue | events | — | ✅ | ✅ | — | PARTIAL (passport parser only) |
| Dispatch/Airport | ✅ DispatchOrder | ✅ /ops | boards+status WS | ✅ arrival/departure | via ops | ✅ | ✅ | ✅ | READY |
| Completed/Archived | ✅ approvalStatus | ✅ /groups/:id/{complete,archive} | ✅ (16/16) | ✅ | ✅ | ✅ | ✅ | ✅ | READY |

## 2. Integration Diagram (verified wiring)
Group→Passenger (FK+capacity) ✅ · Passenger→Visa (pipeline) ✅ · Passenger↔Flight (Ticket+Assignment) ✅ · Services→Finance: booking-confirmation → `WalletService.autoDeductForBooking` → Ledger + Invoice ✅ · Finance→Ledger/Wallet/Invoice (8 finance services) ✅ · Invoice→Reports (AR aging, GL, P&L, BS read invoice+ledgerEntry) ✅ · Dispatch/Flight→Ops WS→Timeline ✅ · Workflow→Timeline+Audit+Notification ✅ (verified 16/16) · Notification→WhatsApp(WaSender live)/Email/In-App (separate logs+jobs) ✅.

## 3. Module Status Matrix (evidence)
READY: Auth, RBAC/Users, Companies, Groups, Passengers, Visa, Flights(v2.1), Hotel/Transport/Catering, Finance/Wallet/Invoice/Ledger, Reports, Supplier, Dispatch/Ops, **Group Locking Workflow+Approval+ChangeRequest (backend, 16/16)**, **Notifications multi-channel + WaSender (backend)**.
PARTIAL: OCR (only passport parser real); Notification event coverage (catalog seeded, per-module dispatch hooks pending for passenger/service/payment/ocr/doc/support); Templates (system exists, partial adoption — workflow uses literal text).
FUTURE (schema present, backend pending — empty tables prove it): **F01 Impersonation** (design locked, unbuilt), Approval Matrix, Group Version History, Digital Signature, SLA dashboard, Force-Logout policy, Bulk Approval, Soft/Hard lock modes.
BLOCKED: none in local; production go-live still blocked by prod-host P-01/P-02 (separate prod audit).

## 4. Performance Findings
- **80/87 `findMany` have no explicit `take`** → large-payload/scale risk on high-volume tables (Passenger, NotificationLog, AuditLog, Group). Mitigated today by small data + client-side pagination; **recommend server pagination on list endpoints before scale.**
- Index coverage healthy: **124 @@index/@@unique** across 71 models.
- N+1: low — only 3 loop-await sites; most use `Promise.all`/`include`.
- Raw SQL uses `$queryRaw` tagged templates for aggregations (no full-table pulls).
- BullMQ jobs bounded: `attempts:4`, exponential backoff, `removeOnComplete/Fail`; delivery jobs are short HTTP calls → no long-job/memory-leak risk observed.

## 5. Security Findings
- JWT ✅ HS256/`JWT_SECRET`, 15-min access + rotating refresh (httpOnly cookie); prod rejects weak secret.
- RBAC ✅ DB-backed PermissionsGuard + escalation guard; guard chain Throttler→JWT→Permissions (global).
- SQL Injection ✅ SAFE — Prisma parameterized; only tagged-template `$queryRaw`, **no `*Unsafe`**.
- Encryption ✅ argon2id passwords; **AES-256-GCM** for the WaSender key at rest; key masked in API.
- Rate limit ✅ 200/min global + tightened auth/upload routes.
- CSRF: API auth is Bearer (not cookie) → N/A for API; refresh cookie httpOnly+rotated.
- XSS: React auto-escapes (frontend review deferred to FE phase).
- **Impersonation (F01) NOT built.** ⚠ **Finding:** audit is written directly in **16 services**; only the Workflow service records `actingAsUserId`. When F01 lands, edits via the other 15 sites would record actor=agent, not admin → **audit-under-impersonation gap.** Fix: request-scoped CLS/interceptor stamping impersonator context, or route audit through one `AuditService`. (Already flagged in F01 design.)
- Prod-host exposures P-01/P-02 tracked separately (not local).

## 6. Orphan Components
- Permission **`API_KEY_ACCESS` defined but referenced by no `@RequirePermissions`** (unused). `AGENT_IMPERSONATION` not yet seeded (F01 pending).
- Empty tables = the new v2.1 tables (ApprovalRule/GroupApproval/GroupVersion/ImpersonationSession/SecurityPolicy) + unexercised MutamerImportRun — expected, not dead.
- "Unrouted" pages: AgentPortal{Groups,Services,Finance} are lazy sub-modules (used); DesignSystem/I18nSystem are dev tools; MobileApps/Tablet are ComingSoon placeholders → intentional, not dead nav.
- Roles AGENT/SUPPLIER/DRIVER have 0 staff-permissions **by design** (portal roles) — not orphans.
- Duplicate notifications/timeline/audit: **none in code** — one write per action verified (a test double-count came from running the test twice, not duplicated logic).

## 7. Technical Debt
- Scattered audit writes (16 sites) — no central AuditService (→ impersonation gap above).
- Partial template adoption — workflow notifications use literal text, not `MessageTemplate` yet.
- `findMany` pagination gaps.
- Domain events emitted by only 2 services → automation-event coverage thin (most notifications are direct dispatch).

## 8. Remaining Risks
- F01 impersonation audit-propagation (must fix before impersonation is exposed).
- List-endpoint pagination at scale.
- OCR limited to passports.
- Whole v2.1 **frontend unbuilt** (Admin nav, Agent Operations, Audit Center, Notification Center, Template Manager, SLA, banner/watermark, lock-aware UI).

## 9. Production Readiness Score
- **Core ERP (v2.0.1 scope): ~90/100** — verified, already live.
- **v2.1 epic: ~60/100** — workflow/locking/approval/change-request + multi-channel notifications + WaSender are backend-complete & verified; **F01, the capability backends, per-module notification hooks, and ALL frontend + the quality gate remain.**

## 10. Recommended v2.1 Release Decision
**DO NOT release v2.1 yet.** Backend foundations are solid and verified, but v2.1 is mid-flight: F01 (security-critical, locked but unbuilt), the capability backends, notification-hook coverage, the full frontend, and the quality gate (incl. the impersonation threat-model + audit-propagation fix) are outstanding. **Continue the phased build; gate v2.1 release on F01 + frontend + quality gate.** The live v2.0.1 is unaffected — all v2.1 work is LOCAL.
