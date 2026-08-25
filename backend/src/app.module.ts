import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { ExpensesModule } from "./expenses/expenses.module";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { AccountsModule } from "./accounts/accounts.module";
import { JournalEntriesModule } from "./journal-entries/journal-entries.module";
import { InventoryModule } from "./inventory/inventory.module";
import { DocumentsModule } from "./documents/documents.module";
import { PartiesModule } from "./parties/parties.module";
import { PaymentsModule } from "./payments/payments.module";


@Module({
  imports: [AuthModule, PrismaModule, ExpensesModule, AccountsModule, JournalEntriesModule, InventoryModule, DocumentsModule, PartiesModule, PaymentsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
