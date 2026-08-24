import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get("me")
  @UseGuards(AuthGuard)
  me(@Req() request: any) {
    if (!request.appUser) throw new UnauthorizedException("User is not linked to a business");
    return {
      role: request.appUser.role,
      business: { id: request.appUser.business.id, name: request.appUser.business.name },
    };
  }

  @Post("bootstrap")
  @UseGuards(AuthGuard)
  async bootstrap(
    @Req() request: any,
    @Body() body: { businessName?: string },
  ) {
    const authUserId = request.authUserId;

    if (!authUserId) {
      throw new UnauthorizedException();
    }

    return this.authService.bootstrapUser(
      authUserId,
      body.businessName ?? "",
    );
  }
}
