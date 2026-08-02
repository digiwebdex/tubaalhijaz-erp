# TRANSFORMATION-001 — Customer & Group Foundation

**Program IDs covered:** BT-02 · BT-03 · BT-04 · intake slice of BT-13  
**Governing SoT:** Master Business Blueprint §§7–8, 18–19, 26 · Business Operation Map Part A (Agent→Group)  
**Date:** 2026-08-01  
**Mode:** Analysis + implementation-task breakdown only — **no code in this phase**

---

## 0. Scope

| In scope | Out of scope (later BTs) |
|----------|---------------------------|
| Customer intake (Mutamer) | Hotel dual-city / WAITING (BT-07) |
| Passport | Transport / voucher (BT-09/10) |
| OCR (passport + Nusuk group-list) | Long Stay host / day-85 (BT-12) |
| Mutamer Excel contract | MOFA bill / pay source (BT-14) |
| Group Number spine | Supplier four-type master (BT-05) — *Umrah Co link may use existing Company until BT-05* |
| Package (`packageType` + PACKAGE gate) | Full Agent Portal parity polish (BT-17) |
| Readiness gates VISA / PACKAGE / PAYMENT / BILL | Website login (BT-01) |
| Material notifications for **intake events only** | Full notification matrix / day-85 (rest of BT-13) |

**Objective:** Staff and Agent can open a unique Group Number (OCR or manual), set package + readiness gates + mandatory WhatsApp, upload Mutamers via Excel contract / passport OCR, and receive intake WhatsApp/in-app alerts — **reusing** Groups, Passengers, OCR, Uploads, Notifications, Agent Portal Groups, Ops Group Master.

---

## 1. Capability Analysis

### 1.1 Customer Intake (Mutamer)

| Dimension | Content |
|-----------|---------|
| **Current Implementation** | `Passenger` under `Group`; Agent Portal Manual Entry + CSV import → `POST /groups/:id/passengers` and `/bulk`; staff can use same APIs; no mutamer login. |
| **Business Requirement** | Mutamer is customer; Agent/Staff only; Excel/list into Group Number; Sub EA + visa/biometric/MOFA/type tracked. |
| **Gap** | Import columns ≠ sample Excel; missing Sub EA, biometric, visa number, MOFA number, mutamer type, age; visa status vocabulary differs (`PENDING/APPROVED/REJECTED` vs `Visa Not Issued` / issued). |
| **Reuse** | `apps/api/src/groups/passengers.*`; `AgentPortalGroups.tsx` import modal; tenancy on `tenantId`. |
| **Extension** | Passenger fields + DTO + CSV/Excel column map + optional status label map. |
| **Screens** | Agent Portal → Group → Passengers; Ops Group detail passengers (if present / extend Ops Group Master). |
| **APIs** | `POST/GET /groups/:groupId/passengers`, `POST …/bulk`, `PATCH/DELETE /passengers/:id`. |
| **Database** | `Passenger` (+ new nullable columns). |
| **Risk** | Medium — bad imports; status mapping confusion. |
| **Acceptance Criteria** | Sample Excel (or mapped CSV) imports into Group; Sub EA + biometric + MOFA/visa no./type stored or explicitly mapped; no mutamer account created; Agent isolation holds. |
| **Rollback** | Disable new columns in UI; prior CreatePassengerDto still works. |
| **Dependencies** | Group spine (1.5) must exist for target Group Number. |

---

### 1.2 Passport

| Dimension | Content |
|-----------|---------|
| **Current Implementation** | Passport on Passenger (`passportNo`, expiry); OCR type `PASSPORT`; approve → auto-create Passenger via `PassengersService.create` when `groupId` provided; duplicate passport index. |
| **Business Requirement** | Passport is identity key; OCR and/or Excel; duplicates flagged. |
| **Gap** | OCR cannot create Group from passport; group-list OCR missing; Excel path doesn’t emphasize passport as Nusuk twin identity beyond number. |
| **Reuse** | `ocr.service` approve passport path; `parsers` passport extract; `Passenger.passportNo` unique index per search. |
| **Extension** | Keep passport→Passenger; tighten duplicate warnings on bulk import; optional link OCR doc to mutamer after Excel. |
| **Screens** | OCR Center; Agent Portal passengers; Manual Entry. |
| **APIs** | `POST /ocr/documents`, `POST /ocr/documents/:id/approve`, passenger APIs. |
| **Database** | `OcrDocument`, `Passenger`. |
| **Risk** | Low–Medium — OCR misreads. |
| **Acceptance Criteria** | Passport OCR approve still creates Passenger in selected Group; bulk import flags duplicate passports in-file and warns on DB collision. |
| **Rollback** | Prior OCR approve behaviour. |
| **Dependencies** | Group exists (1.5). |

---

### 1.3 OCR

| Dimension | Content |
|-----------|---------|
| **Current Implementation** | Async `tuba-ocr`; types include PASSPORT etc.; review queue; approve/reject/reprocess; optional `groupId` on upload; **no** Nusuk group-list type; approve creates Passenger not Group. |
| **Business Requirement** | Upload Nusuk Groups List image → OCR → create/update **Group Number**; then Excel mutamers; passport OCR secondary. |
| **Gap** | Wrong primary object (Passenger vs Group); missing document type / parser / commit-to-Group flow. |
| **Reuse** | Entire `apps/api/src/ocr/*`, queue, OCR Center UI, Uploads/MinIO, review RBAC `REVIEW_OCR_QUEUE`. |
| **Extension** | New doc type e.g. `NUSUK_GROUP_LIST`; parser for group number/name/consulate/pax/agent code; approve commits/updates `Group` (unique Nusuk number); UI mode switch Group List vs Passport. |
| **Screens** | `OCRCenter.tsx`. |
| **APIs** | Existing OCR CRUD + approve; Groups create/update on commit. |
| **Database** | `OcrDocumentType` enum + `Group` Nusuk fields. |
| **Risk** | Medium — OCR accuracy; duplicate Group Numbers. |
| **Acceptance Criteria** | Group-list image can open Group after human approve; duplicate Nusuk number blocked; passport path unchanged. |
| **Rollback** | Feature-flag off group-list type; passport-only. |
| **Dependencies** | Group Nusuk field uniqueness (1.5) before commit. |

---

### 1.4 Mutamer Excel

| Dimension | Content |
|-----------|---------|
| **Current Implementation** | Frontend CSV parser in `AgentPortalGroups.tsx`; template columns Name/Passport/Nationality/Gender/DOB/Expiry/Phone; commits JSON bulk. **No server-side xlsx.** |
| **Business Requirement** | Official sample sheet columns: Mutamer name, Age, Passport, Nationality, Main EA Code/Name, Sub EA Code/Name, Visa Status, Biometric status, Visa Number, MOFA Number, Mutamer Type. |
| **Gap** | Column contract mismatch; age/EA/biometric/MOFA/type absent; `.xlsx` not parsed (CSV workaround only); status strings not aligned. |
| **Reuse** | Bulk API + import modal architecture (parse→map→validate→commit). |
| **Extension** | Expand `CreatePassengerDto` / bulk; remapped template + autoMap; optional server CSV accept; document xlsx→CSV until safe parser added (architecture: avoid abandoned xlsx libs). |
| **Screens** | Agent Portal import modal; staff equivalent if Ops exposes same. |
| **APIs** | `POST /groups/:groupId/passengers/bulk` (extended body). |
| **Database** | Extended `Passenger`. |
| **Risk** | Medium — agents upload old template. |
| **Acceptance Criteria** | New template downloads; sample business columns map; import succeeds for 20-row sample shape; old 7-column template still importable (backward compatible). |
| **Rollback** | Revert template/mapping; ignore unknown fields. |
| **Dependencies** | 1.1 Passenger extensions; 1.5 Group. |

---

### 1.5 Group

| Dimension | Content |
|-----------|---------|
| **Current Implementation** | `Group` with internal unique `code` (e.g. GRP-…); `visaType` UMRAH\|LONG_STAY; `packageType`; dates; `tenantId` agent; create via `POST /groups`; Ops `GET /ops/groups`; Agent Portal create wizard. |
| **Business Requirement** | Unique **Nusuk Group Number** spine; shared Staff/Agent; visa type includes Hajj; Haji/reference WhatsApp mandatory; Umrah Co; consulate; uploaded by; services value; no duplicates. |
| **Gap** | No `nusukGroupNumber`; no haji WhatsApp; no Umrah Co FK; no consulate/servicesValue/uploadedBy; HAJJ missing from enum; `code` ≠ Nusuk number. |
| **Reuse** | `groups.module/service/controller/dto`; Ops groups list; Agent Portal group create; Season; Company tenant. |
| **Extension** | Nullable→unique Nusuk field; WhatsApp; umrahCompanyId (Company); consulate; uploadedByLabel/userId; HAJJ in VisaType; Group Master columns. |
| **Screens** | Agent Portal Groups; Ops Group Master (`OpsControl` / ops groups). |
| **APIs** | `POST/PATCH/GET /groups`, `GET /ops/groups`. |
| **Database** | `Group`, `VisaType` enum. |
| **Risk** | Medium — uniqueness migration; existing groups without Nusuk number. |
| **Acceptance Criteria** | Nusuk number unique when set; Staff & Agent see same group; WhatsApp required for Hajj/Umrah create/update; HAJJ selectable; existing groups without Nusuk still load (backward compatible). |
| **Rollback** | Stop requiring new fields; drop unique temporarily if needed via reverse migration. |
| **Dependencies** | None inside T-001 (foundation). |

---

### 1.6 Package

| Dimension | Content |
|-----------|---------|
| **Current Implementation** | `Group.packageType` ECONOMY\|STANDARD\|PREMIUM on create/update DTOs; shown in portal. |
| **Business Requirement** | Package locked for ops; **PACKAGE** readiness gate when package confirmed. |
| **Gap** | No PACKAGE boolean gate; packageType alone ≠ “package locked” signal. |
| **Reuse** | `packageType` field and DTOs. |
| **Extension** | `gatePackage` (bool) on Group; UI toggle; notify on flip (intake notification slice). |
| **Screens** | Group create/edit; Group Master board. |
| **APIs** | `PATCH /groups/:id` readiness/package. |
| **Database** | `Group.packageType` + `gatePackage`. |
| **Risk** | Low. |
| **Acceptance Criteria** | packageType still works; PACKAGE gate toggleable; visible on board; material notify optional. |
| **Rollback** | Ignore gate field in UI. |
| **Dependencies** | 1.5 Group; 1.7 Gates. |

---

### 1.7 Readiness Gates

| Dimension | Content |
|-----------|---------|
| **Current Implementation** | `Group.status` / `opsStatus` / `currentStage` WorkflowStage — **not** VISA/PACKAGE/PAYMENT/BILL checkboxes. |
| **Business Requirement** | Four independent gates on Group Details board. |
| **Gap** | Entire gate model missing. |
| **Reuse** | Group update API path; board UIs; do **not** delete WorkflowStage (demote in UI). |
| **Extension** | `gateVisa`, `gatePackage`, `gatePayment`, `gateBill` booleans; PATCH endpoint or fields on UpdateGroupDto; board columns; audit who flipped (reuse AuditLog if available or updatedBy). |
| **Screens** | Ops Group Master; Agent Group detail. |
| **APIs** | `PATCH /groups/:id`. |
| **Database** | Four booleans on `Group` (default false). |
| **Risk** | Low–Medium — parallel stage confusion (mitigate: gates are business-visible; stage secondary). |
| **Acceptance Criteria** | All four gates toggle; persist; Staff+Agent (scoped) see them; flipping emits intake notification event. |
| **Rollback** | Hide columns; defaults false. |
| **Dependencies** | 1.5; notifications task for events. |

---

### 1.8 Notifications (intake slice)

| Dimension | Content |
|-----------|---------|
| **Current Implementation** | Channels WA/Email/In-App; events include `group.created`, `passenger.ocr.completed`, `group.import.completed`; AutomationRules; seed NotificationEvents; WS JWT. |
| **Business Requirement** | Material intake updates → Agent + Admin WhatsApp (group open, mutamer import, gate flips, OCR commit). |
| **Gap** | Gate-flip events absent; import.completed may be under-fired; not wired as “intake pack”; WA may be stub if creds blank (ops constraint). |
| **Reuse** | `notifications/*`, `automation/events.ts`, `tuba-notify`, templates shared. |
| **Extension** | Events: `group.gates.changed`, ensure emit on bulk import & OCR group commit; rules/templates for Agent+Admin; do **not** implement day-85 here. |
| **Screens** | Automation notifications admin; bell. |
| **APIs** | Existing dispatch; event emits from Groups/OCR/Passengers services. |
| **Database** | `NotificationEvent` / `MessageTemplate` / `NotificationLog` rows. |
| **Risk** | Low–Medium — spam if too chatty; mitigate material-only. |
| **Acceptance Criteria** | Creating group, approving group-list OCR, bulk mutamer import, and gate flip each can produce notification log (+ WA when configured); Agent tenant + staff recipients resolvable. |
| **Rollback** | Disable new rules; stop emitting new event keys. |
| **Dependencies** | 1.5–1.7 emitters exist. |

---

## 2. Gap Summary Matrix

| Capability | Fit today | Primary action |
|------------|-----------|----------------|
| Customer intake | Partial | EXTEND Passenger + import |
| Passport | Partial (strong OCR passenger) | KEEP + tighten |
| OCR group-list | Missing / wrong object | EXTEND OCR + Group commit |
| Mutamer Excel | Partial (wrong columns) | EXTEND map + fields |
| Group spine | Partial | EXTEND Nusuk + WA + HAJJ |
| Package | Partial | EXTEND PACKAGE gate |
| Readiness gates | Missing | EXTEND four booleans |
| Intake notifications | Partial | EXTEND events/rules |

---

## 3. Modules Touched (exact)

| Layer | Paths |
|-------|--------|
| Prisma | `apps/api/prisma/schema.prisma` (`Group`, `Passenger`, `OcrDocumentType`, `VisaType`) + migration |
| Groups API | `apps/api/src/groups/groups.dto.ts`, `groups.service.ts`, `groups.controller.ts` |
| Passengers API | `apps/api/src/groups/passengers.dto.ts`, `passengers.service.ts`, `passengers.controller.ts` |
| OCR API | `apps/api/src/ocr/ocr.dto.ts`, `ocr.service.ts`, `ocr.controller.ts`, `parsers.ts`, `gemini.client.ts` (prompts), `ocr.constants` if any |
| Events | `apps/api/src/automation/events.ts`; emit sites in groups/passengers/ocr services |
| Notifications | `apps/api/src/notifications/*`; `packages/shared/src/notifications.ts`; seed event/template rows if needed |
| Web Agent | `apps/web/src/app/pages/AgentPortalGroups.tsx` |
| Web OCR | `apps/web/src/app/pages/OCRCenter.tsx` |
| Web Ops | `apps/web/src/app/pages/OpsControl.tsx` (Group Master columns) and/or Ops Departments group views as applicable |
| Shared types | `@tuba/shared` only if notification catalog keys added |

**Do not rewrite:** Auth, wallet, finance GL, supplier portal, fleet, transport booking engine.

---

## 4. Implementation Tasks (independently deployable)

Each task: **backward compatible**, **reuses architecture**, **own acceptance + rollback**.  
Deploy order recommended; later tasks may land before earlier ones only if noted.

---

### T001-01 — Group Nusuk identity & HAJJ (DB + API)

| | |
|--|--|
| **Maps to** | Capability 1.5 |
| **Modify** | `schema.prisma` Group + VisaType; `groups.dto.ts`; `groups.service.ts` |
| **Reuse** | Existing `POST/PATCH /groups`, unique `code` unchanged |
| **Change** | Add nullable `nusukGroupNumber` (unique when not null), `hajiWhatsapp`, `consulate`, `servicesValue`, `uploadedByUserId` / label; add `HAJJ` to VisaType; validation: WhatsApp required when visaType ∈ {HAJJ, UMRAH} on create/update when flag enabled |
| **Backward compatible** | Existing groups without Nusuk keep working; internal `code` still generated |
| **Acceptance** | API accepts/returns new fields; unique violation on duplicate Nusuk; HAJJ allowed; old clients omitting fields still create groups |
| **Rollback** | Reverse migration / stop writing new fields |
| **Depends on** | — |

---

### T001-02 — Readiness gates + PACKAGE gate (DB + API)

| | |
|--|--|
| **Maps to** | 1.6, 1.7 |
| **Modify** | `schema.prisma` Group; `groups.dto.ts`; `groups.service.ts` |
| **Reuse** | `PATCH /groups/:id` |
| **Change** | Booleans `gateVisa`, `gatePackage`, `gatePayment`, `gateBill` default false; include in update DTO; optional emit `group.gates.changed` stub (no-op if notify not ready) |
| **Backward compatible** | Defaults false; unread by old UI |
| **Acceptance** | PATCH toggles persist; GET returns gates; packageType still independent |
| **Rollback** | Hide fields; defaults |
| **Depends on** | T001-01 recommended (same Group model wave OK if single migration) |

---

### T001-03 — Group Master / Agent Group UI for spine + gates

| | |
|--|--|
| **Maps to** | 1.5–1.7 |
| **Modify** | `AgentPortalGroups.tsx`; Ops Group Master in `OpsControl.tsx` (and list mappers) |
| **Reuse** | Existing group list/detail/create flows |
| **Change** | Show Nusuk number, WhatsApp, visa type incl. Hajj, packageType, four gates; create form collects WhatsApp for Hajj/Umrah |
| **Backward compatible** | Groups missing Nusuk display “—”; gates default unchecked |
| **Acceptance** | Staff/Agent can set spine fields + gates in UI; shared data visible per tenancy |
| **Rollback** | Prior web build |
| **Depends on** | T001-01, T001-02 |

---

### T001-04 — Passenger Mutamer field extensions (DB + API)

| | |
|--|--|
| **Maps to** | 1.1, 1.2 |
| **Modify** | `schema.prisma` Passenger; `passengers.dto.ts`; `passengers.service.ts` |
| **Reuse** | CRUD + bulk endpoints |
| **Change** | Nullable: `age`, `mainEaCode`, `mainEaName`, `subEaCode`, `subEaName`, `biometricStatus`, `visaNumber`, `mofaNumber`, `mutamerType`; optional string `visaStatusLabel` **or** map business labels ↔ enum on write; keep existing `visaStatus` enum for compatibility |
| **Backward compatible** | Old bulk payloads without new keys succeed |
| **Acceptance** | PATCH/POST persist new fields; list returns them; passport duplicate warning behaviour retained |
| **Rollback** | Stop exposing fields |
| **Depends on** | — (can parallel T001-01) |

---

### T001-05 — Mutamer Excel/CSV contract (Web + API validation)

| | |
|--|--|
| **Maps to** | 1.4 |
| **Modify** | `AgentPortalGroups.tsx` (IMPORT_FIELDS, autoMap, GUIDE_COLS, commit payload); optionally thin validation in `passengers.service` bulk |
| **Reuse** | parseCsv → map → validate → `POST …/bulk` |
| **Change** | Template matches business columns; map Mutamer name→name, Age→age, Passport→passportNo, etc.; keep legacy 7-column autoMap |
| **Backward compatible** | Old template still imports |
| **Acceptance** | Business sample columns import; legacy template imports; downloadable new template |
| **Rollback** | Prior AgentPortalGroups bundle |
| **Depends on** | T001-04 |

---

### T001-06 — Passport OCR path hardening (keep + minor)

| | |
|--|--|
| **Maps to** | 1.2, 1.3 (passport) |
| **Modify** | `ocr.service.ts` approve messaging only if needed; OCR Center copy clarifying “Passport → Mutamer (requires Group)” |
| **Reuse** | Full passport approve → Passenger create |
| **Change** | UX clarity; ensure group picker required; no behaviour break |
| **Backward compatible** | Yes |
| **Acceptance** | Approve passport with groupId still creates Passenger; without groupId clear error |
| **Rollback** | Prior OCR Center |
| **Depends on** | T001-04 optional |

---

### T001-07 — OCR Nusuk Group-List type + parser + approve→Group

| | |
|--|--|
| **Maps to** | 1.3 |
| **Modify** | `schema.prisma` OcrDocumentType; `ocr.dto.ts`; `parsers.ts`; `gemini.client.ts` prompt branch; `ocr.service.ts` approve branch; OCR Center mode |
| **Reuse** | Queue, review, reprocess, RBAC, file storage |
| **Change** | Type `NUSUK_GROUP_LIST`; extract group number/name/consulate/pax/agent code/dates; on approve create/update Group via GroupsService using Nusuk uniqueness; link ocr.groupId |
| **Backward compatible** | Other document types unchanged; feature flag recommended |
| **Acceptance** | Flag on: image → review → approve opens Group with Nusuk number; duplicate blocked; flag off: type rejected/hidden |
| **Rollback** | Flag off / remove type from UI |
| **Depends on** | T001-01 |

---

### T001-08 — Intake notification events + rules

| | |
|--|--|
| **Maps to** | 1.8 |
| **Modify** | `automation/events.ts`; emit in `groups.service` (create, gate patch), `passengers.service` (bulk), `ocr.service` (group-list approve); `packages/shared/src/notifications.ts`; seed/templates; Automation rule defaults |
| **Reuse** | `NotificationsService.dispatch`, `tuba-notify`, WA/Email/In-App |
| **Change** | Ensure events for: group created, group-list OCR committed, mutamer bulk imported, gates changed; recipients Agent (tenant) + Admin staff policy |
| **Backward compatible** | Existing events remain; new keys additive |
| **Acceptance** | Each action writes NotificationLog when rules enabled; WA when creds present else skip-safe |
| **Rollback** | Disable rules; remove emits |
| **Depends on** | T001-01–02, T001-05, T001-07 (for full pack); can ship partial emits earlier |

---

### T001-09 — Ops Group Master board columns (Staff)

| | |
|--|--|
| **Maps to** | 1.5–1.7 Operation Map “Group Master” |
| **Modify** | `OpsControl.tsx` group table / detail (and API mappers if `/ops/groups` DTO projection needed in `ops` module) |
| **Reuse** | `GET /ops/groups` |
| **Change** | Columns: Nusuk Group Number, name, pax, visa type, package, four gates, WhatsApp, uploaded by, agent |
| **Backward compatible** | Old columns remain or coexist |
| **Acceptance** | Staff sees Excel-like readiness; can toggle gates |
| **Rollback** | Prior OpsControl |
| **Depends on** | T001-01, T001-02, T001-03 |

---

### T001-10 — Foundation verification pack (non-prod gate)

| | |
|--|--|
| **Maps to** | Whole TRANSFORM-001 |
| **Modify** | None required in prod code — run e2e/smoke scenarios (may add tests in deploy pipeline later; **this task is validation definition**) |
| **Reuse** | Existing groups/ocr/notify e2e harness patterns |
| **Change** | Documented scenario set: create group+WA+HAJJ; set gates; CSV business template; passport OCR; group-list OCR flag; notify logs |
| **Acceptance** | All scenarios pass on staging/prod-smoke |
| **Rollback** | N/A |
| **Depends on** | T001-01…09 as deployed |

---

## 5. Suggested Deploy Sequence

```
T001-01 ─┬─► T001-02 ─► T001-03 ─► T001-09
         │
         └─► T001-04 ─► T001-05 ─► T001-06
                              │
T001-01 ─────────────────────► T001-07 ─► T001-08 ─► T001-10
```

- **Parallel OK:** T001-01 ∥ T001-04  
- **Single-migration option:** T001-01 + T001-02 + T001-04 in one DB deploy if release process prefers one schema bump — still keep UI tasks separate.

---

## 6. Cross-Cutting Rules for All T001 Tasks

1. **No architecture rewrite** — Nest modules, Prisma, BullMQ OCR/notify stay.  
2. **Nullable / defaulted fields** — old rows and old clients keep working.  
3. **Internal `Group.code` preserved** — Nusuk number is additive spine for business.  
4. **Mutamer never gets login.**  
5. **Agent tenancy fail-closed** unchanged.  
6. **Feature flag** for group-list OCR (T001-07) mandatory for production safety.  
7. **Do not implement** hotel/transport/Long Stay day-85/MOFA bill inside T-001.  
8. **Umrah Co:** store as optional `umrahCompanyId` → `Company` if present; full supplier-kind taxonomy waits BT-05 — do not block T-001.

---

## 7. Transformation-001 Rollup

| | |
|--|--|
| **Business value** | Excel Group Details + Mutamer sample + Nusuk OCR intake become ERP foundation |
| **Reuse % (rollup)** | ~70% |
| **Complexity** | M–L (OCR group-list is the L piece) |
| **Risk** | Medium overall; High only if OCR group commit skips human review |
| **Program alignment** | Completes BT-02, BT-03, BT-04; starts BT-13 intake events |
| **Exit criterion** | Operation Map checklist items for Group Number, Mutamer Excel, OCR group open, PACKAGE/VISA gates (PAYMENT/BILL toggles exist even if finance later), intake WhatsApp/logs — all demonstrable without spreadsheet as SoT for intake |

### Rollup Acceptance Criteria

1. Unique Nusuk Group Number when set; Staff and Agent share the group.  
2. Hajj/Umrah/Long Stay selectable; Haji WhatsApp required for Hajj/Umrah.  
3. Four readiness gates persist and show on Staff + Agent group views.  
4. Business mutamer columns import via updated template; legacy CSV still works.  
5. Passport OCR → Passenger in group still works.  
6. Nusuk group-list OCR → Group commit works behind flag with human approve.  
7. Intake material events produce notification logs (WA when configured).  
8. No mutamer portal; no break to unrelated finance/transport modules.

### Rollup Rollback

Revert web+api images to pre-T001; feature-flag off OCR group-list; gates/Nusuk columns ignored; passenger extra columns unused.

---

## 8. Explicit Non-Goals

- Tickets in Jira/GitLab  
- Coding in this document phase  
- Hotel/BRN/Transport/Voucher/MOFA/HR  
- Website Admin tab hiding (BT-01)  
- Day-85 Long Stay  

---

*End of TRANSFORMATION_001_CUSTOMER_GROUP_FOUNDATION.md*
