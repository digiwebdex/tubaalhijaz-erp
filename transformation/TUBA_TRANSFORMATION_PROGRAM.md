# TUBA AL HIJAZ — ERP Transformation Program (Phase 5)

**Status:** Master Execution Plan (non-implementation)  
**Date:** 2026-08-01  
**Governing SoT:** [`blueprint/TUBA_MASTER_BUSINESS_BLUEPRINT.md`](../blueprint/TUBA_MASTER_BUSINESS_BLUEPRINT.md)  
**Evidence:** Discovery · Cross Match · Transformation Architecture  

**This document is not code, not tickets, not a sprint roadmap.**  
It defines **independent, deployable Business Transformations** that converge the current ERP to the real Tuba Al Hijaz operating model **without rewriting the architecture**.

---

## 1. Executive Summary

| Item | Statement |
|------|-----------|
| Goal | Current ERP → Real Tuba Al Hijaz ERP |
| Method | Reuse spine; modify workflows; extend only where blueprint has no home |
| Unit of work | **Business Transformation (BT)** — independently deployable |
| Stability rule | Each BT must leave production operable; prefer additive + feature-flagged behaviour |
| Count | **20 Business Transformations** in **8 waves** |
| Expected reuse | ~60–90% per BT (program average ~68%) |
| End state | Excel boards (Group Details, Mutamer upload, Transport, BRN, Long Stay, MOFA bill, Voucher) runnable inside ERP |

**Success definition:** Staff and Bangladesh Agents operate Group → Mutamer → Hotel/Transport/Catering → Voucher → Finance/MOFA → Long Stay day-85 **without** `Tubahijaz full data.xlsx` as system of record.

---

## 2. Transformation Philosophy

1. **Blueprint wins** — every BT maps to Master Business Blueprint rules.  
2. **No rewrite** — preserve auth, portals, GL/wallet, OCR/notify/automation queues, ops boards, Company counterparties.  
3. **One BT = one deployable business outcome** — not a coding task list.  
4. **Independence** — a BT may *depend* on prior BTs, but must not require an undeployed sibling in the same wave unless stated.  
5. **Production safety** — additive schema/fields, dual-read where needed, hide before delete, rollback = redeploy previous release + config revert.  
6. **Reuse first** — name existing modules/APIs/DB/screens explicitly in each BT.  
7. **Mutamer never gets a portal.**  
8. **Public site never markets Staff login.**  
9. **Hide ≠ destroy** — Fleet/ComingSoon may be demoted without deletion.  
10. **Validate in business language** — acceptance = blueprint behaviour, not tech metrics alone.

---

## 3. Transformation Order

### Wave A — Safe surface alignment (low risk)

| Order | ID | Name |
|------:|----|------|
| 1 | **BT-00** | Navigation & Dead-Surface Hygiene |
| 2 | **BT-01** | Website & Login Visibility |

### Wave B — Group spine & masters

| Order | ID | Name |
|------:|----|------|
| 3 | **BT-02** | Group Number Spine & Readiness Gates |
| 4 | **BT-05** | Supplier Four-Type Master (Umrah Co / Hotel / Transport / Catering) |
| 5 | **BT-03** | Mutamer Excel Contract |

### Wave C — Intake

| Order | ID | Name |
|------:|----|------|
| 6 | **BT-04** | OCR Nusuk Group-List Intake |

### Wave D — Core services

| Order | ID | Name |
|------:|----|------|
| 7 | **BT-06** | Visa Product Completion (Hajj / Umrah / Long Stay fields) |
| 8 | **BT-07** | Dual-City Hotel + Agreement + Approval Status |
| 9 | **BT-08** | BRN Inventory Economics |
| 10 | **BT-09** | Transport Request & Schedule Boards |
| 11 | **BT-10** | Bilingual Tuba Transport Voucher |
| 12 | **BT-11** | Catering Business Alignment (light) |

### Wave E — Compliance messaging

| Order | ID | Name |
|------:|----|------|
| 13 | **BT-12** | Long Stay Host Register & Day-85 Compliance |
| 14 | **BT-13** | Material Update Notification Matrix |

### Wave F — Money & insight

| Order | ID | Name |
|------:|----|------|
| 15 | **BT-14** | MOFA Bill, Pay Source & Credit Policy |
| 16 | **BT-15** | Business Dashboard Pack |
| 17 | **BT-16** | Mandatory Reports Hub |

### Wave G — Portal parity

| Order | ID | Name |
|------:|----|------|
| 18 | **BT-17** | Agent Portal Excel/Nusuk Parity |
| 19 | **BT-18** | Supplier Workbench by Type |

### Wave H — People ops

| Order | ID | Name |
|------:|----|------|
| 20 | **BT-20** | HR & Payroll Operating Capability |

*BT numbering preserves architecture identity; order above is deployment sequence.*

---

## 4. Transformation Dependency Graph

```
BT-00 --> BT-01 --> BT-02
                      |
        +-------------+-------------+
        |             |             |
        v             v             v
     BT-03         BT-05         (spine ready)
        |             |
        v             +--> BT-06
     BT-04            +--> BT-07 --> BT-08
                      +--> BT-09 --> BT-10
                      +--> BT-11
                            |
                            v
                         BT-12 --> BT-13
                            |
                            v
                         BT-14 --> BT-15 --> BT-16
                            |
                            +--> BT-18

BT-02 + BT-03 + BT-04 + BT-07 + BT-09 --> BT-17 (Agent Portal Parity)

BT-00 --> BT-20 (HR; may run parallel to Waves F/G)
```

**Hard dependencies**

| BT | Must complete before |
|----|----------------------|
| BT-02 | BT-03, BT-04, BT-07, BT-09, BT-12, BT-17 |
| BT-03 | BT-04 (optional parallel after BT-02), BT-17 |
| BT-05 | BT-06, BT-07, BT-08, BT-09, BT-11, BT-18 |
| BT-07 | BT-08, BT-10 |
| BT-09 | BT-10 |
| BT-12 | BT-13 (day-85 events), BT-15 (red cards) |
| BT-14 | BT-15, BT-16 |

---

## 5. Transformation Matrix

| ID | Name | Wave | Reuse % | Complexity | Business Value | Risk | Depends on |
|----|------|------|--------:|------------|----------------|------|------------|
| BT-00 | Navigation Hygiene | A | 95 | S | Clears noise | Low | — |
| BT-01 | Website & Login | A | 85 | S | Blueprint website law | Low | BT-00 |
| BT-02 | Group Spine & Gates | B | 70 | M | Spine of all ops | Med | BT-01 |
| BT-05 | Supplier Four-Type | B | 75 | M | Masters for dropdowns | Med | BT-02 |
| BT-03 | Mutamer Excel | B | 75 | M | Excel retirement #1 | Med | BT-02 |
| BT-04 | OCR Group Intake | C | 60 | L | Nusuk intake | Med | BT-02, BT-03* |
| BT-06 | Visa Products | D | 80 | S–M | Hajj + field parity | Med | BT-05 |
| BT-07 | Dual Hotel + Approval | D | 65 | M | GROUP DETAILS hotels | Med | BT-02, BT-05 |
| BT-08 | BRN Inventory | D | 55 | M | Agreement economics | Med | BT-07 |
| BT-09 | Transport Boards | D | 70 | M | Schedule/form Excel | Med | BT-02, BT-05 |
| BT-10 | Bilingual Voucher | D | 70 | M | Official voucher | Med | BT-07, BT-09 |
| BT-11 | Catering Alignment | D | 95 | S | Confirm Phase-2 fit | Low | BT-05 |
| BT-12 | Long Stay Day-85 | E | 45 | L | Compliance critical | High | BT-02, BT-03 |
| BT-13 | Notification Matrix | E | 75 | M | WhatsApp operating law | Med | BT-12** |
| BT-14 | MOFA & Pay Source | F | 55 | M | Finance law | High | BT-02 |
| BT-15 | Dashboard Pack | F | 70 | M | Due/process/LS | Med | BT-12, BT-14 |
| BT-16 | Reports Hub | F | 55 | M | Word report set | Med | BT-14 |
| BT-17 | Agent Portal Parity | G | 75 | M | Agent = staff process | Med | BT-02–04,07,09 |
| BT-18 | Supplier by Type | G | 85 | S–M | Fulfilment clarity | Low | BT-05,07,09,11 |
| BT-20 | HR & Payroll | H | 15 | L | Word HR mandate | Med | BT-00 |

\*BT-04 can deploy after BT-02 alone; mutamer Excel (BT-03) recommended first for full intake chain.  
\*\*BT-13 may start earlier for material events from BT-02/07/09; day-85 portion requires BT-12.

---

## 6. Every Business Transformation

---

### BT-00 — Navigation & Dead-Surface Hygiene

| Field | Definition |
|-------|------------|
| **Purpose** | Remove non-blueprint noise from primary staff/agent navigation without deleting engines. |
| **Business Scope** | Hide Fleet primary entry, ComingSoon demos, CRM/Procurement empty desks; keep Audit/Documents reachable. |
| **Modules reused** | Web shell, Ops Departments, Super Admin nav, Fleet (latent). |
| **APIs reused** | None required (nav/config only); fleet/ops APIs remain. |
| **DB reused** | All existing tables untouched. |
| **Screens reused** | ERPShell nav, OpsDepartments tab list, route table. |
| **Workflow affected** | None operational — information architecture only. |
| **Dependencies** | None. |
| **Risk** | Low — users lose shortcuts to demos/fleet. |
| **Business Value** | Focus on real desks; reduces training confusion. |
| **Reuse %** | 95 |
| **Complexity** | S |
| **Acceptance Criteria** | Primary nav matches blueprint workplaces; Fleet/CRM/Procurement/ComingSoon not primary; production login/ops/finance still reachable. |
| **Rollback** | Restore previous nav configuration/release. |

---

### BT-01 — Website & Login Visibility

| Field | Definition |
|-------|------------|
| **Purpose** | Enforce public website = information + Agent entry; Staff login not marketed. |
| **Business Scope** | Home/marketing CTAs; Login tab visibility; optional unlisted staff entry. |
| **Modules reused** | Web marketing pages, Login, Auth. |
| **APIs reused** | `/auth/login` (unchanged contract). |
| **DB reused** | User/Role (unchanged). |
| **Screens reused** | Home, Services, About, Contact, Login. |
| **Workflow affected** | Public access path only. |
| **Dependencies** | BT-00 helpful. |
| **Risk** | Low — staff must know unlisted URL. |
| **Business Value** | Blueprint §20 compliance. |
| **Reuse %** | 85 |
| **Complexity** | S |
| **Acceptance Criteria** | Public site promotes Agent login; Admin tab not on marketed login; no public booking; staff can still authenticate via agreed entry. |
| **Rollback** | Prior Login/Home release. |

---

### BT-02 — Group Number Spine & Readiness Gates

| Field | Definition |
|-------|------------|
| **Purpose** | Make Nusuk Group Number the unique spine; add VISA/PACKAGE/PAYMENT/BILL gates; mandatory Haji WhatsApp; Umrah Co link. |
| **Business Scope** | Group master board columns; create/edit group; uniqueness; shared Staff/Agent data. |
| **Modules reused** | Groups, Ops groups, Companies, Agent Portal groups, Seasons. |
| **APIs reused** | `/groups`, `/ops/groups`, company list. |
| **DB reused** | `Group`, `Company`, `Season`, `FlightInfo` (extend Group fields). |
| **Screens reused** | Ops Group Master, Agent Portal Groups. |
| **Workflow affected** | Group Lifecycle (Blueprint §8). |
| **Dependencies** | BT-01 (recommended). |
| **Risk** | Medium — migration of codes; uniqueness collisions. |
| **Business Value** | Highest — everything hangs on Group Number. |
| **Reuse %** | 70 |
| **Complexity** | M |
| **Acceptance Criteria** | Unique Group Number enforced; Staff & Agent see same group; gates visible/toggleable; Haji WhatsApp required for Hajj/Umrah; duration shown from flight dates; no duplicate create. |
| **Rollback** | Previous release; new fields ignored/nullable until backfilled. |

---

### BT-05 — Supplier Four-Type Master

| Field | Definition |
|-------|------------|
| **Purpose** | Classify suppliers as Umrah Co / Hotel / Transport / Catering with extensible masters. |
| **Business Scope** | Supplier dropdowns; onboarding; portal routing by type. |
| **Modules reused** | Companies, SupplierProfile, Supplier Portal, Services routing. |
| **APIs reused** | `/companies`, supplier endpoints. |
| **DB reused** | `Company`, `SupplierProfile` (extend kind). |
| **Screens reused** | Super Admin companies, service forms, Supplier Portal. |
| **Workflow affected** | Supplier Lifecycle (§14). |
| **Dependencies** | BT-02 (for group Umrah Co link). |
| **Risk** | Medium — reclassify existing suppliers. |
| **Business Value** | Correct masters for all Phase-2 services. |
| **Reuse %** | 75 |
| **Complexity** | M |
| **Acceptance Criteria** | Four types selectable; Umrah Cos appear on group create; hotel/transport/catering filtered by type; add-with-details possible. |
| **Rollback** | Prior company release; kind optional. |

---

### BT-03 — Mutamer Excel Contract

| Field | Definition |
|-------|------------|
| **Purpose** | Support official mutamer upload columns (sample Excel) into a Group Number. |
| **Business Scope** | Mutamer register; Main/Sub EA; biometric; visa status; visa/MOFA numbers; mutamer type; age. |
| **Modules reused** | Groups/Passengers, Agent Portal, Documents/Uploads (file intake). |
| **APIs reused** | Passenger CRUD + bulk passenger API (under importer). |
| **DB reused** | `Passenger` (extend columns); `Group`. |
| **Screens reused** | Agent/Staff group passenger UIs. |
| **Workflow affected** | Customer/Mutamer Lifecycle (§7). |
| **Dependencies** | BT-02. |
| **Risk** | Medium — column mapping errors. |
| **Business Value** | Retires sample Excel as SoT. |
| **Reuse %** | 75 |
| **Complexity** | M |
| **Acceptance Criteria** | Sample Excel columns accepted; mutamers land under Group Number; Sub EA stored; visa/biometric/MOFA/type visible; no mutamer login created. |
| **Rollback** | Disable importer; prior passenger fields remain. |

---

### BT-04 — OCR Nusuk Group-List Intake

| Field | Definition |
|-------|------------|
| **Purpose** | OCR Nusuk Groups List image → create/update Group Number (passport OCR remains secondary). |
| **Business Scope** | OCR Center mode “Group List”; review/approve; commit to Group spine. |
| **Modules reused** | OCR, Uploads, Groups, `tuba-ocr` queue. |
| **APIs reused** | `/ocr/*`, `/groups`. |
| **DB reused** | `OcrDocument`, `Group`, `UploadedFile`. |
| **Screens reused** | OCR Center, Group create. |
| **Workflow affected** | OCR Lifecycle (§18) + Group create. |
| **Dependencies** | BT-02; BT-03 recommended before full chain. |
| **Risk** | Medium — OCR accuracy; duplicate numbers. |
| **Business Value** | Word Phase-1 intake. |
| **Reuse %** | 60 |
| **Complexity** | L |
| **Acceptance Criteria** | Group-list image can yield Group Number fields; human review before commit; duplicate Group Number blocked; passport→mutamer path still works. |
| **Rollback** | Disable group-list doc type; OCR passport-only. |

---

### BT-06 — Visa Product Completion

| Field | Definition |
|-------|------------|
| **Purpose** | Hajj / Umrah / Long Stay as first-class visa types; Umrah Co linkage; desk visibility. |
| **Business Scope** | Visa type dropdown; visa desk board using mutamer visa fields. |
| **Modules reused** | Services/Visa, Groups, Suppliers (Umrah Co). |
| **APIs reused** | Visa request APIs, group update. |
| **DB reused** | `VisaRequest`, `Group`, `Passenger` visa fields. |
| **Screens reused** | Ops Departments Visa desk, Agent service forms. |
| **Workflow affected** | Visa Lifecycle (§10). |
| **Dependencies** | BT-05; BT-03 for mutamer fields. |
| **Risk** | Low–Medium. |
| **Business Value** | Completes Word visa dropdown. |
| **Reuse %** | 80 |
| **Complexity** | S–M |
| **Acceptance Criteria** | HAJJ selectable; Long Stay/Umrah remain; Umrah Co required on visa groups; biometric/visa/MOFA visible on desk. |
| **Rollback** | Hide HAJJ; prior enum clients. |

---

### BT-07 — Dual-City Hotel + Agreement + Approval Status

| Field | Definition |
|-------|------------|
| **Purpose** | Makkah + Madinah blocks with Agreement No. and WAITING FOR APPROVAL / APPROVED. |
| **Business Scope** | Hotel desk + agent hotel request UX aligned to GROUP DETAILS. |
| **Modules reused** | Hotels, HotelBooking, Services, Ops hotel desk, Supplier portal hotel. |
| **APIs reused** | `/services/hotel`, `/hotels`, supplier accept. |
| **DB reused** | `Hotel`, `HotelBooking` (agreement + approval mapping). |
| **Screens reused** | Agent services, Ops Departments Hotel, Supplier Portal. |
| **Workflow affected** | Hotel Lifecycle (§11). |
| **Dependencies** | BT-02, BT-05. |
| **Risk** | Medium — status mapping to existing service states. |
| **Business Value** | Core Excel hotel board. |
| **Reuse %** | 65 |
| **Complexity** | M |
| **Acceptance Criteria** | Dual blocks captureable; Agreement No. stored; WAITING/APPROVED visible per city; still keyed by Group+Agent; supplier confirm path works. |
| **Rollback** | Prior hotel booking release; new fields optional. |

---

### BT-08 — BRN Inventory Economics

| Field | Definition |
|-------|------------|
| **Purpose** | BRN sold inventory with price×days×pax, used pax, link to hotel agreements. |
| **Business Scope** | BRN inventory workplace; allocation to group hotels. |
| **Modules reused** | Ops BRN, HotelBooking agreement fields. |
| **APIs reused** | `/ops/brns`, hotel booking update. |
| **DB reused** | `BRN` (extend economics), `HotelBooking`. |
| **Screens reused** | Ops BRN panels (reshape). |
| **Workflow affected** | BRN Lifecycle (§17). |
| **Dependencies** | BT-07. |
| **Risk** | Medium — commercial totals. |
| **Business Value** | Retires “additional BRN SOLD” sheet. |
| **Reuse %** | 55 |
| **Complexity** | M |
| **Acceptance Criteria** | Inventory rows CRUD; total formula enforced; used pax tracked; agreement numbers selectable on hotels; over-capacity visible. |
| **Rollback** | Prior BRN ops without economics fields. |

---

### BT-09 — Transport Request & Schedule Boards

| Field | Definition |
|-------|------------|
| **Purpose** | Form-style transport request + Excel-like schedule board over existing transport/dispatch. |
| **Business Scope** | Vehicle/route/FULL vs SINGLE; attachments; legs; BILL/done marks; Own Transport. |
| **Modules reused** | TransportBooking, Dispatch, Ops, Uploads, Agent services. |
| **APIs reused** | `/services/transport`, `/ops/dispatches`, uploads. |
| **DB reused** | `TransportBooking`, `DispatchOrder`, `UploadedFile`. |
| **Screens reused** | Ops Control, Ops Transport desk, Agent Portal services. |
| **Workflow affected** | Transport Lifecycle (§12). |
| **Dependencies** | BT-02, BT-05. |
| **Risk** | Medium. |
| **Business Value** | Retires Form responses + TRANSPORT SCHEDULE sheets. |
| **Reuse %** | 70 |
| **Complexity** | M |
| **Acceptance Criteria** | Request captured with Group+Agent; schedule shows legs/columns; tickets/receipts attachable; Own Transport allowed; today’s legs visible. |
| **Rollback** | Prior transport/dispatch UIs. |

---

### BT-10 — Bilingual Tuba Transport Voucher

| Field | Definition |
|-------|------------|
| **Purpose** | Issue Arabic/English voucher matching business TUBA VOUCHER content. |
| **Business Scope** | Hotels, transport, flights, movements, muallim, supervisors, 24h phones. |
| **Modules reused** | Voucher generator, storage, services confirm pipeline, notifications. |
| **APIs reused** | Voucher generate/list; booking reads. |
| **DB reused** | `Voucher`, hotel/transport/group. |
| **Screens reused** | Voucher preview/issue in ops/services. |
| **Workflow affected** | Voucher Lifecycle (§16). |
| **Dependencies** | BT-07, BT-09. |
| **Risk** | Medium — template correctness. |
| **Business Value** | Official ground document. |
| **Reuse %** | 70 |
| **Complexity** | M |
| **Acceptance Criteria** | Bilingual voucher generated from group data; nights computed; movements listed; notify on issue; PDF stored. |
| **Rollback** | Prior voucher template. |

---

### BT-11 — Catering Business Alignment

| Field | Definition |
|-------|------------|
| **Purpose** | Confirm catering as Phase-2 group service with catering-type suppliers; light UX alignment. |
| **Business Scope** | Catering by Group+Agent; supplier filter Catering. |
| **Modules reused** | CateringBooking, Services, Supplier Portal. |
| **APIs reused** | `/services/catering`, supplier accept. |
| **DB reused** | `CateringBooking`, supplier kind. |
| **Screens reused** | Agent services, Ops Catering desk, Supplier Portal. |
| **Workflow affected** | Catering Lifecycle (§13). |
| **Dependencies** | BT-05. |
| **Risk** | Low. |
| **Business Value** | Closes Word catering requirement. |
| **Reuse %** | 95 |
| **Complexity** | S |
| **Acceptance Criteria** | Catering bookable on Group; only catering suppliers listed; accept/reject works; optional groups may skip. |
| **Rollback** | Prior catering screens. |

---

### BT-12 — Long Stay Host Register & Day-85 Compliance

| Field | Definition |
|-------|------------|
| **Purpose** | Host/Iqama/Absher/relation fields; 90-day model; day-85 multi-party alerts + red cards. |
| **Business Scope** | Long Stay register; automation schedule; dashboard cards. |
| **Modules reused** | LongStay ops, Visa LONG_STAY, Passengers, Notifications, Automation queue, Dashboards. |
| **APIs reused** | `/ops/long-stays`, notify dispatch, automation schedules. |
| **DB reused** | `LongStay`, `Passenger`/`Host` fields, notification logs. |
| **Screens reused** | Ops Long Stay, Agent dashboard cards, Automation. |
| **Workflow affected** | Long Stay Lifecycle (§9) + Notification day-85. |
| **Dependencies** | BT-02, BT-03. |
| **Risk** | **High** — compliance if alerts fail. |
| **Business Value** | Critical Word Phase-3. |
| **Reuse %** | 45 |
| **Complexity** | L |
| **Acceptance Criteria** | Host WhatsApp mandatory; Absher flag; duration tracked; at day 85 Host+Agent+Tuba get WA+email; red cards on Agent & Admin dashboards; no Host login. |
| **Rollback** | Disable day-85 job; prior LongStay fields. |

---

### BT-13 — Material Update Notification Matrix

| Field | Definition |
|-------|------------|
| **Purpose** | WhatsApp (primary) to Agent+Admin on material events; integrate day-85 pack. |
| **Business Scope** | Event matrix for gates, hotel approval, transport, voucher, payment, visa, LS day-85. |
| **Modules reused** | Notifications, Automation, shared templates, WA/Email/In-App channels. |
| **APIs reused** | Notification dispatch, events/templates admin. |
| **DB reused** | `NotificationEvent`, `MessageTemplate`, `NotificationLog`. |
| **Screens reused** | Automation/Notifications admin, bell. |
| **Workflow affected** | Notification Lifecycle (§19). |
| **Dependencies** | BT-12 for day-85; earlier BTs for event sources. |
| **Risk** | Medium — noise vs silence. |
| **Business Value** | Operating communication law. |
| **Reuse %** | 75 |
| **Complexity** | M |
| **Acceptance Criteria** | Material catalogue implemented; Agent+Admin receive WA on listed events; day-85 pack intact; delivery logged; not every keystroke. |
| **Rollback** | Prior event matrix config. |

---

### BT-14 — MOFA Bill, Pay Source & Credit Policy

| Field | Definition |
|-------|------------|
| **Purpose** | MOFA Processing bills (Qty×Rate, approval sign); supplier pay source bank/cash/mobile; credits only Agent/Host. |
| **Business Scope** | Finance desk MOFA bill; payment source; Host as credit party identity (no login). |
| **Modules reused** | Finance GL, Invoices, Agent-finance wallet/slips, Ledger. |
| **APIs reused** | `/finance/*`, `/agent-finance/*`. |
| **DB reused** | `Invoice` (kind), ledger/payment source fields, Group BILL gate. |
| **Screens reused** | FinanceERP, Agent Finance. |
| **Workflow affected** | Finance Lifecycle (§15). |
| **Dependencies** | BT-02. |
| **Risk** | **High** — money correctness. |
| **Business Value** | Retires BILL SHEET; enforces credit/debit law. |
| **Reuse %** | 55 |
| **Complexity** | M |
| **Acceptance Criteria** | MOFA bill creatable with lines/total/approval/CR date; note separation from cash hotel/transport; supplier payment requires source; credits restricted to Agent/Host; GL remains balanced. |
| **Rollback** | Disable MOFA kind; prior invoice flows. |

---

### BT-15 — Business Dashboard Pack

| Field | Definition |
|-------|------------|
| **Purpose** | Dashboards prioritize Due from Agent, Groups in process, LS red cards, waiting hotels, today transport. |
| **Business Scope** | Admin/Agent/Finance dashboard widgets per Blueprint §23/33. |
| **Modules reused** | Dashboards service, Redis cache pattern, Finance AR, Ops aggregates. |
| **APIs reused** | `/dashboards/*` (reshape payloads). |
| **DB reused** | Existing aggregates + new fields from prior BTs. |
| **Screens reused** | Dashboards page. |
| **Workflow affected** | Dashboard Behaviour (§23). |
| **Dependencies** | BT-12, BT-14 (for full pack); partial deploy possible earlier. |
| **Risk** | Medium — widget accuracy. |
| **Business Value** | Daily command view. |
| **Reuse %** | 70 |
| **Complexity** | M |
| **Acceptance Criteria** | Due, process, LS red, waiting hotels, today transport visible; Agent sees scoped dues/LS; fleet-centric widgets not primary. |
| **Rollback** | Prior dashboard payloads. |

---

### BT-16 — Mandatory Reports Hub

| Field | Definition |
|-------|------------|
| **Purpose** | Agent-wise, supplier-wise, group code, income, expense, daily/monthly/yearly reports. |
| **Business Scope** | Reports workplace; period filters; export as business requires. |
| **Modules reused** | Finance reports (P&L/BS/AR/AP), Groups, Companies. |
| **APIs reused** | Finance report endpoints; new report facades over same aggregates. |
| **DB reused** | Ledger, Invoice, Group, Company. |
| **Screens reused** | FinanceERP + new Reports Hub surface. |
| **Workflow affected** | Reports Behaviour (§24). |
| **Dependencies** | BT-14. |
| **Risk** | Medium. |
| **Business Value** | Word-mandated reporting. |
| **Reuse %** | 55 |
| **Complexity** | M |
| **Acceptance Criteria** | All eight Word report families producible for a period; group dossier by Group Number; figures reconcile to GL where applicable. |
| **Rollback** | Hide hub; prior finance screens. |

---

### BT-17 — Agent Portal Excel/Nusuk Parity

| Field | Definition |
|-------|------------|
| **Purpose** | Agent can run same group/mutamer/hotel/transport processes as Staff within isolation. |
| **Business Scope** | Agent Portal workflows for BT-02/03/04/07/09 outcomes; dues; LS cards. |
| **Modules reused** | Agent Portal shell, groups/services/finance agent APIs. |
| **APIs reused** | Agent-scoped groups, passengers, services, agent-finance, notifications. |
| **DB reused** | Same as prior BTs with tenant isolation. |
| **Screens reused** | `/agent-portal` and subviews. |
| **Workflow affected** | Agent Portal Behaviour (§21). |
| **Dependencies** | BT-02, BT-03, BT-04, BT-07, BT-09 (minimum viable subset may stage). |
| **Risk** | Medium — permission leaks. |
| **Business Value** | Agents leave WhatsApp/Excel for portal. |
| **Reuse %** | 75 |
| **Complexity** | M |
| **Acceptance Criteria** | Agent completes intake→mutamer→hotel/transport request on own groups; cannot see other agents; receives notifications; sees own dues/LS red cards. |
| **Rollback** | Prior Agent Portal release. |

---

### BT-18 — Supplier Workbench by Type

| Field | Definition |
|-------|------------|
| **Purpose** | Supplier UX/assignment filtered by Umrah/Hotel/Transport/Catering type. |
| **Business Scope** | Accept/reject; type-appropriate fields; no cross-data. |
| **Modules reused** | Supplier Portal, Services supplier APIs. |
| **APIs reused** | `/supplier` accept/reject/list. |
| **DB reused** | Bookings + supplier kind. |
| **Screens reused** | Supplier Portal. |
| **Workflow affected** | Supplier Portal Behaviour (§22). |
| **Dependencies** | BT-05; BT-07/09/11 for assignment volume. |
| **Risk** | Low. |
| **Business Value** | Clean fulfilment. |
| **Reuse %** | 85 |
| **Complexity** | S–M |
| **Acceptance Criteria** | Supplier sees only own type assignments; accept/reject with reason; agent books isolated. |
| **Rollback** | Prior supplier portal. |

---

### BT-20 — HR & Payroll Operating Capability

| Field | Definition |
|-------|------------|
| **Purpose** | Replace empty HR desk with employee + salary operating capability per Blueprint. |
| **Business Scope** | Employee master; payroll runs; expense reflection in company books. |
| **Modules reused** | OpsDepartments HR slot, Finance expense/GL patterns, Users (link optional). |
| **APIs reused** | Finance entry patterns; new HR operations family (business ops — not specified as code here). |
| **DB reused** | New HR entities (only true greenfield data); GL accounts for salaries. |
| **Screens reused** | HR desk EmptyState → real HR workplace. |
| **Workflow affected** | HR department mandate; Finance expense. |
| **Dependencies** | BT-00 (nav); otherwise independent. |
| **Risk** | Medium — new domain. |
| **Business Value** | Word HR/Payroll requirement. |
| **Reuse %** | 15 |
| **Complexity** | L |
| **Acceptance Criteria** | Employees maintainable; salary payments recordable; appears in expense reporting; no impact on Group spine. |
| **Rollback** | Revert HR desk to empty; stop payroll postings. |

---

## 7. Deployment Strategy

1. **Wave by wave** — finish acceptance of a wave before starting the next hard-dependent wave.  
2. **One BT per production deploy** preferred; pair only S-complexity BTs (e.g. BT-00+BT-01).  
3. **Additive first** — nullable new fields; dual UI labels during status mapping.  
4. **Feature switches** — especially OCR group-list, day-85 job, MOFA bill kind, Excel importer.  
5. **Migrate masters early** — supplier kinds (BT-05) before desk cutovers.  
6. **Preserve GL & wallet** — never deploy a BT that rebuilds finance core.  
7. **Portal lag OK** — Staff desks (Waves B–F) may lead Agent parity (BT-17).  
8. **HR parallel** — BT-20 may run beside Wave F/G.  
9. **No big-bang Excel cutover** — run ERP boards parallel to spreadsheet until BT-17 acceptance.  
10. **Each deploy must include rollback package** (prior images + config).

---

## 8. Validation Strategy

| Layer | Method |
|-------|--------|
| Blueprint conformance | Checklist against Master Business Blueprint sections for that BT |
| Desk rehearsal | Staff runs Excel scenario on ERP board (same Group Number) |
| Agent isolation | Negative tests: Agent A cannot see Agent B |
| Supplier isolation | Supplier sees only assignments |
| Notification proof | Capture WA/email/dashboard for material + day-85 events |
| Finance proof | MOFA bill + pay source + GL balance spot-check |
| Uniqueness | Duplicate Group Number attempt fails |
| Regression | Prior portals, wallet, OCR passport, catering, supplier accept still work |
| Acceptance sign-off | Business owner confirms BT Acceptance Criteria — not engineering alone |

---

## 9. Risk Strategy

| Risk | Mitigation |
|------|------------|
| Group Number collision on Nusuk import | BT-02 uniqueness + staging dry-run import |
| Status mapping confuses hotel desk | Dual-label period; training card per BT-07 |
| Day-85 silent failure | Heartbeat monitoring of schedule; manual compliance list backup until stable |
| MOFA vs cash confusion | Explicit bill kind + UI note (Blueprint rule) |
| Notification spam | Material catalogue only (BT-13) |
| Agent data leak on portal parity | Isolation validation gate on BT-17 |
| Scope creep / rewrite temptation | Program forbids architecture rewrite; escalate to Blueprint amendment |
| Excel dual-running drift | Freeze which board is SoT per week during cutover |
| OCR mis-reads Group Number | Mandatory human review on BT-04 |
| HR delay | BT-20 not blocking Waves A–G |

**Production stability rule:** If a BT fails acceptance, rollback that BT only; do not cascade-revert unrelated waves.

---

## 10. Final Executive Summary

This Transformation Program converts the current ERP into the real Tuba Al Hijaz ERP through **20 independent, deployable Business Transformations** in **8 waves**, governed by the Master Business Blueprint.

| Wave | Focus | Stability posture |
|------|-------|-------------------|
| A | Nav + website login law | Safest |
| B | Group spine, suppliers, mutamer Excel | Foundation |
| C | OCR group intake | Intake |
| D | Hotel, BRN, transport, voucher, catering, visa | Core ops |
| E | Long Stay day-85 + notifications | Compliance |
| F | MOFA/finance policy + dashboards + reports | Money & insight |
| G | Agent & supplier portal parity | Channel cutover |
| H | HR & Payroll | People ops |

**Architecture is preserved.** Portals, GL/wallet, queues, OCR engine, and ops boards are reused. Extensions concentrate where the blueprint has no home today (gates, Excel columns, BRN economics, day-85, MOFA bills, HR).

**Program complete.** No implementation tasks, coding tasks, or prompts are defined here — only the Master Execution Plan.

---

*End of TUBA_TRANSFORMATION_PROGRAM.md — Phase 5.*
