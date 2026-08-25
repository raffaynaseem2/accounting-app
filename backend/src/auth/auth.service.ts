import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ensureDefaultAccounts } from "../accounts/default-accounts";

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureUser(authUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.appUser.upsert({
        where: { authUserId },
        create: { authUserId, role: "ADMIN" },
        update: {},
      });
      await ensureDefaultAccounts(tx, authUserId);
      return user;
    });
  }
}
