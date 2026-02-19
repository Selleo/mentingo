import { Inject, Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { tenants } from "src/storage/schema";

import { dbAls } from "./db-als.store";
import { DB_APP } from "./db.providers";

@Injectable()
export class TenantDbRunnerService {
  constructor(@Inject(DB_APP) private readonly dbBase: DatabasePg) {}

  async runWithTenant<T>(tenantId: string, fn: () => Promise<T>) {
    return this.dbBase.transaction(async (trx) => {
      await trx.execute(sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`);
      return dbAls.run({ tenantId, trx }, fn);
    });
  }

  async runForEachTenant(fn: (tenantId: string) => Promise<unknown>) {
    const tenantIds = await this.dbBase.select({ id: tenants.id }).from(tenants);

    for (const { id } of tenantIds) {
      await this.runWithTenant(id, () => fn(id));
    }
  }
}
