# TRANSFORM-001 — Deployment Guide

**Audience:** DevOps / Tech Lead  
**Prerequisite reading:** [FINAL_ACCEPTANCE.md](./FINAL_ACCEPTANCE.md), [ROLLBACK.md](./ROLLBACK.md)

---

## 1. Production Prerequisites

| # | Requirement | Notes |
|---|-------------|-------|
| 1 | Postgres reachable (`DATABASE_URL`) | Target schema `public` |
| 2 | Redis for BullMQ | OCR, automation, notify queues |
| 3 | MinIO / object storage | Uploads + OCR images |
| 4 | API + Web images built from T001-complete branch | Include shared package rebuild |
| 5 | JWT / CORS / cookie env configured | Existing platform vars |
| 6 | Feature flags decided before go-live | See §3 |
| 7 | Staging smoke green | [TEST_REPORT.md](./TEST_REPORT.md) |
| 8 | Business sign-off | [BUSINESS_SIGNOFF.md](./BUSINESS_SIGNOFF.md) |

Optional for full channel delivery (not blockers):

- `WASENDER_API_KEY` — WhatsApp (skip-safe if empty)
- SMTP_* — Email (skip-safe if empty)

---

## 2. Deployment Order

Follow this order. Do **not** skip migrations.

### Step A — Database (API host / migrate job)

```bash
cd apps/api
pnpm exec prisma migrate deploy
```

Expected migrations (must apply if not already present):

1. `20260801030000_group_nusuk_hajj`
2. `20260801040000_group_readiness_gates`
3. `20260801050000_passenger_mutamer_fields`
4. `20260801060000_mutamer_import_run`
5. `20260801070000_upload_kind_passport`
6. `20260801080000_ocr_nusuk_group_list`

Verify:

```bash
pnpm exec prisma migrate status
```

### Step B — Environment (API)

Set **before** or at container start:

```bash
# Recommended production defaults for go-live
ENABLE_NUSUK_GROUP_LIST_OCR=false
# REQUIRE_HAJI_WHATSAPP=false   # or true when business mandates WA
```

Do **not** enable Group List OCR until ops SOP and reviewers are ready.

### Step C — Deploy API

1. Build/push API image (includes Nest dist + Prisma client)  
2. Rolling restart / compose up API  
3. Confirm boot log: intake notification pack ready (`AR-GRP-01…04`) if ensure runs on ModuleInit  
4. Health check existing API health endpoint (platform standard)

### Step D — Deploy Web

1. Build/push Web image (Vite build with `@tuba/shared` if bundled)  
2. Rolling restart Web  
3. Confirm Agent Portal Groups + Ops Group Master load

### Step E — Post-deploy verification (staging or prod-smoke)

1. Login Ops + Agent  
2. Create UMRAH group without Nusuk (backward compat)  
3. Create HAJJ group with WhatsApp + Nusuk  
4. Toggle gates on Ops Group Master  
5. Mutamer CSV preview → commit (small file)  
6. Confirm `/ocr/capabilities` shows `nusukGroupListOcr: false` when flag off  
7. Confirm NotificationLog or bell for group create / gate flip (if rules enabled)  
8. Optionally run automated smoke (non-prod):

```bash
pnpm --filter @tuba/api test:e2e -- --testPathPattern='transform-001-smoke'
```

### Step F — Enable Group List OCR (optional, separate change window)

Only after business authorization:

```bash
ENABLE_NUSUK_GROUP_LIST_OCR=true
# restart API
```

Then: OCR Center Group List mode → human approve → Group with Nusuk.

---

## 3. Feature Flag Matrix

| Flag | Safe go-live | When to enable |
|------|--------------|----------------|
| `ENABLE_NUSUK_GROUP_LIST_OCR` | `false` | After OCR review SOP + staging drill |
| `REQUIRE_HAJI_WHATSAPP` | `false` (compat) or `true` (strict) | Per Operations Director |

---

## 4. Data / Seed Notes

- Fresh environments: run platform seed (dev) or prod seed as usual  
- Existing DBs: schema migrations only; intake rules upserted by API boot ensure (`ensureIntakeNotificationPack`) and/or seed updates  
- No destructive data migration in T-001

---

## 5. Deploy Sequence vs Task Graph

Suggested historical build order (already implemented):

```
T001-01 ─┬─► T001-02 ─► T001-03 ─► T001-09
         │
         └─► T001-04 ─► T001-05 ─► T001-06
                              │
T001-01 ─────────────────────► T001-07 ─► T001-08 ─► T001-10
```

**Runtime deploy** is image + migrate — not per-task. Single release can ship all T001-01…09 together after migrate deploy.

---

## 6. Compatibility Guarantees

- Old API clients omitting new Group/Passenger fields still work  
- Groups without Nusuk remain loadable  
- Legacy 7-column CSV import still works  
- Passport OCR path unchanged when Group List flag off  
- WorkflowStage retained (not deleted)

---

## 7. Contacts / Ownership

| Role | Responsibility |
|------|----------------|
| Ops Director | Business sign-off; flag enable decisions |
| Tech Lead | Migrate deploy; image rollout |
| OCR / Intake lead | Group List OCR SOP before flag on |
