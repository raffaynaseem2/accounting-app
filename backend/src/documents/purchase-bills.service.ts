import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { deleteSourceJournal } from "../journal/journal-cleanup";
import { PrismaService } from "../prisma/prisma.service";
import { DocumentAccountingService } from "./document-accounting.service";

type LineInput = { itemId?: string; quantity?: number | string; unitCost?: number | string };
type BillInput = {
  supplierId?: string;
  billNumber?: string;
  billDate?: string;
  notes?: string;
  lines?: LineInput[];
};

type NormalizedLine = {
  item: { id: string; name: string; productCode: string; type: string };
  quantity: Prisma.Decimal;
  unitCost: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
};

@Injectable()
export class PurchaseBillsService {
  private readonly logger = new Logger(PurchaseBillsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accounting: DocumentAccountingService,
  ) {}

  private decimal(value: number | string | undefined, field: string) {
    try {
      const result = new Prisma.Decimal(value ?? 0);
      if (!result.isFinite() || result.lte(0)) throw new Error();
      return result;
    } catch {
      throw new BadRequestException(`${field} must be greater than zero`);
    }
  }

  private async nextNumber(tx: Prisma.TransactionClient, userId: string) {
    const count = await tx.purchaseBill.count({ where: { userId } });
    return `BILL-${String(count + 1).padStart(6, "0")}`;
  }

  private async normalizedLines(
    tx: Prisma.TransactionClient,
    userId: string,
    lines: LineInput[],
  ): Promise<NormalizedLine[]> {
    if (!lines?.length) throw new BadRequestException("At least one bill line is required");

    const ids = lines.map((line) => line.itemId).filter(Boolean) as string[];
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException("An item may appear only once per bill");
    }

    const items = await tx.item.findMany({
      where: { userId, id: { in: ids }, isActive: true },
    });
    if (items.length !== ids.length) {
      throw new BadRequestException("Every bill item must be active and belong to this user");
    }

    return lines.map((line) => {
      if (!line.itemId) throw new BadRequestException("Every line needs an item");
      const item = items.find((candidate) => candidate.id === line.itemId)!;
      const quantity = this.decimal(line.quantity, "Quantity");
      const unitCost = this.decimal(line.unitCost ?? item.unitCost?.toString(), "Unit cost");
      return { item, quantity, unitCost, lineTotal: quantity.mul(unitCost) };
    });
  }

  private async replaceMovements(
    tx: Prisma.TransactionClient,
    userId: string,
    billId: string,
    lines: NormalizedLine[],
  ) {
    const old = await tx.inventoryMovement.findMany({ where: { userId, referenceId: billId } });
    for (const movement of old) {
      const item = await tx.item.findFirst({ where: { id: movement.itemId, userId } });
      if (item?.type === "GOOD") {
        await tx.item.update({
          where: { id: item.id },
          data: {
            quantityOnHand: new Prisma.Decimal(item.quantityOnHand ?? 0).minus(movement.quantity),
          },
        });
      }
    }
    await tx.inventoryMovement.deleteMany({ where: { userId, referenceId: billId } });

    for (const line of lines) {
      if (line.item.type !== "GOOD") continue;
      const item = await tx.item.findUniqueOrThrow({ where: { id: line.item.id } });
      await tx.inventoryMovement.create({
        data: {
          userId,
          itemId: line.item.id,
          quantity: line.quantity,
          reason: "PURCHASE",
          referenceId: billId,
        },
      });
      await tx.item.update({
        where: { id: item.id },
        data: {
          quantityOnHand: new Prisma.Decimal(item.quantityOnHand ?? 0).plus(line.quantity),
        },
      });
    }
  }

  list(userId: string) {
    return this.prisma.purchaseBill.findMany({
      where: { userId },
      include: { supplier: true, lines: true },
      orderBy: { billDate: "desc" },
    });
  }

  formOptions(userId: string) {
    return Promise.all([
      this.prisma.supplier.findMany({ where: { userId, isActive: true }, orderBy: { name: "asc" } }),
      this.prisma.item.findMany({ where: { userId, isActive: true }, orderBy: { name: "asc" } }),
    ]).then(([suppliers, items]) => ({ suppliers, items }));
  }

  async get(userId: string, id: string) {
    const result = await this.prisma.purchaseBill.findFirst({
      where: { id, userId },
      include: { supplier: true, lines: true },
    });
    if (!result) throw new NotFoundException("Purchase bill not found");
    return result;
  }

  async create(userId: string, input: BillInput) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (!input.supplierId) throw new BadRequestException("Supplier is required");
        const supplier = await tx.supplier.findFirst({
          where: { id: input.supplierId, userId, isActive: true },
        });
        if (!supplier) throw new BadRequestException("Active supplier not found");

        const lines = await this.normalizedLines(tx, userId, input.lines ?? []);
        const billNumber = input.billNumber?.trim() || (await this.nextNumber(tx, userId));
        const bill = await tx.purchaseBill.create({
          data: {
            userId,
            supplierId: supplier.id,
            billNumber,
            billDate: input.billDate ? new Date(input.billDate) : new Date(),
            notes: input.notes?.trim() || null,
            lines: {
              create: lines.map((line) => ({
                itemId: line.item.id,
                itemName: line.item.name,
                productCode: line.item.productCode,
                quantity: line.quantity,
                unitCost: line.unitCost,
                lineTotal: line.lineTotal,
              })),
            },
          },
          include: { supplier: true, lines: true },
        });
        await this.replaceMovements(tx, userId, bill.id, lines);
        await this.accounting.syncBill(tx, userId, bill.id, supplier.id, lines, billNumber);
        return bill;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("Bill number already exists");
      }
      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      this.logger.error(
        `Purchase bill transaction failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async update(userId: string, id: string, input: BillInput) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.purchaseBill.findFirst({ where: { id, userId } });
      if (!existing) throw new NotFoundException("Purchase bill not found");

      const supplierId = input.supplierId ?? existing.supplierId;
      const supplier = await tx.supplier.findFirst({
        where: { id: supplierId, userId, isActive: true },
      });
      if (!supplier) throw new BadRequestException("Active supplier not found");

      const lines = await this.normalizedLines(tx, userId, input.lines ?? []);
      const billNumber = input.billNumber?.trim() ?? existing.billNumber;

      await tx.purchaseBillLine.deleteMany({ where: { billId: id } });
      const bill = await tx.purchaseBill.update({
        where: { id },
        data: {
          supplierId,
          billNumber,
          billDate: input.billDate ? new Date(input.billDate) : existing.billDate,
          notes: input.notes === undefined ? existing.notes : input.notes.trim() || null,
          lines: {
            create: lines.map((line) => ({
              itemId: line.item.id,
              itemName: line.item.name,
              productCode: line.item.productCode,
              quantity: line.quantity,
              unitCost: line.unitCost,
              lineTotal: line.lineTotal,
            })),
          },
        },
        include: { supplier: true, lines: true },
      });
      await this.replaceMovements(tx, userId, id, lines);
      await this.accounting.syncBill(tx, userId, id, supplier.id, lines, billNumber);
      return bill;
    });
  }

  async remove(userId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const bill = await tx.purchaseBill.findFirst({ where: { id, userId } });
      if (!bill) throw new NotFoundException("Purchase bill not found");

      await this.replaceMovements(tx, userId, id, []);
      await deleteSourceJournal(tx, userId, "PURCHASE_BILL", id);
      await tx.purchaseBill.delete({ where: { id } });
    });
  }
}
