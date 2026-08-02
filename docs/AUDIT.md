# TUBA AL HIJAZ — Frontend Audit Inventory (Phase 1)

> Audited: every file under `apps/web/src/app/pages/` (21 pages), `apps/web/src/app/components/`
> (Nav, Footer, ERPShell), `lib/i18n.ts`, `lib/LangContext.tsx`, `routes.tsx`.
> This document is the **source of truth for the database schema and API design**.
> The UI is frozen — nothing here changes a screen; it only records what the screens need.

---

## 1. Route map & page wiring

| Route | Page | Kind |
|---|---|---|
| `/` | Home (+ Nav/Footer via `Root`) | Public marketing |
| `/services` | Services | Public marketing |
| `/about` | About | Public marketing |
| `/contact` | Contact | Public + enquiry form |
| `/login` | Login | Auth (role tabs: agent/supplier/admin) |
| `/auth-onboarding` | AuthOnboarding | Prototype gallery: login variant, agent-reg wizard, verification tracker, supplier-reg wizard |
| `/super-admin` | SuperAdmin | ERP: platform console (10 screens) |
| `/agent-portal` | AgentPortal | ERP: agent B2B portal — hosts **GroupsModule** (AgentPortalGroups.tsx), **ServicesModule** (AgentPortalServices.tsx), **FinanceModule** (AgentPortalFinance.tsx) as `useState`-switched sub-views (no URL deep-linking) |
| `/supplier-portal` | SupplierPortal | ERP: external supplier portal (hotel/transport/catering personas) |
| `/ops-control` | OpsControl | ERP: control room (9 screens) |
| `/ops-departments` | OpsDepartments | ERP: 8 department desks |
| `/finance-erp` | FinanceERP | ERP: 13 finance screens |
| `/ocr-center` | OCRCenter | ERP: OCR pipeline + review queue |
| `/automation` | AutomationNotifications | ERP: rules, notification settings, delivery log |
| `/dashboards` | Dashboards | 8 role-scoped analytics dashboards |
| `/workflow-map` | WorkflowMap | Canonical 19-stage group lifecycle (state-machine spec) |
| `/mobile-apps` | MobileApps | Showcase of 4 mobile apps (Driver/Agent/Ops/Supervisor) — defines mobile API surface |
| `/tablet` | Tablet | Tablet layout spec (adds a few entity fields) |
| `/design-system` | DesignSystem | Pure documentation — no backend needs |
| `/i18n-system` | I18nSystem | Pure documentation — canonical i18n contract |

`AgentPortalGroups/Services/Finance` are **not** dead code and **not** routed — they are modules imported by AgentPortal.

---

## 2. i18n verdict (Lang = "bn" | "en", Bangla default)

**Core system: intact and correctly implemented.**
- `lib/i18n.ts` (now `packages/shared`): `Lang = "bn" | "en"`, `STRINGS` table (~100 keys, bn first),
  `t()`, `toLocalNum()` (Bengali numerals), `localSAR()`, `localDate()`/`localTime()` (Bengali month names),
  `fontFor()`, `lineHeightFor()` (bn needs ~1.75 line-height).
- `LangContext.tsx`: context provider, default `"bn"`, `toggleLang()`. Correct.
- `I18nSystem` page documents the contract ("Default State Rule") and is the only page fully compliant.

**Adoption gaps (flagged, NOT fixed — UI frozen):**
1. **Public pages** (Home, Services, About, Contact, Nav, Footer, AuthOnboarding §login): bilingual, but via inline
   `isBn ? "…" : "…"` ternaries / `{bn,en}` objects — they translate correctly on toggle but **bypass STRINGS** entirely.
2. **All ERP pages** (AgentPortal×4, SupplierPortal, OpsControl, OpsDepartments, FinanceERP, OCRCenter, SuperAdmin,
   Dashboards, AutomationNotifications, WorkflowMap, MobileApps, Tablet): **100% hardcoded English** — zero i18n
   imports. On toggle, only the ERPShell chrome (toggle button glyph) changes; page content stays English.
3. **Login.tsx**: hardcoded English (+ Arabic tab subtitles); no `useLang` at all. Also contains a latent bug (see §7).
4. **AuthOnboarding** sections 02–04 (agent reg, verification, supplier reg): hardcoded English.
5. **Nav mobile drawer**: renders English labels only (desktop links are bilingual).
6. **About**: office street addresses stay English in bn mode.
7. **Contact**: `<select>` option *values* are the localized display strings — submitting in bn mode would send Bengali
   strings as data. API must use stable enum values.
8. **DesignSystem** page's "bilingual" means **Arabic/English** (different pair); SuperAdmin settings offer
   "English/Arabic/Bilingual (EN+AR)" — conflicts with the bn/en system. Business decision needed eventually.
9. Backend consequence: **APIs must return raw numbers, ISO dates, and enum keys** — formatting/numerals/Bengali
   month names are client-side. Bilingual *content* (service names, notification templates) needs `*_bn`/`*_en` columns.

---

## 3. Per-page inventory

### 3.1 Home `/`
- **Entities**: ServiceModule ×6 (`visa|hotel|transport|catering|finance|fleet`; per-lang name/sub/desc), GovPlatformBadge ×5 (NUSUK, MOFA, MUALLIM, MHU, GASTAT), CompanyStat ×4 (2.4M+ pilgrims, 94.8% visa approval, 18+ years, 47 countries), WhyItem ×4, season card "Season 1446H Performance +23%".
- **Actions**: nav-only ("Become an Agent"→/contact, "Supplier Login"→/login, "View All Service Details"→/services). Module cards have dead "Learn more" affordance.
- **API**: optional `GET /public/stats` if marketing goes dynamic.

### 3.2 Services `/services`
- **Entities**: ServiceLine ×6 with per-lang name/headline/desc/6-feature list/cta, stat badges (94.8% approval, 200+ hotel partners, 300+ fleet, 100% halal, SAR 1B+ processed, 99.2% uptime). Feature lists imply: bulk group visa apps, per-pilgrim tracking, rejection/resubmission flow, room-level assignment, star-rating/distance-from-Haram, GPS tracking, dietary tracking, **multi-currency (SAR/USD/EUR/GBP)**, supplier invoice matching, installments, **ZATCA audit export**, driver certification, preventive maintenance.
- **Actions**: nav-only.

### 3.3 About `/about`
- **Entities**: Milestone ×6 (2006–2025), LeadershipMember ×4 (name, role, tenure), Office ×4 (Makkah HQ, Jeddah Airport Ops, Madinah Northern Hub, Riyadh Corporate), CompanyStat ×4.
- **Actions**: nav-only.

### 3.4 Contact `/contact`
- **Entity**: **Enquiry** `{type: agent|supplier|pilgrim|other, name*, company, email*, subject* (9 options), message*}` — submit currently `setSubmitted(true)` only, data discarded.
- **API**: `POST /enquiries`.

### 3.5 Login `/login`
- Role tabs `agent|supplier|admin` (with Arabic labels); email+password; fake 1.1s login → navigates to `/agent-portal` | `/supplier-portal` | `/super-admin`. "Forgot password?" dead. Prototype quick-nav to all 10 portals (remove for production).
- **API**: `POST /auth/login` (role-aware), `POST /auth/forgot-password`.

### 3.6 AuthOnboarding `/auth-onboarding` — registration flows (the compliance pipeline)
- **AgentApplication** (5-step wizard): docs (Trade License CR + Owner NID/Passport, OCR-extracted: company name, CR no `CR-1446-00923`, Hijri issue/expiry dates, owner name, ID `SA901234567`, nationality, DOB), profile (business email, website, office photos min 2, logo), finance (bank name, account no, IBAN `SA…24`, signed cheque upload, security-deposit proof), guarantors (2× {name, 10-digit NID, phone} + reference agent {agency, code `AGT-1446-XXXX`}), review + submit → **Application ID `AGT-1446-4827`**, status Pending.
- **Verification states** = AgentApplication.status enum: `pending | review | verified | rejected` (+ rejection `reason`), 4-stage timeline: Application Submitted → Initial Review → Document Verification → Compliance Approval.
- **SupplierApplication** (2-step): type `hotel|transport|catering` (type-specific fields: star rating/district; fleet size/vehicle type; daily meal capacity/halal cert body), company info (name, CR, contact, email, phone, city), docs (CR + type-specific certification) → ref `SUP-1446-7193`.
- **API**: `POST /agent-applications`, `GET /agent-applications/{id}`, `POST /agent-applications/{id}/resubmit`, `POST /supplier-applications`, `POST /ocr/extract`, document upload endpoints.

### 3.7 AgentPortal `/agent-portal` (shell + Dashboard, Profile, Documents)
- **Agent**: name, initials, agentCode `AGT-1446-4827`, company, city, memberSince, platformRating 4.8, verification status.
- **Dashboard KPIs**: activeGroups 12, pendingVisas 47, walletBalance SAR 24,850, unreadNotifications 3. **Season quotas** (per-agent, per-season): Groups 12/15, Pilgrims 222/280, Visa Quota 222/350 — Season "Umrah 1446H" 01 Jul 2025–25 Jun 2026.
- **Company Profile** — 10 sections each with own verification status: Trade License (CR fields, Hijri dates), Owner NID/Passport, Owner Profile (mobile/WhatsApp/address), Web & Email, Office Photos & Logo, Bank Account (bank, account 14-digit, IBAN, SWIFT `RJHISARI`), Signed Cheque (amount SAR 50,000, `CHQ-0001-2025`), Security Deposit (SAR 25,000, `TXN-1446-0091`, pending), Guarantor 1&2 (name, NID, mobile, relationship), Reference Agent.
- **Documents Vault**: Document `{id DOC-###, type, cat identity|business|financial|operations, filename, uploaded, expiry|null, status, size, ref}` — expiry warning bands <30d/<90d.
- **API**: `PATCH /agents/{id}/profile/{section}`, `GET/POST/PUT /agents/{id}/documents`, notification feed.

### 3.8 AgentPortalGroups (GroupsModule)
- **Group**: `{id GRP-1446-####, name, dest Makkah|Madinah|Makkah + Madinah, type "Umrah Visa"|"Long Stay", pax, status, depart, ret, per-service counts visa/hotel/transport/catering (of pax), created, pkg Economy|Standard|Premium}`.
- **Passenger**: `{id PAX-###, name, passport XX########, nat (10 nationalities), gender M|F, dob ISO, visa approved|pending|rejected, hotel confirmed|pending, transport confirmed|pending, moh cleared|pending}`.
- **Creation wizard** (3 steps): name, dest, package, depart/return dates, max capacity, notes → visa type (Umrah 14d single-entry / Long Stay 30–90d multi-entry) → intake method (Manual — *form doesn't exist yet* / Passport OCR / Excel import with column mapping A–F → name, passport, dob, nat, gender, phone; validation incl. 6-month passport-expiry rule).
- **Group detail tabs**: passengers (search, filter, pagination 20/page, bulk: download docs/send reminder/remove), flights (airline, flight no, from/to, date, time, terminal), hotel (property, stars, distance-from-Haram, check-in/out, nights, rooms, meal plan), transport (carrier, fleet ID, vehicle type, drivers per bus, pickup, route), catering (plan, dietary counts: halal standard/vegetarian/diabetic), documents (type, file, status), timeline (actor: agent/TUBA System/Visa Authority — audit log).
- **API**: `GET/POST /groups`, `GET /groups/{id}`, `POST /groups/{id}/passengers` (+ `/import`, OCR), bulk ops, per-tab reads.

### 3.9 AgentPortalServices (ServicesModule — 6 request screens)
- **VisaRequest**: group, Hijri application year, visa type umrah|longstay, Nusuk ref `NK-…`, Muallim no `MU-…`, Mahram waiver `MHW-…`, MOH package category A|B|C; batch status (approved/pending/rejected counts); tracker: Submitted → Nusuk/Muallim Verified → Ministry Approved → Processing → Printing & Delivery; history `REQ-V-####`.
- **FlightInfo**: arrival+departure blocks (airline, flight no, origin, dest, date, time, terminal), no-ticket option (upload ≥72h before departure), ticket PDF upload.
- **HotelRequest**: hotel catalogue `{name, stars, distance, price SAR/room/night, avail}`, check-in/out, double/triple room counts, meal plan (Full Board/Half Board/B&B/Room Only), special requests → voucher (guest, group, hotel, nights, rooms, pax, meal plan).
- **TransportRequest**: vehicle types (sedan 4 / hiace 12 / coaster 30 / bus 47 pax), departure point, destination, datetimes, vehicle qty, stop points → tracker with carrier match + driver confirm → voucher.
- **CateringRequest**: meal plans (Breakfast SAR 35 / Half 85 / Full 140 / Premium 200 per pax/day), dietary rows, live cost calc (price × pax × nights) → caterer allocation.
- **AdditionalService**: type (wheelchair, VIP lounge, SIM, insurance, photography, interpreter, currency exchange, other), beneficiaries, priority Normal|High|Urgent (SLA 3–5d / 1–2d / same-day), description, datetime; history `SVC-####`.
- **API**: `POST /visa-requests`, `POST/PUT /groups/{id}/flight-info`, `POST /hotel-requests`, `POST /transport-requests`, `POST /catering-requests`, `POST /service-requests`, voucher PDF endpoints.

### 3.10 AgentPortalFinance (FinanceModule)
- **Wallet**: balance 24,850 SAR; pending charges (ref, desc, amount, due, category hotel|visa|transport|catering).
- **LedgerEntry**: `{date, type credit|debit, desc, ref, amount, running balance}`.
- **TopUp**: `{ref TOP-####, date, amount, method (Al Rajhi/Alinma transfer, cheque), status}` — form: amount, method, transfer ref, date, notes.
- **PaymentSlip**: `{ref SLP-####, type Bank Transfer|Cheque|SADAD|Wire|Online Banking, amount, bank (Al Rajhi/Alinma/SNB/Riyad), transfer ref, date, group?, notes, file}` — reviewed 1–2 business days, wallet auto-updates on confirm.
- **FinancialDocument**: `{id FD-###, type invoice|receipt|hotel|transport|visa|ticket|other, ref, amount?, date, due?, status, size}`.
- **Statement**: period, type (full/summary/credits/debits), group filter, currency SAR|USD; opening/credits/closing.
- **Reports**: summary, group-pl, visa-cost, hotel, commission, **vat (15%)**.
- **API**: `POST /wallet/topups`, `GET /wallet/ledger`, `POST /payment-slips`, `GET /statements`, `GET /reports/{type}`, documents hub.

### 3.11 SupplierPortal `/supplier-portal`
- **Supplier**: `{name, code SUP-{HTL|TRN|CAT}-####, type hotel|transport|catering, contractedSince, bank account (beneficiary, bank, masked account, IBAN, SWIFT, currency)}`.
- **SupplierBooking**: `{id BKG-{HTL|TRN|CAT}-####, group, agent, pax, detail, dates, nights?, amount, status pending_acceptance|confirmed|rejected|completed}` — lifecycle: Request Received → Reviewed → Accepted & Confirmed → Service Delivered.
- **Accept** (2-step confirm) / **Reject** (required reason) — the only toast-wired actions in the ERP.
- **VoucherUpload**: related booking, type (per supplier type: hotel voucher/confirmation letter; bus permit/driver licence/vehicle registration; catering licence/meal schedule/health certificate), issue/expiry dates, notes, file.
- **SupplierInvoice**: invoice no `INV-YYYY-####`, booking, date, service period, amount excl. VAT, **VAT 15% auto-calc**, currency SAR, notes, PDF. Review 3–5 days; paid after agent confirms delivery.
- **Ledger**: settlements `STL-…` minus **platform fee 2.5%** `FEE-####`; pending `PEND-####`. **Payout**: `{id PAY-…-####, date|estimated, amount, bank, ref WIRE-YYYYMMDD, status paid|pending|processing}`.
- **API**: `POST /bookings/{id}/accept|reject`, `POST /supplier-vouchers`, `POST /supplier-invoices`, `GET /supplier/ledger|payments`, `PUT /supplier/bank` (KYC-sensitive).

### 3.12 OpsControl `/ops-control` (9 screens)
- **Group (ops view)**: id, agent, pax, hotel, city, dates, visa Ready|Pending|In Process, opsStatus ACTIVE|DELAYED|UPCOMING|COMPLETED.
- **Arrival**: `{id ARR-###, flight, airline, route JED→MKK, eta, pax, group, agent, vehicle|—, driver|—, status: SCHEDULED|DELAYED|LANDING|AT_GATE|IMMIGRATION|BAGGAGE|EN_ROUTE|DELIVERED}`.
- **Departure**: same + dep time, status: SCHEDULED|STANDBY|CHECK_IN|BOARDING|DEPARTED|DELAYED.
- **DispatchOrder**: `{id DSP-####, vehicle BUS B-##|VAN H-##, driver, pax, route, group, time, status ASSIGNED|EN_ROUTE|COMPLETED|DELAYED, note?}` — Kanban (static, **no drag-drop; react-dnd dep is unused**).
- **Meet & Assist**: 7 fixed steps per arrival (Flight Landed → … → Departed to Hotel) — per-(arrival,step) completion.
- **ZiyarahTrip**: `{id ZYR-####, group, date, sites, guide, vehicle, pax, status CONFIRMED|SCHEDULED|COMPLETED}`.
- **LongStay**: `{group, hotel, city, nights, checkIn/Out, pax, renewal N/A|Requested, status ACTIVE|RENEWAL|UPCOMING|COMPLETED}`.
- **BRN (Booking Request Number)**: `{id BRN-1446-####, group, agent, service (Hotel/Transport/Catering/M&A/Full Package combos), created, status OPEN|PROCESSING|FULFILLED|CANCELLED, detail}` — create form: group, service type, date required, priority, detail.
- **Voucher generator**: types (Hotel/Transport/Catering Order/Ziyarah Pass/M&A Pass), voucherNo `VCH-1446-<grp>-<SVC>`, issue/valid-until dates, rendered document (group ref, agent, pax, hotel/location, city, period, signatures: Operations Manager + Authorized Signatory) + **Send WhatsApp / Send Email**.
- **API**: boards (GET arrivals/departures/dispatches + status PATCH), `POST /dispatches`, M&A step toggles, `POST /ziyarah-trips`, long-stay renewals, `POST /brns` + status PATCH + print, voucher generate/PDF/send.

### 3.13 OpsDepartments `/ops-departments` (8 desks, SLA-driven queues)
- **VisaApplication desk** (SLA 72h): `{id VSA-####, group, agent, pax, type, embassy, status NEW|IN_PROCESS|PENDING|APPROVED|ESCALATED, priority LOW|NORMAL|HIGH|URGENT, hoursAgo, doc counts: passports/photos/forms/medical vs required, Mukhayam letter}` + 5-event timeline. Actions: Submit to Embassy, Request Docs, Mark Approved, Flag Issue, Print Summary.
- **HotelBookingRequest desk** (SLA 24h): `{id HTL-####, hotel, rooms "14 Dbl + 5 Tri", nights, ratePerRoom, mealPlan, contact, status NEW|RFQ_SENT|PENDING|CONFIRMED|ISSUE}` + computed VAT 15% totals + special requests. Actions: Send RFQ, Confirm Booking, Request Amendment, Generate Voucher, Escalate.
- **CRMTicket desk** (SLA 4h): `{id CRM-####, agent, contact, phone, type COMPLAINT|INQUIRY|ESCALATED|SUPPORT|REQUEST, topic, priority, status NEW|IN_PROGRESS|ESCALATED|RESOLVED|PENDING}` + conversation thread (sender Agent|Ops|Finance). Actions: reply, Transfer to Finance, Mark Resolved, Escalate, Schedule Call.
- **TransportOrder** (12h): `{id TRN-####, vehicle, driver, route, departure, status ASSIGNED|CONFIRMED|PENDING|ISSUE|COMPLETED}`.
- **CateringOrder** (24h): `{id CAT-####, mealPlan, pax, deliveryDate, caterer, status NEW|PENDING|CONFIRMED|ISSUE}`.
- **FinanceTicket** (48h): `{id FIN-####, ref PAY-|INV-|REF-|STL-####, type Agent Top-up|Supplier Invoice|Agent Refund|Supplier Settlement, entity, amount, dueDate, status PROCESSING|PENDING|OVERDUE|APPROVED|COMPLETED}`.
- **PurchaseOrder** (72h): `{id PO-1446-####, vendor, category Transport|Catering|Operations|IT|HR, item, amount, requiredBy, status NEW|PENDING|APPROVED|COMPLETED|OVERDUE}`.
- **HRTicket** (48h): `{id HR-####, employee, department, type Contract Renewal|Leave Request|Iqama Renewal|Promotion Request|Medical Leave|Overtime Claim, submitted, approver, status PENDING|APPROVED|IN_PROCESS|REJECTED}`.
- **API**: per-desk queue GET + workflow-action endpoints; SLA policy table (submittedAt + per-desk hours).

### 3.14 FinanceERP `/finance-erp` (13 screens)
- **IncomeEntry / ExpenseEntry**: `{id INC-|EXP-####, date, ref, entity, category (income: Visa/Hotel/Transport/Catering Services, Full Package; expense: Hotel/Catering/Transport Costs, Salaries, Overhead), amount, group?, status RECEIVED|PENDING|OVERDUE / PAID|PENDING}` — "Save Entry" posts to GL (toast-only today).
- **Ledgers**: Agent ledger, Supplier ledger, **GL** with ChartOfAccounts (codes seen: 1001 Cash Al Rajhi, 2001 AR Agents, 2101 AP Hotels, 3001 Revenue Visa, 4001 Hotel Costs, 4003 Staff Salaries) — double-entry `{date, acct, ref, dr, cr, desc}`.
- **AR/AP aging**: per-entity buckets 0–30 / 31–60 / 61–90 / 90+.
- **Cash & Bank**: BankAccount `{name, masked IBAN, balance, type}` ×3 + BankTransaction `{date, desc, ref SARIE-|TRF-|CHQ-|SAL-, type cr|dr, amount}`. Actions: New Transfer, Reconcile.
- **Multi-currency**: ExchangeRate `{code SAR|USD|BDT|EUR|GBP|TRY, rate-to-SAR 4dp, change, exposure}` + converter.
- **Invoice**: `{id INV-1446-####, date, to, toAddr (+agent license SAR-2024-####), group, items[{desc,qty,unit,total}], subtotal, VAT 15%, total, status OUTSTANDING|PAID}` — doc: Net 30 days, bank+IBAN, VAT Reg `310-XXX-XXXX`. Actions: New, PDF, Print, Send Email, Mark Paid.
- **Receipt**: `{id REC-1446-####, date, from, amount, method Bank Transfer (SARIE)|Cheque, bankRef, applies → invoice allocation, status CONFIRMED}`.
- **Statement generator**: entity, period, format (Full/Summary/Outstanding Only).
- **P&L** (hardcoded exemplar): revenue by service line, COGS, OpEx, EBITDA, depreciation, interest, **Zakat 2.5%**, net profit + monthly chart.
- **Balance Sheet**: full asset/liability/equity tree (incl. Agent Advance Payments, VAT Payable).
- **API**: journal entries, ledgers, aging, bank txns + transfers + reconciliation, FX rates, invoice CRUD + PDF/email/status, receipts + allocation, statements, P&L/BS reporting.

### 3.15 OCRCenter `/ocr-center`
- **Pipeline**: Upload → Scan → Validate → Dup. Check → Auto-Fill → Workflow → Done.
- **OCRJob**: `{id OCR-####, docType (15 types: Passport, Visa, Flight Ticket, Trade License, NID, Bank Cheque, Payment Slip, Invoice, Hotel/Transport/Catering Voucher, Vehicle Registration, Driver License, Contract, Statement), entity, confidence %, age, status PENDING|IN REVIEW|APPROVED|REJECTED, group?}`.
- **OCRExtractedField**: `{field, value, confidence, low?}` + user override (correction bumps conf) — passport set: doc type, surname, given names, doc no, nationality, dob, sex, expiry, place of issue, MRZ 1/2, photo quality. MRZ-vs-VIZ discrepancy alert.
- **Duplicate check**: match score vs existing PAX record; decisions `new|existing|merge|duplicate`.
- **Auto-fill**: target passenger record, field sources `ocr|system`.
- **WorkflowTrigger**: named triggers (record created, MRZ alert, dup cleared, visa-desk notify, group update, agent notify) status done|queued.
- Thresholds: auto-accept ≥82% (configurable), manual review <90%; review queue auto-refresh 30s.
- **API**: `POST /ocr/jobs` (multipart), job status (poll/WebSocket), field corrections, accept/dup-check/resolve/commit, review queue approve/reject/bulk/export.

### 3.16 SuperAdmin `/super-admin` (10 screens)
- **Company** (agent/supplier registry): `{id AGT-|SUP-1446-####, name, type Agent|Supplier, city, status verified|review|pending|suspended|rejected, groups count, joined}`.
- **User**: `{id USR-###, name, email, role, lastLogin, status active|inactive}`.
- **RBAC**: 10 permissions (View Dashboard, Manage Users, Approve Companies, Financial Reports, Edit Financial Records, Configure Workflows, Review OCR Queue, Access Audit Logs, Manage System Settings, API Key Access) × roles **CEO, Ops Manager, Finance Officer, Agent Support, IT Admin** (+ Supplier Liaison in users list; Automation as system pseudo-actor).
- **Workflow**: `{id WF-###, name, steps[], trigger, status active|paused, lastRun}`.
- **AutomationRule** (admin view): `{id AR-##, name, trigger (incl. cron "Every day at 02:00 AST"), action chain (MOFA API, ZATCA e-invoice, S3, GPS…), enabled, lastRun}`.
- **AI Engine**: model registry (Google Vision, AWS Textract, Anthropic Claude, Tesseract fallback), 2 confidence sliders, **APIKey** `{name, masked, status valid|expiring}` + rotate.
- **OCR doc-type stats**: accuracy/today/queue per 15 types.
- **NotificationEventConfig**: 14 events × channels `whatsapp|email|in_app` boolean matrix.
- **AuditLog**: `{ts, user (incl. System (Cron)/(OCR)), role, module, action CREATE|APPROVE|EDIT|EXPORT|RUN|VIEW|PROCESS|TOGGLE|REJECT|REVIEW, entity, ip}`.
- **SystemSettings**: org name, license `MOH-1446-GH-00291`, timezone, currency, platform language, support email; **Season config** (Umrah 1446H, code UMR-1446, Hijri start/end, Ramadan peak, Hajj window); **Integrations** (NUSUK, MHU, MOFA Visa Gateway, WhatsApp Business, ZATCA — endpoint + status connected|warning + test); Backup (frequency, retention, regions me-central-1/me-south-1).
- **API**: company CRUD + approve/suspend, user CRUD, role/permission CRUD, workflow CRUD + test-run, rule toggle, AI thresholds + key rotation, notification matrix persistence, audit query/export, settings PUT, integration tests.

### 3.17 AutomationNotifications `/automation`
- **AutomationRule** (rule-engine view): `{id R##, cat Agent|Group|Visa|Hotel|Finance|Docs|Sys|Esc, name, trigger, condition (DSL-like strings), actions[3–4], enabled, runs, lastRun}` + run stats (avg 340ms, 98.4% success) + execution log `{time, duration, status OK|WARN}`. Editable trigger/condition/action lists; Test Run; delete.
- **NotificationEventType**: `{id, label, priority low|normal|emergency, wa, email, inapp}` ×10 — emergency cannot be disabled (server-side rule).
- **MessageTemplate** (WhatsApp/Email/In-App) with variables: `{{agent_name}} {{email}} {{group_id}} {{arrival_date}} {{hotel_name}} {{pax_count}} {{voucher_ref}} {{voucher_link}} {{amount}} {{invoice_ref}} {{balance}} {{date}} {{alert_type}} {{location}} {{timestamp}} {{ops_contact}} {{event_type}} {{message_body}} {{reference}}`; senders `no-reply@tubalhijaz.sa`. Templates need bn/en variants (backend concern).
- **NotificationLog**: `{id NL-####, time, channel WhatsApp|Email|In-App, event, recipient (masked), preview, status DELIVERED|READ|FAILED|PENDING, priority}`.
- **InAppNotification**: `{id, type, label, body, time, read}` + delivery prefs (badge/sound/toast/persist).
- WASender API connection state (WhatsApp Business account VERIFIED).
- **API**: rule CRUD/toggle/test/executions, settings matrix PUT, template PUT + test-send, log query/export, notification read PATCH.

### 3.18 Dashboards `/dashboards` (8 read-only role dashboards — defines reporting endpoints)
- **CEO**: revenue-vs-expenses monthly series, module health ×9, top agents by revenue, pax by nationality, season targets (% achieved), KPIs (YTD revenue, net profit+margin, active groups, AR outstanding).
- **Ops**: hourly arrivals/departures series, pending tasks, department queue depth, flight schedule strip, visa app counts.
- **Finance**: monthly cash position, AR aging buckets, bank balances, revenue by category, AP aging, recent transactions.
- **Dispatch**: dispatches with progress %, driver statuses (EN ROUTE|AVAILABLE|STANDBY|DELAYED), vehicle utilization by class, SLA compliance, route performance (avg minutes).
- **Arrival/Departure boards**: flight cards, ground-service queue, immigration clearance counts, bus assignments, gate info, daily summaries.
- **Agent**: monthly pax volume, activity feed, active groups, visa status counts, invoice summary, wallet KPI.
- **Supplier**: booking forecast by service type, acceptance queue, upcoming services, payment schedule, performance metrics (readiness %, quality score, voucher accuracy, response time).
- **API**: per-role aggregate endpoints (`GET /dashboards/{role}` or per-widget reporting endpoints).

### 3.19 WorkflowMap `/workflow-map` — **canonical 19-stage state machine**
Phases: 1 Pre-Travel & Onboarding (1–6), 2 Service Booking & Finance (7–13), 3 On-Ground Operations (14–19).
Stages (id, module, SLA): 1 Agent Registration (instant) · 2 Verification (48h) · 3 Agent Approval (4h) · 4 Group Creation (instant) · 5 Pax OCR/Excel (<2min/pax) · 6 Flight & Ticket (same-day) · 7 Visa Processing (3–10d MOFA) · 8 Hotel Booking (2–5d) · 9 Transport Dispatch (48h before arrival) · 10 Catering (72h before start) · 11 Invoice (24h after confirmation) · 12 Payment (Net 30) · 13 Voucher (24h after payment) · 14 WhatsApp & Email (instant, automated) · 15 Arrival (2h of landing) · 16 Stay (ongoing) · 17 Departure (4h before STD) · 18 Final Statement (5d of return) · 19 Archive (30d after departure, **7-year compliance retention**).
Group tracker: `group.currentStage` (1–19) + note; derived stage status COMPLETED|IN_PROGRESS|PENDING|BLOCKED.
- **API**: `GET /groups/{id}/pipeline`, stage catalog, groups-at-stage counts.

### 3.20 MobileApps `/mobile-apps` (mobile API surface)
- **Driver app**: trips (DSP-###, time, from/to, pax, ACTIVE|UPCOMING|DONE), vehicle profile (bus `TAH-07`, plate, ON DUTY), trip detail (pickup/dropoff, dist, ETA), passenger list (seat), navigation, **headcount confirmation** (expected/boarded/disembarked/discrepancy), driver documents (license/registration/insurance/inspection, expiry, VALID|EXPIRING), trip completion + **driver earnings (SAR 180/trip)**.
- **Agent app**: groups (season, IN_STAY|HOTEL|FLIGHT|ARCHIVED, stage), wallet + txns + top-up request, group services status, 14-step status tracker, OCR passport camera capture, notifications.
- **Ops app**: arrivals/departures cards, dispatch assignment (assign driver), **emergency detail** (group, driver, delay, last GPS, contact) + re-dispatch, live overview.
- **Supervisor app**: pending approvals `{VIS-|HOT-|TRN-|CAT-|FIN-####}` approve/reject, visa/hotel approval details, KPI snapshot, module health, escalations HIGH|MEDIUM|LOW + acknowledge.
- **API**: everything above + push notifications; approval-decision endpoints per type.

### 3.21 Tablet `/tablet`
Mostly layout spec. Adds: Group.**name** field ("Dhaka Hajj Group A"), Passenger seat/status (checked-in|pending|boarding), **financial Approval taxonomy** `{id AP-##, type Rate Change|Group Discount|Refund Request|Credit Limit, agent, amount, priority high|normal}` + approval history timeline (Submitted → Auto-check Passed → Finance Review → Supervisor Approval) — must be reconciled with MobileApps' service-type approvals.

### 3.22 DesignSystem `/design-system` & I18nSystem `/i18n-system`
Documentation pages — **no backend needs**. Vocabulary worth keeping: status enum with Arabic labels (pending/verified/rejected/in_progress/completed), demo VisaApplication `VA-1446-###`, Arabic name field (`nameAr`) implied. I18nSystem defines the 14 translatable status StringKeys: `approved, pending, inProgress, completed, cancelled, active, onDuty, archived, delayed, urgent, atGate, enRoute, inStay, scheduled`.

---

## 4. Consolidated entity catalog (→ Prisma schema, next phase)

**Identity & access**: User (email, password, role, status, lastLogin), Role, Permission, RolePermission,
Session/RefreshToken, AuditLog.
**Onboarding**: AgentApplication (+status timeline events, rejection reason, documents, OCR extractions),
SupplierApplication, Enquiry.
**Parties**: Agent (code, company, CR, owner identity, bank, cheque, security deposit, guarantors ×2, reference agent,
platform rating, quotas), Supplier (code, type, bank, contract, performance metrics), Employee (HR), Guarantor.
**Season**: Season (Hijri code 1446H, start/end, peak windows) — first-class dimension; per-agent SeasonQuota
(groups/pilgrims/visa).
**Core ops**: Group (id, name, agent, season, dest, type, package, dates, pax, currentStage 1–19, opsStatus),
Passenger (passport, nationality, gender, dob, per-service statuses, MOH clearance, seat), WorkflowStage catalog
(19 stages, SLAs), GroupTimelineEvent (audit trail).
**Service requests**: VisaRequest/Batch (+Nusuk/Muallim/Mahram refs, MOH category, per-pax status, embassy),
FlightInfo (arrival+departure legs, tickets), HotelRequest/Booking (+Hotel catalogue: stars, distance, rates),
TransportRequest/DispatchOrder (+Vehicle, Driver + documents + earnings, carrier/fleet), CateringRequest/Order
(+MealPlan pricing, dietary counts, caterer), AdditionalServiceRequest, BRN, ZiyarahTrip (+Guide), LongStay
(+renewals), MeetAssistChecklist (per-arrival step completion), Arrival, Departure.
**Finance**: Wallet, WalletLedgerEntry, TopUp, PaymentSlip, PendingCharge, Invoice (+items, VAT 15%),
Receipt (+invoice allocation), ChartOfAccounts, GLEntry (double-entry), BankAccount, BankTransaction,
ExchangeRate, SupplierSettlement (+platform fee 2.5%), Payout, Statement, Expense, PurchaseOrder (+Vendor),
FinanceTicket, financial Approval (rate change/discount/refund/credit limit).
**Departments**: CRMTicket (+conversation messages), HRTicket, department SLA policies.
**Documents & OCR**: Document (vault + per-group + financial; category, expiry, verification status),
OCRJob, OCRExtractedField (+corrections), DuplicateResolution, doc-type catalog (15).
**Automation & notifications**: AutomationRule (+executions), NotificationEventConfig (event × channel),
MessageTemplate (bn/en variants), NotificationLog, InAppNotification, Escalation, Voucher (generated docs + send log).
**Platform**: SystemSettings, Integration (+status), APIKey, SupportTicket, backup records.

## 5. Enum & convention notes

- **Statuses are inconsistent across pages** (UPPER_SNAKE vs lowercase vs Title Case vs i18n camelCase keys) —
  DB should use stable UPPER_SNAKE enums; UI maps to display/translation keys.
- **IDs follow `{PREFIX}-{HijriSeason}-{serial}`** (AGT-1446-4827, GRP-1446-2891, INV-1446-0091, BRN-1446-0091,
  VCH-1446-2891-HOT, SUP-1446-7193, PO-1446-0331…) with short forms used inconsistently (GRP-2891) — store
  season + serial, render the display id.
- **Money**: SAR integers dominate; multi-currency (SAR/USD/BDT/EUR/GBP/TRY) with 4dp rates; VAT **15%**;
  platform fee **2.5%**; Zakat **2.5%**. Use DECIMAL, store currency.
- **Dates**: mock data mixes display strings, ISO, Hijri strings ("01 Muharram 1446H"), relative times — API returns
  ISO timestamps; Hijri is a render concern (+ store Hijri season code). Frozen "today" in mocks = 2025-07-16.
- **Business rules embedded in UI copy**: passport must be valid ≥6 months for Saudi visa; ticket upload ≥72h before
  departure; deposit review 1–2 days; invoice review 3–5 days; emergency notifications cannot be disabled;
  vouchers issued within 24h of supplier acceptance; Net-30 terms; 7-year archive retention.

## 6. Implied API endpoint groups

Auth (`/auth/login`, `/auth/forgot-password`, refresh) · Enquiries · Agent/Supplier applications (+resubmit, status timeline)
· Agents (profile sections, documents, quotas) · Groups (CRUD, passengers + OCR/Excel import, pipeline, per-service tabs)
· Service requests (visa/flight/hotel/transport/catering/additional) · Suppliers (bookings accept/reject, vouchers,
invoices, ledger, payouts, bank) · Ops (arrival/departure boards, dispatches, M&A checklists, ziyarah, long-stay, BRN,
voucher generator + WhatsApp/email send) · Departments (8 desk queues + workflow actions + SLA) · Finance (journal,
ledgers, AR/AP, bank, FX, invoices, receipts, statements, P&L/BS) · OCR (jobs, corrections, duplicate resolution,
commit, review queue) · Admin (companies, users, RBAC, workflows, rules, AI config, API keys, notification matrix,
audit, settings, integrations) · Notifications (templates, log, in-app read) · Dashboards (per-role aggregates)
· Mobile (driver trips/headcount/documents/earnings, approvals, emergencies) · WebSockets (live boards, dispatch
progress, notifications — @nestjs/websockets is in place for this).

## 7. Bugs & dead code found (recorded, NOT fixed — UI frozen)

1. **`Login.tsx:171`** — `onClick={() => { setTab(t.id); setError(""); }}` calls `setError`, which is **not defined**
   in that component → runtime crash when switching login tabs.
2. **`OpsDepartments.tsx:258`** — renders `<X size={10}/>` but only `XCircle` is imported → ReferenceError whenever a
   visa doc-checklist item is 0/N (true for the default-selected VSA-0091 medical row).
3. **react-dnd + react-dnd-html5-backend** are dependencies but never imported anywhere (Dispatch Kanban is static).
4. Dead affordances (buttons/links with no handler) throughout — full list embedded per page in §3.
5. Contact form `<select>` submits localized display strings as values.
6. Footer lists 8 services vs 6 elsewhere; hotel/transport tab-label casing nit in GroupsModule.
7. `daysUntil()`/default dates hardcode "today" = 2025-07-16 in AgentPortal + several date inputs.
8. Group detail flight tab (JED→RUH) contradicts Services flight screen (JED→MKK) — mock divergence.
9. Tablet page uses divergent ID/status conventions (GRP-104x, D-###, lowercase statuses).
10. SuperAdmin "Platform Language: English/Arabic/Bilingual (EN+AR)" conflicts with the bn/en i18n system.
