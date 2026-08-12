import { sql } from "drizzle-orm";
import { PgDialect, pgTable, uuid } from "drizzle-orm/pg-core";

import { dbAls } from "./db-als.store";
import { createTenantAwareDb } from "./tenant-aware-session";

import type { PgSession } from "drizzle-orm/pg-core";
import type { DatabasePg } from "src/common";

describe("createTenantAwareDb", () => {
  const users = pgTable("users", { id: uuid("id") });
  const dialect = new PgDialect();
  const basePrepared = {
    execute: jest.fn().mockResolvedValue([{ source: "base" }]),
    all: jest.fn().mockResolvedValue([{ source: "base" }]),
  };
  const transactionPrepared = {
    execute: jest.fn().mockResolvedValue([{ source: "transaction" }]),
    all: jest.fn().mockResolvedValue([{ source: "transaction" }]),
  };
  const baseSession = {
    prepareQuery: jest.fn(() => basePrepared),
  } as unknown as PgSession;
  const transactionSession = {
    prepareQuery: jest.fn(() => transactionPrepared),
  } as unknown as PgSession;
  const transaction = { session: transactionSession } as unknown as DatabasePg;
  const baseDb = {
    dialect,
    session: baseSession,
    _: { schema: undefined, fullSchema: {}, tableNamesMap: {}, session: baseSession },
  } as unknown as DatabasePg;

  const runner = {
    transaction: jest.fn(async (callback: () => Promise<unknown>) =>
      dbAls.run({ tenantId: "tenant-a", trx: transaction }, callback),
    ),
    transactionWithHandle: jest.fn(),
  };
  const typedRunner = runner as unknown as Parameters<typeof createTenantAwareDb>[1];

  beforeEach(() => {
    jest.clearAllMocks();
    dbAls.disable();
  });

  afterEach(() => {
    dbAls.disable();
  });

  it("executes direct DB queries on a short tenant transaction", async () => {
    const db = createTenantAwareDb(baseDb, typedRunner);

    const result = await db.execute(sql`select 1`);

    expect(result).toEqual([{ source: "transaction" }]);
    expect(runner.transaction).toHaveBeenCalledTimes(1);
    expect(transactionSession.prepareQuery).toHaveBeenCalledTimes(1);
    expect(baseSession.prepareQuery).not.toHaveBeenCalled();
  });

  it("covers the existing fluent select builder without changing the call site", async () => {
    const db = createTenantAwareDb(baseDb, typedRunner);

    const result = await db.select().from(users);

    expect(result).toEqual([{ source: "transaction" }]);
    expect(runner.transaction).toHaveBeenCalledTimes(1);
    expect(transactionSession.prepareQuery).toHaveBeenCalledTimes(1);
  });

  it("keeps explicit transaction handles available to existing service code", async () => {
    runner.transactionWithHandle.mockImplementation(
      async (callback: (trx: DatabasePg) => Promise<unknown>) =>
        dbAls.run({ tenantId: "tenant-a", trx: transaction }, () => callback(transaction)),
    );
    const db = createTenantAwareDb(baseDb, typedRunner);

    await db.transaction(async (trx) => {
      expect(trx).toBe(transaction);
      await db.execute(sql`select 1`);
    });

    expect(runner.transactionWithHandle).toHaveBeenCalledTimes(1);
    expect(runner.transaction).toHaveBeenCalledTimes(1);
  });
});
