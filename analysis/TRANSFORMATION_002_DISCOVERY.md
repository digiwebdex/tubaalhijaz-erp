# TRANSFORM-002 Discovery — Visa & Saudi Operations

**Document type:** Business discovery + ERP cross-match (Phase 1)  
**Domain:** Visa Desk · Saudi MOFA · Biometric · Embassy · Passport · Long Stay · Visa reports / dashboards / notifications  
**Date:** 2026-08-01  
**Status:** Discovery only — **no code, no migrations, no implementation**  
**Prerequisite:** TRANSFORM-001 (Customer Group Foundation) complete  

**Authority (read for this discovery):**

1. `blueprint/TUBA_MASTER_BUSINESS_BLUEPRINT.md` (§9 Long Stay, §10 Visa Lifecycle, desks, notifications, reports)  
2. `business/TUBA_BUSINESS_OPERATION_MAP.md` (§7 Visa, C2 Visa Desk, Long Stay strip, notify matrix)  
3. `analysis/BUSINESS_DISCOVERY.md`  
4. `analysis/BUSINESS_TRANSFORMATION_ARCHITECTURE.md`  
5. `analysis/BUSINESS_CROSS_MATCH.md` (pre-T001 baseline; re-evaluated below against **current** ERP)  
6. `transformation/TUBA_TRANSFORMATION_PROGRAM.md` (BT-06 / BT-12 / BT-14 pointers)  
7. TRANSFORM-001 release pack `docs/releases/TRANSFORM_001/*` (what intake already delivered)

**Source note — Word / Excel originals:** Binary Word/Excel workflow files are **not present in this repository**. Their content was previously extracted into `BUSINESS_DISCOVERY.md` / Blueprint / Operation Map during TRANSFORM-001 discovery (e.g. Mutamer Excel columns, LONG STAY DETAILS, BILL SHEET / MOFA Processing Account, Nusuk Group Details). This document treats those extracted dictionaries as the business source of truth for Excel/Word practice.

**Explicit ignore (out of this discovery):** Hotel booking engine, Transport, Voucher, HR, CRM, full executive report suite, GL redesign — except where MOFA bill / Long Stay compliance **touch** finance or dashboards as visa-adjacent.

---

## 1. Executive Summary

TRANSFORM-001 made **intake** real: Group Number (Nusuk + HAJJ), readiness gates (including `gateVisa`), Mutamer Excel fields (biometric / visa status / visa no. / MOFA no.), passport OCR → Mutamer, flagged Nusuk Group-List OCR, and intake notifications.

TRANSFORM-002 must make **Visa & Saudi Operations** real: the Visa Desk’s daily chase of biometric → visa issue → Visa/MOFA numbers via **Umrah Companies**, material visa notifications, embassy/passport handling where business requires it, **Long Stay host + day-85 compliance**, visa backlog dashboards/reports, and (visa-adjacent) **MOFA Processing Account** billing semantics.

| Metric | Estimate (T002 scope) |
|--------|------------------------|
| **Reuse** | **~50%** |
| **Extension** | **~35%** |
| **New build** | **~15%** |

**Verdict:** Do **not** rebuild portals, OCR queues, Groups, Passengers, or notify channels. Extend **VisaRequest + Visa Desk**, **Passenger visa fields into a desk board**, **LongStay + day-85 automation**, **Umrah Co supplier identity**, wire **VISA_*** notifications, and extend finance only for **MOFA bill kind** (not a full finance transformation).

---

## 2. Business Workflow

### 2.1 End-to-end Visa & Saudi chain (as written in business docs)

```
Agent / Staff open Group (Nusuk) + Visa type (Hajj | Umrah | Long Stay)
        + Haji/reference WhatsApp (Hajj/Umrah) or Host WhatsApp (Long Stay)
        + Umrah Company assigned
        ↓
Mutamer register (Excel / OCR) with passport identity
        ↓
Visa Desk + Umrah Co processing
        Biometric status (e.g. Registered)
        → Visa status (e.g. Visa Not Issued → Issued / Rejected)
        → Visa Number + MOFA Number when available
        ↓
[Long Stay branch] Host/Service Holder (Iqama, relation, Absher)
        → ~90-day stay tracking
        → Day-85 compliance pack (Host + Agent + Tuba WA/Email + red cards)
        ↓
Flip group readiness gate VISA when visa work acceptably complete
        ↓
MOFA Processing Account bill (Qty × Rate) — separate from cash hotel/transport
        → Approval Sign + CR Date (Finance)
        ↓
Material notifications to Agent + Tuba Admin (visa changes)
        + Visa/biometric backlog dashboards & mutamer visa/MOFA reports
```

### 2.2 Visa Lifecycle (Blueprint §10 — verbatim intent)

| Step | Business meaning |
|------|------------------|
| Trigger | Group exists with visa type Hajj/Umrah/Long Stay; Umrah Co selected |
| Inputs | Visa type; Umrah Co; mutamer biometric/visa/MOFA fields; Nusuk refs |
| Process | Assign Umrah Co → track biometric → track visa status → capture Visa No / MOFA No → flip **VISA** gate |
| Approvals | External Saudi/Umrah process; Staff update Tuba register |
| Notify | Material visa status changes → Agent + Admin |
| Outputs | Updated mutamer fields; VISA gate; inputs to MOFA billing |
| Rules | All three visa products valid; Umrah Co from approved master; MOFA money ≠ cash stay deal |
| Exceptions | Partial group completion allowed; dashboards show pending |

### 2.3 Long Stay Lifecycle (Blueprint §9)

| Step | Business meaning |
|------|------------------|
| Trigger | Visa type = Long Stay on Group |
| Inputs | Relation; Host name/Iqama/DOB/mobile; **Host WhatsApp mandatory**; Agency; pax; Umrah Co; entry/exit; Absher; remarks |
| Process | Register group+mutamers → duration → Absher → **day 85 of 90** compliance pack → exit/close |
| Notify | Host WA + Agent WA + Tuba WA + Email + **red dashboard cards** |
| Rules | 90-day normal; Host WhatsApp mandatory; day-85 cannot be skipped; Host is **not** a login user |

### 2.4 Visa Desk operating cadence (Operation Map C2)

| Cadence | Work |
|---------|------|
| Daily | Biometric/visa/MOFA updates; Umrah Co chase; flip VISA gate |
| Weekly | Backlog by Umrah Co; groups arriving ≤7 days still “Visa Not Issued” |
| Monthly | Visa issued rate; MOFA number completeness |
| KPIs | % biometric registered; % visa issued; aging of not-issued |
| Reports | Mutamer visa/MOFA status report |

### 2.5 Passport / Embassy / Rejection / Return (as discoverable)

| Topic | What business docs establish | Clarity |
|-------|------------------------------|---------|
| **Passport** | Identity key; Mutamer Excel column; OCR intake path | Strong |
| **Biometric** | Status on mutamer (`Registered` sample); desk KPI | Strong |
| **Visa approval / rejection** | Status progression; Blueprint notifications on material change; `Visa Not Issued` vocabulary | Strong for status; rejection path less form-specified than issue |
| **MOFA number** | Mutamer field + completeness KPI; distinct from MOFA **bill** | Strong |
| **MOFA bill** | BILL SHEET Qty×Rate, Approval Sign, CR Date; cash stay note | Strong (finance-adjacent) |
| **Umrah Co** | Named Saudi visa suppliers; assign per Group | Strong |
| **Embassy** | Appears in ERP seed/`VisaRequest.embassy` string; **not** a first-class Word/Excel board in discovery dictionaries | Weak / technical leftover |
| **Passport movement / return** | Not a named Excel sheet or Blueprint lifecycle section; ops practice may exist outside extracted docs | **Documentation gap** — confirm with Visa Desk before build |

---

## 3. Department Responsibilities

| Department | Visa / Saudi duties |
|------------|---------------------|
| **Visa Desk** | Daily biometric/visa/MOFA updates; Umrah Co chase; VISA gate with Ops; weekly backlog; mutamer visa/MOFA report |
| **Ops / Command** | Group readiness visibility; escalate visa blockers for arrivals ≤72h; Long Stay red cards |
| **OCR / Document Intake** | Passport images; Nusuk Groups List (intake already in T001); human review |
| **Agent (Bangladesh)** | Open groups; upload mutamers; see scoped visa progress; receive WA; Long Stay red cards (own agents) |
| **Umrah Company (Saudi)** | External processor — **not** a mutamer login; confirm/reject assigned visa work |
| **Host / Service Holder** | Long Stay sponsor — **no login**; WhatsApp recipient for day-85 |
| **Finance** | MOFA Processing bills (Approval Sign); not cash hotel/transport deals *(boundary of T002)* |
| **Admin / Tuba official** | Receive material visa + day-85 notifications |

---

## 4. Current ERP Coverage (post–TRANSFORM-001)

### Coverage map

| Business capability | ERP status | Notes |
|---------------------|------------|-------|
| Group visa type Hajj/Umrah/Long Stay | **Exists** | `VisaType` includes `HAJJ` (T001-01) |
| Nusuk Group Number + consulate string | **Exists** | Group foundation (T001) |
| Haji WhatsApp | **Exists** | Flag `REQUIRE_HAJI_WHATSAPP` |
| Readiness gate VISA | **Exists** | Manual boolean (T001-02/09) — not auto from mutamer completion |
| Mutamer biometric / visa status label / visa no / MOFA no | **Exists (storage + import)** | T001-04/05 — no desk chase engine |
| Passport OCR → Mutamer | **Exists** | T001-06 |
| Nusuk Group-List OCR → Group | **Exists (flagged)** | T001-07 |
| Intake notifications (group/gates/import/OCR) | **Exists** | T001-08 AR-GRP-* |
| Ops Group Master Excel gates | **Exists** | T001-09 |
| VisaRequest batch + status machine | **Partial** | `/services/visa`; create DTO lacks HAJJ & embassy |
| Ops Visa Desk UI | **Partial** | Queue + status transitions; embassy/passport counts removed as fake |
| Agent Visa service form | **Partial** | Umrah/Long Stay request create; not mutamer-level desk |
| Umrah Company as supplier kind | **Missing** | `SupplierType` = HOTEL/TRANSPORT/CATERING only |
| Embassy processing board | **Missing / dead residue** | `VisaRequest.embassy` seeded; create DTO unused; desk UI dropped |
| Passport custody / return workflow | **Missing** | No model |
| Visa reject → wired notify | **Missing** | Templates `VISA_REJECTED` seeded; **no emit** |
| Visa approve → wired notify | **Missing** | Templates `VISA_APPROVED` seeded; **no emit** |
| MOFA Processing Bill sheet | **Missing** | Generic Invoice ≠ BILL SHEET |
| Long Stay host/Iqama/Absher/WhatsApp | **Missing** | `LongStay` = hotel nights/renewal tracker |
| Day-85 automation + red cards | **Missing** | Explicitly out of T001 |
| Visa/biometric backlog dashboards | **Missing / ComingSoon** | `Dashboards.tsx` placeholders + mock MOFA copy |
| Mutamer visa/MOFA status report | **Missing** | Report hub not built for Word list |
| OCR type `VISA` (sticker) | **Dead enum** | In `OcrDocumentType`; no parser/approve path |
| Marketing “NUSUK & MOFA API” | **Hidden / dishonest claim** | Login/Home copy; no integration module |

### Already Exists / Partially Exists / Missing / Dead / Hidden

| Category | Items |
|----------|-------|
| **Already Exists** | Groups visaType+HAJJ+Nusuk+consulate+gateVisa; Passenger mutamer visa fields + Excel import; Passport OCR; Nusuk list OCR (flag); intake notify; thin VisaRequest CRUD/status; Ops Long Stay hotel CRUD; AuditLog patterns; RBAC `REVIEW_OCR_QUEUE` / ops VIEW_DASHBOARD |
| **Partially Exists** | Visa Desk UI; Agent `/services/visa`; Passenger `visaStatus` enum vs business `Visa Not Issued` labels; Group `gateVisa` vs completion truth; `SERVICE_STATUS_CHANGED` generic event |
| **Missing** | Umrah Co master link; mutamer-level Visa Desk board; biometric aging/chase; embassy workflow; passport return; wired VISA_APPROVED/REJECTED; MOFA bill entity; Long Stay host+day-85; visa reports; visa dashboard widgets |
| **Dead Code / Residue** | `OcrDocumentType.VISA` unused; VisaRequest.embassy unused on create; seed embassy values without API |
| **Hidden / Overclaim** | Marketing NUSUK/MOFA API; Dashboard mock “MOFA clearance”; ERPShell sample visa notifications |

---

## 5. Gap Analysis

### 5.1 Business gaps

1. No first-class **Umrah Company** assignment on Group/VisaRequest matching Habash / Almautmirin / Arkan master.  
2. No Visa Desk **mutamer worklist** (biometric registered awaiting visa; not-issued aging; MOFA number incomplete).  
3. No explicit **rejection** handling as a business status + Agent notify.  
4. **Long Stay** product incomplete without Host/Iqama/Absher/day-85.  
5. **MOFA bill** practice (Qty×Rate, Approval Sign) not represented.  
6. Embassy / passport-return SOP **not documented** clearly in extracted Word/Excel — risk of building speculative UI.

### 5.2 Technical gaps

1. `CreateVisaRequestDto` omits `HAJJ` and `embassy` despite schema/seed.  
2. No domain events for passenger biometric/visa/MOFA transitions.  
3. `VISA_APPROVED` / `VISA_REJECTED` NotificationEvents unwired.  
4. No scheduled job for day-85 (Automation exists but unused for LS).  
5. No MOFA bill invoice kind / Bill Sheet UI.  
6. Dashboards service only aggregates open `visaRequest` counts — not mutamer KPIs.  
7. Supplier taxonomy lacks Umrah/visa kind (BT-05 adjacency).

### 5.3 Workflow gaps

| Workflow step | Gap |
|---------------|-----|
| Assign Umrah Co | No required link / master |
| Biometric chase | Fields only; no desk/queue |
| Visa issue/reject | Batch VisaRequest ≠ mutamer Excel statuses |
| Capture Visa/MOFA numbers | Import/edit possible; no completeness enforcement/report |
| Flip VISA gate | Manual only; no “all mutamers issued” assist |
| Day-85 pack | Absent |
| MOFA bill → Approval Sign | Absent |
| Passport return to agent | Undocumented + unimplemented |

### 5.4 Documentation gaps

1. Original Word/Excel binaries not in repo — confirm embassy/passport-return SOP with Visa Desk.  
2. Dual visa vocabularies (`Visa Not Issued` vs `PENDING/APPROVED/REJECTED`) need a published mapping for T002.  
3. Whether Package Status on Long Stay sheet is expiry date vs label remains an open discovery question (BUSINESS_DISCOVERY § open Qs).  
4. MOFA rate (e.g. 445) — per season vs per deal — unresolved.  
5. Boundary: how much of **MOFA bill** belongs in T002 vs a later Finance BT — recommend **include MOFA bill sheet in T002** because Operation Map ties it to visa completion, but **exclude** full dues/GL redesign.

---

## 6. Reusable Modules

| Module | Path / area | T002 use |
|--------|-------------|----------|
| Groups | `apps/api/src/groups/*` | Visa type, Nusuk, gateVisa, Umrah Co link (extend) |
| Passengers / Mutamer import | `groups/passengers*`, `mutamer-import*` | Biometric/visa/MOFA fields source of truth |
| Services / VisaRequest | `apps/api/src/services/*` | Keep status machine; extend DTO + Umrah Co + HAJJ |
| Ops | `apps/api/src/ops/*` | Visa Desk data APIs; Long Stay extend |
| OCR | `apps/api/src/ocr/*` | Keep passport; optional later visa-sticker OCR |
| Notifications + Automation | `notifications/*`, `automation/*` | Wire VISA_* + day-85 schedule |
| Finance (boundary) | `finance/*` | Extend invoice kind for MOFA bill only |
| Web Ops Departments | `OpsDepartments.tsx` VisaDesk | Extend mutamer board |
| Web Ops Control | `OpsControl.tsx` Long Stay tab | Extend host/day-85 |
| Agent Portal | Groups + Services visa tab | Show mutamer visa progress |
| Dashboards | `Dashboards.tsx` + `dashboards.service` | Replace ComingSoon with real KPIs |
| Shared notifications | `packages/shared/src/notifications.ts` | Reuse VISA_* templates |

---

## 7. Reusable APIs

| API | Reuse mode |
|-----|------------|
| `GET/POST/PATCH /groups`, gates | Reuse; extend Umrah Co / LS host fields if on Group |
| `GET/POST/PATCH` passengers + import preview/commit | Reuse as mutamer visa field write path |
| `POST/GET /services/visa`, `PATCH /services/:service/:id/status` | Reuse machine; extend create fields |
| `GET /services/summary` | Reuse for desk counts |
| `GET/POST/PATCH /ops/long-stays` | Reuse; extend host/Absher/day-85 fields |
| `GET /ops/groups` | Reuse readiness board |
| `GET /ocr/capabilities`, OCR documents approve | Reuse passport path |
| Notifications dispatch / Automation rules | Reuse channels + scheduler |
| Finance invoices (later tasks) | Extend kind — do not invent parallel billing API if Invoice can host MOFA kind |

**Do not create parallel** “Visa ERP” or second passenger register.

---

## 8. Reusable Database

| Model / enum | Reuse |
|--------------|-------|
| `Group` (`visaType`, `nusukGroupNumber`, `consulate`, `gateVisa`, `hajiWhatsapp`) | Reuse + optional `umrahCompanyId` |
| `Passenger` (biometric, visaNumber, mofaNumber, visaStatus, visaStatusLabel, …) | Reuse as desk row |
| `VisaRequest` | Reuse batch envelope; align HAJJ + Umrah Co + embassy |
| `LongStay` | Reuse shell; **extend** host/Iqama/Absher/entry-exit/day-85 markers |
| `Company` / supplier roles | Reuse Company; **extend** type/kind for Umrah Co |
| `NotificationEvent` `VISA_APPROVED` / `VISA_REJECTED` | Reuse keys; wire emits |
| `AutomationRule` + cron | Reuse for day-85 sweep |
| `Invoice` | Candidate for `MOFA_PROCESSING` kind |
| `OcrDocument` / `PASSPORT` | Reuse; ignore dead `VISA` type until justified |
| `AuditLog` | Reuse for all desk updates |

---

## 9. Reusable Events

| Event | Status | T002 action |
|-------|--------|-------------|
| `group.gates.changed` | Wired (T001) | Keep when VISA gate flips |
| `group.created` / `group.import.completed` / OCR events | Wired | Intake adjacency only |
| `service.status.changed` | Wired (generic) | May fan visa batch changes; insufficient for mutamer-level |
| `VISA_APPROVED` / `VISA_REJECTED` (NotificationEvent keys) | Seeded, **unwired** | Emit from desk/mutamer transitions |
| **Needed new (additive)** | — | e.g. `passenger.visa.updated`, `longstay.day85`, `mofa.bill.approved` (names TBD in design) |
| `document.expiring` | Fleet-oriented | Do **not** overload for day-85 |

---

## 10. Reusable OCR

| Capability | T002 stance |
|------------|-------------|
| Passport → Mutamer (T001-06) | **Reuse** — identity intake for visa desk |
| Nusuk Group List → Group (T001-07) | **Reuse** — group open before visa chase |
| `OcrDocumentType.VISA` | **Do not activate** unless business proves visa-sticker OCR value; currently dead |
| New embassy/passport-scan OCR | Out of scope unless SOP appears |

---

## 11. Reusable Notifications

| Asset | T002 stance |
|-------|-------------|
| Channels WA / Email / In-App + `tuba-notify` | Reuse |
| Templates `VISA_APPROVED` / `VISA_REJECTED` | Reuse copy; wire emitters |
| Intake pack AR-GRP-* | Keep; do not overload with day-85 |
| Day-85 multi-party pack | **New rules** on Automation schedule |
| Material visa change → Agent + Admin | Implement via wired events + rules |
| Host WhatsApp (Long Stay) | Extend recipient resolution (Host is not a User login) |

---

## 12. Reusable Dashboards

| Surface | Current | T002 |
|---------|---------|------|
| Ops / Agent Dashboards visa cards | ComingSoon + mock MOFA | **Replace** with live mutamer KPIs |
| Long Stay red cards | Absent | **Extend** |
| Visa/biometric backlog | Absent | **Extend** from Passenger fields |
| Ops Group Master `gateVisa` | Live (T001-09) | Keep as ops readiness; complement with desk KPIs |
| Marketing Home/Login NUSUK/MOFA API claims | Misleading | **Modify copy** (honesty) — small docs/UI honesty task |

---

## 13. Business Rules (Visa & Saudi — must preserve)

1. Hajj, Umrah, Long Stay are first-class visa products.  
2. Passport number is mutamer identity key; duplicates flagged.  
3. Biometric → Visa status → Visa Number / MOFA Number is the approval sequence.  
4. Umrah Co from approved supplier master; assigned by Group Number.  
5. Group **VISA** gate flipped when visa work acceptably complete (partial completion allowed).  
6. Material visa status changes notify Agent + Tuba Admin.  
7. Long Stay ~90 days; **Host WhatsApp mandatory**; Host is not a login user.  
8. **Day-85** compliance pack mandatory (WA + Email + red cards) — cannot be skipped.  
9. Absher tracked for Long Stay.  
10. **MOFA Processing Bill** (Qty × Rate, Approval Sign, CR Date) is separate from cash hotel/transport.  
11. No live NUSUK/MOFA government API is claimed by architecture today — status is staff/Umrah Co update.  
12. Mutamer never gets a portal login.

---

## 14. Required Extensions (design intent only)

| Extension | Type | Notes |
|-----------|------|-------|
| Umrah Company identity + Group/VisaRequest link | EXTEND | May await/share BT-05 supplier kinds; minimum viable: Company link + label |
| Visa Desk mutamer board | EXTEND | Filter biometric/visa/MOFA; inline update; aging |
| Align VisaRequest create with HAJJ + Umrah Co | MODIFY | Close schema/DTO gap |
| Wire VISA_APPROVED / VISA_REJECTED (+ material updates) | EXTEND | Notifications |
| Long Stay host/Iqama/Absher/WhatsApp/relation | EXTEND | On LongStay and/or Group |
| Day-85 Automation job + red cards | EXTEND | Critical compliance |
| MOFA Processing bill kind + Bill Sheet UI | EXTEND | Finance boundary |
| Visa/MOFA status report | EXTEND | Reports |
| Dashboard visa backlog + LS red cards | EXTEND | Replace ComingSoon |
| Embassy / passport return | EXTEND or DEFER | Only after SOP confirmation |
| Honest marketing copy (no fake MOFA API) | MODIFY | Low effort, high trust |

---

## 15. Estimated Reuse %

| Bucket | % | Rationale |
|--------|---|-----------|
| **Reuse** | **50%** | Groups, Passengers+import, OCR passport/Nusuk, notify channels, VisaRequest status machine, Ops desks shell, LongStay CRUD shell, Audit, RBAC patterns |
| **Extension** | **35%** | Desk board, Umrah Co link, Long Stay host+day-85, event wiring, dashboards/reports, MOFA bill kind, DTO/schema alignment |
| **New build** | **15%** | Passport custody (if confirmed), Host-as-recipient routing, specialized Bill Sheet UX, day-85 red-card widgets |

*Percentages are effort-on-scope estimates for Visa & Saudi Operations only, not whole ERP.*

---

## 16. Estimated Timeline

| Band | Duration | Assumption |
|------|----------|------------|
| Discovery → design freeze | Done (this doc) + 2–3 days SOP clarification (embassy/passport return, MOFA rate) | |
| Implementation (T002-01…09) | **6–10 weeks** calendar | 1 focused squad; Long Stay day-85 + MOFA bill are the long poles |
| Final acceptance (T002-10) | **3–5 days** | Smoke + business sign-off |

Critical path: **Mutamer Visa Desk (fields→board→notify)** then **Long Stay day-85** then **MOFA bill**.

---

## 17. Transformation Risk

| Risk | Level | Mitigation |
|------|-------|------------|
| Building embassy/passport-return without SOP | High | Confirm with Visa Desk; defer if undocumented |
| Confusing MOFA **number** vs MOFA **bill** | High | Separate fields vs Bill Sheet in UX copy |
| Dual visa vocabularies break Agent Excel | Medium | Keep label map from T001; publish dictionary |
| Day-85 miss = compliance exposure | **Critical** | Automate + red cards; test harness mandatory |
| Enabling fake “MOFA API” expectations | Medium | Fix marketing copy; staff-update model |
| Scope creep into full Finance BT | High | MOFA bill only; no dues/GL rewrite in T002 |
| Umrah Co blocked on BT-05 taxonomy | Medium | Minimal Company link now; full supplier kinds later |
| VisaRequest batch vs mutamer rows diverge | Medium | Desk writes Passenger fields as SoT; batch optional envelope |

---

## 18. Recommended T002 Breakdown

Independently deployable tasks; reuse-first; each with acceptance + rollback (to be detailed in a future transformation design doc — **not** created in this discovery phase).

| Task | Title | Intent | Maps toward |
|------|-------|--------|-------------|
| **T002-01** | Visa Master & Umrah Co linkage | HAJJ parity on visa APIs; Umrah Co on Group/VisaRequest; remove DTO/schema drift | BT-06 |
| **T002-02** | Mutamer Visa Desk Board | Ops Visa Desk worklist on Passenger biometric/visa/MOFA; aging; inline update; audit | BT-06 |
| **T002-03** | Biometric & Visa Status Rules | Canonical status dictionary; validation; partial-completion rules; assist VISA gate | BT-06 |
| **T002-04** | Visa Approval / Rejection Notifications | Wire `VISA_APPROVED` / `VISA_REJECTED` (+ material updates) to Agent + Admin | BT-13 slice |
| **T002-05** | Embassy & Passport Handling (conditional) | Only if SOP confirmed; else slim consulate/embassy fields + defer custody | Gap close |
| **T002-06** | MOFA Number Completeness + MOFA Processing Bill | Completeness KPIs; Bill Sheet Qty×Rate, Approval Sign, CR Date (finance extend) | BT-14 (visa-adjacent) |
| **T002-07** | Long Stay Host Register | Host/Iqama/WhatsApp/relation/Absher on Long Stay product | BT-12 |
| **T002-08** | Day-85 Compliance Pack | Automation schedule; WA+Email; Host+Agent+Tuba; red cards | BT-12 / BT-13 |
| **T002-09** | Visa Reports & Dashboards | Mutamer visa/MOFA report; backlog widgets; replace ComingSoon; honesty copy | BT-15/16 slice |
| **T002-10** | Final Acceptance | Smoke/regression; flags; sign-off; no new features | Gate |

Suggested dependency sketch:

```
T002-01 ─► T002-02 ─► T002-03 ─► T002-04
                │
                ├─► T002-05 (optional / SOP-gated)
                │
                └─► T002-06
T002-01 ─► T002-07 ─► T002-08 ─► T002-09 ─► T002-10
T002-04 ─────────────────────────► T002-09
T002-06 ─────────────────────────► T002-09
```

---

## Appendix A — Pre-T001 vs Post-T001 (visa-relevant)

| Item (old CROSS_MATCH) | After T001 | Still for T002 |
|------------------------|------------|----------------|
| No HAJJ | **Fixed** | Desk/API create parity |
| No Passenger MOFA/biometric | **Fixed (fields)** | Desk workflow + reports |
| No gateVisa | **Fixed** | Link to completion truth |
| Long Stay day-85 | Still missing | T002-07/08 |
| MOFA bill | Still missing | T002-06 |
| VISA_* notify unwired | Still unwired | T002-04 |

---

## Appendix B — Production flags touching Visa (carry forward)

| Flag | Relevance to T002 |
|------|-------------------|
| `ENABLE_NUSUK_GROUP_LIST_OCR` | Intake only; keep policy from T001 |
| `REQUIRE_HAJI_WHATSAPP` | Visa product create; Host WA will need analogous rule for Long Stay |

---

*End of TRANSFORM-002 Discovery. Do not implement from this document until a Transformation-002 design/task pack is authorized.*
