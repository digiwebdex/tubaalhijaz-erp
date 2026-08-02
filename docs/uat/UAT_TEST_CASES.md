# UAT Test Cases — TUBA AL HIJAZ ERP

**Sprint:** ESP-05  
**Date:** 2026-08-02  
**Rule:** Only **implemented** flows. Leave **Actual Result** / **PASS·FAIL** / **Comments** blank until execution.  
**Master plan:** [`UAT_MASTER_PLAN.md`](./UAT_MASTER_PLAN.md)

### Result legend

| Field | Use |
|-------|-----|
| Actual Result | What happened on the UAT environment |
| PASS / FAIL | Mark after run |
| Comments | Bug ID from [`UAT_BUG_REGISTER.md`](./UAT_BUG_REGISTER.md) if FAIL |

### Severity (for bugs filed from these cases)

Critical · High · Medium · Low — definitions in bug register.

---

## Suite A — Agent Portal

### UAT-AGT-001 — Agent login

| Field | Content |
|-------|---------|
| **Test ID** | UAT-AGT-001 |
| **Business Goal** | Verified agent can enter the Agent Portal |
| **Precondition** | Seed agent `ahmad@rashidi-travel.com` ACTIVE; company VERIFIED |
| **Steps** | 1. Open `/login`. 2. Select **Agent** portal. 3. Enter email + `Demo@123`. 4. Submit. |
| **Expected Result** | Access granted; land on `/agent-portal`; company name visible; no staff module switcher. |
| **Actual Result** | |
| **PASS / FAIL** | |
| **Comments** | |

### UAT-AGT-002 — Portal mismatch rejected

| Field | Content |
|-------|---------|
| **Test ID** | UAT-AGT-002 |
| **Business Goal** | Staff cannot enter via Agent tab |
| **Precondition** | Staff user `ops@tubalhijaz.com` |
| **Steps** | 1. `/login` → Agent tab. 2. Enter ops credentials. |
| **Expected Result** | Login rejected (invalid portal / unauthorized). |
| **Actual Result** | |
| **PASS / FAIL** | |
| **Comments** | |

### UAT-AGT-003 — Create Group

| Field | Content |
|-------|---------|
| **Test ID** | UAT-AGT-003 |
| **Business Goal** | Agent opens a group spine (Nusuk / visa type) for own company only |
| **Precondition** | Logged in as Agent (UAT-AGT-001) |
| **Steps** | 1. Agent Portal → Groups. 2. Create group with visa type (e.g. UMRAH), Nusuk group number if required by UI, optional Umrah Co. 3. Save. |
| **Expected Result** | Group created with internal code; `tenantId` = agent company; gates default false; group appears in agent list. |
| **Actual Result** | |
| **PASS / FAIL** | |
| **Comments** | |

### UAT-AGT-004 — Add Passenger (Mutamer)

| Field | Content |
|-------|---------|
| **Test ID** | UAT-AGT-004 |
| **Business Goal** | Add a pilgrim to the agent’s group |
| **Precondition** | Group from UAT-AGT-003 |
| **Steps** | 1. Open group passengers. 2. Add passenger with name + unique passport No. 3. Save. |
| **Expected Result** | Passenger listed under group; passport unique in group; agent cannot see other companies’ passengers. |
| **Actual Result** | |
| **PASS / FAIL** | |
| **Comments** | |

### UAT-AGT-005 — Import Mutamer Excel

| Field | Content |
|-------|---------|
| **Test ID** | UAT-AGT-005 |
| **Business Goal** | Bulk intake via Mutamer Excel (T001-05) |
| **Precondition** | Group exists; valid Mutamer Excel per contract |
| **Steps** | 1. Open Mutamer import for the group. 2. Upload / preview. 3. Commit. |
| **Expected Result** | Preview shows rows; commit creates/updates passengers; validation errors block bad rows without silent corruption. |
| **Actual Result** | |
| **PASS / FAIL** | |
| **Comments** | |

### UAT-AGT-006 — Check Visa Status (read)

| Field | Content |
|-------|---------|
| **Test ID** | UAT-AGT-006 |
| **Business Goal** | Agent can see mutamer visa-related fields / pipeline echo but cannot staff-transition |
| **Precondition** | Passenger exists; optionally staff has set a pipeline state |
| **Steps** | 1. Open passenger / group visa-related view in Agent Portal. 2. Attempt any staff Visa Desk URL (`/ops-departments` visa) if known. |
| **Expected Result** | Agent sees own-company status data where UI exposes it; staff Visa Desk blocked (redirect/403). No government “live sync” claimed. |
| **Actual Result** | |
| **PASS / FAIL** | |
| **Comments** | |

### UAT-AGT-007 — Payment (wallet / slip)

| Field | Content |
|-------|---------|
| **Test ID** | UAT-AGT-007 |
| **Business Goal** | Agent records a payment toward dues (wallet / payment slip) |
| **Precondition** | Agent logged in; Agent Finance module available |
| **Steps** | 1. Open Agent Portal → Finance. 2. View wallet / pending. 3. Submit a payment slip (type, amount, optional file). |
| **Expected Result** | Slip created for **own company only**; appears in agent slip list; staff review queue can see PENDING (finance role). |
| **Actual Result** | |
| **PASS / FAIL** | |
| **Comments** | |

### UAT-AGT-008 — Logout

| Field | Content |
|-------|---------|
| **Test ID** | UAT-AGT-008 |
| **Business Goal** | Session ends cleanly |
| **Precondition** | Agent logged in |
| **Steps** | 1. Logout. 2. Navigate to `/agent-portal`. 3. Call a protected API if tools available. |
| **Expected Result** | Redirected to login; protected routes inaccessible without re-auth. |
| **Actual Result** | |
| **PASS / FAIL** | |
| **Comments** | |

### UAT-AGT-009 — Cross-tenant isolation

| Field | Content |
|-------|---------|
| **Test ID** | UAT-AGT-009 |
| **Business Goal** | Agent B cannot open Agent A’s group |
| **Precondition** | Group id from Agent A; login as `office@alnoor-pilgrim.com` |
| **Steps** | 1. Login Agent B. 2. Open Agent A group URL/id if obtainable. |
| **Expected Result** | Group not listed; direct fetch fails (404 / not found). |
| **Actual Result** | |
| **PASS / FAIL** | |
| **Comments** | |

---

## Suite B — Operations

### UAT-OPS-001 — Review Groups (Group Master)

| Field | Content |
|-------|---------|
| **Test ID** | UAT-OPS-001 |
| **Business Goal** | Ops sees cross-agent group board |
| **Precondition** | Login `ops@tubalhijaz.com` with `VIEW_DASHBOARD` |
| **Steps** | 1. Open Ops Group Master / groups board (Ops Control or departments per nav). 2. Search/filter groups. |
| **Expected Result** | Groups from multiple agents visible; Nusuk number / visa type / gates visible where implemented. |
| **Actual Result** | |
| **PASS / FAIL** | |
| **Comments** | |

### UAT-OPS-002 — Review Passengers

| Field | Content |
|-------|---------|
| **Test ID** | UAT-OPS-002 |
| **Business Goal** | Ops reviews mutamer manifest for a group |
| **Precondition** | UAT-OPS-001; group with passengers |
| **Steps** | 1. Open group passengers from ops UI. 2. Confirm passport / Mutamer fields. |
| **Expected Result** | Full manifest readable; edits follow existing RBAC (staff). |
| **Actual Result** | |
| **PASS / FAIL** | |
| **Comments** | |

### UAT-OPS-003 — OCR Intake (passport)

| Field | Content |
|-------|---------|
| **Test ID** | UAT-OPS-003 |
| **Business Goal** | Passport image → OCR queue → human review → Mutamer |
| **Precondition** | Ops with `REVIEW_OCR_QUEUE`; group exists; passport image (JPG/PNG/PDF ≤10MB) |
| **Steps** | 1. Upload passport via uploads. 2. Submit OCR document (PASSPORT) linked to group if UI requires. 3. Wait for processing. 4. OCR Center: review fields. 5. Approve into group (create or attach Mutamer). |
| **Expected Result** | Document leaves PENDING; passenger created/attached; agent cannot approve review queue. |
| **Actual Result** | |
| **PASS / FAIL** | |
| **Comments** | |

### UAT-OPS-004 — Mutamer Import (staff)

| Field | Content |
|-------|---------|
| **Test ID** | UAT-OPS-004 |
| **Business Goal** | Staff can run Mutamer Excel import on a group |
| **Precondition** | Ops logged in; group + Excel |
| **Steps** | Same as agent import path from ops/agent-accessible UI; commit. |
| **Expected Result** | Import succeeds under staff; audit/trace available if UI shows it. |
| **Actual Result** | |
| **PASS / FAIL** | |
| **Comments** | |

### UAT-OPS-005 — Package Ready gate

| Field | Content |
|-------|---------|
| **Test ID** | UAT-OPS-005 |
| **Business Goal** | Flip **PACKAGE** readiness when package locked |
| **Precondition** | Group exists |
| **Steps** | 1. Set package type if UI provides. 2. Set `gatePackage` = true. 3. Refresh board. |
| **Expected Result** | Gate shows ready; other gates unchanged unless edited. |
| **Actual Result** | |
| **PASS / FAIL** | |
| **Comments** | |

### UAT-OPS-006 — Visa Ready gate

| Field | Content |
|-------|---------|
| **Test ID** | UAT-OPS-006 |
| **Business Goal** | Flip **VISA** gate when visa work acceptably complete |
| **Precondition** | Group exists; preferably after visa progress |
| **Steps** | Set `gateVisa` = true on group. |
| **Expected Result** | Board shows VISA ready. (Pipeline gate-assist may *suggest* this — manual confirm OK.) |
| **Actual Result** | |
| **PASS / FAIL** | |
| **Comments** | |

### UAT-OPS-007 — Payment Ready gate

| Field | Content |
|-------|---------|
| **Test ID** | UAT-OPS-007 |
| **Business Goal** | Flip **PAYMENT** gate |
| **Precondition** | Group exists |
| **Steps** | Set `gatePayment` = true. |
| **Expected Result** | Gate persists on Group Master. |
| **Actual Result** | |
| **PASS / FAIL** | |
| **Comments** | |

### UAT-OPS-008 — Bill Ready gate

| Field | Content |
|-------|---------|
| **Test ID** | UAT-OPS-008 |
| **Business Goal** | Flip **BILL** gate |
| **Precondition** | Group exists |
| **Steps** | Set `gateBill` = true. |
| **Expected Result** | Gate persists; group can show all four gates independent. |
| **Actual Result** | |
| **PASS / FAIL** | |
| **Comments** | |

---

## Suite C — Visa Team

### UAT-VIS-001 — Visa Desk board

| Field | Content |
|-------|---------|
| **Test ID** | UAT-VIS-001 |
| **Business Goal** | Mutamer Visa Desk lists pipeline work |
| **Precondition** | Ops/Visa staff; passengers with pipeline state |
| **Steps** | 1. Open Visa Desk (`/ops-departments` visa desk). 2. Filter by state / embassy if available. |
| **Expected Result** | Rows show pipeline status; agent login cannot open desk (403/redirect). |
| **Actual Result** | |
| **PASS / FAIL** | |
| **Comments** | |

### UAT-VIS-002 — Pipeline to MOFA / Embassy / Biometric

| Field | Content |
|-------|---------|
| **Test ID** | UAT-VIS-002 |
| **Business Goal** | Advance mutamer through early pipeline states |
| **Precondition** | Passenger at NEW (or reset test passenger) |
| **Steps** | Transition NEW → MOFA → EMBASSY (or allowed skip path) → BIOMETRIC → SUBMITTED → PROCESSING per UI allowed list. |
| **Expected Result** | Only allowed transitions succeed; invalid jumps rejected; audit/update visible. |
| **Actual Result** | |
| **PASS / FAIL** | |
| **Comments** | |

### UAT-VIS-003 — MOFA number completeness

| Field | Content |
|-------|---------|
| **Test ID** | UAT-VIS-003 |
| **Business Goal** | Capture / view MOFA Number completeness (not the same as MOFA Bill) |
| **Precondition** | Visa Desk open |
| **Steps** | 1. Enter MOFA number on mutamer where UI allows. 2. Observe completeness % on desk/dashboard. |
| **Expected Result** | Completeness updates; testers acknowledge MOFA Number ≠ MOFA Processing Bill. |
| **Actual Result** | |
| **PASS / FAIL** | |
| **Comments** | |

### UAT-VIS-004 — Issued (Visa Number)

| Field | Content |
|-------|---------|
| **Test ID** | UAT-VIS-004 |
| **Business Goal** | PROCESSING → ISSUED requires Visa Number |
| **Precondition** | Passenger in PROCESSING |
| **Steps** | 1. Attempt ISSUED without visa number (expect fail). 2. Retry with Visa Number. |
| **Expected Result** | Without number: rejected; with number: ISSUED; agent notify skip-safe OK. |
| **Actual Result** | |
| **PASS / FAIL** | |
| **Comments** | |

### UAT-VIS-005 — Passport Returned

| Field | Content |
|-------|---------|
| **Test ID** | UAT-VIS-005 |
| **Business Goal** | ISSUED → PASSPORT_RETURNED with custody confirm |
| **Precondition** | Passenger ISSUED; note `VISA_REQUIRE_PASSPORT_RETURN` flag |
| **Steps** | Transition to PASSPORT_RETURNED with custody confirmed as UI requires. |
| **Expected Result** | State PASSPORT_RETURNED; timestamp/custody recorded per implementation. |
| **Actual Result** | |
| **PASS / FAIL** | |
| **Comments** | |

### UAT-VIS-006 — Rejected

| Field | Content |
|-------|---------|
| **Test ID** | UAT-VIS-006 |
| **Business Goal** | PROCESSING → REJECTED requires reason |
| **Precondition** | Separate test passenger in PROCESSING |
| **Steps** | Reject without reason (expect fail); reject with reason. |
| **Expected Result** | REJECTED with reason; notify skip-safe OK; rework path available per matrix. |
| **Actual Result** | |
| **PASS / FAIL** | |
| **Comments** | |

### UAT-VIS-007 — Completed

| Field | Content |
|-------|---------|
| **Test ID** | UAT-VIS-007 |
| **Business Goal** | Close visa pipeline to COMPLETED |
| **Precondition** | ISSUED or PASSPORT_RETURNED per flag policy |
| **Steps** | Transition to COMPLETED per allowed matrix. |
| **Expected Result** | COMPLETED; further transitions blocked (terminal). |
| **Actual Result** | |
| **PASS / FAIL** | |
| **Comments** | Record flag setting used. |

### UAT-VIS-008 — Embassy fields (SOP)

| Field | Content |
|-------|---------|
| **Test ID** | UAT-VIS-008 |
| **Business Goal** | Embassy reference / submitted date usable when required |
| **Precondition** | Passenger in EMBASSY-capable path |
| **Steps** | Enter embassy reference / submitted date via desk actions. |
| **Expected Result** | Values persist; agent cannot patch embassy fields (403). |
| **Actual Result** | |
| **PASS / FAIL** | |
| **Comments** | |

---

## Suite D — Long Stay

### UAT-LS-001 — Host registration

| Field | Content |
|-------|---------|
| **Test ID** | UAT-LS-001 |
| **Business Goal** | Register Long Stay Host (Host is not a login user) |
| **Precondition** | LONG_STAY group; staff with ops access |
| **Steps** | 1. Open Long Stay screen. 2. Register host name + WhatsApp (+ relation/Iqama as UI requires). 3. Set kingdom entry date. |
| **Expected Result** | LongStay row saved; Host WhatsApp stored; agent cannot manage host (403). |
| **Actual Result** | |
| **PASS / FAIL** | |
| **Comments** | |

### UAT-LS-002 — Host update

| Field | Content |
|-------|---------|
| **Test ID** | UAT-LS-002 |
| **Business Goal** | Update host / Absher / remarks |
| **Precondition** | UAT-LS-001 |
| **Steps** | PATCH/update host fields and remarks via Long Stay UI. |
| **Expected Result** | Changes persist; audit if shown. |
| **Actual Result** | |
| **PASS / FAIL** | |
| **Comments** | |

### UAT-LS-003 — Day-85 red card

| Field | Content |
|-------|---------|
| **Test ID** | UAT-LS-003 |
| **Business Goal** | At day ≥85 from entry, red card / due stage appears |
| **Precondition** | LongStay with `entryDate` set so age ≥85 (or wait for sweep after backdating in **UAT env only**) |
| **Steps** | 1. Confirm entry date. 2. Trigger/wait Day-85 sweep (cron ~06:15) or ops-supported test trigger if available. 3. Check Long Stay / dashboard red cards. |
| **Expected Result** | Stage DUE (or ESCALATED ≥90); notifications to Host/Agent/Tuba per policy (WA skip-safe OK). |
| **Actual Result** | |
| **PASS / FAIL** | |
| **Comments** | Do not backdate production without IT approval. |

### UAT-LS-004 — Resolve Day-85

| Field | Content |
|-------|---------|
| **Test ID** | UAT-LS-004 |
| **Business Goal** | Exit / renewal / completed clears red card |
| **Precondition** | Red card from UAT-LS-003 |
| **Steps** | Set exit date **or** status COMPLETED **or** renewal APPROVED per UI. |
| **Expected Result** | Red card clears; compliance stage no longer DUE/ESCALATED. |
| **Actual Result** | |
| **PASS / FAIL** | |
| **Comments** | |

---

## Suite E — Finance

### UAT-FIN-001 — Finance ERP access

| Field | Content |
|-------|---------|
| **Test ID** | UAT-FIN-001 |
| **Business Goal** | Finance staff open Finance ERP; ops/agent blocked |
| **Precondition** | `finance@tubalhijaz.com`; also try ops + agent |
| **Steps** | Open `/finance-erp` as each role. |
| **Expected Result** | Finance/CEO/Admin allowed per `FINANCIAL_REPORTS`; ops/agent denied. |
| **Actual Result** | |
| **PASS / FAIL** | |
| **Comments** | |

### UAT-FIN-002 — Invoice

| Field | Content |
|-------|---------|
| **Test ID** | UAT-FIN-002 |
| **Business Goal** | View / work invoices on staff Finance desk |
| **Precondition** | Finance login; seeded or generated invoice |
| **Steps** | Open Invoices desk; open one invoice; confirm amount/status/group link. |
| **Expected Result** | Live data (not mock when authenticated); PDF/file if issued. |
| **Actual Result** | |
| **PASS / FAIL** | |
| **Comments** | |

### UAT-FIN-003 — Receipt

| Field | Content |
|-------|---------|
| **Test ID** | UAT-FIN-003 |
| **Business Goal** | View receipts desk |
| **Precondition** | Finance login |
| **Steps** | Open Receipts; list/filter. |
| **Expected Result** | Receipts load for company filters as designed. |
| **Actual Result** | |
| **PASS / FAIL** | |
| **Comments** | |

### UAT-FIN-004 — Voucher

| Field | Content |
|-------|---------|
| **Test ID** | UAT-FIN-004 |
| **Business Goal** | Locate voucher documents / issued vouchers where Finance or docs hub exposes them |
| **Precondition** | Finance or ops path that lists vouchers/files |
| **Steps** | Open voucher-related desk or agent documents of type voucher if in scope for staff. |
| **Expected Result** | Existing voucher artifacts visible; no inventing new voucher workflow. |
| **Actual Result** | |
| **PASS / FAIL** | |
| **Comments** | |

### UAT-FIN-005 — AR (Accounts Receivable)

| Field | Content |
|-------|---------|
| **Test ID** | UAT-FIN-005 |
| **Business Goal** | AR desk shows dues from agents |
| **Precondition** | Finance login |
| **Steps** | Open AR desk; note outstanding. |
| **Expected Result** | AR list/dashboard loads; aligns with due-from-agent business language. |
| **Actual Result** | |
| **PASS / FAIL** | |
| **Comments** | |

### UAT-FIN-006 — AP (Accounts Payable)

| Field | Content |
|-------|---------|
| **Test ID** | UAT-FIN-006 |
| **Business Goal** | AP desk shows supplier-side payables |
| **Precondition** | Finance login |
| **Steps** | Open AP desk. |
| **Expected Result** | AP loads without error. |
| **Actual Result** | |
| **PASS / FAIL** | |
| **Comments** | |

### UAT-FIN-007 — Cash

| Field | Content |
|-------|---------|
| **Test ID** | UAT-FIN-007 |
| **Business Goal** | Cash position / cash desk usable |
| **Precondition** | Finance login |
| **Steps** | Open Cash desk. |
| **Expected Result** | Cash view loads; sample banners (if any) distinguished from live series. |
| **Actual Result** | |
| **PASS / FAIL** | |
| **Comments** | |

### UAT-FIN-008 — Confirm agent payment slip (staff)

| Field | Content |
|-------|---------|
| **Test ID** | UAT-FIN-008 |
| **Business Goal** | Finance confirms agent slip → wallet credit |
| **Precondition** | PENDING slip from UAT-AGT-007; user with `EDIT_FINANCIAL_RECORDS` |
| **Steps** | Open review queue; Confirm slip. |
| **Expected Result** | Slip CONFIRMED; wallet balance increases; ops without EDIT cannot confirm. |
| **Actual Result** | |
| **PASS / FAIL** | |
| **Comments** | |

### UAT-FIN-009 — MOFA Processing Bill (flag-gated)

| Field | Content |
|-------|---------|
| **Test ID** | UAT-FIN-009 |
| **Business Goal** | If `ENABLE_MOFA_PROCESSING_BILL=true`, Finance can work MOFA bill; else document N/A |
| **Precondition** | Record flag value |
| **Steps** | If on: open MOFA bill path, Approval Sign / CR Date per T002-06. If off: confirm UI/API unavailable. |
| **Expected Result** | Matches flag; no claim that MOFA Number equals bill. |
| **Actual Result** | |
| **PASS / FAIL** | |
| **Comments** | Mark N/A if flag off — not a FAIL. |

---

## Suite F — CEO / Executive

### UAT-CEO-001 — Operations Today dashboard

| Field | Content |
|-------|---------|
| **Test ID** | UAT-CEO-001 |
| **Business Goal** | Command view of today’s ops |
| **Precondition** | User with `VIEW_DASHBOARD` (ops or chairman) |
| **Steps** | Open `/dashboards` → Ops Today. |
| **Expected Result** | KPIs/queues load; drill-downs respect RBAC. |
| **Actual Result** | |
| **PASS / FAIL** | |
| **Comments** | |

### UAT-CEO-002 — Executive / Reports

| Field | Content |
|-------|---------|
| **Test ID** | UAT-CEO-002 |
| **Business Goal** | Management reports for CEO Viewer |
| **Precondition** | `chairman@tubalhijaz.com` |
| **Steps** | Open Executive / Reports tabs. |
| **Expected Result** | Boards load; agent cannot access. |
| **Actual Result** | |
| **PASS / FAIL** | |
| **Comments** | |

### UAT-CEO-003 — Visa & Compliance alerts

| Field | Content |
|-------|---------|
| **Test ID** | UAT-CEO-003 |
| **Business Goal** | See pipeline / MOFA % / LS red cards (alerts as dashboard signals) |
| **Precondition** | `VIEW_DASHBOARD`; ideally data from prior suites |
| **Steps** | Open Visa & Compliance dashboard; note red cards / backlogs. |
| **Expected Result** | Widgets load; drill-down to Visa Desk / Long Stay / Group Master where linked. |
| **Actual Result** | |
| **PASS / FAIL** | |
| **Comments** | |

### UAT-CEO-004 — Agent blocked from staff dashboards

| Field | Content |
|-------|---------|
| **Test ID** | UAT-CEO-004 |
| **Business Goal** | Tenancy / RBAC for executive surfaces |
| **Precondition** | Agent login |
| **Steps** | Navigate to `/dashboards`, `/finance-erp`, `/ocr-center`. |
| **Expected Result** | UX redirect and/or API 403. |
| **Actual Result** | |
| **PASS / FAIL** | |
| **Comments** | |

---

## Coverage index

| Suite | IDs | Count |
|-------|-----|------:|
| Agent | UAT-AGT-001…009 | 9 |
| Operations | UAT-OPS-001…008 | 8 |
| Visa | UAT-VIS-001…008 | 8 |
| Long Stay | UAT-LS-001…004 | 4 |
| Finance | UAT-FIN-001…009 | 9 |
| CEO | UAT-CEO-001…004 | 4 |
| **Total** | | **42** |
