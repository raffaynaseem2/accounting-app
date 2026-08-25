import { Prisma } from "@prisma/client";
import { SalesInvoicesService } from "./sales-invoices.service";

describe("SalesInvoicesService", () => {
  it("creates a sale movement only for goods", async () => {
    const tx = {
      customer: { findFirst: jest.fn().mockResolvedValue({ id: "customer-a" }) },
      item: {
        findMany: jest.fn().mockResolvedValue([{ id: "good-a", name: "Widget", productCode: "ITEM-1", type: "GOOD", unitPrice: new Prisma.Decimal(10), quantityOnHand: new Prisma.Decimal(5) }]),
        findFirst: jest.fn().mockResolvedValue({ id: "good-a", type: "GOOD", quantityOnHand: new Prisma.Decimal(5) }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: "good-a", quantityOnHand: new Prisma.Decimal(5) }),
        update: jest.fn(),
      },
      salesInvoice: { count: jest.fn().mockResolvedValue(0), create: jest.fn().mockResolvedValue({ id: "invoice-a" }) },
      inventoryMovement: { findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn(), create: jest.fn() },
    } as any;
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) } as any;
    const accounting = { syncInvoice: jest.fn() } as any;
    const service = new SalesInvoicesService(prisma, accounting);

    await service.create("user-a", { customerId: "customer-a", lines: [{ itemId: "good-a", quantity: 2, unitPrice: 10 }] });
    expect(tx.inventoryMovement.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ reason: "SALE" }) }));
  });
});
