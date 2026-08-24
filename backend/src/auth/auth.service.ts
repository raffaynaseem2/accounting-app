import {
  ConflictException,
  Injectable,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ensureDefaultAccounts } from "../accounts/default-accounts";

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async bootstrapUser(authUserId: string, businessName: string) {
    try {
      const appUser = await this.prisma.$transaction(async (tx) => {
        const existingUser = await tx.appUser.findUnique({
          where: { authUserId },
          include: { business: true },
        });

        if (existingUser) {
          await ensureDefaultAccounts(tx, existingUser.businessId);
          return existingUser;
        }

        const cleanedName = businessName.trim();

        if (cleanedName.length < 2 || cleanedName.length > 100) {
          throw new ConflictException(
            "Business name must be between 2 and 100 characters",
          );
        }

        const business = await tx.business.create({
          data: { name: cleanedName },
        });

        await ensureDefaultAccounts(tx, business.id);

        return tx.appUser.create({
          data: {
            authUserId,
            businessId: business.id,
            role: "ADMIN",
          },
          include: { business: true },
        });
      });

      return this.toSafeResponse(appUser);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const existingUser = await this.prisma.appUser.findUnique({
          where: { authUserId },
          include: { business: true },
        });

        if (existingUser) {
          await this.prisma.$transaction(async (tx) => {
            await ensureDefaultAccounts(tx, existingUser.businessId);
          });
          return this.toSafeResponse(existingUser);
        }
      }

      throw error;
    }
  }

  private toSafeResponse(appUser: any) {
    return {
      id: appUser.id,
      authUserId: appUser.authUserId,
      role: appUser.role,
      business: {
        id: appUser.business.id,
        name: appUser.business.name,
      },
    };
  }
}
