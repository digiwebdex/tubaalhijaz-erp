# TUBA AL HIJAZ — UI Icon Guide

**Sprint:** UI-01 · SSOT for icons  
**Library:** `lucide-react` (existing)  

---

## 1. Principles

1. **One library** — Lucide only for UI chrome (no emoji status systems).  
2. **Meaning + label** — icons support Bangla text; they do not replace it.  
3. **Optical size** — match density (tables smaller than hero).  
4. **Stroke consistency** — keep Lucide default stroke; do not mix fill-heavy custom SVGs in nav.  
5. **Module color optional** — icon may inherit navy or module accent; never rainbow a toolbar.

---

## 2. Size Scale

| Token | px | Typical use |
|-------|-----|-------------|
| `icon-xs` | 10–12 | Dense table inline, badges |
| `icon-sm` | 14–16 | Buttons (sm), input adornments |
| `icon-md` | 18–20 | Sidebar, header, default buttons |
| `icon-lg` | 22–24 | Empty state secondary |
| `icon-xl` | 32–40 | Empty / error hero icon |
| `icon-2xl` | 48 | Rare marketing |

**Default ERP:** 18–20 in shell; 14–16 in tables.

---

## 3. Color

| Context | Color |
|---------|-------|
| Default | `#0B1E3F` or `currentColor` |
| Muted | `#6B7280` / navy opacity |
| Active nav | Navy or Gold |
| Module | Module accent (see color system) |
| Danger | `#DC2626` |
| Success | `#16A34A` |
| On navy button | `#FFFFFF` |

---

## 4. Common Mappings (guidance)

| Action / concept | Lucide suggestion |
|------------------|-------------------|
| Search | `Search` |
| Filter | `Filter` / `ListFilter` |
| Add | `Plus` / `PlusCircle` |
| Edit | `Pencil` / `SquarePen` |
| Delete | `Trash2` |
| Close | `X` |
| Back | `ArrowLeft` / `ChevronLeft` |
| Chevrons / expand | `ChevronDown` / `Right` |
| Settings | `Settings` |
| User | `User` / `Users` |
| Bell | `Bell` |
| File / doc | `FileText` |
| Download / export | `Download` |
| Upload | `Upload` |
| Refresh | `RefreshCw` |
| Loading | `Loader2` (spin) |
| Check | `Check` / `CheckCircle2` |
| Warning | `AlertTriangle` |
| Error | `AlertCircle` / `XCircle` |
| Info | `Info` |
| Calendar | `Calendar` |
| Clock | `Clock` |
| Building / hotel | `Building2` |
| Plane / travel | `Plane` |
| Truck / transport | `Truck` |
| Wallet / finance | `Wallet` / `CircleDollarSign` |
| Shield / visa | `Shield` / `Stamp` |
| Home | `Home` |
| Menu | `Menu` |
| External | `ExternalLink` |
| More | `MoreHorizontal` |

Pick one icon per action app-wide; do not alternate `Trash` vs `Trash2` randomly.

---

## 5. Placement Rules

| Pattern | Rule |
|---------|------|
| Button | Icon left of Bangla label; `gap-1.5`–`2` |
| Icon-only button | Min 32×32 hit target; `aria-label` in Bangla |
| Input | Left adornment muted; not clickable unless clear/search button |
| Table row | Ghost icon buttons; tooltip or `aria-label` |
| Empty state | Large muted icon above title |
| Sidebar | Icon + label; collapsed = icon + tooltip |

---

## 6. Motion

| Icon | Motion |
|------|--------|
| `Loader2` | CSS spin |
| Refresh on success | Optional brief spin |
| Others | Static |

Respect `prefers-reduced-motion` — stop non-essential spins when requested.

---

## 7. Accessibility

- Decorative icons beside visible text: `aria-hidden="true"`.  
- Icon-only controls: Bangla `aria-label` (and English when `lang=en`).  
- Status: icon **plus** text/color — not icon alone.  
- Do not convey passport/visa state only with color-tinted icons.

---

## 8. Brand / Logo

- Product wordmark / logo assets stay separate from Lucide.  
- Do not replace the logo with a Lucide icon in the shell brand slot.

---

## 9. Anti-patterns

- Emoji in production ERP chrome  
- Mixing Heroicons / Font Awesome / Lucide on one screen  
- Oversized 48px icons in table rows  
- Gold fill icons on gold buttons (contrast failure)  
- Animated icons for decoration in worklists  

---

## 10. Checklist

- [ ] Lucide only  
- [ ] Size from scale  
- [ ] Bangla label or aria-label  
- [ ] Consistent action mapping  
- [ ] Loading uses `Loader2`  
