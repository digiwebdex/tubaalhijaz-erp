// ─── TUBA AL HIJAZ — Development seed ────────────────────────────────────────
// Realistic sample data for EVERY model, bilingual (bn + en) wherever the UI
// displays localized text. Mirrors the Phase-1 audit mock data (docs/AUDIT.md):
// canonical codes like GRP-1446-2891, INV-1446-0091, AGT-1446-4827 are kept so
// the frozen UI's familiar records show up once screens are wired to the API.
// Dates are generated RELATIVE TO "now" so live boards always have current rows.
//
// Run (dev only): pnpm --filter @tuba/api db:seed

import { PrismaClient, Prisma } from "@prisma/client";
import * as argon2 from "argon2";

const prisma = new PrismaClient();

// ── helpers ──────────────────────────────────────────────────────────────────
const now = new Date();
/** days offset from now, at a given hour (local) */
function d(days: number, hour = 9, minute = 0): Date {
  const x = new Date(now);
  x.setDate(x.getDate() + days);
  x.setHours(hour, minute, 0, 0);
  return x;
}
const D = (v: number | string) => new Prisma.Decimal(v);

async function main() {
  console.log("── Clearing existing data…");
  // reverse dependency order
  await prisma.auditLog.deleteMany();
  await prisma.notificationLog.deleteMany();
  await prisma.messageTemplate.deleteMany();
  await prisma.notificationEvent.deleteMany();
  await prisma.automationRunLog.deleteMany();
  await prisma.automationRule.deleteMany();
  await prisma.receiptAllocation.deleteMany();
  await prisma.receipt.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.statement.deleteMany();
  await prisma.walletTransaction.deleteMany();
  await prisma.paymentSlip.deleteMany();
  await prisma.wallet.deleteMany();
  await prisma.financeEntry.deleteMany();
  await prisma.ledgerEntry.deleteMany();
  await prisma.chartAccount.deleteMany();
  await prisma.currencyRate.deleteMany();
  await prisma.voucher.deleteMany();
  await prisma.bRN.deleteMany();
  await prisma.additionalServiceRequest.deleteMany();
  await prisma.cateringBooking.deleteMany();
  await prisma.transportBooking.deleteMany();
  await prisma.hotelBooking.deleteMany();
  await prisma.visaRequest.deleteMany();
  await prisma.longStay.deleteMany();
  await prisma.ziyarahTrip.deleteMany();
  await prisma.meetAssistTask.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.dispatchOrder.deleteMany();
  await prisma.vehicleLocation.deleteMany();
  await prisma.vehicleDocument.deleteMany();
  await prisma.fuelLog.deleteMany();
  await prisma.maintenanceRecord.deleteMany();
  await prisma.insurancePolicy.deleteMany();
  await prisma.flightInfo.deleteMany();
  await prisma.passenger.deleteMany();
  await prisma.ocrDocument.deleteMany();
  await prisma.group.deleteMany();
  await prisma.hotel.deleteMany();
  await prisma.driver.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.agentSeasonQuota.deleteMany();
  await prisma.guarantor.deleteMany();
  await prisma.agentProfile.deleteMany();
  await prisma.supplierProfile.deleteMany();
  await prisma.bankAccount.deleteMany();
  await prisma.enquiry.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.role.deleteMany();
  await prisma.company.deleteMany();
  await prisma.workflowStage.deleteMany();
  await prisma.season.deleteMany();

  // ── Season ─────────────────────────────────────────────────────────────────
  console.log("── Season…");
  const season = await prisma.season.create({
    data: {
      code: "UMR-1446",
      hijriYear: 1446,
      name: "Umrah 1446H",
      nameBn: "উমরাহ ১৪৪৬ হিজরি",
      startDate: d(-330),
      endDate: d(35),
      isActive: true,
    },
  });

  // ── Workflow stage catalog (19 stages / 3 phases) ─────────────────────────
  console.log("── Workflow stages…");
  const stages: Array<[number, number, string, string, string, string, string?]> = [
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
  await prisma.workflowStage.createMany({
    data: stages.map(([id, phase, labelEn, labelBn, module, slaText, route]) => ({
      id, phase, labelEn, labelBn, module, slaText, route,
    })),
  });

  // ── RBAC ───────────────────────────────────────────────────────────────────
  console.log("── RBAC…");
  const PERMS = [
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
    ["MANAGE_OPS", "Manage Operations", "অপারেশন ব্যবস্থাপনা"],
    ["MANAGE_FLIGHTS", "Manage Flights", "ফ্লাইট ব্যবস্থাপনা"],
  ] as const;
  const perms: Record<string, string> = {};
  for (const [key, name, nameBn] of PERMS) {
    const p = await prisma.permission.create({ data: { key, name, nameBn } });
    perms[key] = p.id;
  }

  // Role keys are the platform's fixed vocabulary; the permission matrix itself is
  // DB data so Super Admin's "User & Role Management" can edit it dynamically.
  const ROLES: Array<[string, string, string, string[]]> = [
    ["SUPER_ADMIN", "Super Admin", "সুপার অ্যাডমিন", PERMS.map((p) => p[0])],
    ["OPS_STAFF", "Operations Staff", "অপারেশন কর্মী", ["VIEW_DASHBOARD", "APPROVE_COMPANIES", "CONFIGURE_WORKFLOWS", "REVIEW_OCR_QUEUE", "MANAGE_OPS", "MANAGE_FLIGHTS"]],
    ["FINANCE_STAFF", "Finance Staff", "অর্থ কর্মী", ["VIEW_DASHBOARD", "FINANCIAL_REPORTS", "EDIT_FINANCIAL_RECORDS", "ACCESS_AUDIT_LOGS"]],
    ["FLEET_STAFF", "Fleet Staff", "ফ্লিট কর্মী", ["VIEW_DASHBOARD", "MANAGE_FLEET"]],
    ["AIRPORT_STAFF", "Airport Staff", "বিমানবন্দর কর্মী", ["VIEW_DASHBOARD", "MANAGE_FLIGHTS"]],
    ["CEO_VIEWER", "CEO Viewer", "সিইও ভিউয়ার", ["VIEW_DASHBOARD", "FINANCIAL_REPORTS", "ACCESS_AUDIT_LOGS"]],
    ["AGENT", "Travel Agent", "ট্রাভেল এজেন্ট", []],
    ["SUPPLIER", "Supplier", "সরবরাহকারী", []],
    ["DRIVER", "Driver", "চালক", []],
  ];
  const roles: Record<string, string> = {};
  for (const [key, name, nameBn, permKeys] of ROLES) {
    const r = await prisma.role.create({
      data: {
        key, name, nameBn,
        permissions: { create: permKeys.map((pk) => ({ permissionId: perms[pk] })) },
      },
    });
    roles[key] = r.id;
  }

  // ── Users (platform staff) ─────────────────────────────────────────────────
  console.log("── Users…");
  const pw = await argon2.hash("Demo@123");
  const mkUser = (code: string, email: string, name: string, nameBn: string, roleKey: string, companyId?: string) =>
    prisma.user.create({
      data: { code, email, passwordHash: pw, name, nameBn, roleId: roles[roleKey], companyId, lastLoginAt: d(0, 8) },
    });

  const ceo = await mkUser("USR-001", "ceo@tubalhijaz.com", "Abdullah Al-Otaibi", "আবদুল্লাহ আল-ওতাইবি", "SUPER_ADMIN");
  const opsMgr = await mkUser("USR-002", "ops@tubalhijaz.com", "Fatima Al-Zahra", "ফাতিমা আল-জাহরা", "OPS_STAFF");
  const finOfficer = await mkUser("USR-003", "finance@tubalhijaz.com", "Omar Al-Ghamdi", "ওমর আল-গামদি", "FINANCE_STAFF");
  const ocrAdmin = await mkUser("USR-004", "ocr@tubalhijaz.com", "Khalid Mansour", "খালিদ মনসুর", "OPS_STAFF");
  await mkUser("USR-005", "fleet@tubalhijaz.com", "Majed Al-Qahtani", "মাজেদ আল-কাহতানি", "FLEET_STAFF");
  await mkUser("USR-006", "chairman@tubalhijaz.com", "H.E. Khalid Al-Rashidi", "খালিদ আল-রশিদি", "CEO_VIEWER");

  // ── Companies: 5 agents + 3 suppliers ──────────────────────────────────────
  console.log("── Companies…");
  const rashidi = await prisma.company.create({
    data: {
      code: "AGT-1446-4827", type: "AGENT",
      name: "Rashidi Travel Co. LLC", nameBn: "রশিদি ট্রাভেলস কোং",
      city: "Jeddah", email: "info@rashidi-travel.com", phone: "+966 50 123 4567",
      verificationStatus: "VERIFIED", joinedAt: d(-330),
      agentProfile: {
        create: {
          crNumber: "CR-1446-00923",
          crIssueHijri: "01 Muharram 1443H", crExpiryHijri: "30 Dhul Hijja 1448H", crExpiryDate: d(700),
          businessActivity: "Travel Agency & Umrah Services",
          ownerName: "Ahmad Al-Rashidi", ownerIdNumber: "SA901234567", ownerNationality: "Saudi Arabia",
          ownerDobHijri: "15 Rajab 1395H", ownerPosition: "Managing Director",
          ownerMobile: "+966 50 123 4567", ownerWhatsapp: "+966 50 123 4567",
          ownerAddress: "Al Rawdah District, Jeddah",
          businessEmail: "ahmad@rashidi-travel.com", opsEmail: "ops@rashidi-travel.com",
          website: "https://rashidi-travel.com", officePhone: "+966 12 234 5678",
          chequeAmount: D(50000), chequeNumber: "CHQ-0001-2025", chequeBank: "Al Rajhi Bank",
          depositAmount: D(25000), depositRef: "TXN-1446-0091", depositDate: d(-320), depositStatus: "PENDING",
          referenceAgencyName: "Al Noor Pilgrim Services", referenceAgentCode: "AGT-1446-2291",
          referenceContact: "Mahmoud Al-Noor", referencePhone: "+966 55 998 8776",
          platformRating: D("4.80"),
          guarantors: {
            create: [
              { position: 1, name: "Khalid Al-Mansouri", nationalId: "SA123456789", phone: "+966 55 111 2233", relationship: "Business Associate" },
              { position: 2, name: "Faisal Al-Ghamdi", nationalId: "SA987654321", phone: "+966 55 444 5566", relationship: "Family Member" },
            ],
          },
        },
      },
      bankAccounts: {
        create: [{ bankName: "Al Rajhi Bank", beneficiary: "Rashidi Travel Co. LLC", accountNumber: "10298374651234", iban: "SA29 0000 0001 2345 6789 1234", swift: "RJHISARI", isPrimary: true }],
      },
      wallet: { create: { balance: D(24850) } },
    },
  });

  const mkAgent = (code: string, name: string, nameBn: string, city: string, status: "VERIFIED" | "UNDER_REVIEW" | "PENDING") =>
    prisma.company.create({
      data: {
        code, type: "AGENT", name, nameBn, city, verificationStatus: status, joinedAt: d(-300),
        agentProfile: { create: { platformRating: D("4.50") } },
        wallet: { create: { balance: D(10000) } },
      },
    });
  const alnoor = await mkAgent("AGT-1446-2291", "Al-Noor Pilgrim Services", "আল-নূর পিলগ্রিম সার্ভিসেস", "Makkah", "VERIFIED");
  const zamzam = await mkAgent("AGT-1446-3201", "Zamzam Pilgrim Services", "যমযম পিলগ্রিম সার্ভিসেস", "Madinah", "VERIFIED");
  const crown = await mkAgent("AGT-1446-2844", "Crown Hajj Tours", "ক্রাউন হজ ট্যুরস", "Riyadh", "UNDER_REVIEW");
  const makkahTours = await mkAgent("AGT-1446-1988", "Makkah Tours Co.", "মক্কা ট্যুরস কোং", "Makkah", "PENDING");

  const jabalOmar = await prisma.company.create({
    data: {
      code: "SUP-HTL-4291", type: "SUPPLIER",
      name: "Jabal Omar Hyatt Regency", nameBn: "জাবাল ওমর হায়াত রিজেন্সি",
      city: "Makkah", email: "reservations@jabalomar-hyatt.sa", verificationStatus: "VERIFIED", joinedAt: d(-330),
      supplierProfile: { create: { type: "HOTEL", contractedSince: d(-330), starRating: 5, district: "Jabal Omar", qualityScore: D("4.70"), responseTimeHrs: D("2.10") } },
      bankAccounts: { create: [{ bankName: "Al Rajhi Bank", beneficiary: "Jabal Omar Hospitality", accountNumber: "20011223344556", iban: "SA29 0000 0001 4455 6677 1234", swift: "RJHISARI", isPrimary: true }] },
      wallet: { create: { balance: D(0) } },
    },
  });
  const alnaqil = await prisma.company.create({
    data: {
      code: "SUP-TRN-1847", type: "SUPPLIER",
      name: "Al-Naqil Transport Co.", nameBn: "আল-নাকিল ট্রান্সপোর্ট কোং",
      city: "Jeddah", email: "fleet@alnaqil.sa", verificationStatus: "VERIFIED", joinedAt: d(-330),
      supplierProfile: { create: { type: "TRANSPORT", contractedSince: d(-330), fleetSize: 25, primaryVehicleType: "Coach", qualityScore: D("4.50") } },
      bankAccounts: { create: [{ bankName: "Alinma Bank", beneficiary: "Al-Naqil Transport", accountNumber: "30099887766554", iban: "SA44 0500 0001 9988 7766 5544", swift: "INMASARI", isPrimary: true }] },
      wallet: { create: { balance: D(0) } },
    },
  });
  const albarakah = await prisma.company.create({
    data: {
      code: "SUP-CAT-0392", type: "SUPPLIER",
      name: "Al-Barakah Catering Services", nameBn: "আল-বারাকাহ ক্যাটারিং সার্ভিসেস",
      city: "Makkah", email: "orders@albarakah.sa", verificationStatus: "VERIFIED", joinedAt: d(-330),
      supplierProfile: { create: { type: "CATERING", contractedSince: d(-330), dailyMealCapacity: 2000, halalCertBody: "SFDA", qualityScore: D("4.60") } },
      bankAccounts: { create: [{ bankName: "Saudi National Bank", beneficiary: "Al-Barakah Catering", accountNumber: "40012341234123", iban: "SA03 1000 0001 2341 2341 2341", swift: "NCBKSAJE", isPrimary: true }] },
      wallet: { create: { balance: D(0) } },
    },
  });
  // T002-01 — Saudi Umrah Company (visa processing partner)
  const umrahCo = await prisma.company.create({
    data: {
      code: "SUP-UMR-5501", type: "SUPPLIER",
      name: "Al-Haramain Umrah Services", nameBn: "আল-হারামাইন উমরাহ সার্ভিসেস",
      city: "Makkah", email: "visa@alharamain-umrah.sa", verificationStatus: "VERIFIED", joinedAt: d(-300),
      supplierProfile: { create: { type: "UMRAH_COMPANY", contractedSince: d(-300), qualityScore: D("4.80"), responseTimeHrs: D("4.00") } },
      bankAccounts: { create: [{ bankName: "Al Rajhi Bank", beneficiary: "Al-Haramain Umrah Services", accountNumber: "50011223344556", iban: "SA29 0000 0001 5566 7788 9900", swift: "RJHISARI", isPrimary: true }] },
      wallet: { create: { balance: D(0) } },
    },
  });

  // portal users
  const ahmadUser = await mkUser("USR-010", "ahmad@rashidi-travel.com", "Ahmad Al-Rashidi", "আহমাদ আল-রশিদি", "AGENT", rashidi.id);
  await mkUser("USR-011", "office@alnoor-pilgrim.com", "Mahmoud Al-Noor", "মাহমুদ আল-নূর", "AGENT", alnoor.id);
  await mkUser("USR-012", "office@zamzam-pilgrim.com", "Rafiq Zaman", "রফিক জামান", "AGENT", zamzam.id);
  const hotelUser = await mkUser("USR-013", "manager@jabalomar-hyatt.sa", "Sami Qureshi", "সামি কুরেশি", "SUPPLIER", jabalOmar.id);
  await mkUser("USR-014", "dispatch@alnaqil.sa", "Nawaf Al-Zahrani", "নওয়াফ আল-জাহরানি", "SUPPLIER", alnaqil.id);
  await mkUser("USR-015", "kitchen@albarakah.sa", "Bilal Chowdhury", "বিলাল চৌধুরী", "SUPPLIER", albarakah.id);

  // agent season quota (Rashidi: 12/15 groups, 222/280 pax, 222/350 visas)
  const rashidiProfile = await prisma.agentProfile.findUniqueOrThrow({ where: { companyId: rashidi.id } });
  await prisma.agentSeasonQuota.create({
    data: { agentProfileId: rashidiProfile.id, seasonId: season.id, groupsQuota: 15, paxQuota: 280, visaQuota: 350 },
  });

  // ── Hotels catalogue ───────────────────────────────────────────────────────
  console.log("── Hotels…");
  const hotelJabal = await prisma.hotel.create({
    data: { name: "Jabal Omar Hyatt Regency Makkah", nameBn: "জাবাল ওমর হায়াত রিজেন্সি মক্কা", city: "Makkah", stars: 5, distanceFromHaramM: 700, pricePerNight: D(850), supplierId: jabalOmar.id, contactEmail: "reservations@jabalomar-hyatt.sa" },
  });
  await prisma.hotel.createMany({
    data: [
      { name: "Makkah Towers", nameBn: "মক্কা টাওয়ারস", city: "Makkah", stars: 4, distanceFromHaramM: 1200, pricePerNight: D(620) },
      { name: "Movenpick Hajar Tower", nameBn: "মোভেনপিক হাজার টাওয়ার", city: "Makkah", stars: 5, distanceFromHaramM: 900, pricePerNight: D(780) },
      { name: "Pullman ZamZam", nameBn: "পুলম্যান যমযম", city: "Makkah", stars: 5, distanceFromHaramM: 50, pricePerNight: D(1150), available: false },
      { name: "InterContinental Madinah", nameBn: "ইন্টারকন্টিনেন্টাল মদিনা", city: "Madinah", stars: 5, distanceFromHaramM: 200, pricePerNight: D(700) },
    ],
  });

  // ── Groups (5, mirroring the audit) ────────────────────────────────────────
  console.log("── Groups + passengers…");
  const groupsSpec = [
    { code: "GRP-1446-2891", tenant: rashidi, name: "Jeddah Umrah Group — August", nameBn: "জেদ্দা উমরাহ গ্রুপ — আগস্ট", dest: "MAKKAH_MADINAH", pax: 47, stage: 16, status: "IN_PROGRESS", ops: "ACTIVE", depart: d(-10), ret: d(4), note: "In stay — Jabal Omar Hyatt" },
    { code: "GRP-1446-2744", tenant: alnoor, name: "Al-Noor Ramadan Group", nameBn: "আল-নূর রমজান গ্রুপ", dest: "MAKKAH", pax: 32, stage: 9, status: "IN_PROGRESS", ops: "UPCOMING", depart: d(12), ret: d(26), note: "Transport dispatch scheduling" },
    { code: "GRP-1446-3301", tenant: crown, name: "Crown Charter Group", nameBn: "ক্রাউন চার্টার গ্রুপ", dest: "MAKKAH_MADINAH", pax: 67, stage: 7, status: "PENDING", ops: "UPCOMING", depart: d(20), ret: d(34), note: "52 approved, 15 pending MOFA queue" },
    { code: "GRP-1446-2401", tenant: rashidi, name: "Rashidi Family Umrah", nameBn: "রশিদি পারিবারিক উমরাহ", dest: "MADINAH", pax: 28, stage: 8, status: "IN_PROGRESS", ops: "UPCOMING", depart: d(15), ret: d(29), note: "Hotel booking in progress" },
    { code: "GRP-1446-2990", tenant: zamzam, name: "Zamzam Dhaka Group", nameBn: "যমযম ঢাকা গ্রুপ", dest: "MAKKAH", pax: 52, stage: 6, status: "PENDING", ops: "DELAYED", depart: d(8), ret: d(22), note: "PNR entry 38/52 done" },
  ] as const;

  const NAMES: Array<[string, string | null, string]> = [
    ["Mohammed Rahman", "মোহাম্মদ রহমান", "Bangladesh"],
    ["Abdul Karim", "আবদুল করিম", "Bangladesh"],
    ["Fatema Begum", "ফাতেমা বেগম", "Bangladesh"],
    ["Nurul Islam", "নুরুল ইসলাম", "Bangladesh"],
    ["Shahida Khatun", "শাহিদা খাতুন", "Bangladesh"],
    ["Habibur Rahman", "হাবিবুর রহমান", "Bangladesh"],
    ["Tahmina Akter", "তাহমিনা আক্তার", "Bangladesh"],
    ["Kamal Uddin", "কামাল উদ্দিন", "Bangladesh"],
    ["Nasrin Sultana", "নাসরিন সুলতানা", "Bangladesh"],
    ["Tariq Mehmood", null, "Pakistan"],
    ["Zainab Bibi", null, "Pakistan"],
    ["Mahmoud El-Sayed", null, "Egypt"],
    ["Siti Rahayu", null, "Indonesia"],
    ["Yusuf Ali", null, "India"],
    ["Aisha Binti Osman", null, "Malaysia"],
  ];
  const PP_PREFIX: Record<string, string> = { Bangladesh: "BD", Pakistan: "PK", Egypt: "EG", Indonesia: "ID", India: "IN", Malaysia: "MY" };

  const groups: Record<string, { id: string; tenantId: string }> = {};
  let ppSerial = 8100000;
  for (const g of groupsSpec) {
    const created = await prisma.group.create({
      data: {
        code: g.code, tenantId: g.tenant.id, seasonId: season.id,
        name: g.name, nameBn: g.nameBn,
        destination: g.dest as never, visaType: "UMRAH", packageType: "STANDARD",
        maxCapacity: Math.max(g.pax, 40), paxCount: g.pax,
        departDate: g.depart, returnDate: g.ret,
        status: g.status as never, opsStatus: g.ops as never,
        currentStage: g.stage, stageNote: g.note,
      },
    });
    groups[g.code] = { id: created.id, tenantId: g.tenant.id };

    // 15 sample passengers per group (paxCount stays at the headline number)
    const paxRows = NAMES.map(([name, nameBn, nat], i) => {
      const stage = g.stage;
      return {
        code: `PAX-${String(i + 1).padStart(3, "0")}`,
        tenantId: g.tenant.id,
        groupId: created.id,
        name, nameBn, nationality: nat,
        passportNo: `${PP_PREFIX[nat]}${ppSerial++}`,
        passportExpiry: d(400 + i * 30),
        gender: (i % 3 === 2 ? "FEMALE" : "MALE") as never,
        dob: new Date(1965 + ((i * 3) % 35), (i * 5) % 12, ((i * 7) % 27) + 1),
        visaStatus: (stage >= 8 ? (i < 13 ? "APPROVED" : "PENDING") : "PENDING") as never,
        hotelStatus: (stage >= 9 ? "CONFIRMED" : "PENDING") as never,
        transportStatus: (stage >= 10 ? "CONFIRMED" : "PENDING") as never,
        mohStatus: (stage >= 8 ? "CLEARED" : "PENDING") as never,
      };
    });
    await prisma.passenger.createMany({ data: paxRows });
  }
  const g2891 = groups["GRP-1446-2891"];
  const g2744 = groups["GRP-1446-2744"];
  const g3301 = groups["GRP-1446-3301"];
  const g2401 = groups["GRP-1446-2401"];

  // T002-01 — link Rashidi demo groups to the seeded Umrah Company
  await prisma.group.updateMany({
    where: { id: { in: [g2891.id, g2401.id] } },
    data: { umrahCompanyId: umrahCo.id },
  });
  const g2990 = groups["GRP-1446-2990"];

  // ── Fleet: vehicles + drivers ──────────────────────────────────────────────
  console.log("── Fleet…");
  const busB12 = await prisma.vehicle.create({ data: { code: "BUS B-12", type: "BUS", plateNo: "SAUDI/2024-1441", seats: 45, supplierId: alnaqil.id } });
  const vanH03 = await prisma.vehicle.create({ data: { code: "VAN H-03", type: "VAN", plateNo: "SAUDI/2023-0912", seats: 12, supplierId: alnaqil.id } });
  const tah07 = await prisma.vehicle.create({ data: { code: "TAH-07", type: "COASTER", plateNo: "SAUDI/2024-0733", seats: 32 } });
  const busB07 = await prisma.vehicle.create({ data: { code: "BUS B-07", type: "BUS", plateNo: "SAUDI/2022-4410", seats: 47, status: "MAINTENANCE" } });
  const vanH07 = await prisma.vehicle.create({ data: { code: "VAN H-07", type: "HIACE", plateNo: "SAUDI/2023-2210", seats: 12 } });

  const driverUser = await mkUser("USR-020", "driver.ahmad@tubalhijaz.com", "Ahmad Hassan", "আহমাদ হাসান", "DRIVER");
  const drvAhmad = await prisma.driver.create({ data: { name: "Ahmad Hassan", nameBn: "আহমাদ হাসান", phone: "+966 54 111 0001", licenseNo: "SA-DL-88213", licenseExpiry: d(250), status: "ON_DUTY", rating: D("4.90"), userId: driverUser.id } });
  const drvNasser = await prisma.driver.create({ data: { name: "Nasser Al-Otaibi", nameBn: "নাসের আল-ওতাইবি", phone: "+966 54 111 0002", licenseNo: "SA-DL-77120", licenseExpiry: d(420), status: "EN_ROUTE", rating: D("4.70"), supplierId: alnaqil.id } });
  const drvHamad = await prisma.driver.create({ data: { name: "Hamad Al-Subai", nameBn: "হামাদ আল-সুবাই", phone: "+966 54 111 0003", licenseNo: "SA-DL-63551", licenseExpiry: d(380), status: "AVAILABLE", rating: D("4.60"), supplierId: alnaqil.id } });
  const drvBassem = await prisma.driver.create({ data: { name: "Bassem Khalil", nameBn: "বাসেম খলিল", phone: "+966 54 111 0004", licenseNo: "SA-DL-90218", licenseExpiry: d(90), status: "EN_ROUTE", rating: D("4.20") } });
  await prisma.driver.createMany({
    data: [
      { name: "Khalid Salem", nameBn: "খালিদ সালেম", phone: "+966 54 111 0005", licenseNo: "SA-DL-51002", status: "STANDBY" },
      { name: "Omar Faisal", nameBn: "ওমর ফয়সাল", phone: "+966 54 111 0006", licenseNo: "SA-DL-40911", status: "AVAILABLE" },
    ],
  });

  await prisma.fuelLog.createMany({
    data: [
      { vehicleId: busB12.id, driverId: drvNasser.id, date: d(-2, 7), liters: D("180.50"), cost: D("415.15"), odometerKm: 182300 },
      { vehicleId: tah07.id, driverId: drvAhmad.id, date: d(-1, 6), liters: D("95.00"), cost: D("218.50"), odometerKm: 96500 },
      { vehicleId: vanH03.id, date: d(-3, 8), liters: D("60.25"), cost: D("138.60"), odometerKm: 55210 },
      { vehicleId: busB07.id, date: d(-7, 9), liters: D("175.00"), cost: D("402.50"), odometerKm: 240100 },
    ],
  });
  await prisma.maintenanceRecord.createMany({
    data: [
      { vehicleId: busB07.id, type: "REPAIR", description: "Gearbox overhaul — vehicle out of service", date: d(-4), cost: D(8500), odometerKm: 240100, workshop: "Al-Naqil Workshop, Jeddah" },
      { vehicleId: busB12.id, type: "PREVENTIVE", description: "Full service: oil, filters, brake pads", date: d(-20), cost: D(1450), odometerKm: 180000, nextDueDate: d(70) },
      { vehicleId: tah07.id, type: "INSPECTION", description: "Annual MOT inspection — passed", date: d(-45), cost: D(300), nextDueDate: d(320) },
    ],
  });
  await prisma.insurancePolicy.createMany({
    data: [
      { vehicleId: busB12.id, provider: "Tawuniya", policyNo: "TAW-2026-88121", startDate: d(-180), endDate: d(185), premium: D(9200) },
      { vehicleId: tah07.id, provider: "Malath Insurance", policyNo: "MLT-2026-04412", startDate: d(-200), endDate: d(24), premium: D(6400) },
      { vehicleId: busB07.id, provider: "Tawuniya", policyNo: "TAW-2025-71034", startDate: d(-400), endDate: d(-35), premium: D(8800), status: "EXPIRED" },
    ],
  });

  // ── Vehicle documents — registration (Istimara) + inspection (Fahes), spread ──
  //    across healthy / 30-day / 7-day / lapsed so the expiry watchdog has signal.
  await prisma.vehicleDocument.createMany({
    data: [
      { vehicleId: busB12.id, type: "REGISTRATION", docNo: "ISM-B12-2026", issueDate: d(-330), expiryDate: d(120) },
      { vehicleId: busB12.id, type: "INSPECTION", docNo: "FHS-B12-771", issueDate: d(-345), expiryDate: d(20) }, // WARNING (≤30)
      { vehicleId: vanH03.id, type: "REGISTRATION", docNo: "ISM-H03-2025", issueDate: d(-360), expiryDate: d(5) }, // CRITICAL (≤7)
      { vehicleId: vanH03.id, type: "OPERATING_CARD", docNo: "OPC-H03-4410", issueDate: d(-120), expiryDate: d(200) },
      { vehicleId: tah07.id, type: "REGISTRATION", docNo: "ISM-T07-2026", issueDate: d(-60), expiryDate: d(300) },
      { vehicleId: tah07.id, type: "INSPECTION", docNo: "FHS-T07-233", issueDate: d(-375), expiryDate: d(-10) }, // EXPIRED
      { vehicleId: busB07.id, type: "REGISTRATION", docNo: "ISM-B07-2025", issueDate: d(-300), expiryDate: d(60) },
      { vehicleId: vanH07.id, type: "REGISTRATION", docNo: "ISM-H07-2026", issueDate: d(-200), expiryDate: d(45) },
      { vehicleId: vanH07.id, type: "INSPECTION", docNo: "FHS-H07-902", issueDate: d(-359), expiryDate: d(6) }, // CRITICAL (≤7)
    ],
  });

  // ── GPS — latest known position (MVP: manual fixes). Map reads Vehicle.last*. ──
  const fixes: Array<[string, number, number, string]> = [
    [busB12.id, 21.4225, 39.8262, "Makkah — Haram approach"],
    [vanH03.id, 21.6796, 39.1565, "Jeddah — King Abdulaziz Intl (JED)"],
    [tah07.id, 21.5500, 39.4500, "Jeddah–Makkah Highway (Rd 40)"],
    [vanH07.id, 24.4672, 39.6111, "Madinah — Al-Masjid an-Nabawi"],
  ];
  for (const [vehicleId, lat, lng, label] of fixes) {
    await prisma.vehicleLocation.create({ data: { vehicleId, lat: D(lat), lng: D(lng), label, speedKmh: 0, source: "MANUAL", recordedAt: d(0, 8) } });
    await prisma.vehicle.update({ where: { id: vehicleId }, data: { lastLat: D(lat), lastLng: D(lng), lastLocationLabel: label, lastLocationAt: d(0, 8) } });
  }

  // ── Back-dated fuel + maintenance so the 6-month cost-trend chart isn't flat ──
  await prisma.fuelLog.createMany({
    data: [
      { vehicleId: busB12.id, date: d(-38, 7), liters: D("172.00"), cost: D("395.60"), odometerKm: 178200 },
      { vehicleId: tah07.id, date: d(-66, 8), liters: D("101.50"), cost: D("233.45"), odometerKm: 91100 },
      { vehicleId: vanH03.id, date: d(-95, 8), liters: D("58.00"), cost: D("133.40"), odometerKm: 50120 },
      { vehicleId: busB12.id, date: d(-124, 7), liters: D("168.00"), cost: D("386.40"), odometerKm: 171000 },
      { vehicleId: tah07.id, date: d(-152, 8), liters: D("99.00"), cost: D("227.70"), odometerKm: 84300 },
    ],
  });
  await prisma.maintenanceRecord.createMany({
    data: [
      { vehicleId: vanH03.id, type: "PREVENTIVE", description: "Oil + filter change", date: d(-52), cost: D(620), odometerKm: 52000, nextDueDate: d(130) },
      { vehicleId: busB12.id, type: "REPAIR", description: "A/C compressor replacement", date: d(-88), cost: D(2350), odometerKm: 173500 },
      { vehicleId: vanH07.id, type: "PREVENTIVE", description: "Brake service + tyre rotation", date: d(-140), cost: D(890), odometerKm: 61000 },
    ],
  });

  // ── Flights + boards ───────────────────────────────────────────────────────
  console.log("── Flights + dispatch…");
  const arr1 = await prisma.flightInfo.create({
    data: { code: "ARR-001", tenantId: rashidi.id, groupId: g2891.id, direction: "ARRIVAL", airline: "Saudia", flightNo: "SV 101", originAirport: "DAC", destAirport: "JED", scheduledAt: d(0, 8, 30), terminal: "T1", paxCount: 47, status: "AT_GATE" },
  });
  const arr2 = await prisma.flightInfo.create({
    data: { code: "ARR-002", tenantId: alnoor.id, groupId: g2744.id, direction: "ARRIVAL", airline: "Biman Bangladesh", flightNo: "BG 088", originAirport: "DAC", destAirport: "JED", scheduledAt: d(0, 11, 45), terminal: "T2", paxCount: 32, status: "EN_ROUTE" },
  });
  await prisma.flightInfo.createMany({
    data: [
      { code: "ARR-003", tenantId: crown.id, groupId: g3301.id, direction: "ARRIVAL", airline: "PIA", flightNo: "PK 901", originAirport: "KHI", destAirport: "JED", scheduledAt: d(0, 15, 20), terminal: "T1", paxCount: 67, status: "SCHEDULED" },
      { code: "ARR-004", tenantId: zamzam.id, groupId: g2990.id, direction: "ARRIVAL", airline: "EgyptAir", flightNo: "MS 961", originAirport: "CAI", destAirport: "JED", scheduledAt: d(1, 6, 10), terminal: "T2", paxCount: 52, status: "DELAYED" },
      { code: "DEP-001", tenantId: rashidi.id, groupId: g2891.id, direction: "DEPARTURE", airline: "Saudia", flightNo: "SV 645", originAirport: "JED", destAirport: "DAC", scheduledAt: d(4, 16, 30), terminal: "T1", gate: "G12", paxCount: 47, status: "SCHEDULED" },
      { code: "DEP-002", tenantId: alnoor.id, groupId: g2744.id, direction: "DEPARTURE", airline: "Biman Bangladesh", flightNo: "BG 089", originAirport: "JED", destAirport: "DAC", scheduledAt: d(26, 22, 0), terminal: "T2", gate: "H04", paxCount: 32, status: "SCHEDULED" },
      { code: "DEP-003", tenantId: zamzam.id, groupId: g2990.id, direction: "DEPARTURE", airline: "Saudia", flightNo: "SV 802", originAirport: "JED", destAirport: "DAC", scheduledAt: d(0, 18, 45), terminal: "T1", gate: "K08", paxCount: 52, status: "CHECK_IN" },
    ],
  });

  // Meet & Assist — 7 steps for ARR-001 (4 done)
  await prisma.meetAssistTask.createMany({
    data: Array.from({ length: 7 }, (_, i) => ({
      flightInfoId: arr1.id, stepNo: i + 1, done: i < 4, completedAt: i < 4 ? d(0, 9, 10 + i * 12) : null,
    })),
  });

  // tickets
  await prisma.ticket.createMany({
    data: [
      { groupId: g2891.id, flightInfoId: arr1.id, fileName: "SaudiAirlines_SV101_GRP2891.pdf", fileUrl: "/uploads/tickets/SV101_GRP2891.pdf", status: "CONFIRMED" },
      { groupId: g2744.id, flightInfoId: arr2.id, fileName: "Biman_BG088_GRP2744.pdf", fileUrl: "/uploads/tickets/BG088_GRP2744.pdf", status: "PENDING" },
    ],
  });

  await prisma.dispatchOrder.createMany({
    data: [
      { code: "DSP-0441", tenantId: rashidi.id, groupId: g2891.id, flightInfoId: arr1.id, vehicleId: busB12.id, driverId: drvNasser.id, routeFrom: "King Abdulaziz Int'l T1", routeTo: "Jabal Omar Hyatt, Makkah", pax: 47, scheduledAt: d(0, 10, 0), status: "EN_ROUTE", progressPct: 60 },
      { code: "DSP-0442", tenantId: alnoor.id, groupId: g2744.id, flightInfoId: arr2.id, vehicleId: vanH03.id, driverId: drvHamad.id, routeFrom: "King Abdulaziz Int'l T2", routeTo: "Makkah Towers", pax: 32, scheduledAt: d(0, 12, 30), status: "ASSIGNED" },
      { code: "DSP-0443", tenantId: rashidi.id, groupId: g2401.id, vehicleId: tah07.id, driverId: drvAhmad.id, routeFrom: "Jeddah North Terminal", routeTo: "InterContinental Madinah", pax: 28, scheduledAt: d(0, 14, 0), status: "ASSIGNED" },
      { code: "DSP-0444", tenantId: zamzam.id, groupId: g2990.id, vehicleId: vanH07.id, driverId: drvBassem.id, routeFrom: "Makkah Hotels", routeTo: "Ziyarah — Sites of Makkah", pax: 12, scheduledAt: d(0, 7, 0), status: "DELAYED", note: "Heavy traffic on Ring Road — ETA +45 min", progressPct: 35 },
      { code: "DSP-0439", tenantId: rashidi.id, groupId: g2891.id, vehicleId: busB12.id, driverId: drvNasser.id, routeFrom: "Jabal Omar Hyatt", routeTo: "Masjid al-Haram Gate 79", pax: 47, scheduledAt: d(-1, 8, 0), status: "COMPLETED", progressPct: 100 },
      { code: "DSP-0440", tenantId: alnoor.id, groupId: g2744.id, vehicleId: vanH03.id, driverId: drvHamad.id, routeFrom: "Makkah Towers", routeTo: "Jeddah Corniche", pax: 10, scheduledAt: d(-1, 15, 0), status: "COMPLETED", progressPct: 100 },
    ],
  });

  // ── Service bookings ───────────────────────────────────────────────────────
  console.log("── Service bookings…");
  await prisma.visaRequest.createMany({
    data: [
      { code: "REQ-V-0089", tenantId: rashidi.id, groupId: g2891.id, seasonId: season.id, visaType: "UMRAH", applicationYearHijri: "1446", nusukRef: "NK-14462891-AG", muallimNo: "MU-0044-1446", mohCategory: "A", embassy: "Saudi Embassy Dhaka", umrahCompanyId: umrahCo.id, priority: "NORMAL", status: "COMPLETED", submittedAt: d(-40) },
      { code: "REQ-V-0094", tenantId: crown.id, groupId: g3301.id, seasonId: season.id, visaType: "UMRAH", applicationYearHijri: "1446", nusukRef: "NK-14463301-AG", muallimNo: "MU-0051-1446", mohCategory: "B", embassy: "Saudi Embassy Islamabad", umrahCompanyId: umrahCo.id, priority: "HIGH", status: "ASSIGNED", submittedAt: d(-6), notes: "52 approved, 15 pending MOFA queue" },
      { code: "REQ-V-0096", tenantId: zamzam.id, groupId: g2990.id, seasonId: season.id, visaType: "UMRAH", applicationYearHijri: "1446", mohCategory: "B", umrahCompanyId: umrahCo.id, priority: "URGENT", status: "REQUESTED" },
    ],
  });

  const hb2891 = await prisma.hotelBooking.create({
    data: {
      code: "HTL-0067", tenantId: rashidi.id, groupId: g2891.id, hotelId: hotelJabal.id, supplierId: jabalOmar.id,
      checkIn: d(-10), checkOut: d(4), nights: 14, doubleRooms: 14, tripleRooms: 5, mealPlan: "FULL_BOARD",
      ratePerRoom: D(850), subtotal: D(226100), vatAmount: D(33915), totalAmount: D(260015),
      specialRequests: "Ground floor rooms preferred for elderly guests. Early check-in requested (before 12:00).",
      status: "VOUCHER_ISSUED",
    },
  });
  await prisma.hotelBooking.createMany({
    data: [
      { code: "HTL-0071", tenantId: rashidi.id, groupId: g2401.id, supplierId: jabalOmar.id, checkIn: d(15), checkOut: d(29), nights: 14, doubleRooms: 10, tripleRooms: 3, mealPlan: "HALF_BOARD", status: "ASSIGNED", priority: "NORMAL" },
      { code: "HTL-0074", tenantId: alnoor.id, groupId: g2744.id, checkIn: d(12), checkOut: d(26), nights: 14, doubleRooms: 12, tripleRooms: 4, mealPlan: "FULL_BOARD", status: "REQUESTED", priority: "HIGH" },
    ],
  });

  await prisma.transportBooking.createMany({
    data: [
      { code: "TRN-0121", tenantId: rashidi.id, groupId: g2891.id, supplierId: alnaqil.id, vehicleType: "BUS", vehicleCount: 2, departurePoint: "Jeddah North Terminal", destination: "Makkah → Madinah", stopPoints: "Hotel → Haram → Mina", departAt: d(-10, 10), returnAt: d(4, 14), totalAmount: D(30400), status: "CONFIRMED" },
      { code: "TRN-0128", tenantId: alnoor.id, groupId: g2744.id, vehicleType: "COASTER", vehicleCount: 1, departurePoint: "KAIA T2", destination: "Makkah Towers", departAt: d(12, 13), totalAmount: D(6800), status: "REQUESTED" },
    ],
  });

  await prisma.cateringBooking.createMany({
    data: [
      { code: "CAT-0055", tenantId: rashidi.id, groupId: g2891.id, supplierId: albarakah.id, mealPlan: "FULL_BOARD", pricePerPaxDay: D(140), halalCount: 44, vegetarianCount: 2, diabeticCount: 1, startDate: d(-10), endDate: d(4), totalAmount: D(92120), status: "CONFIRMED" },
      { code: "CAT-0058", tenantId: zamzam.id, groupId: g2990.id, mealPlan: "HALF_BOARD", pricePerPaxDay: D(85), halalCount: 52, startDate: d(8), endDate: d(22), status: "REQUESTED" },
    ],
  });

  await prisma.additionalServiceRequest.createMany({
    data: [
      { code: "SVC-0044", tenantId: rashidi.id, groupId: g2891.id, serviceType: "WHEELCHAIR", beneficiaries: 3, priority: "HIGH", description: "3 elderly pilgrims need wheelchair assistance at Haram entrances", requestedFor: d(1, 8), status: "CONFIRMED" },
      { code: "SVC-0049", tenantId: alnoor.id, groupId: g2744.id, serviceType: "SIM_CARD", beneficiaries: 32, priority: "NORMAL", description: "Local SIM package for all pax on arrival", requestedFor: d(12, 10), status: "REQUESTED" },
    ],
  });

  const brn1 = await prisma.bRN.create({
    data: { code: "BRN-1446-0091", tenantId: rashidi.id, groupId: g2891.id, hotelBookingId: hb2891.id, serviceScope: "Hotel + Transport + Meet&Assist", detail: "Hotel: Jabal Omar 14N, Bus ×2, M&A JED", dateRequired: d(-10), priority: "NORMAL", status: "FULFILLED" },
  });
  await prisma.bRN.create({
    data: { code: "BRN-1446-0104", tenantId: alnoor.id, groupId: g2744.id, serviceScope: "Hotel + Transport", detail: "Makkah Towers 14N + 1 coaster JED→MKK", dateRequired: d(12), priority: "HIGH", status: "PROCESSING" },
  });

  await prisma.voucher.createMany({
    data: [
      { code: "VCH-1446-2891-HOT", type: "HOTEL", tenantId: rashidi.id, groupId: g2891.id, refType: "HotelBooking", refId: hb2891.id, issueDate: d(-12), validUntil: d(4), status: "SENT", sentWhatsappAt: d(-12, 14), sentEmailAt: d(-12, 14), payload: { hotel: "Jabal Omar Hyatt Regency Makkah", rooms: "14 Double + 5 Triple", mealPlan: "Full Board", pax: 47 } },
      { code: "VCH-1446-2891-TRA", type: "TRANSPORT", tenantId: rashidi.id, groupId: g2891.id, refType: "TransportBooking", refId: "TRN-0121", issueDate: d(-12), validUntil: d(4), status: "ISSUED", payload: { carrier: "Al-Naqil Transport Co.", vehicles: "2× 45-seat coach", route: "Jeddah → Makkah → Madinah" } },
      { code: "VCH-1446-2891-ZIY", type: "ZIYARAH", tenantId: rashidi.id, groupId: g2891.id, issueDate: d(-2), validUntil: d(2), status: "DRAFT", payload: { sites: "Masjid al-Haram, Jabal al-Nour, Mina" } },
    ],
  });

  await prisma.ziyarahTrip.createMany({
    data: [
      { code: "ZYR-0041", tenantId: rashidi.id, groupId: g2891.id, date: d(1, 7), sites: "Masjid al-Haram, Zamzam, Safa & Marwa", sitesBn: "মসজিদুল হারাম, যমযম, সাফা ও মারওয়া", guideName: "Sheikh Mahmoud Al-Aqeel", vehicleId: vanH03.id, pax: 12, status: "CONFIRMED" },
      { code: "ZYR-0044", tenantId: rashidi.id, groupId: g2891.id, date: d(2, 7), sites: "Jabal al-Nour, Hira Cave, Jabal Thawr", sitesBn: "জাবালে নূর, হেরা গুহা, জাবালে সাওর", guideName: "Sheikh Mahmoud Al-Aqeel", vehicleId: tah07.id, pax: 28, status: "SCHEDULED" },
    ],
  });

  await prisma.longStay.createMany({
    data: [
      { code: "LST-0041", tenantId: rashidi.id, groupId: g2891.id, hotelName: "Jabal Omar Hyatt Regency", city: "Makkah", nights: 14, checkIn: d(-10), checkOut: d(4), pax: 47, renewal: "NONE", status: "ACTIVE" },
      { code: "LST-0044", tenantId: rashidi.id, groupId: g2401.id, hotelName: "InterContinental Madinah", city: "Madinah", nights: 14, checkIn: d(15), checkOut: d(29), pax: 28, renewal: "NONE", status: "UPCOMING" },
      { code: "LST-0047", tenantId: alnoor.id, groupId: g2744.id, hotelName: "Makkah Towers", city: "Makkah", nights: 21, checkIn: d(-3), checkOut: d(18), pax: 32, renewal: "REQUESTED", status: "RENEWAL" },
    ],
  });

  // ── Finance ────────────────────────────────────────────────────────────────
  console.log("── Finance…");
  await prisma.chartAccount.createMany({
    data: [
      // Assets (debit-normal)
      { code: "1001", name: "Cash — Al Rajhi Bank", nameBn: "নগদ — আল রাজি ব্যাংক", kind: "ASSET" },
      { code: "1002", name: "Cash — Alinma Bank", nameBn: "নগদ — আলিনমা ব্যাংক", kind: "ASSET" },
      { code: "1003", name: "Cash — SNB Operations", nameBn: "নগদ — এসএনবি", kind: "ASSET" },
      { code: "1200", name: "Accounts Receivable — Agents", nameBn: "প্রাপ্য — এজেন্ট", kind: "ASSET" },
      { code: "1400", name: "Prepaid Expenses", nameBn: "অগ্রিম ব্যয়", kind: "ASSET" },
      { code: "1500", name: "Equipment & Fixtures", nameBn: "সরঞ্জাম", kind: "ASSET" },
      { code: "1510", name: "Vehicles & Fleet", nameBn: "যানবাহন ও ফ্লিট", kind: "ASSET" },
      // Liabilities (credit-normal)
      { code: "2101", name: "Accounts Payable — Suppliers", nameBn: "প্রদেয় — সরবরাহকারী", kind: "LIABILITY" },
      { code: "2201", name: "VAT Payable", nameBn: "প্রদেয় ভ্যাট", kind: "LIABILITY" },
      { code: "2300", name: "Agent Advance Payments", nameBn: "এজেন্ট অগ্রিম", kind: "LIABILITY" },
      { code: "2400", name: "Bank Loan — Al Rajhi", nameBn: "ব্যাংক ঋণ", kind: "LIABILITY" },
      // Equity (credit-normal)
      { code: "3000", name: "Share Capital", nameBn: "শেয়ার মূলধন", kind: "EQUITY" },
      { code: "3100", name: "Retained Earnings", nameBn: "সংরক্ষিত আয়", kind: "EQUITY" },
      // Revenue (credit-normal)
      { code: "4001", name: "Revenue — Visa Services", nameBn: "আয় — ভিসা", kind: "REVENUE" },
      { code: "4002", name: "Revenue — Hotel Services", nameBn: "আয় — হোটেল", kind: "REVENUE" },
      { code: "4003", name: "Revenue — Transport Services", nameBn: "আয় — পরিবহন", kind: "REVENUE" },
      { code: "4004", name: "Revenue — Catering Services", nameBn: "আয় — ক্যাটারিং", kind: "REVENUE" },
      { code: "4005", name: "Revenue — Other Services", nameBn: "আয় — অন্যান্য", kind: "REVENUE" },
      // Cost of services (debit-normal, COGS)
      { code: "5001", name: "Hotel Costs", nameBn: "হোটেল ব্যয়", kind: "EXPENSE", plSection: "COGS" },
      { code: "5002", name: "Transport Costs", nameBn: "পরিবহন ব্যয়", kind: "EXPENSE", plSection: "COGS" },
      { code: "5003", name: "Catering Costs", nameBn: "ক্যাটারিং ব্যয়", kind: "EXPENSE", plSection: "COGS" },
      { code: "5004", name: "Visa Processing Fees", nameBn: "ভিসা প্রক্রিয়াকরণ ফি", kind: "EXPENSE", plSection: "COGS" },
      // Operating expenses (debit-normal, OpEx)
      { code: "6001", name: "Staff Salaries", nameBn: "কর্মচারী বেতন", kind: "EXPENSE", plSection: "OPEX" },
      { code: "6002", name: "Office Rent", nameBn: "অফিস ভাড়া", kind: "EXPENSE", plSection: "OPEX" },
      { code: "6003", name: "Marketing", nameBn: "বিপণন", kind: "EXPENSE", plSection: "OPEX" },
      { code: "6004", name: "IT & Systems", nameBn: "আইটি ও সিস্টেম", kind: "EXPENSE", plSection: "OPEX" },
      { code: "6005", name: "Other Admin", nameBn: "অন্যান্য প্রশাসন", kind: "EXPENSE", plSection: "OPEX" },
    ],
  });
  const acct = async (code: string) => (await prisma.chartAccount.findUniqueOrThrow({ where: { code } })).id;

  // Invoices
  const inv0087 = await prisma.invoice.create({
    data: {
      code: "INV-1446-0087", tenantId: rashidi.id, groupId: g2891.id, seasonId: season.id,
      issueDate: d(-35), dueDate: d(-5), subtotal: D(92000), vatAmount: D(13800), total: D(105800), status: "PAID",
      items: { create: [{ description: "Catering — Full Board 47 pax × 14 days", descriptionBn: "ক্যাটারিং — ফুল বোর্ড ৪৭ যাত্রী × ১৪ দিন", qty: 1, unitPrice: D(92000), total: D(92000) }] },
    },
  });
  const inv0091 = await prisma.invoice.create({
    data: {
      code: "INV-1446-0091", tenantId: rashidi.id, groupId: g2891.id, seasonId: season.id,
      issueDate: d(-14), dueDate: d(16), subtotal: D(281500), vatAmount: D(42225), total: D(323725), status: "OUTSTANDING",
      items: {
        create: [
          { description: "Hotel — Jabal Omar Hyatt (14 nights, 19 rooms)", descriptionBn: "হোটেল — জাবাল ওমর হায়াত (১৪ রাত, ১৯ রুম)", qty: 19, unitPrice: D(11900), total: D(226100) },
          { description: "Transport — 2× 45-seat coach, JED→MKK→MED", descriptionBn: "পরিবহন — ২টি ৪৫-সিট কোচ", qty: 2, unitPrice: D(15200), total: D(30400) },
          { description: "Catering deposit — August batch", descriptionBn: "ক্যাটারিং জামানত — আগস্ট ব্যাচ", qty: 1, unitPrice: D(25000), total: D(25000) },
        ],
      },
    },
  });

  const rec0241 = await prisma.receipt.create({
    data: {
      code: "REC-1446-0241", companyId: rashidi.id, date: d(-8), amount: D(180000), method: "SARIE", bankRef: `SARIE-${now.getFullYear()}0712-4491`,
      allocations: {
        create: [
          { invoiceId: inv0087.id, amount: D(105800) },
          { invoiceId: inv0091.id, amount: D(74200) },
        ],
      },
    },
  });

  // Wallet transactions (Rashidi → balance 24,850)
  const rashidiWallet = await prisma.wallet.findUniqueOrThrow({ where: { companyId: rashidi.id } });
  const txns: Array<[string, "CREDIT" | "DEBIT", number, string, string?]> = [
    ["Initial wallet deposit", "CREDIT", 50000, "INIT-0101"],
    ["Wallet top-up — Al Rajhi transfer", "CREDIT", 80000, "TOP-0701"],
    ["Hotel deposit — GRP-1446-2891", "DEBIT", 62000, "HTL-0067"],
    ["Visa processing fees — GRP-1446-2891", "DEBIT", 8150, "VIS-2891"],
    ["Catering deposit — GRP-1446-2891", "DEBIT", 35000, "CAT-0055"],
  ];
  let bal = 0;
  for (const [descr, dir, amt, ref] of txns) {
    bal += dir === "CREDIT" ? amt : -amt;
    await prisma.walletTransaction.create({
      data: { walletId: rashidiWallet.id, direction: dir, amount: D(amt), balanceAfter: D(bal), description: descr, refType: "seed", refId: ref },
    });
  }

  await prisma.paymentSlip.createMany({
    data: [
      { code: "SLP-0071", companyId: rashidi.id, purpose: "WALLET_TOPUP", type: "BANK_TRANSFER", amount: D(80000), bank: "Al Rajhi Bank", transferRef: "TXN-8842190011", paymentDate: d(-25), status: "CONFIRMED", reviewedById: finOfficer.id, reviewedAt: d(-24) },
      { code: "SLP-0078", companyId: alnoor.id, purpose: "WALLET_TOPUP", type: "SADAD", amount: D(45000), bank: "Alinma Bank", transferRef: "SADAD-77120043", paymentDate: d(-1), status: "PENDING", notes: "Top-up for Ramadan group services" },
    ],
  });

  // Extra OUTSTANDING invoices across agents & ages → real AR aging buckets
  const arSpec: Array<[string, { id: string }, number, number, string]> = [
    ["INV-1446-0102", alnoor, -20, 200000, "Hotel Services — GRP-1446-2744"],
    ["INV-1446-0080", alnoor, -50, 140000, "Visa Services — GRP-1446-2744"],
    ["INV-1446-0095", zamzam, -40, 180000, "Full Package — GRP-1446-2990"],
    ["INV-1446-0070", zamzam, -80, 100000, "Transport — GRP-1446-2990"],
    ["INV-1446-0060", crown, -95, 80000, "Visa Services — GRP-1446-3301"],
    ["INV-1446-0050", makkahTours, -120, 60000, "Hotel Services — season deposit"],
    ["INV-1446-0055", rashidi, -100, 120000, "Catering — GRP-1446-2401"],
  ];
  for (const [code, company, ageDays, sub, desc] of arSpec) {
    await prisma.invoice.create({
      data: {
        code, tenantId: company.id, seasonId: season.id,
        issueDate: d(ageDays), dueDate: d(ageDays + 30),
        subtotal: D(sub), vatAmount: D(sub * 0.15), total: D(sub * 1.15),
        status: ageDays < -30 ? "OVERDUE" : "OUTSTANDING",
        items: { create: [{ description: desc, qty: 1, unitPrice: D(sub), total: D(sub) }] },
      },
    });
  }

  // ── Sub-ledgers ──────────────────────────────────────────────────────────────
  await prisma.ledgerEntry.createMany({
    data: [
      // AGENT ledger — Rashidi (top-ups credit, service deductions debit)
      { ledgerType: "AGENT", companyId: rashidi.id, date: d(-330), description: "Opening balance", ref: "OB-2025", debit: D(0), credit: D(180000), createdById: finOfficer.id },
      { ledgerType: "AGENT", companyId: rashidi.id, date: d(-60), description: "Wallet top-up — Al Rajhi", ref: "PAY-0189", debit: D(0), credit: D(250000) },
      { ledgerType: "AGENT", companyId: rashidi.id, date: d(-35), description: "GRP-1446-2891 catering deduction", ref: "SVC-2203", debit: D(78400), credit: D(0), groupId: g2891.id },
      { ledgerType: "AGENT", companyId: rashidi.id, date: d(-14), description: "GRP-1446-2401 visa & transport", ref: "SVC-2401", debit: D(128000), credit: D(0), groupId: g2401.id },
      { ledgerType: "AGENT", companyId: rashidi.id, date: d(-8), description: "Payment received — SARIE", ref: "REC-1446-0241", debit: D(0), credit: D(180000) },
      // SUPPLIER ledgers (credits = payable created, debits = payments) → AP aging
      { ledgerType: "SUPPLIER", companyId: jabalOmar.id, date: d(-95), description: "Hotel contract — Season 1446H", ref: "CTR-0001", debit: D(0), credit: D(300000) },
      { ledgerType: "SUPPLIER", companyId: jabalOmar.id, date: d(-40), description: "GRP-1446-2891 settlement due", ref: "STL-HTL-0063", debit: D(0), credit: D(226100) },
      { ledgerType: "SUPPLIER", companyId: jabalOmar.id, date: d(-20), description: "Advance disbursement", ref: "ADV-HTL-002", debit: D(200000), credit: D(0) },
      { ledgerType: "SUPPLIER", companyId: alnaqil.id, date: d(-70), description: "Transport payable — GRP-1446-2891", ref: "STL-TRN-0021", debit: D(0), credit: D(120000) },
      { ledgerType: "SUPPLIER", companyId: alnaqil.id, date: d(-12), description: "Transport payable — GRP-1446-2744", ref: "STL-TRN-0028", debit: D(0), credit: D(68000) },
      { ledgerType: "SUPPLIER", companyId: albarakah.id, date: d(-48), description: "Catering payable — GRP-1446-2891", ref: "STL-CAT-0055", debit: D(0), credit: D(92120) },
      { ledgerType: "SUPPLIER", companyId: albarakah.id, date: d(-10), description: "Partial payment", ref: "PAY-CAT-01", debit: D(50000), credit: D(0) },
    ],
  });

  // ── General ledger: balanced double-entry season journals (P&L + Balance Sheet) ─
  const A: Record<string, string> = {};
  for (const c of ["1001", "1002", "1003", "1200", "1400", "1500", "1510", "2101", "2201", "2300", "2400", "3000", "3100", "4001", "4002", "4003", "4004", "4005", "5001", "5002", "5003", "5004", "6001", "6002", "6003", "6004", "6005"]) {
    A[c] = await acct(c);
  }
  type GLine = { code: string; dr?: number; cr?: number; date: Date; ref: string; desc: string };
  const gl: GLine[] = [
    // Opening balances
    { code: "1001", dr: 1850000, date: d(-120), ref: "OB-2025", desc: "Opening — Cash Al Rajhi" },
    { code: "1002", dr: 980000, date: d(-120), ref: "OB-2025", desc: "Opening — Cash Alinma" },
    { code: "1003", dr: 370000, date: d(-120), ref: "OB-2025", desc: "Opening — Cash SNB" },
    { code: "1500", dr: 180000, date: d(-120), ref: "OB-2025", desc: "Opening — Equipment" },
    { code: "1510", dr: 420000, date: d(-120), ref: "OB-2025", desc: "Opening — Vehicles" },
    { code: "3000", cr: 1000000, date: d(-120), ref: "OB-2025", desc: "Opening — Share Capital" },
    { code: "3100", cr: 2300000, date: d(-120), ref: "OB-2025", desc: "Opening — Retained Earnings" },
    { code: "2400", cr: 500000, date: d(-120), ref: "OB-2025", desc: "Opening — Bank Loan" },
    // Revenue recognition (AR + Revenue + output VAT)
    { code: "1200", dr: 2300000, date: d(-90), ref: "REV-VISA", desc: "AR — visa revenue" },
    { code: "4001", cr: 2000000, date: d(-90), ref: "REV-VISA", desc: "Revenue — Visa" },
    { code: "2201", cr: 300000, date: d(-90), ref: "REV-VISA", desc: "Output VAT 15%" },
    { code: "1200", dr: 3691500, date: d(-85), ref: "REV-HOTEL", desc: "AR — hotel revenue" },
    { code: "4002", cr: 3210000, date: d(-85), ref: "REV-HOTEL", desc: "Revenue — Hotel" },
    { code: "2201", cr: 481500, date: d(-85), ref: "REV-HOTEL", desc: "Output VAT 15%" },
    { code: "1200", dr: 1633000, date: d(-80), ref: "REV-TRANS", desc: "AR — transport revenue" },
    { code: "4003", cr: 1420000, date: d(-80), ref: "REV-TRANS", desc: "Revenue — Transport" },
    { code: "2201", cr: 213000, date: d(-80), ref: "REV-TRANS", desc: "Output VAT 15%" },
    { code: "1200", dr: 782000, date: d(-75), ref: "REV-CAT", desc: "AR — catering revenue" },
    { code: "4004", cr: 680000, date: d(-75), ref: "REV-CAT", desc: "Revenue — Catering" },
    { code: "2201", cr: 102000, date: d(-75), ref: "REV-CAT", desc: "Output VAT 15%" },
    { code: "1200", dr: 345000, date: d(-70), ref: "REV-OTHER", desc: "AR — other revenue" },
    { code: "4005", cr: 300000, date: d(-70), ref: "REV-OTHER", desc: "Revenue — Other" },
    { code: "2201", cr: 45000, date: d(-70), ref: "REV-OTHER", desc: "Output VAT 15%" },
    // Cash receipts from agents
    { code: "1001", dr: 6600000, date: d(-60), ref: "AR-COLLECT", desc: "Agent payments received" },
    { code: "1200", cr: 6600000, date: d(-60), ref: "AR-COLLECT", desc: "AR collected" },
    // Cost of services (COGS + AP)
    { code: "5001", dr: 2650000, date: d(-58), ref: "COGS-HTL", desc: "Hotel costs" },
    { code: "2101", cr: 2650000, date: d(-58), ref: "COGS-HTL", desc: "AP — hotels" },
    { code: "5002", dr: 890000, date: d(-56), ref: "COGS-TRN", desc: "Transport costs" },
    { code: "2101", cr: 890000, date: d(-56), ref: "COGS-TRN", desc: "AP — transport" },
    { code: "5003", dr: 420000, date: d(-54), ref: "COGS-CAT", desc: "Catering costs" },
    { code: "2101", cr: 420000, date: d(-54), ref: "COGS-CAT", desc: "AP — catering" },
    { code: "5004", dr: 180000, date: d(-52), ref: "COGS-VISA", desc: "Visa processing fees" },
    { code: "2101", cr: 180000, date: d(-52), ref: "COGS-VISA", desc: "AP — visa authority" },
    // Supplier payments
    { code: "2101", dr: 3250000, date: d(-40), ref: "AP-PAY", desc: "Supplier settlements" },
    { code: "1001", cr: 3250000, date: d(-40), ref: "AP-PAY", desc: "Cash outflow" },
    // Operating expenses (cash)
    { code: "6001", dr: 960000, date: d(-30), ref: "OPEX-SAL", desc: "Staff salaries" },
    { code: "1001", cr: 960000, date: d(-30), ref: "OPEX-SAL", desc: "Payroll disbursement" },
    { code: "6002", dr: 240000, date: d(-30), ref: "OPEX-RENT", desc: "Office rent" },
    { code: "1001", cr: 240000, date: d(-30), ref: "OPEX-RENT", desc: "Rent disbursement" },
    { code: "6003", dr: 180000, date: d(-28), ref: "OPEX-MKT", desc: "Marketing" },
    { code: "1001", cr: 180000, date: d(-28), ref: "OPEX-MKT", desc: "Marketing spend" },
    { code: "6004", dr: 120000, date: d(-26), ref: "OPEX-IT", desc: "IT & systems" },
    { code: "1001", cr: 120000, date: d(-26), ref: "OPEX-IT", desc: "IT spend" },
    { code: "6005", dr: 180000, date: d(-24), ref: "OPEX-ADM", desc: "Other admin" },
    { code: "1001", cr: 180000, date: d(-24), ref: "OPEX-ADM", desc: "Admin spend" },
    // VAT settlement to authority
    { code: "2201", dr: 1014750, date: d(-15), ref: "VAT-ZATCA", desc: "VAT remitted to ZATCA" },
    { code: "1001", cr: 1014750, date: d(-15), ref: "VAT-ZATCA", desc: "VAT payment" },
    // Prepaid expenses
    { code: "1400", dr: 120000, date: d(-12), ref: "PREPAID", desc: "Prepaid expenses" },
    { code: "1001", cr: 120000, date: d(-12), ref: "PREPAID", desc: "Prepayment" },
  ];
  await prisma.ledgerEntry.createMany({
    data: gl.map((l) => ({
      ledgerType: "GENERAL" as const,
      accountId: A[l.code],
      date: l.date,
      description: l.desc,
      ref: l.ref,
      debit: D(l.dr ?? 0),
      credit: D(l.cr ?? 0),
    })),
  });

  // ── Income / Expense entries (FinanceERP Income & Expenses screens) ──────────
  await prisma.financeEntry.createMany({
    data: [
      { code: "INC-0091", kind: "INCOME", date: d(-1), ref: "INV-1446-0091", partyName: "Rashidi Travel Co.", category: "Visa Services", amount: D(94000), groupId: g2891.id, status: "RECEIVED" },
      { code: "INC-0088", kind: "INCOME", date: d(-7), ref: "INV-1446-0088", partyName: "Al-Noor Pilgrim Svc", category: "Hotel Services", amount: D(112000), groupId: g2744.id, status: "RECEIVED" },
      { code: "INC-0082", kind: "INCOME", date: d(-9), ref: "INV-1446-0082", partyName: "Makkah Tours Co.", category: "Full Package", amount: D(187000), status: "PENDING" },
      { code: "INC-0079", kind: "INCOME", date: d(-10), ref: "INV-1446-0079", partyName: "Crown Hajj Tours", category: "Visa Services", amount: D(76000), groupId: g3301.id, status: "OVERDUE" },
      { code: "INC-0071", kind: "INCOME", date: d(-14), ref: "INV-1446-0071", partyName: "Rashidi Travel Co.", category: "Hotel Services", amount: D(168000), groupId: g2401.id, status: "RECEIVED" },
      { code: "EXP-0091", kind: "EXPENSE", date: d(-2), ref: "PO-1446-0091", partyName: "Jabal Omar Hyatt", category: "Hotel Costs", amount: D(124000), groupId: g2891.id, status: "PAID" },
      { code: "EXP-0087", kind: "EXPENSE", date: d(-4), ref: "PO-1446-0087", partyName: "Al-Barakah Catering", category: "Catering Costs", amount: D(98280), groupId: g2891.id, status: "PAID" },
      { code: "EXP-0082", kind: "EXPENSE", date: d(-5), ref: "PO-1446-0082", partyName: "Al-Naqil Transport", category: "Transport Costs", amount: D(18000), groupId: g2891.id, status: "PAID" },
      { code: "EXP-0071", kind: "EXPENSE", date: d(-16), ref: "SAL-JUL-2025", partyName: "Staff Payroll", category: "Salaries", amount: D(82500), status: "PAID" },
      { code: "EXP-0052", kind: "EXPENSE", date: d(-16), ref: "RENT-JUN-2025", partyName: "Office Rent", category: "Overhead", amount: D(20000), status: "PAID" },
    ],
  });

  await prisma.statement.create({
    data: {
      code: "STMT-RASH-001", companyId: rashidi.id, periodStart: d(-120), periodEnd: d(0),
      openingBalance: D(180000), totalCredits: D(610000), totalDebits: D(206400), closingBalance: D(583600),
    },
  });

  await prisma.currencyRate.createMany({
    data: [
      { currency: "SAR", rateToSar: D("1.0000"), asOf: d(0, 6) },
      { currency: "USD", rateToSar: D("3.7500"), asOf: d(0, 6) },
      { currency: "BDT", rateToSar: D("0.0310"), asOf: d(0, 6) },
      { currency: "EUR", rateToSar: D("4.0500"), asOf: d(0, 6) },
      { currency: "GBP", rateToSar: D("4.7200"), asOf: d(0, 6) },
      { currency: "TRY", rateToSar: D("0.1150"), asOf: d(0, 6) },
    ],
  });

  // ── OCR documents ──────────────────────────────────────────────────────────
  console.log("── OCR queue…");
  const ocrOriginal = await prisma.ocrDocument.create({
    data: {
      code: "OCR-0392", documentType: "PASSPORT", fileName: "AX0987654_passport.jpg",
      tenantId: rashidi.id, groupId: g2891.id, uploadedById: ahmadUser.id,
      extractedFields: [
        { field: "Document Number", value: "AX0987654", confidence: 97 },
        { field: "Surname", value: "RAHMAN", confidence: 96 },
        { field: "Given Names", value: "MOHAMMED", confidence: 95 },
        { field: "Nationality", value: "BGD", confidence: 99 },
      ],
      confidenceScore: 96.2, reviewStatus: "APPROVED", reviewedById: ocrAdmin.id, processedAt: d(-30),
    },
  });
  await prisma.ocrDocument.create({
    data: {
      code: "OCR-0441", documentType: "PASSPORT", fileName: "AX1234567_passport_scan.jpg",
      tenantId: rashidi.id, groupId: g2891.id, uploadedById: ahmadUser.id,
      extractedFields: [
        { field: "Document Number", value: "AX1234567", confidence: 88, low: false },
        { field: "Surname", value: "RAHMAN", confidence: 94 },
        { field: "Given Names", value: "MOHAMMED", confidence: 93 },
        { field: "Date of Expiry", value: "2027-11-30", confidence: 62, low: true, note: "MRZ: 2026-11-30 · Chip: 2027-11-30" },
      ],
      confidenceScore: 88, mrzDiscrepancy: true,
      duplicateOfId: ocrOriginal.id, reviewStatus: "IN_REVIEW",
    },
  });
  await prisma.ocrDocument.createMany({
    data: [
      { code: "OCR-0445", documentType: "TRADE_LICENSE", fileName: "TL_Crown_2026.pdf", tenantId: crown.id, confidenceScore: 91.5, reviewStatus: "PENDING" },
      { code: "OCR-0446", documentType: "PAYMENT_SLIP", fileName: "AlinmaSlip_45000.jpg", tenantId: alnoor.id, confidenceScore: 78.4, reviewStatus: "PENDING" },
      { code: "OCR-0447", documentType: "HOTEL_VOUCHER", fileName: "Voucher_GRP2744.pdf", tenantId: alnoor.id, groupId: g2744.id, confidenceScore: 95.1, reviewStatus: "APPROVED" },
      { code: "OCR-0448", documentType: "DRIVER_LICENSE", fileName: "DL_Bassem.jpg", confidenceScore: 83.9, reviewStatus: "PENDING" },
      { code: "OCR-0449", documentType: "INVOICE", fileName: "Invoice_AlBarakah_0092.pdf", tenantId: albarakah.id, confidenceScore: 89.7, reviewStatus: "IN_REVIEW" },
    ],
  });

  // link a passenger to its OCR source document
  const paxLink = await prisma.passenger.findFirst({ where: { groupId: g2891.id, code: "PAX-001" } });
  if (paxLink) await prisma.passenger.update({ where: { id: paxLink.id }, data: { ocrDocumentId: ocrOriginal.id } });

  // ── Automation rules ───────────────────────────────────────────────────────
  console.log("── Automation…");
  const RULES: Array<[string, string, string, string, string, string, string[]]> = [
    ["R02", "Group", "Group Creation", "গ্রুপ তৈরি", "Group record created", "Always", ["WhatsApp receipt to agent", "Set status → Active", "Notify ops desk"]],
    ["R03", "Visa", "Passport OCR Intake", "পাসপোর্ট ওসিআর", "Passport file uploaded", "File type = PDF or JPG/PNG", ["Run OCR extraction", "Map fields to pax record", "Flag low confidence"]],
    ["R04", "Group", "Excel Pax Import", "এক্সেল যাত্রী আমদানি", "Excel file uploaded", "Sheet name = Passenger List", ["Parse Excel rows", "Create/update pax records", "Validation report"]],
    ["R05", "Visa", "Visa Status Sync", "ভিসা অবস্থা সিঙ্ক", "Visa status changed", "Status in {Submitted, Approved, Rejected}", ["WhatsApp to agent", "Update group stage", "In-app notification"]],
    ["R06", "Hotel", "Hotel Voucher Trigger", "হোটেল ভাউচার", "Hotel booking confirmed", "Voucher not yet generated", ["Generate voucher PDF", "Email to agent", "Log to BRN table"]],
    ["R07", "Finance", "Invoice Dispatch", "চালান প্রেরণ", "Invoice finalized", "Status = Draft AND Items > 0", ["Generate invoice PDF", "Email to agent", "Post to agent ledger"]],
    ["R08", "Docs", "Voucher QR Generation", "ভাউচার কিউআর", "Voucher finalized", "Type in {Hotel, Transport, Ziyarah}", ["Generate PDF + QR payload", "Log QR to BRN table"]],
    ["R09", "Finance", "Payment Application", "পেমেন্ট প্রয়োগ", "Payment received", "Amount > 0 AND Source = Agent", ["Update agent ledger", "Apply to open invoices", "WhatsApp receipt"]],
    ["R10", "Sys", "Daily Backup", "দৈনিক ব্যাকআপ", "Schedule: 02:00 daily", "Always", ["Export DB snapshot → cloud", "Purge snapshots > 30d"]],
    ["R11", "Esc", "Overdue Invoice Escalation", "বকেয়া চালান এসকেলেশন", "Invoice age > 30 days", "Status = Outstanding AND Amount > 5,000", ["Set priority = URGENT", "Notify finance manager", "Log escalation"]],
    ["R12", "Esc", "Emergency Broadcast", "জরুরি সম্প্রচার", "Emergency flag raised", "Always — no filter", ["WhatsApp all managers", "In-app emergency alert", "Log incident"]],
  ];
  for (const [code, category, name, nameBn, trigger, cond, actions] of RULES) {
    await prisma.automationRule.create({
      data: {
        code, category, name, nameBn, trigger, conditionExpr: cond, actions,
        enabled: code !== "R11",
        cronExpr: code === "R10" ? "0 2 * * *" : null,
        lastRunAt: d(-1, 14),
        runLogs: {
          create: [
            { startedAt: d(-1, 14, 44), durationMs: 280, status: "OK" },
            { startedAt: d(0, 2, 0), durationMs: 340, status: code === "R04" ? "WARN" : "OK", message: code === "R04" ? "Row 14: passport expiry within 6 months" : null },
          ],
        },
      },
    });
  }

  // ── LIVE engine rules (Phase 10): structured eventKey + actions that actually fire ──
  // These are the machine-driven counterparts. Emitting the domain event queues the
  // action(s) via BullMQ — nothing is hardcoded into the emitting service.
  const ENGINE: Array<{
    code: string; category: string; name: string; nameBn: string; trigger: string;
    eventKey: string | null; conditionExpr: string | null; conditions: unknown;
    actions: unknown[]; cronExpr?: string | null; enabled?: boolean;
  }> = [
    { code: "R01", category: "Agent", name: "Agent Approval → Welcome", nameBn: "এজেন্ট অনুমোদন", trigger: "Agent verified",
      eventKey: "agent.approved", conditionExpr: "Status = VERIFIED", conditions: null,
      actions: [{ type: "SEND_NOTIFICATION", params: { channel: "EMAIL", eventKey: "AGENT_APPROVED", title: "Welcome to TUBA AL HIJAZ" } }] },
    { code: "AR-GRP-01", category: "Group", name: "Group Created → Notify", nameBn: "গ্রুপ তৈরি", trigger: "Group created",
      eventKey: "group.created", conditionExpr: null, conditions: null,
      actions: [{ type: "SEND_NOTIFICATION", params: { eventKey: "GROUP_CREATED", title: "New group created", notifyPolicy: "intake" } }] },
    { code: "AR-GRP-02", category: "Group", name: "Gates Changed → Notify", nameBn: "গেট পরিবর্তন", trigger: "Group readiness gates changed",
      eventKey: "group.gates.changed", conditionExpr: null, conditions: null,
      actions: [{ type: "SEND_NOTIFICATION", params: { eventKey: "GROUP_GATES_CHANGED", title: "Group readiness gates updated", notifyPolicy: "intake" } }] },
    { code: "AR-GRP-03", category: "Group", name: "Mutamer Import → Notify", nameBn: "মুতামির আমদানি", trigger: "Mutamer bulk import completed",
      eventKey: "group.import.completed", conditionExpr: null, conditions: null,
      actions: [{ type: "SEND_NOTIFICATION", params: { eventKey: "GROUP_IMPORT_COMPLETED", title: "Mutamer import completed", notifyPolicy: "intake" } }] },
    { code: "AR-GRP-04", category: "Group", name: "Group List OCR → Notify", nameBn: "গ্রুপ তালিকা OCR", trigger: "Nusuk group-list OCR approved",
      eventKey: "group.ocr.committed", conditionExpr: null, conditions: null,
      actions: [{ type: "SEND_NOTIFICATION", params: { eventKey: "GROUP_OCR_COMMITTED", title: "Group list OCR committed", notifyPolicy: "intake" } }] },
    { code: "AR-VISA-01", category: "Visa", name: "Visa Issued → Notify", nameBn: "ভিসা ইস্যু", trigger: "Passenger visa pipeline → ISSUED",
      eventKey: "visa.approved", conditionExpr: null, conditions: null,
      actions: [{ type: "SEND_NOTIFICATION", params: { eventKey: "VISA_APPROVED", title: "Visa issued", notifyPolicy: "visa" } }] },
    { code: "AR-VISA-02", category: "Visa", name: "Visa Rejected → Notify", nameBn: "ভিসা প্রত্যাখ্যান", trigger: "Passenger visa pipeline → REJECTED",
      eventKey: "visa.rejected", conditionExpr: null, conditions: null,
      actions: [{ type: "SEND_NOTIFICATION", params: { eventKey: "VISA_REJECTED", title: "Visa rejected", notifyPolicy: "visa" } }] },
    { code: "AR-VISA-03", category: "Visa", name: "Passport Returned → Notify", nameBn: "পাসপোর্ট ফেরত", trigger: "Passenger visa pipeline → PASSPORT_RETURNED",
      eventKey: "visa.passport.returned", conditionExpr: null, conditions: null,
      actions: [{ type: "SEND_NOTIFICATION", params: { eventKey: "PASSPORT_RETURNED", title: "Passport returned", notifyPolicy: "visa" } }] },
    { code: "AR-LS-85", category: "LongStay", name: "Long Stay Day-85 → Notify Host/Agent/Tuba", nameBn: "ডে-৮৫ রিমাইন্ডার", trigger: "Day-85 sweep: Kingdom day ≥ 85",
      eventKey: "longstay.day85", conditionExpr: "stage = DUE", conditions: [{ path: "data.stage", op: "eq", value: "DUE" }],
      actions: [{ type: "SEND_NOTIFICATION", params: { eventKey: "LONGSTAY_DAY85", title: "Long Stay day-85 compliance due", notifyPolicy: "longstay" } }] },
    { code: "AR-LS-90", category: "LongStay", name: "Long Stay Day-90 → Escalate", nameBn: "ডে-৯০ এসকেলেশন", trigger: "Day-85 sweep: Kingdom day ≥ 90 (overstay risk)",
      eventKey: "longstay.day85", conditionExpr: "stage = ESCALATED", conditions: [{ path: "data.stage", op: "eq", value: "ESCALATED" }],
      actions: [
        { type: "SEND_NOTIFICATION", params: { eventKey: "LONGSTAY_DAY85", title: "Long Stay overstay risk — day 90", notifyPolicy: "longstay", priority: "EMERGENCY" } },
        { type: "ESCALATE", params: { title: "Long Stay overstay risk (day 90)" } },
      ] },
    { code: "AR-BKG-01", category: "Hotel", name: "Hotel Confirmed → Voucher", nameBn: "হোটেল ভাউচার", trigger: "Hotel booking confirmed",
      eventKey: "booking.confirmed", conditionExpr: "service = hotel", conditions: [{ path: "service", op: "eq", value: "hotel" }],
      actions: [{ type: "GENERATE_VOUCHER" }], enabled: false }, // opt-in: Phase 6 already issues vouchers on supplier accept
    { code: "AR-VCH-01", category: "Docs", name: "Voucher → QR", nameBn: "ভাউচার কিউআর", trigger: "Voucher generated",
      eventKey: "voucher.generated", conditionExpr: null, conditions: null,
      actions: [{ type: "GENERATE_QR" }] },
    { code: "AR-INV-01", category: "Finance", name: "Invoice → PDF + Notify", nameBn: "চালান পিডিএফ", trigger: "Invoice generated",
      eventKey: "invoice.generated", conditionExpr: null, conditions: null,
      actions: [{ type: "GENERATE_PDF", params: { title: "Tax Invoice" } }, { type: "SEND_NOTIFICATION", params: { title: "Invoice ready", eventKey: "INVOICE_GENERATED" } }] },
    { code: "AR-DOC-EXP", category: "Esc", name: "Document Expiring → Escalate", nameBn: "নথির মেয়াদ", trigger: "Compliance doc expiring",
      eventKey: "document.expiring", conditionExpr: "severity in {CRITICAL, EXPIRED}", conditions: null,
      actions: [{ type: "ESCALATE" }] },
    // Scheduled system rules — logged against by the BullMQ repeatable jobs (SYS_RULE_CODE).
    { code: "SYS_DAILY_BACKUP", category: "Sys", name: "Daily Database Backup", nameBn: "দৈনিক ব্যাকআপ", trigger: "Schedule: 02:00 daily",
      eventKey: null, conditionExpr: "Always", conditions: null, actions: [{ type: "RUN_BACKUP" }], cronExpr: "0 2 * * *" },
    { code: "SYS_CLOUD_BACKUP", category: "Sys", name: "Weekly Cloud Backup", nameBn: "ক্লাউড ব্যাকআপ", trigger: "Schedule: 03:00 Sunday",
      eventKey: null, conditionExpr: "Always", conditions: null, actions: [{ type: "RUN_BACKUP", params: { cloud: true } }], cronExpr: "0 3 * * 0" },
    { code: "SYS_EXPIRY_ESCALATION", category: "Esc", name: "Daily Expiry Sweep", nameBn: "মেয়াদ স্ক্যান", trigger: "Schedule: 06:00 daily",
      eventKey: null, conditionExpr: "Always", conditions: null, actions: [{ type: "ESCALATE" }], cronExpr: "0 6 * * *" },
    { code: "SYS_LONGSTAY_DAY85", category: "Sys", name: "Daily Day-85 Compliance Sweep", nameBn: "দৈনিক ডে-৮৫ স্ক্যান", trigger: "Schedule: 06:15 daily",
      eventKey: null, conditionExpr: "Always", conditions: null, actions: [{ type: "SEND_NOTIFICATION", params: { eventKey: "LONGSTAY_DAY85" } }], cronExpr: "15 6 * * *" },
  ];
  for (const r of ENGINE) {
    await prisma.automationRule.create({
      data: {
        code: r.code, category: r.category, name: r.name, nameBn: r.nameBn, trigger: r.trigger,
        eventKey: r.eventKey, conditionExpr: r.conditionExpr,
        conditions: (r.conditions ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        actions: r.actions as unknown as Prisma.InputJsonValue,
        enabled: r.enabled ?? true, cronExpr: r.cronExpr ?? null,
      },
    });
  }

  // ── Notification engine ────────────────────────────────────────────────────
  console.log("── Notifications…");
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
  const events: Record<string, string> = {};
  for (const [key, labelEn, labelBn, priority, wa, em, ia] of EVENTS) {
    const e = await prisma.notificationEvent.create({
      data: { key, labelEn, labelBn, priority, whatsapp: wa, email: em, inApp: ia },
    });
    events[key] = e.id;
  }

  await prisma.messageTemplate.createMany({
    data: [
      { eventId: events["AGENT_APPROVED"], channel: "WHATSAPP", lang: "en", body: "Welcome to TUBA AL HIJAZ, {{agent_name}}! Your account is approved. Login: {{email}}" },
      { eventId: events["AGENT_APPROVED"], channel: "WHATSAPP", lang: "bn", body: "তুবা আল হিজাজে স্বাগতম, {{agent_name}}! আপনার অ্যাকাউন্ট অনুমোদিত হয়েছে। লগইন: {{email}}" },
      { eventId: events["VISA_APPROVED"], channel: "WHATSAPP", lang: "en", body: "Visa approved for group {{group_id}} — {{pax_count}} pax. Arrival: {{arrival_date}}." },
      { eventId: events["VISA_APPROVED"], channel: "WHATSAPP", lang: "bn", body: "গ্রুপ {{group_id}} এর ভিসা অনুমোদিত — {{pax_count}} জন যাত্রী। আগমন: {{arrival_date}}।" },
      { eventId: events["PAYMENT_RECEIVED"], channel: "WHATSAPP", lang: "en", body: "Payment of SAR {{amount}} received against {{invoice_ref}}. Balance: SAR {{balance}}." },
      { eventId: events["PAYMENT_RECEIVED"], channel: "WHATSAPP", lang: "bn", body: "{{invoice_ref}} এর বিপরীতে SAR {{amount}} পেমেন্ট গৃহীত হয়েছে। ব্যালেন্স: SAR {{balance}}।" },
      { eventId: events["INVOICE_GENERATED"], channel: "EMAIL", lang: "en", subject: "Invoice {{invoice_ref}} — TUBA AL HIJAZ", body: "Dear {{agent_name}}, invoice {{invoice_ref}} for SAR {{amount}} has been issued. Due: Net 30 days." },
      { eventId: events["INVOICE_GENERATED"], channel: "EMAIL", lang: "bn", subject: "চালান {{invoice_ref}} — তুবা আল হিজাজ", body: "প্রিয় {{agent_name}}, SAR {{amount}} এর চালান {{invoice_ref}} ইস্যু করা হয়েছে। মেয়াদ: ৩০ দিন।" },
      { eventId: events["SYSTEM_ALERT"], channel: "IN_APP", lang: "en", body: "EMERGENCY: {{alert_type}} at {{location}} — {{timestamp}}. Contact {{ops_contact}}." },
      { eventId: events["SYSTEM_ALERT"], channel: "IN_APP", lang: "bn", body: "জরুরি: {{location}} এ {{alert_type}} — {{timestamp}}। যোগাযোগ: {{ops_contact}}।" },
    ],
  });

  await prisma.notificationLog.createMany({
    data: [
      { code: "NL-0841", eventId: events["VISA_APPROVED"], channel: "WHATSAPP", tenantId: rashidi.id, recipientAddress: "+966 50 123 4567", title: "Visa approved — GRP-1446-2891", body: "47 pax visa batch approved. MOFA clearance confirmed.", status: "READ", priority: "NORMAL", sentAt: d(0, 8, 12), readAt: d(0, 8, 40) },
      { code: "NL-0842", eventId: events["INVOICE_GENERATED"], channel: "EMAIL", tenantId: rashidi.id, recipientAddress: "ahmad@rashidi-travel.com", title: "Invoice INV-1446-0091 — SAR 323,725", status: "DELIVERED", priority: "NORMAL", sentAt: d(-14, 10) },
      { code: "NL-0843", eventId: events["SYSTEM_ALERT"], channel: "IN_APP", recipientUserId: opsMgr.id, title: "Transport SLA breach — DSP-0444", body: "Dispatch delayed +45 min — Bassem Khalil, Ring Road traffic", status: "DELIVERED", priority: "EMERGENCY", sentAt: d(0, 7, 50) },
      { code: "NL-0844", eventId: events["PAYMENT_RECEIVED"], channel: "WHATSAPP", tenantId: rashidi.id, recipientAddress: "+966 50 123 4567", title: "Payment received — SAR 180,000", status: "DELIVERED", priority: "NORMAL", sentAt: d(-8, 15) },
      { code: "NL-0845", eventId: events["DAILY_BACKUP_COMPLETED"], channel: "EMAIL", recipientAddress: "it@tubalhijaz.com", title: "Daily backup completed — verified", status: "DELIVERED", priority: "LOW", sentAt: d(0, 2, 5) },
      { code: "NL-0846", eventId: events["GROUP_CREATED"], channel: "IN_APP", recipientUserId: opsMgr.id, tenantId: zamzam.id, title: "New group GRP-1446-2990 — 52 pax", status: "PENDING", priority: "NORMAL" },
    ],
  });

  // ── Enquiries ──────────────────────────────────────────────────────────────
  await prisma.enquiry.createMany({
    data: [
      { type: "AGENT", name: "Mohammad Salahuddin", company: "Dhaka Star Travels", email: "info@dhakastar.com.bd", subject: "Become a Travel Agent Partner", message: "আসসালামু আলাইকুম। আমরা ঢাকা থেকে উমরাহ গ্রুপ পরিচালনা করি এবং আপনাদের প্ল্যাটফর্মে এজেন্ট হিসেবে যুক্ত হতে আগ্রহী।" },
      { type: "SUPPLIER", name: "Waleed Al-Amri", company: "Amri Coaches", email: "waleed@amricoaches.sa", subject: "Supplier Registration", message: "We operate 18 coaches in Makkah region and would like to join as a transport supplier for season 1447H." },
    ],
  });

  // ── Audit trail ────────────────────────────────────────────────────────────
  await prisma.auditLog.createMany({
    data: [
      { actorUserId: ceo.id, action: "APPROVE", module: "Companies", entityType: "Company", entityId: rashidi.id, after: { verificationStatus: "VERIFIED" }, ip: "10.0.0.12" },
      { actorUserId: finOfficer.id, action: "CREATE", module: "Finance", entityType: "Invoice", entityId: inv0091.id, after: { code: "INV-1446-0091", total: "323725" }, ip: "10.0.0.31" },
      { actorUserId: finOfficer.id, action: "APPROVE", module: "Finance", entityType: "PaymentSlip", entityId: "SLP-0071", before: { status: "PENDING" }, after: { status: "CONFIRMED" }, ip: "10.0.0.31" },
      { actorLabel: "System (Cron)", action: "RUN", module: "Backup", entityType: "AutomationRule", entityId: "R10", after: { result: "OK", sizeGb: 4.2 }, ip: "127.0.0.1" },
      { actorUserId: ocrAdmin.id, action: "REVIEW", module: "OCR", entityType: "OcrDocument", entityId: "OCR-0441", after: { reviewStatus: "IN_REVIEW", mrzDiscrepancy: true }, ip: "10.0.0.44" },
      { actorUserId: opsMgr.id, action: "UPDATE", module: "Operations", entityType: "DispatchOrder", entityId: "DSP-0444", before: { status: "EN_ROUTE" }, after: { status: "DELAYED" }, ip: "10.0.0.19" },
    ],
  });

  // summary
  const counts: Array<[string, number]> = [
    ["companies", await prisma.company.count()],
    ["users", await prisma.user.count()],
    ["groups", await prisma.group.count()],
    ["passengers", await prisma.passenger.count()],
    ["flights", await prisma.flightInfo.count()],
    ["dispatches", await prisma.dispatchOrder.count()],
    ["bookings (H/T/C)", (await prisma.hotelBooking.count()) + (await prisma.transportBooking.count()) + (await prisma.cateringBooking.count())],
    ["invoices", await prisma.invoice.count()],
    ["ledger entries", await prisma.ledgerEntry.count()],
    ["ocr documents", await prisma.ocrDocument.count()],
    ["automation rules", await prisma.automationRule.count()],
    ["notification logs", await prisma.notificationLog.count()],
  ];
  console.log("\n── Seed complete ──");
  for (const [label, n] of counts) console.log(`   ${label}: ${n}`);
  console.log("   Demo password for every user: Demo@123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
