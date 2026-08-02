# TUBA AL HIJAZ — UI Accessibility

**Sprint:** UI-01 · SSOT for a11y expectations  
**Context:** Ops-first ERP · Bangla default · Light theme shipped  

---

## 1. Principles

1. **Keyboard reaches every action** that mouse can reach.  
2. **Focus is always visible** — Gold ring is the system standard.  
3. **Color is never the only signal** — pair with Bangla/EN text or icon+text.  
4. **Bangla is a first-class accessible language** — clipping and tiny type are a11y bugs.  
5. **Backend RBAC remains the security boundary** — hiding UI is not authorization.

---

## 2. Focus

| Rule | Spec |
|------|------|
| Visible focus | Gold `#C9A24B` ring ~2px (or gold border) |
| Order | Logical DOM order; no positive `tabIndex` traps |
| Skip | Prefer skip-to-content on marketing; ERP shell: sidebar → main |
| Restore | Return focus to opener when dialog/drawer closes |
| `:focus-visible` | Prefer over always-on focus rings for mouse users |

`interactions.css` already biases toward clear focus/active — keep that contract.

---

## 3. Hover / Active / Disabled

| State | A11y note |
|-------|-----------|
| Hover | Not required for understanding; keyboard users need focus styles instead |
| Active | Press feedback OK; do not rely on it alone |
| Disabled | `disabled` attribute or `aria-disabled`; explain why when useful |
| Loading | Disable duplicate submits; announce busy state when practical (`aria-busy`) |

---

## 4. Contrast

| Pair | Requirement |
|------|-------------|
| Body navy on white / `#F5F7FA` | Pass WCAG AA for text |
| White on navy buttons | Pass |
| Muted gray | Secondary only; avoid for critical status |
| Gold text | Accent / short labels only |
| Status on soft fill | Use solid status for text |

Recheck any new module accent on soft backgrounds before shipping.

---

## 5. Typography & Bangla

| Rule | Detail |
|------|--------|
| Minimum body | Prefer ≥14px (`text-sm`); tables may use `text-xs` / `10px` for dense ops — do not go lower for Bangla labels |
| Line height | `lineHeightFor("bn")` ≈ 1.75 for body |
| Font | Noto Sans Bengali for `bn` |
| Truncation | Avoid ellipsis on essential Bangla actions |
| Language attribute | Document/root or region should reflect `bn` / `en` when toggled |

---

## 6. Forms

- Labels tied to inputs (`htmlFor` / `aria-labelledby`).  
- Errors linked via `aria-describedby` / `aria-invalid`.  
- Required fields announced (visual `*` + accessible name).  
- Do not use placeholder as the only label.  
- Bangla error messages mandatory when UI lang is `bn`.

---

## 7. Dialogs & Drawers

| Requirement | Detail |
|-------------|--------|
| Role | Dialog: modal semantics; Drawer: dialog or complementary as implemented |
| Focus trap | While open, Tab cycles inside |
| Escape | Closes unless blocked by unsaved warning |
| Label | Accessible name = Bangla title |
| Overlay | Click-outside optional; document per pattern |

---

## 8. Tables

- Header cells for columns.  
- Row actions have accessible names (Bangla).  
- Sortable columns expose state when sorting exists.  
- Empty/loading/error states are textually clear, not color-only.

---

## 9. Icons

- Decorative: `aria-hidden="true"`.  
- Icon-only: Bangla `aria-label`.  
- Status: text or badge text required.

See [UI_ICON_GUIDE.md](./UI_ICON_GUIDE.md).

---

## 10. Motion

| Rule | Detail |
|------|--------|
| `prefers-reduced-motion` | Reduce/disable non-essential animation (hero already respects this pattern) |
| Skeleton | Prefer static placeholder when reduced motion |
| Spinners | Essential progress OK; avoid decorative loops |

---

## 11. Loading / Empty / Error

| State | A11y |
|-------|------|
| Loading | Not a silent blank; skeleton or `aria-busy` / live message |
| Empty | Heading + description in Bangla |
| Error | Clear message + recovery action; do not flash only red border |

Use shared `States` components for consistency.

---

## 12. Toasts

- Short, readable Bangla.  
- Do not rely on toast alone for irreversible outcomes — confirm in dialog when destructive.  
- Avoid stacking essential legal text only in toasts.

---

## 13. Responsive & Hit Targets

| Rule | Detail |
|------|--------|
| Min hit target | Prefer ≥32–40px for icon buttons |
| Mobile | Controls must remain tappable; ERP is desktop-first but must not trap |
| Zoom | Layout should tolerate browser zoom; avoid fixed tiny overlays that clip Bangla |

---

## 14. Dark Mode

Tokens exist; product is light-only. When dark ships, re-validate contrast and Gold focus rings.

---

## 15. Security vs UX

| UX (allowed) | Security (required) |
|--------------|---------------------|
| Hide menu items via permissions array | API `PermissionsGuard` / 401/403 |
| Disable buttons client-side | Server rejects unauthorized mutations |
| Soft redirects | Never trust client role alone |

Accessibility of a control does not grant privilege.

---

## 16. Checklist (new UI)

- [ ] Keyboard operable  
- [ ] Gold `:focus-visible`  
- [ ] Bangla labels / aria-labels  
- [ ] Contrast AA for text  
- [ ] Errors not color-only  
- [ ] Dialog/drawer focus management  
- [ ] Reduced motion respected  
- [ ] Loading/empty/error announced clearly  

---

## 17. Out of Scope for UI-01

No code changes, no automated axe CI gate in this sprint — documentation sets the bar for later UI work.
