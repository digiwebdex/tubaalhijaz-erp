# TRANSFORM-001 — Final Acceptance Package

**Program:** Customer Group Foundation  
**Authority:** `transformation/TRANSFORMATION_001_CUSTOMER_GROUP_FOUNDATION.md`  
**Business authority:** Master Business Blueprint + Business Operation Map  
**Package date:** 2026-08-01  
**Status:** Implementation complete (T001-01…T001-10). Ready for staging/prod-smoke sign-off.  
**Do not start:** Transformation-002

---

## 1. Executive Summary

TRANSFORM-001 delivers the **customer intake foundation** for Tuba Al Hijaz ERP:

- Unique **Nusuk Group Number** spine (shared Staff ↔ Agent)
- **HAJJ / UMRAH / LONG_STAY** with Haji WhatsApp (optional enforcement flag)
- Four **readiness gates**: VISA · PACKAGE · PAYMENT · BILL
- **Mutamer Excel** business contract (preview → confirm → commit) + legacy CSV
- **Passport OCR → Mutamer** (Group required; create or attach)
- **Nusuk Group-List OCR → Group** (feature-flagged; human approve)
- **Intake notifications** (Agent + Admin staff; WA skip-safe)
- **Ops Group Master** Excel-like readiness board

Spreadsheet is no longer required as the system of record for **intake**. Hotel, transport, finance, visa processing engines, and Long Stay day-85 remain **out of scope**.

---

## 2. Task Rollup (T001-01 … T001-10)

| Task | Title | Outcome |
|------|-------|---------|
| **T001-01** | Group Nusuk identity & HAJJ | DB/API: Nusuk, HAJJ, WhatsApp, consulate, services, uploaded-by |
| **T001-02** | Readiness gates + PACKAGE | Four gate booleans; `group.gates.changed` emit |
| **T001-03** | Group Foundation UI | Agent Portal + Ops Group Master foundation fields |
| **T001-04** | Passenger Mutamer fields | Nullable Mutamer columns + Excel contract helpers |
| **T001-05** | Mutamer Excel Import Engine | Preview → confirm → transactional commit |
| **T001-06** | Passport OCR intake | Group-required approve; create/attach Mutamer |
| **T001-07** | Nusuk Group-List OCR | Flag-gated type; approve → create/update Group |
| **T001-08** | Intake notification events | AR-GRP-01…04; Agent + staff fan-out |
| **T001-09** | Ops Group Master board | Excel gate columns; inline toggle |
| **T001-10** | Foundation verification pack | Smoke + regression; no prod feature code |

Per-task detail: `docs/T001_01_COMPLETION.md` … `docs/T001_10_COMPLETION.md`.

---

## 3. Migrations (all additive)

Apply via `prisma migrate deploy` in **ascending order**:

| Migration | Task | Purpose |
|-----------|------|---------|
| `20260801030000_group_nusuk_hajj` | T001-01 | `VisaType.HAJJ`; Nusuk/WhatsApp/consulate/services/uploadedBy |
| `20260801040000_group_readiness_gates` | T001-02 | `gateVisa`, `gatePackage`, `gatePayment`, `gateBill` |
| `20260801050000_passenger_mutamer_fields` | T001-04 | Mutamer foundation columns on `Passenger` |
| `20260801060000_mutamer_import_run` | T001-05 | `MutamerImportRun` fingerprint / audit of imports |
| `20260801070000_upload_kind_passport` | T001-06 | `UploadKind.PASSPORT` |
| `20260801080000_ocr_nusuk_group_list` | T001-07 | `OcrDocumentType.NUSUK_GROUP_LIST` |

**T001-03, T001-08, T001-09, T001-10:** no schema migrations (seed/boot upsert for notification pack; UI/API projection only).

---

## 4. Feature Flags & Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `ENABLE_NUSUK_GROUP_LIST_OCR` | **off** | Accepts `NUSUK_GROUP_LIST` OCR; approve → Group. Keep off until ops SOP ready. |
| `REQUIRE_HAJI_WHATSAPP` | **off** | When on, HAJJ/UMRAH create/update require `hajiWhatsapp`. |

Related (pre-existing; not T001-specific): `OCR_PROVIDER`, `WASENDER_API_KEY` (WA skip-safe if blank), SMTP vars, Redis, MinIO, `DATABASE_URL`, JWT.

Documented in `apps/api/.env.example`.

**Intake automation rules (data, not env):** `AR-GRP-01` … `AR-GRP-04` (enabled by seed / boot ensure). Disable in Automation admin to silence intake notify.

---

## 5. Deploy / Rollback / Tests (pointers)

| Document | Contents |
|----------|----------|
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Prerequisites, order, post-deploy checks |
| [ROLLBACK.md](./ROLLBACK.md) | Flag-first then image revert order |
| [TEST_REPORT.md](./TEST_REPORT.md) | Smoke + regression results |
| [CHANGELOG.md](./CHANGELOG.md) | User-facing / ops changelog |
| [BUSINESS_SIGNOFF.md](./BUSINESS_SIGNOFF.md) | Sign-off checklist |

---

## 6. Production Prerequisites

1. Postgres migrations `20260801030000` … `20260801080000` applied  
2. API + Web images containing T001-01…09 code  
3. Redis (automation + OCR + notify queues)  
4. MinIO/object storage for uploads/OCR  
5. Seed or boot ensure for intake notification pack (`AR-GRP-01…04`)  
6. `ENABLE_NUSUK_GROUP_LIST_OCR=false` unless Group List OCR is authorized for go-live  
7. Staging smoke: `transform-001-smoke` green  
8. Business sign-off completed ([BUSINESS_SIGNOFF.md](./BUSINESS_SIGNOFF.md))

---

## 7. Known Limitations

- Nusuk Group-List OCR accuracy depends on image quality; **human approve is mandatory**  
- Mutamer import max **1000** rows; xlsx may require CSV export depending on client path  
- WhatsApp delivery requires `WASENDER_API_KEY`; without it, WA logs skip-safe (PENDING)  
- `REQUIRE_HAJI_WHATSAPP` off by default — ops must enable if business mandates WA  
- Umrah Company full supplier taxonomy deferred (BT-05); optional Company link only if present  
- PAYMENT / BILL gates are **business toggles**; finance settlement engines are not in T-001  
- Dual notify possible on OCR Group create (`group.created` + `group.ocr.committed`) — intentional  
- Ops Group Master table is wide (horizontal scroll on smaller desks)

---

## 8. Accepted Residual Risks

| Risk | Acceptance |
|------|------------|
| Enabling Group List OCR without trained reviewers | Mitigated by default-off flag; accepted if SOP before enable |
| OCR misread of Nusuk number | Accepted with human review gate |
| Notify volume / WA noise | Accepted; mitigated by Notification Center / disable AR-GRP-* |
| Parallel WorkflowStage vs readiness gates | Accepted; gates are business-visible readiness |
| Legacy groups without Nusuk | Accepted; nullable Nusuk; internal `code` remains |

---

## 9. Explicit Non-Goals (still out of scope)

Hotel/BRN · Transport booking · Finance GL/MOFA bill · Long Stay day-85 · Visa processing engine · Mutamer login/portal · Website BT-01 · Transformation-002

---

## 10. Exit Criterion (Transformation §7)

> Operation Map checklist items for Group Number, Mutamer Excel, OCR group open, PACKAGE/VISA gates (PAYMENT/BILL toggles exist even if finance later), intake WhatsApp/logs — all demonstrable without spreadsheet as SoT for intake.

**Verification status:** Demonstrated via T001-10 smoke (10/10) and TRANSFORM-001 regression (65/65). See [TEST_REPORT.md](./TEST_REPORT.md).

---

## 11. Package Contents

```
docs/releases/TRANSFORM_001/
  FINAL_ACCEPTANCE.md    ← this file
  CHANGELOG.md
  DEPLOYMENT.md
  ROLLBACK.md
  TEST_REPORT.md
  BUSINESS_SIGNOFF.md
```

**Supporting task docs:** `docs/T001_01_COMPLETION.md` … `docs/T001_10_COMPLETION.md`  
**Source of truth:** `transformation/TRANSFORMATION_001_CUSTOMER_GROUP_FOUNDATION.md`
