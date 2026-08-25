import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { AccountsService } from "./accounts.service";

@UseGuards(AuthGuard)
@Controller("accounts")
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  private userId(request: any) {
    return request.authUserId;
  }

  @Get()
  list(@Req() request: any) { return this.accountsService.list(this.userId(request)); }

  @Post()
  create(@Req() request: any, @Body() body: any) {
    return this.accountsService.create(this.userId(request), body);
  }

  @Patch(":id")
  update(@Req() request: any, @Param("id") id: string, @Body() body: any) {
    return this.accountsService.update(this.userId(request), id, body);
  }

  @Delete(":id")
  remove(@Req() request: any, @Param("id") id: string) {
    return this.accountsService.remove(this.userId(request), id);
  }

  @Get(":id/balance")
  balance(@Req() request: any, @Param("id") id: string) {
    return this.accountsService.getAccountBalance(id, this.userId(request));
  }

  @Get(":id/ledger")
  ledger(
    @Req() request: any,
    @Param("id") id: string,
    @Query("customerId") customerId?: string,
    @Query("supplierId") supplierId?: string,
  ) {
    return this.accountsService.getLedger(id, this.userId(request), { customerId, supplierId });
  }
}
