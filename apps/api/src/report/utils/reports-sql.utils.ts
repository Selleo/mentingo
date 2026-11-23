import { sql } from "drizzle-orm";

import type { ReportStatus } from "../constants/reports.constants";
import type { SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";

const ISO_TIMESTAMP_FORMAT = sql.raw(`'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'`);

export function uuidArray(values: readonly string[]): SQL {
  if (values.length === 0) return sql`ARRAY[]::uuid[]`;
  return sql`ARRAY[${sql.join(
    values.map((value) => sql`${value}::uuid`),
    sql`, `,
  )}]`;
}

/** Renders `table alias` for FROM/JOIN clauses whose columns come from `alias(table, aliasName)`. */
export function aliasedTable(table: PgTable, aliasName: string): SQL {
  return sql`${table} ${sql.identifier(aliasName)}`;
}

/** Formats a timestamp as a UTC ISO-8601 string for JSON output, keeping NULL as NULL. */
export function toIsoTimestampJson(timestamp: SQL): SQL {
  return sql`CASE WHEN ${timestamp} IS NULL THEN NULL ELSE
    TO_CHAR(${timestamp} AT TIME ZONE 'UTC', ${ISO_TIMESTAMP_FORMAT}) END`;
}

/** Counts path courses in a status across the JSONB `path_courses` arrays of path report rows. */
export function sumPathCoursesWithStatus(pathCourses: SQL, status: ReportStatus): SQL {
  return sql`COALESCE(SUM((SELECT COUNT(*) FROM jsonb_array_elements(${pathCourses}) path_course
    WHERE path_course ->> 'status' = ${status})), 0)::int`;
}

/** Aggregates a breakdown CTE (learners, enrollment outcomes, averages) into a JSON array. */
export function aggregateBreakdownJson(breakdownCte: SQL): SQL {
  return sql`COALESCE((SELECT JSONB_AGG(JSONB_BUILD_OBJECT('id', id, 'label', label, 'learners', learners,
    'courseEnrollments', course_enrollments, 'courseCompletions', course_completions,
    'courseInProgress', course_in_progress, 'courseCount', course_count,
    'averageProgress', ROUND(average_progress, 2), 'averageScore', ROUND(average_score, 2),
    'completionRate', CASE WHEN course_enrollments = 0 THEN NULL
      ELSE ROUND(course_completions::numeric * 100 / course_enrollments, 2) END)
    ORDER BY learners DESC, label) FROM ${breakdownCte}), '[]'::jsonb)`;
}
