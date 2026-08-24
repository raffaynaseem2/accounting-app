import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { ensureDefaultAccounts } from "../accounts/default-accounts";

type BillLine = {
  item: { id: string; type: string };
  lineTotal: Prisma.Decimal;
};

@Injectable()
export class DocumentAccountingService {
  private readonly logger = new Logger(DocumentAccountingService.name);

  private lineTotal(lines: BillLine[]) {
    return lines.reduce((sum, line) => sum.plus(new Prisma.Decimal(line.lineTotal)), new Prisma.Decimal(0));
  }

  private async resolveInvoiceAccounts(tx: Prisma.TransactionClient, businessId: string) {
    await ensureDefaultAccounts(tx, businessId);
    const [ar, revenue] = await Promise.all([
      tx.account.findFirst({ where: { businessId, systemKey: "AR", isActive: true } }),
      tx.account.findFirst({ where: { businessId, systemKey: "SALES_REVENUE", isActive: true } }),
    ]);
    if (!ar || !revenue) {
      throw new BadRequestException(
        "Configure active Accounts Receivable and Sales Revenue accounts before saving an invoice",
      );
    }
    return { ar, revenue };
  }

  async resolveBillAccounts(tx: Prisma.TransactionClient, businessId: string) {
    await ensureDefaultAccounts(tx, businessId);

    const ap =
      (await tx.account.findFirst({ where: { businessId, systemKey: "AP", isActive: true } })) ??
      (await tx.account.findFirst({
        where: { businessId, type: "LIABILITY", subledgerType: "SUPPLIER", isActive: true },
        orderBy: { createdAt: "asc" },
      }));

    const generalExpense =
      (await tx.account.findFirst({ where: { businessId, systemKey: "GENERAL_EXPENSE", isActive: true } })) ??
      (await tx.account.findFirst({
        where: { businessId, type: "EXPENSE", name: "General Expense", isActive: true },
      }));

    const missing: string[] = [];
    if (!ap) missing.push("Accounts Payable");
    if (!generalExpense) missing.push("General Expense");
    if (missing.length) {
      throw new BadRequestException(
        `Configure active ${missing.join(" and ")} accounts before saving a bill`,
      );
    }

    return { ap: ap!, generalExpense: generalExpense! };
  }

  private async replace(
    tx: Prisma.TransactionClient,
    businessId: string,
    sourceType: string,
    sourceId: string,
    description: string,
    lines: { accountId: string; customerId?: string; supplierId?: string; side: "DEBIT" | "CREDIT"; amount: Prisma.Decimal }[],
  ) {
    const existing = await tx.journalEntry.findFirst({ where: { businessId, sourceType, sourceId } });
    if (existing) await tx.journalEntry.delete({ where: { id: existing.id } });

    try {
      await tx.journalEntry.create({
        data: {
          businessId,
          sourceType,
          sourceId,
          description,
          lines: {
            create: lines.map((line) => ({
              businessId,
              accountId: line.accountId,
              customerId: line.customerId ?? null,
              supplierId: line.supplierId ?? null,
              side: line.side,
              amount: line.amount,
            })),
          },
        },
      });
    } catch (error) {
      this.logger.error(
        `Journal entry failed for ${sourceType} ${sourceId}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async syncInvoice(
    tx: Prisma.TransactionClient,
    businessId: string,
    invoiceId: string,
    customerId: string,
    lines: BillLine[],
    invoiceNumber: string,
  ) {
    const { ar, revenue } = await this.resolveInvoiceAccounts(tx, businessId);
    const total = this.lineTotal(lines);
    if (total.lte(0)) throw new BadRequestException("Invoice total must be greater than zero");

    return this.replace(tx, businessId, "SALES_INVOICE", invoiceId, `Sales invoice ${invoiceNumber}`, [
      { accountId: ar.id, customerId, side: "DEBIT", amount: total },
      { accountId: revenue.id, side: "CREDIT", amount: total },
    ]);
  }

  async syncBill(
    tx: Prisma.TransactionClient,
    businessId: string,
    billId: string,
    supplierId: string,
    lines: BillLine[],
    billNumber: string,
  ) {
    const { ap, generalExpense } = await this.resolveBillAccounts(tx, businessId);
    const total = this.lineTotal(lines);
    if (total.lte(0)) throw new BadRequestException("Bill total must be greater than zero");

    return this.replace(tx, businessId, "PURCHASE_BILL", billId, `Purchase bill ${billNumber}`, [
      { accountId: generalExpense.id, side: "DEBIT", amount: total },
      { accountId: ap.id, supplierId, side: "CREDIT", amount: total },
    ]);
  }
}
