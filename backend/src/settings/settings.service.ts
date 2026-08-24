import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}
  async getBusiness(businessId: string) { const business = await this.prisma.business.findUnique({ where: { id: businessId }, select: { id: true, name: true, email: true } }); if (!business) throw new NotFoundException("Business not found"); return business; }
  async updateBusiness(businessId: string, input: { name?: string; email?: string | null }) { const name = input.name?.trim(); if (name === "") throw new BadRequestException("Business name is required"); const email = input.email?.trim() || null; if (email && !/^\S+@\S+\.\S+$/.test(email)) throw new BadRequestException("Business email is invalid"); return this.prisma.business.update({ where: { id: businessId }, data: { ...(name !== undefined ? { name } : {}), ...(input.email !== undefined ? { email } : {}) }, select: { id: true, name: true, email: true } }); }
}
