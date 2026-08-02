import { Injectable, NotFoundException, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { tenantContext } from "../common/tenant-context";

/**
 * Which field scopes each model, per company type.
 * AGENT users → rows where the tenant/company field = their company.
 * SUPPLIER users → rows assigned to them (supplierId) + their own finance rows.
 * Models absent from the map are passthrough (they are protected by
 * permission gates instead — e.g. Company, User, Season, catalogs).
 */
const AGENT_SCOPE: Record<string, string> = {
  Group: "tenantId",
  Passenger: "tenantId",
  FlightInfo: "tenantId",
  Ticket: "groupId", // via group — handled as passthrough check below (groupId not a company field)
  VisaRequest: "tenantId",
  HotelBooking: "tenantId",
  TransportBooking: "tenantId",
  CateringBooking: "tenantId",
  AdditionalServiceRequest: "tenantId",
  BRN: "tenantId",
  Voucher: "tenantId",
  ZiyarahTrip: "tenantId",
  DispatchOrder: "tenantId",
  OcrDocument: "tenantId",
  Invoice: "tenantId",
  NotificationLog: "tenantId",
  Wallet: "companyId",
  PaymentSlip: "companyId",
  Receipt: "companyId",
  Statement: "companyId",
  LedgerEntry: "companyId",
};
// Ticket has no direct tenant column — exclude it from auto-scoping (service layer
// must query tickets through their group). Remove to avoid a wrong filter:
delete AGENT_SCOPE.Ticket;

const SUPPLIER_SCOPE: Record<string, string> = {
  // Suppliers own no groups or passengers, so scoping these on tenantId
  // resolves to "none" — which is the point. Without these entries the map
  // returned undefined for Group/Passenger and the extension PASSED THROUGH,
  // letting a supplier list every agency's groups and their pilgrim manifests.
  // Supplier screens get group context via `include` on their own bookings
  // (see supplier.controller.ts), which is unaffected by this.
  //
  // The SAME fail-open leak applied to every other agent-owned model that a
  // supplier can reach through an unguarded shared controller: ServicesController
  // (`GET /services/:service`, `GET /services/summary`, `GET /vouchers`) has no
  // role gate, so a supplier could list every agency's visa batches, additional
  // service requests and issued vouchers. Map ALL agent-owned models to
  // "tenantId" here — for a supplier that resolves to "none" (fail CLOSED),
  // while their own hotel/transport/catering bookings stay scoped by supplierId.
  Group: "tenantId",
  Passenger: "tenantId",
  FlightInfo: "tenantId",
  VisaRequest: "tenantId",
  AdditionalServiceRequest: "tenantId",
  BRN: "tenantId",
  Voucher: "tenantId",
  ZiyarahTrip: "tenantId",
  DispatchOrder: "tenantId",
  OcrDocument: "tenantId",
  Invoice: "tenantId",
  HotelBooking: "supplierId",
  TransportBooking: "supplierId",
  CateringBooking: "supplierId",
  Hotel: "supplierId",
  Vehicle: "supplierId",
  Driver: "supplierId",
  NotificationLog: "tenantId",
  Wallet: "companyId",
  PaymentSlip: "companyId",
  Receipt: "companyId",
  Statement: "companyId",
  LedgerEntry: "companyId",
};

const WHERE_OPS = new Set([
  "findMany",
  "findFirst",
  "findFirstOrThrow",
  "count",
  "aggregate",
  "groupBy",
  "updateMany",
  "deleteMany",
]);
const UNIQUE_OPS = new Set(["findUnique", "findUniqueOrThrow", "update", "delete"]);

function scopeFieldFor(model: string): string | undefined {
  const store = tenantContext.getStore();
  if (!store?.userId || !store.companyId) return undefined; // unauthenticated/public or platform staff → passthrough
  const map = store.companyType === "SUPPLIER" ? SUPPLIER_SCOPE : AGENT_SCOPE;
  return map[model];
}

function buildExtendedClient(base: PrismaClient) {
  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const field = scopeFieldFor(model as string);
          if (!field) return query(args);
          const companyId = tenantContext.getStore()!.companyId as string;
          const a = (args ?? {}) as Record<string, unknown>;

          if (WHERE_OPS.has(operation)) {
            a.where = { AND: [a.where ?? {}, { [field]: companyId }] };
            return query(a as never);
          }

          if (UNIQUE_OPS.has(operation)) {
            // Unique lookups can't take extra filters — run, then post-check ownership.
            const result = (await query(a as never)) as Record<string, unknown> | null;
            if (result && result[field] !== companyId) {
              if (operation === "findUnique") return null;
              throw new NotFoundException();
            }
            return result;
          }

          if (operation === "create") {
            // Force ownership on tenant-scoped creates.
            a.data = { ...(a.data as object), [field]: companyId };
            return query(a as never);
          }
          if (operation === "createMany") {
            const data = (a.data as Array<Record<string, unknown>>).map((row) => ({
              ...row,
              [field]: companyId,
            }));
            a.data = data;
            return query(a as never);
          }

          return query(a as never);
        },
      },
    },
  });
}

/**
 * `prisma` (this service itself) = UNSCOPED base client — for auth, system jobs,
 * and admin flows that legitimately cross tenants.
 * `prisma.scoped` = tenant-scoped client — the default choice inside request
 * handlers; automatically restricted by the AsyncLocalStorage context.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  readonly scoped: ReturnType<typeof buildExtendedClient> = buildExtendedClient(this);

  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
