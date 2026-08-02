# TRANSFORM-002 Architecture — Visa & Saudi Operations

**Document type:** Enterprise architecture (Phase 2)  
**Domain:** Visa Desk · Saudi MOFA · Biometric · Embassy · Passport custody · Long Stay · Visa reports / dashboards / notifications  
**Date:** 2026-08-01  
**Status:** Architecture only — **no code, no migrations, no API/UI implementation**  
**Inputs:** `analysis/TRANSFORM_002_DISCOVERY.md` · Blueprint §9–§10 · Operation Map C2 · Program BT-06 / BT-12 / BT-14  
**Prerequisite:** TRANSFORM-001 complete (intake foundation)

---

## 1. Architecture Principles

1. **Reuse the spine** — Auth, tenancy, Groups, Passengers, Services/VisaRequest, Ops desks, OCR queue, Notifications, Automation, AuditLog. Do not create a parallel Visa ERP.
2. **Mutamer is the visa work unit** — Biometric / visa status / Visa Number / MOFA Number live on `Passenger`. `VisaRequest` is an optional **batch envelope** (Umrah Co / embassy / priority), not a second SoT.
3. **Group is the commercial spine** — `visaType`, Nusuk, Umrah Co link, `gateVisa`, Long Stay host context attach to `Group`.
4. **Staff-update model** — No live NUSUK/MOFA government API in T002. Status advances are attributable Staff/Umrah Co updates (AuditLog).
5. **Material events only** — Notify on meaningful transitions (issued, rejected, passport returned, day-85), not every field keystroke.
6. **MOFA number ≠ MOFA bill** — Mutamer MOFA Number is process identity; MOFA Processing Bill is finance Qty×Rate (separate UX and data kind).
7. **Long Stay is a product branch** — Same Group/Passenger spine + Host register + day-85 pack; Host is not a login user.
8. **SOP-gated custody** — Embassy board and passport return states ship only when Visa Desk confirms SOP; otherwise keep slim fields.
9. **Additive & backward compatible** — Nullable columns, defaulted enums, old Excel labels mapped; no architecture rewrite.
10. **TRANSFORM-001 is sacred** — Intake (Nusuk OCR, Mutamer Excel, passport OCR, gates, intake notify) remains; T002 extends, does not redesign intake.
11. **Finance boundary** — T002 may extend Invoice with `MOFA_PROCESSING` kind; no dues/GL/wallet redesign.
12. **Honesty** — Remove/avoid marketing claims of direct NUSUK/MOFA API sync.

---

## 2. Department Workflow

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│ Agent / OCR │────►│ Group +      │────►│ Visa Desk       │
│ Intake      │     │ Mutamer SoT  │     │ (+ Umrah Co)    │
└─────────────┘     └──────────────┘     └────────┬────────┘
       T001                    │                  │
                               │                  ▼
                               │         Mutamer Visa Pipeline
                               │         (state machine §3)
                               │                  │
               ┌───────────────┼──────────────────┤
               ▼               ▼                  ▼
        gateVisa flip    MOFA Bill (Finance)   Notifications
        (Ops + Visa)     Qty×Rate + Sign       Agent + Admin
                               │
                    Long Stay branch (if visaType=LONG_STAY)
                               ▼
                    Host register → Day-85 pack → Red cards
```

### 2.1 Daily Visa Desk loop

1. Open worklist: groups arriving soon / mutamers not issued / biometric incomplete.  
2. Chase Umrah Co; update mutamer pipeline state.  
3. Capture Visa Number / MOFA Number when issued.  
4. On material change → notify Agent + Admin.  
5. When group visa work acceptably complete → recommend/flip `gateVisa` with Ops.  

### 2.2 Long Stay strip (parallel)

1. Group `visaType = LONG_STAY` + Host WhatsApp mandatory.  
2. Track Absher / entry–exit / duration (~90 days).  
3. At day 85 → Host + Agent + Tuba (WA + Email) + dashboard red cards.  

### 2.3 MOFA bill strip (visa-adjacent)

1. After processing volume known → MOFA Processing Account bill (Qty × Rate).  
2. Finance Approval Sign + CR Date.  
3. Explicit note: hotel/transport cash deals are not this bill.

---

## 3. Visa State Machine

### 3.1 Scope

Canonical **Mutamer Visa Pipeline** state on each `Passenger` (name TBD in implementation, e.g. `visaPipelineStatus` or mapped composite).  
Group `gateVisa` remains a **readiness boolean**, not a pipeline state.  
`VisaRequest.status` remains the **batch service** status machine (existing `ServiceRequestStatus`) — linked, not replaced.

### 3.2 States (enterprise pipeline)

```
NEW
  ↓
MOFA                 ← MOFA / Umrah Co file opened (process account / file ref stage)
  ↓
EMBASSY              ← Embassy / consulate handling (SOP-gated emphasis)
  ↓
BIOMETRIC            ← Biometric appointment / Registered in progress
  ↓
SUBMITTED            ← File submitted to Saudi / Umrah Co channel
  ↓
PROCESSING           ← Awaiting issue decision
  ↓
ISSUED ──────────────┬──► PASSPORT_RETURNED ──► COMPLETED
  │                  │
  │                  └── (optional hold if passport still at Umrah Co / embassy)
  │
REJECTED ────────────┴──► (rework) → BIOMETRIC | SUBMITTED | PROCESSING
                              or terminal REJECTED_CLOSED
```

Happy path (as specified):

**NEW → MOFA → EMBASSY → BIOMETRIC → SUBMITTED → PROCESSING → ISSUED → PASSPORT_RETURNED → COMPLETED**

### 3.3 State catalog

| State | Meaning | Typical field echoes |
|-------|---------|----------------------|
| `NEW` | Mutamer on group; visa work not started | Excel “Visa Not Issued”; biometric empty |
| `MOFA` | MOFA/Umrah process file initiated | MOFA Number may still be empty |
| `EMBASSY` | Embassy/consulate stage | `embassy` / Group `consulate` context |
| `BIOMETRIC` | Biometric in progress / registered | `biometricStatus = Registered` (etc.) |
| `SUBMITTED` | Submitted for issue | — |
| `PROCESSING` | Pending Saudi/Umrah decision | — |
| `ISSUED` | Visa issued | `visaStatusLabel` issued; Visa Number present |
| `REJECTED` | Visa rejected | Rejection reason required |
| `PASSPORT_RETURNED` | Passport returned to Agent/Tuba custody complete | Custody log |
| `COMPLETED` | Desk closed for this mutamer | Feeds group VISA gate assessment |
| `REJECTED_CLOSED` | Rejected and not reworked | Terminal |

### 3.4 Allowed transitions

| From | To | Who | Guard |
|------|----|-----|-------|
| NEW | MOFA | Visa Desk | Group has visa type; Umrah Co recommended |
| NEW | BIOMETRIC | Visa Desk | Skip-forward allowed if MOFA/Embassy not used for product |
| MOFA | EMBASSY | Visa Desk | — |
| MOFA | BIOMETRIC | Visa Desk | Skip Embassy if SOP allows |
| EMBASSY | BIOMETRIC | Visa Desk | — |
| BIOMETRIC | SUBMITTED | Visa Desk | Biometric status recorded |
| SUBMITTED | PROCESSING | Visa Desk / system | — |
| PROCESSING | ISSUED | Visa Desk | Visa Number required |
| PROCESSING | REJECTED | Visa Desk | Reason required |
| ISSUED | PASSPORT_RETURNED | Visa Desk | Custody confirmation |
| PASSPORT_RETURNED | COMPLETED | Visa Desk | — |
| ISSUED | COMPLETED | Visa Desk | Allowed if passport-return SOP deferred (flag) |
| REJECTED | BIOMETRIC / SUBMITTED / PROCESSING | Visa Desk | Rework |
| REJECTED | REJECTED_CLOSED | Visa Desk | Terminal |
| \* | \* (same state) | — | No-op updates (notes) allowed |

**Forbidden examples:** COMPLETED → NEW; ISSUED → NEW; PASSPORT_RETURNED → PROCESSING; REJECTED_CLOSED → ISSUED without explicit reopen policy (out of T002).

### 3.5 Skip policy

| Product | Skip |
|---------|------|
| Umrah / Hajj | Embassy may be skipped if consulate-only ops; MOFA stage may be brief |
| Long Stay | Same pipeline + Host register; Absher tracked alongside |
| Flag `VISA_REQUIRE_PASSPORT_RETURN` | When **false**, ISSUED → COMPLETED allowed; when **true**, must pass PASSPORT_RETURNED |

### 3.6 Mapping to TRANSFORM-001 fields

| Pipeline state | `biometricStatus` | `visaStatus` / label | `visaNumber` | `mofaNumber` |
|----------------|-------------------|----------------------|--------------|--------------|
| NEW | empty / pending | Visa Not Issued / PENDING | empty | empty |
| BIOMETRIC | Registered (etc.) | Visa Not Issued | empty | optional |
| ISSUED | Registered | Issued / APPROVED | **required** | preferred |
| REJECTED | any | Rejected / REJECTED | empty | optional |
| COMPLETED | Registered | Issued | present | present when applicable |

Excel import continues to write labels; desk advances pipeline; mappers keep T001 contract.

### 3.7 Group readiness interaction

- `gateVisa = true` only when business accepts group completion (not necessarily 100% COMPLETED — partial allowed per Blueprint).  
- Desk may show “suggest flip gate” when ≥ threshold mutamers ISSUED/COMPLETED.  
- Gate flip still emits `group.gates.changed` (T001-08).

---

## 4. Business Rules

1. Hajj, Umrah, Long Stay are first-class `Group.visaType` values.  
2. Passport number is mutamer identity; duplicates flagged at import/desk.  
3. Pipeline SoT = Passenger; batch VisaRequest optional.  
4. Umrah Co from approved Company master; required on visa groups (policy).  
5. Visa Number mandatory on transition → ISSUED.  
6. Rejection reason mandatory on → REJECTED.  
7. Material transitions notify Agent + Admin (see §9).  
8. Host WhatsApp mandatory for Long Stay; Host is not a User login.  
9. Day-85 of ~90-day Long Stay cannot be skipped (automation + red cards).  
10. Absher tracked for Long Stay.  
11. MOFA Processing Bill ≠ hotel/transport cash deal.  
12. No mutamer portal.  
13. All desk transitions AuditLog’d (actor, from, to, reason).  
14. Agent tenancy fail-closed unchanged.  
15. Embassy/passport-return hard requirements controlled by feature flags + SOP.

---

## 5. Department Ownership

| Concern | Owner | Collaborators |
|---------|-------|---------------|
| Mutamer pipeline updates | **Visa Desk** | Umrah Co (external), Ops |
| Umrah Co assignment | Visa Desk / Ops | Agent (view) |
| `gateVisa` flip | Visa Desk + Ops visibility | — |
| Passport OCR intake | OCR Desk | Visa Desk (consume) |
| Group List OCR | OCR Desk | Ops (T001) |
| Long Stay Host register | Visa Desk / Ops LS | Agent |
| Day-85 alerts | Automation + Ops | Host, Agent, Tuba official |
| MOFA Bill Approval Sign | **Finance** | Visa Desk (qty/pax input) |
| Visa reports / backlog KPIs | Visa Desk + Ops Command | — |
| Notification matrix | Platform + Visa Desk policy | — |

---

## 6. Screen Mapping

| Screen | Route / area | T002 change |
|--------|--------------|-------------|
| Ops Visa Desk | `/ops-departments` (Visa) | **Primary:** mutamer worklist, pipeline column, filters (Umrah Co, arrival ≤7d, state), inline transition |
| Ops Group Master | `/ops-control` groups | Keep `gateVisa`; show Umrah Co / visa summary chips |
| Ops Long Stay | `/ops-control` longstay | **Extend:** Host/Iqama/WhatsApp/Absher/day-85 markers |
| Agent Groups | Agent Portal Groups | Show mutamer pipeline/visa columns (read + limited update per policy) |
| Agent Visa services | Agent Portal Services → visa | Keep batch request; align HAJJ; show linked progress |
| OCR Center | `/ocr-center` | Reuse passport / Nusuk modes; no fake visa-sticker mode unless justified |
| Dashboards | `/dashboards` | Replace ComingSoon visa cards; add LS red cards + biometric backlog |
| Finance ERP | `/finance-erp` (boundary) | MOFA Processing Bill sheet (Qty×Rate, Approval Sign, CR Date) |
| Automation admin | `/automation` | Day-85 rule visibility |
| Marketing Home/Login | public | **Honesty:** remove NUSUK/MOFA API claims |

**No second Visa portal.** One desk, one agent view, one LS strip.

---

## 7. API Mapping

| Capability | API strategy |
|------------|--------------|
| Group visa type / Umrah Co / gates | Reuse `PATCH /groups/:id` — extend body |
| Mutamer field updates | Reuse `PATCH /passengers/:id` — extend pipeline fields |
| Mutamer visa worklist | **Extend** `GET /services/visa/desk` or `GET /ops/visa/mutamers` (query filters) — prefer Ops module |
| Pipeline transition | **Extend** `POST /passengers/:id/visa-transition` `{ to, reason }` **or** PATCH with validated state machine in service |
| Batch VisaRequest | Reuse `POST/GET /services/visa`, status PATCH — add HAJJ, umrahCompanyId, embassy |
| Long Stay host | Reuse `/ops/long-stays` — extend fields |
| Day-85 | No public mutate API — Automation job + dashboard read APIs |
| MOFA bill | Extend finance invoices (`kind=MOFA_PROCESSING`) — no parallel billing microservice |
| Notifications | Reuse dispatch; no new channel stack |
| OCR | Reuse existing documents/approve |

**Rules:** No duplicate passenger APIs; tenancy scoped; RBAC reuse (`VIEW_DASHBOARD` / future desk key only if required).

---

## 8. Database Mapping

| Concept | Mapping |
|---------|---------|
| Pipeline state | EXTEND `Passenger` (+ history table optional `PassengerVisaTransition`) |
| Biometric / Visa No / MOFA No / labels | REUSE T001 columns |
| Group visa type / Nusuk / consulate / gateVisa | REUSE |
| Umrah Co | EXTEND `Group.umrahCompanyId` → `Company` (minimal); optional on `VisaRequest` |
| Embassy | REUSE/ACTIVATE `VisaRequest.embassy`; Group.consulate already exists |
| Passport custody | EXTEND slim fields on Passenger **or** `PassportMovement` only if SOP mandates |
| Long Stay host | EXTEND `LongStay` (hostName, iqama, whatsapp, relation, absher, entry/exit) |
| Day-85 | Derived from entry date + 85; store `day85NotifiedAt` |
| MOFA bill | EXTEND `Invoice.kind` / lines for Qty×Rate + approvalSign + crDate |
| Audit | REUSE `AuditLog` |
| Enums | EXTEND carefully; keep Excel label maps |

**Avoid:** New Mutamer table; new Visa microservice schema; dropping T001 columns.

---

## 9. Notification Mapping

| Business event | Channel policy | Recipients | Template / key |
|----------------|----------------|------------|----------------|
| Pipeline → ISSUED | WA + Email + In-App (matrix) | Agent tenant + Admin staff | `VISA_APPROVED` (wire) |
| Pipeline → REJECTED | WA + Email + In-App | Agent + Admin | `VISA_REJECTED` (wire) |
| PASSPORT_RETURNED | In-App (+ WA if material) | Agent + Admin | New or DEFAULT |
| `gateVisa` flipped | Existing intake | Agent + Admin | `GROUP_GATES_CHANGED` (keep) |
| Long Stay day-85 | **WA + Email + In-App** | Host phone, Agent, Tuba official | New `LONGSTAY_DAY85` |
| MOFA bill signed | WA + In-App | Agent + Admin | Extend / `INVOICE_*` or new `MOFA_BILL_SIGNED` |

**Skip-safe:** WA without `WASENDER_API_KEY` remains non-fatal (T001 pattern).  
**Do not** spam on every BIOMETRIC keystroke — only material transitions (§3.4).

---

## 10. OCR Mapping

| Document | Role in T002 |
|----------|--------------|
| `PASSPORT` | REUSE — identity into Mutamer before/during NEW |
| `NUSUK_GROUP_LIST` | REUSE — opens Group (flagged) before desk chase |
| `VISA` enum | **Leave dead** unless business proves sticker OCR value |
| Embassy papers | Not in T002 OCR unless SOP + sample set provided |

OCR never auto-advances to ISSUED without human desk confirmation.

---

## 11. Automation Mapping

| Job / rule | Trigger | Action |
|------------|---------|--------|
| Intake AR-GRP-01…04 | Keep | Unchanged from T001 |
| Visa issued/rejected | Domain emit on transition | SEND_NOTIFICATION |
| Day-85 sweep | Cron (e.g. daily 06:00) | Find LS groups/mutamers at day≥85; notify; set red-card flag |
| Arrival risk hint | Optional daily | Flag mutamers PROCESSING/NEW with departDate ≤7d (desk badge — notify optional) |
| Document.expiring | Existing fleet | **Do not** overload for day-85 |

Reuse BullMQ Automation worker + Notification dispatch.

---

## 12. Dashboard Mapping

| Widget | Audience | Data source |
|--------|----------|-------------|
| Active visa pipeline counts by state | Ops / Visa Desk | Passenger pipeline aggregate |
| Biometric registered, visa not issued | Ops / Visa Desk | Passenger filters |
| Groups arriving ≤7d still not issued | Ops Command | Group.departDate + mutamer states |
| MOFA number completeness % | Visa Desk | mofaNumber filled / issued count |
| Long Stay red cards (day-85/90) | Ops + Agent (scoped) | LongStay + day85 flag |
| `gateVisa` board | Ops Group Master | Existing T001-09 |
| Agent “Visa Status” card | Agent | Replace ComingSoon with scoped counts |

Remove mock “MOFA clearance confirmed” demo strings from live dashboards.

---

## 13. Risk Analysis

| Risk | Level | Architecture response |
|------|-------|------------------------|
| Speculative embassy/passport UI | High | Flag + SOP gate (T002-05); skip-forward transitions |
| MOFA number vs bill confusion | High | Separate models/screens/copy |
| Dual Excel vs pipeline vocabulary | Medium | Published map; import remains label-friendly |
| Day-85 miss | Critical | Scheduled job + red cards + acceptance tests |
| Batch VisaRequest vs Passenger drift | Medium | Passenger SoT; batch is envelope |
| Finance scope creep | High | MOFA bill kind only |
| Fake API expectations | Medium | Honesty principle + copy fix |
| Skip-forward abuse | Medium | Audit + role; reports show skips |
| Umrah Co taxonomy blocked | Medium | Minimal Company FK now |

---

## 14. Reuse Strategy

| Layer | Reuse |
|-------|-------|
| Modules | Groups, Passengers, MutamerImport, Services, Ops, OCR, Notifications, Automation, Finance (bill kind), Web desks |
| APIs | `/groups`, `/passengers`, `/services/visa`, `/ops/long-stays`, `/ops/groups`, OCR, notify |
| DB | Group, Passenger, VisaRequest, LongStay, Company, Invoice, NotificationEvent, AutomationRule, AuditLog |
| Events | Keep intake events; wire seeded VISA_* keys |
| UI | OpsDepartments VisaDesk, OpsControl, Agent Portal, Dashboards shell |
| Patterns | Tenancy, AuditLog, BullMQ, feature flags |

**Target reuse effort:** ~50% (per Discovery).

---

## 15. Extension Strategy

| Extension | Approach |
|-----------|----------|
| Pipeline state + transitions | Additive Passenger field + service validator |
| Visa Desk worklist API/UI | Extend Ops / Services — no new app |
| Umrah Co link | `umrahCompanyId` → Company |
| Notifications | Wire emits + rules; Host recipient resolver for LS |
| Long Stay host + day-85 | Extend LongStay + Automation cron |
| MOFA bill | Invoice kind + Bill Sheet UI |
| Dashboards/reports | Replace ComingSoon; read aggregations |
| Passport return | Optional states + flag |

**Target extension effort:** ~35%.  
**New build:** ~15% (Host routing, Bill Sheet UX, red cards, custody if SOP).

---

## 16. Future Integration

| Integration | T002 stance | Later |
|-------------|-------------|-------|
| Live Nusuk government API | **Out** | Future BT when vendor exists |
| Live MOFA API | **Out** | Future |
| Full supplier taxonomy (BT-05) | Minimal Company link now | Full Umrah Co kind later |
| Full notification matrix (BT-13) | Visa + day-85 slice only | Expand |
| Full finance dues/GL (BT-14+) | MOFA bill only | Pay source / credits later |
| Visa sticker OCR | Dead enum stays | Activate only with samples |
| Embassy e-filing | Out | — |

---

## 17. Recommended T002 Implementation Sequence

Aligned with Discovery §18; architecture adds state-machine + flag milestones.

| Order | Task | Architecture milestone |
|-------|------|------------------------|
| 1 | **T002-01** Visa Master & Umrah Co | HAJJ API parity; `umrahCompanyId`; DTO/schema alignment |
| 2 | **T002-02** Mutamer Visa Desk Board | Worklist UI/API on Passenger |
| 3 | **T002-03** Pipeline state machine | States + allowed transitions + Excel map + gate assist |
| 4 | **T002-04** Approval/Rejection notifications | Wire `VISA_APPROVED` / `VISA_REJECTED` |
| 5 | **T002-05** Embassy & Passport (SOP-gated) | Embassy fields; PASSPORT_RETURNED; `VISA_REQUIRE_PASSPORT_RETURN` |
| 6 | **T002-06** MOFA completeness + MOFA Bill | KPIs + Invoice kind Bill Sheet |
| 7 | **T002-07** Long Stay Host Register | Host/Iqama/WhatsApp/Absher |
| 8 | **T002-08** Day-85 Compliance Pack | Cron + multi-party notify + red cards |
| 9 | **T002-09** Reports & Dashboards | Backlog widgets; mutamer visa/MOFA report; honesty copy |
| 10 | **T002-10** Final Acceptance | Smoke across pipeline + LS + bill; sign-off |

```
T002-01 ─► T002-02 ─► T002-03 ─► T002-04 ─► T002-09 ─► T002-10
                │         │
                │         └─► T002-05 (flag/SOP)
                └─► T002-06 ─────────────► T002-09
T002-01 ─► T002-07 ─► T002-08 ──────────► T002-09
```

### Suggested feature flags (architecture)

| Flag | Default | Purpose |
|------|---------|---------|
| `ENABLE_NUSUK_GROUP_LIST_OCR` | off | Carry from T001 |
| `REQUIRE_HAJI_WHATSAPP` | off | Carry from T001 |
| `VISA_REQUIRE_PASSPORT_RETURN` | off | Enforce ISSUED → PASSPORT_RETURNED → COMPLETED |
| `REQUIRE_LONGSTAY_HOST_WHATSAPP` | on when LS host ships | Host WA mandatory |
| `ENABLE_MOFA_PROCESSING_BILL` | off until Finance ready | Bill Sheet UI/API |

---

## 18. Architecture Decision Record (short)

| ID | Decision |
|----|----------|
| AD-T002-01 | Passenger is Mutamer Visa Pipeline SoT |
| AD-T002-02 | VisaRequest remains batch envelope |
| AD-T002-03 | Happy-path states per §3; skips allowed with audit |
| AD-T002-04 | No government visa API in T002 |
| AD-T002-05 | MOFA bill via Invoice kind extension |
| AD-T002-06 | Day-85 via Automation cron + red cards |
| AD-T002-07 | Embassy/passport-return SOP-gated |
| AD-T002-08 | Reuse Ops Visa Desk screen — no second app |

---

*End of TRANSFORM-002 Architecture. Implementation requires authorized task pack (T002-01…); do not code from this document alone without task scope freeze.*
