# TUBA AL HIJAZ — Business Transformation Architecture (Phase 3)

**Date:** 2026-08-01  
**Status:** Official architecture decision document  
**Inputs:** [`BUSINESS_DISCOVERY.md`](./BUSINESS_DISCOVERY.md) · [`BUSINESS_CROSS_MATCH.md`](./BUSINESS_CROSS_MATCH.md) · existing ERP  
**Mode:** Decisions only — no implementation, no code, no tickets, no roadmap  

---

## 1. Executive Summary

The existing ERP is a broad operations platform (score **42/100** business fidelity). Transformation means bending that platform to the **real Tuba Al Hijaz business** defined in Word/Excel — not replacing it with a greenfield system.

**Philosophy in one line:** Reuse the spine (auth, tenancy-as-counterparties, groups, services, ops, finance GL/wallet, OCR queue, notify/automation, portals); **modify workflows and fields** to match Nusuk/Excel; **extend** only where business rules have no home (day-85, MOFA bill, Sub EA, HR/payroll, mutamer Excel columns).

| Decision class | Intent |
|----------------|--------|
| **KEEP** | Working engines that already serve business outcomes |
| **MODIFY** | Same module, different workflow/fields/UI to match business |
| **EXTEND** | Add missing business surfaces onto existing modules |
| **MERGE** | Collapse parallel progress models into one business-visible flow |
| **REUSE** | Call existing APIs/tables/screens as the implementation vehicle |
| **HIDE** | Non-business or premature surfaces removed from primary UX |
| **REMOVE** | Only true dead weight with zero reuse path (rare) |

**Estimated reuse of existing ERP asset value: ~68%.**  
**Transformation readiness score: 62/100** (architecture can land on current foundation).

---

## 2. Transformation Philosophy

1. **Business is SoT** — Word + Excel win over product speculation.  
2. **One company** — Tuba operates the ERP; Agents/Suppliers are counterparties, not SaaS tenants of peer ERPs. Keep `Company` rows technically; frame UX as Tuba’s counterparties.  
3. **Group Number is the spine** — every hotel/transport/catering/finance/voucher/long-stay action keys off it.  
4. **Mutamer has no portal** — never add one.  
5. **Reuse first** — prefer field/workflow/UI changes over new modules.  
6. **Do not delete finance GL, wallet, OCR queue, BullMQ, or portal shells** — they are leverage.  
7. **Excel contract is the passenger/group UI contract** until business changes it.  
8. **Hide ≠ delete** — ComingSoon/fleet/extra services may remain in codebase but exit primary business navigation until business asks.  
9. **MODIFY status languages** where Excel uses WAITING/APPROVED/checkboxes — map or dual-label; do not invent a second unrelated ops product.  
10. **No greenfield rewrite** — transformation is convergence.

---

## 3. Reuse Strategy

| Layer | Reuse approach |
|-------|----------------|
| Auth/JWT/RBAC | **REUSE** shell; **MODIFY** website login visibility; **EXTEND** permissions for desks/HR |
| `Company` AGENT/SUPPLIER | **REUSE**; **EXTEND** supplier subtype (UMRAH_CO / HOTEL / TRANSPORT / CATERING) |
| `Group` / `Passenger` | **REUSE** entities; **EXTEND** Nusuk/Excel fields; **MODIFY** create/import UX |
| Services (hotel/transport/catering/visa) | **REUSE** booking engines; **MODIFY** hotel approval + agreement; **EXTEND** HAJJ |
| Ops boards | **REUSE** as GROUP DETAILS / transport schedule home |
| `BRN` | **REUSE** entity; **EXTEND** inventory economics |
| `Voucher` + PDF generator | **REUSE** pipeline; **MODIFY** template to bilingual Tuba sheet |
| `LongStay` + ops API | **REUSE**; **EXTEND** host/Iqama/Absher/day-85 |
| Finance GL/wallet/invoices | **REUSE** ledger; **EXTEND** MOFA bill type + pay-source; **MODIFY** dashboards/reports |
| OCR + `tuba-ocr` | **REUSE** queue; **EXTEND** group-list document type → create/update Group |
| Notifications + `tuba-notify` | **REUSE** channels; **EXTEND** day-85 + group-gate events; **MODIFY** matrix toward “material updates” |
| Automation + `tuba-automation` | **REUSE** for schedules (day-85, backups) |
| Agent/Supplier portals | **REUSE** shells; **MODIFY** screens to Excel workflows |
| Documents/Uploads | **REUSE** for tickets/receipts/passport/Nusuk images |
| Dashboards | **REUSE** service; **MODIFY** widgets to dues/group process/LS red cards |
| Fleet | **HIDE** from primary business IA (keep code); optional later |
| Enquiry / ComingSoon demos | **HIDE** / **REMOVE** from navigation |

---

## 4. Architecture Preservation Rules

| Rule | Keep intact |
|------|-------------|
| P1 | Nest monorepo + Prisma + Postgres + Redis + MinIO |
| P2 | JWT auth, refresh cookies, RBAC permission keys mechanism |
| P3 | Agent/Supplier counterparty `Company` model (semantic framing only changes) |
| P4 | Double-entry GL + append-only ledger discipline |
| P5 | Wallet idempotent deductions |
| P6 | BullMQ queues (`tuba-ocr`, `tuba-notify`, `tuba-automation`) |
| P7 | Socket.io namespaces pattern (`/ops`, `/notifications`) with JWT |
| P8 | Upload confirmToken hardening |
| P9 | Supplier accept → confirm → voucher pipeline (adjust labels/fields, keep engine) |
| P10 | No customer/mutamer login role |
| P11 | Audit log store (extend writes later; do not drop table) |
| P12 | Production compose/deploy path |

**Forbidden by this architecture (as strategy):** rewrite from scratch; drop finance GL; drop portals; introduce mutamer self-service; treat Agents as independent ERP product customers.

---

## 5. Module Decisions

| Module | Decision | Workflow | UI | DB | Perms | Notify | Dash | Report |
|--------|----------|----------|----|----|-------|--------|------|--------|
| Auth | **MODIFY** | — | Login tabs | — | — | — | — | — |
| Users/RBAC | **EXTEND** | — | role screens | optional Host as contact not user | desk/HR keys | — | — | — |
| Companies | **EXTEND** | verification **KEEP** | supplier type UX | subtype / Umrah Co | **KEEP** | **KEEP** agent events | — | supplier-wise |
| Groups | **MODIFY+EXTEND** | Nusuk-first | Group board like Excel | nusuk code, WA, gates | — | on create/gates | group process | group code |
| Passengers (Mutamer) | **MODIFY+EXTEND** | Excel import | Excel columns UI | MOFA/bio/type/SubEA/age | — | visa updates | — | mutamer status |
| Visa / Services | **MODIFY+EXTEND** | **KEEP** machine + map labels | desk UI | HAJJ enum; link Umrah Co | desk perms | visa events | — | — |
| Hotel | **MODIFY+EXTEND** | approval WAITING/APPROVED mapped | dual city UI | agreementNo; city pair | — | hotel approval | waiting count | — |
| Transport | **MODIFY+EXTEND** | schedule-centric | form+schedule screens | links to files; route enums | — | transport updates | today legs | — |
| Catering | **KEEP** | **KEEP** | minor UX | — | — | **KEEP** | — | — |
| BRN | **EXTEND** | inventory | BRN sold screen | price/days/pax/used | — | — | utilization | BRN report |
| Voucher | **MODIFY** | **KEEP** generate | preview like Excel | payload fields | — | **KEEP** | — | voucher register |
| Long Stay | **EXTEND** | host+90d+day85 | mutamer/host UI | host/Iqama/Absher | — | day-85 pack | red cards | expiry |
| Ops / Dispatch | **REUSE+MODIFY** | Excel schedule | boards = SoT views | — | VIEW_DASHBOARD **MODIFY** scope | ops WA | ops KPIs | — |
| Finance | **REUSE+EXTEND** | MOFA vs cash split | bill sheet + dues | invoice kind / pay source | **KEEP** | payment events | dues | D/M/Y packs |
| Agent Finance | **KEEP+MODIFY** | wallet **KEEP** | align dues language | — | — | slip confirm | agent due | — |
| OCR | **EXTEND** | group image path | OCR center modes | doc type GROUP_LIST | **KEEP** review | — | — | — |
| Documents/Uploads | **REUSE** | attach tickets/receipts | — | — | — | — | — | — |
| Notifications | **MODIFY+EXTEND** | material updates + day85 | automation UI **KEEP** | events | — | matrix | bell/red | — |
| Automation | **REUSE+EXTEND** | schedule day-85 | **KEEP** admin | rules | **KEEP** | — | — | — |
| Dashboards | **MODIFY** | — | Word KPIs first | — | **KEEP** | — | rebuild widgets | — |
| Reports | **EXTEND** | — | report hub | queries on existing | FINANCIAL_REPORTS | — | — | Word list |
| Website | **MODIFY** | info-only **KEEP** | agent-only entry | — | — | — | — | — |
| Agent Portal | **MODIFY** | same as staff group ops | Excel workflows | — | — | WA | cards | — |
| Supplier Portal | **KEEP+MODIFY** | accept/reject **KEEP** | type-specific UX | subtype | — | — | supplier dash | — |
| Fleet | **HIDE** (preserve) | — | out of primary nav | **KEEP** tables | **KEEP** key | expiry **KEEP** | hide fleet widgets | — |
| HR/Payroll | **EXTEND** (new on empty desk) | standard HR | replace EmptyState | new emp/pay models | new perms | — | — | payroll |
| Audit | **KEEP** | — | **KEEP** | **KEEP** | **KEEP** | — | — | — |
| CRM/Procurement UI | **HIDE** | — | remove/hide tabs | — | — | — | — | — |
| ComingSoon demos | **HIDE** | — | demote routes | — | — | — | — | — |
| Enquiry model | **REMOVE** or **HIDE** forever | — | — | deprecate | — | — | — | — |
| Driver role/app | **HIDE** | — | — | **KEEP** | — | — | — | — |

---

## 6. Workflow Decisions

| Business workflow | Decision | Detail |
|-------------------|----------|--------|
| Phase-1 OCR → Group Number | **EXTEND** OCR + **MODIFY** Groups create | New doc type; create/update Group from review |
| Phase-1 Excel mutamer upload | **EXTEND** import on **REUSE** bulk API | Map sample columns; keep bulk underneath |
| Phase-2 hotel/transport/catering by Group+Agent | **KEEP** services engine | Enforce group+agent; dual hotel UX |
| Checkbox VISA/PACKAGE/PAYMENT/BILL | **EXTEND** on Group | Booleans + notify on change; **MERGE** with stage catalog visibility |
| Hotel WAITING→APPROVED | **MODIFY** mapping | Either add approval substatus or map ASSIGNED/CONFIRMED ↔ WAITING/APPROVED in UI |
| Transport form + schedule | **MODIFY** Transport/Ops UI | One request form + schedule board over existing tables |
| Voucher issue | **MODIFY** template | Same generate pipeline |
| BRN sold | **EXTEND** BRN | Inventory fields + formula rule |
| Long Stay + day-85 | **EXTEND** LongStay + Automation | Host fields + scheduled job |
| MOFA bill | **EXTEND** Finance | Invoice subtype / dedicated bill; approval sign |
| Supplier pay source | **EXTEND** Finance | bank/cash/mobile on payment |
| WhatsApp updates | **MODIFY** event matrix | Fire on material group/service/finance/LS events |
| Website login | **MODIFY** | Public agent entry; staff URL separate/unlisted |
| HR/Payroll | **EXTEND** | Fill HR desk; new data |
| Ziyarah | **KEEP** + **EXTEND** voucher movements | Reuse ZiyarahTrip |
| No duplicate Group Number | **MODIFY** Groups | Unique on Nusuk number field; shared staff/agent view **KEEP** |

---

## 7. Screen Decisions

| Screen | Decision |
|--------|----------|
| `/agent-portal` | **MODIFY** — Group Details board, Excel upload, dual hotel, transport request |
| `/supplier-portal` | **KEEP** shell; **MODIFY** copy/fields per supplier subtype |
| `/ops-control` | **REUSE** as live ops; align columns to Excel schedule/group master |
| `/ops-departments` | **MODIFY** Visa/Hotel/Transport/Catering/Finance desks; **HIDE** CRM/Procurement; **EXTEND** HR |
| `/finance-erp` | **KEEP** GL screens; **EXTEND** MOFA bill + dues + pay source |
| `/ocr-center` | **EXTEND** mode: Group List OCR vs Passport OCR |
| `/automation` | **KEEP**; configure day-85 + update rules |
| `/dashboards` | **MODIFY** widget set to Word KPIs |
| `/super-admin` | **KEEP** users/companies; trim non-business placeholders |
| `/`, marketing | **MODIFY** Hajj/Umrah info; CTA agent login only |
| `/login` | **MODIFY** — public: Agent (+ optional Supplier if business later confirms); Admin not marketed |
| `/fleet-erp` | **HIDE** from primary nav |
| ComingSoon routes | **HIDE** from nav |
| New: Reports hub | **EXTEND** (screen) over finance/ops queries |
| New: BRN inventory | **EXTEND** (screen) on ops/finance |
| New: Group readiness board | **MERGE** into ops/agent group UI |

---

## 8. Database Decisions

| Area | Decision |
|------|----------|
| `Group` | **EXTEND** — `nusukGroupNumber` (unique), `hajiWhatsapp`, readiness booleans, `umrahCompanyId`, `uploadedBy` |
| `Passenger` | **EXTEND** — age (or derive), biometricStatus, visaNumber, mofaNumber, mutamerType, subEaCode/Name, mainEa fields |
| `HotelBooking` | **EXTEND** — `agreementNo`, approvalStatus or mapped enum; encourage Makkah/Madinah pairing in app rules |
| `BRN` | **EXTEND** — price, days, rooms, total, usedPax, dateRequested |
| `LongStay` | **EXTEND** — host fields, relation, absher, link `passengerId`; keep hotel nights |
| `VisaType` | **EXTEND** — add `HAJJ` |
| `Company` / `SupplierProfile` | **EXTEND** — supplierKind enum |
| `Voucher` payload | **MODIFY** schema/JSON — supervisors, muallim mobile, movements |
| `Invoice` | **EXTEND** — kind `MOFA_PROCESSING` vs service invoice |
| Payment / ledger lines | **EXTEND** — `paymentSource` bank/cash/mobile |
| Host | **EXTEND** — prefer fields on LongStay/Passenger first; **avoid** new login role |
| HR | **EXTEND** — new Employee/Payroll tables (only true greenfield data) |
| `Enquiry` | **REMOVE** (deprecate) or leave inert **HIDE** |
| Fleet tables | **KEEP** unused by primary IA |
| `WorkflowStage` | **MERGE** — drive from readiness+services or hide from business UI |
| OCR doc types | **EXTEND** — `NUSUK_GROUP_LIST` |
| File links on transport | **REUSE** `UploadedFile` FKs |

---

## 9. Permission Decisions

| Decision | Detail |
|----------|--------|
| **KEEP** | Existing 11-key mechanism |
| **MODIFY** | Stop using only `VIEW_DASHBOARD` for all desks long-term |
| **EXTEND** | Desk keys (visa/hotel/transport/catering) OR map ops roles carefully |
| **EXTEND** | `MANAGE_HR` / payroll keys |
| **KEEP** | `FINANCIAL_REPORTS`, `EDIT_FINANCIAL_RECORDS`, `REVIEW_OCR_QUEUE`, `CONFIGURE_WORKFLOWS` |
| **HIDE** usage | `API_KEY_ACCESS` until real API keys exist |
| **KEEP** | Agent/Supplier fail-closed tenancy |
| **MODIFY** | Staff login not advertised publicly (process/perm unchanged) |

---

## 10. Dashboard Decisions

| Widget / view | Decision |
|---------------|----------|
| Due from agent | **MODIFY** finance/CEO/agent dash — primary |
| Group Numbers in process | **MODIFY** ops dash — readiness + service states |
| Long Stay red cards (≤5 days to day-85/90) | **EXTEND** |
| Hotel waiting approval count | **EXTEND** |
| Today transport legs | **REUSE** dispatch/arrivals |
| Visa not issued / biometric registered | **EXTEND** from Passenger fields |
| BRN utilization | **EXTEND** |
| Fleet-heavy widgets | **HIDE** |
| Supplier dashboard | **KEEP** |
| CEO P&L widgets | **KEEP** (secondary to dues/process) |

---

## 11. Notification Decisions

| Item | Decision |
|------|----------|
| WA / Email / In-App channels | **KEEP** |
| JWT WS `/notifications` | **KEEP** |
| Event-driven dispatch | **KEEP** pattern |
| “Every update” | **MODIFY** → define **material events** list (gates, hotel approval, transport assign, voucher, payment, LS day-85) — not raw field chatter |
| Day-85 pack (host+agent+Tuba WA/email + dashboard) | **EXTEND** |
| Seed noise events (support ticket, etc.) | **HIDE**/disable if unused |
| Automation schedule | **REUSE** for day-85 sweep |

---

## 12. Report Decisions

| Report (Word) | Decision |
|---------------|----------|
| Agent-wise | **EXTEND** query on Company AGENT + ledgers |
| Supplier-wise | **EXTEND** on supplier sub-ledger |
| Group code | **EXTEND** group dossier |
| Income / Expense | **REUSE** P&L + **MODIFY** presentation D/M/Y |
| Daily / Monthly / Yearly | **EXTEND** period params on existing aggregates |
| Mutamer visa/MOFA | **EXTEND** after fields exist |
| BRN inventory | **EXTEND** |
| MOFA bills | **EXTEND** |
| Transport schedule by date | **REUSE** ops data export |
| HR payroll | **EXTEND** with HR module |

---

## 13. Website Decisions

| Item | Decision |
|------|----------|
| Info-only marketing | **KEEP** |
| No public booking | **KEEP** |
| Agent login CTA | **KEEP** / emphasize |
| Admin tab on public login | **MODIFY** — remove from public marketing login; staff use direct/unlisted entry |
| Supplier tab | **MODIFY** — hide from public home OR keep only if business confirms suppliers need public login (Word stressed agent-only; default **HIDE** supplier from marketing, keep `/login?tab=supplier` unlisted) |
| NUSUK/MOFA “direct API” marketing claims | **MODIFY** copy honesty (architecture: no fake integration claim) |
| Hajj/Umrah content | **MODIFY** messaging to match business |

---

## 14. Agent Portal Decisions

| Item | Decision |
|------|----------|
| Portal shell | **KEEP** |
| Group create + shared data with staff | **KEEP** tenancy model; **MODIFY** UX to Nusuk number + Excel |
| Mutamer Excel upload | **EXTEND** |
| Hotel/transport/catering by group | **REUSE** services; **MODIFY** forms |
| Wallet / slips | **KEEP** |
| Long Stay visibility / red cards | **EXTEND** |
| WhatsApp receives | **KEEP** channel targeting |
| Same process as staff | **MODIFY** feature parity on group/mutamer/hotel/transport |

---

## 15. Supplier Decisions

| Item | Decision |
|------|----------|
| Portal accept/reject | **KEEP** |
| Four kinds (Umrah Co, Hotel, Catering, Transport) | **EXTEND** subtype; Umrah Co may not use same accept booking UI |
| Word named masters | **EXTEND** seed/master data (not hardcode-only) |
| Supplier pay | **EXTEND** finance pay-source |
| Supplier-wise report | **EXTEND** |
| Statement coming-soon bits | **MODIFY** to real sub-ledger view (**REUSE** finance) |

---

## 16. OCR Decisions

| Item | Decision |
|------|----------|
| Queue + review + reprocess | **KEEP** |
| Passport → Passenger | **KEEP** (secondary path) |
| Nusuk Group List image → Group | **EXTEND** primary business path |
| Excel after group open | **EXTEND** import (not OCR) |
| Gemini/provider | **KEEP** |

---

## 17. Finance Decisions

| Item | Decision |
|------|----------|
| GL + wallet + slips + invoices | **KEEP** engines |
| Auto-deduct / auto-invoice | **KEEP** with business-aware toggles if cash hotel conflicts |
| MOFA Processing Account | **EXTEND** invoice kind + UI like Bill Sheet |
| PAYMENT/BILL group gates | **EXTEND** on Group; sync signals to finance views |
| Credit Agent/Host only | **MODIFY** policy — Host as payee identity on LS; no Host login |
| Supplier debit source bank/cash/mobile | **EXTEND** |
| Due from agent | **MODIFY** dashboard/report priority |
| Multi-currency | **KEEP** optional; business Excel is SAR-first |

---

## 18. Voucher Decisions

| Item | Decision |
|------|----------|
| Generate on confirm pipeline | **KEEP** |
| PDF storage MinIO | **KEEP** |
| Bilingual AR/EN layout | **MODIFY** template to match TUBA VOUCHER |
| Movements / supervisors / muallim / 24h phones | **EXTEND** payload |
| WhatsApp/email send stamps | **KEEP** |

---

## 19. Hotel Decisions

| Item | Decision |
|------|----------|
| Hotel master + bookings | **KEEP** |
| Dual Makkah/Madinah | **MODIFY** UI + validation (two blocks) |
| Agreement No. | **EXTEND** field; link BRN |
| WAITING FOR APPROVAL / APPROVED | **MODIFY** status mapping or substatus |
| Cash stay vs MOFA | **EXTEND** finance rule documentation in bill kind |
| Supplier hotel portal | **KEEP** |

---

## 20. Transport Decisions

| Item | Decision |
|------|----------|
| TransportBooking + Dispatch | **KEEP** |
| Form-style request | **MODIFY** Agent/Ops form over API |
| Schedule board | **MODIFY** Ops UI to Excel columns |
| Vehicle types / FULL vs SINGLE | **EXTEND** enums/fields |
| Ticket/receipt attachments | **REUSE** uploads |
| OWN TRANSPORT | **EXTEND** allowed supplier/own flag |
| Ziyarah | **KEEP** |

---

## 21. Long Stay Decisions

| Item | Decision |
|------|----------|
| `LONG_STAY` visa + LongStay ops | **KEEP** base |
| Host/Iqama/relation/WhatsApp/Absher | **EXTEND** |
| Per-mutamer sheet semantics | **MODIFY** — link passengers; group hotel stay may remain |
| 90-day rule + day-85 | **EXTEND** automation + dashboard |
| Package status / remarks | **EXTEND** fields |
| Notifications multi-party | **EXTEND** |

---

## 22. Top 100 Architecture Decisions

*These are architecture decisions, not tickets.*

1. **AD-001** Business Word/Excel remain SoT over product docs.  
2. **AD-002** No greenfield rewrite.  
3. **AD-003** Preserve Nest/Prisma/Postgres/Redis/MinIO.  
4. **AD-004** Preserve JWT + RBAC mechanism.  
5. **AD-005** Keep Agents/Suppliers as `Company` counterparties under one Tuba operator.  
6. **AD-006** Never add Mutamer portal.  
7. **AD-007** Group Number (Nusuk) is the operational spine.  
8. **AD-008** Add unique `nusukGroupNumber` on Group; keep internal `code` if needed.  
9. **AD-009** Staff and Agent share one group dataset.  
10. **AD-010** OCR Group List path is primary intake; passport OCR secondary.  
11. **AD-011** Reuse `tuba-ocr` for both OCR modes.  
12. **AD-012** Mutamer Excel maps to Passenger; extend columns to sample sheet.  
13. **AD-013** Reuse bulk passenger API under Excel importer.  
14. **AD-014** Main EA code represents Tuba Nusuk identity; store explicitly.  
15. **AD-015** Sub EA is first-class on Passenger (and optionally Agent profile).  
16. **AD-016** Add HAJJ to VisaType.  
17. **AD-017** Keep UMRAH and LONG_STAY.  
18. **AD-018** Umrah Co is supplier subtype, not a new tenancy product.  
19. **AD-019** Hotel/Transport/Catering remain supplier subtypes.  
20. **AD-020** Keep CateringBooking engine unchanged in spirit.  
21. **AD-021** Add Group readiness booleans VISA/PACKAGE/PAYMENT/BILL.  
22. **AD-022** MERGE WorkflowStage UI behind readiness+services for business users.  
23. **AD-023** Dual hotel blocks Makkah+Madinah in UI.  
24. **AD-024** Add HotelBooking.agreementNo.  
25. **AD-025** Map or add WAITING_FOR_APPROVAL / APPROVED for hotels.  
26. **AD-026** Keep ServiceRequestStatus engine underneath.  
27. **AD-027** Extend BRN with inventory economics.  
28. **AD-028** BRN total rule price×days×pax is system rule.  
29. **AD-029** Transport schedule UI reuses Dispatch+TransportBooking.  
30. **AD-030** Transport request form reuses TransportBooking API.  
31. **AD-031** Attach tickets/receipts via UploadedFile.  
32. **AD-032** Keep voucher generate pipeline.  
33. **AD-033** Replace voucher visual with bilingual Tuba layout.  
34. **AD-034** Extend voucher payload (muallim, supervisors, movements, 24h).  
35. **AD-035** Keep LongStay ops API.  
36. **AD-036** Extend LongStay/Passenger for host & Absher.  
37. **AD-037** Day-85 is Automation scheduled job + notify.  
38. **AD-038** Day-85 recipients: host WA, agent WA, Tuba WA, email, dashboard.  
39. **AD-039** No Host login role; Host is data+notify target.  
40. **AD-040** Keep finance GL.  
41. **AD-041** Keep agent wallet + payment slips.  
42. **AD-042** Extend Invoice kind for MOFA_PROCESSING.  
43. **AD-043** MOFA bill UI mirrors Bill Sheet semantics.  
44. **AD-044** Document cash hotel/transport vs MOFA bill split in rules.  
45. **AD-045** Extend paymentSource bank/cash/mobile on supplier payments.  
46. **AD-046** Credit policy: Agent and Host only.  
47. **AD-047** Keep auto-invoice/auto-deduct unless they break cash-split rule — then gate.  
48. **AD-048** Due-from-agent is a first-class dashboard widget.  
49. **AD-049** Reports hub covers Word’s eight report types.  
50. **AD-050** Reuse P&L/BS aggregates for income/expense periods.  
51. **AD-051** Keep notification channels.  
52. **AD-052** Material-update event list replaces literal “every cell change.”  
53. **AD-053** Gate checkbox changes emit notifications.  
54. **AD-054** Hotel approval changes emit notifications.  
55. **AD-055** Keep `/notifications` WS JWT auth.  
56. **AD-056** Keep automation admin for configuration.  
57. **AD-057** Website remains non-booking.  
58. **AD-058** Public login markets Agent only.  
59. **AD-059** Staff admin login unlisted/separate.  
60. **AD-060** Supplier public tab hidden by default.  
61. **AD-061** Soften false ministry-API marketing claims.  
62. **AD-062** Keep Agent Portal shell.  
63. **AD-063** Agent Portal gains Excel/Nusuk parity workflows.  
64. **AD-064** Keep Supplier Portal accept/reject.  
65. **AD-065** Supplier UX branches by subtype.  
66. **AD-066** Keep Ops Control boards.  
67. **AD-067** Ops Group Master columns align to GROUP DETAILS.  
68. **AD-068** Hide CRM and Procurement desks.  
69. **AD-069** HR desk becomes real HR/Payroll (extend).  
70. **AD-070** Hide Fleet from primary IA; preserve module.  
71. **AD-071** Hide ComingSoon demo routes from nav.  
72. **AD-072** Deprecate Enquiry model (no business home).  
73. **AD-073** Keep Audit log.  
74. **AD-074** Keep Documents vault.  
75. **AD-075** Keep upload confirmToken.  
76. **AD-076** Mandatory haji/reference WhatsApp on Hajj/Umrah groups.  
77. **AD-077** Mandatory host WhatsApp on Long Stay.  
78. **AD-078** Biometric + MOFA fields on Passenger.  
79. **AD-079** MutamerType (e.g. B2B) stored.  
80. **AD-080** Duration displayed as depart−arrive (computed).  
81. **AD-081** ZiyarahTrip kept and linked into voucher movements.  
82. **AD-082** Additional services module HIDE from primary IA (optional keep API).  
83. **AD-083** DRIVER role remains future/hidden.  
84. **AD-084** API_KEY_ACCESS remains unused/hidden.  
85. **AD-085** Permissions gain desk/HR extensions without discarding old keys.  
86. **AD-086** Dashboard Long Stay red cards.  
87. **AD-087** Dashboard hotel waiting count.  
88. **AD-088** Dashboard group process pipeline.  
89. **AD-089** CEO/Finance dashboards kept but reordered behind dues/process.  
90. **AD-090** OWN TRANSPORT allowed in transport supplier/own flag.  
91. **AD-091** Consulate/default Dhaka as optional Group metadata.  
92. **AD-092** Season sheets (1448 vs OLD) → Season entity **REUSE**.  
93. **AD-093** Google Drive links replaced by vault files over time (**REUSE** uploads).  
94. **AD-094** Bilingual bn/en product **KEEP**; voucher AR/EN **EXTEND**.  
95. **AD-095** Do not remove BullMQ queues.  
96. **AD-096** Do not remove Socket.io ops live updates.  
97. **AD-097** Single-company UX language in staff UI (“counterparties” not “tenants”).  
98. **AD-098** Complexity cap: prefer mapping layers over parallel status systems.  
99. **AD-099** Transformation success = Excel workflows runnable in ERP without spreadsheet.  
100. **AD-100** This document governs later phases; discovery/cross-match remain evidence annexes.

---

## 23. Decision Matrix

### Master table (Business Requirement → Decision)

| Business Requirement | Current ERP | Decision | Reason | Impact | Priority | Complexity | Reuse % |
|----------------------|-------------|----------|--------|--------|----------|------------|--------:|
| Single Tuba operator | Multi-party Company tenancy | **KEEP+MODIFY** UX | Counterparties needed; not SaaS product | Low structural | P0 | S | 90 |
| No mutamer portal | None | **KEEP** | Already correct | None | P0 | S | 100 |
| Nusuk Group Number spine | Internal group code + nusukRef | **EXTEND** | Excel/Nusuk identity | High | P0 | M | 70 |
| OCR → create Group | Passport→Passenger | **EXTEND** | Wrong object today | High | P0 | L | 60 |
| Mutamer Excel upload | Bulk JSON | **EXTEND** | Column contract | High | P0 | M | 75 |
| Main/Sub EA | Absent | **EXTEND** | Sample Excel | High | P0 | M | 40 |
| HAJJ/Umrah/Long Stay | UMRAH/LONG_STAY | **EXTEND** HAJJ | Word dropdown | Med | P1 | S | 85 |
| Umrah Co master | Generic supplier | **EXTEND** subtype | Word 4 types | Med | P1 | M | 70 |
| VISA/PACKAGE/PAYMENT/BILL | Absent | **EXTEND** | GROUP DETAILS | High | P0 | M | 30 |
| Dual hotels + agreement + WAITING | Bookings + service status | **MODIFY+EXTEND** | Excel hotel blocks | High | P0 | M | 65 |
| BRN inventory economics | BRN ops shell | **EXTEND** | BRN SOLD sheet | High | P1 | M | 55 |
| Transport form+schedule | Booking+dispatch | **MODIFY** | Excel boards | High | P0 | M | 70 |
| Bilingual Tuba voucher | English PDF | **MODIFY** | TUBA VOUCHER | High | P1 | M | 70 |
| Catering | CateringBooking | **KEEP** | Already fits | Low | P2 | S | 95 |
| Long Stay host+day-85 | Thin LongStay | **EXTEND** | Word Phase-3 | Critical | P0 | L | 45 |
| MOFA bill sheet | Generic invoice | **EXTEND** | BILL SHEET | High | P1 | M | 50 |
| Pay source bank/cash/mobile | Weak | **EXTEND** | Word finance | Med | P1 | M | 40 |
| Credit Agent/Host only | Agent wallet | **MODIFY+EXTEND** | Host party | Med | P1 | M | 60 |
| WhatsApp material updates | Event matrix | **MODIFY+EXTEND** | Word notify | High | P0 | M | 75 |
| Dashboard dues/process/LS red | 8 dashboards | **MODIFY+EXTEND** | Word dashboard | High | P0 | M | 70 |
| Reports agent/supplier/group/D/M/Y | P&L/AR fragments | **EXTEND** | Word reports | High | P1 | M | 55 |
| Website agent-only login | Agent/Supplier/Admin tabs | **MODIFY** | Word website | Med | P0 | S | 80 |
| HR & Payroll | Empty HR desk | **EXTEND** | Word HR | Med | P2 | L | 15 |
| Agent Portal parity | Portal exists | **MODIFY** | Word agent process | High | P0 | M | 75 |
| Supplier portal | Exists | **KEEP+MODIFY** | Fulfillment | Med | P1 | S | 85 |
| Ziyarah | ZiyarahTrip | **KEEP+EXTEND** | Voucher moves | Med | P2 | S | 80 |
| Documents/tickets | Vault+uploads | **REUSE** | Replace Drive links | Med | P1 | S | 90 |
| Fleet ERP | Full module | **HIDE** | Not in Excel SoT | Nav only | P2 | S | 100* |
| CRM/Procurement desks | Empty | **HIDE** | No business | Nav | P2 | S | — |
| ComingSoon demos | Routes | **HIDE** | Noise | Nav | P2 | S | — |
| Enquiry model | Orphan | **REMOVE**/deprecate | Unused | Low | P3 | S | 0 |
| Finance GL/wallet | Strong | **KEEP** | Core money | Stabilize | P0 | S | 95 |
| Automation queues | Strong | **KEEP+EXTEND** | day-85 | Platform | P0 | S | 90 |
| Audit | Read API | **KEEP** | Compliance | Low | P2 | S | 100 |
| Ops live boards | Strong | **REUSE+MODIFY** | Schedule/group | High | P0 | M | 80 |

\*Fleet reuse % = preserve code asset even if hidden.

### Business Rule → API → DB → Screen → Decision

| Business Rule | Current API | Current DB | Current Screen | Decision |
|---------------|-------------|------------|----------------|----------|
| Unique shared Group Number | `/groups` | `Group.code` | Agent/Ops groups | **EXTEND** nusuk unique |
| Staff=Agent same data | groups/passengers | tenantId | portals | **KEEP** |
| Excel mutamer columns | bulk passengers | Passenger | Agent groups | **EXTEND** |
| OCR group image | `/ocr` | OcrDocument | OCR Center | **EXTEND** |
| Readiness checkboxes | — | — | — | **EXTEND** Group+UI |
| Hotel WAITING/APPROVED | `/services/hotel` | HotelBooking.status | services/ops | **MODIFY** map/substatus |
| Agreement/BRN link | `/ops/brns` | BRN | ops | **EXTEND** |
| BRN price×days×pax | — | — | — | **EXTEND** |
| Transport schedule | `/ops/dispatches` | DispatchOrder | Ops | **MODIFY** UI |
| Voucher bilingual | voucher gen | Voucher | services | **MODIFY** |
| Day-85 alert | — | LongStay thin | Ops LS | **EXTEND** |
| Host WA mandatory | — | — | — | **EXTEND** |
| Haji WA mandatory | — | — | — | **EXTEND** Group |
| MOFA bill Qty×Rate | `/finance/invoices` | Invoice | FinanceERP | **EXTEND** kind/UI |
| Credit Agent/Host | agent-finance | Wallet | Agent finance | **EXTEND** Host |
| Pay source selector | finance pay | Ledger/Invoice | FinanceERP | **EXTEND** |
| WA on material updates | `/notifications` | NotificationLog | Automation | **MODIFY** matrix |
| Agent-only public login | `/auth/login` | User | Login/Home | **MODIFY** |
| No mutamer login | — | — | — | **KEEP** |
| Catering by group | `/services/catering` | CateringBooking | portals | **KEEP** |
| Supplier accept | `/supplier` | bookings | Supplier portal | **KEEP** |
| HAJJ type | visa APIs | VisaType | forms | **EXTEND** |
| HR salaries | — | — | HR EmptyState | **EXTEND** |
| Due from agent | dashboards/finance | AR | Dashboards | **MODIFY** |
| Absher flag | — | — | — | **EXTEND** |
| Sub EA hierarchy | — | — | — | **EXTEND** |
| Hide staff login on site | login tabs | — | Login | **MODIFY** |

---

## 24. Reuse Matrix

| Asset | Reuse posture | Reuse % |
|-------|---------------|--------:|
| Auth/RBAC | Keep mechanism | 95 |
| Company counterparties | Keep + subtype | 85 |
| Groups/Passengers | Keep + fields/import | 70 |
| Service booking engine | Keep + map statuses | 75 |
| Supplier portal | Keep | 85 |
| Ops boards / WS | Keep + column align | 80 |
| BRN entity | Keep + economics | 55 |
| Voucher pipeline | Keep + template | 70 |
| LongStay + ops | Keep + host/day85 | 45 |
| Finance GL/wallet | Keep + MOFA/source | 80 |
| OCR queue/review | Keep + group mode | 60 |
| Notify/Automation queues | Keep + new events | 75 |
| Documents/Uploads | Keep | 90 |
| Dashboards service | Keep + widgets | 65 |
| Agent Portal shell | Keep + workflows | 75 |
| Website shell | Keep + login rules | 70 |
| Fleet module | Hide / preserve | 100 (latent) |
| ComingSoon/Enquiry/CRM UI | Hide/remove | 0–10 |
| HR | New on empty slot | 15 |
| **Weighted overall** | | **~68** |

---

## 25. Transformation Score

| Factor | Score | Note |
|--------|------:|------|
| Platform reuse viability | 85 | Strong engines |
| Workflow convergence effort | 55 | Many MODIFY/EXTEND |
| Data model fit | 50 | Field gaps |
| UX fit to Excel | 40 | Boards need reshape |
| Notification/rules fit | 60 | Infra yes, rules no |
| Website/IA fit | 45 | Login/nav cleanup |
| Greenfield necessity | 70 | Only HR + some fields truly new |
| Risk of rewrite temptation | 80 | Architecture forbids rewrite |

### **Transformation Score: 62 / 100**

Meaning: The current ERP is a **viable transformation base**. Success depends on disciplined MODIFY/EXTEND of Groups, Passengers, Hotel/BRN, Long Stay, Finance bill kinds, OCR intake, and Website/Agent UX — not on rebuilding portals, GL, or queues.

---

## 26. Final Summary

Transforming Tuba Al Hijaz means **converging** the existing ERP to the Word/Excel business, using:

- **KEEP** — GL/wallet, portals, catering, ops boards, OCR/notify/automation engines, documents, audit, no mutamer login.  
- **MODIFY** — Website login, dashboards, voucher template, hotel approval language, agent/ops screens to Excel shapes, notification matrix.  
- **EXTEND** — Nusuk group fields, mutamer Excel columns, readiness gates, BRN inventory, Long Stay host/day-85, MOFA bills, pay sources, HAJJ, supplier subtypes, HR/payroll, OCR group-list mode, reports hub.  
- **MERGE** — Business-visible progress via readiness+services; demote parallel stage theater.  
- **HIDE** — Fleet primary nav, CRM/Procurement, ComingSoon demos, unused noise.  
- **REMOVE/deprecate** — Enquiry orphan (only clear dead weight).  

**Top outcome definition (AD-099):** Bangladesh agent and Tuba staff can run group → mutamer Excel → hotel/transport/catering → voucher → MOFA/finance → Long Stay day-85 **inside the ERP**, without `Tubahijaz full data.xlsx` as system of record.

This document is the **official architecture decision record** for subsequent phases. It does not implement, ticketize, or schedule work.

---

*End of BUSINESS_TRANSFORMATION_ARCHITECTURE.md — Phase 3 decisions only.*
