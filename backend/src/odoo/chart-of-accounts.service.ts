import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { OdooService } from "./odoo.service";
import { transformOdooAccounts } from "./chart-of-accounts.transformer";

const ODOO_ACCOUNT_FIELDS = ["id", "code", "name", "account_type", "current_balance"];

@Injectable()
export class ChartOfAccountsService {
  private readonly logger = new Logger(ChartOfAccountsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly odoo: OdooService,
  ) {}

  async sync(requestingUserId: string) {
    const rows = await this.odoo.executeKw<unknown[]>(
      "account.account",
      "search_read",
      [[]],
      { fields: ODOO_ACCOUNT_FIELDS, order: "code asc" },
    );
    const transformed = transformOdooAccounts(Array.isArray(rows) ? rows : []);
    const lastSyncedAt = new Date();
    let created = 0;
    let updated = 0;

    await this.prisma.$transaction(async (tx) => {
      for (const account of transformed.accounts) {
        const existing = await tx.account.findUnique({ where: { odooAccountId: account.odooAccountId }, select: { id: true } });
        await tx.account.upsert({
          where: { odooAccountId: account.odooAccountId },
          create: {
            userId: null,
            isGlobal: true,
            odooAccountId: account.odooAccountId,
            odooAccountType: account.odooAccountType,
            odooBalance: account.odooBalance,
            lastSyncedAt,
            code: account.code,
            name: account.name,
            type: account.type,
            subledgerType: "NONE",
          },
          update: {
            userId: null,
            isGlobal: true,
            odooAccountType: account.odooAccountType,
            odooBalance: account.odooBalance,
            lastSyncedAt,
            code: account.code,
            name: account.name,
            type: account.type,
            isActive: true,
          },
        });
        if (existing) updated += 1;
        else created += 1;
      }
    });

    this.logger.log(`Odoo CoA sync by ${requestingUserId}: fetched=${rows.length}, created=${created}, updated=${updated}, skipped=${transformed.skipped.length}`);
    if (transformed.skipped.length) this.logger.warn(`Skipped Odoo accounts: ${transformed.skipped.join("; ")}`);
    return { fetched: rows.length, created, updated, skipped: transformed.skipped.length, lastSyncedAt };
  }
}
