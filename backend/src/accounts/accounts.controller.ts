import {
  Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Query, Req, UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { AccountsService } from "./accounts.service";

@UseGuards(AuthGuard)
@Controller("accounts")
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  private businessId(request: any) {
    if (!request.appUser) throw new ForbiddenException("User is not linked to a business");
    return request.appUser.businessId;
  }

  @Get()
  list(@Req() request: any) { return this.accountsService.list(this.businessId(request)); }

  @Post()
  create(@Req() request: any, @Body() body: any) {
    return this.accountsService.create(this.businessId(request), body);
  }

  @Patch(":id")
  update(@Req() request: any, @Param("id") id: string, @Body() body: any) {
    return this.accountsService.update(this.businessId(request), id, body);
  }

  @Delete(":id")
  remove(@Req() request: any, @Param("id") id: string) {
    return this.accountsService.remove(this.businessId(request), id);
  }

  @Get(":id/balance")
  balance(@Req() request: any, @Param("id") id: string) {
    return this.accountsService.getAccountBalance(id, this.businessId(request));
  }

  @Get(":id/ledger")
  ledger(
    @Req() request: any,
    @Param("id") id: string,
    @Query("customerId") customerId?: string,
    @Query("supplierId") supplierId?: string,
  ) {
    return this.accountsService.getLedger(id, this.businessId(request), { customerId, supplierId });
  }
}
