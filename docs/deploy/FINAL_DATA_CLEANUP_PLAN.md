# FINAL DATA CLEANUP PLAN — TUBA AL HIJAZ production
Generated 2026-08-09 against the live `tubaalhijaz` database (79 tables, 807 rows).

## Headline
**Production contains no demo/seed clutter.** 0 rows carry a seed code (`NL-%`), 0
`OperationalFlight` rows are `isTestData`, and every Module 10 operational table
(FlightMaster, OperationalFlight, FlightInfo, DispatchOrder, MeetAssistTask) is
EMPTY. The owner's instruction ("I don't need the old design/data") refers to the
retired **UI**; it does not authorise deleting business records.

**Only ONE category is conclusively safe to delete: dead refresh tokens (D).**

## Classification

### A — SYSTEM / REQUIRED (preserve; app breaks without them)
Role 9 · Permission 14 · RolePermission 31 · MessageTemplate 48 · NotificationEvent 19 ·
WorkflowStage 19 · AutomationRule 18 · ChartAccount 27 · CurrencyRate 7 · Season 1 ·
FeatureFlag 9 · Airline 3 · Airport 4 · Terminal 2 · _prisma_migrations 31.
Airline/Airport/Terminal are **reference master data**, not test rows.

### B — REAL BUSINESS DATA (preserve; irreplaceable)
Company 2 · Group 3 · Passenger 38 · HotelBooking 2 · VisaRequest 2 · Voucher 1 ·
LedgerEntry 1 · PaymentSlip 1 · Wallet 1 · WalletTransaction 1 · UploadedFile 49 ·
OcrDocument 10 · AuditLog 48 · AgentProfile 1 · SupplierProfile 2 · BRN 2 ·
MutamerImportRun 3 · GroupTimelineEntry 3 · User 6.

### C — TEST / DEMO / PLACEHOLDER
**NONE FOUND.** No seeded notification codes, no `isTestData` rows, no demo flights.

### D — TEMPORARY / SESSION (safe to prune)
| Table | Rows | Action |
|---|---|---|
| RefreshToken | 274 (203 revoked, 19 expired, 52 active) | **DELETE revoked OR expired.** Both are already invalid — cannot end a live session. **Keep all 52 active.** |
| PasswordResetToken | 1 | Keep — 30-min TTL, self-expiring. |

### E — LEGACY / OBSOLETE
**NONE.** 44 tables are empty (unused features), which is not obsolete data.

### F — UNKNOWN / REQUIRES OWNER APPROVAL (NOT deleted)
| Item | Rows | Why it is NOT auto-deleted |
|---|---|---|
| 4 SUSPENDED `@tubaalhijaz.local` users | 4 | **2 are referenced by `AuditLog.actorUserId`, FK `ON DELETE SET NULL`.** Deleting them silently erases actor attribution on real audit records (CREATE Services 2026-08-02, CREATE OpsControl 2026-08-03). They are already SUSPENDED = inert. **Recommend: keep.** |
| NotificationLog PENDING | 23 | Real workflow output (2026-07-25→08-06) that never sent due to the pre-`07a522e` dispatch bug. No seed codes. Deleting destroys the record that a notification was attempted. **Do NOT requeue** — that would spam recipients with stale mail. |
| AutomationRunLog | 69 | Live operational run history, still being written today (2026-07-25→08-09). |
| NotificationLog FAILED | 2 | Diagnostic value. |

## Approved automatic action (this release)
`DELETE FROM "RefreshToken" WHERE "revokedAt" IS NOT NULL OR "expiresAt" < now();`
Transactional. No FK dependents (`RefreshToken.userId` is the child side). Zero
business impact: every deleted row is already unusable for authentication.

Everything in **F** requires explicit owner approval and is deliberately untouched.
