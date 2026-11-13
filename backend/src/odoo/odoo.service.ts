import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import * as xmlrpc from "xmlrpc";

type XmlRpcClient = { methodCall: (method: string, params: unknown[], callback: (error: Error | null, value?: unknown) => void) => void };

@Injectable()
export class OdooService {
  private readonly logger = new Logger(OdooService.name);

  private config() {
    const values = {
      url: process.env.ODOO_URL?.replace(/\/$/, ""),
      db: process.env.ODOO_DB,
      username: process.env.ODOO_USERNAME,
      apiKey: process.env.ODOO_API_KEY,
    };
    const missing = Object.entries(values).find(([, value]) => !value)?.[0];
    if (missing) {
      const envName = { url: "ODOO_URL", db: "ODOO_DB", username: "ODOO_USERNAME", apiKey: "ODOO_API_KEY" }[missing] ?? missing;
      throw new Error(`${envName} is not configured`);
    }
    return values as { url: string; db: string; username: string; apiKey: string };
  }

  private client(path: string): XmlRpcClient {
    const config = this.config();
    const url = new URL(config.url);
    const options = { host: url.hostname, port: Number(url.port) || (url.protocol === "https:" ? 443 : 80), path };
    return (url.protocol === "https:" ? xmlrpc.createSecureClient(options) : xmlrpc.createClient(options)) as unknown as XmlRpcClient;
  }

  private call(client: XmlRpcClient, method: string, params: unknown[]) {
    return new Promise<unknown>((resolve, reject) => {
      client.methodCall(method, params, (error, value) => error ? reject(error) : resolve(value));
    });
  }

  async authenticate(): Promise<number> {
    const config = this.config();
    try {
      const uid = await this.call(this.client("/xmlrpc/2/common"), "authenticate", [config.db, config.username, config.apiKey, {}]);
      if (typeof uid !== "number" || uid <= 0) throw new UnauthorizedException("Odoo authentication failed");
      return uid;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      this.logger.error(`Odoo authentication failed: ${error instanceof Error ? error.message : String(error)}`);
      throw new UnauthorizedException("Odoo authentication failed");
    }
  }

  async executeKw<T>(model: string, method: string, args: unknown[], kwargs: Record<string, unknown> = {}): Promise<T> {
    const config = this.config();
    const uid = await this.authenticate();
    try {
      return await this.call(this.client("/xmlrpc/2/object"), "execute_kw", [config.db, uid, config.apiKey, model, method, args, kwargs]) as T;
    } catch (error) {
      this.logger.error(`Odoo execute_kw failed for ${model}.${method}: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error("Odoo model request failed");
    }
  }
}
