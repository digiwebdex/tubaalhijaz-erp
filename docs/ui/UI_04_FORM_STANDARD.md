# TUBA AL HIJAZ — UI-04 Form Standard

**Sprint:** UI-04  
**Code:** `ErpForm`, `ErpField`, `ErpInput`, `ErpTextarea`, `ErpSelect`, `ErpDrawerFooterActions`  

---

## 1. Layout

| Rule | Spec |
|------|------|
| Columns | **Maximum two** (`grid-cols-1 md:grid-cols-2`) |
| Gap | 16px (`gap-4`) |
| Full-width blocks | `ErpFormRow span={2}` |
| Page density | Comfortable labels; ops drawers may be denser but same components |

---

## 2. Fields

| Part | Spec |
|------|------|
| Label | Above control, `text-xs` semibold, **Bangla first** |
| Required | Red `*` after label + screen-reader “required” |
| Control height | 40px (`h-10`) |
| Radius | 8px |
| Border | Quiet navy alpha → focus Gold (`interactions.css`) |
| Helper | Muted `text-[11px]` under field |
| Error | Red text + `aria-invalid` + red border; Bangla message |

---

## 3. Validation UX

1. Inline errors after blur or submit  
2. Never color-only  
3. Focus first invalid field on submit (page responsibility)  
4. Disable primary Save while `loading`  

---

## 4. Drawer forms

```
Header (title)
Optional tabs
Scrollable ErpForm
Sticky footer: [বাতিল] [সংরক্ষণ]
```

Use `ErpDrawer` + `ErpDrawerFooterActions`.

---

## 5. Dialogs

| Action | Component |
|--------|-----------|
| Generic confirm | `ErpConfirmDialog` |
| Delete | `ErpDeleteDialog` **only** — never custom delete modals |

---

## 6. Bangla copy examples

| EN | BN |
|----|----|
| Save | সংরক্ষণ |
| Cancel | বাতিল |
| Required | এই তথ্য আবশ্যক |
| Delete confirm title | মুছে ফেলার নিশ্চিতকরণ |

---

## 7. Anti-patterns

- Three-column forms  
- Placeholder-as-label  
- Per-screen delete popups  
- English-only required errors when `lang=bn`  
