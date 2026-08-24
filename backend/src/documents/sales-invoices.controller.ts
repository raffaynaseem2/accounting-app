import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { SalesInvoicesService } from "./sales-invoices.service";

@UseGuards(AuthGuard)
@Controller("sales-invoices")
export class SalesInvoicesController {
  constructor(private readonly service: SalesInvoicesService) {}
  private businessId(request: any) { if (!request.appUser) throw new ForbiddenException("User is not linked to a business"); return request.appUser.businessId; }
  @Get() list(@Req() request: any) { return this.service.list(this.businessId(request)); }
  @Get(":id") get(@Req() request: any, @Param("id") id: string) { return this.service.get(this.businessId(request), id); }
  @Post() create(@Req() request: any, @Body() body: any) { return this.service.create(this.businessId(request), body); }
  @Patch(":id") update(@Req() request: any, @Param("id") id: string, @Body() body: any) { return this.service.update(this.businessId(request), id, body); }
  @Delete(":id") remove(@Req() request: any, @Param("id") id: string) { return this.service.remove(this.businessId(request), id); }
}
