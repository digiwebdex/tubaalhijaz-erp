import { ServiceRequestStatus, SupplierType, VoucherType } from "@prisma/client";

/** The five bookable service pipelines. */
export type ServiceKey = "visa" | "hotel" | "transport" | "catering" | "additional";
export const SERVICE_KEYS: ServiceKey[] = ["visa", "hotel", "transport", "catering", "additional"];

export const SERVICE_META: Record<
  ServiceKey,
  {
    model: "visaRequest" | "hotelBooking" | "transportBooking" | "cateringBooking" | "additionalServiceRequest";
    codePrefix: string;
    label: string;
    voucherType?: VoucherType;
    voucherSuffix?: string;
    supplierType?: SupplierType; // routable to a supplier?
  }
> = {
  visa: { model: "visaRequest", codePrefix: "REQ-V", label: "Visa Batch" },
  hotel: {
    model: "hotelBooking", codePrefix: "HTL", label: "Hotel Booking",
    voucherType: "HOTEL", voucherSuffix: "HOT", supplierType: "HOTEL",
  },
  transport: {
    model: "transportBooking", codePrefix: "TRN", label: "Transport Booking",
    voucherType: "TRANSPORT", voucherSuffix: "TRA", supplierType: "TRANSPORT",
  },
  catering: {
    model: "cateringBooking", codePrefix: "CAT", label: "Catering Order",
    voucherType: "CATERING", voucherSuffix: "CAT", supplierType: "CATERING",
  },
  additional: { model: "additionalServiceRequest", codePrefix: "SVC", label: "Additional Service" },
};

/**
 * Master-plan pipeline: Requested → Sent to Supplier (ASSIGNED) →
 * Accepted (CONFIRMED) / Rejected → Voucher Issued → Completed.
 * REJECTED → ASSIGNED allows re-routing to another supplier.
 */
export const SERVICE_TRANSITIONS: Record<ServiceRequestStatus, ServiceRequestStatus[]> = {
  REQUESTED: ["ASSIGNED", "CANCELLED"],
  ASSIGNED: ["CONFIRMED", "REJECTED", "CANCELLED"],
  CONFIRMED: ["VOUCHER_ISSUED", "COMPLETED", "CANCELLED"],
  VOUCHER_ISSUED: ["COMPLETED", "CANCELLED"],
  REJECTED: ["ASSIGNED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

/** Catering plan pricing (SAR / pax / day) — mirrors the Agent Portal UI. */
export const CATERING_PLAN_PRICE: Record<string, number> = {
  BREAKFAST_ONLY: 35,
  HALF_BOARD: 85,
  FULL_BOARD: 140,
  PREMIUM: 200,
};
