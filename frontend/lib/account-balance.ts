export type AccountType = "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";

const CREDIT_NORMAL_TYPES = new Set<AccountType>(["REVENUE", "LIABILITY", "EQUITY"]);

/** Accounts that increase with credits; raw GL balance is debits minus credits. */
export function isCreditNormalAccount(type: string): boolean {
  return CREDIT_NORMAL_TYPES.has(type as AccountType);
}

/** Flip sign for credit-normal accounts so positive balances read naturally in the UI. */
export function displayAccountBalance(rawBalance: unknown, accountType: string): number {
  const n = Number(rawBalance) || 0;
  return isCreditNormalAccount(accountType) ? n * -1 : n;
}

/** Running balance from debit/credit columns (debits minus credits). */
export function displayRunningBalance(rawRunning: number, accountType: string): number {
  return displayAccountBalance(rawRunning, accountType);
}
