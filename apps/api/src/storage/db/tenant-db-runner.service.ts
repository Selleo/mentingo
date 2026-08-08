import { Inject, Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { tenants } from "src/storage/schema";

import { dbAls } from "./db-als.store";
import { MissingTenantContextError, TenantContextConflictError } from "./db-errors";
import { DB_APP } from "./db.providers";

import type { PgTransactionConfig } from "drizzle-orm/pg-core/session";

type TenantCallback<T> = () => T | PromiseLike<T>;

@Injectable()
export class TenantDbRunnerService {
  constructor(@Inject(DB_APP) private readonly dbBase: DatabasePg) {}

  async runWithTenantContext<T>(tenantId: string, fn: TenantCallback<T>): Promise<T> {
    const current = dbAls.getStore();

    if (current?.trx && current.tenantId !== tenantId) {
      throw new TenantContextConflictError(current.tenantId, tenantId);
    }

    return dbAls.run({ tenantId, trx: current?.trx }, async () => await fn());
  }

  async transaction<T>(fn: TenantCallback<T>): Promise<T> {
    if (dbAls.getStore()?.trx) {
      return await fn();
    }

    return this.transactionWithHandle(() => fn());
  }

  async transactionWithHandle<T>(
    fn: (trx: DatabasePg) => T | PromiseLike<T>,
    config?: PgTransactionConfig,
  ): Promise<T> {
    const current = dbAls.getStore();

    if (!current?.tenantId) {
      throw new MissingTenantContextError();
    }

    if (current.trx) {
      return await current.trx.transaction(async (nestedTrx) =>
        dbAls.run({ ...current, trx: nestedTrx }, async () => await fn(nestedTrx)),
      );
    }

    return this.dbBase.transaction(async (trx) => {
      await trx.execute(sql`SELECT set_config('app.tenant_id', ${current.tenantId}, true)`);
      return dbAls.run({ ...current, trx }, async () => await fn(trx));
    }, config);
  }

  async runWithTenantTransaction<T>(tenantId: string, fn: TenantCallback<T>): Promise<T> {
    return this.runWithTenantContext(tenantId, () => this.transaction(fn));
  }

  async runWithTenant<T>(tenantId: string, fn: TenantCallback<T>): Promise<T> {
    return this.runWithTenantContext(tenantId, fn);
  }

  async runForEachTenant(fn: (tenantId: string) => Promise<unknown>) {
    const tenantIds = await this.dbBase.select({ id: tenants.id }).from(tenants);

    for (const { id } of tenantIds) {
      await this.runWithTenant(id, () => fn(id));
    }
  }
}
