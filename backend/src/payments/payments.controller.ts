import { Body, Controller, Delete, ForbiddenException, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { PaymentsService } from "./payments.service";

@UseGuards(AuthGuard)
@Controller("payments")
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}
  private businessId(request: any) { if (!request.appUser) throw new ForbiddenException("User is not linked to a business"); return request.appUser.businessId; }
  @Get() list(@Req() request: any) { return this.service.list(this.businessId(request)); }
  @Post() create(@Req() request: any, @Body() body: any) { return this.service.create(this.businessId(request), body); }
  @Delete(":id") remove(@Req() request: any, @Param("id") id: string) { return this.service.remove(this.businessId(request), id); }
}
