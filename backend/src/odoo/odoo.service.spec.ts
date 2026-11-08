import { UnauthorizedException } from "@nestjs/common";
import * as xmlrpc from "xmlrpc";
import { OdooService } from "./odoo.service";

jest.mock("xmlrpc", () => ({
  createSecureClient: jest.fn(),
}));

describe("OdooService", () => {
  const createSecureClient = xmlrpc.createSecureClient as jest.Mock;
  const commonMethodCall = jest.fn();
  const objectMethodCall = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    createSecureClient
      .mockReturnValueOnce({ methodCall: commonMethodCall })
      .mockReturnValueOnce({ methodCall: objectMethodCall });
    process.env.ODOO_URL = "https://example.odoo.com";
    process.env.ODOO_DB = "example";
    process.env.ODOO_USERNAME = "user@example.com";
    process.env.ODOO_API_KEY = "secret";
  });

  it("authenticates and executes execute_kw with the configured Odoo credentials", async () => {
    commonMethodCall.mockImplementation((_method: string, _params: unknown[], callback: Function) => callback(null, 42));
    objectMethodCall.mockImplementation((_method: string, _params: unknown[], callback: Function) => callback(null, [{ id: 1 }]));

    const result = await new OdooService().executeKw("account.account", "search_read", [[]], { fields: ["id"] });

    expect(result).toEqual([{ id: 1 }]);
    expect(commonMethodCall).toHaveBeenCalledWith("authenticate", ["example", "user@example.com", "secret", {}], expect.any(Function));
    expect(objectMethodCall).toHaveBeenCalledWith(
      "execute_kw",
      ["example", 42, "secret", "account.account", "search_read", [[]], { fields: ["id"] }],
      expect.any(Function),
    );
  });

  it("rejects invalid Odoo authentication", async () => {
    commonMethodCall.mockImplementation((_method: string, _params: unknown[], callback: Function) => callback(null, false));

    await expect(new OdooService().authenticate()).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("fails clearly when Odoo configuration is missing", async () => {
    delete process.env.ODOO_API_KEY;

    await expect(new OdooService().authenticate()).rejects.toThrow("ODOO_API_KEY is not configured");
  });
});
