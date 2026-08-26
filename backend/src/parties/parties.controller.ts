import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { PartiesService } from "./parties.service";

@UseGuards(AuthGuard)
@Controller()
export class PartiesController {
  constructor(private readonly service: PartiesService) {}

  private context(request: any) {
    return request.authUserId;
  }

  @Get("customers/with-balances") listCustomersWithBalances(@Req() request: any) { return this.service.listWithBalances(this.context(request), "CUSTOMER"); }
  @Get("customers") listCustomers(@Req() request: any) { return this.service.list(this.context(request), "CUSTOMER"); }
  @Post("customers") createCustomer(@Req() request: any, @Body() body: any) { return this.service.create(this.context(request), "CUSTOMER", body); }
  @Get("customers/:id") getCustomer(@Req() request: any, @Param("id") id: string) { return this.service.get(this.context(request), "CUSTOMER", id); }
  @Get("customers/:id/balance") customerBalance(@Req() request: any, @Param("id") id: string) { return this.service.balance(this.context(request), "CUSTOMER", id); }
  @Patch("customers/:id") updateCustomer(@Req() request: any, @Param("id") id: string, @Body() body: any) { return this.service.update(this.context(request), "CUSTOMER", id, body); }

  @Get("suppliers/with-balances") listSuppliersWithBalances(@Req() request: any) { return this.service.listWithBalances(this.context(request), "SUPPLIER"); }
  @Get("suppliers") listSuppliers(@Req() request: any) { return this.service.list(this.context(request), "SUPPLIER"); }
  @Post("suppliers") createSupplier(@Req() request: any, @Body() body: any) { return this.service.create(this.context(request), "SUPPLIER", body); }
  @Get("suppliers/:id") getSupplier(@Req() request: any, @Param("id") id: string) { return this.service.get(this.context(request), "SUPPLIER", id); }
  @Get("suppliers/:id/balance") supplierBalance(@Req() request: any, @Param("id") id: string) { return this.service.balance(this.context(request), "SUPPLIER", id); }
  @Patch("suppliers/:id") updateSupplier(@Req() request: any, @Param("id") id: string, @Body() body: any) { return this.service.update(this.context(request), "SUPPLIER", id, body); }
}
