import { Prisma } from "@prisma/client";
import { transformOdooAccount, transformOdooAccounts } from "./chart-of-accounts.transformer";

describe("chart of accounts transformer", () => {
  it.each([
    ["asset_cash", "ASSET"],
    ["asset_current", "ASSET"],
    ["asset_receivable", "ASSET"],
    ["liability_payable", "LIABILITY"],
    ["liability_current", "LIABILITY"],
    ["equity", "EQUITY"],
    ["equity_unaffected", "EQUITY"],
    ["income", "REVENUE"],
    ["income_other", "REVENUE"],
    ["expense", "EXPENSE"],
    ["expense_direct_cost", "EXPENSE"],
    ["expense_depreciation", "EXPENSE"],
  ])("maps Odoo type %s to Ledgerly type %s", (accountType, expectedType) => {
    const result = transformOdooAccount({ id: 12, code: "4000", name: "Sales", account_type: accountType, current_balance: "12.3400" });

    expect(result.account?.type).toBe(expectedType);
  });

  it("preserves balances as exact Prisma decimals", () => {
    const result = transformOdooAccount({ id: 12, code: "1000", name: "Cash", account_type: "asset_cash", current_balance: "1000000000.1234" });

    expect(result.account?.odooBalance).toBeInstanceOf(Prisma.Decimal);
    expect(result.account?.odooBalance?.toFixed(4)).toBe("1000000000.1234");
  });

  it("returns null when Odoo does not provide a current balance", () => {
    const result = transformOdooAccount({ id: 12, code: null, name: "Cash", account_type: "asset_cash", current_balance: null });

    expect(result.account?.odooBalance).toBeNull();
  });

  it("skips unsupported or malformed rows instead of misclassifying them", () => {
    const result = transformOdooAccounts([
      { id: 1, code: "1000", name: "Cash", account_type: "asset_cash", current_balance: 10 },
      { id: 2, code: "9000", name: "Memo", account_type: "off_balance", current_balance: 20 },
      { id: "bad", code: "9001", name: "Invalid", account_type: "asset_cash", current_balance: 20 },
    ]);

    expect(result.accounts).toHaveLength(1);
    expect(result.skipped).toHaveLength(2);
  });
});
