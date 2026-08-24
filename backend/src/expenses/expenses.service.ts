import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  getAll(businessId: string) {
    return this.prisma.expense.findMany({
      where: { businessId },
      orderBy: { createdAt: "desc" },
    });
  }

  add(businessId: string, expense: { name: string; amount: number }) {
    return this.prisma.expense.create({
      data: {
        name: expense.name,
        amount: expense.amount,
        businessId,
      },
    });
  }
}
