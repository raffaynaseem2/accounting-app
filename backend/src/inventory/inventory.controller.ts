import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { InventoryService } from "./inventory.service";

@UseGuards(AuthGuard)
@Controller("items")
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  private userId(request: any) {
    return request.authUserId;
  }

  @Get()
  list(@Req() request: any, @Query("type") type?: "GOOD" | "SERVICE") {
    return this.inventory.listItems(this.userId(request), type);
  }

  @Post()
  create(@Req() request: any, @Body() body: any) {
    return this.inventory.createItem(this.userId(request), body);
  }

  @Get("movements")
  allMovements(@Req() request: any) {
    return this.inventory.listAllMovements(this.userId(request));
  }

  @Patch(":id")
  update(@Req() request: any, @Param("id") id: string, @Body() body: any) {
    return this.inventory.updateItem(this.userId(request), id, body);
  }

  @Delete(":id")
  remove(@Req() request: any, @Param("id") id: string) {
    return this.inventory.removeItem(this.userId(request), id);
  }

  @Post(":id/movements")
  movement(@Req() request: any, @Param("id") id: string, @Body() body: any) {
    return this.inventory.recordMovement(this.userId(request), id, body);
  }

  @Get(":id/movements")
  movements(@Req() request: any, @Param("id") id: string) {
    return this.inventory.listMovements(this.userId(request), id);
  }

  @Get(":id/activity")
  activity(@Req() request: any, @Param("id") id: string) {
    return this.inventory.getActivity(this.userId(request), id);
  }
}
