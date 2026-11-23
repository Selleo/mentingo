import {
  DEFAULT_REPORT_SORT,
  LEARNING_PATH_PROGRESS_STATUSES,
  REPORT_SORT_DIRECTIONS,
  REPORT_SORT_FIELDS,
} from "@repo/shared";
import { sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { match } from "ts-pattern";

import {
  groupUsers,
  groups,
  learningPathCourses,
  studentLearningPathCourses,
  studentLearningPaths,
} from "src/storage/schema";

import {
  REPORT_CERTIFICATE_STATUS,
  REPORT_STATUS,
  REPORT_VIEWS,
} from "../constants/reports.constants";
import {
  aggregateBreakdownJson,
  aliasedTable,
  sumPathCoursesWithStatus,
  toIsoTimestampJson,
  uuidArray,
} from "../utils/reports-sql.utils";

import { buildActivityRankingsProjection } from "./reports-course-activity";
import { buildLearningInsightsProjection } from "./reports-learning-insights";

import type { ReportStatementContext, ReportViewAggregates } from "./reports-query.types";
import type { SQL } from "drizzle-orm";

const GROUP_USER_ALIAS = "gu";
const GROUP_ALIAS = "g";
const STUDENT_PATH_ALIAS = "slp";
const STUDENT_PATH_COURSE_ALIAS = "slpc";

const groupUser = alias(groupUsers, GROUP_USER_ALIAS);
const group = alias(groups, GROUP_ALIAS);
const studentPath = alias(studentLearningPaths, STUDENT_PATH_ALIAS);
const studentPathCourse = alias(studentLearningPathCourses, STUDENT_PATH_COURSE_ALIAS);

function countCompletedPathsForCourseRows(context: ReportStatementContext): SQL {
  return sql`COALESCE((SELECT COUNT(DISTINCT (${studentPath.studentId}, ${
    studentPath.learningPathId
  }))::int
    FROM ${aliasedTable(studentLearningPathCourses, STUDENT_PATH_COURSE_ALIAS)}
    JOIN ${aliasedTable(studentLearningPaths, STUDENT_PATH_ALIAS)}
      ON ${studentPath.tenantId} = ${studentPathCourse.tenantId}
      AND ${studentPath.studentId} = ${studentPathCourse.studentId}
      AND ${studentPath.learningPathId} = ${studentPathCourse.learningPathId}
    JOIN filtered_course_keys fkeys ON fkeys.tenant_id = ${studentPathCourse.tenantId}
      AND fkeys.learner_id = ${studentPathCourse.studentId} AND fkeys.course_id = ${
        studentPathCourse.courseId
      }
    WHERE ${studentPath.tenantId} = ${context.access.tenantId}
      AND (${studentPath.completedAt} IS NOT NULL
        OR ${studentPath.progress} = ${LEARNING_PATH_PROGRESS_STATUSES.COMPLETED})), 0)::int`;
}

function getViewAggregates(context: ReportStatementContext): ReportViewAggregates {
  return match(context.query.view)
    .with(REPORT_VIEWS.DEVELOPMENT_PATHS, () => ({
      courseEnrollments: (rows: SQL) =>
        sql`COALESCE(SUM(jsonb_array_length(${rows}.path_courses)), 0)`,
      courseCompletions: (rows: SQL) =>
        sumPathCoursesWithStatus(sql`${rows}.path_courses`, REPORT_STATUS.COMPLETED),
      courseInProgress: (rows: SQL) =>
        sumPathCoursesWithStatus(sql`${rows}.path_courses`, REPORT_STATUS.IN_PROGRESS),
      courseCount: () => sql`0`,
      completedPaths: sql`COUNT(*) FILTER (WHERE status = ${REPORT_STATUS.COMPLETED})::int`,
    }))
    .otherwise(() => ({
      courseEnrollments: () => sql`COUNT(*)`,
      courseCompletions: (rows: SQL) =>
        sql`COUNT(*) FILTER (WHERE ${rows}.status = ${REPORT_STATUS.COMPLETED})::int`,
      courseInProgress: (rows: SQL) =>
        sql`COUNT(*) FILTER (WHERE ${rows}.status = ${REPORT_STATUS.IN_PROGRESS})::int`,
      courseCount: (rows: SQL) => sql`COUNT(DISTINCT ${rows}.course_id)::int`,
      completedPaths: countCompletedPathsForCourseRows(context),
    }));
}

export function buildSummaryCte(context: ReportStatementContext): SQL {
  const aggregates = getViewAggregates(context);
  const summaryRows = sql`${sql.identifier("r")}`;
  return sql`
          summary AS (
            SELECT COUNT(*)::int AS total, (SELECT COUNT(*)::int FROM matching_learners) AS learners,
              ${aggregates.courseCompletions(summaryRows)} AS course_completions,
              COUNT(DISTINCT learner_id) FILTER (WHERE last_activity_at >= CURRENT_TIMESTAMP - INTERVAL '30 days')::int AS active_learners_30d,
              COUNT(*) FILTER (WHERE certificate_status = ${
                REPORT_CERTIFICATE_STATUS.ACTIVE
              })::int AS active_certificates,
              COUNT(*) FILTER (WHERE certificate_issued_at IS NOT NULL)::int AS certificates_issued,
              COUNT(*) FILTER (WHERE score IS NOT NULL)::int AS scored_enrollments,
              ${aggregates.completedPaths} AS completed_paths,
              (${aggregates.courseEnrollments(summaryRows)})::numeric AS course_enrollments,
              AVG(progress)::numeric AS average_progress, AVG(score)::numeric AS average_score
            FROM filtered ${summaryRows}
          )
  `;
}

export function buildBreakdownCtes(context: ReportStatementContext): SQL {
  const aggregates = getViewAggregates(context);
  const breakdownRows = sql`${sql.identifier("f")}`;
  return sql`
          group_breakdown AS (
            SELECT ${groupUser.groupId}::text AS id,
              ${context.localizedGroupName} AS label,
              COUNT(DISTINCT ${breakdownRows}.learner_id)::int AS learners,
              (${aggregates.courseEnrollments(breakdownRows)})::int AS course_enrollments,
              ${aggregates.courseCompletions(breakdownRows)} AS course_completions,
              ${aggregates.courseInProgress(breakdownRows)} AS course_in_progress,
              ${aggregates.courseCount(breakdownRows)} AS course_count,
              AVG(${breakdownRows}.progress)::numeric AS average_progress,
              AVG(${breakdownRows}.score)::numeric AS average_score
            FROM filtered ${breakdownRows}
            JOIN ${aliasedTable(groupUsers, GROUP_USER_ALIAS)}
              ON ${groupUser.tenantId} = ${breakdownRows}.tenant_id
              AND ${groupUser.userId} = ${breakdownRows}.learner_id
              AND ${groupUser.groupId} = ANY(${uuidArray(context.authorizedGroupIds)})
            JOIN ${aliasedTable(groups, GROUP_ALIAS)}
              ON ${group.id} = ${groupUser.groupId} AND ${group.tenantId} = ${groupUser.tenantId}
            GROUP BY ${groupUser.groupId}, ${group.name}, ${group.baseLanguage}, ${
              group.availableLocales
            }
          ),
          course_breakdown AS (
            SELECT course_id::text AS id, MAX(course_title) AS label,
              COUNT(DISTINCT learner_id)::int AS learners, COUNT(*)::int AS course_enrollments,
              COUNT(*) FILTER (WHERE status = ${
                REPORT_STATUS.COMPLETED
              })::int AS course_completions,
              COUNT(*) FILTER (WHERE status = ${
                REPORT_STATUS.IN_PROGRESS
              })::int AS course_in_progress,
              1 AS course_count, AVG(progress)::numeric AS average_progress,
              AVG(score)::numeric AS average_score
            FROM filtered WHERE course_id IS NOT NULL GROUP BY course_id
          ),
          path_breakdown AS (
            SELECT pcf.path_id::text AS id, MAX(pf.path_title) AS label,
              COUNT(DISTINCT pcf.learner_id)::int AS learners, COUNT(*)::int AS course_enrollments,
              COUNT(*) FILTER (WHERE pcf.status = ${
                REPORT_STATUS.COMPLETED
              })::int AS course_completions,
              COUNT(*) FILTER (WHERE pcf.status = ${
                REPORT_STATUS.IN_PROGRESS
              })::int AS course_in_progress,
              (SELECT COUNT(*)::int FROM ${learningPathCourses}
                WHERE ${learningPathCourses.learningPathId} = pcf.path_id
                  AND ${learningPathCourses.tenantId} = ${context.access.tenantId}) AS course_count,
              AVG(pcf.progress)::numeric AS average_progress, AVG(pcf.score)::numeric AS average_score
            FROM path_course_facts pcf
            JOIN filtered f ON f.tenant_id = pcf.tenant_id AND f.learner_id = pcf.learner_id
              AND (f.course_id = pcf.course_id OR f.path_id = pcf.path_id)
            JOIN path_facts pf ON pf.tenant_id = pcf.tenant_id AND pf.learner_id = pcf.learner_id
              AND pf.path_id = pcf.path_id
            GROUP BY pcf.path_id
          )
  `;
}

/**
 * Orders report rows by the requested column, with stable record ties so pagination never
 * skips or repeats rows. Shared by pagination and JSON aggregation (and therefore exports).
 */
function buildRowOrder({ query }: ReportStatementContext): SQL {
  const sortColumn = match(query.sortBy ?? DEFAULT_REPORT_SORT.sortBy)
    .with(REPORT_SORT_FIELDS.LEARNER, () => sql`learner_name`)
    .with(REPORT_SORT_FIELDS.COURSE, () => sql`course_title`)
    .with(REPORT_SORT_FIELDS.PATH, () => sql`path_title`)
    .with(
      REPORT_SORT_FIELDS.STATUS,
      () =>
        sql`CASE status WHEN ${REPORT_STATUS.NOT_STARTED} THEN 0 WHEN ${REPORT_STATUS.IN_PROGRESS} THEN 1 WHEN ${REPORT_STATUS.COMPLETED} THEN 2 END`,
    )
    .with(REPORT_SORT_FIELDS.PROGRESS, () => sql`progress`)
    .with(REPORT_SORT_FIELDS.SCORE, () => sql`score`)
    .with(REPORT_SORT_FIELDS.ATTEMPTS, () => sql`attempts`)
    .with(REPORT_SORT_FIELDS.LAST_ACTIVITY, () => sql`last_activity_at`)
    .exhaustive();

  const sortDirection = match(query.sortDirection ?? DEFAULT_REPORT_SORT.sortDirection)
    .with(REPORT_SORT_DIRECTIONS.ASC, () => sql`ASC`)
    .with(REPORT_SORT_DIRECTIONS.DESC, () => sql`DESC`)
    .exhaustive();

  return sql`${sortColumn} ${sortDirection} NULLS LAST, learner_id ASC, course_id ASC NULLS LAST, path_id ASC NULLS LAST`;
}

export function buildPageRowsCte(context: ReportStatementContext): SQL {
  return sql`
          page_rows AS (
            SELECT * FROM filtered ORDER BY ${buildRowOrder(context)}
            LIMIT ${context.pageLimit} OFFSET ${context.pageOffset}
          )
  `;
}

export function buildResultProjection(context: ReportStatementContext): SQL {
  return sql`
          SELECT summary.*,
            ${
              context.query.activityPeriod
                ? sql`${buildActivityRankingsProjection(sql`activity_rankings`)} AS course_activity,
                  ${buildActivityRankingsProjection(sql`path_activity_rankings`)} AS path_activity,
                  ${buildLearningInsightsProjection()} AS learning_insights,`
                : sql``
            }
            ${aggregateBreakdownJson(sql`group_breakdown`)} AS groups,
            ${aggregateBreakdownJson(sql`course_breakdown`)} AS courses,
            ${aggregateBreakdownJson(sql`path_breakdown`)} AS paths,
            COALESCE((SELECT JSONB_AGG(JSONB_BUILD_OBJECT(
              'id', learner_id::text || ':' || COALESCE(course_id::text, '') || COALESCE(':' || path_id::text, ''),
              'learner', JSONB_BUILD_OBJECT('id', learner_id, 'name', learner_name, 'email', learner_email),
              'course', CASE WHEN course_id IS NULL THEN NULL::jsonb
                ELSE JSONB_BUILD_OBJECT('id', course_id, 'title', course_title) END,
              'path', CASE WHEN path_id IS NULL THEN NULL::jsonb
                ELSE JSONB_BUILD_OBJECT('id', path_id, 'title', path_title) END,
              'status', status, 'progress', progress, 'score', score, 'attempts', attempts,
              'certificate', JSONB_BUILD_OBJECT('status', certificate_status,
                'issuedAt', ${toIsoTimestampJson(sql`certificate_issued_at`)}),
              'enrolledAt', ${toIsoTimestampJson(sql`enrolled_at`)},
              'completedAt', ${toIsoTimestampJson(sql`completed_at`)},
              'lastActivityAt', ${toIsoTimestampJson(sql`last_activity_at`)},
              'groupIds', group_ids, 'pathCourses', path_courses
            ) ORDER BY ${buildRowOrder(context)}) FROM page_rows), '[]'::jsonb) AS rows
          FROM summary
  `;
}
