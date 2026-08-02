# UAT Sign-Off — TUBA AL HIJAZ ERP

**Sprint:** ESP-05 Enterprise Stabilization — User Acceptance Testing  
**Technical predecessors:** TRANSFORM-001/002 release packages · UI-12 · ESP-01…04  
**Business authority:** [`business/TUBA_BUSINESS_OPERATION_MAP.md`](../../business/TUBA_BUSINESS_OPERATION_MAP.md)  
**Execution evidence:** [`UAT_EXECUTION_CHECKLIST.md`](./UAT_EXECUTION_CHECKLIST.md) · [`UAT_BUG_REGISTER.md`](./UAT_BUG_REGISTER.md) · [`GO_LIVE_READINESS.md`](./GO_LIVE_READINESS.md)

---

## 1. Purpose

Confirm that department leads accept the **implemented** ERP for their daily work on the UAT environment, and authorize (or withhold) go-live per the readiness criteria.

This form does **not** approve inventing new workflows or starting Transformation-003.

---

## 2. Acknowledgements (all signatories)

By signing, I acknowledge:

1. UAT covered only **implemented** flows listed in the master plan.  
2. Status advances on Visa Desk are **staff / Umrah Co updates**, not a live MOFA/NUSUK API.  
3. WhatsApp/email may be **skip-safe** on the test host.  
4. Open Medium bugs (if any) are accepted with owners; Low bugs are documented.  
5. Critical and High open bugs must be **zero** for a GO decision.  

| # | Acknowledgement | Initials | Date |
|---|-----------------|----------|------|
| 1 | Read UAT Master Plan scope / out-of-scope | | |
| 2 | Reviewed bug register freeze totals | | |
| 3 | Reviewed Go-Live readiness recommendation | | |

---

## 3. Department acceptance

### Operations Manager

| Criterion | Pass |
|-----------|:----:|
| Group Master / passengers / gates usable for daily ops | ☐ |
| OCR passport intake + Mutamer import acceptable | ☐ |
| Long Stay host path acceptable (if in ops ownership) | ☐ |

| | |
|--|--|
| Name | |
| Signature | |
| Date | |
| Decision | ☐ Accept ☐ Accept with conditions ☐ Reject |

Conditions / comments:

---

### Visa Manager

| Criterion | Pass |
|-----------|:----:|
| Visa Desk + pipeline (issue / reject / complete / passport return) acceptable | ☐ |
| MOFA number completeness understood vs MOFA Bill | ☐ |
| Embassy SOP fields usable as implemented | ☐ |
| Understood: no live government visa API | ☐ |

| | |
|--|--|
| Name | |
| Signature | |
| Date | |
| Decision | ☐ Accept ☐ Accept with conditions ☐ Reject |

Conditions / comments:

---

### Finance Manager

| Criterion | Pass |
|-----------|:----:|
| Finance ERP desks (Invoice / Receipt / AR / AP / Cash) acceptable for go-live use | ☐ |
| Agent payment slip → confirm path acceptable | ☐ |
| MOFA Processing Bill flag decision recorded (On/Off) | ☐ |

| | |
|--|--|
| Name | |
| Signature | |
| Date | |
| Decision | ☐ Accept ☐ Accept with conditions ☐ Reject |

MOFA Bill at go-live: ☐ Off ☐ On  

Conditions / comments:

---

### IT Manager

| Criterion | Pass |
|-----------|:----:|
| Environment stable during UAT; workers healthy | ☐ |
| RBAC / tenancy spot-checks (agent vs staff) acceptable | ☐ |
| Bug register process followed; Critical/High = 0 open | ☐ |
| ESP-04 session/cookie deploy status confirmed if applicable | ☐ |

| | |
|--|--|
| Name | |
| Signature | |
| Date | |
| Decision | ☐ Accept ☐ Accept with conditions ☐ Reject |

Conditions / comments:

---

### Managing Director

| Criterion | Pass |
|-----------|:----:|
| Executive dashboards / reports / visa compliance signals acceptable | ☐ |
| Department accepts above are complete or conditioned | ☐ |
| Residual risks accepted (certification + UAT register) | ☐ |
| Authorize go-live per [`GO_LIVE_READINESS.md`](./GO_LIVE_READINESS.md) | ☐ |

| | |
|--|--|
| Name | |
| Signature | |
| Date | |
| Decision | ☐ **GO** ☐ **GO WITH CONDITIONS** ☐ **NO-GO** |

Conditions / comments:

---

## 4. Combined decision

| Outcome | Meaning |
|---------|---------|
| **GO** | All required signatories Accept; Critical=0; High=0 |
| **GO WITH CONDITIONS** | Accept with written conditions; Medium owners assigned; MD still authorizes |
| **NO-GO** | Any Reject, or Critical/High remain open |

**Recorded outcome:** ☐ GO ☐ GO WITH CONDITIONS ☐ NO-GO  

**Date:** _______________ **Recorded by (IT):** _______________

---

## 5. Link to prior sign-off packages

Human signatures may also complete:

- [`docs/releases/TRANSFORM_001/BUSINESS_SIGNOFF.md`](../releases/TRANSFORM_001/BUSINESS_SIGNOFF.md)  
- [`docs/releases/TRANSFORM_002_BUSINESS_SIGNOFF.md`](../releases/TRANSFORM_002_BUSINESS_SIGNOFF.md)  

ESP-05 UAT sign-off is the **stabilization / go-live human gate** after technical certification. It does not replace department-specific TRANSFORM forms if leadership still requires both.
