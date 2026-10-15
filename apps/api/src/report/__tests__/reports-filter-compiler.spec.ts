import { PgDialect } from "drizzle-orm/pg-core";

import { compileReportsFilter } from "../reports-filter-compiler";

import type { ReportFilter } from "../schemas/reports.schema";

const dialect = new PgDialect();
const compile = (filter: ReportFilter) =>
  dialect.sqlToQuery(compileReportsFilter(filter, "Europe/Warsaw"));

describe("reports SQL filter compiler", () => {
  it("keeps nested OR expressions parenthesized under the outer AND", () => {
    const result = compile({
      match: "all",
      rules: [
        { field: "status", operator: "eq", value: "completed" },
        {
          match: "any",
          rules: [
            { field: "score", operator: "gte", value: 80 },
            { field: "attempts", operator: "lte", value: 2 },
          ],
        },
      ],
    });
    expect(result.sql.toUpperCase()).toContain(" AND ");
    expect(result.sql.toUpperCase()).toContain(" OR ");
    expect(result.params).toEqual(expect.arrayContaining(["completed", 80, 2]));
  });

  it("turns local calendar dates into timezone-aware day boundaries", () => {
    const result = compile({
      match: "all",
      rules: [{ field: "completedAt", operator: "eq", value: "2026-10-09" }],
    });
    expect(result.sql).toContain("AT TIME ZONE");
    expect(result.params).toContain("Europe/Warsaw");
    expect(result.params).toContain("2026-10-09");
  });

  it("uses current group membership in a parameterized EXISTS condition", () => {
    const id = "33333333-3333-4333-8333-333333333333";
    const result = compile({
      match: "all",
      rules: [{ field: "groupId", operator: "eq", value: id }],
    });
    expect(result.sql.toUpperCase()).toContain("EXISTS");
    expect(result.sql).toContain("group_users");
    expect(result.params).toContain(id);
  });

  it("matches selected learner UUIDs by identity as well as learner name and email", () => {
    const id = "33333333-3333-4333-8333-333333333333";
    const result = compile({
      match: "all",
      rules: [{ field: "learner", operator: "eq", value: id }],
    });
    expect(result.sql).toContain("learner_id");
    expect(result.sql).toContain("learner_name ILIKE ANY");
    expect(result.params).toContain(id);
  });
});
