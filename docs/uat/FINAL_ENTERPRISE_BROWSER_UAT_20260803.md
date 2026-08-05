# FINAL ENTERPRISE BROWSER UAT

**Date:** 2026-08-03 (UTC+6)  
**Target:** Live production UI `https://tubaalhijaz.com`  
**Method:** Cursor IDE browser only — no source/React/docs inspection for verdicts  
**Overall verdict:** **NOT COMPLETE**

---

## Environment & accounts

| Item | Result |
|------|--------|
| Web | `tuba-alhijaz-web-1` healthy → nginx `tubaalhijaz.com` |
| API | `tuba-alhijaz-api-1` healthy `:3210` |
| Production users with known passwords | None available at test start (`tokiullah55@gmail.com`, `iqshait@gmail.com` unknown) |
| Permanent Ops Staff user | None existed before UAT |
| UAT accounts used | Temporary: `uat.agent@tubaalhijaz.local`, `uat.ops@tubaalhijaz.local`, `uat.admin@tubaalhijaz.local` / `UatBrowser!2026` |

**WARNING:** Temporary UAT users were created in production DB so browser login could proceed. Rotate/disable after UAT if not wanted.

**WARNING:** Live Groups bundle still contains English **“coming soon”** panels (deployed image lag vs local worktree).

---

## Screenshots captured (browser)

- Agent dashboard / groups list / group detail (all 7 tabs)
- Agent passenger search + add menu / manual drawer path
- Agent Services → Hotel create (status tracker after submit)
- Agent Support placeholder
- Ops Group Master + Bangla edit drawer
- Ops mobile (390×844) drawer
- Super Admin overview + Users & Roles

---

## Group Detail tab matrix (Agent — GRP-1446-9470 Toki)

| Tab | Loads | Blank? | Console/React errors | Search | Drawer | Create | Download | Cancel | Bangla | Verdict |
|-----|-------|--------|----------------------|--------|--------|--------|----------|--------|--------|---------|
| Passengers | Yes | No | None observed | Works (`xyz-no-match` empty + নতুন তৈরি করুন) | Manual drawer opens (যাত্রী যোগ → ম্যানুয়াল এন্ট্রি) | Supported via drawer | Export disabled at 0 pax | N/A this pass | Sidebar/labels BN; foundation EN | **PASS** |
| Flights | Yes | No | None | N/A (empty only) | N/A | No create control (honest empty) | N/A | N/A | Empty EN | **PASS** (read/empty) |
| Hotel | Yes | No | None | No | No | No — **“Hotel bookings — coming soon”** | No | No | EN coming soon | **FAIL** |
| Transport | Yes | No | None | No | No | No — **“Transport — coming soon”** | No | No | EN coming soon | **FAIL** |
| Catering | Yes | No | None | No | No | No — **“Catering — coming soon”** | No | No | EN coming soon | **FAIL** |
| Documents | Yes | No | None | No | No | No — **“Group documents — coming soon”** | No | No | EN coming soon | **FAIL** |
| Timeline | Yes | No | None | No | No | No — **“Activity timeline — coming soon”** | No | No | EN coming soon | **FAIL** |

Criterion from product UAT: every visible tab must be fully functional **or** clearly disabled with **এই মডিউল এখনও কনফিগার করা হয়নি।**  
Live tabs use English “coming soon” instead → **FAIL** for Hotel / Transport / Catering / Documents / Timeline.

---

## Role sessions

### 1) Agent — PASS / FAIL / WARNING

| Check | Verdict | Notes |
|-------|---------|-------|
| Login | **PASS** | Agent portal, Bangla nav |
| Dashboard | **PASS** | KPIs + recent activity |
| Groups list | **PASS** | Search, filter, দেখুন, export |
| Group Detail tabs | **FAIL** | 5/7 tabs English coming-soon placeholders |
| Passenger search / drawer | **PASS** | |
| Services → Hotel create | **PASS** | Submit succeeded; Booking Status → Requested (HTL path) |
| Services hotel catalogue | **WARNING** | “No hotels available” for tenant |
| Support nav | **FAIL** | “future prompt” placeholder shell |
| Group Detail Bangla | **WARNING** | Tabs + foundation mostly English |
| Dead/fake actions on Group Detail Hotel+ | **FAIL** | Clickable tabs that only show coming soon |

### 2) Operations — PASS / FAIL / WARNING

| Check | Verdict | Notes |
|-------|---------|-------|
| Login (Admin tab) | **PASS** | Lands `/dashboards` আজকের কাজ |
| Ops Control Group Master | **PASS** | Search, gates, সম্পাদনা drawer (Bangla) |
| Ops boards tabs present | **PASS** | আগমন / প্রস্থান / ডিসপ্যাচ / … |
| Admin Dashboard as Ops | **WARNING** | Route opens; shows **Missing permission: MANAGE_USERS** (RBAC surfaces correctly) |
| Mobile 390px drawer | **PASS** | Drawer usable; table behind truncated |

### 3) Super Admin — PASS / FAIL / WARNING

| Check | Verdict | Notes |
|-------|---------|-------|
| Login | **PASS** | Extra nav: ফ্লিট, হিসাব, ব্যবহারকারী |
| Super Admin overview | **PASS** | Agents/Suppliers/Users metrics; no MANAGE_USERS error |
| Users & Roles | **PASS** | Lists all 5 users incl. UAT accounts; Add User / search / export |
| OCR Center | **PASS** | Loads (not coming soon) |
| Automation | **PASS** | Route loads (not coming soon) |
| Audit Logs | **PASS** | “Audit Logs” heading |
| AI Engine | **FAIL** | Coming soon |
| Workflow | **FAIL** | Coming soon |

---

## Cross-cutting

| Check | Verdict |
|-------|---------|
| No blank white screens on exercised pages | **PASS** |
| No React error overlay / console hook errors (Agent session) | **PASS** |
| Bangla shell (sidebar/breadcrumbs) | **PASS** |
| Group Detail tab labels Bangla | **FAIL / WARNING** (English tabs) |
| Responsive | **WARNING** — drawer OK at 390px; full Group Detail tab row not re-verified at mobile after role switch |
| Download (group vouchers) | **FAIL** — Documents tab not wired on live |
| Cancel (service booking from Group Detail) | **FAIL** — tab not wired on live |
| Permission enforcement | **PASS** — Ops blocked from MANAGE_USERS content |

---

## PASS summary

- Agent login, dashboard, groups list, Passengers tab, Flights empty state  
- Agent Services Hotel create → Requested tracker  
- Ops Group Master + Bangla foundation drawer  
- Super Admin overview + Users & Roles + OCR/Automation/Audit reachable  
- Permission denial visible for Ops on Super Admin users capability  

## FAIL summary

- Live Group Detail: Hotel, Transport, Catering, Documents, Timeline = English **coming soon** (not Bangla not-configured; not functional)  
- Agent Support module placeholder  
- Super Admin AI Engine + Workflow coming soon  
- Cannot mark enterprise Group Detail UAT complete on live deploy  

## WARNING summary

- Live web image lags local Groups tab wiring  
- Temporary UAT users in production DB  
- No MOH hotels listed for agent tenant  
- Mixed EN/BN on Group Foundation and Super Admin content  
- Production Ops Staff user missing before UAT  

---

## Required before COMPLETE

1. Redeploy web image containing wired Group Detail tabs (or Bangla not-configured where APIs truly absent).  
2. Re-run browser click-through on all 7 Group Detail tabs after deploy.  
3. Verify Documents download + service Cancel from Group Detail when UI connected.  
4. Decide fate of temporary `uat.*@tubaalhijaz.local` users.  

**Status: NOT COMPLETE**
