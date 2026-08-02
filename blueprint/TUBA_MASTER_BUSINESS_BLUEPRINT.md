# TUBA AL HIJAZ — Master Business Blueprint

**Status:** Official Business Source of Truth  
**Authority:** This document defines how Tuba Al Hijaz **must** operate.  
**Date:** 2026-08-01  

Derived from business discovery (Word + Excel), cross-match evidence, and transformation decisions — restated here as **pure operating law**. This blueprint does not prescribe software construction steps.

---

## 1. Vision

Tuba Al Hijaz is a **Saudi ground-handling company** for **Hajj, Umrah, and Long Stay** travellers originating primarily through **Bangladesh agents**.

The company must run one integrated operation where:

- A **Group Number** (from Nusuk / Tuba intake) is the spine of all work.  
- **Mutamers** (customers) are managed only by Agents or Tuba Staff — never through a customer portal.  
- **Visa (Umrah companies), Hotels, Transport, and Catering** are fulfilled against that Group Number.  
- **Finance** records credits from Agents/Hosts and debits to suppliers with clear payment sources.  
- **WhatsApp (and email/dashboard where required)** keep Agent and Tuba Admin aligned.  
- Spreadsheets cease to be the system of record; the company ERP embodies these same boards and rules.

---

## 2. Business Principles

1. **One company** — The ERP belongs to Tuba Al Hijaz alone.  
2. **Agents are customers of Tuba** — not peer software tenants.  
3. **Suppliers are counterparties** — Umrah Co, Hotel, Transport, Catering.  
4. **Mutamer has no login** — ever.  
5. **Group Number is unique and shared** — Staff and Agent see the same data; duplicates are forbidden.  
6. **Every service booking requires Group Number + Agent**.  
7. **Material updates notify Agent and Tuba Admin** (WhatsApp as primary channel).  
8. **Long Stay day-85 is mandatory compliance alerting**.  
9. **Credit income only from Agent or Host (service holder)**.  
10. **Supplier payments are debits** with explicit source: bank / cash / mobile banking.  
11. **MOFA processing bills are separate** from cash hotel/transport deals.  
12. **Public website is information + Agent entry only** — no public booking; Staff login not marketed.  
13. **Hajj, Umrah, and Long Stay** are first-class visa products.  
14. **Arabic/English operational documents** (especially vouchers) where the business requires bilingual forms.  
15. **HR and Payroll** are part of company operations, not optional extras.

---

## 3. Company Structure

| Party | Definition |
|-------|------------|
| **Tuba Al Hijaz** | Operating company; owns staff, ops, finance, vouchers, dashboards, HR |
| **Bangladesh Agent** | External travel agency; customer of Tuba; brings Mutamers/groups |
| **Sub External Agent (Sub EA)** | Sub-code/name under the agent hierarchy on mutamer lists |
| **Main External Agent Code** | Nusuk-side code representing Tuba’s company identity (e.g. sample `1004492`) |
| **Umrah Company** | Saudi visa/Umrah service supplier |
| **Hotel Supplier** | Saudi hotel / hotel company |
| **Transport Supplier** | Transport company (including “Own Transport” when used) |
| **Catering Supplier** | Catering company (e.g. Tuba Al-Hijaz Catering) |
| **Mutamer** | Pilgrim / traveller / customer |
| **Host / Service Holder** | Saudi Iqama holder sponsoring Long Stay relatives |

---

## 4. Departments

| Department | Mandate |
|------------|---------|
| Super Admin / Platform | Users, roles, company masters, system settings |
| Operations / Group Control | Group master, flights, readiness gates |
| Visa Desk | Umrah Co coordination, visa/biometric/MOFA progress |
| Hotel Desk | Makkah & Madinah bookings, agreements, approvals |
| Transport Desk | Requests, schedule, vehicles, vouchers, ziyarah moves |
| Catering Desk | Meal services by group |
| BRN / Agreements | Hotel agreement inventory sold and used |
| Finance / Accounts | Credits, debits, MOFA bills, dues, statements |
| OCR / Document Intake | Nusuk group images, passports, attachments |
| Notifications | WhatsApp/email/dashboard alerts |
| HR & Payroll | Employees and salaries |
| Agent Portal Ops | Agent self-service mirror of allowed staff processes |
| Supplier Coordination | Supplier masters and fulfilment |

---

## 5. Roles

| Role | Who | Authority |
|------|-----|-----------|
| **Super Admin** | Tuba | Full control |
| **Staff** | Tuba employees (ops, visa, hotel, transport, finance, OCR, etc.) | Departmental duties |
| **Bangladesh Agent** | External agency user | Groups, mutamers, service requests, own finance view, notifications |
| **Supplier** | Umrah Co / Hotel / Transport / Catering user | Fulfil assigned work only |
| **Mutamer** | Traveller | **No system role / no portal** |
| **Host** | Long Stay sponsor | **Not a login role**; data + notification recipient |

Staff and Agent may both create groups and upload mutamer lists; data remains one shared register.

---

## 6. Permission Philosophy

1. Access follows **role + department duty**, not marketing claims.  
2. Agents see **only their own** groups, mutamers, bookings, and dues.  
3. Suppliers see **only work assigned to them**.  
4. Staff see cross-agent operations per desk permission.  
5. Finance edit vs finance view are separated.  
6. OCR approve/reject is a controlled staff duty.  
7. Mutamers and Hosts never authenticate.  
8. Public site must not advertise Staff/Admin entry.  
9. Creating/changing Group Numbers is controlled to prevent duplicates.  
10. Approval actions (hotel status, MOFA bill sign-off, readiness gates) are attributable to a person.

---

## 7. Customer Lifecycle (Mutamer)

### Purpose
Register and track every traveller under a Group without giving them system access.

### Trigger
Bangladesh customer books with a Bangladesh Agent; Agent (or Tuba Staff) opens/uses a Group Number.

### Inputs
Mutamer Excel (or equivalent entry): name, age, passport, nationality, Main EA code/name, Sub EA code/name, visa status, biometric status, visa number, MOFA number, mutamer type (e.g. B2B).

### Processing
1. Ensure Group Number exists and is unique.  
2. Upload/enter mutamer rows into that group.  
3. Update biometric → visa issued → visa/MOFA numbers as processing advances.  
4. Count mutamers toward hotel/transport/catering/finance.  
5. For Long Stay, link mutamer to Host Iqama/WhatsApp.

### Approvals
Visa issuance and MOFA numbering are external/process approvals reflected as status fields; Staff/Umrah Co update statuses.

### Notifications
Material visa status changes notify Agent and Tuba Admin.

### Outputs
Group mutamer register; inputs to visa, hotel pax, transport pax, bills, Long Stay tracking.

### Business Rules
- No mutamer login.  
- Passport identity is primary.  
- Sub EA sits under Main EA.  
- Same Group Number for all mutamers in the cohort.

### Exceptions
Duplicate passport in group must be flagged; incomplete biometric/visa fields allowed while in progress but visible on dashboards.

---

## 8. Group Lifecycle

### Purpose
Create and operate a single Group Number from intake through archive.

### Trigger
Agent obtains Nusuk Group Number / requests Tuba to create from OCR image; or Staff creates from scan.

### Inputs
Nusuk group image or list fields; Group Number; Group Name; Consulate (e.g. Dhaka); Package Type; Mutamer count; Arrival Date; Created By; Services Value; Main External Agent Code; Visa type (Hajj/Umrah/Long Stay); Haji/reference WhatsApp (mandatory for Hajj/Umrah); Umrah Co; Agent name.

### Processing
1. OCR/intake → create Group Number (no duplicates).  
2. Open group → upload mutamer Excel.  
3. Maintain readiness: **VISA / PACKAGE / PAYMENT / BILL** checkboxes.  
4. Capture flights; compute **Duration = Departure − Arrival**.  
5. Book hotel/transport/catering against Group + Agent.  
6. Issue vouchers; run finance; complete stay; archive by season.

### Approvals
Hotel city statuses; MOFA bill approval; readiness gates flipped by authorized Staff/Agent as policy allows.

### Notifications
Material updates to Agent + Admin (WhatsApp).

### Outputs
Group master board row; linked services; vouchers; bills; dashboard process state.

### Business Rules
- One shared dataset for Staff and Agent.  
- All Phase-2 services require Group Number + Agent.  
- Uploaded By recorded (AGENCY or staff identity).

### Exceptions
Group may exist before flights/hotels complete; Long Stay uses same spine with extra host fields.

---

## 9. Long Stay Lifecycle

### Purpose
Operate ~90-day Long Stay (استضافة) for relatives of a Saudi service holder, with compliance reminders.

### Trigger
Agent/Staff select Visa type Long Stay and create/open Group Number.

### Inputs
Relation (Husband/Wife/Relatives); Host name, Iqama, DOB, mobile, **Host WhatsApp (mandatory)**; Agency; No. of Pax; Umrah Co; Entry/Exit dates and flights; Mutamer Excel rows; Absher flag; remarks; package status.

### Processing
1. Register group + mutamers.  
2. Track stay duration (Exit − Entry).  
3. Maintain Absher and package/remark fields.  
4. At **day 85 of 90**, fire compliance pack.  
5. Complete/exit and close.

### Approvals
Umrah Co / visa process; Absher completion tracked as boolean.

### Notifications (Day-85 — mandatory)
With customer details to: Host WhatsApp, responsible Agent WhatsApp, Tuba official WhatsApp, Email; **red cards** on Agent and Tuba dashboards.

### Outputs
Long Stay register; alerts; link to flights/hotels as applicable.

### Business Rules
- Normal duration 90 days.  
- Host WhatsApp mandatory.  
- Day-85 cannot be skipped.  
- Host is not a login user.

### Exceptions
Missing exit dates show incomplete duration; remarks may mark “NEED UPDATE”.

---

## 10. Visa Lifecycle

### Purpose
Progress Mutamers/groups through biometric and visa issuance via Saudi Umrah Companies.

### Trigger
Group created with Visa type Hajj / Umrah / Long Stay; Umrah Co selected.

### Inputs
Visa type; Umrah Co; mutamer biometric/visa/MOFA fields; Nusuk references as applicable.

### Processing
1. Assign Umrah Co.  
2. Track biometric status (e.g. Registered).  
3. Track visa status (e.g. Visa Not Issued → Issued).  
4. Capture Visa Number and MOFA Number when available.  
5. Flip group **VISA** readiness when business considers visa work done.

### Approvals
External Saudi/Umrah process; Staff update statuses in Tuba register.

### Notifications
Visa material status changes → Agent + Admin.

### Outputs
Updated mutamer visa fields; group VISA gate; inputs to MOFA billing.

### Business Rules
- Hajj, Umrah, Long Stay all valid types.  
- Umrah Co from approved supplier master.  
- MOFA processing money uses MOFA bill (not hotel cash deal).

### Exceptions
Partial group visa completion allowed; dashboards show pending.

---

## 11. Hotel Lifecycle

### Purpose
Book and approve Makkah and Madinah stays per Group.

### Trigger
Phase-2 service need on an existing Group + Agent.

### Inputs
Hotel Makkah: name, Agreement No., check-in, check-out, pax, STATUS.  
Hotel Madinah: same.  
BRN/agreement inventory availability.

### Processing
1. Select hotels against Group.  
2. Link Agreement/BRN numbers.  
3. Set STATUS **WAITING FOR APPROVAL** then **APPROVED** (per city).  
4. Feed voucher hotel blocks and transport schedule hotel names.  
5. Consume BRN used pax.

### Approvals
Hotel STATUS change to APPROVED by authorized Staff (or defined approver).

### Notifications
Approval/waiting changes → Agent + Admin.

### Outputs
Approved hotel plan; voucher section; BRN usage; cash commercial understanding vs MOFA bill.

### Business Rules
- Dual-city blocks when itinerary requires both.  
- Agreement No. required when BRN-linked.  
- Stay commercial may be cash-as-discussed, separate from MOFA bill.

### Exceptions
Madinah-only or Makkah-only itineraries; pax on hotel block may differ slightly from group pax with visibility.

---

## 12. Transport Lifecycle

### Purpose
Request, schedule, and execute ground moves (airport, hotel, ziyarah).

### Trigger
Agent/Staff submit transport request for a Group; Ops schedules legs.

### Inputs
Group Name/Number; pax; vehicle type (BUS, STARIA, HIACE, CAR, SUV, COASTER, …); transport type (SINGLE AIRPORT–HOTEL vs FULL); route; airports; flights/times; contact; ticket copies; payment receipt; Makkah/Madinah hotels; ziyarah dates; transport company (or Own Transport).

### Processing
1. Capture request.  
2. Build schedule legs (from→to, date/time, flight, vehicle, BILL mark, done flag).  
3. Assign transport company / operation number.  
4. Issue Transport Voucher with movements.  
5. Execute and mark complete.

### Approvals
Ops confirmation of schedule; BILL acknowledgment as finance/ops practice.

### Notifications
Assignment/schedule material changes → Agent + Admin.

### Outputs
Transport schedule rows; voucher; dispatch readiness.

### Business Rules
- Must reference Group Number + Agent.  
- Routes include JED/MED airports, MAK/MED hotels, ziyarah.  
- Own Transport is allowed.

### Exceptions
Split tickets; second hotel/route segment on complex itineraries.

---

## 13. Catering Lifecycle

### Purpose
Provide catering for a Group when required.

### Trigger
Phase-2 catering need on Group + Agent.

### Inputs
Group Number; Agent; Catering supplier; meal plan / dietary needs; dates; pax.

### Processing
1. Create catering booking against Group.  
2. Assign catering supplier.  
3. Confirm fulfilment.  
4. Include in finance as applicable.

### Approvals
Supplier/ops confirmation.

### Notifications
Material catering status → Agent + Admin.

### Outputs
Catering assignment; commercial charge if priced.

### Business Rules
- Catering is a first-class Phase-2 service.  
- Supplier from catering master (e.g. Tuba Al-Hijaz Catering + additions).

### Exceptions
Groups with no catering simply skip this lifecycle.

---

## 14. Supplier Lifecycle

### Purpose
Maintain and use four supplier classes.

### Trigger
Tuba adds supplier; Group selects Umrah Co; services assign hotel/transport/catering suppliers.

### Inputs
Supplier type; legal/commercial details; contacts; for Umrah Cos the named masters (Habash/Alhabash, Almautmirin, Arkan, …) plus extensible list; hotels; transport cos; catering.

### Processing
1. Master data create/update.  
2. Appear in dropdowns.  
3. Receive assignments.  
4. Confirm/reject work as process requires.  
5. Receive supplier payments (debit + source).

### Approvals
Tuba Staff approve supplier onboarding; service confirmations per desk.

### Notifications
Assignment/rejection/payment material events as configured.

### Outputs
Supplier master; assignments; payables; supplier-wise reports.

### Business Rules
- Exactly four types: Umrah Co, Hotel, Transport, Catering.  
- Extensible lists (add with details).  
- Payments are debits with bank/cash/mobile source.

### Exceptions
Own Transport; Tuba’s own hotel/catering brands as suppliers.

---

## 15. Finance Lifecycle

### Purpose
Keep accurate credits, debits, dues, MOFA bills, and management reports.

### Trigger
Group commercial activity; payment slips; MOFA processing; supplier payments; payroll.

### Inputs
Agent/Host payments; group PAYMENT/BILL gates; MOFA bill lines (Qty × Rate); supplier invoices/pay amounts; payment source; services value.

### Processing
1. Credit only from **Agent** or **Host**.  
2. Debit suppliers with **bank / cash / mobile banking** source.  
3. Raise **MOFA Processing Account** bills (separate from cash hotel/transport).  
4. Obtain Approval Sign + CR Date on MOFA bills.  
5. Maintain dues from agents.  
6. Produce daily/monthly/yearly income and expense views.  
7. Include HR payroll in company expense reality.

### Approvals
MOFA bill Approval Sign; payment confirmations by Finance Staff.

### Notifications
Payment received / bill issued / due-critical events → Agent + Admin as material updates.

### Outputs
Ledgers; bills; dues; reports; dashboard due widget.

### Business Rules
- Credit parties: Agent, Host only.  
- MOFA bill ≠ hotel/transport cash deal.  
- Group PAYMENT and BILL gates visible on group board.  
- Example commercial patterns (illustrative): MOFA rate × pax; transport line amounts in SAR.

### Exceptions
Negative/outstanding agent balances must remain visible as Due.

---

## 16. Voucher Lifecycle

### Purpose
Issue the bilingual operational Transport Voucher for a Group.

### Trigger
Hotels/transport sufficiently confirmed to authorize ground movement.

### Inputs
Agent name/country; Umrah Co; Group Code; Muallim mobile; Makkah/Madinah hotels (agreement, check-in/out, nights, rooms); transport company; vehicle type; booking/operation number; pax; arrival/departure flights; internal movements; supervisor mobiles; 24h ops numbers.

### Processing
1. Assemble voucher from group+hotel+transport data.  
2. Compute nights = check-out − check-in.  
3. List ordered internal movements (airport↔hotel, ziyarah, city transfer).  
4. Issue document; send to parties as process requires.

### Approvals
Ops/service confirmation before issue.

### Notifications
Voucher ready → Agent + Admin.

### Outputs
Official voucher document; archive copy.

### Business Rules
- Bilingual (Arabic/English) layout required.  
- Group Code mandatory.  
- Movements must match schedule intent.

### Exceptions
Partial itinerary vouchers if business allows staged issue.

---

## 17. BRN Lifecycle

### Purpose
Buy/allocate hotel agreement capacity and consume it against groups.

### Trigger
Tuba requests/buys BRN; group hotel assignment needs Agreement No.

### Inputs
Date requested; Umrah Co; Hotel; Agreement No.; check-in/out; pax; days; unit price; rooms; used pax.

### Processing
1. Record sold/available BRN.  
2. Compute **Total Price = Price × Days × Pax** (room variants when used).  
3. Allocate to group hotel agreement fields.  
4. Track used pax vs capacity.

### Approvals
Commercial approval to purchase/allocate BRN.

### Notifications
Material shortage/overuse alerts as configured.

### Outputs
BRN inventory; agreement numbers on group hotels; commercial totals.

### Business Rules
- Used pax must not silently exceed capacity.  
- Agreement numbers link inventory to group hotels.

### Exceptions
Side inventory blocks for partner hotels/periods.

---

## 18. OCR Lifecycle

### Purpose
Turn Nusuk group images (and identity documents) into structured group/mutamer data.

### Trigger
Staff/Agent uploads Nusuk Groups List image or passport/document image.

### Inputs
Image/scan; optional target Group.

### Processing
1. OCR extract fields.  
2. For group list: create/update **Group Number** and header fields.  
3. For passport: assist mutamer identity fields.  
4. Human review before final commit when confidence/rules require.  
5. Then allow Excel mutamer upload into the group.

### Approvals
Staff review/approve OCR results when required.

### Notifications
Group created / OCR completed → Agent + Admin as material events.

### Outputs
Group record; draft mutamer fields; audit of who approved.

### Business Rules
- Group-list OCR is a primary intake path.  
- No duplicate Group Number on commit.  
- Excel upload follows group open.

### Exceptions
Low-confidence OCR requires mandatory human correction.

---

## 19. Notification Lifecycle

### Purpose
Keep Agent, Tuba Admin, and (for Long Stay) Host informed.

### Trigger
Material operational updates; Day-85 Long Stay; voucher/payment/visa/hotel/transport events.

### Inputs
Event type; Group/Mutamer identifiers; recipient phones/emails; language preference (Bengali/English as applicable).

### Processing
1. Resolve recipients (Agent, Admin, Host).  
2. Send WhatsApp (primary); Email where required; Dashboard cards where required.  
3. Log delivery.

### Approvals
None for automated compliance (day-85); configuration owned by Tuba Admin.

### Notifications
N/A (this lifecycle is the notification itself).

### Outputs
Delivered messages; dashboard red cards; notification history.

### Business Rules
- Material updates → Agent + Admin via WhatsApp.  
- Day-85 → Host + Agent + Tuba WA + Email + red dashboard cards.  
- Haji/reference WhatsApp mandatory on Hajj/Umrah groups.  
- Host WhatsApp mandatory on Long Stay.

### Exceptions
Missing mandatory phone blocks completion of group/LS setup until provided.

---

## 20. Website Behaviour

| Rule | Behaviour |
|------|-----------|
| Purpose | Information about Tuba Hajj/Umrah business |
| Booking | **None** on public site |
| Login | **Agent entry** promoted |
| Staff/Admin login | **Not shown** on public marketing |
| Supplier login | Not marketed on home (operational entry may exist off-homepage if needed) |
| Content | Hajj/Umrah oriented company information |

---

## 21. Agent Portal Behaviour

Agents must be able to:

1. Work on **their** Group Numbers (shared truth with Staff).  
2. Create/request groups and upload **mutamer Excel**.  
3. Set/view visa type, WhatsApp, Umrah Co (as permitted).  
4. Request hotel/transport/catering by Group Number.  
5. See readiness gates and hotel statuses.  
6. View own dues/payments/slips.  
7. Receive WhatsApp and see dashboard cards (including Long Stay red marks).  
8. **Never** see other agents’ portfolios.

---

## 22. Supplier Portal Behaviour

Suppliers must:

1. See only assignments for their type (hotel/transport/catering; Umrah Co as applicable).  
2. Accept or reject assigned work with reason on reject.  
3. Upload fulfilment documents when required.  
4. Not see unrelated agents’ full books.  
5. Be payable via Finance debit + source.

---

## 23. Dashboard Behaviour

Dashboards must prioritize:

1. **Due from agent**  
2. **Group Numbers in working process** (readiness + services)  
3. **Long Stay red cards** (day-85 window)  
4. Hotel waiting approval counts  
5. Today’s transport / arrivals / departures  
6. Visa/biometric backlog indicators  
7. BRN utilization signals  

Agent dashboard shows agent-scoped dues and Long Stay red cards. Tuba Admin sees cross-agent operations.

---

## 24. Reports Behaviour

Mandatory report families:

1. Agent-wise  
2. Supplier-wise  
3. Group code dossier  
4. Income  
5. Expense  
6. Daily  
7. Monthly  
8. Yearly  

Also required operational reports: mutamer visa/MOFA status; BRN inventory; MOFA bills; transport schedule by date; payroll when HR active.

---

## 25. Approval Chain

```
Bangladesh Customer
  → Bangladesh Agent
    → Nusuk Group Number (Agent or Tuba via OCR)
      → Mutamer Excel upload (Agent or Staff)
        → Umrah Co / Visa & Biometric / MOFA
        → Hotel Makkah/Madinah (WAITING → APPROVED)
        → Transport request → Schedule → Voucher
        → Catering (if needed)
        → PAYMENT / BILL gates + MOFA Bill Approval Sign
        → Notifications (Agent + Admin; Host on Long Stay day-85)
        → Stay / Exit / Archive
```

Every approval flip must store **who** and **when**.

---

## 26. Business Rules

1. Unique Group Number; Staff and Agent share one record.  
2. Phase-2 services require Group Number + Agent name.  
3. Visa types: Hajj, Umrah, Long Stay.  
4. Mandatory Haji/reference WhatsApp on Hajj/Umrah groups.  
5. Mandatory Host WhatsApp on Long Stay.  
6. Readiness gates: VISA, PACKAGE, PAYMENT, BILL.  
7. Hotel STATUS: WAITING FOR APPROVAL | APPROVED (per city).  
8. Duration = Departure − Arrival; voucher nights = Checkout − Checkin.  
9. BRN Total = Price × Days × Pax (unless room-based variant applies).  
10. Long Stay normal length 90 days; alert at day 85.  
11. Credit only Agent or Host.  
12. Supplier pay is Debit with bank/cash/mobile source.  
13. MOFA bill is separate from cash hotel/transport.  
14. Mutamer has no portal.  
15. Public website: info + Agent login emphasis; no Staff marketing login.  
16. Four supplier types only (extensible instances).  
17. Own Transport allowed.  
18. Material updates notify Agent + Admin on WhatsApp.  
19. Day-85 notifies Host + Agent + Tuba (WA + email + red cards).  
20. Uploaded By captured (AGENCY vs staff).  
21. Main EA code represents Tuba Nusuk identity; Sub EA on mutamer rows.  
22. Bilingual transport voucher.  
23. Absher tracked for Long Stay.  
24. Used BRN pax cannot exceed capacity without explicit override visibility.  
25. Season archive separates live vs old groups.

---

## 27. Data Dictionary

| Business term | Meaning |
|---------------|---------|
| Mutamer | Customer / pilgrim |
| Group Number / Group Code | Nusuk group identifier |
| PAX | Passenger count |
| Main External Agent Code | Tuba company code in Nusuk |
| Sub EA | Sub-agent code/name |
| Umrah Co. | Visa supplier company |
| Agreement No. / BRN | Hotel contract reference |
| MOFA | Ministry of Foreign Affairs number / processing account |
| Absher | Saudi Absher completion flag |
| Iqama | Host residence identity |
| Host / Service Holder | Long Stay sponsor |
| VISA/PACKAGE/PAYMENT/BILL | Group readiness gates |
| WAITING FOR APPROVAL / APPROVED | Hotel status |
| Muallim | Guide contact on voucher |
| Ziyarah | Holy-site visit movement |
| Full vs Single Transport | Transport package scope |
| Operation number | Transport booking/ops id |
| Services Value | Commercial magnitude on group |
| Consulate | e.g. Dhaka |
| B2B Mutamer Type | Agency-channel mutamer |
| استضافة | Long-stay / hosting naming |

---

## 28. Excel Mapping

| Excel artefact | Must become in company operation |
|----------------|----------------------------------|
| Sample mutamer sheet | Official Mutamer upload contract |
| GROUP DETAILS (live/old) | Group Master Board |
| TUBA VOUCHER | Issued Transport Voucher |
| Form responses | Transport Request form |
| TRANSPORT SCHEDULE | Transport Schedule Board |
| LONG STAY DETAILS | Long Stay Register |
| additional BRN SOLD | BRN Inventory |
| BILL SHEET | MOFA Processing Bill |

Column meanings follow discovery dictionaries (mutamer 13 columns; group dual hotel blocks; BRN pricing; long stay host/Iqama; transport legs).

---

## 29. Screen Catalogue

*(Business workplaces — names are operational, not technical routes.)*

| Screen | Users | Purpose |
|--------|-------|---------|
| Public Website | Public | Company information |
| Agent Login Entry | Agent | Access Agent Portal |
| Staff Login Entry | Staff (unlisted) | Access staff workplaces |
| Agent Home / Dashboard | Agent | Dues, process, red cards |
| Group Master Board | Staff, Agent (scoped) | GROUP DETAILS operations |
| Group Create / OCR Intake | Staff, Agent | Create Group Number |
| Mutamer Upload | Staff, Agent | Excel/list into group |
| Visa Desk Board | Visa Staff | Biometric/visa/MOFA |
| Hotel Desk Board | Hotel Staff | Dual city + approval |
| Transport Request | Agent, Staff | Form capture |
| Transport Schedule Board | Transport/Ops | Daily legs |
| Catering Desk | Catering/Ops | Catering by group |
| Voucher Issue / Preview | Ops | Bilingual voucher |
| BRN Inventory | Ops/Finance | Agreements sold/used |
| Long Stay Register | Ops, Agent (scoped) | Host/mutamer/day-85 |
| Finance Desk | Finance | Credits/debits/dues |
| MOFA Bill | Finance | Qty×Rate bills |
| Agent Finance | Agent | Own wallet/dues/slips |
| Supplier Workbench | Supplier | Assignments accept/reject |
| OCR Review | OCR Staff | Confirm extractions |
| Notification Center | Admin | Templates/matrix |
| Reports Hub | Staff (permitted) | Mandatory reports |
| HR & Payroll | HR/Admin | Employees/salaries |
| User & Supplier Masters | Super Admin/Staff | Masters and access |
| Audit Viewer | Super Admin/Finance as permitted | Who approved what |

---

## 30. API Catalogue

*(Business system operations the ERP must allow — capability list, not technology.)*

| Operation family | Must support |
|------------------|--------------|
| Identity | Login for Agent, Staff, Supplier; no Mutamer/Host login |
| Groups | Create/read/update; uniqueness on Group Number; readiness gates; WhatsApp; Umrah Co; flights |
| OCR | Submit group image; submit passport; review approve/reject; commit Group/Mutamer fields |
| Mutamers | Upload Excel contract; CRUD; visa/biometric/MOFA/Sub EA fields |
| Visa | Track type Hajj/Umrah/Long Stay; link Umrah Co |
| Hotels | Dual city bookings; agreement no.; WAITING/APPROVED |
| Transport | Request; schedule legs; attach tickets/receipts |
| Catering | Book/confirm by group |
| BRN | Inventory CRUD; allocate; used pax; totals |
| Voucher | Generate bilingual voucher; send/record |
| Long Stay | Host fields; Absher; day-85 evaluation |
| Finance | Credits Agent/Host; supplier debit+source; MOFA bills; dues; period reports |
| Notifications | Send WA/email; dashboard cards; log |
| Dashboards | Due, process, LS red, waiting hotels, today’s transport |
| Suppliers | Master by four types; assignments |
| HR | Employee and payroll records |
| Audit | Record approval actors |

---

## 31. Database Entity Catalogue

*(Business entities that must exist as durable company data.)*

| Entity | Core business attributes (illustrative) |
|--------|----------------------------------------|
| Agent | Identity, contacts, verification |
| Sub EA | Code, name, parent agent |
| Supplier | Type (Umrah/Hotel/Transport/Catering), details |
| Staff User | Role, department duties |
| Group | Group Number, name, consulate, package, pax, flights, duration, gates, Umrah Co, Agent, WhatsApp, services value, season, uploaded by |
| Mutamer | Name, age, passport, nationality, EA/Sub EA, visa/biometric/visa no/MOFA/type, group link |
| Host | Name, Iqama, DOB, mobiles, WhatsApp (may attach to Long Stay) |
| Visa Case | Type, Umrah Co, statuses, refs |
| Hotel Booking | City, hotel, agreement no., dates, pax, STATUS |
| Transport Request/Leg | Vehicle, route, times, flight, company, bill/done flags, attachments |
| Catering Booking | Supplier, plan, dates, pax |
| BRN | Agreement no., hotel, window, price, days, pax, rooms, total, used |
| Voucher | Group link, bilingual content snapshot, issue time |
| Long Stay Record | Group/mutamer/host, dates, duration, Absher, remarks, package status |
| MOFA Bill | Agency, Umrah Co, group, lines Qty×Rate, total, approval sign, CR date |
| Payment / Ledger Entry | Party, credit/debit, source, amount, links |
| Notification Log | Event, recipients, channels, status |
| Employee / Payroll | HR attributes, salary payments |
| Document File | Type, owner, group links, versions |
| Audit Event | Actor, action, entity, before/after |

---

## 32. Notification Catalogue

| Event | Recipients | Channels |
|-------|------------|----------|
| Group created / OCR committed | Agent, Admin | WhatsApp (+ in-app) |
| Mutamer import completed | Agent, Admin | WhatsApp |
| Visa / biometric material change | Agent, Admin | WhatsApp |
| Hotel WAITING / APPROVED | Agent, Admin | WhatsApp |
| Transport assigned / schedule change | Agent, Admin | WhatsApp |
| Voucher issued | Agent, Admin | WhatsApp (+ email optional) |
| PAYMENT/BILL gate change | Agent, Admin | WhatsApp |
| MOFA bill issued / approved | Agent, Admin | WhatsApp |
| Payment received / due critical | Agent, Admin | WhatsApp |
| **Long Stay day-85** | Host, Agent, Tuba official | WhatsApp + Email + Dashboard red card |
| Supplier reject/accept (material) | Admin (+ Agent if policy) | WhatsApp |

---

## 33. Dashboard Catalogue

| Card / view | Audience |
|-------------|----------|
| Due from Agent | Admin, Finance, Agent (own) |
| Groups in process | Admin, Ops, Agent (own) |
| Long Stay red (day-85) | Admin, Agent (own) |
| Hotels waiting approval | Admin, Hotel desk |
| Visa/biometric backlog | Admin, Visa desk |
| Today transport legs | Admin, Transport |
| Arrivals / Departures today | Admin, Ops |
| BRN utilization | Admin, Ops/Finance |
| Income/expense snapshot | Admin, Finance, Executive |

---

## 34. KPI Catalogue

| KPI | Meaning |
|-----|---------|
| Active groups (season) | Open operational groups |
| Total mutamers under management | Headcount |
| Groups with VISA gate open/closed | Readiness |
| Hotels waiting approval | Bottleneck |
| Visas not issued with biometric registered | Pipeline |
| Long Stay within 5 days of day-85/90 | Compliance risk |
| Absher incomplete on active LS | Compliance |
| Transport legs today unpaid/unmarked | Ops |
| BRN used vs capacity | Commercial |
| Agent due total | Receivables |
| MOFA bills pending approval | Finance |
| Income/expense D/M/Y | Management |
| Uploads by Agency vs Staff | Intake mix |

---

## 35. Audit Rules

1. Record who created/updated Group Numbers.  
2. Record mutamer import actor and timestamp.  
3. Record hotel STATUS transitions.  
4. Record readiness gate flips.  
5. Record MOFA bill Approval Sign.  
6. Record OCR approve/reject.  
7. Record supplier accept/reject with reason.  
8. Record finance credits/debits and payment source.  
9. Retain notification send attempts.  
10. Preserve history across season archive.

---

## 36. Security Rules

1. No Mutamer or Host passwords/logins.  
2. Agent data isolation by agent.  
3. Supplier assignment isolation.  
4. Staff access by duty.  
5. Public site must not advertise Staff Admin entry.  
6. Protect passport, Iqama, phone, and bill data as sensitive.  
7. Mandatory WhatsApp fields required before activating related workflows.  
8. Unique Group Number enforcement.  
9. Approval actions attributable.  
10. Files (tickets, receipts, scans) stored under access control — not anonymous public links as the long-term norm.

---

## 37. Transformation Principles

1. The company must operate to **this blueprint**, not to spreadsheet habit alone.  
2. Existing digital tools are vehicles; **business law is this document**.  
3. Prefer adapting current workplaces to Excel boards over inventing alien processes.  
4. Do not introduce Mutamer self-service.  
5. Do not turn Agents into independent ERP product customers.  
6. Day-85 and MOFA/hotel cash split are non-negotiable business controls.  
7. Spreadsheet retirement means **feature parity with these boards**, not cosmetic dashboards.

---

## 38. Architecture Principles

*(Business-system architecture — how capabilities relate.)*

1. **Group Number spine** connects mutamers, visa, hotels, transport, catering, BRN, voucher, finance, notifications.  
2. **Counterparties** (Agent/Supplier) hang off Groups and payments — Tuba remains the centre.  
3. **Readiness gates + service statuses + hotel approvals** together describe process state.  
4. **Finance** distinguishes MOFA bills, cash stay deals, agent/host credits, supplier debits.  
5. **Notifications** are part of the control system (especially Long Stay).  
6. **OCR + Excel** are dual intake rails into the same Group.  
7. **Dashboards and reports** read the same operational truth as desks.  
8. **HR/Payroll** joins company expense reality.  
9. **Website** is outside the operational spine except Agent entry.  
10. **Audit** wraps approvals and money.

---

## 39. Extension Rules

New capability may be added only if it:

1. Does not violate Principles (§2) or Security (§36).  
2. Attaches to Group Number when operational.  
3. Declares notifications and approvals.  
4. Updates Data Dictionary and Catalogues in this blueprint.  
5. Does not create a Mutamer portal.  
6. Does not market Staff login on the public site.  
7. Keeps Agent isolation and Supplier assignment isolation.  
8. Preserves Day-85 and credit/debit party rules unless this blueprint is formally amended.

---

## 40. Future Reserved Sections

Reserved for formal amendment only (not filled here):

- Ministry system connectivity policy (Nusuk/MOFA deep integration standards)  
- Multi-country agent expansion beyond Bangladesh primary market  
- Fleet/hardware GPS operating law  
- Native mobile apps for Staff/Drivers  
- Advanced CRM / Procurement operating law  
- ZATCA / formal tax e-invoicing regime  
- Multi-currency treasury policy beyond SAR-first operations  
- Document legal retention years schedule (archive policy detail)

---

## Workflow index (standard pattern)

Each lifecycle in §§7–19 follows:

| Element | Meaning |
|---------|---------|
| Purpose | Why the process exists |
| Trigger | What starts it |
| Inputs | Required data/documents |
| Processing | Steps the company performs |
| Approvals | Who must authorize |
| Notifications | Who is informed |
| Outputs | What is produced |
| Business Rules | Hard constraints |
| Exceptions | Allowed deviations |

---

## Closing declaration

**This Master Business Blueprint is the only Business Source of Truth for Tuba Al Hijaz ERP behaviour.**  
All product behaviour, training, and operating practice must conform to it. Amendments require an explicit new version of this document.

---

*End of TUBA_MASTER_BUSINESS_BLUEPRINT.md*
