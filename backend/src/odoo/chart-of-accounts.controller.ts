import { Controller, ForbiddenException, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { ChartOfAccountsService } from "./chart-of-accounts.service";

@UseGuards(AuthGuard)
@Controller("sync")
export class ChartOfAccountsController {
  constructor(private readonly chartOfAccounts: ChartOfAccountsService) {}

  @Post("chart-of-accounts")
  sync(@Req() request: any) {
    if (request.appUser?.role !== "ADMIN") throw new ForbiddenException("Only administrators can sync the Chart of Accounts");
    return this.chartOfAccounts.sync(request.authUserId);
  }
}
