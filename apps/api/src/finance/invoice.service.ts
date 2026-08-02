import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { PrismaService } from "../prisma/prisma.service";
import { EV, buildEvent } from "../automation/events";
import { StorageService } from "../storage/storage.service";
import { LedgerService } from "./ledger.service";
import { FinanceDocService } from "./finance-doc.service";
import { ACCT, REVENUE_ACCT, REVENUE_CATEGORY } from "./accounts";
import { ServiceKey, SERVICE_META } from "../services/service-types";
import { D, money, VAT_RATE } from "./money";

interface InvoiceLineInput {
  desc: string;
  qty: number;
  unit: number;
}

@Injectable()
export class InvoiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly ledger: LedgerService,
    private readonly docs: FinanceDocService,
    private readonly events: EventEmitter2,
  ) {}

  private async seasonYear(): Promise<number> {
    const s = await this.prisma.season.findFirst({ where: { isActive: true } });
    return s?.hijriYear ?? 1446;
  }

  private async uniqueCode(prefix: string): Promise<string> {
    const year = await this.seasonYear();
    for (let i = 0; i < 12; i++) {
      const code = `${prefix}-${year}-${String(1000 + Math.floor(Math.random() * 9000))}`;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const table: any = prefix === "INV" ? this.prisma.invoice : this.prisma.receipt;
      if (!(await table.findUnique({ where: { code } }))) return code;
    }
    throw new BadRequestException("Could not allocate a document code");
  }

  // ── reads ────────────────────────────────────────────────────────────────────
  async list(filters: { tenantId?: string; status?: string; kind?: string } = {}) {
    const rows = await this.prisma.invoice.findMany({
      where: {
        ...(filters.tenantId ? { tenantId: filters.tenantId } : {}),
        ...(filters.status ? { status: filters.status as never } : {}),
        ...(filters.kind ? { kind: filters.kind as never } : {}),
      },
      include: {
        items: true,
        tenant: { select: { code: true, name: true, city: true, country: true } },
        group: { select: { code: true } },
        allocations: { select: { amount: true } },
      },
      orderBy: { issueDate: "desc" },
      take: 200,
    });
    return rows.map((inv) => this.shape(inv));
  }

  /** Architecture flag — Bill Sheet API/UI off until Finance ready. */
  static mofaBillEnabled(): boolean {
    const v = (process.env.ENABLE_MOFA_PROCESSING_BILL ?? "").trim().toLowerCase();
    return v === "1" || v === "true" || v === "yes";
  }

  /**
   * T002-06 — MOFA Processing Account bill (Qty × Rate).
   * Separate from Passenger.mofaNumber (process identity).
   */
  async createMofaProcessingBill(
    input: {
      tenantId: string;
      groupId: string;
      qty: number;
      rate: number;
      notes?: string;
      dueInDays?: number;
    },
    createdById?: string,
  ) {
    if (!InvoiceService.mofaBillEnabled()) {
      throw new BadRequestException(
        "MOFA Processing Bill is disabled (ENABLE_MOFA_PROCESSING_BILL). Mutamer MOFA Number is unaffected.",
      );
    }
    if (!input.qty || input.qty < 1) throw new BadRequestException("qty must be ≥ 1");
    if (input.rate == null || input.rate < 0) throw new BadRequestException("rate is required");

    const group = await this.prisma.group.findUnique({
      where: { id: input.groupId },
      select: { id: true, code: true, tenantId: true },
    });
    if (!group) throw new NotFoundException("Group not found");
    if (group.tenantId !== input.tenantId) {
      throw new BadRequestException("groupId does not belong to tenantId");
    }

    const unit = money(input.rate);
    const qty = Math.floor(input.qty);
    const lineTotal = money(qty * unit);
    const notePrefix =
      "MOFA Processing Account bill (Qty×Rate). Not hotel/transport cash deal. Not mutamer MOFA Number.";

    return this.create({
      tenantId: input.tenantId,
      groupId: input.groupId,
      items: [
        {
          desc: `MOFA Processing — ${group.code} (${qty} × SAR ${unit})`,
          qty,
          unit,
          total: lineTotal,
        },
      ],
      subtotal: lineTotal,
      dueInDays: input.dueInDays ?? 30,
      revenueByService: "visa",
      category: "Visa Services",
      notes: input.notes ? `${notePrefix} ${input.notes}` : notePrefix,
      kind: "MOFA_PROCESSING",
      createdById,
    });
  }

  async signMofaBill(
    id: string,
    input: { approvalSign: string; crDate?: string },
    actorUserId?: string,
  ) {
    if (!InvoiceService.mofaBillEnabled()) {
      throw new BadRequestException("MOFA Processing Bill is disabled (ENABLE_MOFA_PROCESSING_BILL)");
    }
    const inv = await this.prisma.invoice.findUnique({ where: { id } });
    if (!inv) throw new NotFoundException("Invoice not found");
    if (inv.kind !== "MOFA_PROCESSING") {
      throw new BadRequestException("Only MOFA_PROCESSING invoices accept Approval Sign / CR Date");
    }
    const sign = (input.approvalSign ?? "").trim();
    if (!sign) throw new BadRequestException("approvalSign is required");

    await this.prisma.invoice.update({
      where: { id },
      data: {
        approvalSign: sign,
        crDate: input.crDate ? new Date(input.crDate) : new Date(),
      },
    });

    await this.prisma.auditLog
      .create({
        data: {
          actorUserId: actorUserId ?? null,
          action: "APPROVE",
          module: "MofaProcessingBill",
          entityType: "Invoice",
          entityId: id,
          after: {
            approvalSign: sign,
            crDate: input.crDate ?? new Date().toISOString(),
            code: inv.code,
          },
        },
      })
      .catch(() => undefined);

    return this.get(id);
  }

  async get(id: string) {
    const inv = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        items: true,
        tenant: { select: { code: true, name: true, city: true, country: true } },
        group: { select: { code: true } },
        allocations: { include: { receipt: { select: { code: true } } } },
      },
    });
    if (!inv) throw new NotFoundException("Invoice not found");
    return this.shape(inv);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private shape(inv: any) {
    const paid = (inv.allocations ?? []).reduce((s: number, a: { amount: Prisma.Decimal }) => s + Number(a.amount), 0);
    return {
      id: inv.id,
      code: inv.code,
      kind: inv.kind ?? "STANDARD",
      tenant: inv.tenant?.name ?? "",
      tenantCode: inv.tenant?.code ?? "",
      toAddr: inv.tenant?.city ? `${inv.tenant.city}, ${inv.tenant.country ?? "Saudi Arabia"}` : "",
      group: inv.group?.code ?? null,
      groupId: inv.groupId ?? null,
      issueDate: inv.issueDate,
      dueDate: inv.dueDate,
      subtotal: money(inv.subtotal),
      vatRate: Number(inv.vatRate),
      vatAmount: money(inv.vatAmount),
      total: money(inv.total),
      amountPaid: money(paid),
      balanceDue: money(Number(inv.total) - paid),
      status: inv.status,
      notes: inv.notes ?? null,
      approvalSign: inv.approvalSign ?? null,
      crDate: inv.crDate ?? null,
      fileId: inv.fileId,
      items: (inv.items ?? []).map((it: { description: string; qty: number; unitPrice: Prisma.Decimal; total: Prisma.Decimal }) => ({
        desc: it.description,
        qty: it.qty,
        unit: money(it.unitPrice),
        total: money(it.total),
      })),
    };
  }

  // ── create (manual, staff) ────────────────────────────────────────────────────
  async createManual(
    input: { tenantId: string; groupId?: string; dueInDays?: number; items: InvoiceLineInput[]; notes?: string },
    createdById?: string,
  ) {
    if (!input.items?.length) throw new BadRequestException("At least one line item is required");
    const subtotal = input.items.reduce((s, it) => s + it.qty * it.unit, 0);
    return this.create({
      tenantId: input.tenantId,
      groupId: input.groupId ?? null,
      items: input.items.map((it) => ({ desc: it.desc, qty: it.qty, unit: it.unit, total: it.qty * it.unit })),
      subtotal,
      dueInDays: input.dueInDays ?? 30,
      revenueByService: "additional",
      category: "Full Package",
      notes: input.notes,
      createdById,
    });
  }

  // ── auto-invoice on service completion ───────────────────────────────────────
  async autoInvoiceOnCompletion(service: ServiceKey, bookingId: string, createdById?: string) {
    const model = SERVICE_META[service].model;
    // fast-path idempotency (the @@unique([sourceType,sourceId]) + P2002 catch below is authoritative)
    const existing = await this.prisma.invoice.findFirst({ where: { sourceType: model, sourceId: bookingId } });
    if (existing) return this.get(existing.id);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const booking: any = await (this.prisma as any)[model].findUnique({
      where: { id: bookingId },
      include: { group: { select: { id: true, code: true, paxCount: true } } },
    });
    if (!booking) throw new NotFoundException("Booking not found");

    const { items, subtotal } = this.lineItemsFor(service, booking);
    if (subtotal <= 0) return null; // nothing billable (e.g. unpriced visa/additional)

    // Prepaid? If the agent's wallet was already debited for this booking on
    // confirmation, the invoice is settled from that advance (status PAID, no new
    // AR) — otherwise it's billed on Net-30 (AR). This is what stops the
    // wallet-debit-AND-AR economic double-charge.
    const walletDebit = await this.prisma.walletTransaction.findFirst({
      where: { refType: model, refId: bookingId, direction: "DEBIT" },
    });

    try {
      return await this.create({
        tenantId: booking.tenantId,
        groupId: booking.groupId,
        items,
        subtotal,
        dueInDays: 30,
        revenueByService: service,
        category: REVENUE_CATEGORY[service],
        sourceType: model,
        sourceId: bookingId,
        prepaid: !!walletDebit,
        createdById,
      });
    } catch (e) {
      // lost a concurrent race — the other COMPLETED transition created it
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const dup = await this.prisma.invoice.findFirst({ where: { sourceType: model, sourceId: bookingId } });
        if (dup) return this.get(dup.id);
      }
      throw e;
    }
  }

  private lineItemsFor(service: ServiceKey, booking: Record<string, unknown>): { items: Array<InvoiceLineInput & { total: number }>; subtotal: number } {
    const grp = (booking.group as { code?: string })?.code ?? "";
    if (service === "hotel") {
      const sub = booking.subtotal != null ? Number(booking.subtotal) : Number(booking.totalAmount ?? 0) / (1 + VAT_RATE);
      return { items: [{ desc: `Hotel Accommodation - ${grp} (${booking.nights}N)`, qty: 1, unit: money(sub), total: money(sub) }], subtotal: money(sub) };
    }
    if (service === "catering") {
      // catering totalAmount is VAT-INCLUSIVE (like hotel) — recover the ex-VAT base
      const sub = Number(booking.totalAmount ?? 0) / (1 + VAT_RATE);
      return { items: [{ desc: `Catering - ${grp}`, qty: 1, unit: money(sub), total: money(sub) }], subtotal: money(sub) };
    }
    if (service === "transport") {
      const sub = Number(booking.totalAmount ?? 0);
      return { items: [{ desc: `Ground Transport - ${grp}`, qty: 1, unit: money(sub), total: money(sub) }], subtotal: money(sub) };
    }
    return { items: [], subtotal: 0 };
  }

  // ── shared creator: invoice + items + GL + income entry + PDF ────────────────
  private async create(input: {
    tenantId: string;
    groupId: string | null;
    items: Array<InvoiceLineInput & { total: number }>;
    subtotal: number;
    dueInDays: number;
    revenueByService: ServiceKey;
    category: string;
    sourceType?: string;
    sourceId?: string;
    prepaid?: boolean;
    notes?: string;
    kind?: "STANDARD" | "MOFA_PROCESSING";
    createdById?: string;
  }) {
    const subtotal = money(input.subtotal);
    const vatAmount = money(subtotal * VAT_RATE);
    const total = money(subtotal + vatAmount);
    const code = await this.uniqueCode("INV");
    const issueDate = new Date();
    const dueDate = new Date(issueDate.getTime() + input.dueInDays * 86_400_000);
    const season = await this.prisma.season.findFirst({ where: { isActive: true } });

    const invoice = await this.prisma.invoice.create({
      data: {
        code,
        tenantId: input.tenantId,
        groupId: input.groupId,
        seasonId: season?.id,
        issueDate,
        dueDate,
        subtotal: D(subtotal),
        vatRate: D(15),
        vatAmount: D(vatAmount),
        total: D(total),
        status: input.prepaid ? "PAID" : "OUTSTANDING",
        notes: input.notes,
        kind: input.kind ?? "STANDARD",
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        items: {
          create: input.items.map((it) => ({
            description: it.desc,
            qty: it.qty,
            unitPrice: D(it.unit),
            total: D(it.total),
          })),
        },
      },
      include: { tenant: { select: { name: true } } },
    });

    // GL: credit Revenue (subtotal) + VAT Payable (vat); debit is either the
    // agent's prepaid advance (settled from wallet — no new AR) or AR (Net-30).
    await this.ledger.postJournal(
      [
        {
          accountCode: input.prepaid ? ACCT.AGENT_ADVANCES : ACCT.AR_AGENTS,
          debit: total,
          description: input.prepaid ? `Prepaid settlement ${code}` : `Invoice ${code}`,
        },
        { accountCode: REVENUE_ACCT[input.revenueByService], credit: subtotal, description: `Revenue - ${input.category}` },
        { accountCode: ACCT.VAT_PAYABLE, credit: vatAmount, description: "Output VAT 15%" },
      ],
      { ref: code, groupId: input.groupId, createdById: input.createdById },
    );

    // Income record for the Income screen
    await this.prisma.financeEntry.create({
      data: {
        code: `INC-${code.split("-").pop()}`,
        kind: "INCOME",
        date: issueDate,
        ref: code,
        partyName: invoice.tenant.name,
        category: input.category,
        amount: D(total),
        groupId: input.groupId,
        status: input.prepaid ? "RECEIVED" : "PENDING",
        createdById: input.createdById,
      },
    }).catch(() => undefined); // denormalized convenience row; never block invoicing

    // Render + store the PDF, link fileId
    await this.renderPdf(invoice.id).catch((e) => console.error("[invoice] PDF render failed:", e));

    // Domain event → automation rules (extra PDF, notify agent, …) decide the rest.
    this.events.emit(
      EV.INVOICE_GENERATED,
      buildEvent(EV.INVOICE_GENERATED, {
        tenantId: input.tenantId, companyId: input.tenantId,
        entityType: "Invoice", entityId: invoice.id,
        title: `Invoice ${code}`,
        data: { invoiceNo: code, total, prepaid: input.prepaid ?? false, groupId: input.groupId },
      }),
    );
    return this.get(invoice.id);
  }

  async renderPdf(invoiceId: string) {
    const inv = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { items: true, tenant: { select: { name: true, city: true, country: true } }, group: { select: { code: true } } },
    });
    if (!inv) throw new NotFoundException("Invoice not found");
    const bytes = await this.docs.invoicePdf({
      docNo: inv.code,
      issueDate: inv.issueDate,
      dueDate: inv.dueDate,
      billTo: inv.tenant.name,
      billToAddr: inv.tenant.city ? `${inv.tenant.city}, ${inv.tenant.country ?? "Saudi Arabia"}` : undefined,
      groupCode: inv.group?.code ?? null,
      items: inv.items.map((it) => ({ desc: it.description, qty: it.qty, unit: Number(it.unitPrice), total: Number(it.total) })),
      subtotal: Number(inv.subtotal),
      vatRate: Number(inv.vatRate),
      vatAmount: Number(inv.vatAmount),
      total: Number(inv.total),
    });
    const stored = await this.storage.store(`${inv.code}.pdf`, Buffer.from(bytes), "application/pdf");
    const file = await this.prisma.uploadedFile.create({
      data: {
        bucket: stored.bucket,
        storageKey: stored.storageKey,
        fileName: `${inv.code}.pdf`,
        mimeType: "application/pdf",
        sizeBytes: bytes.length,
        kind: "INVOICE",
        companyId: inv.tenantId,
        meta: { invoiceId: inv.id, invoiceNo: inv.code },
      },
    });
    await this.prisma.invoice.update({ where: { id: inv.id }, data: { fileId: file.id } });
    return file.id;
  }

  // ── receipts / mark paid ─────────────────────────────────────────────────────
  /**
   * Record a receipt against an invoice (settles AR, posts cash GL). Fully
   * atomic + row-locked: the invoice is `SELECT … FOR UPDATE` locked so two
   * concurrent mark-paid calls can't each create a full-balance receipt, and
   * the receipt + allocation + status + GL journal all commit together.
   */
  async markPaid(invoiceId: string, opts: { method?: string; bankRef?: string; createdById?: string } = {}) {
    const code = await this.uniqueCode("REC");
    const result = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string; status: string; total: Prisma.Decimal; tenantId: string; groupId: string | null; ledgerCode: string }>>`
        SELECT i.id, i.status, i.total, i."tenantId", i."groupId", i.code AS "ledgerCode"
        FROM "Invoice" i WHERE i.id = ${invoiceId} FOR UPDATE
      `;
      if (!locked.length) throw new NotFoundException("Invoice not found");
      const inv = locked[0];
      if (inv.status === "PAID" || inv.status === "CANCELLED") return { skipped: true };

      const alloc = await tx.receiptAllocation.aggregate({ where: { invoiceId }, _sum: { amount: true } });
      const alreadyPaid = Number(alloc._sum.amount ?? 0);
      const balanceDue = money(Number(inv.total) - alreadyPaid);
      if (balanceDue <= 0) {
        await tx.invoice.update({ where: { id: invoiceId }, data: { status: "PAID" } });
        return { skipped: true };
      }

      const receipt = await tx.receipt.create({
        data: {
          code,
          companyId: inv.tenantId,
          date: new Date(),
          amount: D(balanceDue),
          method: (opts.method as never) ?? "BANK_TRANSFER",
          bankRef: opts.bankRef,
          status: "CONFIRMED",
        },
      });
      await tx.receiptAllocation.create({ data: { receiptId: receipt.id, invoiceId, amount: D(balanceDue) } });
      await tx.invoice.update({ where: { id: invoiceId }, data: { status: "PAID" } });

      // GL inside the same transaction: debit Cash, credit AR
      await this.ledger.postJournal(
        [
          { accountCode: ACCT.CASH_MAIN, debit: balanceDue, description: `Receipt ${code}` },
          { accountCode: ACCT.AR_AGENTS, credit: balanceDue, description: `AR settlement ${inv.ledgerCode}` },
        ],
        { ref: code, groupId: inv.groupId, createdById: opts.createdById },
        tx,
      );
      await tx.financeEntry.updateMany({ where: { ref: inv.ledgerCode, kind: "INCOME" }, data: { status: "RECEIVED" } });
      return { skipped: false };
    });
    // Audit the financial transaction (skip a no-op re-pay).
    if (!result.skipped) {
      await this.prisma.auditLog.create({
        data: {
          actorUserId: opts.createdById, action: "PROCESS", module: "Finance",
          entityType: "Invoice", entityId: invoiceId,
          after: { paid: true, method: opts.method ?? "BANK_TRANSFER", bankRef: opts.bankRef ?? null },
        },
      }).catch(() => undefined);
    }
    return this.get(invoiceId);
  }

  async receipts(filters: { companyId?: string } = {}) {
    const rows = await this.prisma.receipt.findMany({
      where: filters.companyId ? { companyId: filters.companyId } : {},
      include: {
        company: { select: { name: true, city: true, country: true } },
        allocations: { include: { invoice: { select: { code: true } } } },
      },
      orderBy: { date: "desc" },
      take: 200,
    });
    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      from: r.company.name,
      fromAddr: r.company.city ? `${r.company.city}, ${r.company.country ?? "Saudi Arabia"}` : "",
      date: r.date,
      amount: money(r.amount),
      method: r.method,
      bankRef: r.bankRef,
      applies: r.allocations.map((a) => a.invoice.code).join(" + "),
      status: r.status,
    }));
  }
}
