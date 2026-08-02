import { Module } from "@nestjs/common";
import { ServicesController } from "./services.controller";
import { SupplierController } from "./supplier.controller";
import { ServicesService } from "./services.service";
import { VoucherGeneratorService } from "./voucher-generator.service";
import { FinanceModule } from "../finance/finance.module";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [
    FinanceModule, // WalletService (auto-deduct) + InvoiceService (auto-invoice)
    NotificationsModule, // voucher / reject → tuba-notify via dispatch (S2-03)
  ],
  controllers: [ServicesController, SupplierController],
  providers: [ServicesService, VoucherGeneratorService],
  exports: [ServicesService], // AutomationModule's GENERATE_VOUCHER job calls ensureVoucher()
})
export class ServicesModule {}
