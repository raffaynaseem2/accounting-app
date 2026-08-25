import {
  Body,
  Controller,
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
    return this.expensesService.getAll(request.authUserId);
  }

  @Post()
  add(@Req() request: any, @Body() body: any) {
    return this.expensesService.add(request.authUserId, {
      name: body.name,
      amount: Number(body.amount),
    });
  }
}
