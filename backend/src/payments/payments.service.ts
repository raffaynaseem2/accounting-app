import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, PaymentKind } from "@prisma/client";
import { isLiquidAssetAccount } from "../accounts/default-accounts";
import { deletePaymentRecord } from "../journal/journal-cleanup";
import { PrismaService } from "../prisma/prisma.service";

type PaymentInput = {
  kind?: PaymentKind;
  customerId?: string;
  supplierId?: string;
  accountId?: string;
  amount?: number | string;
  paymentDate?: string;
  reference?: string;
  notes?: string;
};

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.payment.findMany({
      where: { userId },
      include: { customer: true, supplier: true, account: true, journalEntry: true },
      orderBy: { paymentDate: "desc" },
    });
  }

  async formOptions(userId: string, kind?: string) {
    const isCustomer = kind !== "supplier";
    const [parties, accounts] = await Promise.all([
      isCustomer
        ? this.prisma.customer.findMany({ where: { userId, isActive: true }, orderBy: { name: "asc" } })
        : this.prisma.supplier.findMany({ where: { userId, isActive: true }, orderBy: { name: "asc" } }),
      this.prisma.account.findMany({ where: { userId, isActive: true }, orderBy: { name: "asc" } }),
    ]);
    return { parties, accounts: accounts.filter(isLiquidAssetAccount) };
  }

  async create(userId: string, input: PaymentInput) {
    if (!input.kind || !["CUSTOMER_RECEIPT", "SUPPLIER_PAYMENT"].includes(input.kind)) {
      throw new BadRequestException("Payment type is required");
    }
    const amount = new Prisma.Decimal(input.amount ?? 0);
    if (!amount.isFinite() || amount.lte(0)) {
      throw new BadRequestException("Payment amount must be greater than zero");
    }
    const kind = input.kind;
    const isCustomer = kind === "CUSTOMER_RECEIPT";
    if (isCustomer && (!input.customerId || input.supplierId)) {
      throw new BadRequestException("A customer receipt requires a customer only");
    }
    if (!isCustomer && (!input.supplierId || input.customerId)) {
      throw new BadRequestException("A supplier payment requires a supplier only");
    }
    if (!input.accountId) throw new BadRequestException("Bank or cash account is required");

    return this.prisma.$transaction(async (tx) => {
      const account = await tx.account.findFirst({
        where: { id: input.accountId, userId, isActive: true },
      });
      if (!account || !isLiquidAssetAccount(account)) {
        throw new BadRequestException("Select an active bank or cash asset account");
      }
      const party = isCustomer
        ? await tx.customer.findFirst({ where: { id: input.customerId, userId, isActive: true } })
        : await tx.supplier.findFirst({ where: { id: input.supplierId, userId, isActive: true } });
      if (!party) throw new NotFoundException("Active payment party not found");

      const control = await tx.account.findFirst({
        where: { userId, systemKey: isCustomer ? "AR" : "AP", isActive: true },
      });
      if (!control) {
        throw new BadRequestException(
          `Active ${isCustomer ? "Accounts Receivable" : "Accounts Payable"} account not found`,
        );
      }

      const entry = await tx.journalEntry.create({
        data: {
          userId,
          description: isCustomer ? `Customer receipt - ${party.name}` : `Supplier payment - ${party.name}`,
          entryDate: input.paymentDate ? new Date(input.paymentDate) : new Date(),
          sourceType: "PAYMENT",
          lines: {
            create: isCustomer
              ? [
                  { userId, accountId: account.id, side: "DEBIT", amount },
                  { userId, accountId: control.id, customerId: party.id, side: "CREDIT", amount },
                ]
              : [
                  { userId, accountId: control.id, supplierId: party.id, side: "DEBIT", amount },
                  { userId, accountId: account.id, side: "CREDIT", amount },
                ],
          },
        },
      });
      const payment = await tx.payment.create({
        data: {
          userId,
          kind,
          customerId: isCustomer ? party.id : null,
          supplierId: isCustomer ? null : party.id,
          accountId: account.id,
          amount,
          paymentDate: input.paymentDate ? new Date(input.paymentDate) : new Date(),
          reference: input.reference?.trim() || null,
          notes: input.notes?.trim() || null,
          journalEntryId: entry.id,
        },
      });
      await tx.journalEntry.update({ where: { id: entry.id }, data: { sourceId: payment.id } });
      return tx.payment.findFirstOrThrow({
        where: { id: payment.id },
        include: { customer: true, supplier: true, account: true, journalEntry: { include: { lines: true } } },
      });
    });
  }

  async remove(userId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({ where: { id, userId } });
      if (!payment) throw new NotFoundException("Payment not found");
      await deletePaymentRecord(tx, payment);
    });
  }
}
