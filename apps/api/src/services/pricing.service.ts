import { Injectable } from "@nestjs/common";
import { AdditionalServiceType, MohCategory, TripType, VehicleType, VisaType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

const VAT_RATE = 0.15;

export interface PricingResult {
  rateCardId: string;
  currency: string;
  unitPrice: number;
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
}

/**
 * B-10 pricing resolver. Reads the ACTIVE, effective-dated rate card for a
 * service and computes the price. Prices are NEVER hardcoded here — they come
 * only from the rate-card masters. Callers snapshot the returned amounts onto
 * the booking at creation, so a later rate-card change never alters a historical
 * booking/invoice. Returns null when no active rate matches (booking stays
 * unpriced until a rate exists or staff overrides).
 */
@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  private activeWhere() {
    const now = new Date();
    return { active: true, effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }] };
  }

  private compute(rate: { id: string; currency: string; price: unknown }, qty: number): PricingResult {
    const unitPrice = Number(rate.price);
    const subtotal = +(unitPrice * Math.max(0, qty)).toFixed(2);
    const vatAmount = +(subtotal * VAT_RATE).toFixed(2);
    const totalAmount = +(subtotal + vatAmount).toFixed(2);
    return { rateCardId: rate.id, currency: rate.currency, unitPrice, subtotal, vatAmount, totalAmount };
  }

  async priceTransport(p: { vehicleType: VehicleType; tripType: TripType; vehicleCount: number }): Promise<PricingResult | null> {
    const rate = await this.prisma.transportRate.findFirst({
      where: { vehicleType: p.vehicleType, tripType: p.tripType, ...this.activeWhere() },
      orderBy: { effectiveFrom: "desc" },
    });
    if (!rate) return null;
    const qty = rate.unit === "PER_TRIP" ? 1 : Math.max(1, p.vehicleCount);
    return this.compute(rate, qty);
  }

  async priceVisa(p: { visaType: VisaType; visaCategory: MohCategory | null; country?: string | null; pax: number }): Promise<PricingResult | null> {
    const base = { visaType: p.visaType, country: p.country ?? "SA", processingType: "NORMAL" as const, ...this.activeWhere() };
    // category-specific rate wins over the general (null-category) rate
    let rate = p.visaCategory
      ? await this.prisma.visaRate.findFirst({ where: { ...base, visaCategory: p.visaCategory }, orderBy: { effectiveFrom: "desc" } })
      : null;
    if (!rate) rate = await this.prisma.visaRate.findFirst({ where: { ...base, visaCategory: null }, orderBy: { effectiveFrom: "desc" } });
    if (!rate) return null;
    return this.compute(rate, Math.max(1, p.pax));
  }

  async priceAdditional(p: { serviceType: AdditionalServiceType; beneficiaries: number }): Promise<PricingResult | null> {
    const rate = await this.prisma.additionalServiceRate.findFirst({
      where: { serviceType: p.serviceType, ...this.activeWhere() },
      orderBy: { effectiveFrom: "desc" },
    });
    if (!rate) return null;
    const qty = rate.unit === "PER_SERVICE" ? 1 : Math.max(1, p.beneficiaries);
    return this.compute(rate, qty);
  }
}
