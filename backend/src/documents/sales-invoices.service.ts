import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { deleteSourceJournal } from "../journal/journal-cleanup";
import { PrismaService } from "../prisma/prisma.service";
import { DocumentAccountingService } from "./document-accounting.service";

type LineInput = { itemId?: string; quantity?: number | string; unitPrice?: number | string };
type InvoiceInput = {
  customerId?: string;
  invoiceNumber?: string;
  issueDate?: string;
  notes?: string;
  lines?: LineInput[];
};

type NormalizedLine = {
  item: { id: string; name: string; productCode: string; type: string };
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
};

@Injectable()
export class SalesInvoicesService {
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
    const count = await tx.salesInvoice.count({ where: { userId } });
    return `INV-${String(count + 1).padStart(6, "0")}`;
  }

  private async normalizedLines(
    tx: Prisma.TransactionClient,
    userId: string,
    lines: LineInput[],
  ): Promise<NormalizedLine[]> {
    if (!lines?.length) throw new BadRequestException("At least one invoice line is required");

    const ids = lines.map((line) => line.itemId).filter(Boolean) as string[];
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException("An item may appear only once per invoice");
    }

    const items = await tx.item.findMany({
      where: { userId, id: { in: ids }, isActive: true },
    });
    if (items.length !== ids.length) {
      throw new BadRequestException("Every invoice item must be active and belong to this user");
    }

    return lines.map((line) => {
      if (!line.itemId) throw new BadRequestException("Every line needs an item");
      const item = items.find((candidate) => candidate.id === line.itemId)!;
      const quantity = this.decimal(line.quantity, "Quantity");
      const unitPrice = this.decimal(line.unitPrice ?? item.unitPrice?.toString(), "Unit price");
      return { item, quantity, unitPrice, lineTotal: quantity.mul(unitPrice) };
    });
  }

  private async replaceMovements(
    tx: Prisma.TransactionClient,
    userId: string,
    invoiceId: string,
    lines: NormalizedLine[],
  ) {
    const old = await tx.inventoryMovement.findMany({ where: { userId, referenceId: invoiceId } });
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
    await tx.inventoryMovement.deleteMany({ where: { userId, referenceId: invoiceId } });

    for (const line of lines) {
      if (line.item.type !== "GOOD") continue;
      const item = await tx.item.findUniqueOrThrow({ where: { id: line.item.id } });
      await tx.inventoryMovement.create({
        data: {
          userId,
          itemId: line.item.id,
          quantity: line.quantity.neg(),
          reason: "SALE",
          referenceId: invoiceId,
        },
      });
      await tx.item.update({
        where: { id: item.id },
        data: {
          quantityOnHand: new Prisma.Decimal(item.quantityOnHand ?? 0).minus(line.quantity),
        },
      });
    }
  }

  list(userId: string) {
    return this.prisma.salesInvoice.findMany({
      where: { userId },
      include: { customer: true, lines: true },
      orderBy: { issueDate: "desc" },
    });
  }

  formOptions(userId: string) {
    return Promise.all([
      this.prisma.customer.findMany({ where: { userId, isActive: true }, orderBy: { name: "asc" } }),
      this.prisma.item.findMany({ where: { userId, isActive: true }, orderBy: { name: "asc" } }),
    ]).then(([customers, items]) => ({ customers, items }));
  }

  async get(userId: string, id: string) {
    const result = await this.prisma.salesInvoice.findFirst({
      where: { id, userId },
      include: { customer: true, lines: true },
    });
    if (!result) throw new NotFoundException("Sales invoice not found");
    return result;
  }

  async create(userId: string, input: InvoiceInput) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (!input.customerId) throw new BadRequestException("Customer is required");
        const customer = await tx.customer.findFirst({
          where: { id: input.customerId, userId, isActive: true },
        });
        if (!customer) throw new BadRequestException("Active customer not found");

        const lines = await this.normalizedLines(tx, userId, input.lines ?? []);
        const invoiceNumber = input.invoiceNumber?.trim() || (await this.nextNumber(tx, userId));
        const invoice = await tx.salesInvoice.create({
          data: {
            userId,
            customerId: customer.id,
            invoiceNumber,
            issueDate: input.issueDate ? new Date(input.issueDate) : new Date(),
            notes: input.notes?.trim() || null,
            lines: {
              create: lines.map((line) => ({
                itemId: line.item.id,
                itemName: line.item.name,
                productCode: line.item.productCode,
                quantity: line.quantity,
                unitPrice: line.unitPrice,
                lineTotal: line.lineTotal,
              })),
            },
          },
          include: { customer: true, lines: true },
        });
        await this.replaceMovements(tx, userId, invoice.id, lines);
        await this.accounting.syncInvoice(tx, userId, invoice.id, customer.id, lines, invoiceNumber);
        return invoice;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("Invoice number already exists");
      }
      throw error;
    }
  }

  async update(userId: string, id: string, input: InvoiceInput) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.salesInvoice.findFirst({ where: { id, userId } });
      if (!existing) throw new NotFoundException("Sales invoice not found");

      const customerId = input.customerId ?? existing.customerId;
      const customer = await tx.customer.findFirst({
        where: { id: customerId, userId, isActive: true },
      });
      if (!customer) throw new BadRequestException("Active customer not found");

      const lines = await this.normalizedLines(tx, userId, input.lines ?? []);
      const invoiceNumber = input.invoiceNumber?.trim() ?? existing.invoiceNumber;

      await tx.salesInvoiceLine.deleteMany({ where: { invoiceId: id } });
      const invoice = await tx.salesInvoice.update({
        where: { id },
        data: {
          customerId,
          invoiceNumber,
          issueDate: input.issueDate ? new Date(input.issueDate) : existing.issueDate,
          notes: input.notes === undefined ? existing.notes : input.notes.trim() || null,
          lines: {
            create: lines.map((line) => ({
              itemId: line.item.id,
              itemName: line.item.name,
              productCode: line.item.productCode,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              lineTotal: line.lineTotal,
            })),
          },
        },
        include: { customer: true, lines: true },
      });
      await this.replaceMovements(tx, userId, id, lines);
      await this.accounting.syncInvoice(tx, userId, id, customer.id, lines, invoiceNumber);
      return invoice;
    });
  }

  async remove(userId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.salesInvoice.findFirst({ where: { id, userId } });
      if (!invoice) throw new NotFoundException("Sales invoice not found");

      await this.replaceMovements(tx, userId, id, []);
      await deleteSourceJournal(tx, userId, "SALES_INVOICE", id);
      await tx.salesInvoice.delete({ where: { id } });
    });
  }
}
