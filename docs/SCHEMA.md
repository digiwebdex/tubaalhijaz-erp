# TUBA AL HIJAZ — Database Schema (ER summary)

> Prisma schema: `apps/api/prisma/schema.prisma` · Initial migration:
> `apps/api/prisma/migrations/20260717040000_init/` (generated offline, NOT applied anywhere yet)
> 51 tables · 47 enums · 114 indexes. Notation below: `A ──< B` = one-to-many, `A ──1 B` = one-to-one,
> `[T]` = has `tenantId` (agent-company row-level scoping), `[S]` = has `supplierId` scoping.

## 1. Platform backbone

```
Season ──< Group / Invoice / VisaRequest / AgentSeasonQuota
  (Hijri season, e.g. UMR-1446 · every business code embeds the year: GRP-1446-2891)

WorkflowStage (catalog: 19 stages, 3 phases, bn+en labels, SLA text)
  └──< Group.currentStage   (the master-plan 19-stage lifecycle pointer)

Role ──< User >── Company          RolePermission >── Permission
  Roles: CEO, OPS_MANAGER, FINANCE_OFFICER, AGENT_SUPPORT, IT_ADMIN,
         SUPPLIER_LIAISON, AGENT, SUPPLIER, DRIVER
  Permissions: the Super Admin matrix's exact 10 keys
  User.companyId null ⇒ TUBA platform staff

AuditLog (actor User? | actorLabel "System (Cron)", action enum, module,
          entityType+entityId, before/after JSON, ip)   — indexed (entityType, entityId)
```

## 2. Tenancy

```
Company (THE tenant · type AGENT | SUPPLIER · code AGT-1446-4827 / SUP-HTL-4291
         verificationStatus: PENDING → UNDER_REVIEW → VERIFIED | REJECTED | SUSPENDED)
  ├──1 AgentProfile (CR/trade license + Hijri strings, owner NID/passport & profile,
  │      cheque, security deposit + ReviewStatus, reference agent, platformRating)
  │      ├──< Guarantor (exactly positions 1 & 2)
  │      └──< AgentSeasonQuota (groups/pax/visa quotas per season)
  ├──1 SupplierProfile (type HOTEL|TRANSPORT|CATERING + type-specific fields:
  │      starRating/district · fleetSize/vehicleType · mealCapacity/halalCertBody)
  ├──< BankAccount
  ├──1 Wallet ──< WalletTransaction (CREDIT/DEBIT, balanceAfter, refType/refId)
  └──< User (portal logins)

Enquiry (public contact form; type AGENT|SUPPLIER|PILGRIM|OTHER) — standalone
```

**Multi-tenancy rule**: every agent-owned row carries `tenantId → Company` (indexed with status);
supplier assignment uses a separate `supplierId → Company`. Suppliers only see rows where
`supplierId = their company`; agents only `tenantId = their company`.

## 3. Core operations

```
Group [T] (code GRP-1446-2891, season, destination, visaType UMRAH|LONG_STAY,
           package, dates, paxCount, status, opsStatus, currentStage 1–19)
  ├──< Passenger [T] (PAX-001 per group, passport, nationality, gender, dob,
  │       visaStatus / hotelStatus / transportStatus / mohStatus,
  │       ocrDocumentId → OcrDocument   ← OCR source-document link)
  ├──< FlightInfo [T] (ARR-/DEP-, direction, airline, flightNo, IATA pair,
  │       scheduledAt, terminal, gate, status: full arrival+departure board enum)
  │       ├──< MeetAssistTask (7 fixed steps per arrival, done/completedAt)
  │       └──< DispatchOrder (link when airport transfer)
  ├──< Ticket (file, flightInfo?, passenger?, ReviewStatus)
  ├──< VisaRequest / HotelBooking / TransportBooking / CateringBooking /
  │    AdditionalServiceRequest / BRN / Voucher / ZiyarahTrip / DispatchOrder
  ├──< Invoice / LedgerEntry / PaymentSlip (finance links)
  └──< OcrDocument
```

## 4. Service bookings — shared state machine

All five request models carry `status ServiceRequestStatus`:
`REQUESTED → ASSIGNED → CONFIRMED → VOUCHER_ISSUED → COMPLETED` (+ REJECTED, CANCELLED)

```
VisaRequest  [T] (Nusuk/Muallim/Mahram refs, MOH category A|B|C, embassy, Hijri year)
HotelBooking [T][S] ──> Hotel (catalogue: stars, distance-from-Haram, rate, bn name)
             (rooms by type, meal plan, rate/subtotal/VAT/total, special requests)
TransportBooking [T][S] (vehicleType, count, route, stop points, depart/return)
CateringBooking  [T][S] (meal plan, price/pax/day, dietary counts, period, total)
AdditionalServiceRequest [T] (8 service types, beneficiaries, priority, window)

BRN [T] (BRN-1446-0091 · groups ⇄ hotel contracts: hotelBookingId?, serviceScope,
         status OPEN|PROCESSING|FULFILLED|CANCELLED)
Voucher [T] (VCH-1446-2891-HOT · type HOTEL|TRANSPORT|CATERING|ZIYARAH|MEET_ASSIST,
         generic refType/refId to source booking, payload JSON snapshot,
         status DRAFT|ISSUED|SENT|CANCELLED, sentWhatsappAt/sentEmailAt)
ZiyarahTrip [T] (sites bn+en, guide, vehicle, status)
```

## 5. Finance ERP

```
Wallet ──< WalletTransaction            PaymentSlip (SLP- · purpose TOPUP/INVOICE/
  (agent prepaid balance)                 DEPOSIT · ReviewStatus, reviewedBy → wallet credit)

Invoice [T] (INV-1446-0091 · season, VAT 15% columns, status DRAFT|OUTSTANDING|
  │           PAID|OVERDUE|CANCELLED, Net-30 dueDate)
  ├──< InvoiceItem (bn+en descriptions, qty, unit, total)
  └──< ReceiptAllocation >── Receipt (REC- · method incl. SARIE, bankRef)
        (a receipt settles many invoices; an invoice takes many receipts)

LedgerEntry — DISCRIMINATED ledger (ledgerType):
  AGENT    → companyId (agent sub-ledger: invoices dr / payments cr)
  SUPPLIER → companyId (settlements cr / 2.5% platform fee dr)
  GENERAL  → accountId → ChartAccount (double-entry GL; codes 1001/2001/2101/3001/4001/4003)

Statement (period, opening/credits/debits/closing, per company)
CurrencyRate (SAR-base: USD/BDT/EUR/GBP/TRY, Decimal(12,4), unique per (currency, asOf))
```

## 6. Fleet ERP

```
Vehicle (BUS B-12 / TAH-07, type, plate, seats, status, supplier? = null ⇒ TUBA-owned)
  ├──< DispatchOrder (DSP-0441 · group, flight?, driver?, route, pax, scheduledAt,
  │       status ASSIGNED|EN_ROUTE|COMPLETED|DELAYED|CANCELLED, progressPct, note)
  ├──< FuelLog (liters, cost, odometer)
  ├──< MaintenanceRecord (PREVENTIVE|REPAIR|INSPECTION, cost, nextDueDate)
  └──< InsurancePolicy (policyNo, period, premium, status; indexed endDate for expiry alerts)
Driver (license+expiry, status, rating, supplier?, userId? → driver-app login)
  └──< DispatchOrder / FuelLog
```

## 7. OCR / AI Center

```
OcrDocument (OCR-0441 · documentType = the master plan's 15 types,
  extractedFields JSON [{field, value, confidence, low, note}], confidenceScore,
  mrzDiscrepancy, duplicateOfId → self-relation, reviewStatus PENDING|IN_REVIEW|
  APPROVED|REJECTED, uploadedBy/reviewedBy, tenant?, group?)
  └──< Passenger.ocrDocumentId (auto-fill provenance)
```

## 8. Automation + Notification engines

```
AutomationRule (R01–R12 · category, trigger, conditionExpr DSL string, actions JSON,
  enabled, cronExpr for scheduled rules)
  └──< AutomationRunLog (startedAt, durationMs, status OK|WARN|ERROR)

NotificationEvent (14-event catalog, bn+en labels, priority LOW|NORMAL|EMERGENCY,
  per-channel enablement booleans — the Super Admin matrix)
  ├──< MessageTemplate (unique per event × channel × lang; {{variable}} bodies bn+en)
  └──< NotificationLog (NL- · channel WHATSAPP|EMAIL|IN_APP, recipient user/address,
        status PENDING|DELIVERED|READ|FAILED, readAt = in-app read state)
```

## 9. Hot-path indexes (live boards)

- `FlightInfo @@index(direction, status, scheduledAt)` — Arrival/Departure boards
- `DispatchOrder @@index(status, scheduledAt)` + `(driverId, status)` — Dispatch kanban / driver app
- `Group @@index(opsStatus)` + `(tenantId, status)` + `(currentStage)` — Group Master / pipeline
- All bookings: `(tenantId, status)`, `(supplierId, status)`, `(status)` — desk queues & supplier portal
- `Invoice (status, dueDate)` — overdue escalation; `LedgerEntry (ledgerType, companyId, date)` — statements
- `Passenger (passportNo)` — OCR duplicate check; `NotificationLog (recipientUserId, status)` — unread badge
- `CurrencyRate (currency, asOf DESC)` — latest-rate lookup

## 10. Deliberate deferrals (later migrations, per MVP-first scope)

CRM/HR/Procurement desk tickets (OpsDepartments' 3 light desks), LongStay renewals,
financial Approval workflow (rate change/discount/refund/credit limit), driver earnings,
SupportTicket, SystemSettings/Integration/ApiKey registry, MOFA/Nusuk sync-state tables,
per-field OCR correction history (currently inside extractedFields JSON), notification
delivery-provider metadata. None of these change existing tables' shapes — they only add.

## Seed data (prisma/seed.ts)

Idempotent (wipes + reseeds). Bilingual bn+en on every localized text column. Contains:
1 season (UMR-1446, active, relative dates) · 19 workflow stages · 10 permissions ·
9 roles + matrix · 12 users (password `Demo@123`) · 5 agent + 3 supplier companies
(full Rashidi profile: CR, owner, cheque, deposit, 2 guarantors, reference agent, quota) ·
5 hotels · 5 groups (audit-canonical codes GRP-1446-2891…) · 75 passengers (bn names for
Bangladeshi pax, passport prefixes by nationality, per-stage service statuses) ·
7 flights (today's arrivals/departures for live boards) + M&A checklist + 2 tickets ·
6 dispatch orders (all kanban columns incl. a DELAYED with note) · 5 vehicles · 6 drivers ·
fuel/maintenance/insurance rows · 3 visa requests · 3 hotel + 2 transport + 2 catering +
2 additional-service bookings · 2 BRNs · 3 vouchers · 2 ziyarah trips · 7 GL accounts ·
2 invoices (incl. the audit's INV-1446-0091 = SAR 323,725) + items · 1 receipt allocated
across both invoices · Rashidi wallet = SAR 24,850 via 5 transactions · 2 payment slips ·
10 ledger entries across all three ledger types · 1 statement · 5 FX rates ·
7 OCR documents (incl. a duplicate pair + MRZ discrepancy) · 12 automation rules + 24 run
logs · 14 notification events + 10 bilingual templates + 6 logs · 2 enquiries (one Bangla) ·
6 audit-log rows.
