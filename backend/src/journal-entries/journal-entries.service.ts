import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { deleteJournalEntry } from "../journal/journal-cleanup";

type JournalLineInput = {
  accountId?: string;
  customerId?: string | null;
  supplierId?: string | null;
  side?: "DEBIT" | "CREDIT";
  amount?: number | string;
  description?: string | null;
};

type JournalInput = {
  entryDate?: string;
  description?: string;
  lines?: JournalLineInput[];
};

@Injectable()
export class JournalEntriesService {
  constructor(private readonly prisma: PrismaService) {}

  private assertManualEntry(entry: { sourceType: string | null }) {
    if (entry.sourceType === "SALES_INVOICE") {
      throw new BadRequestException("Edit the invoice to change this entry");
    }
    if (entry.sourceType === "PURCHASE_BILL") {
      throw new BadRequestException("Edit the bill to change this entry");
    }
    if (entry.sourceType === "PAYMENT") {
      throw new BadRequestException("Delete the payment to remove this entry");
    }
  }

  private systemDeleteMessage(sourceType: string | null) {
    if (sourceType === "SALES_INVOICE") return "Delete the invoice to remove this entry";
    if (sourceType === "PURCHASE_BILL") return "Delete the bill to remove this entry";
    if (sourceType === "PAYMENT") return "Delete the payment to remove this entry";
    return null;
  }

  list(userId: string) {
    return this.prisma.journalEntry.findMany({
      where: { userId },
      include: { lines: { include: { account: true, customer: true, supplier: true }, orderBy: { id: "asc" } } },
      orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
    });
  }

  async get(userId: string, id: string) {
    const entry = await this.prisma.journalEntry.findFirst({
      where: { id, userId },
      include: { lines: { include: { account: true, customer: true, supplier: true } } },
    });
    if (!entry) throw new NotFoundException("Journal entry not found");
    return entry;
  }

  private async validateLines(tx: Prisma.TransactionClient, userId: string, lines: JournalLineInput[]) {
    if (!lines || lines.length < 2) throw new BadRequestException("At least two journal lines are required");

    let debits = new Prisma.Decimal(0);
    let credits = new Prisma.Decimal(0);
    const accountIds = lines.map((line) => line.accountId).filter(Boolean) as string[];
    if (new Set(accountIds).size !== accountIds.length) {
      throw new BadRequestException("Each account may appear only once per entry");
    }

    const accounts = await tx.account.findMany({
      where: { userId, id: { in: accountIds }, isActive: true },
    });
    if (accounts.length !== accountIds.length) {
      throw new BadRequestException("Every journal line must reference an active account owned by this user");
    }
    const customerIds = lines.map((line) => line.customerId).filter(Boolean) as string[];
    const supplierIds = lines.map((line) => line.supplierId).filter(Boolean) as string[];
    const [customers, suppliers] = await Promise.all([
      customerIds.length ? tx.customer.findMany({ where: { userId, id: { in: customerIds }, isActive: true }, select: { id: true } }) : Promise.resolve([]),
      supplierIds.length ? tx.supplier.findMany({ where: { userId, id: { in: supplierIds }, isActive: true }, select: { id: true } }) : Promise.resolve([]),
    ]);
    if (customers.length !== new Set(customerIds).size) throw new BadRequestException("Every customer reference must belong to this user and be active");
    if (suppliers.length !== new Set(supplierIds).size) throw new BadRequestException("Every supplier reference must belong to this user and be active");

    const normalized = lines.map((line) => {
      if (!line.accountId || !line.side) throw new BadRequestException("Every line needs an account and side");
      if (line.customerId && line.supplierId) throw new BadRequestException("A journal line cannot reference both a customer and supplier");
      const account = accounts.find((candidate) => candidate.id === line.accountId)!;
      if (account.subledgerType === "CUSTOMER" && !line.customerId) throw new BadRequestException("This account requires a customer");
      if (account.subledgerType === "SUPPLIER" && !line.supplierId) throw new BadRequestException("This account requires a supplier");
      if (account.subledgerType !== "CUSTOMER" && line.customerId) throw new BadRequestException("This account does not accept a customer reference");
      if (account.subledgerType !== "SUPPLIER" && line.supplierId) throw new BadRequestException("This account does not accept a supplier reference");
      const amount = new Prisma.Decimal(line.amount ?? 0);
      if (!amount.isFinite() || amount.lte(0)) throw new BadRequestException("Amounts must be greater than zero");
      if (line.side === "DEBIT") debits = debits.plus(amount);
      else if (line.side === "CREDIT") credits = credits.plus(amount);
      else throw new BadRequestException("Invalid journal side");
      return { accountId: line.accountId, customerId: line.customerId || null, supplierId: line.supplierId || null, side: line.side, amount, description: line.description || null };
    });

    if (debits.eq(0) || credits.eq(0) || !debits.eq(credits)) {
      throw new ConflictException("Journal entry debits and credits must balance");
    }
    return normalized;
  }

  async create(userId: string, input: JournalInput) {
    const description = input.description?.trim();
    if (!description) throw new BadRequestException("Description is required");

    return this.prisma.$transaction(async (tx) => {
      const lines = await this.validateLines(tx, userId, input.lines ?? []);
      return tx.journalEntry.create({
        data: {
          userId,
          description,
          entryDate: input.entryDate ? new Date(input.entryDate) : new Date(),
          lines: { create: lines.map((line) => ({ ...line, userId })) },
        },
        include: { lines: { include: { account: true, customer: true, supplier: true } } },
      });
    });
  }

  async update(userId: string, id: string, input: JournalInput) {
    const description = input.description?.trim();
    if (!description) throw new BadRequestException("Description is required");

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.journalEntry.findFirst({ where: { id, userId } });
      if (!existing) throw new NotFoundException("Journal entry not found");
      this.assertManualEntry(existing);
      const lines = await this.validateLines(tx, userId, input.lines ?? []);
      await tx.journalEntryLine.deleteMany({ where: { journalEntryId: id, userId } });
      return tx.journalEntry.update({
        where: { id },
        data: {
          description,
          entryDate: input.entryDate ? new Date(input.entryDate) : existing.entryDate,
          lines: { create: lines.map((line) => ({ ...line, userId })) },
        },
        include: { lines: { include: { account: true, customer: true, supplier: true } } },
      });
    });
  }

  async remove(userId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.journalEntry.findFirst({ where: { id, userId } });
      if (!existing) throw new NotFoundException("Journal entry not found");
      const systemMessage = this.systemDeleteMessage(existing.sourceType);
      if (systemMessage) throw new BadRequestException(systemMessage);
      await deleteJournalEntry(tx, id);
    });
  }
}
