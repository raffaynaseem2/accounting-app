import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { verifyToken } from "@clerk/backend";
import { PrismaService } from "../prisma/prisma.service";
import { ensureDefaultAccounts } from "../accounts/default-accounts";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const header = request.headers.authorization;

    if (!header?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing bearer token");
    }

    const token = header.substring("Bearer ".length);

    let claims: Awaited<ReturnType<typeof verifyToken>>;
    try {
      claims = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY,
      });
    } catch {
      throw new UnauthorizedException("Invalid bearer token");
    }

    const authUserId = claims.sub;
    if (!authUserId) throw new UnauthorizedException("Invalid bearer token");
    request.authUserId = authUserId;
    request.appUser = await this.prisma.$transaction(async (tx) => {
      const user = await tx.appUser.upsert({
        where: { authUserId },
        create: { authUserId, role: "ADMIN" },
        update: {},
      });
      await ensureDefaultAccounts(tx, authUserId);
      return user;
    });
    return true;
  }
}
