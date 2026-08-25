import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "./auth.guard";

@Controller("auth")
export class AuthController {
  @Get("me")
  @UseGuards(AuthGuard)
  me(@Req() request: any) {
    return { userId: request.authUserId, role: request.appUser?.role ?? "ADMIN" };
  }
}
