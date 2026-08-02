import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PaymentSlipType, PaymentSlipPurpose } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { WalletService } from "./wallet.service";
import { LedgerService } from "./ledger.service";
import { ACCT } from "./accounts";
import { D, money } from "./money";

export interface CreateSlipDto {
  type: PaymentSlipType;
  purpose?: PaymentSlipPurpose;
  amount: number;
  bank?: string;
  transferRef?: string;
  paymentDate?: string;
  groupId?: string;
  notes?: string;
}

/**
 * Agent uploads a bank-transfer / cheque slip to credit their wallet. Slips land
 * PENDING; a finance-staff review CONFIRMS them, which atomically credits the
 * wallet (top-up) and stamps the reviewer. Wallet only ever moves on confirm.
 */
@Injectable()
export class PaymentSlipService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly wallet: WalletService,
    private readonly ledger: LedgerService,
  ) {}

  private async uniqueCode(): Promise<string> {
    for (let i = 0; i < 12; i++) {
      const code = `SLP-${String(1000 + Math.floor(Math.random() * 9000))}`;
      if (!(await this.prisma.paymentSlip.findUnique({ where: { code } }))) return code;
    }
    throw new BadRequestException("Could not allocate a slip code");
  }

  async create(companyId: string, dto: CreateSlipDto, file?: Express.Multer.File) {
    if (dto.amount <= 0) throw new BadRequestException("Amount must be positive");
    let fileUrl: string | undefined;
    if (file) {
      const stored = await this.storage.store(file.originalname || "slip.pdf", file.buffer, file.mimetype);
      fileUrl = `${stored.bucket}/${stored.storageKey}`;
    }
    let groupId: string | null = null;
    if (dto.groupId) {
      const g = await this.prisma.group.findFirst({ where: { OR: [{ id: dto.groupId }, { code: dto.groupId }] }, select: { id: true } });
      groupId = g?.id ?? null;
    }
    const slip = await this.prisma.paymentSlip.create({
      data: {
        code: await this.uniqueCode(),
        companyId,
        purpose: dto.purpose ?? "WALLET_TOPUP",
        type: dto.type,
        amount: D(dto.amount),
        bank: dto.bank,
        transferRef: dto.transferRef,
        paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
        groupId,
        notes: dto.notes,
        fileUrl,
        status: "PENDING",
      },
    });
    return this.shape(slip);
  }

  async list(companyId: string) {
    const rows = await this.prisma.paymentSlip.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return rows.map((s) => this.shape(s));
  }

  /** Finance-staff review. CONFIRMED credits the agent wallet exactly once. */
  async review(slipId: string, decision: "CONFIRMED" | "REJECTED", reviewerId: string) {
    const slip = await this.prisma.paymentSlip.findUnique({ where: { id: slipId } });
    if (!slip) throw new NotFoundException("Payment slip not found");
    if (slip.status !== "PENDING") throw new BadRequestException(`Slip already ${slip.status}`);

    await this.prisma.paymentSlip.update({
      where: { id: slipId },
      data: { status: decision, reviewedById: reviewerId, reviewedAt: new Date() },
    });
    if (decision === "CONFIRMED") {
      const amount = money(slip.amount);
      await this.wallet.credit(slip.companyId, amount, {
        refType: "PaymentSlip",
        refId: slip.id,
        description: `Wallet top-up — ${slip.code}`,
        ref: slip.code,
        createdById: reviewerId,
      });
      // GL: cash received creates the agent-advance liability that a prepaid
      // invoice later consumes (Dr Cash / Cr Agent Advance Payments).
      await this.ledger
        .postJournal(
          [
            { accountCode: ACCT.CASH_MAIN, debit: amount, description: `Top-up ${slip.code}` },
            { accountCode: ACCT.AGENT_ADVANCES, credit: amount, description: "Agent advance received" },
          ],
          { ref: slip.code, createdById: reviewerId },
        )
        .catch((e) => console.error("[payment-slip] GL post failed:", e));
    }
    await this.prisma.auditLog.create({
      data: {
        actorUserId: reviewerId, action: decision === "CONFIRMED" ? "APPROVE" : "REJECT",
        module: "Finance", entityType: "PaymentSlip", entityId: slipId,
        after: { code: slip.code, decision, amount: Number(slip.amount) },
      },
    }).catch(() => undefined);
    return this.shape(await this.prisma.paymentSlip.findUniqueOrThrow({ where: { id: slipId } }));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private shape(s: any) {
    return {
      id: s.id,
      ref: s.code,
      date: s.paymentDate,
      type: s.type,
      amount: money(s.amount),
      bank: s.bank,
      transferRef: s.transferRef,
      status: s.status.toLowerCase(),
    };
  }
}
