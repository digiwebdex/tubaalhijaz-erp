import { Module } from "@nestjs/common";
import { FinanceController } from "./finance.controller";
import { AgentFinanceController } from "./agent-finance.controller";
import { LedgerService } from "./ledger.service";
import { WalletService } from "./wallet.service";
import { CurrencyService } from "./currency.service";
import { InvoiceService } from "./invoice.service";
import { ReportsService } from "./reports.service";
import { FinanceEntriesService } from "./finance-entries.service";
import { PaymentSlipService } from "./payment-slip.service";
import { FinanceDocService } from "./finance-doc.service";

@Module({
  controllers: [FinanceController, AgentFinanceController],
  providers: [
    LedgerService,
    WalletService,
    CurrencyService,
    InvoiceService,
    ReportsService,
    FinanceEntriesService,
    PaymentSlipService,
    FinanceDocService,
  ],
  // WalletService + InvoiceService are consumed by ServicesModule for the
  // auto-deduct-on-confirmation and auto-invoice-on-completion hooks.
  exports: [WalletService, InvoiceService, LedgerService, ReportsService],
})
export class FinanceModule {}
