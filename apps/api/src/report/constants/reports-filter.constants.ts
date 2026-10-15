import { sql } from "drizzle-orm";

import {
  REPORT_FILTER_FIELDS as FIELD,
  REPORT_FILTER_OPERATORS as OPERATOR,
} from "./reports.constants";

import type { ReportFilterCondition } from "../schemas/reports.schema";
import type { SQL } from "drizzle-orm";

export const REPORT_NUMERIC_FIELDS = new Set<string>([FIELD.PROGRESS, FIELD.SCORE, FIELD.ATTEMPTS]);

export const REPORT_DATE_FIELDS = new Set<string>([
  FIELD.ENROLLED_AT,
  FIELD.COMPLETED_AT,
  FIELD.LAST_ACTIVITY,
]);

export const REPORT_IDENTIFIER_FIELDS = new Set<string>([
  FIELD.GROUP_ID,
  FIELD.COURSE_ID,
  FIELD.PATH_ID,
]);

/** Operators whose values name concrete records that must be inside the viewer's scope. */
export const REPORT_REFERENCING_OPERATORS = new Set<string>([
  OPERATOR.EQ,
  OPERATOR.NEQ,
  OPERATOR.IN,
]);

/** Any UUID-shaped value; learner conditions use it to tell selected ids from typed text. */
export const REPORT_UUID_PATTERN = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

/** The same check as `REPORT_UUID_PATTERN`, for PostgreSQL `~*` matching. */
export const REPORT_UUID_SQL_PATTERN =
  "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$";

/** RFC 4122 UUIDs (versions 1–8), required for identifier conditions. */
export const REPORT_STRICT_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** A calendar date, or a full ISO timestamp with an explicit offset. */
export const REPORT_DATE_PATTERN =
  /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/;

export const REPORT_CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Columns of the report row `r` that a condition can compare directly. */
export const REPORT_ROW_COLUMNS: Record<ReportFilterCondition["field"], SQL> = {
  learner: sql`r.learner_name`,
  courseId: sql`r.course_id`,
  pathId: sql`r.path_id`,
  status: sql`r.status`,
  progress: sql`r.progress`,
  enrolledAt: sql`r.enrolled_at`,
  completedAt: sql`r.completed_at`,
  score: sql`r.score`,
  attempts: sql`r.attempts`,
  certificate: sql`r.certificate_status`,
  lastActivity: sql`r.last_activity_at`,
  groupId: sql`r.learner_id`,
};
