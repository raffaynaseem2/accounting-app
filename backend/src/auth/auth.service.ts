import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ensureDefaultAccounts } from "../accounts/default-accounts";

@Injectable()
export class AuthService {
  private readonly userCache = new Map<string, Prisma.AppUserGetPayload<{}>>();
  private readonly provisioning = new Map<string, Promise<Prisma.AppUserGetPayload<{}>>>();

  constructor(private readonly prisma: PrismaService) {}

  async ensureUser(authUserId: string) {
    const cached = this.userCache.get(authUserId);
    if (cached) return cached;

    // A restarted instance may not have this user in memory yet. This lookup
    // is read-only and avoids opening a transaction for established users.
    const existing = await this.prisma.appUser.findUnique({ where: { authUserId } });
    if (existing) {
      this.userCache.set(authUserId, existing);
      return existing;
    }

    const pending = this.provisioning.get(authUserId);
    if (pending) return pending;

    const provision = this.provisionUser(authUserId)
      .then((user) => {
        this.userCache.set(authUserId, user);
        return user;
      })
      .finally(() => this.provisioning.delete(authUserId));

    this.provisioning.set(authUserId, provision);
    return provision;
  }

  private async provisionUser(authUserId: string) {
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
