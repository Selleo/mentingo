import { PgDialect } from "drizzle-orm/pg-core";

import { dbAls } from "src/storage/db/db-als.store";

import { SemanticSearchIndexRepository } from "./semantic-search-index.repository";

const source = {
  entityType: "articles",
  entityId: "entity",
  documentType: "content",
  language: "en",
  content: "Policy",
  sourceHash: "old-hash",
  sourceRevision: "",
  metadata: {},
  resourceReference: null,
  resourceContentType: null,
};

describe("semantic search activation revision guard", () => {
  it("leaves the prior index intact if source changed during embedding", async () => {
    const query = {
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      for: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([{ hash: "new-hash" }]),
    };
    const trx = { select: jest.fn().mockReturnValue(query), delete: jest.fn(), insert: jest.fn() };
    const db = { transaction: jest.fn().mockImplementation((callback) => callback(trx)) };
    const repository = new SemanticSearchIndexRepository(db as never);
    expect(
      await dbAls.run({ tenantId: "tenant-a" }, () =>
        repository.replace(source as never, ["Policy"], [Array(1536).fill(0.1)]),
      ),
    ).toBe(false);
    expect(trx.delete).not.toHaveBeenCalled();
    expect(trx.insert).not.toHaveBeenCalled();
  });
  it("denies work without tenant context before touching the database", async () => {
    const db = { delete: jest.fn(), transaction: jest.fn(), execute: jest.fn(), select: jest.fn() };
    const repository = new SemanticSearchIndexRepository(db as never);
    await expect(repository.deleteSource(source as never)).rejects.toThrow(
      "Tenant context is required",
    );
    await expect(repository.replace(source as never, [], [])).rejects.toThrow(
      "Tenant context is required",
    );
    await expect(repository.previewPendingCount(50)).rejects.toThrow("Tenant context is required");
    await expect(repository.findPending(50)).rejects.toThrow("Tenant context is required");
    await expect(repository.synchronizeResourceDocuments()).rejects.toThrow(
      "Tenant context is required",
    );
    await expect(repository.cleanupDeleted()).rejects.toThrow("Tenant context is required");
    expect(Object.values(db).every((method) => method.mock.calls.length === 0)).toBe(true);
  });

  it("puts explicit tenant identity in deletes even when database RLS is bypassed", async () => {
    const where = jest.fn().mockResolvedValue(undefined);
    const repository = new SemanticSearchIndexRepository({
      delete: jest.fn().mockReturnValue({ where }),
    } as never);
    await dbAls.run({ tenantId: "tenant-a" }, () => repository.deleteSource(source as never));
    const query = new PgDialect().sqlToQuery(where.mock.calls[0][0]);
    expect(query.sql).toContain('"search_chunks"."tenant_id"');
    expect(query.params).toContain("tenant-a");
  });
});
