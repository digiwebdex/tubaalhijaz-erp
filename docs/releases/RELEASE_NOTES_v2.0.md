# Release Notes — TUBA AL HIJAZ ERP v2.0

**Release name:** Enterprise Stabilization Release  
**Version label:** **v2.0**  
**Certification date:** 2026-08-02  
**Production API image (ESP-06):** `tuba-alhijaz/tuba-alhijaz-api:esp06-20260802`  
**Production Web image (current):** `tuba-alhijaz/tuba-alhijaz-web:stable-20260731`

---

## 1. Summary

v2.0 packages the **intake spine (TRANSFORM-001)**, **visa & Saudi operations (TRANSFORM-002)**, **UI enterprise transform (UI-01…12)**, and **stabilization ESP-01…06** into a production-ready operational release for the Tuba Al Hijaz ERP.

This is **not** a new business-domain transformation. It certifies and hardens what was already implemented.

---

## 2. What’s included

### Business capabilities (already delivered in T001/T002)

- Group spine (Nusuk identity, readiness gates VISA/PACKAGE/PAYMENT/BILL)  
- Mutamer Excel import; passport OCR intake (Group List OCR flag-gated)  
- Ops Group Master; Visa Desk + pipeline state machine  
- Embassy / passport-return SOP (flag-gated)  
- MOFA completeness; MOFA Processing Bill (flag-gated)  
- Long Stay host register + Day-85 compliance pack  
- Executive / Visa & Compliance dashboards  
- Agent portal finance (wallet / payment slips)  
- Staff Finance ERP primary desks  

### Stabilization (ESP)

| Sprint | Focus |
|--------|-------|
| ESP-01 | Legacy modules → Enterprise Kit migration |
| ESP-02 | Confirmed-unused code cleanup |
| ESP-03 | Route/vendor code-splitting & performance |
| ESP-04 | Security & permission audit + verified fixes |
| ESP-05 | UAT package (human execution) |
| ESP-06 | Production readiness certification + ops fixes |

### Security / session (ESP-04 → deployed ESP-06)

- Refresh cookie Path configurable: production **`REFRESH_COOKIE_PATH=/api/auth`**  
- OCR submit file ownership enforced  
- SVG downloads forced `attachment`  
- Production refuses weak `JWT_SECRET`  

---

## 3. Explicit non-claims

- No live MOFA / Nusuk / Absher government API  
- UI-12: not every module is 100% Enterprise Kit (Fleet/OCR/Automation/Supplier may still show legacy chrome)  
- Human UAT signatures may still be pending — see `docs/uat/`  
- Offsite backups may still be disabled — see DR conditions  

---

## 4. Feature flags at go-live (record actuals)

| Flag | Typical default |
|------|-----------------|
| `ENABLE_NUSUK_GROUP_LIST_OCR` | off |
| `VISA_REQUIRE_PASSPORT_RETURN` | off |
| `ENABLE_MOFA_PROCESSING_BILL` | off |
| `REQUIRE_HAJI_WHATSAPP` | off |

---

## 5. Upgrade notes (operators)

1. Deploy API **before** relying on cookie Path fix; recreate container so env loads.  
2. Force **re-login** for all users after cookie Path change.  
3. Ensure monitoring compose is up if dashboards are required.  
4. Confirm nightly `tuba-backup.timer` after host changes.  

---

## 6. Known conditions (v2.0)

See [`PRODUCTION_READINESS.md`](./PRODUCTION_READINESS.md) — decision **GO WITH CONDITIONS**:

- Complete UAT sign-off  
- Enable offsite backups or accept risk  
- Schedule prod restore drill  
- Consider host swap / disk prune  

---

## 7. Documentation index for this release

| Doc |
|-----|
| [`PRODUCTION_READINESS.md`](./PRODUCTION_READINESS.md) |
| [`DEPLOYMENT_CHECKLIST.md`](./DEPLOYMENT_CHECKLIST.md) |
| [`DISASTER_RECOVERY.md`](./DISASTER_RECOVERY.md) |
| [`OPERATIONS_RUNBOOK.md`](./OPERATIONS_RUNBOOK.md) |
| [`TRANSFORM_002_RELEASE_CERTIFICATION.md`](./TRANSFORM_002_RELEASE_CERTIFICATION.md) |
| [`docs/uat/UAT_MASTER_PLAN.md`](../uat/UAT_MASTER_PLAN.md) |
| [`docs/stabilization/ESP_04_SECURITY_AUDIT.md`](../stabilization/ESP_04_SECURITY_AUDIT.md) |

---

## 8. Support

Issues → IT via Operations Runbook escalation table.  
Business defects → log in `docs/uat/UAT_BUG_REGISTER.md` during UAT window.
