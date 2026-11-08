import { Prisma } from "@prisma/client";

export function visibleAccountWhere(userId: string): Prisma.AccountWhereInput {
  return { OR: [{ userId }, { isGlobal: true }] };
}
