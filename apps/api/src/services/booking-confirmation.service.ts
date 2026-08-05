import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { PrismaService } from "../prisma/prisma.service";
import { WalletService } from "../finance/wallet.service";
import { AuthUser } from "../common/decorators/current-user.decorator";
import { EV, buildEvent } from "../automation/events";
import { SERVICE_META, ServiceKey } from "./service-types";

type CreditDecision = "PREPAID"; // extensible: add "NET30" in resolveCreditDecision()

/**
 * B-11 - the ONE canonical booking-confirmation workflow. Both the supplier
 * accept path and the staff transition path call confirm(), so the accounting
 * result is IDENTICAL: same wallet-prepaid deduction, same events, same audit.
 * Wallet-prepaid is the default; insufficient balance throws (no silent confirm).
 * A future Corporate Credit / Net-30 model slots into resolveCreditDecision()
 * WITHOUT changing this confirmation logic.
 */
@Injectable()
export class BookingConfirmationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly events: EventEmitter2,
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async resolveCreditDecision(_tenantId: string): Promise<CreditDecision> {
    return "PREPAID";
  }

  async confirm(service: ServiceKey, id: string, actor: AuthUser) {
    const meta = SERVICE_META[service];
    const model = meta.model;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = await (this.prisma as any)[model].findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Booking not found");
    if (row.status !== "ASSIGNED") {
      throw new BadRequestException(`Only ASSIGNED bookings can be confirmed (current: ${row.status})`);
    }
    const amount = row.totalAmount ? Number(row.totalAmount) : 0;
    const decision = await this.resolveCreditDecision(row.tenantId);

    // Prepaid: require sufficient wallet balance BEFORE confirming (no silent confirm).
    if (decision === "PREPAID" && amount > 0) {
      const bal = await this.wallet.balance(row.tenantId);
      if (bal.balance < amount) {
        throw new BadRequestException(
          `Insufficient wallet balance: SAR ${bal.balance.toFixed(2)} available, SAR ${amount.toFixed(2)} required. Top up the wallet or arrange credit terms.`,
        );
      }
    }

    // Atomic single-winner flip ASSIGNED -> CONFIRMED.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const flipped = await (this.prisma as any)[model].updateMany({
      where: { id, status: "ASSIGNED" },
      data: { status: "CONFIRMED", statusReason: null },
    });
    if (flipped.count !== 1) throw new BadRequestException("Booking is no longer awaiting confirmation");

    // Wallet-prepaid deduction (idempotent on refType+refId+DEBIT).
    let charged = { charged: false, amount: 0 };
    if (decision === "PREPAID" && amount > 0) {
      charged = await this.wallet.autoDeductForBooking(row.tenantId, amount, {
        refType: model,
        refId: id,
        description: `${meta.label} - ${row.code}`,
        groupId: row.groupId,
        createdById: actor.sub,
      });
    }

    // Identical audit + domain events for BOTH confirmation paths.
    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.sub,
        action: "APPROVE",
        module: "BookingConfirmation",
        entityType: model,
        entityId: id,
        before: { status: "ASSIGNED" } as never,
        after: { status: "CONFIRMED", charged: charged.amount, creditDecision: decision } as never,
      },
    });
    const evData = { service, status: "CONFIRMED", from: "ASSIGNED", code: row.code, bookingId: id, groupId: row.groupId };
    this.events.emit(EV.SERVICE_STATUS_CHANGED, buildEvent(EV.SERVICE_STATUS_CHANGED, { tenantId: row.tenantId, entityType: model, entityId: id, title: `${row.code} confirmed`, data: evData }));
    this.events.emit(EV.BOOKING_CONFIRMED, buildEvent(EV.BOOKING_CONFIRMED, { tenantId: row.tenantId, entityType: model, entityId: id, title: `Booking ${row.code} confirmed`, data: evData }));

    return { status: "CONFIRMED" as const, charged: charged.amount, creditDecision: decision };
  }
}
