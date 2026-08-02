import { BadRequestException, Injectable } from "@nestjs/common";
import { CurrencyCode } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { D } from "./money";

/**
 * Multi-currency with SAR as the base. Every rate is stored as "1 unit of
 * currency = X SAR" (rateToSar). SAR itself is implicitly 1.0. Conversion goes
 * through SAR: amount_in_to = amount_in_from × rateToSar(from) / rateToSar(to).
 */
@Injectable()
export class CurrencyService {
  constructor(private readonly prisma: PrismaService) {}

  /** Latest rate for each currency (most recent asOf), SAR pinned at 1.0. */
  async latestRates() {
    const rows = await this.prisma.currencyRate.findMany({ orderBy: { asOf: "desc" } });
    const seen = new Map<CurrencyCode, { currency: CurrencyCode; rateToSar: number; asOf: Date }>();
    for (const r of rows) {
      if (!seen.has(r.currency)) {
        seen.set(r.currency, { currency: r.currency, rateToSar: Number(r.rateToSar), asOf: r.asOf });
      }
    }
    if (!seen.has("SAR")) {
      seen.set("SAR", { currency: "SAR", rateToSar: 1, asOf: new Date() });
    }
    // stable display order
    const order: CurrencyCode[] = ["SAR", "USD", "BDT", "EUR", "GBP", "TRY"];
    return order.filter((c) => seen.has(c)).map((c) => seen.get(c)!);
  }

  private async rateToSar(currency: CurrencyCode): Promise<number> {
    if (currency === "SAR") return 1;
    const row = await this.prisma.currencyRate.findFirst({
      where: { currency },
      orderBy: { asOf: "desc" },
    });
    if (!row) throw new BadRequestException(`No exchange rate for ${currency}`);
    return Number(row.rateToSar);
  }

  async convert(amount: number, from: CurrencyCode, to: CurrencyCode) {
    const [fromRate, toRate] = await Promise.all([this.rateToSar(from), this.rateToSar(to)]);
    const converted = (amount * fromRate) / toRate;
    return {
      amount,
      from,
      to,
      rate: fromRate / toRate,
      converted: Math.round(converted * 10000) / 10000,
      asOf: new Date(),
    };
  }

  /** Convert any SAR amount to a display currency (dashboards / statements). */
  async toDisplay(amountSar: number, display: CurrencyCode) {
    if (display === "SAR") return amountSar;
    const rate = await this.rateToSar(display);
    return Math.round((amountSar / rate) * 100) / 100;
  }

  async upsertRate(currency: CurrencyCode, rateToSar: number, asOf?: Date) {
    if (rateToSar <= 0) throw new BadRequestException("Rate must be positive");
    const at = asOf ?? new Date();
    return this.prisma.currencyRate.upsert({
      where: { currency_asOf: { currency, asOf: at } },
      update: { rateToSar: D(rateToSar) },
      create: { currency, rateToSar: D(rateToSar), asOf: at },
    });
  }
}
