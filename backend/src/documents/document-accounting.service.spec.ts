import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { DocumentAccountingService } from "./document-accounting.service";

describe("DocumentAccountingService", () => {
  const service = new DocumentAccountingService();

  it("returns 400 when bill accounts are missing", async () => {
    const tx = {
      account: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
    };

    await expect(service.resolveBillAccounts(tx as any, "business-1")).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.resolveBillAccounts(tx as any, "business-1")).rejects.toThrow(
      "Configure active Accounts Payable and General Expense accounts before saving a bill",
    );
  });

  it("posts bill debits to General Expense for goods and services", async () => {
    const ap = { id: "ap-1" };
    const generalExpense = { id: "exp-1" };
    const created: any[] = [];

    const tx = {
      account: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(ap)
          .mockResolvedValueOnce(generalExpense)
          .mockResolvedValueOnce(ap)
          .mockResolvedValueOnce(generalExpense),
        create: jest.fn(),
      },
      journalEntry: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(async ({ data }: any) => {
          created.push(data);
        }),
        delete: jest.fn(),
      },
    };

    jest.spyOn(service as any, "resolveBillAccounts").mockResolvedValue({ ap, generalExpense });

    await service.syncBill(
      tx as any,
      "business-1",
      "bill-1",
      "supplier-1",
      [
        { item: { id: "good-1", type: "GOOD" }, lineTotal: new Prisma.Decimal(60) },
        { item: { id: "svc-1", type: "SERVICE" }, lineTotal: new Prisma.Decimal(40) },
      ],
      "BILL-000001",
    );

    const lines = created[0].lines.create;
    expect(lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ accountId: "exp-1", side: "DEBIT" }),
        expect.objectContaining({ accountId: "ap-1", side: "CREDIT", supplierId: "supplier-1" }),
      ]),
    );
  });
});
