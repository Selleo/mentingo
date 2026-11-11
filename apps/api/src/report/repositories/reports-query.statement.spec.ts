import { REPORT_SORT_DIRECTIONS } from "@repo/shared";
import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

import { buildReportStatement } from "./reports-query.statement";
import {
  REPORT_ROW_TIE_BREAKERS,
  REPORT_SORT_COLUMN_SCENARIOS,
} from "./reports-query.statement.scenarios";

import type { ReportStatementContext } from "./reports-query.types";
import type { ReportsQuery } from "../schemas/reports.schema";

const renderReportStatementSql = (query: Partial<ReportsQuery> = {}) => {
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
  return new PgDialect().sqlToQuery(buildReportStatement(context, [])).sql.replace(/\$\d+/g, "?");
};

const expectRowOrderBeforePaginationAndInResult = (statementSql: string, rowOrder: string) => {
  expect(statementSql).toContain(`SELECT * FROM filtered ORDER BY ${rowOrder}`);
  expect(statementSql).toContain(`) ORDER BY ${rowOrder}) FROM page_rows`);
};

describe("report row ordering", () => {
  const sortScenarios = REPORT_SORT_COLUMN_SCENARIOS.flatMap((scenario) =>
    Object.values(REPORT_SORT_DIRECTIONS).map((sortDirection) => ({ ...scenario, sortDirection })),
  );

  it.each(sortScenarios)(
    "orders by $sortBy $sortDirection before pagination and in the result",
    ({ sortBy, sortColumn, sortDirection }) => {
      const statementSql = renderReportStatementSql({ sortBy, sortDirection });

      expectRowOrderBeforePaginationAndInResult(
        statementSql,
        `${sortColumn} ${sortDirection.toUpperCase()} NULLS LAST, ${REPORT_ROW_TIE_BREAKERS}`,
      );
    },
  );

  it("defaults to latest activity first", () => {
    const statementSql = renderReportStatementSql();

    expectRowOrderBeforePaginationAndInResult(
      statementSql,
      `last_activity_at DESC NULLS LAST, ${REPORT_ROW_TIE_BREAKERS}`,
    );
  });
});
