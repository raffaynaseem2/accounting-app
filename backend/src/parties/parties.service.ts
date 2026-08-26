import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

type PartyKind = "CUSTOMER" | "SUPPLIER";
type PartyInput = {
  name?: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  billingAddress?: string | null;
  paymentTerms?: "DUE_ON_RECEIPT" | "NET_15" | "NET_30" | "NET_60";
};

@Injectable()
export class PartiesService {
  constructor(private readonly prisma: PrismaService) {}

  private delegate(kind: PartyKind): any {
    return kind === "CUSTOMER" ? this.prisma.customer : this.prisma.supplier;
  }

  private relation(kind: PartyKind) {
    return kind === "CUSTOMER" ? "receivableAccount" : "payableAccount";
  }

  list(userId: string, kind: PartyKind) {
    return this.delegate(kind).findMany({
      where: { userId },
      include: { [this.relation(kind)]: true },
      orderBy: { name: "asc" },
    });
  }

  async listWithBalances(userId: string, kind: PartyKind) {
    const parties = await this.list(userId, kind);
    if (!parties.length) return [];
    const ids = parties.map((party: any) => party.id);
    const lines = await this.prisma.journalEntryLine.groupBy({
      by: [kind === "CUSTOMER" ? "customerId" : "supplierId", "side"],
      where: { userId, ...(kind === "CUSTOMER" ? { customerId: { in: ids } } : { supplierId: { in: ids } }) },
      _sum: { amount: true },
    } as any);
    const balances = new Map<string, Prisma.Decimal>();
    for (const line of lines as any[]) {
      const partyId = kind === "CUSTOMER" ? line.customerId : line.supplierId;
      if (!partyId) continue;
      const current = balances.get(partyId) ?? new Prisma.Decimal(0);
      const positiveSide = kind === "CUSTOMER" ? "DEBIT" : "CREDIT";
      balances.set(partyId, line.side === positiveSide ? current.plus(line._sum.amount ?? 0) : current.minus(line._sum.amount ?? 0));
    }
    return parties.map((party: any) => ({ ...party, balance: (balances.get(party.id) ?? new Prisma.Decimal(0)).toFixed(2) }));
  }

  async get(userId: string, kind: PartyKind, id: string) {
    const party = await this.delegate(kind).findFirst({
      where: { id, userId },
      include: kind === "CUSTOMER"
        ? { invoices: { include: { lines: true }, orderBy: { issueDate: "desc" } }, journalLines: { include: { account: true, journalEntry: true }, orderBy: { id: "asc" } }, receivableAccount: true }
        : { bills: { include: { lines: true }, orderBy: { billDate: "desc" } }, journalLines: { include: { account: true, journalEntry: true }, orderBy: { id: "asc" } }, payableAccount: true },
    });
    if (!party) throw new NotFoundException(`${kind === "CUSTOMER" ? "Customer" : "Supplier"} not found`);
    return party;
  }

  async create(userId: string, kind: PartyKind, input: PartyInput) {
    const name = input.name?.trim();
    if (!name) throw new BadRequestException(`${kind === "CUSTOMER" ? "Customer" : "Supplier"} name is required`);
    const control = await this.prisma.account.findFirst({
      where: { userId, subledgerType: kind === "CUSTOMER" ? "CUSTOMER" : "SUPPLIER", isActive: true },
      orderBy: { systemKey: "asc" },
    });
    if (!control) throw new BadRequestException(`Configure an active ${kind === "CUSTOMER" ? "Accounts Receivable" : "Accounts Payable"} account first`);
    return this.delegate(kind).create({
      data: {
        userId,
        name,
        contactEmail: input.contactEmail || null,
        contactPhone: input.contactPhone || null,
        billingAddress: input.billingAddress || null,
        paymentTerms: input.paymentTerms,
        [kind === "CUSTOMER" ? "receivableAccountId" : "payableAccountId"]: control.id,
      },
      include: { [this.relation(kind)]: true },
    });
  }

  async update(userId: string, kind: PartyKind, id: string, input: PartyInput & { isActive?: boolean }) {
    await this.get(userId, kind, id);
    if (input.name !== undefined && !input.name.trim()) throw new BadRequestException("Name is required");
    return this.delegate(kind).update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.contactEmail !== undefined ? { contactEmail: input.contactEmail || null } : {}),
        ...(input.contactPhone !== undefined ? { contactPhone: input.contactPhone || null } : {}),
        ...(input.billingAddress !== undefined ? { billingAddress: input.billingAddress || null } : {}),
        ...(input.paymentTerms !== undefined ? { paymentTerms: input.paymentTerms } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
      include: { [this.relation(kind)]: true },
    });
  }

  async balance(userId: string, kind: PartyKind, id: string) {
    const party = await this.get(userId, kind, id);
    const accountId = kind === "CUSTOMER" ? party.receivableAccountId : party.payableAccountId;
    if (!accountId) return "0.00";
    const lines = await this.prisma.journalEntryLine.groupBy({
      by: ["side"],
      where: { userId, accountId, ...(kind === "CUSTOMER" ? { customerId: id } : { supplierId: id }) },
      _sum: { amount: true },
    });
    let result = new Prisma.Decimal(0);
    for (const line of lines) {
      const positiveSide = kind === "CUSTOMER" ? "DEBIT" : "CREDIT";
      result = line.side === positiveSide ? result.plus(line._sum.amount ?? 0) : result.minus(line._sum.amount ?? 0);
    }
    return result.toFixed(2);
  }
}
