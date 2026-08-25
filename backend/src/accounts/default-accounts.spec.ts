import { DEFAULT_ACCOUNTS, ensureDefaultAccounts } from "./default-accounts";

describe("ensureDefaultAccounts", () => {
  it("defines the core system accounts", () => {
    expect(DEFAULT_ACCOUNTS.map((a) => a.systemKey)).toEqual([
      "AR",
      "AP",
      "SALES_REVENUE",
      "GENERAL_EXPENSE",
      "OPENING_BALANCE_EQUITY",
    ]);
  });

  it("creates only missing default accounts", async () => {
    const created: string[] = [];
    const tx = {
      account: {
        findFirst: jest.fn(async ({ where }: any) =>
          where.systemKey === "AR" ? { id: "ar-1" } : null,
        ),
        create: jest.fn(async ({ data }: any) => {
          created.push(data.systemKey);
        }),
      },
    };

    await ensureDefaultAccounts(tx as any, "user-1");

    expect(created).toEqual(["AP", "SALES_REVENUE", "GENERAL_EXPENSE", "OPENING_BALANCE_EQUITY"]);
  });
});
