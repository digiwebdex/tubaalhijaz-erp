# ESP-02 — Cleanup Summary

**Date:** 2026-08-02

## Removed

- 5 dead Agent Portal profile/dashboard helpers (~170 lines)
- 1 unused Fleet `Modal` adapter
- Unused imports across Agent Portal, Fleet, Supplier, Super Admin, Workflow Map, OCR Center
- Unused Super Admin `recharts` import (charts never mounted)

## Not removed (intentional)

| Category | Examples | Reason |
|----------|----------|--------|
| Live adapters | Fleet `ActionBtn`, Supplier `FF`, Automation `ABtn` | Still referenced |
| Orphan pages | MobileApps, Tablet, DesignSystem, I18nSystem | ComingSoon / archive — product call |
| Kit unused exports | ErpCard, ErpBadge | Kit public surface |
| shadcn ui kit | `components/ui/*` | Zero page imports but not auto-purged |
| Parallel dialects | FInput vs ErpInput | Needs migration sprint, not cleanup |

## Net effect

Lower noise and clearer kit imports on ESP-01 modules; no behavior change. See `DEPENDENCY_REPORT.md` for the full inventory.

## Follow-ups (future sprints)

1. Product sign-off to archive or wire DesignSystem / MobileApps / Tablet / I18nSystem.  
2. Optional knip pass + allowlist for marketing assets.  
3. Migrate remaining adapters → kit (ESP-01 residual / Agent Finance / Finance secondary).  
4. Consider deleting unused shadcn files after explicit sign-off.
