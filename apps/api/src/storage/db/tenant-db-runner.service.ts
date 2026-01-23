import { Inject, Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";

import { DatabasePg } from "src/common";

import { dbAls } from "./db-als.store";
import { DB_BASE } from "./db.providers";

@Injectable()
export class TenantDbRunnerService {
  constructor(@Inject(DB_BASE) private readonly dbBase: DatabasePg) {}

  async runWithTenant<T>(tenantId: string, fn: () => Promise<T>) {
    return this.dbBase.transaction(async (trx) => {
      await trx.execute(sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`);
      return dbAls.run({ tenantId, trx }, fn);
    });
  }
}
