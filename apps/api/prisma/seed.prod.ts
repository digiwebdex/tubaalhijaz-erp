// ─── TUBA AL HIJAZ · PRODUCTION seed ──────────────────────────────────────────
// Reference/config data ONLY — no demo companies/users/Demo@123. Plus one real
// SUPER_ADMIN from env (ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME).
// Idempotent: safe to re-run (reference rows are skipped if present; admin upserts).
// Ships as compiled JS into the prod image (no ts-node at runtime).
import { PrismaClient, Prisma } from "@prisma/client";
import * as argon2 from "argon2";

const prisma = new PrismaClient();
const D = (v: number | string) => new Prisma.Decimal(v);
const day = (n: number, h = 9) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + n); d.setUTCHours(h, 0, 0, 0); return d; };

async function main() {
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  const ADMIN_NAME = process.env.ADMIN_NAME ?? "System Administrator";
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD env vars are required");

  const already = (await prisma.permission.count()) > 0;
  if (already) {
    console.log("Reference data already present — ensuring admin only.");
  } else {
    // ── Season ──
    await prisma.season.create({
      data: { code: "UMR-1446", hijriYear: 1446, name: "Umrah 1446H", nameBn: "উমরাহ ১৪৪৬ হিজরি", startDate: day(-330), endDate: day(35), isActive: true },
    });

    // ── Workflow stages (19) ──
    const stages: Array<[number, number, string, string, string, string, string]> = [
      [1, 1, "Agent Registration", "এজেন্ট নিবন্ধন", "Agent Portal", "Instant — self-service", "/agent-portal"],
      [2, 1, "Verification", "যাচাইকরণ", "Super Admin", "48h review window", "/super-admin"],
      [3, 1, "Agent Approval", "এজেন্ট অনুমোদন", "Super Admin", "4h after verification pass", "/super-admin"],
      [4, 1, "Group Creation", "গ্রুপ তৈরি", "Agent Portal", "Self-service, instant", "/agent-portal"],
      [5, 1, "Pax OCR / Excel", "যাত্রী আমদানি", "OCR Center", "OCR auto-fill < 2 min / pax", "/ocr-center"],
      [6, 1, "Flight & Ticket", "ফ্লাইট ও টিকিট", "Ops Control", "Same-day entry", "/ops-control"],
      [7, 2, "Visa Processing", "ভিসা প্রক্রিয়া", "Visa Desk", "3–10 business days (MOFA)", "/ops-departments"],
      [8, 2, "Hotel Booking", "হোটেল বুকিং", "Hotel Desk", "2–5 days lead time", "/ops-departments"],
      [9, 2, "Transport Dispatch", "পরিবহন প্রেরণ", "Transport", "48h before first arrival", "/ops-departments"],
      [10, 2, "Catering", "খাদ্য সেবা", "Catering", "72h before group start date", "/ops-departments"],
      [11, 2, "Invoice", "চালান", "Finance ERP", "Within 24h of service confirmation", "/finance-erp"],
      [12, 2, "Payment", "অর্থপ্রদান", "Finance ERP", "Net 30 days (standard terms)", "/finance-erp"],
      [13, 2, "Voucher", "ভাউচার", "Agent Portal", "24h after payment confirmed", "/agent-portal"],
      [14, 3, "WhatsApp & Email", "হোয়াটসঅ্যাপ ও ইমেইল", "Automation", "Fully automated — instant", "/automation"],
      [15, 3, "Arrival", "আগমন", "Ops Control", "Complete within 2h of landing", "/ops-control"],
      [16, 3, "Stay", "অবস্থান", "Hotel Desk", "Ongoing — full stay period", "/ops-departments"],
      [17, 3, "Departure", "প্রস্থান", "Ops Control", "Ops mobilized 4h before STD", "/ops-control"],
      [18, 3, "Final Statement", "চূড়ান্ত বিবরণী", "Finance ERP", "Within 5 days of return flight", "/finance-erp"],
      [19, 3, "Archive", "সংরক্ষণাগার", "Super Admin", "30 days after departure", "/super-admin"],
    ];
    await prisma.workflowStage.createMany({ data: stages.map(([id, phase, labelEn, labelBn, module, slaText, route]) => ({ id, phase, labelEn, labelBn, module, slaText, route })) });

    // ── Chart of accounts ──
    await prisma.chartAccount.createMany({ data: [
      { code: "1001", name: "Cash — Al Rajhi Bank", nameBn: "নগদ — আল রাজি ব্যাংক", kind: "ASSET" },
      { code: "1002", name: "Cash — Alinma Bank", nameBn: "নগদ — আলিনমা ব্যাংক", kind: "ASSET" },
      { code: "1003", name: "Cash — SNB Operations", nameBn: "নগদ — এসএনবি", kind: "ASSET" },
      { code: "1200", name: "Accounts Receivable — Agents", nameBn: "প্রাপ্য — এজেন্ট", kind: "ASSET" },
      { code: "1400", name: "Prepaid Expenses", nameBn: "অগ্রিম ব্যয়", kind: "ASSET" },
      { code: "1500", name: "Equipment & Fixtures", nameBn: "সরঞ্জাম", kind: "ASSET" },
      { code: "1510", name: "Vehicles & Fleet", nameBn: "যানবাহন ও ফ্লিট", kind: "ASSET" },
      { code: "2101", name: "Accounts Payable — Suppliers", nameBn: "প্রদেয় — সরবরাহকারী", kind: "LIABILITY" },
      { code: "2201", name: "VAT Payable", nameBn: "প্রদেয় ভ্যাট", kind: "LIABILITY" },
      { code: "2300", name: "Agent Advance Payments", nameBn: "এজেন্ট অগ্রিম", kind: "LIABILITY" },
      { code: "2400", name: "Bank Loan — Al Rajhi", nameBn: "ব্যাংক ঋণ", kind: "LIABILITY" },
      { code: "3000", name: "Share Capital", nameBn: "শেয়ার মূলধন", kind: "EQUITY" },
      { code: "3100", name: "Retained Earnings", nameBn: "সংরক্ষিত আয়", kind: "EQUITY" },
      { code: "4001", name: "Revenue — Visa Services", nameBn: "আয় — ভিসা", kind: "REVENUE" },
      { code: "4002", name: "Revenue — Hotel Services", nameBn: "আয় — হোটেল", kind: "REVENUE" },
      { code: "4003", name: "Revenue — Transport Services", nameBn: "আয় — পরিবহন", kind: "REVENUE" },
      { code: "4004", name: "Revenue — Catering Services", nameBn: "আয় — ক্যাটারিং", kind: "REVENUE" },
      { code: "4005", name: "Revenue — Other Services", nameBn: "আয় — অন্যান্য", kind: "REVENUE" },
      { code: "5001", name: "Hotel Costs", nameBn: "হোটেল ব্যয়", kind: "EXPENSE", plSection: "COGS" },
      { code: "5002", name: "Transport Costs", nameBn: "পরিবহন ব্যয়", kind: "EXPENSE", plSection: "COGS" },
      { code: "5003", name: "Catering Costs", nameBn: "ক্যাটারিং ব্যয়", kind: "EXPENSE", plSection: "COGS" },
      { code: "5004", name: "Visa Processing Fees", nameBn: "ভিসা প্রক্রিয়াকরণ ফি", kind: "EXPENSE", plSection: "COGS" },
      { code: "6001", name: "Staff Salaries", nameBn: "কর্মচারী বেতন", kind: "EXPENSE", plSection: "OPEX" },
      { code: "6002", name: "Office Rent", nameBn: "অফিস ভাড়া", kind: "EXPENSE", plSection: "OPEX" },
      { code: "6003", name: "Marketing", nameBn: "বিপণন", kind: "EXPENSE", plSection: "OPEX" },
      { code: "6004", name: "IT & Systems", nameBn: "আইটি ও সিস্টেম", kind: "EXPENSE", plSection: "OPEX" },
      { code: "6005", name: "Other Admin", nameBn: "অন্যান্য প্রশাসন", kind: "EXPENSE", plSection: "OPEX" },
    ] });

    // ── Currency rates (SAR base) ──
    await prisma.currencyRate.createMany({ data: [
      { currency: "SAR", rateToSar: D("1.0000"), asOf: day(0, 6) },
      { currency: "USD", rateToSar: D("3.7500"), asOf: day(0, 6) },
      { currency: "BDT", rateToSar: D("0.0310"), asOf: day(0, 6) },
      { currency: "EUR", rateToSar: D("4.0500"), asOf: day(0, 6) },
      { currency: "GBP", rateToSar: D("4.7200"), asOf: day(0, 6) },
      { currency: "TRY", rateToSar: D("0.1150"), asOf: day(0, 6) },
    ] });

    // ── Notification events ──
    const EVENTS: Array<[string, string, string, "LOW" | "NORMAL" | "EMERGENCY", boolean, boolean, boolean]> = [
      ["AGENT_REGISTRATION_SUBMITTED", "Agent Registration Submitted", "এজেন্ট নিবন্ধন জমা হয়েছে", "NORMAL", true, true, true],
      ["AGENT_APPROVED", "Agent Approved", "এজেন্ট অনুমোদিত", "NORMAL", true, true, true],
      ["AGENT_REJECTED", "Agent Rejected", "এজেন্ট প্রত্যাখ্যাত", "NORMAL", true, true, true],
      ["GROUP_CREATED", "Group Created", "গ্রুপ তৈরি হয়েছে", "NORMAL", true, true, true],
      ["GROUP_GATES_CHANGED", "Group Readiness Gates Changed", "গ্রুপ প্রস্তুতি গেট পরিবর্তিত", "NORMAL", true, true, true],
      ["GROUP_IMPORT_COMPLETED", "Mutamer Import Completed", "মুতামির আমদানি সম্পন্ন", "NORMAL", true, true, true],
      ["GROUP_OCR_COMMITTED", "Nusuk Group List OCR Committed", "নুসুক গ্রুপ তালিকা OCR প্রতিশ্রুত", "NORMAL", true, true, true],
      ["VISA_APPLICATION_SUBMITTED", "Visa Application Submitted", "ভিসা আবেদন জমা হয়েছে", "NORMAL", true, true, true],
      ["VISA_APPROVED", "Visa Approved", "ভিসা অনুমোদিত", "NORMAL", true, true, true],
      ["VISA_REJECTED", "Visa Rejected", "ভিসা প্রত্যাখ্যাত", "NORMAL", true, true, true],
      ["HOTEL_BOOKING_CONFIRMED", "Hotel Booking Confirmed", "হোটেল বুকিং নিশ্চিত", "NORMAL", true, true, true],
      ["INVOICE_GENERATED", "Invoice Generated", "চালান তৈরি হয়েছে", "NORMAL", true, true, true],
      ["PAYMENT_RECEIVED", "Payment Received", "পেমেন্ট গৃহীত", "NORMAL", true, true, true],
      ["CONTRACT_SIGNED", "Contract Signed", "চুক্তি স্বাক্ষরিত", "NORMAL", false, true, true],
      ["SUPPORT_TICKET_OPENED", "Support Ticket Opened", "সাপোর্ট টিকেট খোলা হয়েছে", "NORMAL", false, true, true],
      ["SYSTEM_ALERT", "System Alert", "সিস্টেম সতর্কতা", "EMERGENCY", true, true, true],
      ["DAILY_BACKUP_COMPLETED", "Daily Backup Completed", "দৈনিক ব্যাকআপ সম্পন্ন", "LOW", false, true, false],
    ];
    for (const [key, labelEn, labelBn, priority, wa, em, ia] of EVENTS) {
      await prisma.notificationEvent.create({ data: { key, labelEn, labelBn, priority, whatsapp: wa, email: em, inApp: ia } });
    }

    // ── Automation engine rules ──
    const ENGINE: Array<{ code: string; category: string; name: string; nameBn: string; trigger: string; eventKey: string | null; conditionExpr: string | null; conditions: unknown; actions: unknown[]; cronExpr?: string | null; enabled?: boolean }> = [
      { code: "R01", category: "Agent", name: "Agent Approval → Welcome", nameBn: "এজেন্ট অনুমোদন", trigger: "Agent verified", eventKey: "agent.approved", conditionExpr: "Status = VERIFIED", conditions: null, actions: [{ type: "SEND_NOTIFICATION", params: { channel: "EMAIL", eventKey: "AGENT_APPROVED", title: "Welcome to TUBA AL HIJAZ" } }] },
      { code: "AR-GRP-01", category: "Group", name: "Group Created → Notify", nameBn: "গ্রুপ তৈরি", trigger: "Group created", eventKey: "group.created", conditionExpr: null, conditions: null, actions: [{ type: "SEND_NOTIFICATION", params: { eventKey: "GROUP_CREATED", title: "New group created", notifyPolicy: "intake" } }] },
      { code: "AR-GRP-02", category: "Group", name: "Gates Changed → Notify", nameBn: "গেট পরিবর্তন", trigger: "Group readiness gates changed", eventKey: "group.gates.changed", conditionExpr: null, conditions: null, actions: [{ type: "SEND_NOTIFICATION", params: { eventKey: "GROUP_GATES_CHANGED", title: "Group readiness gates updated", notifyPolicy: "intake" } }] },
      { code: "AR-GRP-03", category: "Group", name: "Mutamer Import → Notify", nameBn: "মুতামির আমদানি", trigger: "Mutamer bulk import completed", eventKey: "group.import.completed", conditionExpr: null, conditions: null, actions: [{ type: "SEND_NOTIFICATION", params: { eventKey: "GROUP_IMPORT_COMPLETED", title: "Mutamer import completed", notifyPolicy: "intake" } }] },
      { code: "AR-GRP-04", category: "Group", name: "Group List OCR → Notify", nameBn: "গ্রুপ তালিকা OCR", trigger: "Nusuk group-list OCR approved", eventKey: "group.ocr.committed", conditionExpr: null, conditions: null, actions: [{ type: "SEND_NOTIFICATION", params: { eventKey: "GROUP_OCR_COMMITTED", title: "Group list OCR committed", notifyPolicy: "intake" } }] },
      { code: "AR-VISA-01", category: "Visa", name: "Visa Issued → Notify", nameBn: "ভিসা ইস্যু", trigger: "Passenger visa pipeline → ISSUED", eventKey: "visa.approved", conditionExpr: null, conditions: null, actions: [{ type: "SEND_NOTIFICATION", params: { eventKey: "VISA_APPROVED", title: "Visa issued", notifyPolicy: "visa" } }] },
      { code: "AR-VISA-02", category: "Visa", name: "Visa Rejected → Notify", nameBn: "ভিসা প্রত্যাখ্যান", trigger: "Passenger visa pipeline → REJECTED", eventKey: "visa.rejected", conditionExpr: null, conditions: null, actions: [{ type: "SEND_NOTIFICATION", params: { eventKey: "VISA_REJECTED", title: "Visa rejected", notifyPolicy: "visa" } }] },
      { code: "AR-VISA-03", category: "Visa", name: "Passport Returned → Notify", nameBn: "পাসপোর্ট ফেরত", trigger: "Passenger visa pipeline → PASSPORT_RETURNED", eventKey: "visa.passport.returned", conditionExpr: null, conditions: null, actions: [{ type: "SEND_NOTIFICATION", params: { eventKey: "PASSPORT_RETURNED", title: "Passport returned", notifyPolicy: "visa" } }] },
      { code: "AR-LS-85", category: "LongStay", name: "Long Stay Day-85 → Notify Host/Agent/Tuba", nameBn: "ডে-৮৫ রিমাইন্ডার", trigger: "Day-85 sweep: Kingdom day ≥ 85", eventKey: "longstay.day85", conditionExpr: "stage = DUE", conditions: [{ path: "data.stage", op: "eq", value: "DUE" }], actions: [{ type: "SEND_NOTIFICATION", params: { eventKey: "LONGSTAY_DAY85", title: "Long Stay day-85 compliance due", notifyPolicy: "longstay" } }] },
      { code: "AR-LS-90", category: "LongStay", name: "Long Stay Day-90 → Escalate", nameBn: "ডে-৯০ এসকেলেশন", trigger: "Day-85 sweep: Kingdom day ≥ 90 (overstay risk)", eventKey: "longstay.day85", conditionExpr: "stage = ESCALATED", conditions: [{ path: "data.stage", op: "eq", value: "ESCALATED" }], actions: [{ type: "SEND_NOTIFICATION", params: { eventKey: "LONGSTAY_DAY85", title: "Long Stay overstay risk — day 90", notifyPolicy: "longstay", priority: "EMERGENCY" } }, { type: "ESCALATE", params: { title: "Long Stay overstay risk (day 90)" } }] },
      { code: "AR-BKG-01", category: "Hotel", name: "Hotel Confirmed → Voucher", nameBn: "হোটেল ভাউচার", trigger: "Hotel booking confirmed", eventKey: "booking.confirmed", conditionExpr: "service = hotel", conditions: [{ path: "service", op: "eq", value: "hotel" }], actions: [{ type: "GENERATE_VOUCHER" }], enabled: false },
      { code: "AR-VCH-01", category: "Docs", name: "Voucher → QR", nameBn: "ভাউচার কিউআর", trigger: "Voucher generated", eventKey: "voucher.generated", conditionExpr: null, conditions: null, actions: [{ type: "GENERATE_QR" }] },
      { code: "AR-INV-01", category: "Finance", name: "Invoice → PDF + Notify", nameBn: "চালান পিডিএফ", trigger: "Invoice generated", eventKey: "invoice.generated", conditionExpr: null, conditions: null, actions: [{ type: "GENERATE_PDF", params: { title: "Tax Invoice" } }, { type: "SEND_NOTIFICATION", params: { title: "Invoice ready", eventKey: "INVOICE_GENERATED" } }] },
      { code: "AR-DOC-EXP", category: "Esc", name: "Document Expiring → Escalate", nameBn: "নথির মেয়াদ", trigger: "Compliance doc expiring", eventKey: "document.expiring", conditionExpr: "severity in {CRITICAL, EXPIRED}", conditions: null, actions: [{ type: "ESCALATE" }] },
      { code: "SYS_DAILY_BACKUP", category: "Sys", name: "Daily Database Backup", nameBn: "দৈনিক ব্যাকআপ", trigger: "Schedule: 02:00 daily", eventKey: null, conditionExpr: "Always", conditions: null, actions: [{ type: "RUN_BACKUP" }], cronExpr: "0 2 * * *" },
      { code: "SYS_CLOUD_BACKUP", category: "Sys", name: "Weekly Cloud Backup", nameBn: "ক্লাউড ব্যাকআপ", trigger: "Schedule: 03:00 Sunday", eventKey: null, conditionExpr: "Always", conditions: null, actions: [{ type: "RUN_BACKUP", params: { cloud: true } }], cronExpr: "0 3 * * 0" },
      { code: "SYS_EXPIRY_ESCALATION", category: "Esc", name: "Daily Expiry Sweep", nameBn: "মেয়াদ স্ক্যান", trigger: "Schedule: 06:00 daily", eventKey: null, conditionExpr: "Always", conditions: null, actions: [{ type: "ESCALATE" }], cronExpr: "0 6 * * *" },
      { code: "SYS_LONGSTAY_DAY85", category: "Sys", name: "Daily Day-85 Compliance Sweep", nameBn: "দৈনিক ডে-৮৫ স্ক্যান", trigger: "Schedule: 06:15 daily", eventKey: null, conditionExpr: "Always", conditions: null, actions: [{ type: "SEND_NOTIFICATION", params: { eventKey: "LONGSTAY_DAY85" } }], cronExpr: "15 6 * * *" },
    ];
    for (const r of ENGINE) {
      await prisma.automationRule.create({ data: { code: r.code, category: r.category, name: r.name, nameBn: r.nameBn, trigger: r.trigger, eventKey: r.eventKey, conditionExpr: r.conditionExpr, conditions: (r.conditions ?? Prisma.JsonNull) as Prisma.InputJsonValue, actions: r.actions as unknown as Prisma.InputJsonValue, enabled: r.enabled ?? true, cronExpr: r.cronExpr ?? null } });
    }

    // ── RBAC (permissions + roles + matrix) ──
    const PERMS: Array<[string, string, string]> = [
      ["VIEW_DASHBOARD", "View Dashboard", "ড্যাশবোর্ড দেখুন"],
      ["MANAGE_USERS", "Manage Users", "ব্যবহারকারী ব্যবস্থাপনা"],
      ["APPROVE_COMPANIES", "Approve Companies", "কোম্পানি অনুমোদন"],
      ["FINANCIAL_REPORTS", "Financial Reports", "আর্থিক প্রতিবেদন"],
      ["EDIT_FINANCIAL_RECORDS", "Edit Financial Records", "আর্থিক রেকর্ড সম্পাদনা"],
      ["CONFIGURE_WORKFLOWS", "Configure Workflows", "কর্মপ্রবাহ কনফিগার"],
      ["REVIEW_OCR_QUEUE", "Review OCR Queue", "ওসিআর সারি পর্যালোচনা"],
      ["ACCESS_AUDIT_LOGS", "Access Audit Logs", "অডিট লগ অ্যাক্সেস"],
      ["MANAGE_SYSTEM_SETTINGS", "Manage System Settings", "সিস্টেম সেটিংস ব্যবস্থাপনা"],
      ["API_KEY_ACCESS", "API Key Access", "এপিআই কী অ্যাক্সেস"],
      ["MANAGE_FLEET", "Manage Fleet", "ফ্লিট ব্যবস্থাপনা"],
    ];
    const perms: Record<string, string> = {};
    for (const [key, name, nameBn] of PERMS) perms[key] = (await prisma.permission.create({ data: { key, name, nameBn } })).id;
    const ROLES: Array<[string, string, string, string[]]> = [
      ["SUPER_ADMIN", "Super Admin", "সুপার অ্যাডমিন", PERMS.map((p) => p[0])],
      ["OPS_STAFF", "Operations Staff", "অপারেশন কর্মী", ["VIEW_DASHBOARD", "APPROVE_COMPANIES", "CONFIGURE_WORKFLOWS", "REVIEW_OCR_QUEUE"]],
      ["FINANCE_STAFF", "Finance Staff", "অর্থ কর্মী", ["VIEW_DASHBOARD", "FINANCIAL_REPORTS", "EDIT_FINANCIAL_RECORDS", "ACCESS_AUDIT_LOGS"]],
      ["FLEET_STAFF", "Fleet Staff", "ফ্লিট কর্মী", ["VIEW_DASHBOARD", "MANAGE_FLEET"]],
      ["CEO_VIEWER", "CEO Viewer", "সিইও ভিউয়ার", ["VIEW_DASHBOARD", "FINANCIAL_REPORTS", "ACCESS_AUDIT_LOGS"]],
      ["AGENT", "Travel Agent", "ট্রাভেল এজেন্ট", []],
      ["SUPPLIER", "Supplier", "সরবরাহকারী", []],
      ["DRIVER", "Driver", "চালক", []],
    ];
    for (const [key, name, nameBn, permKeys] of ROLES) {
      await prisma.role.create({ data: { key, name, nameBn, permissions: { create: permKeys.map((pk) => ({ permissionId: perms[pk] })) } } });
    }
  }

  // ── The one real admin (upsert by email) ──
  const superAdmin = await prisma.role.findUniqueOrThrow({ where: { key: "SUPER_ADMIN" } });
  const passwordHash = await argon2.hash(ADMIN_PASSWORD);
  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { passwordHash, roleId: superAdmin.id },
    create: { code: "USR-ADMIN-01", email: ADMIN_EMAIL, passwordHash, name: ADMIN_NAME, roleId: superAdmin.id },
  });
  console.log(`✔ production reference data ready; admin = ${admin.email} (SUPER_ADMIN)`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
