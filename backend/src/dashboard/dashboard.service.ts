import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(userId: string) {
    const [accounts, balances, items, invoices, bills] = await Promise.all([
      this.prisma.account.findMany({
        where: { userId },
        select: { id: true, name: true, type: true, systemKey: true, parentAccountId: true },
      }),
      this.prisma.journalEntryLine.groupBy({
        by: ["accountId", "side"],
        where: { userId },
        _sum: { amount: true },
      }),
      this.prisma.item.findMany({
        where: { userId },
        select: { type: true, quantityOnHand: true, unitCost: true },
      }),
      this.prisma.salesInvoice.findMany({
        where: { userId },
        select: { lines: { select: { lineTotal: true } } },
      }),
      this.prisma.purchaseBill.findMany({
        where: { userId },
        select: { lines: { select: { lineTotal: true } } },
      }),
    ]);

    const directBalances = new Map<string, Prisma.Decimal>();
    for (const row of balances) {
      const current = directBalances.get(row.accountId) ?? new Prisma.Decimal(0);
      directBalances.set(
        row.accountId,
        row.side === "DEBIT"
          ? current.plus(row._sum.amount ?? 0)
          : current.minus(row._sum.amount ?? 0),
      );
    }

    const children = new Map<string, typeof accounts>();
    for (const account of accounts) {
      if (!account.parentAccountId) continue;
      const siblings = children.get(account.parentAccountId) ?? [];
      siblings.push(account);
      children.set(account.parentAccountId, siblings);
    }

    const totalBalance = (accountId: string): Prisma.Decimal => {
      const own = directBalances.get(accountId) ?? new Prisma.Decimal(0);
      return (children.get(accountId) ?? []).reduce(
        (total, child) => total.plus(totalBalance(child.id)),
        own,
      );
    };

    const balanceFor = (account: (typeof accounts)[number] | undefined) =>
      account ? Number(totalBalance(account.id)) : 0;
    const displayBalance = (account: (typeof accounts)[number] | undefined) => {
      const balance = balanceFor(account);
      return account && ["LIABILITY", "EQUITY", "REVENUE"].includes(account.type)
        ? balance * -1
        : balance;
    };
    const cash = accounts
      .filter((account) => /cash|bank/i.test(account.name))
      .reduce((total, account) => total + displayBalance(account), 0);
    const receivable = displayBalance(accounts.find((account) => account.systemKey === "AR"));
    const payable = displayBalance(accounts.find((account) => account.systemKey === "AP"));
    const inventory = items
      .filter((item) => item.type === "GOOD")
      .reduce((total, item) => total + Number(item.quantityOnHand ?? 0) * Number(item.unitCost ?? 0), 0);
    const sales = invoices.reduce(
      (total, invoice) => total + invoice.lines.reduce((sum, line) => sum + Number(line.lineTotal), 0),
      0,
    );
    const purchases = bills.reduce(
      (total, bill) => total + bill.lines.reduce((sum, line) => sum + Number(line.lineTotal), 0),
      0,
    );

    return { cash, receivable, payable, inventory, sales, purchases };
  }
}
