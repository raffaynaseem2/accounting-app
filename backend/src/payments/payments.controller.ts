import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { PaymentsService } from "./payments.service";

@UseGuards(AuthGuard)
@Controller("payments")
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}
  private userId(request: any) { return request.authUserId; }
  @Get() list(@Req() request: any) { return this.service.list(this.userId(request)); }
  @Post() create(@Req() request: any, @Body() body: any) { return this.service.create(this.userId(request), body); }
  @Delete(":id") remove(@Req() request: any, @Param("id") id: string) { return this.service.remove(this.userId(request), id); }
}
