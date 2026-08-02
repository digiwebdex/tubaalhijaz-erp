# TRANSFORM-001 — Rollback Guide

**Audience:** DevOps / Tech Lead / Ops Director  
**Principle:** Prefer **flag-first soft rollback** before image or schema reverse.

---

## 1. Rollback Priority Order

Execute from top until intake is stable. Stop as soon as risk is contained.

| Priority | Action | Effect | Data loss |
|----------|--------|--------|-----------|
| **1** | Set `ENABLE_NUSUK_GROUP_LIST_OCR=false` + restart API | Group List OCR rejected; passport path unaffected | None |
| **2** | Disable Automation rules `AR-GRP-01` … `AR-GRP-04` | Stops intake NotificationLog fan-out | None |
| **3** | Set `REQUIRE_HAJI_WHATSAPP=false` (if enabled and blocking creates) | Relaxes WA requirement | None |
| **4** | Redeploy **prior Web** image | Removes foundation UI / Excel gate board | None |
| **5** | Redeploy **prior API** image | Removes new emits/endpoints behaviour | None (DB columns remain) |
| **6** | Schema reverse (last resort) | Only if explicitly approved | High risk — see §4 |

T001-10 has **no prod code**; no separate T001-10 rollback.

---

## 2. Soft Rollback (recommended first response)

### 2.1 Disable Group List OCR

```bash
ENABLE_NUSUK_GROUP_LIST_OCR=false
# restart API containers
```

Verify:

```text
GET /ocr/capabilities → nusukGroupListOcr: false
POST /ocr/documents { documentType: NUSUK_GROUP_LIST } → 400 disabled
```

### 2.2 Silence intake notifications

In Automation admin (or SQL): set `enabled = false` for:

- `AR-GRP-01` (group.created)
- `AR-GRP-02` (group.gates.changed)
- `AR-GRP-03` (group.import.completed)
- `AR-GRP-04` (group.ocr.committed)

### 2.3 Relax WhatsApp enforcement

```bash
REQUIRE_HAJI_WHATSAPP=false
# restart API
```

---

## 3. Image Rollback

### Order

1. **Web first** (UI only; API can remain forward-compatible)  
2. **API second** if server behaviour must revert  

Additive API fields are ignored by old UI; old API with new UI may hide foundation columns but should not crash if optional.

### Procedure

1. Tag current images as `transform-001-failed` for forensics  
2. Redeploy last known-good pre-T001 (or last green staging) web/api tags  
3. Keep migrations applied unless §4 is authorized  
4. Re-run smoke against rolled-back stack if still on staging  

---

## 4. Schema Rollback (last resort — not default)

Migrations are **additive**. Leaving columns/enums in place is safe:

- Unused nullable Group/Passenger columns  
- Enum values `HAJJ`, `PASSPORT`, `NUSUK_GROUP_LIST`  
- `MutamerImportRun` table  

**Do not** reverse migrations in production without:

1. Explicit Director + Tech Lead approval  
2. Database backup  
3. Confirmed no dependent rows required by ops  

If reverse is mandated, reverse in **descending** migration order:

6. `20260801080000_ocr_nusuk_group_list`  
5. `20260801070000_upload_kind_passport`  
4. `20260801060000_mutamer_import_run`  
3. `20260801050000_passenger_mutamer_fields`  
2. `20260801040000_group_readiness_gates`  
1. `20260801030000_group_nusuk_hajj`  

Prefer custom “stop writing fields” over DROP COLUMN in live season.

---

## 5. Business Continuity During Rollback

| Capability | Soft rollback state |
|------------|---------------------|
| Group create (internal code) | Continues |
| Nusuk field | Ignored/hidden if UI rolled back |
| Mutamer Excel import | Unavailable if API rolled back; agents may use legacy bulk if still present |
| Passport OCR | Continues if API retained; Group List off |
| Gates | Persist in DB; UI may hide |
| Notifications | Silent if rules disabled |

Ops may temporarily return to spreadsheet for intake **only** if API import/OCR are rolled back — document that exception in incident log.

---

## 6. Rollback Validation Checklist

- [ ] Group List OCR disabled (flag)  
- [ ] Passport OCR still works (or accepted degraded)  
- [ ] Agent can open own groups  
- [ ] Cross-tenant still rejected  
- [ ] No error spike on `/groups`, `/ops/groups`  
- [ ] Incident note filed with images/tags used  

---

## 7. Rollup Rollback Statement (Transformation §7)

> Revert web+api images to pre-T001; feature-flag off OCR group-list; gates/Nusuk columns ignored; passenger extra columns unused.

This package implements that statement as **§1–§3** above.
