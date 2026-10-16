import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pg-proxy";

import { LearningPathRepository } from "./learning-path.repository";

// Exercise the real Drizzle list query, without requiring a running PostgreSQL server.
describe("LearningPathRepository list ordering", () => {
  it.each([true, false])(
    "loads oldest paths first with a deterministic tie-breaker (canReadAll=%s)",
    async (canReadAll) => {
      const queries: string[] = [];
      const db = drizzle(async (query) => {
        queries.push(query);
        return { rows: query.includes("count(*)") ? [[0]] : [] };
      });
      const localizationService = {
        getLocalizedSqlField: (column: unknown) => sql`${column}`,
      };
      const repository: LearningPathRepository = Reflect.construct(LearningPathRepository, [
        db,
        db,
        localizationService,
      ]);
      const query = {
        visibility: {
          canReadAll,
          canReadOwn: false,
          studentId: "00000000-0000-0000-0000-000000000001",
        },
      };

      await repository.getLearningPaths(query);
      await repository.getLearningPaths(query);

      const listQueries = queries.filter((statement) => !statement.includes("count(*)"));
      expect(listQueries).toHaveLength(2);
      for (const statement of listQueries) {
        expect(statement).toMatch(
          /order by "learning_paths"\."created_at" asc, "learning_paths"\."id" asc/,
        );
      }
      expect(listQueries[1]).toBe(listQueries[0]);
    },
  );
});
