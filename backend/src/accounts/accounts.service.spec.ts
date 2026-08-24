import { AccountsService } from "./accounts.service";

describe("AccountsService", () => {
  it("creates a general-ledger account without a party record", async () => {
    const prisma = { account: { create: jest.fn().mockResolvedValue({ id: "cash" }) } } as any;
    const service = new AccountsService(prisma);
    await service.create("business-a", { name: "Cash", type: "ASSET" });
    expect(prisma.account.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ name: "Cash", type: "ASSET", subledgerType: "NONE" }) }));
  });
});
