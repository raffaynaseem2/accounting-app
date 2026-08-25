import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { SalesInvoicesService } from "./sales-invoices.service";

@UseGuards(AuthGuard)
@Controller("sales-invoices")
export class SalesInvoicesController {
  constructor(private readonly service: SalesInvoicesService) {}
  private userId(request: any) { return request.authUserId; }
  @Get() list(@Req() request: any) { return this.service.list(this.userId(request)); }
  @Get(":id") get(@Req() request: any, @Param("id") id: string) { return this.service.get(this.userId(request), id); }
  @Post() create(@Req() request: any, @Body() body: any) { return this.service.create(this.userId(request), body); }
  @Patch(":id") update(@Req() request: any, @Param("id") id: string, @Body() body: any) { return this.service.update(this.userId(request), id, body); }
  @Delete(":id") remove(@Req() request: any, @Param("id") id: string) { return this.service.remove(this.userId(request), id); }
}
