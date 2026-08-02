# TUBA AL HIJAZ — Business Discovery

**Phase 1:** 2026-08-01 (preliminary; business source files not yet on host)  
**Phase 1.1:** 2026-08-01 (complete; business files read from `/doc/business/`)  
**Mode:** Read-only discovery — no implementation, no redesign, no software comparison, no tickets  

### Business Source of Truth (Phase 1.1)

| File | Path | Role |
|------|------|------|
| Business Workflow.docx | `/doc/business/Business Workflow.docx` | Process narrative + Nusuk group screenshots + Excel sample legend |
| Sample customer Excel | `/doc/business/Sample excell sheet of customer data .xlsx` | Mutamer (customer) upload template |
| Full operations Excel | `/doc/business/Tubahijaz full data.xlsx` | Live manual operating workbook (8 sheets) |

**Rule used in this document:** Business Word + Excel win. The existing ERP was studied only to understand that an implementation already exists; this report does not compare or redesign it.

**Phase 1 material:** Prior Phase 1 findings are preserved in **Appendix A** at the end of this file (not discarded).

---

## 1. Company Structure

Tuba Al Hijaz is **one operating company**. It is not a SaaS product for many unrelated ERP tenants.

| Party | Business meaning |
|-------|------------------|
| **Tuba Al Hijaz** | Saudi ground operator; owns staff, ops, finance, vouchers, dashboards; customers of Tuba are Bangladesh agents |
| **Bangladesh Agent** | External travel agency (e.g. Discover Holidays); customer of Tuba; brings Mutamers/groups |
| **Sub External Agent (Sub EA)** | Sub-code under the main agent hierarchy in Nusuk/customer Excel (e.g. BENGAL UNITED HABHUS, TAWFIQ AIR TUBA HABASH) |
| **Umrah Company (Visa Supplier)** | Saudi Umrah companies Tuba buys visa/group services from (Habash / Alhabash, Almautmirin / Al Olayan / Najmat Al Olayan, Arkan, etc.) |
| **Hotel Supplier** | Saudi hotels / hotel companies used for Makkah & Madinah stays |
| **Transport Supplier** | Transport companies (Habbash/Habash Transport, Olayan, Al-Maqam, Noor Al Tareeq, Sunbulah, Own Transport, …) |
| **Catering Supplier** | Catering (named: Tuba Al-Hijaz Catering) |
| **Customer / Mutamer** | Pilgrim/traveler; **no portal**; data entered by Agent or Tuba staff |
| **Host / Service Holder** | For Long Stay: Saudi Iqama holder hosting relatives (husband/wife/relatives) |

**Nusuk identity note (from sample Excel legend in Word image):**  
Column “Main External Agent Code” is annotated as **Tuba Al Hijaz company code** (example `1004492`). Groups List screenshots show this code consistently. Bangladesh agencies operate under / with that structure; agents are customers of Tuba.

**Website role (Word):** Information-only Hajj/Umrah business site; **agent login only**; Super Admin/Staff login must **not** appear on the public website; no public booking functionality.

---

## 2. Departments

| Department | Business responsibility (from Word + Excel) |
|------------|-----------------------------------------------|
| **Super Admin / Staff ops** | Create/open Group Numbers, OCR scans, Excel upload, avoid duplicate groups, run desks |
| **Visa / Umrah Co coordination** | Work with Saudi Umrah companies; track VISA checkbox readiness |
| **Hotel desk** | Makkah & Madinah hotels, agreement/BRN numbers, check-in/out, approval status |
| **Transport desk** | Schedules, vehicles, routes, airports, ziyarah moves, transport voucher |
| **Catering desk** | Catering supplier assignment for groups that need it |
| **Accounts & Finance** | Debit/credit, due, agent income, supplier payments, bank/cash/mobile banking source |
| **Billing / MOFA processing account** | Bill sheet for MOFA processing fees (separate note: hotel/transport may be cash as discussed) |
| **HR & Payroll** | Employee details and salaries (Word requires standard HR/payroll) |
| **Notifications** | WhatsApp (and email) on every update to agent and admin |
| **Dashboard / Reporting** | Due from agents, group process status, agent/supplier/group/income/expense reports |
| **Agent Portal** | Already exists in the business vision; agents perform same group/customer processes as staff where allowed |

---

## 3. User Roles

| Role | Who | What they do |
|------|-----|--------------|
| **Super Admin** | Tuba | Full control; staff login not on public website |
| **Staff** | Tuba employees (names seen in Excel: ABUBAKAR, SHUVO, SAFI, ISMAIL, SHAKIB, ABDULLAH, …) | Create groups, upload Excel, update hotels/transport/long stay, finance, approvals |
| **Bangladesh Agent** | e.g. Discover Holidays, Aim Travels | Request/create group via Nusuk or Tuba; upload mutamer Excel; book hotel/transport/catering by Group Number; receive WhatsApp updates; use Agent Portal |
| **Supplier** | Umrah Co / Hotel / Transport / Catering | Provide Saudi-side services; appear as dropdown masters; receive payments from Tuba |
| **Customer (Mutamer)** | Pilgrim | No portal; never self-serves in Tuba system |
| **Host / Service Holder** | Long Stay sponsor in KSA | Provides Iqama, WhatsApp (mandatory), relation; receives day-85 reminders |

Both **Tuba staff and Agent** can run the same group-create + Excel-upload process (Word: “Tubahijaz (Super admin/Staff) / Agent … Can add the same process”). Data must remain **one shared view** — no duplicate Group Numbers.

---

## 4. Business Services

| Service | Business content |
|---------|------------------|
| **Hajj / Umrah packages** | Phase-1/2 groups; visa type dropdown Hajj/Umrah |
| **Long Stay Visa (استضافة)** | ~90-day Saudi long stay for husband/wife/relatives of service holders; Nusuk group number; host Iqama fields |
| **Visa processing via Umrah Co** | Habash, Almautmirin/Al Olayan, Arkan (and historical others) |
| **Hotel Makkah** | Hotel name, agreement no., check-in/out, pax, status |
| **Hotel Madinah** | Same structure as Makkah |
| **Transport** | Single airport–hotel or full route packages; vehicle types; ziyarah legs |
| **Catering** | Tuba Al-Hijaz Catering (and extendable supplier list) |
| **BRN / Agreement inventory** | Hotel agreement numbers sold/used (additional BRN SOLD sheet) |
| **Voucher (Tuba Voucher)** | Bilingual transport/hotel movement voucher issued per group |
| **MOFA processing billing** | Separate bill sheet for MOFA account rates × pax |
| **Ziyarah movements** | Makkah/Madinah ziyarah dates and internal movements on voucher/schedule |
| **Notifications** | WhatsApp API to agent + admin on updates; Long Stay day-85 multi-channel alerts |
| **HR / Payroll** | Employee master + salaries |
| **Finance** | Full debit/credit; supplier pay from bank/cash/mobile; income only from Agent/Host |

---

## 5. Business Documents

| Document | Use |
|----------|-----|
| **Nusuk Groups List screenshot / export** | Source of Group Number, group name, consulate (Dhaka), mutamer count, agent code |
| **Mutamer Excel** | Passenger list uploaded into a Group Number |
| **Passport / identity** | OCR scan at group creation (Word Phase-1) |
| **Flight ticket copy** | Google Drive links on transport form responses |
| **Payment receipt** | Attached on transport request form |
| **Hotel agreement / BRN number** | Agreement No. Makkah/Madinah; BRN sold inventory |
| **Tuba Transport Voucher** | Operational voucher: hotels, transport co, booking no., arrival/departure, internal moves, supervisor mobiles |
| **Bill Sheet (MOFA Processing Account)** | Qty × rate invoice-like sheet; approval sign |
| **Absher flag** | Long Stay sheet boolean for Absher completion |
| **Iqama details** | Host/service holder identity for Long Stay |

---

## 6. Customer Lifecycle

**Business name for customer:** **Mutamer** (not “user”).

1. Bangladesh customer requests travel via Bangladesh Agent (e.g. Discover Holidays).  
2. Agent is customer of Tuba; works under Main External Agent Code (Tuba code `1004492` in samples).  
3. Group Number obtained from **umrah.nusuk.sa** or requested from Tuba staff.  
4. Mutamer Excel uploaded into that Group Number (staff or agent).  
5. Fields tracked: name, age, passport, nationality, main/sub EA, **Visa Status**, **Biometric status**, Visa Number, **MOFA Number**, Mutamer Type (`B2B` in sample).  
6. Sample state pattern: Biometric `Registered`, Visa `Visa Not Issued`, Visa/MOFA numbers empty → in-progress before issue.  
7. Mutamer appears in Long Stay sheet when product is long stay (per-person rows under a group).  
8. During stay: flights, hotels, transport, ziyarah execute at group level; mutamer counts drive billing.  
9. No customer login at any step.

**Hidden relationships:** Sub EA sits under Main EA; many mutamers share the same agent codes; Long Stay mutamers share one Host Iqama/mobile across family rows.

---

## 7. Group Lifecycle

### Phase-1 (Word) — Create group

1. Upload image → OCR scan.  
2. Create **Group Number** with Nusuk-like details (Groups List: Group Number, Group Name, Creation Date, Consulate e.g. Dhaka, Package Type, Mutamer’s Number, Arrival Date, Created By, Services Value, Main External Agent Code).  
3. Open Group Number → table create → **upload mutamer Excel**.  
4. Manually add:  
   - Visa type (Hajj / Umrah)  
   - Haji/reference WhatsApp number (**mandatory**)  
   - Supplier Name (Umrah Co dropdown)  
5. Staff and Agent can both do this; **single data**, **no duplicate Group Number**.

### Phase-2 (Word) — Services on group

6. Hotel / Transport / Catering bookings **must reference Group Number** and **must select Agent name**.  
7. Parallel tracking in Excel “GROUP DETAILS”: VISA / PACKAGE / PAYMENT / BILL checkboxes; flights; duration formula; Makkah & Madinah hotel blocks with STATUS.  
8. Finance/HR/payroll maintained in the same operational reality as the full Excel workbook.  
9. WhatsApp API notifies agent and admin on every update.

### Observed Excel status flow (GROUP DETAILS)

- Checkbox gates: `VISA`, `PACKAGE`, `PAYMENT`, `BILL` (TRUE/FALSE).  
- Hotel STATUS: `APPROVED` | `WAITING FOR APPROVAL` (Makkah and Madinah separately).  
- `DURATION = DEPARTURE DATE − ARRIVAL DATE`.  
- `UPLOADED BY`: `AGENCY` or staff names.  
- Season sheet `GROUP DETAILS 1448` (~252 active groups with codes) + archive `GROUP DETAILS OLD` (prior Umrah companies / season).

---

## 8. Long Stay Lifecycle

**Word Phase-3 — Long Stay Visa**

1. Category for husband/wife/relatives of a **service holder in Saudi Arabia**, applying from Bangladesh.  
2. Duration normally **90 days** (Saudi rule).  
3. Same group-number path via Nusuk image/list, then Excel upload into group.  
4. Extra manual fields:  
   - Visa type = Long Stay  
   - Relation: Husband / Wife / Relatives  
   - **Service holder WhatsApp (mandatory)** — high priority  
   - Agency name, No. of Pax  
   - Host/Service Holder Name, Iqama Number, DOB, Host Mobile, **Host WhatsApp ***  
   - Entry date + flight no.; Exit date + flight no.  
   - Supplier (Umrah Co) dropdown  

5. **Day-85 rule (critical):** When customer finishes **85 of 90 days**, send reminder with customer details to:  
   - Service holder WhatsApp  
   - Responsible agent WhatsApp  
   - Tuba official WhatsApp  
   - Email  
   - Show **red-mark notification card** on Agent dashboard and Tuba dashboard  

**Excel LONG STAY DETAILS (per mutamer):**  
Umrah Co, Group Number/Name, Mutamer name/age/passport, arrival/departure flight+date, `STAY DURATION = DEPARTURE − ARRIVAL`, Iqama no., Iqama birth date, mobile, Package Status (often a date or `OK`), Remark (`NEED UPADTE` / `OK`), Absher boolean.  
~107 mutamer rows observed; Habash and Al Olayan dominant.

---

## 9. Supplier Lifecycle

### Four supplier types (Word)

1. **Visa / Umrah Company (Saudi)** — Alhabash Lilsiyaha wkhidmat, Almautmirin Company Ltd., Arkan Lilumrah Company (+ Excel also shows AL OLAYAN / NAJMAT AL OLAYAN, SILVEE, and many historical cos in OLD sheet).  
2. **Hotels** — Sama Al-Khair, Atyaf Al Khair, Lamar Al-Masi, Tuba Al-Hijaz Hotels (+ many live names in GROUP DETAILS / BRN).  
3. **Catering** — Tuba Al-Hijaz Catering.  
4. **Transport** — Habbash Transport, Olayan Transport, Al-Maqam Transport (+ Excel: HABASH, NAJMAT AL OLAYAN, NOOR AL TAREEQ / NOOR SL TAREEQ, SUNBULAH, OWN TRANSPORT).

### Lifecycle

1. Tuba maintains supplier master (dropdown + add-with-details).  
2. Group selects Umrah Co at creation.  
3. Hotels/transport/catering assigned by Group Number.  
4. Hotel agreements/BRNs purchased/allocated (`additional BRN SOLD`).  
5. Transport company appears on schedule + voucher.  
6. Finance pays suppliers from selected source (bank / cash / mobile banking) as **Debit**.  
7. Supplier-wise reports required.

---

## 10. Finance Lifecycle

From Word + BILL SHEET + GROUP DETAILS payment/bill flags:

1. **Income / Credit side** only from **Agent** or **Host (service holder)** — Word explicit note.  
2. **Expense / Debit side** includes supplier payments; each payment selects source: **bank / cash / mobile banking**.  
3. Group-level gates: `PAYMENT` and `BILL` checkboxes on GROUP DETAILS.  
4. **MOFA Processing Account** bill: line items Qty × Rate = Amount; total; note that this bill is for MOFA process only — “Actual Stay Hotel & Transport Will be Cash Paid as Of Discussed Price”.  
5. Example rates seen: `445` × pax; full transport line `2300`–`2400 SR`.  
6. Approval Sign + CR Date on bill.  
7. Services Value on Nusuk Groups List (financial magnitude per group).  
8. BRN sheet computes `TOTAL PRICE = PRICE × NO. OF DAYS × PAX` (and variants with rooms).  
9. Required reports: agent-wise, supplier-wise, group code, income, expense, daily/monthly/yearly.  
10. Dashboard must show **due from agent** and which group numbers are in process.  
11. HR payroll is part of company money reality (salaries) per Word.

---

## 11. Notification Lifecycle

| Trigger | Recipients | Channel |
|---------|------------|---------|
| Every operational update (Word) | Agent + Admin | WhatsApp API |
| Long Stay day 85/90 | Host WhatsApp, Agent, Tuba official WhatsApp, Email, dashboard red card | WhatsApp + Email + Dashboard |
| Group/hotel/transport/finance changes | Agent + Admin (implied by “every update”) | WhatsApp |

Mandatory phones collected for notifications: Haji/reference WhatsApp (Hajj/Umrah groups); Host WhatsApp (Long Stay).

---

## 12. OCR Lifecycle

Word Phase-1:

1. User uploads an **image** (Nusuk Groups List / related scan).  
2. **OCR scans** the image.  
3. System/staff **creates Group Number** using scanned details.  
4. Then Excel mutamer file is uploaded into that group.  

OCR is the entry ramp from Saudi/Nusuk visual records into Tuba’s group register. Customer passports are also part of intake reality (mutamer passport column), though the Word’s OCR sentence is tied to the group image.

---

## 13. Hotel Workflow

1. Group exists with Agent + Group Number.  
2. Assign **Hotel Makkah**: name, Agreement No., check-in, check-out, pax, STATUS.  
3. Assign **Hotel Madinah**: same fields.  
4. STATUS moves to `WAITING FOR APPROVAL` then `APPROVED` (observed).  
5. Agreement numbers link to BRN inventory (`additional BRN SOLD`: date requested, umrah co, hotel, agreement no., stay window, pax, days, price, rooms, total, used pax).  
6. Pricing rule in BRN sheet: **Total = Price × Days × Pax** (sometimes room-based variants in side columns).  
7. Voucher prints Makkah & Madinah hotel blocks with nights (`check-out − check-in`) and room count.  
8. Transport form also captures hotel names + ziyarah dates + optional second hotel segment (ROUTE TYPE 2 / HOTEL 2 fields).  
9. Hotel/transport stay cost may be **cash as discussed**, separate from MOFA bill (Bill Sheet note).

---

## 14. Transport Workflow

1. Request captured via form (“Form responses 3”) and/or TRANSPORT SCHEDULE sheet.  
2. Key inputs: Group Name/Number, total pax, vehicle type (BUS, STARIA, HIACE, CAR, SUV, COASTER, H-1), transport type (`SINGLE TRANSPORT (AIRPORT - HOTEL)` vs `FULL TRANSPORT`), route (`JED-MAK-MED-JED`, etc.), airports, flight numbers/times, contact, ticket links, payment receipt links, Makkah/Madinah hotels & ziyarah dates.  
3. TRANSPORT SCHEDULE operationalizes legs: Transport Co, operation number (رقم التشغيل), agency, group code, pax, FROM→TO route, vehicle, date/time, flight, BILL (`OK` or amount), TRANSPORTATION done flag, hotel names, contact.  
4. Common legs: JED AIRPORT↔MAK, MED AIRPORT↔MED, MAK↔MED, MAK/MED ZIYARA.  
5. **Tuba Voucher** consolidates: transport company, vehicle type, booking/operation number, pilgrim count, arrival/departure rows, ordered internal movements (airport→hotel, ziyarah, city transfer), supervisor mobiles in Makkah/Madinah, 24h ops mobiles.  
6. Nights on voucher: `check-out − check-in` formulas.

---

## 15. Catering Workflow

Word lists Catering as a Phase-2 bookable service by Group Number + Agent, with supplier **Tuba Al-Hijaz Catering** and ability to add more.  

The full Excel workbook’s eight sheets do **not** contain a dedicated catering register (catering is declared in Word more than tabulated in this Excel). Business still treats catering as a first-class group service alongside hotel/transport.

---

## 16. Voucher Workflow

**Sheet: TUBA VOUCHER** (template instance filled for a group)

1. Title: TRANSPORT VOUCHER (bilingual).  
2. Header: Agent name, Agent country (Bangladesh), Umrah Company.  
3. Group Code + Muallim mobile.  
4. Hotel section: City (Makkah/Madinah), hotel, agreement no., check-in/out, nights (formula), rooms.  
5. Transport company + vehicle type + booking/operation number + number of pilgrims.  
6. Arrival / Departure table: type, airport, date, time, flight no., airline.  
7. Internal movements list: date, from, to, time (airport, hotel, ziyarah).  
8. External agent representatives: supervisor in Makkah / Madinah + mobiles; 24h ops numbers.  
9. Issued as the operational authority document for ground movement.

---

## 17. BRN Workflow

**Sheet: additional BRN SOLD**

1. Tuba requests/buys hotel capacity under an **Agreement No.** (BRN).  
2. Record: date requested, Umrah Co, hotel name, agreement no., check-in/out, pax, days, unit price, rooms, **total price**, used pax.  
3. Formula business rule: `TOTAL PRICE = PRICE × NO. OF DAYS × PAX`.  
4. Side columns (unnamed headers) hold parallel inventory blocks (other hotel periods, capacity like `32pax`, partner cos such as ETLALAT CO.).  
5. GROUP DETAILS “AGREEMENT NO. MAKKAH/MADINA” consume these agreements when a group hotel is approved.  
6. Used pax vs capacity is a manual allocation control.

---

## 18. Excel Sheet Analysis

### A) `Sample excell sheet of customer data .xlsx`

| Item | Detail |
|------|--------|
| Worksheets | 1 — `data` |
| Rows | Header + 20 mutamers (+ legend rows in Word screenshot: “Below row for you understanding not include the software”) |
| Purpose | Template/sample for uploading customers into a Group Number |
| Formulas | None |
| Approval sequence | Biometric status → Visa status → Visa Number / MOFA Number filled when issued |
| Required inputs | Mutamer name, age, passport, nationality, main/sub EA codes & names, mutamer type |
| Outputs | Becomes group passenger register; feeds visa/MOFA tracking |
| Manual validations | Passport uniqueness expected in practice; nationality Bangladesh in sample; type B2B |
| Responsibilities | Agent or Tuba staff upload; Tuba/Umrah Co drive visa/MOFA updates |

### B) `Tubahijaz full data.xlsx` (8 worksheets)

| Sheet | ~Scale | Business purpose |
|-------|--------|------------------|
| **GROUP DETAILS 1448** | ~252 groups (1765 rows capacity) | Master group ops board for current season/Hijri context “1448” |
| **TUBA VOUCHER** | Template (~1 filled sample) | Printable bilingual transport/hotel voucher |
| **Form responses 3** | ~40+ requests | Google-form style transport/hotel service requests |
| **BILL SHEET** | 1 sample bill | MOFA processing account invoice |
| **LONG STAY DETAILS** | ~107 mutamers | Per-person long stay / host Iqama tracking |
| **TRANSPORT SCHEDULE** | ~214 legs | Day-to-day transport execution board |
| **additional BRN SOLD** | ~140 agreements | Hotel BRN/agreement inventory & pricing |
| **GROUP DETAILS OLD** | large archive | Prior season/groups / older Umrah companies |

**Cross-sheet key:** `GROUP CODE` / `GROUP NUMBER` (Nusuk-style long numeric, e.g. `480900024491`) joins group details, transport, forms, long stay, voucher.

**Duplicates / repeated work:** Group name+pax repeated across sheets; hotel names re-entered on GROUP DETAILS, Form responses, Transport Schedule, Voucher, BRN; flight data repeated; agent/agency naming inconsistent (spelling variants).

**Column drift:** Form responses headers vs some data rows are misaligned (e.g. transport type appearing under Arrival Date header) — manual form evolution pain.

---

## 19. Excel Column Dictionary

### Sample customer (`data`)

| Column | Meaning |
|--------|---------|
| Mutamer name | Customer full name |
| Mutamer Age | Age in years |
| Passport Number | Travel document id |
| Nationality | Country (sample: Bangladesh) |
| Main External Agent Code | Annotated as **Tuba company code** in Nusuk (`1004492`) |
| Main External Agent Name | Agent display name (e.g. Discover Holidays) |
| Sub EA Code | Sub-agent numeric code |
| Sub EA Name | Sub-agent name |
| Visa Status | e.g. `Visa Not Issued` |
| Biometric status | e.g. `Registered` |
| Visa Number | Filled when visa issued |
| Mofa Number | Ministry of Foreign Affairs processing number |
| Mutamer Type | e.g. `B2B` |

### GROUP DETAILS 1448 / OLD

| Column | Meaning |
|--------|---------|
| UMRAH CO. | Visa supplier company |
| VISA / PACKAGE / PAYMENT / BILL | Boolean readiness checkpoints |
| GROUP CODE | Nusuk group number |
| GROUP NAME | Display name (often includes pax) |
| PAX | Headcount |
| DATE UPLOADED / UPLOADED BY | Intake audit |
| ARRIVAL/DEPARTURE FLIGHT NO. + DATE | Travel window |
| DURATION | Formula `DEPARTURE − ARRIVAL` |
| HOTEL MAKKAH / MADINA blocks | Hotel, agreement no., check-in/out, pax, STATUS |

### LONG STAY DETAILS

| Column | Meaning |
|--------|---------|
| UMRAH CO. / GROUP NUMBER / GROUP NAME | Group context (names often include استضافه) |
| MUTAMER NAME / AGE / PASSPORT NO. | Customer |
| ARRIVAL/DEPARTURE DATE + FLIGHT | Travel |
| STAY DURATION | Formula `DEPARTURE − ARRIVAL` |
| IQAMA NO. / IQAMA BIRTH DATE / MOBILE NO. | Host/service holder linkage |
| PACKAGE STATUS | Date or OK |
| REMARK | Ops note (`NEED UPADTE`) |
| ABSHER | Boolean Absher completion |

### TRANSPORT SCHEDULE

| Column | Meaning |
|--------|---------|
| TRANSPORT CO, | Transport supplier |
| رقم التشغيل | Operation / booking number |
| AGENCY NAME / GROUP CODE / PAX | Who/what moves |
| ROUTE (from/to) | Leg endpoints |
| VEHICLE TYPE / DATE / TIME / FLIGHT NUMBER | Execution |
| BILL / TRANSPORTATION | Billing mark & done flag |
| MAK/MED HOTEL NAME / CONTACT NO. | Ground context |

### additional BRN SOLD

| Column | Meaning |
|--------|---------|
| DATE REQUESTED | When BRN requested |
| UMRAH CO. / HOTEL NAME / AGREEMENT NO. | Contract identity |
| CHECK-IN / CHECK-OUT / PAX / NO. OF DAYS | Stay |
| PRICE / NO. OF ROOMS / TOTAL PRICE / USED PAX | Commercial allocation (`TOTAL = PRICE×DAYS×PAX`) |

### Form responses 3 (declared headers)

Timestamp, Email address, GROUP NAME, GROUP NUMBER, TOTAL PAX, VEHICLE TYPE, ARRIVAL DATE, ARRIVAL FLIGHT NUMBER, ARRIVAL PORT, DEPARTURE DATE, DEPARTURE FLIGHT NUMBER, DEPARTURE PORT, CONTACT NUMBER, FLIGHT TICKET COPY, DEPARTURE FLIGHT TICKET, PAYMENT RECEIPT, TRANSPORT TYPE, ROUTE TYPE, Makkah/Madinah hotel + ziyarah fields, optional second route/hotel segment.

### BILL SHEET

Agency name, Umrah Co, Group code, MOFA Processing Account lines (S/L, Description, Qty, Rate, Amount), totals, cash-note for hotel/transport, Approval Sign, CR Date.

### TUBA VOUCHER

Bilingual agent/umrah/group/muallim; hotel nights/rooms; transport company/type/booking no./pax; arrival & departure; internal movements; supervisors’ mobiles; 24h ops phones.

---

## 20. Hidden Business Rules

1. **One Group Number globally** — staff and agent see the same data; duplicates forbidden.  
2. **Group Number is the spine** — hotel, transport, catering, finance, voucher, long stay all key off it.  
3. **Agent is mandatory** on Phase-2 bookings.  
4. **Main External Agent Code in Nusuk = Tuba’s code** (sample legend).  
5. **Sub EA** hierarchy under main agent for mutamer lists.  
6. **Checkbox gate sequence** on groups: Visa → Package → Payment → Bill (four independent booleans, manually maintained).  
7. **Hotel approval states:** WAITING FOR APPROVAL → APPROVED (per city).  
8. **Duration formulas:** trip days = departure − arrival; voucher nights = checkout − checkin; BRN total = price × days × pax.  
9. **Long Stay = 90 days**; **notify at day 85** to host + agent + Tuba (WA + email + red dashboard).  
10. **Host WhatsApp mandatory** for Long Stay; Haji/reference WhatsApp mandatory for Hajj/Umrah groups.  
11. **Credit income only from Agent or Host**; supplier pay is debit with explicit money source.  
12. **MOFA bill ≠ hotel/transport cash deal** — Bill Sheet prose separates them.  
13. **Mutamer Type B2B** in sample — agency channel, not retail walk-in.  
14. **Consulate Dhaka** appears on Nusuk group list for BD market.  
15. **Absher** tracked as boolean on long stay.  
16. **Uploaded By = AGENCY** vs named staff — dual intake channels.  
17. **OWN TRANSPORT** allowed as transport company value.  
18. **Website must not expose staff/admin login**; information + agent login only.  
19. **Catering is a bookable Phase-2 service** even when not given its own Excel sheet in this workbook.  
20. **BRN used pax ≤ capacity** is a manual commercial control.

---

## 21. Manual Pain Points

1. Entire season run inside multi-sheet Excel + Google Form + WhatsApp.  
2. Same group/hotel/flight typed many times across sheets.  
3. Form responses column drift / inconsistent entry patterns.  
4. Status checkboxes and hotel approvals updated by hand.  
5. Long Stay remarks stuck on `NEED UPADTE`; package status sometimes a date, sometimes text.  
6. Day-85 reminders depend on humans remembering (Word demands automation).  
7. Duplicate group risk if Nusuk + Tuba both create without lock.  
8. Naming inconsistency (Habash/Alhabash/Habbash; Noor Al Tareeq spellings; Discover/Discober).  
9. BRN side-columns without headers — tribal knowledge.  
10. Bill Sheet is a one-off layout, not a register of all bills.  
11. Catering not visible in the full-data workbook sheets.  
12. Finance “due from agent” not a computed ledger in Excel — Word asks for accurate debit/credit system.  
13. Ticket/payment proofs live as Google Drive links outside the workbook.  
14. OCR + Excel + Nusuk UI are three manual hops to one group.  
15. OLD vs 1448 sheet split requires humans to know which season is live.

---

## 22. Approval Chain

```
Bangladesh Customer
    → Bangladesh Agent (request)
        → Nusuk Group Number (agent self-serve OR Tuba staff create from OCR/image)
            → Mutamer Excel upload (Agent or Tuba Staff)
                → Umrah Co / Visa processing
                    → Biometric Registered → Visa Issued (+ Visa No / MOFA No)
                → Hotel Makkah/Madinah assignment
                    → WAITING FOR APPROVAL → APPROVED
                → Transport request (form) → Transport schedule → Voucher
                → Catering assignment (when needed)
                → PAYMENT / BILL checkboxes + MOFA bill Approval Sign
                → WhatsApp notify Agent + Admin on updates
                → Long Stay: Absher + day-85 multi-party reminder
```

**Approvers / actors observed:** Tuba staff names; `AGENCY` as uploader; hotel STATUS approvers (implicit staff); Bill “Approval Sign”; Umrah companies as external processors.

---

## 23. Dashboard Requirements

From Word + operational Excel meaning:

1. **Due from agent** (receivables spotlight).  
2. **Which Group Numbers are in working process** (pipeline).  
3. Long Stay **red-mark cards** at day-85.  
4. Agent-facing notification cards.  
5. Tuba admin notification cards.  
6. Visibility of visa/package/payment/bill readiness.  
7. Hotel approval waiting counts.  
8. Today’s transport schedule / arrivals / departures.  
9. Supplier workload perspective.  
10. Services value / commercial magnitude per group (Nusuk list field).

---

## 24. KPI Requirements

| KPI | Business sense |
|-----|----------------|
| Active groups by season | GROUP DETAILS row counts |
| Pax under management | Sum of PAX / mutamer rows |
| Groups waiting hotel approval | STATUS = WAITING FOR APPROVAL |
| Visa not issued mutamers | Customer Excel Visa Status |
| Biometric registered awaiting visa | Biometric vs Visa pairing |
| Long Stay approaching day 85 | Duration vs 90-day rule |
| Absher incomplete | ABSHER = False |
| Transport legs today / unpaid BILL | TRANSPORT SCHEDULE |
| BRN utilization | USED PAX vs capacity |
| Agent dues | Finance due |
| Income vs expense (daily/monthly/yearly) | Word reports |
| Supplier payables | Supplier-wise expense |
| MOFA bills issued / approved | Bill Sheet process |
| Uploads by AGENCY vs staff | UPLOADED BY mix |

---

## 25. Reports Required

Word explicit list:

1. Agent-wise report  
2. Supplier-wise report  
3. Group code report  
4. Income report  
5. Expense report  
6. Daily report  
7. Monthly report  
8. Yearly report  

Implied from Excel:

9. Group hotel status report (Makkah/Madinah)  
10. Transport schedule report by date/company  
11. Long Stay expiry / day-85 report  
12. BRN inventory & usage report  
13. MOFA processing account report  
14. Mutamer visa/biometric/MOFA status report  
15. Voucher issuance register (operational)

---

## 26. Business Vocabulary

| Term | Meaning |
|------|---------|
| **Mutamer** | Pilgrim / customer |
| **Group Number / Group Code** | Nusuk group id (long numeric) |
| **PAX** | Passenger count |
| **Main External Agent / EA** | Nusuk main agent; code annotated as Tuba company code |
| **Sub EA** | Sub-agent under main |
| **Umrah Co.** | Saudi visa/Umrah supplier company |
| **Agreement No. / BRN** | Hotel contract reference |
| **MOFA** | Ministry of Foreign Affairs number / processing account |
| **Absher** | Saudi Absher completion flag |
| **Iqama** | Saudi residence id of host/service holder |
| **استضافة** | Hosting / long-stay style group naming |
| **Muallim** | Guide/muallim mobile on voucher |
| **Ziyarah / Ziyara** | Religious site visit movement |
| **Full Transport vs Single Transport** | Package scope of vehicles |
| **رقم التشغيل** | Transport operation/booking number |
| **Services Value** | Commercial value on Nusuk group list |
| **Consulate** | e.g. Dhaka |
| **Haji/reference WhatsApp** | Mandatory group contact |
| **Host / Service Holder** | Long Stay sponsor in KSA |
| **B2B Mutamer Type** | Agency-channel customer |
| **WAITING FOR APPROVAL / APPROVED** | Hotel status |
| **VISA/PACKAGE/PAYMENT/BILL** | Group readiness checkboxes |

Named example agents: Discover Holidays, Aim Travels, Keya Travels, Mymensingh Travels, Bin Alam, …  
Named Umrah cos: Habash/Alhabash, Almautmirin, Arkan, Al Olayan/Najmat Al Olayan, Dawrat Al Hadith, Saqr, …  

---

## 27. Questions

1. Is Main External Agent Code **always** Tuba’s Nusuk code (`1004492`), with Bangladesh agencies only as names/sub-EA — or can other main codes exist?  
2. Exact list of live Umrah Companies for dropdown beyond the three named in Word?  
3. What is the precise checkbox meaning order — must VISA be true before PACKAGE, etc., or independent?  
4. Who clicks hotel STATUS from WAITING → APPROVED (which staff role)?  
5. Long Stay: is Package Status column a **expiry/reminder date** or a status label?  
6. Day-85: calendar days from entry stamp, or from visa issue date?  
7. Catering: where is it recorded today if not in this Excel — separate sheet/WhatsApp?  
8. MOFA rate `445` — fixed per season or per agent deal?  
9. Currency: all SAR? Any BDT collections in Bangladesh before KSA costs?  
10. HR payroll: employee list location today (not in these three files)?  
11. Form responses “Email address” column often holds transport company names — is that intentional?  
12. Should Hajj and Umrah groups share one GROUP DETAILS board or be split?  
13. Services Value on Nusuk — is it Tuba revenue, Nusuk fee, or package price?  
14. Own Transport vs supplier transport — billing rules?  
15. Archive rule: when does a group move from 1448 sheet to OLD?

---

## 28. Business Risks

1. **Missed day-85 Long Stay reminders** → overstay / compliance exposure.  
2. **Duplicate Group Numbers** if Nusuk and Tuba diverge.  
3. **Excel as system of record** → version conflicts, lost rows, no audit trail.  
4. **Payment/Bill checkboxes ≠ real ledger** → due-from-agent errors.  
5. **MOFA vs cash hotel/transport split** → agents unclear what is settled.  
6. **BRN oversell / used pax > capacity** if manual.  
7. **PII** (passports, Iqama, phones, Drive links) in shared spreadsheets.  
8. **WhatsApp as only notification bus** → delivery failures invisible.  
9. **Column drift in forms** → wrong flight/hotel executed.  
10. **Supplier name ambiguity** → wrong company paid.  
11. **Absher false** with active arrivals → process incomplete.  
12. **No customer portal** is intentional — but agents mistyping mutamer data has no self-correct path.

---

## 29. Business Assumptions

1. Tuba Al Hijaz is the sole ERP owner/operator.  
2. Bangladesh is the primary passenger market; Consulate Dhaka is normal.  
3. Agents are B2B customers of Tuba; mutamers are not system users.  
4. Nusuk (`umrah.nusuk.sa`) is the upstream Group Number authority for many groups.  
5. OCR of Nusuk group images is an accepted intake method.  
6. 90-day long stay and day-85 warning are standing Saudi/business rules for this product.  
7. Four supplier classes (visa co, hotel, catering, transport) cover commercial supply.  
8. WhatsApp is the default business messaging channel.  
9. Website remains non-transactional except agent login entry.  
10. The attached full Excel reflects how the company **actually** runs today.  
11. Sample mutamer Excel is the upload contract for group passenger data.  
12. Finance must eventually express accurate debit/credit even though Word author is not a finance expert.  
13. HR/payroll is in scope for the company system even though not present in these Excel sheets.  
14. “Discover Holidays” is a representative Bangladesh agent, not the only agent.

---

## 30. Final Discovery Summary

Tuba Al Hijaz runs a **Bangladesh→Saudi Umrah/Hajj/Long-Stay ground operation**. Bangladesh agents bring **Mutamers**. Tuba (and agents) obtain a **Nusuk Group Number**, OCR/register it, upload a **mutamer Excel**, then execute **visa (via Saudi Umrah companies), hotel BRNs, transport, catering, vouchers, MOFA billing, and WhatsApp updates**. Long Stay adds **host Iqama/WhatsApp** and a hard **day-85 reminder** to host, agent, and Tuba. Money distinguishes **credits from Agent/Host** vs **debits to suppliers** with bank/cash/mobile sources. The company today maintains this universe primarily in **`Tubahijaz full data.xlsx`** plus forms and Nusuk screens; the Word brief defines the phases, supplier types, website limits, finance/HR/report/dashboard expectations, and notification duties.

**Discovery complete for Phase 1.1.** No implementation, redesign, or comparison performed.

---

# Appendix A — Phase 1 preliminary discovery (preserved)

*Written 2026-08-01 before `/doc/business/` files were available. Kept so Phase 1 work is not lost. Business Source of Truth for decisions is Phase 1.1 above.*

### Phase 1 sources status (historical)

Business Word/Excel were **not found** on host at Phase 1 time. Discovery used stakeholder framing + existing ERP/docs only.

### Phase 1 company framing (still aligned)

- One company: Tuba Al Hijaz; not SaaS.  
- Users: Super Admin, Staff, Bangladesh Agent, Supplier, Customer (no portal).  
- Customer data always managed by Agent or Staff.

### Phase 1 software-context notes (understanding only; not authoritative over Word/Excel)

At Phase 1 the running ERP was observed to contain modules/portals for agents, suppliers, ops boards, finance, fleet, OCR, automation/notifications, dashboards, documents vault, vouchers/BRN/long stay entities, and a public marketing site. Role seeds included SUPER_ADMIN, OPS_STAFF, FINANCE_STAFF, FLEET_STAFF, CEO_VIEWER, AGENT, SUPPLIER, DRIVER. A 19-stage workflow catalog existed in product docs. These observations describe implementation presence only; **Phase 1.1 business rules above override** any conflicting mental model.

### Phase 1 open questions that Phase 1.1 answered or narrowed

| Phase 1 question | Phase 1.1 outcome |
|------------------|-------------------|
| Where are the three business files? | `/doc/business/` |
| What is in the mutamer Excel? | 13-column Mutamer dictionary (§19) |
| What is Long Stay in real ops? | 90-day host/Iqama product + day-85 alerts + LONG STAY DETAILS sheet |
| Is Excel the manual system of record? | Yes — full data workbook |

### Phase 1 questions still open

See §27 (Questions) — especially finance rates, catering register location, HR data location, and Main EA code universality.

---

*End of BUSINESS_DISCOVERY.md — Phase 1 + Phase 1.1. Discovery only.*
