import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { LedgerService } from "./ledger.service";
import { D, money } from "./money";

export interface DeductOptions {
  refType: string; // e.g. "HotelBooking"
  refId: string;
  description: string;
  groupId?: string | null;
  createdById?: string | null;
}

/**
 * Agent prepaid wallet. `Wallet.balance` is the authoritative figure but every
 * mutation happens inside a transaction that (1) takes a `SELECT … FOR UPDATE`
 * row lock so concurrent deductions can't double-spend, (2) writes a
 * WalletTransaction with `balanceAfter` for an immutable audit trail, and
 * (3) posts the matching AGENT sub-ledger line. Deductions are idempotent by
 * (refType, refId), so a retried service-confirmation never charges twice.
 */
@Injectable()
export class WalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
  ) {}

  private async walletFor(companyId: string) {
    const wallet = await this.prisma.wallet.findUnique({ where: { companyId } });
    if (wallet) return wallet;
    return this.prisma.wallet.create({ data: { companyId } });
  }

  async balance(companyId: string) {
    const wallet = await this.walletFor(companyId);
    // pending charges = outstanding invoices billed to this agent
    const pending = await this.prisma.invoice.aggregate({
      where: { tenantId: companyId, status: { in: ["OUTSTANDING", "OVERDUE"] } },
      _sum: { total: true },
    });
    const pendingOut = money(pending._sum.total);
    const balance = money(wallet.balance);
    return {
      companyId,
      balance,
      currency: wallet.currency,
      pendingCharges: pendingOut,
      afterPending: money(balance - pendingOut),
      updatedAt: wallet.updatedAt,
    };
  }

  async transactions(companyId: string, limit = 100) {
    const wallet = await this.walletFor(companyId);
    const txns = await this.prisma.walletTransaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return txns.map((t) => ({
      id: t.id,
      direction: t.direction,
      amount: money(t.amount),
      balanceAfter: money(t.balanceAfter),
      description: t.description,
      refType: t.refType,
      refId: t.refId,
      createdAt: t.createdAt,
    }));
  }

  /** Credit the wallet (confirmed top-up / payment slip). */
  async credit(companyId: string, amount: number, opts: DeductOptions & { ref?: string }) {
    if (amount <= 0) throw new BadRequestException("Amount must be positive");
    return this.mutate(companyId, amount, "CREDIT", opts);
  }

  /** Debit the wallet (service charge). Allowed to go negative (recorded as debt). */
  async deduct(companyId: string, amount: number, opts: DeductOptions) {
    if (amount <= 0) throw new BadRequestException("Amount must be positive");
    return this.mutate(companyId, amount, "DEBIT", opts);
  }

  /**
   * Auto-deduct a booking's total on supplier confirmation. Idempotent: a second
   * call for the same (refType, refId) is a no-op. Returns {charged, amount}.
   */
  async autoDeductForBooking(
    companyId: string,
    amount: number,
    opts: DeductOptions,
  ): Promise<{ charged: boolean; amount: number }> {
    if (!amount || amount <= 0) return { charged: false, amount: 0 };
    const existing = await this.prisma.walletTransaction.findFirst({
      where: { refType: opts.refType, refId: opts.refId, direction: "DEBIT" },
    });
    if (existing) return { charged: false, amount: money(existing.amount) };
    await this.deduct(companyId, amount, opts);
    return { charged: true, amount: money(amount) };
  }

  // ── locked mutation ──────────────────────────────────────────────────────────
  private async mutate(
    companyId: string,
    amount: number,
    direction: "CREDIT" | "DEBIT",
    opts: DeductOptions & { ref?: string },
  ) {
    await this.walletFor(companyId); // ensure a row exists before locking
    return this.prisma.$transaction(async (tx) => {
      // row lock: serialize concurrent mutations for this wallet. A racing
      // request blocks HERE until the first commits, so its in-lock dedupe
      // (below) sees the committed txn — no double-charge.
      const locked = await tx.$queryRaw<Array<{ id: string; balance: Prisma.Decimal }>>`
        SELECT id, balance FROM "Wallet" WHERE "companyId" = ${companyId} FOR UPDATE
      `;
      if (!locked.length) throw new NotFoundException("Wallet not found");
      const walletId = locked[0].id;

      // In-lock idempotency recheck: if this (refType, refId, direction) is
      // already recorded, this call is a no-op replay — return the existing row.
      const dup = await tx.walletTransaction.findFirst({
        where: { walletId, refType: opts.refType, refId: opts.refId, direction },
      });
      if (dup) {
        return { id: dup.id, balanceAfter: money(dup.balanceAfter), direction, amount: money(dup.amount) };
      }

      const current = Number(locked[0].balance);
      const next = direction === "CREDIT" ? current + amount : current - amount;

      await tx.wallet.update({ where: { id: walletId }, data: { balance: D(next) } });
      const txn = await tx.walletTransaction.create({
        data: {
          walletId,
          direction,
          amount: D(amount),
          balanceAfter: D(next),
          description: opts.description,
          refType: opts.refType,
          refId: opts.refId,
        },
      });
      // mirror into the AGENT sub-ledger (top-ups credit, charges debit)
      await this.ledger.postSubLedger(
        "AGENT",
        companyId,
        {
          description: opts.description,
          ref: opts.ref ?? txn.id,
          groupId: opts.groupId ?? null,
          debit: direction === "DEBIT" ? amount : 0,
          credit: direction === "CREDIT" ? amount : 0,
          createdById: opts.createdById ?? null,
        },
        tx,
      );
      return { id: txn.id, balanceAfter: money(next), direction, amount: money(amount) };
    });
  }
}
