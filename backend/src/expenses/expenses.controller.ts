import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { AuthGuard } from "../auth/auth.guard";


@UseGuards(AuthGuard)
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get()
  getAll(@Req() request: any) {
    if (!request.appUser) {
      throw new ForbiddenException("User is not linked to a business");
    }

    return this.expensesService.getAll(request.appUser.businessId);
  }

  @Post()
  add(@Req() request: any, @Body() body: any) {
    if (!request.appUser) {
      throw new ForbiddenException("User is not linked to a business");
    }

    return this.expensesService.add(request.appUser.businessId, {
      name: body.name,
      amount: Number(body.amount),
    });
  }
}
