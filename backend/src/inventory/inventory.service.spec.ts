import { Prisma } from "@prisma/client";
import { InventoryService } from "./inventory.service";

describe("InventoryService", () => {
  it("increases stock for a purchase and allows negative stock", async () => {
    const tx = {
      item: {
        findFirst: jest.fn().mockResolvedValue({ id: "item-a", type: "GOOD", quantityOnHand: new Prisma.Decimal(2) }),
        update: jest.fn().mockResolvedValue({ id: "item-a", quantityOnHand: 7 }),
      },
      inventoryMovement: { create: jest.fn().mockResolvedValue({ quantity: 5 }) },
    } as any;
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) } as any;
    const service = new InventoryService(prisma);

    await service.recordMovement("user-a", "item-a", { quantity: 5, reason: "PURCHASE" });
    expect(tx.inventoryMovement.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ quantity: expect.anything(), reason: "PURCHASE" }) }));
    expect(tx.item.update).toHaveBeenCalled();
  });

  it("does not create a movement for a service item", async () => {
    const tx = {
      item: { findFirst: jest.fn().mockResolvedValue({ id: "service-a", type: "SERVICE", quantityOnHand: null }) },
      inventoryMovement: { create: jest.fn() },
      itemUpdate: jest.fn(),
    } as any;
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) } as any;
    const service = new InventoryService(prisma);

    const result = await service.recordMovement("user-a", "service-a", { quantity: 5, reason: "SALE" });
    expect(result.movement).toBeNull();
    expect(tx.inventoryMovement.create).not.toHaveBeenCalled();
  });
});
