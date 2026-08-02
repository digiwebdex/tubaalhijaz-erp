# T002-01 Completion — Visa Master & Umrah Co linkage

**Task:** T002-01 (TRANSFORM-002)  
**Date:** 2026-08-01  
**Status:** Complete — stopped before T002-02

---

## Exact scope

Quoted from `analysis/TRANSFORM_002_ARCHITECTURE.md` §17:

> **T002-01** Visa Master & Umrah Co | HAJJ API parity; `umrahCompanyId`; DTO/schema alignment

Discovery intent (`analysis/TRANSFORM_002_DISCOVERY.md` §18):

> HAJJ parity on visa APIs; Umrah Co on Group/VisaRequest; remove DTO/schema drift → BT-06

**Implemented in this pack only.** No Mutamer Visa Desk board (T002-02), no pipeline state machine (T002-03), no MOFA/Embassy processing workflows, no day-85, no approval notification wiring.

---

## Reuse declaration

| Asset | Reuse |
|-------|--------|
| Passenger | Unchanged — Mutamer SoT remains for later T002 tasks |
| VisaRequest | Extended (batch envelope) — HAJJ + embassy + `umrahCompanyId` |
| Groups | Extended — optional `umrahCompanyId` |
| Services | Extended — create DTO/API + Umrah Co catalogue |
| Existing Visa Desk / Ops Group Master | Reused screens; foundation fields only |
| Audit | Reused `AuditLog` CREATE/UPDATE |
| Notifications | Not wired (deferred to T002-04) |
| RBAC | Unchanged permission keys; tenancy via scoped Prisma |

---

## Business workflow

1. Agent/staff creates or updates a **Group** and may assign a verified **Umrah Company**.
2. Agent submits a **VisaRequest** batch for that group with visa type **UMRAH | HAJJ | LONG_STAY**.
3. Embassy may be set on the request; if omitted, **Group.consulate** is used.
4. Umrah Co on the request may be set; if omitted, **Group.umrahCompanyId** is inherited.
5. Ops Group Master foundation editor can set/clear Umrah Co on the group (same PATCH `/groups/:id`).

This is configuration/master data only — no biometric chase, no MOFA bill, no embassy custody processing.

---

## Business impact

- HAJJ groups can now open HAJJ visa batches (API parity with Group.visaType).
- Visa Desk can see which Saudi Umrah Company owns processing for a group/batch.
- Schema/DTO drift removed for `embassy` and HAJJ on `POST /services/visa`.
- Foundation for later Mutamer desk / pipeline work without redesigning Visa.

---

## Files changed

| Path | Change |
|------|--------|
| `apps/api/prisma/schema.prisma` | `SupplierType.UMRAH_COMPANY`; `Group.umrahCompanyId`; `VisaRequest.umrahCompanyId` |
| `apps/api/prisma/migrations/20260801100000_visa_master_umrah_co/` | Additive migration |
| `apps/api/prisma/seed.ts` | Seed Umrah Co + link demo groups/visa rows |
| `apps/api/src/groups/groups.dto.ts` | `umrahCompanyId` on create/update |
| `apps/api/src/groups/groups.service.ts` | Validate + persist + audit + include |
| `apps/api/src/groups/groups.controller.ts` | Include `umrahCompany` on list/get |
| `apps/api/src/services/dto.ts` | HAJJ + `embassy` + `umrahCompanyId` |
| `apps/api/src/services/services.service.ts` | Catalogue; createVisa alignment; list include |
| `apps/api/src/services/services.controller.ts` | `GET /services/umrah-companies` |
| `apps/api/src/ops/ops.service.ts` | Group Master projection includes Umrah Co |
| `apps/api/test/visa-master-umrah-co.e2e-spec.ts` | E2E coverage |
| `apps/web/src/app/lib/group-foundation.ts` | Payload support for `umrahCompanyId` |
| `apps/web/src/app/lib/group-foundation.selftest.ts` | Umrah Co payload asserts |
| `apps/web/src/app/pages/AgentPortalServices.tsx` | HAJJ + embassy + Umrah Co picker |
| `apps/web/src/app/pages/AgentPortalGroups.tsx` | Umrah Co on create/edit foundation |
| `apps/web/src/app/pages/OpsControl.tsx` | Umrah Co on Group Foundation modal |
| `docs/T002_01_COMPLETION.md` | This note |

---

## DB / API / UI changes

### DB

- `SupplierType` += `UMRAH_COMPANY`
- `Group.umrahCompanyId` → `Company` (nullable, indexed)
- `VisaRequest.umrahCompanyId` → `Company` (nullable, indexed)

### API

- `POST /groups`, `PATCH /groups/:id` — optional `umrahCompanyId` (must be verified `UMRAH_COMPANY` supplier; `null` clears)
- `GET /groups`, `GET /groups/:id` — return `umrahCompany`
- `GET /services/umrah-companies` — verified Umrah Co catalogue (auth required)
- `POST /services/visa` — `visaType` ∈ `UMRAH|LONG_STAY|HAJJ`; optional `embassy`, `umrahCompanyId`; inherit from Group when omitted
- `GET /ops/groups` — additive `umrahCompanyId` / `umrahCompany`

### UI

- Agent Visa screen: HAJJ option, embassy, Umrah Co select
- Agent Group wizard + foundation panel: Umrah Co select
- Ops Group Master foundation modal: Umrah Co select

---

## RBAC

No new permission keys.  
Agents create/update own tenant groups and visa batches (existing tenancy).  
Staff use existing Ops / Groups access.  
`GET /services/umrah-companies` is available to any authenticated caller (same pattern as `GET /hotels`).

---

## Audit

- Group CREATE/UPDATE audit `after` includes `umrahCompanyId`.
- VisaRequest CREATE audit includes `visaType`, `embassy`, `umrahCompanyId`.

---

## Tests

| Suite | Result |
|-------|--------|
| `apps/api/test/visa-master-umrah-co.e2e-spec.ts` (7 cases) | **PASS** on e2e Postgres |

Coverage: catalogue filter, Group link + audit, reject hotel as Umrah Co, HAJJ+embassy create, inherit from Group, clear with null, Ops projection field present.

---

## Risks

| Risk | Level | Mitigation |
|------|-------|------------|
| Assigning wrong Company as Umrah Co | Low | Server validates `SUPPLIER` + `UMRAH_COMPANY` + `VERIFIED` |
| Prod image rebuild required after migration | Med | Migration applied; API/web images rebuilt & recreated |
| Demo login credentials differ on live | Low | E2E uses seeded Demo@123; live auth unchanged by this task |
| Enum value `UMRAH_COMPANY` hard to remove in Postgres | Low | Additive; leave in place on rollback |

---

## Manual verification

1. `GET /services/umrah-companies` (agent JWT) → list includes Al-Haramain / `SUP-UMR-*`.
2. `POST /groups` with `umrahCompanyId` → 201 + `umrahCompany` nested.
3. `POST /groups` with hotel supplier id → 400.
4. `POST /services/visa` with `visaType:"HAJJ"` → 201.
5. Omit `embassy` / `umrahCompanyId` when Group has consulate + Umrah Co → inherited on VisaRequest.
6. Agent Portal → Services → Visa: HAJJ + Umrah Co + Embassy controls visible.
7. Ops Group Master → foundation modal: Umrah Company select saves via PATCH.

Live probe after deploy: `GET /services/umrah-companies` → **401** (route present; auth required). Health **200**.

---

## Rollback

1. Redeploy prior `tuba-alhijaz-api` / `tuba-alhijaz-web` image tags.
2. Optional reverse migration: drop FKs/indexes/columns `umrahCompanyId` on `Group` and `VisaRequest`.
3. Leave `SupplierType.UMRAH_COMPANY` enum value in place (Postgres cannot easily drop enum values).
4. Clients omitting new fields remain compatible (all additive / optional).

---

## STOP

**T002-02 (Mutamer Visa Desk Board) was not started.**
