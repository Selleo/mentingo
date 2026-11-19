import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

import {
  buildActivityRankingsProjection,
  buildCourseActivityCtes,
} from "./reports-course-activity";

const period = { from: "2026-01-01", to: "2026-01-31" };

describe("course activity aggregation", () => {
  it("counts distinct learners from all filtered course keys, using local inclusive dates rather than the latest activity date", () => {
    const statement = new PgDialect().sqlToQuery(
      buildCourseActivityCtes({
        period,
        timezone: "Europe/Warsaw",
        tenantId: "tenant",
        courseCandidates: sql`SELECT tenant_id, id AS course_id, title AS label FROM visible_courses`,
        pathView: false,
      }),
    );
    expect(statement.sql).toContain("FROM filtered_course_keys");
    expect(statement.sql).not.toContain("page_rows");
    expect(statement.sql).toContain("COUNT(DISTINCT activity.learner_id)");
    expect(statement.sql).toContain("activity.occurred_at >=");
    expect(statement.sql).toContain("activity.occurred_at <");
    expect(statement.sql).toContain("AT TIME ZONE");
    expect(statement.params).toContain("2026-01-31");
    expect(statement.sql).toContain("LEFT JOIN");
    expect(statement.sql).not.toContain("updated_at");
    expect(
      new PgDialect().sqlToQuery(buildActivityRankingsProjection(sql`activity_rankings`)).sql,
    ).toContain("NULLS FIRST");
  });
});
