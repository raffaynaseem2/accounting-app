import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { InventoryService } from "./inventory.service";

@UseGuards(AuthGuard)
@Controller("items")
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  private businessId(request: any) {
    if (!request.appUser) throw new ForbiddenException("User is not linked to a business");
    return request.appUser.businessId;
  }

  @Get()
  list(@Req() request: any, @Query("type") type?: "GOOD" | "SERVICE") {
    return this.inventory.listItems(this.businessId(request), type);
  }

  @Post()
  create(@Req() request: any, @Body() body: any) {
    return this.inventory.createItem(this.businessId(request), body);
  }

  @Get("movements")
  allMovements(@Req() request: any) {
    return this.inventory.listAllMovements(this.businessId(request));
  }

  @Patch(":id")
  update(@Req() request: any, @Param("id") id: string, @Body() body: any) {
    return this.inventory.updateItem(this.businessId(request), id, body);
  }

  @Delete(":id")
  remove(@Req() request: any, @Param("id") id: string) {
    return this.inventory.removeItem(this.businessId(request), id);
  }

  @Post(":id/movements")
  movement(@Req() request: any, @Param("id") id: string, @Body() body: any) {
    return this.inventory.recordMovement(this.businessId(request), id, body);
  }

  @Get(":id/movements")
  movements(@Req() request: any, @Param("id") id: string) {
    return this.inventory.listMovements(this.businessId(request), id);
  }

  @Get(":id/activity")
  activity(@Req() request: any, @Param("id") id: string) {
    return this.inventory.getActivity(this.businessId(request), id);
  }
}
