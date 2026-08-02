import { Prisma } from "@prisma/client";

/** All money is SAR Decimal(14,2). Helpers keep rounding + coercion consistent. */
export const D = (v: number | string | Prisma.Decimal): Prisma.Decimal =>
  v instanceof Prisma.Decimal ? v : new Prisma.Decimal(v);

/** Round to 2dp (SAR minor units) as a number for JSON responses. */
export const money = (v: number | string | Prisma.Decimal | null | undefined): number =>
  v == null ? 0 : Math.round(Number(v) * 100) / 100;

export const VAT_RATE = 0.15;
export const ZAKAT_RATE = 0.025;

export const vatOf = (subtotal: number) => Math.round(subtotal * VAT_RATE * 100) / 100;
