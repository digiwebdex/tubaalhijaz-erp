import { ServiceKey } from "../services/service-types";

/** Chart-of-accounts codes the finance engine posts against (see prisma/seed.ts). */
export const ACCT = {
  CASH_MAIN: "1001", // Cash — Al Rajhi
  AR_AGENTS: "1200", // Accounts Receivable — Agents
  AP_SUPPLIERS: "2101", // Accounts Payable — Suppliers
  VAT_PAYABLE: "2201", // VAT Payable
  AGENT_ADVANCES: "2300", // Agent Advance Payments
} as const;

/** Revenue account per bookable service. */
export const REVENUE_ACCT: Record<ServiceKey, string> = {
  visa: "4001",
  hotel: "4002",
  transport: "4003",
  catering: "4004",
  additional: "4005",
};

/** COGS account per service (supplier settlement postings). */
export const COGS_ACCT: Record<ServiceKey, string> = {
  visa: "5004",
  hotel: "5001",
  transport: "5002",
  catering: "5003",
  additional: "5001",
};

export const REVENUE_CATEGORY: Record<ServiceKey, string> = {
  visa: "Visa Services",
  hotel: "Hotel Services",
  transport: "Transport Svcs",
  catering: "Catering Svcs",
  additional: "Other Services",
};
