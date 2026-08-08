import { sql } from "drizzle-orm";

import { dbAls } from "./db-als.store";
import { MissingTenantContextError, TenantContextConflictError } from "./db-errors";
import { TenantDbRunnerService } from "./tenant-db-runner.service";

import type { DatabasePg } from "src/common";

describe("TenantDbRunnerService", () => {
  const transaction = {
    execute: jest.fn(),
  } as unknown as DatabasePg;
  const dbBase = {
    transaction: jest.fn(),
  } as unknown as DatabasePg;
  let runner: TenantDbRunnerService;

  beforeEach(() => {
    jest.clearAllMocks();
    dbAls.disable();
    dbBase.transaction = jest.fn(async (callback: (trx: DatabasePg) => Promise<unknown>) =>
      callback(transaction),
    ) as DatabasePg["transaction"];
    transaction.execute = jest.fn().mockResolvedValue([]) as DatabasePg["execute"];
    runner = new TenantDbRunnerService(dbBase);
  });

  afterEach(() => {
    dbAls.disable();
  });

  it("establishes tenant context without opening a transaction", async () => {
    const result = await runner.runWithTenantContext("tenant-a", async () => {
      expect(dbAls.getStore()).toEqual({ tenantId: "tenant-a", trx: undefined });
      return "ok";
    });

    expect(result).toBe("ok");
    expect(dbBase.transaction).not.toHaveBeenCalled();
  });

  it("keeps the compatibility runWithTenant entrypoint context-only", async () => {
    await runner.runWithTenant("tenant-a", async () => {
      expect(dbAls.getStore()).toEqual({ tenantId: "tenant-a", trx: undefined });
    });

    expect(dbBase.transaction).not.toHaveBeenCalled();
  });

  it("keeps tenant context while awaiting a lazy query thenable", async () => {
    let tenantIdAtExecution: string | undefined;
    const lazyQuery = {
      then: (resolve: (value: string) => void) => {
        tenantIdAtExecution = dbAls.getStore()?.tenantId;
        resolve("ok");
      },
    } as PromiseLike<string>;

    const result = await runner.runWithTenant("tenant-a", () => lazyQuery);

    expect(result).toBe("ok");
    expect(tenantIdAtExecution).toBe("tenant-a");
  });

  it("starts a transaction and sets the tenant locally", async () => {
    const result = await runner.runWithTenantContext("tenant-a", () =>
      runner.transaction(async () => {
        expect(dbAls.getStore()).toEqual({ tenantId: "tenant-a", trx: transaction });
        return "ok";
      }),
    );

    expect(result).toBe("ok");
    expect(dbBase.transaction).toHaveBeenCalledTimes(1);
    expect(transaction.execute).toHaveBeenCalledWith(
      sql`SELECT set_config('app.tenant_id', ${"tenant-a"}, true)`,
    );
  });

  it("reuses an active transaction", async () => {
    const result = await dbAls.run({ tenantId: "tenant-a", trx: transaction }, () =>
      runner.transaction(() => "ok"),
    );

    expect(result).toBe("ok");
    expect(dbBase.transaction).not.toHaveBeenCalled();
    expect(transaction.execute).not.toHaveBeenCalled();
  });

  it("rejects transaction work without tenant context", async () => {
    await expect(runner.transaction(() => "ok")).rejects.toThrow(MissingTenantContextError);
    expect(dbBase.transaction).not.toHaveBeenCalled();
  });

  it("rejects switching tenants inside an active transaction", async () => {
    await expect(
      dbAls.run({ tenantId: "tenant-a", trx: transaction }, () =>
        runner.runWithTenantContext("tenant-b", () => "ok"),
      ),
    ).rejects.toThrow(TenantContextConflictError);
  });

  it("supports sequential tenant transaction phases", async () => {
    await runner.runWithTenantContext("tenant-a", async () => {
      await runner.transaction(() => "first");
      dbAls.disable();
      await runner.runWithTenantContext("tenant-a", () => runner.transaction(() => "second"));
    });

    expect(dbBase.transaction).toHaveBeenCalledTimes(2);
  });
});
