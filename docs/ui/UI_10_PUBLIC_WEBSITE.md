# TUBA AL HIJAZ — UI-10 Public Website & Agent Portal

**Sprint:** UI-10  
**Status:** Complete  
**SSOT:** `docs/ui/UI_DESIGN_SYSTEM.md`, `UI_COMPONENT_GUIDE.md`, `UI_09_FINANCE.md`  
**Code:**
- Public: `Home.tsx`, `Services.tsx`, `Contact.tsx`, `Nav.tsx` (+ existing `About.tsx` / `Footer.tsx`)
- Agent: `AgentPortal.tsx`, `AgentPortalGroups.tsx` (package step), `AgentPortalServices.tsx`, `AgentPortalFinance.tsx`

**Scope:** Public Website + Agent Portal UI only.  
**Out of scope:** Finance ERP, Reports, Visa Desk, Long Stay, Automation, DB/API/auth/RBAC.

---

## 1. Objective

Modernize the marketing site and Agent Portal onto the Enterprise Design System / kit without inventing APIs, booking/payment flows, or new marketing claims.

---

## 2. Public Website

### Routes (unchanged)

| Path | Page |
|------|------|
| `/` | Home |
| `/services` | Services |
| `/about` | About |
| `/contact` | Contact |

### Home sections (existing content)

| Section | Status |
|---------|--------|
| Hero | Kept — layout/focus polish only |
| Services | Cards → link to `/services#id`; spacing/focus |
| Why Choose Us | Same copy; quieter list layout |
| Trust strip / Stats / CTA | Kept |
| Process / Packages / Testimonials | **Not in prior content** — not invented |
| Contact / Footer | Via `Root` (Contact page + Footer) |

### Services

- Top icon index (Bangla-first) with in-page anchors  
- Detail blocks keep existing copy/features/stats  
- Consistent spacing + gold focus rings  

### Package list

No public `/packages` route exists. Package **layout** improved in Agent Portal group wizard step 2 (Economy / Standard / Premium card radios — same enum as `PKG_LABEL` / existing create payload).

### Contact

- Form styling: gold `:focus-visible` rings, Bangla labels unchanged  
- Submit remains client-only (`setSubmitted`) — **no backend**  

### Language / a11y

- Default Bangla (`LangContext`)  
- English toggle in Nav  
- Focus rings per UI-01 (`#C9A24B`)  

---

## 3. Agent Portal

### Pages

| Nav | Implementation |
|-----|----------------|
| Dashboard | Kit `ErpPageTemplate` + summary tiles + activity table |
| Groups / Passengers | UI-05 `GroupsModule` (unchanged APIs) |
| Visa Status | `ServicesModule initial="visa"` — BN tab labels |
| Payments | `FinanceModule` — BN tab labels |
| Profile | Kit profile summary from session |

### Dashboard APIs (reuse only)

| Endpoint | Widget |
|----------|--------|
| `GET /groups` | My Groups count + activity |
| `GET /services/visa` | Pending Visa (status ∈ REQUESTED/ASSIGNED/PENDING) |
| `GET /agent-finance/wallet` | Payments / balance |
| `GET /agent-finance/wallet/transactions` | Recent activity (optional) |

**Today's Work** = pending visa count + flag if wallet `pendingCharges > 0` (no new SQL).

Quick actions navigate to existing screens only.

### Shared components

`ErpPageTemplate`, `ErpButton`, `ErpDataTable`, `ErpStatusChip` (+ Groups already uses Search/Filter/Drawer/Pagination).

---

## 4. Responsive

- Marketing: 1→2→3 / 2→4 / 2→6 grids; stacked CTAs  
- Agent tabs: horizontal scroll on small screens  
- Package / visa radios: 1→3 columns  

---

## 5. Tests

```bash
cd apps/web
pnpm run typecheck
pnpm run build
pnpm run test:erp
pnpm run test:website
```

---

## 6. Rollback

Revert listed TSX files + remove `docs/ui/UI_10_PUBLIC_WEBSITE.md` and `website.selftest.ts` / `test:website` script. No DB/API rollback.
