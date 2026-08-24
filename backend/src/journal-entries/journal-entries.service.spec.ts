import { ConflictException } from "@nestjs/common";
import { JournalEntriesService } from "./journal-entries.service";

describe("JournalEntriesService", () => {
  it("rejects an unbalanced entry", async () => {
    const tx = {
      account: { findMany: jest.fn().mockResolvedValue([{ id: "cash" }, { id: "sales" }]) },
    } as any;
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) } as any;
    const service = new JournalEntriesService(prisma);

    await expect(service.create("business-a", {
      description: "Unbalanced",
      lines: [
        { accountId: "cash", side: "DEBIT", amount: 100 },
        { accountId: "sales", side: "CREDIT", amount: 90 },
      ],
    })).rejects.toBeInstanceOf(ConflictException);
  });
});
