import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

type AccountInput = { name?: string; code?: string | null; type?: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE"; subledgerType?: "NONE" | "CUSTOMER" | "SUPPLIER" };

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}
  list(userId: string) { return this.prisma.account.findMany({ where: { userId }, include: { childAccounts: true, parentAccount: true }, orderBy: [{ parentAccountId: "asc" }, { name: "asc" }] }); }
  async listWithBalances(userId: string) {
    const [accounts, lines] = await Promise.all([
      this.prisma.account.findMany({ where: { userId }, include: { childAccounts: true, parentAccount: true }, orderBy: [{ parentAccountId: "asc" }, { name: "asc" }] }),
      this.prisma.journalEntryLine.groupBy({ by: ["accountId", "side"], where: { userId }, _sum: { amount: true } }),
    ]);
    const totals = new Map<string, Prisma.Decimal>();
    for (const line of lines) {
      const current = totals.get(line.accountId) ?? new Prisma.Decimal(0);
      totals.set(line.accountId, line.side === "DEBIT" ? current.plus(line._sum.amount ?? 0) : current.minus(line._sum.amount ?? 0));
    }
    const balance = (accountId: string): Prisma.Decimal => (accounts.find((a) => a.id === accountId)?.childAccounts ?? []).reduce((sum, child) => sum.plus(balance(child.id)), totals.get(accountId) ?? new Prisma.Decimal(0));
    return accounts.map((account) => ({ ...account, balance: balance(account.id).toFixed(2) }));
  }
  async create(userId: string, input: AccountInput) {
    const name = input.name?.trim();
    if (!name) throw new BadRequestException("Account name is required");
    if (!input.type) throw new BadRequestException("Account type is required");
    if (input.subledgerType === "CUSTOMER" || input.subledgerType === "SUPPLIER") {
      const expected = input.subledgerType === "CUSTOMER" ? "ASSET" : "LIABILITY";
      if (input.type !== expected) throw new BadRequestException(`${input.subledgerType} subledger accounts must be ${expected} accounts`);
    }
    try { return await this.prisma.account.create({ data: { userId, name, code: input.code?.trim() || null, type: input.type, subledgerType: input.subledgerType ?? "NONE" } }); }
    catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictException("Account code already exists"); throw error; }
  }
  async update(userId: string, id: string, input: AccountInput & { isActive?: boolean }) {
    const account = await this.prisma.account.findFirst({ where: { id, userId } });
    if (!account) throw new NotFoundException("Account not found");
    if (input.name !== undefined && !input.name.trim()) throw new BadRequestException("Account name is required");
    if (input.type && input.type !== account.type) throw new BadRequestException("An account type cannot be changed after creation");
    if (input.subledgerType && input.subledgerType !== account.subledgerType) throw new BadRequestException("An account subledger cannot be changed after creation");
    if (account.systemKey && (input.type || input.subledgerType)) throw new BadRequestException("System accounts cannot change their accounting identity");
    return this.prisma.account.update({ where: { id }, data: { ...(input.name !== undefined ? { name: input.name.trim() } : {}), ...(input.code !== undefined ? { code: input.code?.trim() || null } : {}), ...(input.isActive !== undefined ? { isActive: input.isActive } : {}) } });
  }
  async remove(userId: string, id: string) {
    const account = await this.prisma.account.findFirst({ where: { id, userId } });
    if (!account) throw new NotFoundException("Account not found");
    if (account.systemKey) throw new ConflictException("System accounts should be deactivated instead of deleted");
    const lineCount = await this.prisma.journalEntryLine.count({ where: { accountId: id, userId } });
    if (lineCount > 0) throw new ConflictException("Account has journal entries and cannot be deleted");
    return this.prisma.account.delete({ where: { id } });
  }
  async getAccountBalance(accountId: string, userId: string): Promise<string> {
    const account = await this.prisma.account.findFirst({ where: { id: accountId, userId }, select: { id: true, childAccounts: { select: { id: true } } } });
    if (!account) throw new NotFoundException("Account not found");
    const totals = await this.prisma.journalEntryLine.groupBy({ by: ["side"], where: { accountId, userId }, _sum: { amount: true } });
    let balance = new Prisma.Decimal(0);
    for (const total of totals) balance = total.side === "DEBIT" ? balance.plus(total._sum.amount ?? 0) : balance.minus(total._sum.amount ?? 0);
    for (const child of account.childAccounts) balance = balance.plus(new Prisma.Decimal(await this.getAccountBalance(child.id, userId)));
    return balance.toFixed(2);
  }
  async getLedger(
    accountId: string,
    userId: string,
    filters?: { customerId?: string; supplierId?: string },
  ) {
    const account = await this.prisma.account.findFirst({ where: { id: accountId, userId } });
    if (!account) throw new NotFoundException("Account not found");

    const lineWhere: Prisma.JournalEntryLineWhereInput = { accountId, userId };
    if (filters?.customerId) lineWhere.customerId = filters.customerId;
    if (filters?.supplierId) lineWhere.supplierId = filters.supplierId;

    const journalLines = await this.prisma.journalEntryLine.findMany({
      where: lineWhere,
      include: {
        journalEntry: { include: { payment: { select: { id: true } } } },
        customer: true,
        supplier: true,
      },
      orderBy: [{ journalEntry: { entryDate: "asc" } }, { id: "asc" }],
    });
    return { account, balance: await this.getAccountBalance(accountId, userId), journalLines };
  }
}
