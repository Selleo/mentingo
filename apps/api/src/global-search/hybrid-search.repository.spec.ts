import { COURSE_ENROLLMENT, COURSE_STATUSES, LESSON_TYPES, PERMISSIONS } from "@repo/shared";
import { PgDialect } from "drizzle-orm/pg-core";

import { SEARCH_ENTITY_TYPES } from "./global-search.constants";
import { HybridSearchRepository } from "./hybrid-search.repository";

import type { DatabasePg } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";

describe("HybridSearchRepository HNSW retrieval coordination", () => {
  const actor: CurrentUserType = {
    userId: "00000000-0000-0000-0000-000000000001",
    tenantId: "00000000-0000-0000-0000-000000000002",
    email: "reader@example.test",
    permissions: [PERMISSIONS.COURSE_READ],
    roleSlugs: [],
  };
  const embedding = [1, ...Array<number>(1535).fill(0)];
  const match = (id: string, candidateCount: number) => ({
    entityId: id,
    languages: ["en"],
    rank: 0.9,
    candidateCount,
    matchedPassage: "A relevant policy passage",
    matchedAttachmentFileName: null,
  });

  it("keeps scan settings and adaptive candidate queries on one transaction connection", async () => {
    const first = "00000000-0000-0000-0000-000000000003";
    const second = "00000000-0000-0000-0000-000000000004";
    const execute = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([match(first, 200)])
      .mockResolvedValueOnce([match(second, 1)]);
    const outsideExecute = jest.fn();
    const transaction = jest.fn(async (callback) => callback({ execute }));
    const repository = new HybridSearchRepository({
      transaction,
      execute: outsideExecute,
    } as unknown as DatabasePg);
    const candidates = jest.spyOn(repository, "buildSemanticCandidateQuery");

    const rows = await repository.findSemanticMatches(SEARCH_ENTITY_TYPES.COURSE, embedding, actor);

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(outsideExecute).not.toHaveBeenCalled();
    expect(execute).toHaveBeenCalledTimes(3);
    const settings = new PgDialect().sqlToQuery(execute.mock.calls[0][0]);
    expect(settings.sql).toContain("set_config('hnsw.ef_search'");
    expect(settings.sql).toContain("set_config('hnsw.iterative_scan', 'strict_order', true)");
    expect(settings.params).toContain("200");
    expect(candidates).toHaveBeenNthCalledWith(
      1,
      SEARCH_ENTITY_TYPES.COURSE,
      embedding,
      actor,
      200,
      [],
      false,
    );
    expect(candidates).toHaveBeenNthCalledWith(
      2,
      SEARCH_ENTITY_TYPES.COURSE,
      embedding,
      actor,
      400,
      [first],
      false,
    );
    expect(rows.map((row) => row.entityId)).toEqual([first, second]);
    expect(rows[0]).not.toHaveProperty("candidateCount");
  });

  it("bounds expansion to four batches while excluding entities already recovered", async () => {
    const ids = [3, 4, 5, 6].map(
      (ordinal) => `00000000-0000-0000-0000-${String(ordinal).padStart(12, "0")}`,
    );
    const execute = jest.fn().mockResolvedValueOnce([]);
    for (const [index, id] of ids.entries())
      execute.mockResolvedValueOnce([match(id, 200 * 2 ** index)]);
    const transaction = jest.fn(async (callback) => callback({ execute }));
    const repository = new HybridSearchRepository({ transaction } as unknown as DatabasePg);
    const candidates = jest.spyOn(repository, "buildSemanticCandidateQuery");

    expect(
      await repository.findSemanticMatches(SEARCH_ENTITY_TYPES.COURSE, embedding, actor),
    ).toHaveLength(4);
    expect(candidates).toHaveBeenCalledTimes(4);
    expect(candidates).toHaveBeenLastCalledWith(
      SEARCH_ENTITY_TYPES.COURSE,
      embedding,
      actor,
      1600,
      ids.slice(0, 3),
      false,
    );
    expect(execute).toHaveBeenCalledTimes(5);
  });

  it("stops at the relevance floor without an expensive exact fallback", async () => {
    const execute = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ entityId: null, candidateCount: 200 }]);
    const transaction = jest.fn(async (callback) => callback({ execute }));
    const repository = new HybridSearchRepository({ transaction } as unknown as DatabasePg);
    expect(
      await repository.findSemanticMatches(SEARCH_ENTITY_TYPES.COURSE, embedding, actor),
    ).toEqual([]);
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it("returns recovered entities when a later ANN batch has no candidates", async () => {
    const first = "00000000-0000-0000-0000-000000000003";
    const execute = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([match(first, 200)])
      .mockResolvedValueOnce([{ entityId: null, candidateCount: 0 }]);
    const transaction = jest.fn(async (callback) => callback({ execute }));
    const repository = new HybridSearchRepository({ transaction } as unknown as DatabasePg);
    const rows = await repository.findSemanticMatches(SEARCH_ENTITY_TYPES.COURSE, embedding, actor);
    expect(rows.map((row) => row.entityId)).toEqual([first]);
    expect(execute).toHaveBeenCalledTimes(3);
  });

  it("returns no semantic matches without another query when ANN has no candidates", async () => {
    const execute = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ entityId: null, candidateCount: 0 }]);
    const transaction = jest.fn(async (callback) => callback({ execute }));
    const repository = new HybridSearchRepository({ transaction } as unknown as DatabasePg);
    expect(
      await repository.findSemanticMatches(SEARCH_ENTITY_TYPES.COURSE, embedding, actor),
    ).toEqual([]);
    expect(execute).toHaveBeenCalledTimes(2);
  });
});

describe("HybridSearchRepository MCP learner lesson eligibility", () => {
  const actor: CurrentUserType = {
    userId: "00000000-0000-0000-0000-000000000001",
    tenantId: "00000000-0000-0000-0000-000000000002",
    email: "reader@example.test",
    permissions: [
      PERMISSIONS.COURSE_READ,
      PERMISSIONS.COURSE_READ_ASSIGNED,
      PERMISSIONS.COURSE_UPDATE,
    ],
    roleSlugs: ["admin"],
  };
  const dialect = new PgDialect();

  it("filters lesson documents and actor entitlement before keyword rank and semantic candidate limits", async () => {
    const execute = jest.fn().mockResolvedValue([]);
    const repository = new HybridSearchRepository({ execute } as unknown as DatabasePg);
    await repository.findKeywordMatches(SEARCH_ENTITY_TYPES.LESSON, "policy", actor, false, true);
    const keyword = dialect.sqlToQuery(execute.mock.calls[0][0]);
    const semantic = dialect.sqlToQuery(
      repository.buildSemanticCandidateQuery(
        SEARCH_ENTITY_TYPES.LESSON,
        [1, 0],
        actor,
        200,
        [],
        false,
        true,
      ),
    );
    for (const query of [keyword, semantic]) {
      expect(query.sql).toContain("e.is_archived = false");
      expect(query.sql).toContain("e.price_in_cents = 0");
      for (const alias of ["l", "ch", "e", "sc"])
        expect(query.sql).toContain(`${alias}.tenant_id =`);
      expect(query.sql).toContain("sc.student_id =");
      expect(query.sql).not.toContain("e.author_id");
      expect(query.sql).toContain("s.metadata->>'resourceId' IS NULL");
      expect(query.sql).toContain("s.document_type =");
      expect(query.sql).toContain("AND l.type =");
      expect(query.params).toEqual(
        expect.arrayContaining([
          actor.userId,
          actor.tenantId,
          COURSE_STATUSES.PUBLISHED,
          COURSE_STATUSES.PRIVATE,
          COURSE_ENROLLMENT.ENROLLED,
          LESSON_TYPES.CONTENT,
          "title",
          "description",
        ]),
      );
      expect(query.sql.indexOf("e.is_archived = false")).toBeLessThan(query.sql.indexOf("LIMIT"));
    }
    const sourceBranch = keyword.sql.split("UNION ALL")[0];
    const gate = sourceBranch.match(/AND \$(\d+)\s+AND/);
    expect(gate).not.toBeNull();
    expect(keyword.params[Number(gate![1]) - 1]).toBe(false);
  });

  it("does not substitute management permissions when learner permissions are absent", async () => {
    const repository = new HybridSearchRepository({} as DatabasePg);
    const query = dialect.sqlToQuery(
      repository.buildSemanticCandidateQuery(
        SEARCH_ENTITY_TYPES.LESSON,
        [1],
        { ...actor, permissions: [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN] },
        200,
        [],
        false,
        true,
      ),
    );
    expect(query.sql).toContain("((false) OR (false))");
    expect(query.sql).not.toContain("e.author_id");
    expect(query.sql).not.toContain("student_courses");
  });
});
