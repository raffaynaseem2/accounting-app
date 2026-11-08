import { AccountType, Prisma } from "@prisma/client";
import { OdooAccountDto, OdooAccountTransformResult } from "./chart-of-accounts.dto";

type RawOdooAccount = {
  id?: unknown;
  code?: unknown;
  name?: unknown;
  account_type?: unknown;
  current_balance?: unknown;
};

const ACCOUNT_TYPE_MAP: Record<string, AccountType> = {
  asset_cash: "ASSET",
  asset_current: "ASSET",
  asset_non_current: "ASSET",
  asset_fixed: "ASSET",
  asset_receivable: "ASSET",
  asset_prepayments: "ASSET",
  liability_current: "LIABILITY",
  liability_non_current: "LIABILITY",
  liability_payable: "LIABILITY",
  equity: "EQUITY",
  equity_unaffected: "EQUITY",
  income: "REVENUE",
  income_other: "REVENUE",
  expense: "EXPENSE",
  expense_direct_cost: "EXPENSE",
  expense_depreciation: "EXPENSE",
};

function parseBalance(value: unknown): Prisma.Decimal | null {
  if (value === null || value === undefined || value === "") return null;
  try {
    const decimal = new Prisma.Decimal(value as Prisma.Decimal.Value);
    return decimal.isFinite() ? decimal : null;
  } catch {
    return null;
  }
}

export function transformOdooAccount(raw: RawOdooAccount): OdooAccountTransformResult {
  if (!Number.isInteger(raw.id) || (raw.id as number) <= 0) return { reason: "missing or invalid Odoo account id" };
  if (typeof raw.name !== "string" || !raw.name.trim()) return { reason: "missing Odoo account name" };
  if (typeof raw.account_type !== "string" || !ACCOUNT_TYPE_MAP[raw.account_type]) return { reason: `unsupported Odoo account type: ${String(raw.account_type)}` };

  const account: OdooAccountDto = {
    odooAccountId: String(raw.id),
    code: typeof raw.code === "string" && raw.code.trim() ? raw.code.trim() : null,
    name: raw.name.trim(),
    odooAccountType: raw.account_type,
    type: ACCOUNT_TYPE_MAP[raw.account_type],
    odooBalance: parseBalance(raw.current_balance),
  };
  return { account };
}

export function transformOdooAccounts(rows: unknown[]): { accounts: OdooAccountDto[]; skipped: string[] } {
  const accounts: OdooAccountDto[] = [];
  const skipped: string[] = [];
  for (const row of rows) {
    const result = transformOdooAccount((row ?? {}) as RawOdooAccount);
    if (result.account) accounts.push(result.account);
    else skipped.push(result.reason ?? "invalid Odoo account row");
  }
  return { accounts, skipped };
}
