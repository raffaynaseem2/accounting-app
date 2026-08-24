import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { PurchaseBillsController } from "./purchase-bills.controller";
import { PurchaseBillsService } from "./purchase-bills.service";
import { SalesInvoicesController } from "./sales-invoices.controller";
import { SalesInvoicesService } from "./sales-invoices.service";
import { DocumentAccountingService } from "./document-accounting.service";

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [SalesInvoicesController, PurchaseBillsController],
  providers: [SalesInvoicesService, PurchaseBillsService, DocumentAccountingService],
})
export class DocumentsModule {}
