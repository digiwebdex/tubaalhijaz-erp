# TRANSFORM-001 — Changelog

**Release family:** Customer Group Foundation  
**Scope:** T001-01 … T001-10  
**Date:** 2026-08-01

---

## Added

### Group spine
- Nullable unique **Nusuk Group Number** on Group
- Visa type **HAJJ** (alongside UMRAH, LONG_STAY)
- **Haji WhatsApp**, consulate, services value, uploaded-by (user/label)
- Optional env enforcement: `REQUIRE_HAJI_WHATSAPP`

### Readiness
- Four independent gates: `gateVisa`, `gatePackage`, `gatePayment`, `gateBill`
- Domain event `group.gates.changed`

### Mutamer
- Passenger foundation fields (age, EA codes/names, biometric, MOFA, visa number, mutamer type, visa status labels)
- Server Mutamer Excel/CSV import: **preview → confirm → transactional commit**
- Business sample column contract + **legacy 7-column CSV** compatibility
- `MutamerImportRun` import fingerprinting
- Max 1000 rows; JSON body limit 15mb for large commits

### OCR intake
- Passport OCR approve requires **Group**; create Mutamer or **attach** to existing
- Upload kind **PASSPORT**
- OCR type **NUSUK_GROUP_LIST** (flagged): approve creates/updates Group by Nusuk uniqueness
- `GET /ocr/capabilities` for UI mode switch
- Feature flag: `ENABLE_NUSUK_GROUP_LIST_OCR` (default off)

### Notifications
- Intake events: group created, gates changed, mutamer import completed, group-list OCR committed
- Automation rules **AR-GRP-01 … AR-GRP-04**
- Agent (tenant) + Admin staff (IN_APP) recipient policy
- Shared bilingual templates for intake NotificationEvent keys

### UI
- Agent Portal: Group foundation create/edit; Mutamer import modal upgrade; OCR readiness badge
- OCR Center: Passport vs Group List mode (when flag on)
- Ops Group Master: Nusuk, name, package, WhatsApp, uploaded by, agent, Excel **VISA · PKG · PAY · BILL** columns with inline toggle

### Verification
- Foundation smoke pack `transform-001-smoke.e2e-spec.ts` (T001-10)

---

## Changed

- `GET /ops/groups` projection includes foundation fields + `name` + gates (additive)
- Groups/Passengers create/update accept optional foundation fields (old clients remain valid)
- OCR approve paths extended (passport attach; Nusuk group-list commit) without parallel OCR APIs

---

## Fixed / Hardened

- Agent tenancy fail-closed preserved on groups, passengers, import, OCR
- Duplicate Nusuk number blocked (409 / update path for OCR)
- Duplicate passport handling on import and OCR attach guidance
- WA channel skip-safe when `WASENDER_API_KEY` unset

---

## Not included (by design)

- Hotel / BRN / Transport / Finance / MOFA bill engines
- Long Stay day-85
- Mutamer portal / login
- Full notification matrix beyond intake slice
- Transformation-002

---

## Migrations

See [FINAL_ACCEPTANCE.md](./FINAL_ACCEPTANCE.md) §3 and [DEPLOYMENT.md](./DEPLOYMENT.md).

| ID | Summary |
|----|---------|
| `20260801030000_group_nusuk_hajj` | Group Nusuk + HAJJ |
| `20260801040000_group_readiness_gates` | Four readiness gates |
| `20260801050000_passenger_mutamer_fields` | Passenger Mutamer columns |
| `20260801060000_mutamer_import_run` | MutamerImportRun |
| `20260801070000_upload_kind_passport` | UploadKind.PASSPORT |
| `20260801080000_ocr_nusuk_group_list` | OcrDocumentType.NUSUK_GROUP_LIST |
