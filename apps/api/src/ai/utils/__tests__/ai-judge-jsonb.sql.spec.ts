import { PgDialect } from "drizzle-orm/pg-core";

import { aiJudgeCriteria, aiMentorPracticeSessions } from "src/storage/schema";

import { getLocalizedJsonbValueSql } from "../ai-judge-jsonb.sql";

describe("getLocalizedJsonbValueSql", () => {
  it("keeps object localization and scalar JSONB compatibility in one expression", () => {
    const query = new PgDialect().sqlToQuery(
      getLocalizedJsonbValueSql(aiJudgeCriteria.title, aiMentorPracticeSessions.language),
    ).sql;

    expect(query).toContain("jsonb_typeof");
    expect(query).toContain("jsonb_each_text");
    expect(query).toContain("#>> '{}'");
    expect(query).toContain("->>");
  });
});
