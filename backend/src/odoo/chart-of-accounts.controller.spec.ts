import { ForbiddenException } from "@nestjs/common";
import { ChartOfAccountsController } from "./chart-of-accounts.controller";

describe("ChartOfAccountsController", () => {
  it("allows only admins to trigger a sync", async () => {
    const service = { sync: jest.fn().mockResolvedValue({ fetched: 1 }) };
    const controller = new ChartOfAccountsController(service as never);

    expect(() => controller.sync({ appUser: { role: "CLERK" }, authUserId: "clerk" })).toThrow(ForbiddenException);
    await expect(controller.sync({ appUser: { role: "ADMIN" }, authUserId: "admin" })).resolves.toEqual({ fetched: 1 });
    expect(service.sync).toHaveBeenCalledWith("admin");
  });
});
