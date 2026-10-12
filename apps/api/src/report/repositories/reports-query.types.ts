import type { buildAccessibleReferences } from "./reports-query.availability";
import type { ReportsAccess, ReportsAccessScope } from "../reports-access.types";
import type { ReportOptions, ReportsQuery, ReportsResult } from "../schemas/reports.schema";
import type { SQL } from "drizzle-orm";
import type { DatabasePg } from "src/common";

export type QueryRow = Record<string, unknown>;

export type ReportData = Pick<
  ReportsResult,
  "rows" | "metrics" | "breakdowns" | "total" | "page" | "pageSize" | "capturedAt"
>;

export type ReportStatementContext = {
  query: ReportsQuery;
  access: ReportsAccess;
  managedGroupIds: string[];
  authorizedGroupIds: string[];
  filterSql: SQL;
  includeNoEnrollmentLearners: boolean;
  pageLimit: SQL;
  pageOffset: SQL;
  fromSql: SQL;
  pathPopulationSql: SQL;
  localizedCourseTitle: SQL;
  localizedPathTitle: SQL;
  localizedGroupName: SQL;
};

export type ReportQueryExecutionContext = ReportsAccessScope & {
  query: ReportsQuery;
  allRows: boolean;
};

/** The query-building subset of the database a report statement needs. */
export type ReportQueryBuilder = Pick<DatabasePg, "select" | "selectDistinctOn">;

/** A read-only snapshot transaction in which a whole report runs. */
export type ReportTransaction = Pick<DatabasePg, "execute" | "select" | "selectDistinctOn">;

export type ReportQueryContext = ReportsAccessScope & {
  db: ReportQueryBuilder;
  query: ReportsQuery;
};

export type ReportVisibleRecord = { id: string };

/** Every record a report query names, grouped by kind. */
export type ReportQueryReferences = {
  groupIds: string[];
  courseIds: string[];
  pathIds: string[];
  learnerIds: string[];
};

export type ReportOption = ReportOptions["groups"][number];

export type ReportAccessibleReferences = ReturnType<typeof buildAccessibleReferences>;

export type ReportReferenceQuery = ReportAccessibleReferences[keyof ReportAccessibleReferences];
