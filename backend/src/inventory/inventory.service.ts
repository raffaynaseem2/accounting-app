import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InventoryMovementReason, ItemType, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

type ItemInput = {
  name?: string;
  type?: ItemType;
  productCode?: string | null;
  description?: string | null;
  unitCost?: number | string | null;
  unitPrice?: number | string | null;
  quantityOnHand?: number | string | null;
};

type MovementInput = {
  quantity?: number | string;
  reason?: InventoryMovementReason;
  referenceId?: string | null;
  movementDate?: string | Date;
};

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  listItems(userId: string, type?: ItemType) {
    return this.prisma.item.findMany({
      where: { userId, ...(type ? { type } : {}) },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    });
  }

  private decimal(value: number | string | null | undefined, field: string) {
    if (value === null || value === undefined || value === "") return null;
    try {
      const result = new Prisma.Decimal(value);
      if (!result.isFinite()) throw new Error();
      return result;
    } catch {
      throw new BadRequestException(`${field} must be a valid number`);
    }
  }

  private async nextProductCode(tx: Prisma.TransactionClient, userId: string) {
    const count = await tx.item.count({ where: { userId } });
    return `ITEM-${String(count + 1).padStart(6, "0")}`;
  }

  async createItem(userId: string, input: ItemInput) {
    const name = input.name?.trim();
    if (!name) throw new BadRequestException("Item name is required");
    if (input.type !== "GOOD" && input.type !== "SERVICE") {
      throw new BadRequestException("Item type must be GOOD or SERVICE");
    }
    const itemType = input.type as ItemType;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const productCode = input.productCode?.trim() || await this.nextProductCode(tx, userId);
        const unitCost = this.decimal(input.unitCost, "Unit cost");
        const unitPrice = this.decimal(input.unitPrice, "Unit price");
        const startingQuantity = itemType === "GOOD"
          ? this.decimal(input.quantityOnHand, "Quantity on hand") ?? new Prisma.Decimal(0)
          : null;

        const item = await tx.item.create({
          data: {
            userId,
            name,
            type: itemType,
            productCode,
            description: input.description?.trim() || null,
            unitCost,
            unitPrice,
            quantityOnHand: startingQuantity,
          },
        });

        if (startingQuantity && !startingQuantity.eq(0)) {
          await tx.inventoryMovement.create({
            data: {
              userId,
              itemId: item.id,
              quantity: startingQuantity,
              reason: "OPENING_BALANCE",
            },
          });
        }
        return item;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("Product code already exists for this user");
      }
      throw error;
    }
  }

  async updateItem(userId: string, id: string, input: ItemInput & { isActive?: boolean }) {
    const existing = await this.prisma.item.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException("Item not found");
    if (input.type && input.type !== existing.type) {
      throw new BadRequestException("An item type cannot be changed after creation");
    }
    const name = input.name === undefined ? undefined : input.name.trim();
    if (name === "") throw new BadRequestException("Item name is required");

    try {
      return await this.prisma.item.update({
        where: { id },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(input.productCode !== undefined ? { productCode: input.productCode?.trim() || existing.productCode } : {}),
          ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
          ...(input.unitCost !== undefined ? { unitCost: this.decimal(input.unitCost, "Unit cost") } : {}),
          ...(input.unitPrice !== undefined ? { unitPrice: this.decimal(input.unitPrice, "Unit price") } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("Product code already exists for this user");
      }
      throw error;
    }
  }

  async deactivateItem(userId: string, id: string) {
    return this.updateItem(userId, id, { isActive: false });
  }

  async removeItem(userId: string, id: string) {
    return this.deactivateItem(userId, id);
  }

  async recordMovement(userId: string, itemId: string, input: MovementInput) {
    const quantity = this.decimal(input.quantity, "Movement quantity");
    if (!quantity || quantity.eq(0)) throw new BadRequestException("Movement quantity cannot be zero");
    if (!input.reason || !["OPENING_BALANCE", "PURCHASE", "SALE", "MANUAL_ADJUSTMENT"].includes(input.reason)) {
      throw new BadRequestException("Invalid movement reason");
    }
    const reason = input.reason as InventoryMovementReason;
    const movementDate = input.movementDate ? new Date(input.movementDate) : new Date();
    if (Number.isNaN(movementDate.getTime())) throw new BadRequestException("Movement date must be valid");

    return this.prisma.$transaction(async (tx) => {
      const item = await tx.item.findFirst({ where: { id: itemId, userId } });
      if (!item) throw new NotFoundException("Item not found");
      if (item.type === "SERVICE") return { item, movement: null };

      const signedQuantity = reason === "PURCHASE" || reason === "OPENING_BALANCE"
        ? quantity.abs()
        : reason === "SALE" ? quantity.abs().neg() : quantity;
      const movement = await tx.inventoryMovement.create({
        data: {
          userId,
          itemId,
          quantity: signedQuantity,
          reason,
          referenceId: input.referenceId?.trim() || null,
          movementDate,
        },
      });
      const updatedItem = await tx.item.update({
        where: { id: itemId },
        data: { quantityOnHand: (item.quantityOnHand ?? new Prisma.Decimal(0)).plus(signedQuantity) },
      });
      return { item: updatedItem, movement };
    });
  }

  async listMovements(userId: string, itemId: string) {
    const item = await this.prisma.item.findFirst({ where: { id: itemId, userId } });
    if (!item) throw new NotFoundException("Item not found");
    return this.prisma.inventoryMovement.findMany({
      where: { userId, itemId },
      orderBy: { movementDate: "desc" },
    });
  }

  listAllMovements(userId: string) {
    return this.prisma.inventoryMovement.findMany({ where: { userId }, include: { item: true }, orderBy: { movementDate: "desc" } });
  }

  async getActivity(userId: string, itemId: string) {
    const item = await this.prisma.item.findFirst({
      where: { id: itemId, userId },
      include: {
        movements: { orderBy: { movementDate: "desc" } },
        salesInvoiceLines: { include: { invoice: { include: { customer: true } } }, orderBy: { invoice: { issueDate: "desc" } } },
        purchaseBillLines: { include: { bill: { include: { supplier: true } } }, orderBy: { bill: { billDate: "desc" } } },
      },
    });
    if (!item) throw new NotFoundException("Item not found");
    return item;
  }
}
