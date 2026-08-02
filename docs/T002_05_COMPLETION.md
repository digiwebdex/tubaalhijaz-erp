# T002-05 Completion — Embassy & Passport (SOP-gated)

**Task:** T002-05 (TRANSFORM-002)  
**Date:** 2026-08-01  
**Status:** Complete — stopped before T002-06

---

## Architecture overrides prompt

The implementation prompt described a free-form “Embassy Submitted / Passport Sent / Passport Received” product.  
Architecture §17 defines:

> **T002-05** Embassy & Passport (SOP-gated) | Embassy fields; PASSPORT_RETURNED; `VISA_REQUIRE_PASSPORT_RETURN`

**Contract followed = architecture.** No parallel workflow engine; no PassportMovement table (SOP did not mandate it). Slim Passenger fields + existing pipeline states.

**Difference:** Prompt “Passport Sent/Received” map to architecture **EMBASSY** (submission) and **PASSPORT_RETURNED** (custody), not new states.

---

## 1. Exact Scope

Quoted from `analysis/TRANSFORM_002_ARCHITECTURE.md` §17:

> **T002-05** Embassy & Passport (SOP-gated) | Embassy fields; PASSPORT_RETURNED; `VISA_REQUIRE_PASSPORT_RETURN`

Supporting:

- §3.4–§3.5 — ISSUED → PASSPORT_RETURNED (custody); flag gates ISSUED → COMPLETED  
- §8 — Embassy: REUSE `VisaRequest.embassy` / Group.consulate; Passport custody: EXTEND slim Passenger fields  
- §9 — PASSPORT_RETURNED notify (In-App + WA if material)  
- AD-T002-07 — Embassy/passport-return SOP-gated  

**Not in this pack:** MOFA Bill (T002-06), Long Stay, Day-85, Reports, Finance, government/Embassy APIs.

---

## 2. Architecture Contract

| Item | Implementation |
|------|----------------|
| Embassy fields | `Passenger.embassyRef`, `embassySubmittedAt`; activate `VisaRequest.embassy` on transition |
| PASSPORT_RETURNED | Existing pipeline state + `passportReturnedAt` + `custodyConfirmed` |
| `VISA_REQUIRE_PASSPORT_RETURN` | Enforced in machine; hidden from `allowedNext`; desk `sop` meta |
| SOP-gated | Flag default **off**; when on, cannot skip passport return |

---

## 3. Reuse Declaration

| Category | Items |
|----------|--------|
| **Reused** | Passenger, Visa Pipeline, Visa Desk, Groups, VisaRequest.embassy, Group.consulate, AuditLog, Automation/Notify, RBAC, Ops layout |
| **Extended** | Passenger slim custody columns; transition DTO; desk projection/UI; visa notification pack (AR-VISA-03) |
| **New modules** | None |
| **Untouched** | MOFA bill, Long Stay, Day-85, Finance, Hotel/Transport, government APIs |

---

## 4. Business Workflow

1. Visa Desk advances mutamer → **EMBASSY** with embassy/consulate context or `embassyRef`.  
2. `embassySubmittedAt` stamped; optional `VisaRequest.embassy` update.  
3. Pipeline continues (BIOMETRIC → … → ISSUED).  
4. **PASSPORT_RETURNED** with `custodyConfirmed=true` → `passportReturnedAt` + notify.  
5. If `VISA_REQUIRE_PASSPORT_RETURN=true`, ISSUED → COMPLETED is rejected (must pass PASSPORT_RETURNED).

---

## 5. Business Scenario Validation

| Scenario | Result |
|----------|--------|
| 1 Embassy submission (→ EMBASSY + ref) | **PASS** |
| 2 Embassy processing update (noop + ref) | **PASS** |
| 3 Passport returned + notify | **PASS** |
| 4 Invalid (NEW→PASSPORT_RETURNED, EMBASSY no context, SOP skip) | **PASS** |
| 5 Agent transition / PATCH embassy → **403** | **PASS** |

---

## 6. Business Impact

- Desk can capture embassy file refs without a second app.  
- Passport custody is attributable and notifiable.  
- SOP flag lets Ops harden ISSUED → COMPLETED when custody SOP is confirmed.

---

## 7. Files Changed

| Path | Change |
|------|--------|
| `apps/api/prisma/schema.prisma` | `embassyRef`, `embassySubmittedAt`, `passportReturnedAt` |
| `apps/api/prisma/migrations/20260801140000_embassy_passport_custody/` | Migration |
| `apps/api/src/groups/visa-pipeline.machine.ts` | EMBASSY context guard; `allowedTargets` SOP filter |
| `apps/api/src/groups/visa-pipeline.service.ts` | Field stamps, emit passport-returned, SOP meta |
| `apps/api/src/groups/passengers.dto.ts` / `passengers.service.ts` | Transition + staff-only PATCH |
| `apps/api/src/ops/ops.service.ts` | Project fields + `sop` |
| `apps/api/src/automation/events.ts` | `visa.passport.returned` |
| `apps/api/src/automation/visa-notification.pack.ts` | AR-VISA-03 + PASSPORT_RETURNED event |
| `packages/shared/src/notifications.ts` | PASSPORT_RETURNED templates |
| `apps/web/.../OpsDepartments.tsx` | Drawer fields + EMBASSY prompt + SOP banner |
| Seeds / `.env.example` | AR-VISA-03; flag comment |
| `apps/api/test/embassy-passport.e2e-spec.ts` | Scenarios 1–5 |
| Machine / pipeline e2e | EMBASSY context updates |
| `docs/T002_05_COMPLETION.md` | This note |

---

## 8. Database Changes

Nullable on `Passenger`:

- `embassyRef` TEXT  
- `embassySubmittedAt` TIMESTAMP(3)  
- `passportReturnedAt` TIMESTAMP(3)  

---

## 9. Migration

`20260801140000_embassy_passport_custody` — applied to e2e + live.

---

## 10. API Changes

- `POST /passengers/:id/visa-transition` — optional `embassyRef`, `embassy`, `embassySubmittedAt`; response includes custody fields + `sop`  
- `PATCH /passengers/:id` — staff may set slim custody fields; agents **403**  
- `GET /ops/visa/mutamers` — projects custody fields; `sop.requirePassportReturn`

No parallel Embassy API.

---

## 11. UI Changes

Visa Desk mutamer drawer: Embassy Ref / Submitted / Passport Returned; EMBASSY transition prompt; SOP banner when flag on.

---

## 12. RBAC Changes

None new. Transition + embassy PATCH remain staff-only (`companyId` forbidden).

---

## 13. Audit Changes

Successful / rejected transitions continue under `VisaPipeline`; after payload includes embassy/custody fields and SOP snapshot.

---

## 14. Event Changes

| Domain | Rule | NotificationEvent |
|--------|------|-------------------|
| `visa.passport.returned` | AR-VISA-03 | `PASSPORT_RETURNED` (In-App + WA; no email) |

No new queue.

---

## 15. Tests Executed

| Suite | Result |
|-------|--------|
| `embassy-passport.e2e-spec.ts` | **PASS** |
| `visa-pipeline*.e2e-spec.ts` | **PASS** (regression) |
| `visa-notifications.e2e-spec.ts` | **PASS** |
| `visa-desk-mutamers.e2e-spec.ts` | **PASS** |

**36** tests in the combined pattern.

---

## 16. Risks

| Risk | Mitigation |
|------|------------|
| Groups without consulate block EMBASSY | Pass `embassyRef` or set Group.consulate / VisaRequest.embassy |
| SOP flag forgotten off | Desk `sop` meta + banner; default off matches architecture |
| Prompt vs architecture field inventing | Slim fields only; no PassportMovement |

---

## 17. Manual Verification

1. Ops Visa Desk → mutamer → **→ EMBASSY** with ref → see Submitted timestamp.  
2. Continue to ISSUED → **→ PASSPORT_RETURNED** (confirm) → Returned timestamp + notify.  
3. Set `VISA_REQUIRE_PASSPORT_RETURN=true`, restart API → ISSUED cannot jump to COMPLETED.  
4. Agent login → transition / PATCH embassyRef → 403.

---

## 18. Rollback

1. Redeploy prior images.  
2. Optional: `ALTER TABLE "Passenger" DROP COLUMN …` (nullable; safe to leave).  
3. Disable AR-VISA-03 if notify rollback needed.

---

## STOP

**T002-06 (MOFA completeness + MOFA Bill) was not started.**
