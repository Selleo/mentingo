import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

import { buildReportStatement } from "./reports-query.statement";

import type { ReportStatementContext } from "./reports-query.types";
import type { ReportsQuery } from "../schemas/reports.schema";

const statement = (query: Partial<ReportsQuery> = {}) => {
  const context: ReportStatementContext = {
    query: {
      view: "organisation",
      timezone: "UTC",
      language: "en",
      page: 1,
      pageSize: 25,
      groupIds: [],
      ...query,
    },
    access: {
      tenantId: "tenant",
      userId: "actor",
      canReadOrganisation: true,
      canReadManagedGroups: false,
      ownedCoursesOnly: false,
      canManageShared: false,
    },
    includeNoEnrollmentLearners: false,
    managedGroupIds: [],
    authorizedGroupIds: [],
    filterSql: sql`true`,
    fromSql: sql`course_facts`,
    pathPopulationSql: sql`true`,
    localizedCourseTitle: sql`course_title`,
    localizedPathTitle: sql`path_title`,
    localizedGroupName: sql`group_name`,
    pageLimit: sql`25`,
    pageOffset: sql`0`,
  };
  return new PgDialect().sqlToQuery(buildReportStatement(context, [])).sql;
};

describe("report row ordering", () => {
  it.each([
    ["learner", "learner_name"],
    ["course", "course_title"],
    ["path", "path_title"],
    [
      "status",
      "CASE status WHEN 'notStarted' THEN 0 WHEN 'inProgress' THEN 1 WHEN 'completed' THEN 2 END",
    ],
    ["progress", "progress"],
    ["score", "score"],
    ["attempts", "attempts"],
    ["lastActivity", "last_activity_at"],
  ] as const)(
    "sorts %s in both directions before pagination and preserves result order",
    (sortBy, column) => {
      for (const sortDirection of ["asc", "desc"] as const) {
        const query = statement({ sortBy, sortDirection });
        const order = `${column} ${sortDirection.toUpperCase()} NULLS LAST, learner_id ASC, course_id ASC NULLS LAST, path_id ASC NULLS LAST`;
        expect(query).toContain(`SELECT * FROM filtered ORDER BY ${order}`);
        expect(query).toContain(`) ORDER BY ${order}) FROM page_rows`);
      }
    },
  );
  it("defaults to latest activity with nulls last and stable record ties before pagination and in the result", () => {
    const query = statement();
    const order =
      "last_activity_at DESC NULLS LAST, learner_id ASC, course_id ASC NULLS LAST, path_id ASC NULLS LAST";
    expect(query).toContain(`SELECT * FROM filtered ORDER BY ${order}`);
    expect(query).toContain(`) ORDER BY ${order}) FROM page_rows`);
  });
});
