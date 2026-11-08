import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { OdooService } from "./odoo.service";
import { ChartOfAccountsService } from "./chart-of-accounts.service";
import { ChartOfAccountsController } from "./chart-of-accounts.controller";

@Module({
  imports: [PrismaModule],
  controllers: [ChartOfAccountsController],
  providers: [OdooService, ChartOfAccountsService],
  exports: [OdooService],
})
export class OdooModule {}
