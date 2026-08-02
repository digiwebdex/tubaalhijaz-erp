# T002-07 Completion — Long Stay Host Register

**Task:** T002-07 (TRANSFORM-002)  
**Date:** 2026-08-01  
**Status:** Complete — stopped before T002-08

---

## Architecture overrides prompt

The prompt titled this “Long Stay Operations” generically.  
Architecture §17 defines:

> **T002-07** Long Stay Host Register | Host/Iqama/WhatsApp/Absher

**Contract followed = architecture.**  
Day-85 / red cards / cron are **T002-08** and were not implemented.  
No separate Long Stay ERP module — EXTEND existing `LongStay` + `/ops/long-stays` + Visa Desk projection.

---

## 1. Exact Scope

Quoted from `analysis/TRANSFORM_002_ARCHITECTURE.md` §17:

> **T002-07** Long Stay Host Register | Host/Iqama/WhatsApp/Absher

Supporting: §2.2 (Host WhatsApp mandatory), §8 (`LongStay` hostName/iqama/whatsapp/relation/absher/entry/exit), §6 UI Ops Long Stay extend, flag `REQUIRE_LONGSTAY_HOST_WHATSAPP`.

---

## 2. Architecture Contract

| Item | Implementation |
|------|----------------|
| Host register | `LongStay.hostName`, `hostIqama`, `hostWhatsapp`, `hostRelation` |
| Absher | `LongStay.absher` (staff note; no gov API) |
| Entry/exit | `LongStay.entryDate`, `exitDate` |
| WhatsApp mandatory | Flag `REQUIRE_LONGSTAY_HOST_WHATSAPP` (default **on**) |
| Host ≠ User | No login / User FK |
| Day-85 | Deferred to T002-08 |

---

## 3. Reuse Declaration

| Category | Items |
|----------|--------|
| **Reused** | `LongStay`, `/ops/long-stays`, Group.visaType, Visa Desk, AuditLog, Ops gateway, RBAC (`VIEW_DASHBOARD`) |
| **Extended** | LongStay schema; create/update DTOs; OpsControl Long Stay UI; mutamer desk `longStayHost` |
| **New modules** | None |
| **Untouched** | Day-85 cron/notify, Reports, Finance, Embassy/Passport, MOFA Bill |

---

## 4. Business Workflow

1. Group `visaType = LONG_STAY`.  
2. Ops creates/uses `LongStay` occupancy row.  
3. Staff **Register Host** (name + WhatsApp required; Iqama/relation/Absher/entry optional).  
4. Visa Desk LONG_STAY mutamers show host completeness.  
5. Pipeline continues unchanged. Day-85 later (T002-08).

---

## 5. Business Scenario Validation

| Scenario | Result |
|----------|--------|
| 1 Group marked Long Stay + LS created | **PASS** |
| 2 Host info saved | **PASS** |
| 3 Missing hostName/WhatsApp rejected | **PASS** |
| 4 Agent → 403 | **PASS** |
| 5 Audit written | **PASS** |

---

## 6. Business Impact

- Host identity captured for Long Stay groups without a second app.  
- WhatsApp gate ready for Day-85 multi-party notify (T002-08).  
- Agents cannot mutate host register.

---

## 7. Files Changed

| Path | Change |
|------|--------|
| `apps/api/prisma/schema.prisma` | Host fields on `LongStay` |
| `apps/api/prisma/migrations/20260801160000_longstay_host_register/` | Migration |
| `apps/api/src/ops/ops.service.ts` | Host validation, shape, desk projection |
| `apps/api/src/ops/ops.controller.ts` | DTO host fields |
| `apps/web/.../OpsControl.tsx` | Host register drawer |
| `apps/web/.../OpsDepartments.tsx` | LONG_STAY host rows in drawer |
| `apps/api/.env.example` | Flag docs |
| `apps/api/test/longstay-host.e2e-spec.ts` | Scenarios |
| `docs/T002_07_COMPLETION.md` | This note |

---

## 8. Database Changes

Nullable on `LongStay`: `hostName`, `hostIqama`, `hostWhatsapp`, `hostRelation`, `absher`, `entryDate`, `exitDate`.

---

## 9. Migration

`20260801160000_longstay_host_register` — applied to e2e + live.

---

## 10. API Changes

- `POST/PATCH /ops/long-stays` — host fields + `registerHost`  
- Responses include `hostComplete`, `sop.requireHostWhatsapp`  
- `GET /ops/visa/mutamers` — `longStayHost` summary when present  

No parallel Long Stay API.

---

## 11. UI Changes

- Ops Control → Long Stay: Host / Host OK columns + Register Host drawer  
- Visa Desk drawer: host summary for `LONG_STAY` groups  

---

## 12. RBAC Changes

None new. Ops `@RequirePermissions("VIEW_DASHBOARD")`; service also rejects `companyId` callers.

---

## 13. Audit Changes

CREATE/UPDATE on `LongStay` include host fields + `hostComplete`.

---

## 14. Event Changes

Existing Ops gateway `longstay.changed` broadcast retained. No Day-85 notify (T002-08).

---

## 15. Tests Executed

| Suite | Result |
|-------|--------|
| `longstay-host.e2e-spec.ts` | **5 PASS** |
| `ops.e2e-spec.ts` | **PASS** (regression) |
| `visa-desk-mutamers.e2e-spec.ts` | **PASS** |

---

## 16. Risks

| Risk | Mitigation |
|------|------------|
| Host register on UMRAH groups | Reject unless `visaType=LONG_STAY` |
| WhatsApp flag confusion | Default on; documented in `.env.example` |
| Day-85 expectations | Explicit UI/doc deferral to T002-08 |

---

## 17. Manual Verification

1. Set group visa type **LONG_STAY**.  
2. Ops Control → Long Stay → Register Host (name + WA).  
3. Visa Desk filter LONG_STAY → drawer shows host complete.  
4. Clear WA / empty name → 400.  
5. Agent → 403.

---

## 18. Rollback

1. Redeploy prior images.  
2. Optional drop host columns.  
3. Occupancy LongStay rows remain valid.

---

## STOP

**T002-08 (Day-85 Compliance Pack) was not started.**
