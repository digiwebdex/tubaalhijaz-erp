# TUBA AL HIJAZ — UI-02 Navigation & App Shell

**Sprint:** UI-02  
**Status:** Complete  
**SSOT:** [UI_DESIGN_SYSTEM.md](./UI_DESIGN_SYSTEM.md) + companion UI-01 docs  
**Scope:** Application shell + navigation only — no dashboard/form/table redesign  

---

## 1. Objective

Replace cluttered per-module sidebars + icon module switcher with an **operations-first global sidebar**, simplified header, and clear breadcrumb — while keeping all routes, permissions, and business logic unchanged.

---

## 2. Architecture

| Layer | Responsibility |
|-------|----------------|
| **Primary rail** | Global nav (`navConfig.ts`) — React Router `Link`s (staff) or portal tab buttons (agent/supplier) |
| **Secondary tabs** | Existing page `navItems` + `onItemClick` — horizontal strip under header (staff only) |
| **UX gates** | Existing `canAccessPath` / `hasAnyPermission` / company type — **no new RBAC** |
| **Deep links** | Optional `?tab=` for Ops, Super Admin, Automation (`shellTab.ts`) |

**Code sources**

- `apps/web/src/app/components/ERPShell.tsx` — shell, header, breadcrumb, mobile drawer  
- `apps/web/src/app/lib/navConfig.ts` — groups, Bangla/EN labels, Advanced Tools  
- `apps/web/src/app/lib/shellTab.ts` — `?tab=` sync helper  
- `apps/web/src/app/lib/rbac.ts` — unchanged permission keys  

---

## 3. Language

| Rule | Detail |
|------|--------|
| Default | Bangla (`LangContext` default `"bn"`) |
| Optional | English via header toggle |
| Primary labels | `labelBn` / `labelEn` on every global item |
| Secondary tabs | Prefer `labelBn` when provided |

---

## 4. Staff sidebar (operations-first)

```
ড্যাশবোর্ড
────────
এজেন্ট · সাপ্লায়ার
────────
গ্রুপ · যাত্রী
────────
ভিসা ডেস্ক · লং স্টে · হোটেল · পরিবহন · খাদ্য সেবা · ডিসপ্যাচ · ফ্লিট
────────
হিসাব
────────
রিপোর্ট
────────
সেটিংস
  সিস্টেম সেটিংস · ব্যবহারকারী · অ্যাডমিন ড্যাশবোর্ড
  ▸ অ্যাডভান্সড টুলস
      এআই · ওসিআর · ওয়ার্কফ্লো · অটোমেশন · অডিট · বিজ্ঞপ্তি
```

Hotel / Transport / Catering / Dispatch / Fleet remain reachable (existing modules) — not removed.

---

## 5. Hidden from top-level (moved under Advanced Tools)

| Former top-level | New location | Destination |
|------------------|--------------|-------------|
| AI Engine | Settings → Advanced Tools | `/super-admin?tab=ai-engine` |
| Workflow Engine | Advanced Tools | `/super-admin?tab=workflows` |
| Automation Engine | Advanced Tools | `/automation` |
| OCR Center | Advanced Tools | `/ocr-center` (live page, now in ERPShell) |
| Audit Logs | Advanced Tools | `/super-admin?tab=audit` |
| Notification Center | Advanced Tools | `/automation?tab=notifications` |

Nothing deleted. Super Admin secondary nav no longer lists these engines; they remain in `screenMap` / dedicated routes.

---

## 6. Role mapping (examples — existing permissions)

| Persona | Sees (examples) | Hidden (examples) |
|---------|-----------------|-------------------|
| **Ops / Visa** (`VIEW_DASHBOARD`, …) | Dashboard, Visa Desk, Long Stay, Groups, OCR (if `REVIEW_OCR_QUEUE`), Automation (if `CONFIGURE_WORKFLOWS`) | Finance (`FINANCIAL_REPORTS` required) |
| **Finance** (`FINANCIAL_REPORTS`, …) | Dashboard, Finance, Reports, Audit (if `ACCESS_AUDIT_LOGS`) | OCR / Automation without those perms |
| **Agent** (`company.type=AGENT`) | Portal: Dashboard, My Groups, Passengers, Visa, Payments + More | All staff / Super Admin rails |
| **Supplier** (`company.type=SUPPLIER`) | Portal booking/finance tabs only | Staff modules |
| **Super Admin** (full `P.*`) | Full staff rail + Advanced Tools | — |

Frontend hide ≠ authorization. API `PermissionsGuard` remains the boundary.

---

## 7. Header (simplified)

Kept only:

1. **Search**  
2. **Notifications** (bell + live feed)  
3. **Language** (বাং / EN)  
4. **Profile** (name, preferences stub, sign out)  

Mobile: hamburger opens drawer. Removed bottom module icon grid clutter.

---

## 8. Breadcrumb

```
হোম / Home  →  Module  →  Current page
```

Module title localized via `MODULE_TITLE` in `navConfig.ts`.

---

## 9. Responsive

| Breakpoint | Behavior |
|------------|----------|
| Desktop | Sidebar 240 / collapse 64 |
| Tablet / Mobile (`useIsMobile` &lt; 768) | Overlay drawer + menu button |

---

## 10. Tests

| Check | Result |
|-------|--------|
| `pnpm run typecheck` (apps/web) | PASS |
| `pnpm run test:rbac` | PASS |
| `pnpm run test:nav` | PASS |
| `pnpm run build` | PASS |

---

## 11. Risks

| Risk | Mitigation |
|------|------------|
| Multiple primary items share a route (e.g. Visa/Hotel → `/ops-departments`) | Secondary dept tabs still select desk; active highlight may match several peers |
| `?tab=` not wired on every module | Dashboards / Finance / Fleet still use local tab state; deep links added where Advanced Tools need them |
| Empty Settings group for audit-only roles | Advanced Tools still renders under a Settings heading |

---

## 12. Rollback

1. Revert `ERPShell.tsx`, `navConfig.ts`, `shellTab.ts`  
2. Revert SuperAdmin / OpsControl / Automation / OCRCenter shell wiring  
3. Remove `docs/ui/UI_02_NAVIGATION.md` and `test:nav` if desired  

No database or API migration to roll back.
