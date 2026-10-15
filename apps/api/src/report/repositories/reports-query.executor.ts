import { and, count, eq, exists, inArray, ne, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import {
  courses,
  groupUsers,
  groups,
  learningPaths,
  learningPathCourses,
  studentCourses,
  studentLearningPaths,
} from "src/storage/schema";

import { REPORT_VIEWS } from "../constants/reports.constants";
import { compileReportsFilter } from "../reports-filter-compiler";
import { flattenFilterConditions } from "../utils/reports-filter.utils";

import { buildFoundationalReportStages } from "./reports-query.fact-stages";
import { buildReportStatement } from "./reports-query.statement";
import { courseIsVisible } from "./reports-query.visibility";

import type {
  ReportData,
  ReportQueryExecutionContext,
  ReportStatementContext,
  ReportTransaction,
  QueryRow,
} from "./reports-query.types";
import type { ReportsAccess, ReportsAccessScope } from "../reports-access.types";
import type { SQL } from "drizzle-orm";
import type { LocalizationService } from "src/localization/localization.service";

export async function executeReportQuery(
  transaction: ReportTransaction,
  localizationService: LocalizationService,
  { query, access, managedGroupIds, authorizedGroupIds, allRows }: ReportQueryExecutionContext,
): Promise<ReportData> {
  await transaction.execute(sql`SET LOCAL work_mem = '64MB'`);

  const { statementContext, foundationalCtes } = buildStatementContext(
    transaction,
    localizationService,
    {
      query,
      access,
      managedGroupIds,
      authorizedGroupIds,
      allRows,
    },
  );
  const capturedAt = await captureReportSnapshot(transaction);
  const [result] = await transaction.execute(
    buildReportStatement(statementContext, foundationalCtes),
  );
  const platformCourses = await countPlatformCourses(transaction, {
    access,
    managedGroupIds,
    authorizedGroupIds,
  });

  return mapSummary(result as QueryRow, query, capturedAt, platformCourses);
}

/** Courses on the platform the viewer may report on, leaving out drafts and archived courses. */
async function countPlatformCourses(
  transaction: ReportTransaction,
  scope: ReportsAccessScope,
): Promise<number> {
  const [row] = await transaction
    .select({ count: count() })
    .from(courses)
    .where(and(courseIsVisible(transaction, scope), ne(courses.status, "draft")));

  return row?.count ?? 0;
}

function buildStatementContext(
  transaction: ReportTransaction,
  localizationService: LocalizationService,
  { query, access, managedGroupIds, authorizedGroupIds, allRows }: ReportQueryExecutionContext,
): { statementContext: ReportStatementContext; foundationalCtes: SQL[] } {
  const filterSql = compileReportsFilter(query.filter, query.timezone, {
    pathView: query.view === REPORT_VIEWS.DEVELOPMENT_PATHS,
    authorizedGroupIds,
  });
  const filterConditions = flattenFilterConditions(query.filter);
  const hasLearningFilter = filterConditions.some(
    ({ field }) => field !== "learner" && field !== "groupId",
  );
  const includeNoEnrollmentLearners =
    !hasLearningFilter &&
    (query.view === REPORT_VIEWS.ORGANISATION || query.view === REPORT_VIEWS.LEARNER);
  const pageLimit = allRows ? sql`NULL` : sql`${query.pageSize}`;
  const pageOffset = allRows ? sql`0` : sql`${(query.page - 1) * query.pageSize}`;
  const fromSql = getViewFromSql(query);
  const pathPopulationSql = getPathPopulationSql(query, access, managedGroupIds, transaction);
  const localizedCourseTitle = localizationService.getLocalizedSqlField(
    alias(courses, "c").title,
    query.language,
    courses,
    "c",
  );
  const localizedPathTitle = localizationService.getLocalizedSqlField(
    alias(learningPaths, "lp").title,
    query.language,
    learningPaths,
    "lp",
  );
  const localizedGroupName = localizationService.getLocalizedSqlField(
    alias(groups, "g").name,
    query.language,
    groups,
    "g",
  );
  const reportStages = buildFoundationalReportStages({
    db: transaction,
    query,
    access,
    managedGroupIds,
    authorizedGroupIds,
  });
  const statementContext: ReportStatementContext = {
    query,
    access,
    managedGroupIds,
    authorizedGroupIds,
    filterSql,
    includeNoEnrollmentLearners,
    pageLimit,
    pageOffset,
    fromSql,
    pathPopulationSql,
    localizedCourseTitle,
    localizedPathTitle,
    localizedGroupName,
  };

  return { statementContext, foundationalCtes: reportStages };
}

async function captureReportSnapshot(transaction: ReportTransaction): Promise<string> {
  const [snapshot] = await transaction.execute(sql`SELECT transaction_timestamp() AS captured_at`);
  return new Date(String((snapshot as QueryRow).captured_at)).toISOString();
}

function mapSummary(
  record: QueryRow,
  query: ReportQueryExecutionContext["query"],
  capturedAt: string,
  platformCourses: number,
): ReportData {
  const total = Number(record.total ?? 0);
  const courseEnrollments = Number(record.course_enrollments ?? total);
  const courseCompletions = Number(record.course_completions ?? 0);

  return {
    rows: (record.rows ?? []) as ReportData["rows"],
    metrics: {
      learners: Number(record.learners ?? 0),
      platformCourses,
      activeLearners30d: Number(record.active_learners_30d ?? 0),
      courseEnrollments,
      courseCompletions,
      courseCompletionRate:
        courseEnrollments === 0 ? null : (courseCompletions * 100) / courseEnrollments,
      averageProgress: record.average_progress === null ? null : Number(record.average_progress),
      averageScore: record.average_score === null ? null : Number(record.average_score),
      activeCertificates: Number(record.active_certificates ?? 0),
      certificatesIssued: Number(record.certificates_issued ?? 0),
      developmentPathsCompleted: Number(record.completed_paths ?? 0),
    },
    breakdowns: {
      groups: (record.groups ?? []) as ReportData["breakdowns"]["groups"],
      courses: (record.courses ?? []) as ReportData["breakdowns"]["courses"],
      paths: (record.paths ?? []) as ReportData["breakdowns"]["paths"],
    },
    total,
    page: query.page,
    pageSize: query.pageSize,
    capturedAt,
  };
}

function getViewFromSql(query: ReportQueryExecutionContext["query"]): SQL {
  if (query.view === REPORT_VIEWS.DEVELOPMENT_PATHS) {
    return sql`SELECT pf.* FROM path_facts pf WHERE pf.path_id = ${query.subjectId}`;
  }

  return sql`SELECT cf.* FROM course_facts cf
    ${query.view === REPORT_VIEWS.COURSE ? sql`WHERE cf.course_id = ${query.subjectId}` : sql``}
    ${query.view === REPORT_VIEWS.LEARNER ? sql`WHERE cf.learner_id = ${query.subjectId}` : sql``}`;
}

function getPathPopulationSql(
  query: ReportQueryExecutionContext["query"],
  access: ReportsAccess,
  managedGroupIds: string[],
  db: ReportTransaction,
): SQL {
  const scopedPaths = alias(studentLearningPaths, "slp");
  const managerMembership = db
    .select({ userId: groupUsers.userId })
    .from(groupUsers)
    .where(
      and(
        eq(groupUsers.tenantId, scopedPaths.tenantId),
        eq(groupUsers.userId, scopedPaths.studentId),
        managedGroupIds.length ? inArray(groupUsers.groupId, managedGroupIds) : sql`FALSE`,
      ),
    );
  const ownedPathEnrollment = db
    .select({ studentId: studentCourses.studentId })
    .from(studentCourses)
    .innerJoin(
      courses,
      and(eq(courses.tenantId, studentCourses.tenantId), eq(courses.id, studentCourses.courseId)),
    )
    .innerJoin(
      learningPathCourses,
      and(
        eq(learningPathCourses.tenantId, studentCourses.tenantId),
        eq(learningPathCourses.courseId, studentCourses.courseId),
        eq(learningPathCourses.learningPathId, scopedPaths.learningPathId),
      ),
    )
    .where(
      and(
        eq(studentCourses.tenantId, scopedPaths.tenantId),
        eq(studentCourses.studentId, scopedPaths.studentId),
        eq(studentCourses.status, "enrolled"),
        eq(courses.authorId, access.userId),
        eq(courses.isArchived, false),
      ),
    );
  const pathGroupMembership = query.groupIds.length
    ? exists(
        db
          .select({ userId: groupUsers.userId })
          .from(groupUsers)
          .where(
            and(
              eq(groupUsers.tenantId, scopedPaths.tenantId),
              eq(groupUsers.userId, scopedPaths.studentId),
              inArray(groupUsers.groupId, query.groupIds),
            ),
          ),
      )
    : sql`TRUE`;

  return sql`(${and(
    or(
      access.canReadOrganisation ? sql`TRUE` : sql`FALSE`,
      access.canReadManagedGroups ? exists(managerMembership) : sql`FALSE`,
      access.ownedCoursesOnly ? exists(ownedPathEnrollment) : sql`FALSE`,
    ),
    pathGroupMembership,
  )})`;
}
