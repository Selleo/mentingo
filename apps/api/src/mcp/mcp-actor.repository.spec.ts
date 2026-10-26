import { PgDialect } from "drizzle-orm/pg-core";

import { users } from "src/storage/schema";

import { McpActorRepository } from "./mcp-actor.repository";

describe("McpActorRepository native identity", () => {
  it("reads fresh active account data using the caller-established tenant context", async () => {
    let rows = [{ email: "fixture@example.com" }];
    const query = { from: jest.fn(), where: jest.fn(), limit: jest.fn(async () => rows) };
    query.from.mockReturnValue(query);
    query.where.mockReturnValue(query);
    const repository = new McpActorRepository({ select: () => query } as never);
    const userId = "user-isolated";
    await expect(repository.findActiveAccount(userId)).resolves.toEqual(rows[0]);
    rows = [];
    await expect(repository.findActiveAccount(userId)).resolves.toBeUndefined();
    expect(query.from).toHaveBeenCalledWith(users);
    expect(query.limit).toHaveBeenCalledTimes(2);
    const statement = new PgDialect().sqlToQuery(query.where.mock.calls[0][0]);
    expect(statement.params).toEqual([userId, false]);
    expect(statement.sql).toContain('"users"."id" =');
    expect(statement.sql).toContain('"users"."archived" =');
    expect(statement.sql).toContain('"users"."deleted_at" IS NULL');
  });
});
