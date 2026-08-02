# UAT Execution Checklist — TUBA AL HIJAZ ERP

**Sprint:** ESP-05  
**Environment:** ☐ Staging ☐ Production-smoke Host: _______________  
**Build / image tags:** Web _______________ API _______________  
**Execution window:** From _______________ To _______________  
**IT facilitator:** _______________

Record flag values before start:

| Flag | Value |
|------|-------|
| `ENABLE_NUSUK_GROUP_LIST_OCR` | |
| `VISA_REQUIRE_PASSPORT_RETURN` | |
| `ENABLE_MOFA_PROCESSING_BILL` | |
| `REQUIRE_HAJI_WHATSAPP` | |
| `REFRESH_COOKIE_PATH` | |
| `COOKIE_SECURE` | |

---

## P0 — Environment gate (IT)

| # | Check | Done | Initials | Date |
|---|-------|:----:|----------|------|
| P0.1 | API `/health` 200 | ☐ | | |
| P0.2 | Web origin loads | ☐ | | |
| P0.3 | Login works for Agent + Ops + Finance + CEO | ☐ | | |
| P0.4 | Workers automation / notify / OCR listening | ☐ | | |
| P0.5 | UAT dataset / seed confirmed | ☐ | | |
| P0.6 | Bug register blank copy ready | ☐ | | |

**P0 result:** ☐ GO to P1 ☐ STOP  

---

## P1 — Agent (UAT-AGT)

| Test ID | Runner | Done | PASS | FAIL | Bug ID |
|---------|--------|:----:|:----:|:----:|--------|
| UAT-AGT-001 Login | | ☐ | ☐ | ☐ | |
| UAT-AGT-002 Portal mismatch | | ☐ | ☐ | ☐ | |
| UAT-AGT-003 Create Group | | ☐ | ☐ | ☐ | |
| UAT-AGT-004 Add Passenger | | ☐ | ☐ | ☐ | |
| UAT-AGT-005 Mutamer Import | | ☐ | ☐ | ☐ | |
| UAT-AGT-006 Visa status read | | ☐ | ☐ | ☐ | |
| UAT-AGT-007 Payment slip | | ☐ | ☐ | ☐ | |
| UAT-AGT-008 Logout | | ☐ | ☐ | ☐ | |
| UAT-AGT-009 Cross-tenant | | ☐ | ☐ | ☐ | |

**P1 sign-off (Agent lead):** _______________ Date: _______________

---

## P2 — Operations (UAT-OPS)

| Test ID | Runner | Done | PASS | FAIL | Bug ID |
|---------|--------|:----:|:----:|:----:|--------|
| UAT-OPS-001 Review Groups | | ☐ | ☐ | ☐ | |
| UAT-OPS-002 Review Passengers | | ☐ | ☐ | ☐ | |
| UAT-OPS-003 OCR Intake | | ☐ | ☐ | ☐ | |
| UAT-OPS-004 Mutamer Import staff | | ☐ | ☐ | ☐ | |
| UAT-OPS-005 Package Ready | | ☐ | ☐ | ☐ | |
| UAT-OPS-006 Visa Ready | | ☐ | ☐ | ☐ | |
| UAT-OPS-007 Payment Ready | | ☐ | ☐ | ☐ | |
| UAT-OPS-008 Bill Ready | | ☐ | ☐ | ☐ | |

**P2 sign-off (Operations Manager):** _______________ Date: _______________

---

## P3 — Visa (UAT-VIS)

| Test ID | Runner | Done | PASS | FAIL | Bug ID |
|---------|--------|:----:|:----:|:----:|--------|
| UAT-VIS-001 Visa Desk | | ☐ | ☐ | ☐ | |
| UAT-VIS-002 Pipeline early states | | ☐ | ☐ | ☐ | |
| UAT-VIS-003 MOFA completeness | | ☐ | ☐ | ☐ | |
| UAT-VIS-004 Issued | | ☐ | ☐ | ☐ | |
| UAT-VIS-005 Passport Returned | | ☐ | ☐ | ☐ | |
| UAT-VIS-006 Rejected | | ☐ | ☐ | ☐ | |
| UAT-VIS-007 Completed | | ☐ | ☐ | ☐ | |
| UAT-VIS-008 Embassy SOP | | ☐ | ☐ | ☐ | |

**P3 sign-off (Visa Manager):** _______________ Date: _______________

---

## P4 — Long Stay (UAT-LS)

| Test ID | Runner | Done | PASS | FAIL | Bug ID |
|---------|--------|:----:|:----:|:----:|--------|
| UAT-LS-001 Host registration | | ☐ | ☐ | ☐ | |
| UAT-LS-002 Host update | | ☐ | ☐ | ☐ | |
| UAT-LS-003 Day-85 | | ☐ | ☐ | ☐ | |
| UAT-LS-004 Resolve | | ☐ | ☐ | ☐ | |

**P4 sign-off (Ops/Visa):** _______________ Date: _______________

---

## P5 — Finance (UAT-FIN)

| Test ID | Runner | Done | PASS | FAIL | Bug ID |
|---------|--------|:----:|:----:|:----:|--------|
| UAT-FIN-001 Access RBAC | | ☐ | ☐ | ☐ | |
| UAT-FIN-002 Invoice | | ☐ | ☐ | ☐ | |
| UAT-FIN-003 Receipt | | ☐ | ☐ | ☐ | |
| UAT-FIN-004 Voucher | | ☐ | ☐ | ☐ | |
| UAT-FIN-005 AR | | ☐ | ☐ | ☐ | |
| UAT-FIN-006 AP | | ☐ | ☐ | ☐ | |
| UAT-FIN-007 Cash | | ☐ | ☐ | ☐ | |
| UAT-FIN-008 Slip confirm | | ☐ | ☐ | ☐ | |
| UAT-FIN-009 MOFA Bill (or N/A) | | ☐ | ☐ | ☐ | |

**P5 sign-off (Finance Manager):** _______________ Date: _______________

---

## P6 — CEO (UAT-CEO)

| Test ID | Runner | Done | PASS | FAIL | Bug ID |
|---------|--------|:----:|:----:|:----:|--------|
| UAT-CEO-001 Ops Today | | ☐ | ☐ | ☐ | |
| UAT-CEO-002 Reports | | ☐ | ☐ | ☐ | |
| UAT-CEO-003 Visa alerts | | ☐ | ☐ | ☐ | |
| UAT-CEO-004 Agent blocked | | ☐ | ☐ | ☐ | |

**P6 sign-off (MD / CEO Viewer):** _______________ Date: _______________

---

## P7 — Defect triage

| Check | Done |
|-------|:----:|
| All FAILs logged in [`UAT_BUG_REGISTER.md`](./UAT_BUG_REGISTER.md) | ☐ |
| Critical = 0 open | ☐ |
| High = 0 open | ☐ |
| Medium accepted with owners | ☐ |
| Low documented | ☐ |
| Retests of fixed items (post-ESP-05 if fixes occur later) | ☐ |

---

## P8 — Package close

| Artifact | Complete |
|----------|:--------:|
| Test cases filled (Actual / PASS·FAIL) | ☐ |
| This checklist complete | ☐ |
| Bug register frozen for decision | ☐ |
| [`UAT_SIGNOFF.md`](./UAT_SIGNOFF.md) signed | ☐ |
| [`GO_LIVE_READINESS.md`](./GO_LIVE_READINESS.md) decision recorded | ☐ |

**IT Manager checklist close:** _______________ Date: _______________
