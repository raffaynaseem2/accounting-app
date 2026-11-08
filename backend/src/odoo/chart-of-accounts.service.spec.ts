import { ChartOfAccountsService } from "./chart-of-accounts.service";

describe("ChartOfAccountsService", () => {
  const odoo = { executeKw: jest.fn() };
  const account = { findUnique: jest.fn(), upsert: jest.fn() };
  const prisma = { account, $transaction: jest.fn() };
  let service: ChartOfAccountsService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((callback: (tx: typeof prisma) => unknown) => callback(prisma));
    odoo.executeKw.mockResolvedValue([
      { id: 1, code: "1000", name: "Cash", account_type: "asset_cash", current_balance: "12.3400" },
      { id: 2, code: "4000", name: "Sales", account_type: "income", current_balance: "8.0000" },
    ]);
    account.findUnique.mockResolvedValue(null);
    account.upsert.mockImplementation(({ create }: { create: unknown }) => Promise.resolve(create));
    service = new ChartOfAccountsService(prisma as never, odoo as never);
  });

  it("requests only the selected CoA fields and globally upserts accounts", async () => {
    const result = await service.sync("admin-user");

    expect(odoo.executeKw).toHaveBeenCalledWith(
      "account.account",
      "search_read",
      [[]],
      { fields: ["id", "code", "name", "account_type", "current_balance"], order: "code asc" },
    );
    expect(account.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { odooAccountId: "1" },
      create: expect.objectContaining({ userId: null, isGlobal: true, odooAccountId: "1", type: "ASSET" }),
      update: expect.objectContaining({ userId: null, isGlobal: true, odooAccountType: "asset_cash" }),
    }));
    expect(result).toMatchObject({ fetched: 2, created: 2, updated: 0, skipped: 0 });
  });

  it("does not delete or deactivate accounts missing from Odoo", async () => {
    odoo.executeKw.mockResolvedValue([]);

    await expect(service.sync("admin-user")).resolves.toMatchObject({ fetched: 0, skipped: 0 });
    expect(account).not.toHaveProperty("deleteMany");
  });
});
