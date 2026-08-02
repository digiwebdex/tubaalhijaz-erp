# TRANSFORM-002 — Business Sign-Off

**Program:** Visa & Saudi Operations  
**Architecture contract:** T002-10 — Smoke across pipeline + LS + bill; sign-off  
**Technical gate:** `TRANSFORM_002_RELEASE_CERTIFICATION.md` (378/378 e2e · GO WITH ACCEPTED RISKS)  
**Do not start Transformation-003 until this sign-off is complete (or explicitly deferred in writing).**

---

## 1. Purpose

Confirm that Operations can run **visa processing and Long Stay compliance** on the ERP spine without Excel as system of record for mutamer visa state, and without claiming a live government visa API:

```
Intake (T001) → Visa Desk / Pipeline → (Embassy/Passport SOP) → MOFA No
             → Long Stay Host → Day-85 alerts → Executive Visa Dashboard
             → (optional) MOFA Processing Bill (Finance)
```

---

## 2. Business Acceptance Checklist

Initial each item after staging or prod-smoke demonstration.

### A. Visa Desk & Pipeline

| # | Criterion | Pass | Initials | Date |
|---|-----------|:----:|----------|------|
| A1 | Mutamer Visa Desk lists passengers with pipeline state | ☐ | | |
| A2 | Staff can transition states per published matrix; agents cannot (403) | ☐ | | |
| A3 | ISSUED captures Visa Number; REJECTED captures reason | ☐ | | |
| A4 | Agent receives material notify on issued / rejected (WA skip-safe OK) | ☐ | | |
| A5 | Understood: status advances are **staff / Umrah Co updates**, not live MOFA/NUSUK API | ☐ | | |

### B. Embassy & Passport (SOP)

| # | Criterion | Pass | Initials | Date |
|---|-----------|:----:|----------|------|
| B1 | Embassy reference / submitted date usable when required | ☐ | | |
| B2 | Passport returned state / timestamp understood | ☐ | | |
| B3 | `VISA_REQUIRE_PASSPORT_RETURN` decision recorded: ☐ Off at go-live / ☐ On after SOP | ☐ | | |

### C. MOFA Number vs MOFA Bill

| # | Criterion | Pass | Initials | Date |
|---|-----------|:----:|----------|------|
| C1 | MOFA Number completeness % visible on Visa Desk / dashboard | ☐ | | |
| C2 | Understood: MOFA Number ≠ MOFA Processing Bill | ☐ | | |
| C3 | `ENABLE_MOFA_PROCESSING_BILL` decision: ☐ Off / ☐ On — Finance owns Approval Sign + CR Date | ☐ | | |

### D. Long Stay & Day-85

| # | Criterion | Pass | Initials | Date |
|---|-----------|:----:|----------|------|
| D1 | Host name + WhatsApp registrable on Long Stay (Host is not a login user) | ☐ | | |
| D2 | Kingdom entry date drives Day-85 clock | ☐ | | |
| D3 | Red cards appear at day ≥85; escalation path at ~90 understood | ☐ | | |
| D4 | Host + Agent + Tuba notified on Day-85 (channels per policy; WA skip-safe OK) | ☐ | | |
| D5 | Exit / renewal clears red card; agents cannot manage LS host (403) | ☐ | | |

### E. Executive Dashboard

| # | Criterion | Pass | Initials | Date |
|---|-----------|:----:|----------|------|
| E1 | Visa & Compliance board loads for staff with `VIEW_DASHBOARD` | ☐ | | |
| E2 | Pipeline / MOFA % / biometric backlog / LS red cards / gates visible | ☐ | | |
| E3 | Drill-down opens existing Visa Desk / Long Stay / Group Master | ☐ | | |
| E4 | Agents cannot open staff dashboards (403) | ☐ | | |
| E5 | Marketing no longer claims Direct NUSUK/MOFA API sync | ☐ | | |

### F. Intake foundation still intact (T001)

| # | Criterion | Pass | Initials | Date |
|---|-----------|:----:|----------|------|
| F1 | Nusuk Group Number + gates + Mutamer import + passport OCR still work | ☐ | | |
| F2 | Intake notifications AR-GRP-01…04 still fire on material events | ☐ | | |

---

## 3. Accepted Risks Acknowledgement

Signatories acknowledge the residual risks listed in `TRANSFORM_002_RELEASE_CERTIFICATION.md`, including:

- No live government visa API  
- MOFA Bill and Passport-Return features flag-gated (defaults off unless explicitly enabled)  
- Feature Status Matrix / User Guide documentation refresh deferred  
- Production restore drill deferred  
- Image tag reuse — rollback by digest/`rc1` preferred  

| Risk ID acknowledged | Initials | Date |
|----------------------|----------|------|
| R-01 … R-11 (register) | | |

---

## 4. Signature Block

### Managing Director

| | |
|--|--|
| Name | |
| Signature | |
| Date | |
| Decision | ☐ Approve release · ☐ Approve with accepted risks · ☐ Hold |

### Operations Director

| | |
|--|--|
| Name | |
| Signature | |
| Date | |
| Decision | ☐ Ops ready · ☐ Hold — reason: |

### Visa Manager

| | |
|--|--|
| Name | |
| Signature | |
| Date | |
| Decision | ☐ Visa Desk ready · ☐ Hold — reason: |

### Finance Manager

| | |
|--|--|
| Name | |
| Signature | |
| Date | |
| Decision | ☐ MOFA Bill off accepted · ☐ MOFA Bill on & ready · ☐ Hold |

### IT Manager

| | |
|--|--|
| Name | |
| Signature | |
| Date | |
| Decision | ☐ Runtime certified · ☐ Hold — reason: |

---

## 5. Overall Business Decision

| Option | Mark one |
|--------|:--------:|
| **GO** | ☐ |
| **GO WITH ACCEPTED RISKS** | ☐ |
| **NO GO** | ☐ |

Technical recommendation on file: **GO WITH ACCEPTED RISKS** (see certification).

Comments:

_________________________________________________________________

_________________________________________________________________

---

## 6. Stop

After sign-off, do **not** start Transformation-003 unless a separate authorized program charter is issued.
