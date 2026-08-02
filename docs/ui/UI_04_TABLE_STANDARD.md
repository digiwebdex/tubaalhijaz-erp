# TUBA AL HIJAZ — UI-04 Table Standard

**Sprint:** UI-04  
**Code:** `ErpDataTable`, `ErpPagination`, `LoadingSkeleton variant="table"`  

---

## 1. Anatomy

```
┌ Sticky header (sort + select-all) ─────────────┐
│ Compact rows · hover · selection · row actions │
└────────────────────────────────────────────────┘
Pagination (prev / page / next)
```

Wrapped in soft card (`rounded-xl`, quiet border).

---

## 2. Rules

| Feature | Spec |
|---------|------|
| Sticky header | Default `stickyHeader={true}` |
| Row density | Compact `py-2.5` / `text-xs`; min hit ~36–44px on actions |
| Sorting | Optional per column; `aria-sort` when active |
| Bulk selection | Optional checkboxes; indeterminate “some selected” |
| Row actions | Right column; stop propagation so row click ≠ action |
| Row click | Opens drawer / detail (caller `onRowClick`) |
| Empty | Bangla `কোনো তথ্য পাওয়া যায়নি` + optional CTA |
| Loading | Table skeleton rows — **not** a full-page spinner |
| Pagination | `ErpPagination` below table |
| Column resize | **Not supported** in current product (no wired resize). Do not invent until a dedicated sprint. |

---

## 3. With page template

```tsx
<ErpPageTemplate
  title="…"
  primaryAction={<ErpButton>+ নতুন</ErpButton>}
  toolbar={
    <>
      <ErpSearchBar lang="bn" value={q} onChange={…} onClear={…} />
      <ErpFilterPanel open={filtersOpen} onOpenChange={setFiltersOpen}>…</ErpFilterPanel>
    </>
  }
  footer={<ErpPagination page={page} pageSize={20} total={total} onPageChange={setPage} />}
>
  <ErpDataTable columns={…} rows={…} rowKey={…} selectable … />
</ErpPageTemplate>
```

---

## 4. Search & filter

| Control | Spec |
|---------|------|
| Search | One `ErpSearchBar` — default BN placeholder about name / passport / group |
| Filter | `ErpFilterPanel` — **collapsed by default** |

---

## 5. Accessibility

- Header cells for every column  
- Sortable headers keyboard-activatable (button semantics via click + `aria-sort`)  
- Checkbox labels via `aria-label`  
- Do not convey status by color alone — use `ErpStatusChip` in cells  

---

## 6. Responsive

- Horizontal scroll on narrow viewports (`minWidth` table)  
- Sticky header remains within scroll container  
- Pagination stacks / wraps  

---

## 7. Anti-patterns

- Unique table chrome per module  
- Full-page spinner for list loads  
- Missing empty state  
- Actions only as tiny unlabelled icons without `aria-label`  
