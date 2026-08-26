import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { DashboardService } from "./dashboard.service";

@UseGuards(AuthGuard)
@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get("summary")
  summary(@Req() request: any) {
    return this.dashboardService.summary(request.authUserId);
  }
}
