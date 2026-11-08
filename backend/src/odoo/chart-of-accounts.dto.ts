import { AccountType, Prisma } from "@prisma/client";

export type OdooAccountDto = {
  odooAccountId: string;
  code: string | null;
  name: string;
  odooAccountType: string;
  type: AccountType;
  odooBalance: Prisma.Decimal | null;
};

export type OdooAccountTransformResult = {
  account?: OdooAccountDto;
  reason?: string;
};
