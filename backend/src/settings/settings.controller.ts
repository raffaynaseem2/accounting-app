import { Body, Controller, ForbiddenException, Get, Patch, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { SettingsService } from "./settings.service";
@UseGuards(AuthGuard)
@Controller("settings")
export class SettingsController {
  constructor(private readonly service: SettingsService) {}
  private businessId(request: any) { if (!request.appUser) throw new ForbiddenException("User is not linked to a business"); return request.appUser.businessId; }
  @Get("business") getBusiness(@Req() request: any) { return this.service.getBusiness(this.businessId(request)); }
  @Patch("business") updateBusiness(@Req() request: any, @Body() body: any) { return this.service.updateBusiness(this.businessId(request), body); }
}
