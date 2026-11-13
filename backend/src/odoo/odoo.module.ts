import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { OdooService } from "./odoo.service";
import { ChartOfAccountsService } from "./chart-of-accounts.service";
import { ChartOfAccountsController } from "./chart-of-accounts.controller";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ChartOfAccountsController],
  providers: [OdooService, ChartOfAccountsService],
  exports: [OdooService],
})
export class OdooModule {}
