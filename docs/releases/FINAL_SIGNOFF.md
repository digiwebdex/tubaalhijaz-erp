# Final Sign-Off — TUBA AL HIJAZ ERP v2.0.0

**Release:** Official v2.0.0 (ESP-07)  
**Date opened:** 2026-08-02  
**Git tag:** `v2.0.0`  
**Technical readiness:** [`PRODUCTION_READINESS.md`](./PRODUCTION_READINESS.md) · [`v2.0_RELEASE.md`](./v2.0_RELEASE.md)  
**UAT pack:** [`docs/uat/`](../uat/)  

---

## 1. Purpose

Record official acceptance of **v2.0.0** for production.  
ESP-07 does **not** invent signatures — humans must sign below.

---

## 2. Pre-sign verification (IT — fill at ceremony)

| Check | Pass |
|-------|:----:|
| Tag `v2.0.0` exists on release commit | ☐ |
| API healthy (`esp06-20260802` or documented equivalent) | ☐ |
| Web healthy | ☐ |
| Workers listening; failed queues acceptable | ☐ |
| Backup timer active; recent dump present | ☐ |
| Monitoring up (if required by policy) | ☐ |
| `REFRESH_COOKIE_PATH=/api/auth`, `COOKIE_SECURE=true` | ☐ |
| Known issues reviewed with MD | ☐ |

**IT attestation date:** _______________ **Initials:** _______________

---

## 3. Business signatories

### Operations Manager

| | |
|--|--|
| Accepts ops / gates / OCR / Group Master for production use | ☐ |
| Name / Signature / Date | |

### Visa Manager

| | |
|--|--|
| Accepts Visa Desk / pipeline / LS posture (no live gov API) | ☐ |
| Name / Signature / Date | |

### Finance Manager

| | |
|--|--|
| Accepts Finance desks / agent slip path; MOFA bill flag decision recorded | ☐ Off ☐ On |
| Name / Signature / Date | |

### IT Manager

| | |
|--|--|
| Attests infrastructure / backup / monitoring / tag | ☐ |
| Accepts DR conditions (offsite / drill) or has remediation date | ☐ |
| Name / Signature / Date | |

### Managing Director

| | |
|--|--|
| Authorizes **v2.0.0** production release | ☐ |
| Decision | ☐ **GO** ☐ **GO WITH CONDITIONS** ☐ **NO-GO** |
| Name / Signature / Date | |

Conditions (if any):

---

## 4. Linked forms

| Form | Status at ESP-07 packaging |
|------|----------------------------|
| [`docs/uat/UAT_SIGNOFF.md`](../uat/UAT_SIGNOFF.md) | Prepared — execute then attach |
| [`TRANSFORM_002_BUSINESS_SIGNOFF.md`](./TRANSFORM_002_BUSINESS_SIGNOFF.md) | Prepared — execute then attach |
| [`TRANSFORM_001/BUSINESS_SIGNOFF.md`](./TRANSFORM_001/BUSINESS_SIGNOFF.md) | Prepared — execute then attach |

---

## 5. ESP-07 packaging statement (system)

On **2026-08-02**, ESP-07 recorded:

- Runtime verification **PASS** (API/Web/workers/Redis/queues/cron/backup/monitoring).  
- Technical decision **RELEASED WITH CONDITIONS** pending human signatures above.  
- No application code changed in ESP-07.

This section is **not** a substitute for Managing Director signature.
