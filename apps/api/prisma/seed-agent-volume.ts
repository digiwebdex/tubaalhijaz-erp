/* Additive LOCAL seed — realistic agent business volume to verify the ERP tables.
 * Adds groups → 12, passengers → 180, and rich per-agent wallet/ledger/payment/
 * document/service/notification data. Internally consistent. LOCAL ONLY. */
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const now = new Date();
const day = (n: number) => new Date(now.getTime() + n * 86400000);
const pick = <T,>(a: T[], i: number) => a[i % a.length];
const money = (n: number) => n.toFixed(2);

async function main() {
  const season = await p.season.findFirstOrThrow({ where: { isActive: true } });
  const AGENTS = ["AGT-1446-4827", "AGT-1446-2291", "AGT-1446-3201"]; // Rashidi, Al-Noor, Zamzam
  const companies = await Promise.all(AGENTS.map((code) => p.company.findUniqueOrThrow({ where: { code } })));

  // ── Groups → 12 total (add 7), 15 passengers each (→180) ────────────────────
  const existingGroups = await p.group.count();
  const toAdd = Math.max(0, 12 - existingGroups);
  const NAMES: [string, string | null, string][] = [
    ["Mohammed Rahman", "মোহাম্মদ রহমান", "Bangladesh"], ["Abdul Karim", "আবদুল করিম", "Bangladesh"],
    ["Fatema Begum", "ফাতেমা বেগম", "Bangladesh"], ["Nurul Islam", "নুরুল ইসলাম", "Bangladesh"],
    ["Shahida Khatun", "শাহিদা খাতুন", "Bangladesh"], ["Habibur Rahman", "হাবিবুর রহমান", "Bangladesh"],
    ["Tahmina Akter", "তাহমিনা আক্তার", "Bangladesh"], ["Kamal Uddin", "কামাল উদ্দিন", "Bangladesh"],
    ["Nasrin Sultana", "নাসরিন সুলতানা", "Bangladesh"], ["Tariq Mehmood", null, "Pakistan"],
    ["Zainab Bibi", null, "Pakistan"], ["Mahmoud El-Sayed", null, "Egypt"],
    ["Siti Rahayu", null, "Indonesia"], ["Yusuf Ali", null, "India"], ["Aisha Binti Osman", null, "Malaysia"],
  ];
  const PP: Record<string, string> = { Bangladesh: "BD", Pakistan: "PK", Egypt: "EG", Indonesia: "ID", India: "IN", Malaysia: "MY" };
  const dests = ["MAKKAH", "MADINAH", "MAKKAH_MADINAH"] as const;
  const vtypes = ["UMRAH", "HAJJ", "LONG_STAY"] as const;
  const gstatus = ["PENDING", "IN_PROGRESS", "VERIFIED", "COMPLETED", "IN_PROGRESS"] as const;
  const ops = ["UPCOMING", "ACTIVE", "DELAYED", "COMPLETED"] as const;
  const gnames = ["Blessed Journey", "Rahmat Umrah", "Noor Caravan", "Sakina Group", "Barakah Pilgrims", "Hidaya Convoy", "Safar-e-Haram"];
  let pp = 8300000;
  const newGroups: { id: string; tenantId: string; stage: number }[] = [];
  for (let i = 0; i < toAdd; i++) {
    const company = pick(companies, i);
    const stage = 5 + (i % 8);
    const g = await p.group.create({
      data: {
        code: `GRP-1446-S${9000 + i}`, tenantId: company.id, seasonId: season.id,
        name: `${pick(gnames, i)} ${i + 1}`, nameBn: null,
        destination: pick([...dests], i) as never, visaType: pick([...vtypes], i) as never,
        packageType: pick(["ECONOMY", "STANDARD", "PREMIUM"], i) as never,
        maxCapacity: 40, paxCount: 15,
        departDate: day(20 + i * 7), returnDate: day(34 + i * 7),
        nusukGroupNumber: `NK-${23000 + i}`, consulate: pick(["Dhaka", "Karachi", "Cairo", "Jakarta"], i),
        status: pick([...gstatus], i) as never, opsStatus: pick([...ops], i) as never,
        currentStage: stage, gateVisa: stage >= 8, gatePackage: stage >= 6, gatePayment: stage >= 7,
      },
    });
    newGroups.push({ id: g.id, tenantId: company.id, stage });
    await p.passenger.createMany({
      data: NAMES.map(([name, nameBn, nat], j) => ({
        code: `PAX-${String(j + 1).padStart(3, "0")}`, tenantId: company.id, groupId: g.id,
        name, nameBn, nationality: nat, passportNo: `${PP[nat]}${pp++}`, passportExpiry: day(300 + j * 25),
        gender: (j % 3 === 2 ? "FEMALE" : "MALE") as never,
        dob: new Date(1968 + ((j * 3) % 32), (j * 5) % 12, ((j * 7) % 27) + 1),
        visaStatus: (stage >= 8 ? (j < 12 ? "APPROVED" : "PENDING") : "PENDING") as never,
        visaPipelineStatus: pick(["NEW", "MOFA", "EMBASSY", "BIOMETRIC", "ISSUED", "PROCESSING"], j + i) as never,
        hotelStatus: (stage >= 9 ? "CONFIRMED" : "PENDING") as never,
        transportStatus: (stage >= 10 ? "CONFIRMED" : "PENDING") as never,
        mohStatus: (stage >= 8 ? "CLEARED" : "PENDING") as never,
      })),
    });
  }

  // ── Per-group services (varied statuses for badge variety) ──────────────────
  const svcStatus = ["REQUESTED", "ASSIGNED", "CONFIRMED", "VOUCHER_ISSUED", "COMPLETED", "REJECTED"] as const;
  let sc = 1;
  for (const g of newGroups) {
    const st = pick([...svcStatus], g.stage);
    await p.visaRequest.create({ data: { code: `REQ-V-S${sc}`, tenantId: g.tenantId, groupId: g.id, seasonId: season.id, visaType: "UMRAH", applicationYearHijri: "1446", nusukRef: `NK-${23000 + sc}`, muallimNo: `MU-${5500 + sc}`, mohCategory: pick(["A", "B", "C"], sc) as never, priority: pick(["NORMAL", "HIGH", "URGENT"], sc) as never, status: st as never, submittedAt: day(-10 - sc), unitPrice: money(650), subtotal: money(650 * 15) } });
    await p.hotelBooking.create({ data: { code: `HTL-S${sc}`, tenantId: g.tenantId, groupId: g.id, checkIn: day(20), checkOut: day(27), nights: 7, doubleRooms: 4, tripleRooms: 3, mealPlan: pick(["FULL_BOARD", "HALF_BOARD", "BED_BREAKFAST"], sc) as never, ratePerRoom: money(420), totalAmount: money(420 * 7 * 7), status: pick([...svcStatus], g.stage + 1) as never } });
    await p.transportBooking.create({ data: { code: `TRN-S${sc}`, tenantId: g.tenantId, groupId: g.id, vehicleType: pick(["BUS", "COASTER", "HIACE", "VAN"], sc) as never, vehicleCount: 1 + (sc % 3), departurePoint: "Jeddah Airport", destination: "Makkah — Haram", departAt: day(20), returnAt: day(27), totalAmount: money(3500 + sc * 100), status: pick([...svcStatus], g.stage + 2) as never } });
    await p.cateringBooking.create({ data: { code: `CAT-S${sc}`, tenantId: g.tenantId, groupId: g.id, mealPlan: pick(["FULL_BOARD", "HALF_BOARD"], sc) as never, pricePerPaxDay: money(45), halalCount: 15, totalAmount: money(45 * 15 * 7), status: pick([...svcStatus], g.stage + 3) as never } });
    await p.groupTimelineEntry.createMany({ data: [
      { groupId: g.id, event: "CREATED", actorLabel: "Agent", note: "Group created", createdAt: day(-30) },
      { groupId: g.id, event: "SUBMITTED", actorLabel: "Agent", note: "Submitted for approval", createdAt: day(-20) },
      ...(g.stage >= 8 ? [{ groupId: g.id, event: "APPROVED" as never, actorLabel: "Super Admin", note: "Approved", createdAt: day(-15) }] : []),
    ] });
    sc++;
  }

  // ── Per-agent finance + documents + notifications ───────────────────────────
  const slipTypes = ["BANK_TRANSFER", "CHEQUE", "SADAD", "WIRE", "ONLINE_BANKING"] as const;
  const slipStatus = ["PENDING", "CONFIRMED", "REJECTED"] as const;
  const banks = ["Al Rajhi Bank", "Alinma Bank", "SNB", "Riyad Bank"];
  const docKinds = ["TRADE_LICENSE", "OWNER_ID", "OFFICE_PHOTO", "SIGNED_CHEQUE", "DEPOSIT_PROOF", "INVOICE", "VOUCHER", "PASSPORT", "SUPPLIER_CERT", "OTHER", "COMPANY_LOGO"] as const;

  let slp = 100, nl = 100, uf = 1;
  for (const company of companies) {
    // wallet — rebuild transactions cleanly so balance is consistent
    let wallet = await p.wallet.findUnique({ where: { companyId: company.id } });
    if (!wallet) wallet = await p.wallet.create({ data: { companyId: company.id, balance: 0, currency: "SAR" } });
    await p.walletTransaction.deleteMany({ where: { walletId: wallet.id } });
    let bal = 0;
    const txns: { direction: "CREDIT" | "DEBIT"; amount: number; desc: string; day: number }[] = [];
    for (let i = 0; i < 16; i++) {
      const credit = i % 3 === 0;
      const amt = credit ? 20000 + (i % 4) * 15000 : 3000 + (i % 5) * 4000;
      txns.push({ direction: credit ? "CREDIT" : "DEBIT", amount: amt, desc: credit ? `Wallet top-up — ${pick(banks, i)}` : `Service charge — ${pick(["Visa fees", "Hotel deposit", "Transport", "Catering", "Ticket"], i)}`, day: -60 + i * 3 });
    }
    for (const t of txns) {
      bal += t.direction === "CREDIT" ? t.amount : -t.amount;
      await p.walletTransaction.create({ data: { walletId: wallet.id, direction: t.direction as never, amount: money(t.amount), balanceAfter: money(bal), description: t.desc, createdAt: day(t.day) } });
    }
    await p.wallet.update({ where: { id: wallet.id }, data: { balance: money(bal) } });

    // agent ledger — 18 entries
    for (let i = 0; i < 18; i++) {
      const debit = i % 2 === 0;
      const amt = 2000 + (i % 6) * 3500;
      await p.ledgerEntry.create({ data: { ledgerType: "AGENT" as never, companyId: company.id, date: day(-55 + i * 3), description: pick(["Invoice raised", "Payment received", "Service settlement", "Adjustment", "Wallet top-up", "Refund"], i), ref: `${pick(["INV", "PAY", "STL", "ADJ"], i)}-${String(90 + i)}`, debit: debit ? money(amt) : "0", credit: debit ? "0" : money(amt) } });
    }

    // payment slips — 11
    for (let i = 0; i < 11; i++) {
      await p.paymentSlip.create({ data: { code: `SLP-${String(slp++).padStart(4, "0")}`, companyId: company.id, purpose: pick(["WALLET_TOPUP", "INVOICE_PAYMENT", "SECURITY_DEPOSIT"], i) as never, type: pick([...slipTypes], i) as never, amount: money(15000 + (i % 6) * 8000), bank: pick(banks, i), transferRef: `TRF-${45000 + i}`, paymentDate: day(-40 + i * 4), status: pick([...slipStatus], i) as never } });
    }

    // documents — 11 (varied kinds + expiry for badges)
    for (let i = 0; i < 11; i++) {
      const kind = pick([...docKinds], i);
      const exp = i % 4 === 0 ? day(15 + i) : i % 4 === 1 ? day(200 + i * 10) : i % 4 === 2 ? day(-5) : null; // soon / valid / expired / none
      await p.uploadedFile.create({ data: { storageKey: `local/${company.code}/doc-${uf++}`, fileName: `${kind.toLowerCase()}-${company.code}.pdf`, mimeType: "application/pdf", sizeBytes: 120000 + i * 40000, kind: kind as never, companyId: company.id, expiryDate: exp, scanStatus: "CLEAN", meta: { source: "seed" } } });
    }

    // notifications — 8
    for (let i = 0; i < 8; i++) {
      await p.notificationLog.create({ data: { code: `NL-${String(nl++).padStart(4, "0")}`, channel: pick(["IN_APP", "WHATSAPP", "EMAIL"], i) as never, priority: pick(["NORMAL", "LOW", "EMERGENCY"], i) as never, tenantId: company.id, title: pick(["Visa approved", "Payment confirmed", "Hotel booked", "Document expiring", "Group submitted"], i), body: "Notification body for verification.", status: pick(["DELIVERED", "READ", "PENDING", "FAILED"], i) as never, lang: "en", createdAt: day(-10 + i) } });
    }
  }

  const counts = {
    groups: await p.group.count(), passengers: await p.passenger.count(),
    walletTxn: await p.walletTransaction.count(), ledger: await p.ledgerEntry.count(),
    paymentSlip: await p.paymentSlip.count(), documents: await p.uploadedFile.count(),
    visa: await p.visaRequest.count(), hotel: await p.hotelBooking.count(),
    transport: await p.transportBooking.count(), catering: await p.cateringBooking.count(),
    notifications: await p.notificationLog.count(),
  };
  console.log("── Agent volume seed complete ──");
  console.log(JSON.stringify(counts, null, 2));
}
main().then(() => p.$disconnect()).catch((e) => { console.error(e); p.$disconnect(); process.exit(1); });
