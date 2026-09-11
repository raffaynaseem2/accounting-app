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
  const existing = await tx.account.findMany({
    where: { userId, systemKey: { in: DEFAULT_ACCOUNTS.map((account) => account.systemKey) } },
    select: { systemKey: true },
  });
  const existingKeys = new Set(existing.map((account) => account.systemKey));
  const missing = DEFAULT_ACCOUNTS.filter((account) => !existingKeys.has(account.systemKey));
  if (!missing.length) return;

  await tx.account.createMany({
    data: missing.map((account) => ({
      userId,
      name: account.name,
      type: account.type,
      systemKey: account.systemKey,
      subledgerType: account.subledgerType,
    })),
    skipDuplicates: true,
  });
}

/** Asset accounts suitable for bank/cash payment lines — excludes control accounts. */
export function isLiquidAssetAccount(account: {
  type: string;
  subledgerType: string;
  systemKey: string | null;
}) {
  return account.type === "ASSET" && account.subledgerType === "NONE" && !account.systemKey;
}
