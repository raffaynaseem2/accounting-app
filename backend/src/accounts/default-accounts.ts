import { AccountType, Prisma, SubledgerType, SystemAccountKey } from "@prisma/client";

type DefaultAccount = {
  name: string;
  type: AccountType;
  systemKey: SystemAccountKey;
  subledgerType: SubledgerType;
};

export const DEFAULT_ACCOUNTS: DefaultAccount[] = [
  { name: "Accounts Receivable", type: "ASSET", systemKey: "AR", subledgerType: "CUSTOMER" },
  { name: "Accounts Payable", type: "LIABILITY", systemKey: "AP", subledgerType: "SUPPLIER" },
  { name: "Sales Revenue", type: "REVENUE", systemKey: "SALES_REVENUE", subledgerType: "NONE" },
  { name: "General Expense", type: "EXPENSE", systemKey: "GENERAL_EXPENSE", subledgerType: "NONE" },
  { name: "Opening Balance Equity", type: "EQUITY", systemKey: "OPENING_BALANCE_EQUITY", subledgerType: "NONE" },
];

/** Idempotently create the core system accounts every user needs. */
export async function ensureDefaultAccounts(tx: Prisma.TransactionClient, userId: string) {
  for (const account of DEFAULT_ACCOUNTS) {
    const existing = await tx.account.findFirst({
      where: { userId, systemKey: account.systemKey },
    });
    if (existing) continue;
    await tx.account.create({
      data: {
        userId,
        name: account.name,
        type: account.type,
        systemKey: account.systemKey,
        subledgerType: account.subledgerType,
      },
    });
  }
}

/** Asset accounts suitable for bank/cash payment lines — excludes control accounts. */
export function isLiquidAssetAccount(account: {
  type: string;
  subledgerType: string;
  systemKey: string | null;
}) {
  return account.type === "ASSET" && account.subledgerType === "NONE" && !account.systemKey;
}
