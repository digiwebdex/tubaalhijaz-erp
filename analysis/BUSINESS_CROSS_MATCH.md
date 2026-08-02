# TUBA AL HIJAZ — Business ↔ ERP Cross Match (Phase 2)

**Date:** 2026-08-01  
**Mode:** Read-only reality match — no fixes, no redesign, no roadmap, no tickets  
**Business SoT:** [`analysis/BUSINESS_DISCOVERY.md`](./BUSINESS_DISCOVERY.md) + `/doc/business/*`  
**Implementation inspected:** `apps/api`, `apps/web`, `apps/api/prisma/schema.prisma`, shared notifications, seeds  

**Rule:** Business wins. Software is recorded only as what exists.

---

## 1. Business Module Inventory

| # | Business module | Source |
|---|-----------------|--------|
| B01 | Single-company Tuba operation; agents as customers | Word |
| B02 | Roles: Super Admin, Staff, BD Agent, Supplier, Mutamer (no portal), Host | Word |
| B03 | Nusuk Group Number intake + OCR image → group | Word + screenshot |
| B04 | Mutamer Excel upload into Group Number | Sample Excel + Word |
| B05 | Sub EA / Main EA (Tuba code) hierarchy | Sample Excel legend |
| B06 | Hajj / Umrah / Long Stay visa products | Word |
| B07 | Umrah Company (visa supplier) master | Word + GROUP DETAILS |
| B08 | Group readiness: VISA / PACKAGE / PAYMENT / BILL checkboxes | GROUP DETAILS |
| B09 | Dual hotel Makkah + Madinah + agreement no. + APPROVED/WAITING | GROUP DETAILS |
| B10 | BRN / agreement inventory sold & used pax | additional BRN SOLD |
| B11 | Transport request form + schedule board | Form responses + TRANSPORT SCHEDULE |
| B12 | Bilingual Tuba Transport Voucher | TUBA VOUCHER |
| B13 | Catering by group | Word |
| B14 | Long Stay host/Iqama/WhatsApp + day-85 alerts + Absher | Word + LONG STAY DETAILS |
| B15 | MOFA processing bill (Qty×Rate) separate from cash hotel/transport | BILL SHEET |
| B16 | Finance: credit Agent/Host only; debit suppliers via bank/cash/mobile | Word |
| B17 | Reports: agent/supplier/group/income/expense daily-monthly-yearly | Word |
| B18 | Dashboard: due from agent + group process + Long Stay red cards | Word |
| B19 | WhatsApp every update to agent + admin | Word |
| B20 | Website info-only + agent login only (hide staff login) | Word |
| B21 | HR & Payroll | Word |
| B22 | Agent Portal (same group/mutamer process as staff) | Word |
| B23 | Ziyarah movements | Voucher + schedule + form |

---

## 2. ERP Module Inventory

| # | ERP module | Evidence |
|---|------------|----------|
| E01 | Auth / JWT / refresh / register agent+supplier | `/auth` |
| E02 | Users / Roles / Permissions (11 keys, 8 roles) | `/users`, `/roles`, `/permissions` |
| E03 | Companies (AGENT/SUPPLIER) + verification | `/companies` |
| E04 | Groups + Passengers (+ bulk JSON) | `/groups`, `/passengers` |
| E05 | Services: Visa, Hotel, Transport, Catering, Additional | `/services/*`, `/hotels` |
| E06 | Supplier portal accept/reject | `/supplier` |
| E07 | Vouchers (PDF generator) | `/vouchers`, voucher-generator |
| E08 | Ops: groups, flights, dispatch, meet-assist, ziyarah, long-stay, BRN | `/ops/*` |
| E09 | Finance staff ERP + agent-finance wallet/slips | `/finance/*`, `/agent-finance/*` |
| E10 | Fleet ERP | `/fleet`, `/vehicles` |
| E11 | OCR async + review queue | `/ocr` |
| E12 | Documents vault | `/documents` |
| E13 | Uploads / storage / confirmToken | `/uploads` |
| E14 | Notifications + WS `/notifications` | `/notifications` |
| E15 | Automation rules + BullMQ | `/automation`, queues |
| E16 | Dashboards (8 views) | `/dashboards/*` |
| E17 | Audit log read | `/audit-logs` |
| E18 | Health / Metrics | `/health`, `/metrics` |
| E19 | Marketing website | `/`, `/services`, `/about`, `/contact` |
| E20 | Agent Portal UI | `/agent-portal` |
| E21 | Supplier Portal UI | `/supplier-portal` |
| E22 | Super Admin UI | `/super-admin` |
| E23 | Ops Departments UI (incl. HR/CRM/Procurement placeholders) | `/ops-departments` |
| E24 | ComingSoon surfaces | `/workflow-map`, `/mobile-apps`, `/tablet`, `/design-system`, `/i18n-system` |
| E25 | Prisma models (58) including Enquiry, Guarantor, Driver, wallets, GL, etc. | `schema.prisma` |

**Queues:** `tuba-automation`, `tuba-notify`, `tuba-ocr`  
**VisaType in DB:** `UMRAH` \| `LONG_STAY` only (no `HAJJ`)  
**Service statuses:** `REQUESTED → ASSIGNED → CONFIRMED → VOUCHER_ISSUED → COMPLETED` (+ reject/cancel)

---

## 3. Business → ERP Mapping

| Business module | ERP mapping | Fit |
|-----------------|-------------|-----|
| B01 Single company | Staff users have null `companyId`; agents/suppliers are `Company` tenants | **Different model** (operational multi-party tenancy) |
| B02 Roles | SUPER_ADMIN, OPS/FINANCE/FLEET/CEO staff, AGENT, SUPPLIER, DRIVER; no Host role; no Mutamer login | **Partial** |
| B03 Nusuk OCR→Group | OCR creates/reviews documents; can create **Passenger** from passport; Group has internal `code`; Visa has `nusukRef` | **Partial / wrong entry path** |
| B04 Mutamer Excel | `POST …/passengers/bulk` JSON (≤500); no `.xlsx` parser | **Partial** |
| B05 Sub EA hierarchy | `AgentProfile` reference fields only; no Sub EA model | **Missing** |
| B06 Hajj/Umrah/Long Stay | `UMRAH` + `LONG_STAY`; **no HAJJ** enum | **Partial** |
| B07 Umrah Co master | Generic `SUPPLIER` companies; not a dedicated Umrah-Co type | **Partial / different** |
| B08 VISA/PACKAGE/PAYMENT/BILL | No group checkboxes; passenger status flags + `packageType` enum instead | **Missing / different** |
| B09 Dual hotels + agreement + WAITING | Multiple `HotelBooking`s possible; Hotel.`city`; status = service machine, not WAITING/APPROVED; **no agreementNo field** | **Partial / different** |
| B10 BRN inventory | `BRN` entity + ops CRUD; **no sold inventory/price/used pax** | **Partial** |
| B11 Transport form/schedule | `TransportBooking` + `DispatchOrder` + ops boards; no Google-form twin | **Partial / different** |
| B12 Bilingual voucher | PDF voucher generator (English labels observed) | **Partial / different** |
| B13 Catering | `CateringBooking` + API + supplier flow | **Implemented** |
| B14 Long Stay day-85 / Iqama / Absher / relation | `LongStay` hotel/nights/renewal only; **no host fields, no day-85 job** | **Partial / missing rules** |
| B15 MOFA bill sheet | No MOFA bill entity; finance invoices/GL different | **Missing / different** |
| B16 Credit Agent/Host; debit source bank/cash/mobile | Wallet + GL + payment slips; **no Host credit party; payment source enum not as Word** | **Partial / different** |
| B17 Named periodic reports | P&L/BS/AR/AP/ledgers/statements; **not** the Word report set as named endpoints | **Partial** |
| B18 Dashboard dues + group process + red LS cards | 8 dashboards exist; **no Long Stay day-85 red card; dues via AR/aging not Word wording** | **Partial** |
| B19 WhatsApp every update | WA channel + event matrix; **event-driven, not every update** | **Partial** |
| B20 Website agent-only login | Login tabs: Agent + **Supplier** + **Admin**; Home links `/login` | **Incorrect vs business** |
| B21 HR/Payroll | OpsDepartments HR empty state; **no HR models** | **Missing** |
| B22 Agent Portal | `/agent-portal` live | **Implemented** (scope differs from Excel parity) |
| B23 Ziyarah | `ZiyarahTrip` + ops API | **Implemented** (partial vs voucher movement grid) |

---

## 4. ERP → Business Mapping

| ERP capability | Business counterpart | Notes |
|----------------|----------------------|-------|
| Agent/Supplier `Company` tenancy | Agents & suppliers as counterparties | Broader SaaS-like tenancy than “one company ERP” wording |
| `Passenger` | Mutamer | Naming/fields differ (no MOFA/biometric/type/Sub EA) |
| `Group` | Group Number board | Internal `GRP-…` codes vs Nusuk long numeric |
| `VisaRequest` | Visa / Umrah processing | Missing Hajj; has Nusuk/Muallim/Mahram |
| `HotelBooking` | Hotel Makkah/Madinah rows | Not dual-block Excel layout |
| `TransportBooking` + Dispatch | Transport schedule | Different status machine |
| `CateringBooking` | Catering | Present |
| `BRN` | Agreement/BRN | Ops tracking ≠ inventory sold sheet |
| `Voucher` PDF | Tuba Voucher sheet | Format differs |
| `LongStay` | Long Stay Details | Missing host/Absher/day-85 |
| Wallet / Invoice / GL | Accounts & Finance | Different controls than Excel checkboxes + MOFA bill |
| OCR passport queue | OCR phase | Not Nusuk group-list OCR→group |
| Notification events | WhatsApp updates | Subset of business triggers |
| Fleet / Driver | Transport capacity | Beyond Word Excel scope |
| Documents vault | Business docs | Extra vs Excel Drive links |
| Automation / expiry jobs | Document expiry etc. | Not day-85 Long Stay |
| Enquiry model | — | **No business module in discovery Excel/Word** |
| ComingSoon mobile/tablet/design/i18n | — | Spec/demo surfaces |
| HR/CRM/Procurement UI stubs | HR required by Word | UI only |

---

## 5. Implemented Correctly

*(Business need exists and ERP provides a matching operational capability without contradicting the business rule.)*

| Area | Reality |
|------|---------|
| Agent Portal exists | `/agent-portal` |
| Supplier Portal for hotel/transport/catering fulfillment | `/supplier-portal`, `/supplier` |
| Catering as bookable service | `CateringBooking` + APIs |
| Group + passenger records (manual/bulk JSON) | `/groups`, passengers |
| Staff ops boards (arrivals/departures/dispatch/meet-assist) | `/ops-control`, `/ops/*` |
| Ziyarah trips | `ZiyarahTrip` |
| Finance ledgers / invoices / receipts / P&L / BS | `/finance/*` |
| Agent prepaid wallet + payment slips | `/agent-finance/*` |
| Documents vault + upload confirm | `/documents`, `/uploads` |
| OCR pipeline for documents + staff review | `/ocr` |
| Notification infrastructure (WA/Email/In-App + WS auth) | `/notifications` |
| Automation rules engine + queues | `/automation` |
| Role/permission RBAC | seeded roles/permissions |
| Dashboards aggregate layer | `/dashboards/*` |
| Mutamer has no login | No customer role/portal |

---

## 6. Partially Implemented

| Business need | What exists | Gap vs business |
|---------------|-------------|-----------------|
| Mutamer Excel upload | Bulk JSON passengers | No Excel/CSV parser matching sample columns |
| Nusuk Group Number | `Group.code`, `VisaRequest.nusukRef` | No Main EA code `1004492`; no Groups List twin |
| OCR intake | Passport OCR → passenger | Not OCR group image → create group |
| Hotel Makkah+Madinah | Multiple bookings + hotel city | No paired dual columns; no agreement no.; status ≠ WAITING/APPROVED |
| Transport schedule/voucher | Bookings, dispatch, PDF voucher | Not Excel schedule/form; voucher not bilingual Word/Excel layout |
| BRN | `BRN` + ops | No inventory sold / price / used pax formulas |
| Long Stay | `LongStay` CRUD/ops | No Iqama/host WhatsApp/relation/Absher; no day-85 |
| Visa products | UMRAH + LONG_STAY | No HAJJ dropdown value |
| Umrah Co suppliers | Generic suppliers | Not dedicated visa-company master list from Word |
| Group readiness gates | Passenger/service statuses | No VISA/PACKAGE/PAYMENT/BILL checkboxes |
| WhatsApp updates | Event matrix | Not “every update” |
| Finance reports/dashboard | AR/AP/P&L/agent dash | Not Word’s exact report set / due cards / LS red marks |
| Agent=staff same process | Both can use portals/APIs with RBAC | Not proven Excel-column parity / shared Nusuk number lock |
| Sub EA | Weak reference fields | No hierarchy |
| Payment source bank/cash/mobile | Wallet/GL abstractions | Not Word’s supplier pay source selector as specified |

---

## 7. Incorrect Workflow

| Business workflow | ERP workflow | Mismatch |
|-------------------|--------------|----------|
| OCR scan Nusuk Groups List → create Group Number | OCR optional `groupId`; approve passport → **Passenger** | Entry object wrong |
| Website: agent login only; hide staff | Login exposes **Agent / Supplier / Admin** tabs | Contradicts Word |
| Hotel STATUS WAITING→APPROVED | ServiceRequestStatus REQUESTED→…→COMPLETED | Different state language/meaning |
| Group checkbox finance gates | Auto wallet deduct on supplier accept; auto invoice on complete | Different control points |
| Mutamer Excel columns (MOFA, biometric, Sub EA, B2B type) | Passenger DTO: name/passport/nationality/gender/dob/phone/seat + status flags | Column contract differs |
| Long Stay host-centric 90-day product | LongStay = hotel stay nights/renewal on group | Different entity focus |
| Credit only Agent/Host | Agent wallet + general GL; no Host party | Host missing |
| HAJJ/Umrah visa type dropdown | UMRAH/LONG_STAY only | Hajj missing |

---

## 8. Missing Features

| Missing vs business |
|---------------------|
| Excel `.xlsx` mutamer import matching sample sheet |
| Main External Agent Code / Sub EA entities |
| Group VISA/PACKAGE/PAYMENT/BILL booleans |
| Hotel agreement number field + WAITING FOR APPROVAL status |
| BRN sold inventory (price×days×pax, used pax) |
| MOFA Processing Account bill sheet |
| Passenger MOFA number, biometric status, mutamer type |
| Long Stay: relation, host name/Iqama/DOB/mobiles, Absher |
| Day-85 Long Stay multi-channel reminder + dashboard red card |
| HAJJ visa type |
| Dedicated Umrah Company supplier category/master as Word lists |
| HR employee master + payroll |
| Website restriction: staff/admin login not shown |
| WhatsApp on **every** operational update |
| Named reports: agent-wise, supplier-wise, group code, D/M/Y packs as Word lists |
| Google-form equivalent transport request with Drive ticket/receipt links |
| Bilingual AR/EN transport voucher matching TUBA VOUCHER sheet |
| Host (service holder) as finance credit party |
| Mandatory Haji/reference WhatsApp on group create |
| Duplicate Group Number prevention keyed to Nusuk number |

---

## 9. Duplicate Functionality

| Duplication | Where |
|-------------|-------|
| Flight / arrival concepts | `FlightInfo` + transport booking dates + dispatch + dashboard boards |
| Hotel stay concepts | `HotelBooking` + `LongStay` (extended stay) + voucher payload |
| Notification catalogs | Seed `NotificationEvent` keys vs automation domain `EV.*` string events vs shared template keys — overlapping but not identical sets |
| Group progress | `Group.currentStage` / WorkflowStage catalog vs service request statuses vs opsStatus — parallel progress models |
| Finance views | Staff `/finance` vs agent `/agent-finance` vs finance dashboard (intentional split; still multiple money UIs) |
| Spec/demo UIs | Live Ops/Finance vs ComingSoon WorkflowMap/MobileApps that also narrate MOFA/visa stories |

---

## 10. Dead Features

*(Present in UI/schema/seed but no meaningful backend or business use path.)*

| Item | Evidence |
|------|----------|
| OpsDepartments **HR** desk | EmptyState; no API |
| OpsDepartments **CRM** desk | EmptyState; no API |
| OpsDepartments **Procurement** desk | EmptyState; no API |
| `Enquiry` Prisma model | No controller/module usage found |
| `API_KEY_ACCESS` permission | Seeded; not route-enforced |
| ComingSoon `/mobile-apps`, `/tablet`, `/design-system`, `/i18n-system` | Routes render placeholders / demos |
| `DRIVER` role | Seeded; no driver portal app |
| Marketing claims of live NUSUK/MOFA API on Home/Login | Not backed by integration modules |

---

## 11. Hidden Features

*(Implemented capability not surfaced as the business Excel workflow.)*

| Feature | Hidden relative to business Excel |
|---------|-------------------------------------|
| Double-entry GL + chart of accounts | Excel uses checkboxes + bill sheet |
| Idempotent wallet auto-deduct on supplier accept | Not in Excel language |
| Auto-invoice + PDF on service COMPLETED | Not MOFA bill sheet |
| Document vault versioning + expiry automation | Excel uses Drive links |
| Fleet GPS/fuel/maintenance/insurance | Outside full-data.xlsx sheets |
| Meet & Assist 7-step checklist | Not in Excel |
| Audit log read API/UI | Not in Word/Excel |
| OCR reprocess + validation.lastError | Not in business docs |
| Socket.io live ops + notify | Beyond WhatsApp-only business wording |
| Additional services (wheelchair, VIP, SIM, …) | Not in Word supplier list |
| Season + WorkflowStage catalog (19 stages) | Excel uses checkbox/hotel status instead |
| Guarantor capture on agent registration | Not in discovery Excel |

---

## 12. Unused APIs

*(APIs with no corresponding business Excel/Word process, or permissions unused.)*

| API area | Cross-match note |
|----------|------------------|
| `/fleet/*`, `/vehicles/*` | No fleet sheet in business full data |
| `/audit-logs` | Not requested in Word report list |
| `/metrics` | Ops/infra only |
| Additional service endpoints under `/services` | Not in Word four-supplier model |
| `/automation` admin CRUD | Business asks WhatsApp updates, not rule UI |
| Enquiry — **no API** despite model | Model unused |
| `API_KEY_ACCESS` gated routes | None found |

---

## 13. Unused Database Tables

*(Models with no business SoT sheet/process, or no application module.)*

| Model | Note |
|-------|------|
| `Enquiry` | No API module |
| `VehicleLocation` / much of fleet graph | Outside business Excel |
| `FuelLog`, `MaintenanceRecord`, `InsurancePolicy` | Outside business Excel |
| `AgentSeasonQuota` | Not in Word/Excel discovery |
| `WorkflowStage` | Catalog exists; full stage machine incomplete vs Excel gates |
| `CurrencyRate` | Word does not define multi-currency rules (Excel mostly SAR) |
| `Statement` | Partial overlap with “statement” language; not Word’s report list verbatim |

---

## 14. Unused Screens

| Screen | Note vs business |
|--------|------------------|
| `/fleet-erp` | Not in Word module list / Excel |
| `/workflow-map` | ComingSoon / spec |
| `/mobile-apps`, `/tablet` | ComingSoon / demos |
| `/design-system`, `/i18n-system` | ComingSoon |
| OpsDepartments HR/CRM/Procurement | Visible tabs, empty |
| Super Admin deep placeholders | Partial screens not in Excel ops |

---

## 15. Unused Permissions

| Permission | Reality |
|------------|---------|
| `API_KEY_ACCESS` | Seeded, unused in guards |
| `MANAGE_FLEET` | Used by fleet; **unused by business SoT** (no fleet module in Word/Excel) |
| Granular desk permissions for Visa/Hotel/Transport/Catering | Not separate keys — ops uses `VIEW_DASHBOARD` broadly |

---

## 16. Unused Events

| Event / action | Note |
|----------------|------|
| Seed keys like `SUPPORT_TICKET_OPENED`, `CONTRACT_SIGNED`, `SYSTEM_ALERT`, `DAILY_BACKUP_COMPLETED` | Little/no business SoT twin |
| Automation `GENERATE_QR` | Implementation exists; not in Word/Excel |
| `document.expiring` | Fleet/compliance oriented; not day-85 Long Stay |
| Domain `group.import.completed` | Import path partial (JSON bulk, not Excel) |
| **Missing events vs business:** day-85 long stay, every status checkbox flip, MOFA bill approved, hotel WAITING→APPROVED | Absent |

---

## 17. Unused Notifications

| Notification | Note |
|--------------|------|
| Templates mentioning MOFA approval | Copy exists; no MOFA number field/process in Passenger |
| Full seed event matrix | Broader than Word’s “every update” + day-85 |
| **Business-required but absent:** day-85 host/agent/Tuba red-card pack; WhatsApp on arbitrary Excel field change | Missing |

---

## 18. Excel Workflow Mapping

### Sample mutamer Excel (`data`)

| Excel need | Screen | API | DB | Notification | Report | Permission |
|------------|--------|-----|----|--------------|--------|------------|
| Upload mutamers into group | Agent Portal Groups / staff groups UI | `POST /groups/:id/passengers/bulk` (JSON) | `Passenger` | `passenger.ocr.completed` (OCR path only) | — | Agent JWT / staff |
| Mutamer name/age/passport/nationality | Passenger forms | passengers CRUD | `Passenger` | — | — | tenancy |
| Main/Sub EA codes & names | — | — | **no fields** | — | — | — |
| Visa Status / Biometric / Visa No / MOFA No / Type B2B | Partial visaStatus only | — | **missing columns** | VISA_* events (different) | — | — |

### GROUP DETAILS 1448 / OLD

| Excel need | Screen | API | DB | Notification | Report | Permission |
|------------|--------|-----|----|--------------|--------|------------|
| Umrah Co | Companies/supplier | companies/services | `Company` SUPPLIER (generic) | — | — | APPROVE_COMPANIES / services |
| VISA/PACKAGE/PAYMENT/BILL | — | — | **missing** | — | — | — |
| Group Code/Name/Pax/flights/duration | Ops Group Master / Agent groups | `/groups`, `/ops/groups` | `Group`, `FlightInfo` | `group.created` | dashboards ops | VIEW_DASHBOARD / agent |
| Hotel Makkah/Madinah + agreement + STATUS | Agent services / ops hotel desk | `/services/hotel` | `HotelBooking` (**no agreementNo**; status≠WAITING) | `booking.confirmed` / HOTEL_* | — | services RBAC |
| Uploaded By AGENCY/staff | audit-ish | — | weak (`created` actors) | — | — | — |

### TRANSPORT SCHEDULE + Form responses

| Excel need | Screen | API | DB | Notification | Report | Permission |
|------------|--------|-----|----|--------------|--------|------------|
| Transport request | Agent services | `POST /services/transport` | `TransportBooking` | service/booking events | — | agent/staff |
| Schedule legs / vehicle / BILL flag | Ops dispatch / transport desk | `/ops/dispatches`, transport booking | `DispatchOrder`, `TransportBooking` | ops WS | dispatch dashboard | VIEW_DASHBOARD |
| Ticket/receipt Drive links | — | — | **missing** | — | — | — |

### TUBA VOUCHER

| Excel need | Screen | API | DB | Notification | Report | Permission |
|------------|--------|-----|----|--------------|--------|------------|
| Issue bilingual voucher | Services/voucher flows | voucher generate / `/vouchers` | `Voucher` | `voucher.generated` | — | services |
| Muallim mobile, supervisors, 24h ops phones | — | — | **not as Excel fields** | — | — | — |

### LONG STAY DETAILS

| Excel need | Screen | API | DB | Notification | Report | Permission |
|------------|--------|-----|----|--------------|--------|------------|
| Track long stay rows | Ops Long Stay | `/ops/long-stays` | `LongStay` | `longstay.changed` WS | — | VIEW_DASHBOARD |
| Iqama/Absher/host WhatsApp/day-85 | — | — | **missing** | **missing** | **missing** | — |

### additional BRN SOLD

| Excel need | Screen | API | DB | Notification | Report | Permission |
|------------|--------|-----|----|--------------|--------|------------|
| BRN inventory pricing | Ops BRN | `/ops/brns` | `BRN` (**no price/used pax**) | `brn.changed` WS | — | VIEW_DASHBOARD |

### BILL SHEET (MOFA)

| Excel need | Screen | API | DB | Notification | Report | Permission |
|------------|--------|-----|----|--------------|--------|------------|
| MOFA Qty×Rate bill + approval sign | Finance invoices (different) | `/finance/invoices` | `Invoice` (**not MOFA account**) | `invoice.generated` | finance reports | FINANCIAL_REPORTS |

---

## 19. Business Rule Mapping

| Business rule | ERP reality |
|---------------|-------------|
| One shared Group Number; no duplicates | Unique `Group.code` internally; **not** Nusuk-number shared lock with agents’ Nusuk UI |
| Staff and Agent same create/upload process | Both can call group/passenger APIs subject to tenancy/RBAC |
| Agent mandatory on Phase-2 bookings | `tenantId` on bookings |
| Day-85 Long Stay alerts | **Absent** |
| Host WhatsApp mandatory | **Absent** |
| Haji/reference WhatsApp mandatory | **Absent** as group field |
| Credit only Agent/Host | Agent wallet yes; **Host no** |
| Supplier pay source bank/cash/mobile | **Not modeled as Word** |
| MOFA bill ≠ hotel/transport cash | **Not modeled** |
| BRN total = price×days×pax | **Absent** |
| Duration = depart−arrive | Computable from dates; Excel formula not stored |
| Hotel WAITING→APPROVED | **Different** status enum |
| Website hide staff login | **Violated** (Admin tab present) |
| WhatsApp every update | **Not universal** |
| Mutamer no portal | **Holds** |
| HAJJ/Umrah dropdown | **HAJJ missing** |

---

## 20. OCR Mapping

| Business OCR | ERP OCR |
|--------------|---------|
| Upload Nusuk Groups List image → OCR → create Group Number | Upload document → `OcrDocument` job (`tuba-ocr`) → review → passport approve can **create Passenger** |
| Then Excel into group | Bulk passengers JSON after group exists |
| | Reprocess endpoint exists (staff) |
| | No “group list image → Group” path |

**Classification:** Partial + wrong primary workflow object (passenger vs group).

---

## 21. Finance Mapping

| Business finance | ERP finance |
|------------------|-------------|
| Debit/credit accuracy | Double-entry GL + wallet ledgers |
| Income from Agent/Host | Agent wallet top-up / invoices; **no Host** |
| Supplier pay + source selector | Supplier sub-ledger / AP; source selector ≠ Word |
| PAYMENT/BILL group checkboxes | **Absent** |
| MOFA Processing Account bill | **Absent** (generic Invoice instead) |
| Due from agent dashboard | AR aging + agent dashboard outstanding invoices |
| D/M/Y income-expense reports | P&L/BS + monthly dashboard series; **not** Word’s named pack |
| HR salaries in company books | Chart seed may include salary expense; **no payroll module** |

---

## 22. Voucher Mapping

| Business voucher | ERP voucher |
|------------------|-------------|
| Bilingual TRANSPORT VOUCHER sheet | PDF generator; English-oriented labels |
| Hotels + nights + rooms + agreement | Payload/PDF from booking; agreement no. weak/absent |
| Transport co, vehicle, booking no., pax | Partially from transport booking / voucher type |
| Arrival/departure + internal movements grid | Not full Excel movement table |
| Supervisors / 24h ops phones | **Absent** |
| `voucher.generated` + send timestamps | Present on model |

---

## 23. Hotel Mapping

| Business hotel | ERP hotel |
|----------------|-----------|
| Makkah block + Madinah block per group | N hotel bookings; city on `Hotel` |
| Agreement No. | **Missing field** |
| STATUS WAITING/APPROVED | ServiceRequestStatus machine |
| BRN sold inventory feeds agreements | BRN ops entity without inventory economics |
| Cash stay vs MOFA bill split | **Absent** |

---

## 24. Transport Mapping

| Business transport | ERP transport |
|--------------------|---------------|
| Form responses request | `TransportBooking` DTO/API |
| TRANSPORT SCHEDULE board | Dispatch + bookings + boards |
| Vehicle types BUS/STARIA/… | Vehicle type fields exist (fleet/booking) |
| FULL vs SINGLE transport | Not as Excel enums; freeform/structured differently |
| BILL / TRANSPORTATION flags | Different billing model |
| Ziyarah legs | `ZiyarahTrip` + voucher movements partial |
| Drive ticket/receipt links | **Absent** |

---

## 25. Long Stay Mapping

| Business Long Stay | ERP Long Stay |
|--------------------|---------------|
| Visa type Long Stay | `VisaType.LONG_STAY` + `VisaRequest` |
| Host/Iqama/relation/WhatsApp | **Absent** |
| Per-mutamer LONG STAY DETAILS sheet | `LongStay` is group hotel-stay oriented, not mutamer/host sheet |
| Duration formula | nights/check-in/out fields |
| Absher flag | **Absent** |
| Day-85 WA+email+dashboard red | **Absent** |
| Ops UI/API | `/ops/long-stays` present |

---

## 26. Supplier Mapping

| Business supplier type | ERP |
|------------------------|-----|
| Visa Umrah Company | No dedicated type; can be `SUPPLIER` without visa specialization |
| Hotels | `Hotel` + supplier companies + HotelBooking.supplierId |
| Catering | CateringBooking.supplierId |
| Transport | TransportBooking.supplierId + fleet supplierId |
| Dropdown masters named in Word | Seed/demo data ≠ enforced Word list |
| Supplier portal | Implemented for assigned bookings |
| Supplier-wise reports | Ledgers/AP/dashboard supplier view — partial vs Word report list |

---

## 27. Customer Mapping

| Business Mutamer | ERP Passenger |
|------------------|---------------|
| No portal | Correct |
| Managed by Agent/Staff | Correct |
| Excel column contract | **Not matched** |
| Sub EA / Main EA | **Missing** |
| Biometric / MOFA / Visa Number / Type | **Missing** (visaStatus only) |
| Age field | Not first-class (DOB exists) |
| Long Stay mutamer rows tied to host Iqama | **Missing** |

---

## 28. Website Mapping

| Business website rule | ERP website |
|-----------------------|-------------|
| Information only | Marketing pages exist |
| No public booking | No public booking flow |
| Agent login option shown | `/login` linked; default tab Agent |
| Staff/Super Admin login **not** shown | **Admin tab visible** on Login |
| Supplier login on public site | **Supplier tab visible** (business Word emphasized agent-only) |
| Hajj/Umrah redesign intent | Marketing content present; not evaluated as design quality here |

**Classification:** Incorrect vs Word rule on login visibility.

---

## 29. Overall Cross Match Score

Score reflects **business fidelity of the existing ERP**, not code quality or production health.

| Dimension | Weight | Score (0–100) | Rationale |
|-----------|------:|-------------:|-----------|
| Core parties & portals (agent/supplier/staff, no customer portal) | 15 | 75 | Portals exist; tenancy model differs; website login wrong |
| Group / Mutamer / Nusuk / Excel intake | 20 | 35 | Groups/passengers exist; Excel/Nusuk/OCR path mismatch |
| Hotel / Transport / Catering / Voucher / BRN | 20 | 45 | Services exist; Excel layouts, BRN inventory, bilingual voucher, approvals differ |
| Long Stay business rules | 10 | 25 | Entity exists; host/day-85/Absher missing |
| Finance & MOFA & dues/reports | 15 | 40 | Strong GL/wallet; Word gates/MOFA bill/Host credit missing |
| Notifications & dashboards | 10 | 40 | Infra strong; every-update + day-85 + red cards missing |
| HR/Payroll | 5 | 5 | UI stub only |
| Website rule compliance | 5 | 20 | Admin/Supplier tabs contradict agent-only |

### **Overall: 42 / 100**

Interpretation: The ERP is a **substantial parallel operations platform**, but large parts of the **real Excel/Word business contract** (Nusuk group intake, mutamer columns, checkbox gates, BRN inventory, MOFA bills, Long Stay day-85, HR, website login rule) are **not** what the software implements today.

---

## 30. Executive Summary

Business discovery defines Tuba Al Hijaz as a **single operating company** running Bangladesh-agent Umrah/Hajj/Long-Stay ground ops from **Nusuk Group Numbers**, **mutamer Excel**, **dual-city hotels with agreement/BRN inventory**, **transport schedules/vouchers**, **MOFA billing**, **WhatsApp updates**, and **day-85 Long Stay alerts**, with **HR/payroll** and an **agent-only public login**.

The existing ERP implements a **broad modern stack**: agent/supplier portals, groups/passengers, service bookings (including catering), ops boards, PDF vouchers, BRN ops records, long-stay tracking shell, finance GL/wallet, OCR review, automation/notifications, and dashboards.

Cross-match reality: **portals, catering, core bookings, finance engine, OCR infrastructure, and “no customer portal” align**. **Intake (OCR→group, Excel columns), group readiness checkboxes, hotel approval language, BRN economics, bilingual voucher sheet, Long Stay host/day-85, MOFA bill, HAJJ type, Sub EA, HR/payroll, universal WhatsApp, and website login visibility do not.** Several ERP areas (fleet, ComingSoon apps, Enquiry model, API_KEY_ACCESS, HR/CRM/Procurement stubs) are **outside or ahead of** the business Excel/Word surface.

**Score: 42/100.** This document identifies reality only — no fixes, roadmap, or tickets.

---

### Classification tally (process-level, indicative)

| Class | Count (approx.) |
|-------|----------------:|
| Implemented correctly | 14 |
| Implemented but different | 12 |
| Partial | 18 |
| Missing | 20+ |
| Incorrect workflow | 8 |
| Dead / unused UI-table-permission | 12+ |
| Hidden (extra vs Excel) | 10+ |

---

*End of BUSINESS_CROSS_MATCH.md — Phase 2 reality match only.*
