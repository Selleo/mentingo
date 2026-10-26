import { PgDialect } from "drizzle-orm/pg-core";

import { users } from "src/storage/schema";

import { McpActorRepository } from "./mcp-actor.repository";

describe("McpActorRepository native identity", () => {
  it("reads fresh active account data within its tenant and retains every account boundary", async () => {
    let rows = [{ email: "fixture@example.com" }];
    const query = { from: jest.fn(), where: jest.fn(), limit: jest.fn(async () => rows) };
    query.from.mockReturnValue(query);
    query.where.mockReturnValue(query);
    const runWithTenant = jest.fn((_tenantId, callback) => callback());
    const repository = new McpActorRepository(
      { select: () => query } as never,
      { runWithTenant } as never,
    );
    const actor = { tenantId: "tenant-isolated", userId: "user-isolated" };
    await expect(repository.findActiveAccount(actor)).resolves.toEqual(rows[0]);
    rows = [];
    await expect(repository.findActiveAccount(actor)).resolves.toBeUndefined();
    expect(query.from).toHaveBeenCalledWith(users);
    expect(query.limit).toHaveBeenCalledTimes(2);
    const statement = new PgDialect().sqlToQuery(query.where.mock.calls[0][0]);
    expect(statement.params).toEqual([actor.userId, actor.tenantId, false]);
    expect(statement.sql).toContain('"users"."id" =');
    expect(statement.sql).toContain('"users"."tenant_id" =');
    expect(statement.sql).toContain('"users"."archived" =');
    expect(statement.sql).toContain('"users"."deleted_at" IS NULL');
    expect(runWithTenant).toHaveBeenCalledWith(actor.tenantId, expect.any(Function));
  });
});
