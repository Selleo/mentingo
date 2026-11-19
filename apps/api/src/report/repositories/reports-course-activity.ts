import { ASSESSMENT_ATTEMPT_SUBMISSION_STATUSES } from "@repo/shared";
import { sql } from "drizzle-orm";

import { REPORT_LIMITS } from "../constants/reports.constants";
import { toIsoTimestampJson } from "../utils/reports-sql.utils";

import type { CourseActivityContext } from "./reports-course-activity.types";
import type { SQL } from "drizzle-orm";

/**
 * Ranks candidate courses by retained learner timestamps (openings, completions, quiz submissions).
 * Content edits and enrollment dates are not learner activity.
 */
export function buildCourseActivityCtes(context: CourseActivityContext): SQL {
  const activityKeys = context.pathView
    ? sql`SELECT DISTINCT pcf.tenant_id, pcf.learner_id, pcf.course_id
        FROM path_course_facts pcf JOIN filtered matched
          ON matched.tenant_id = pcf.tenant_id AND matched.learner_id = pcf.learner_id
          AND matched.path_id = pcf.path_id`
    : sql`SELECT tenant_id, learner_id, course_id FROM filtered_course_keys`;
  return sql`
    activity_keys AS MATERIALIZED (${activityKeys}),
    activity_candidates AS (${context.courseCandidates}),
    learner_activity AS (
      SELECT activity_keys.*, observed.occurred_at
      FROM activity_keys
      JOIN scoped_enrollments enrollment ON enrollment.tenant_id = activity_keys.tenant_id
        AND enrollment.student_id = activity_keys.learner_id AND enrollment.course_id = activity_keys.course_id
      CROSS JOIN LATERAL (VALUES (enrollment.last_opened_at), (enrollment.completed_at)) observed(occurred_at)
      WHERE observed.occurred_at IS NOT NULL
      UNION ALL
      SELECT activity_keys.*, progress.completed_at
      FROM activity_keys
      JOIN chapters chapter ON chapter.tenant_id = activity_keys.tenant_id AND chapter.course_id = activity_keys.course_id
      JOIN student_lesson_progress progress ON progress.tenant_id = chapter.tenant_id
        AND progress.chapter_id = chapter.id AND progress.student_id = activity_keys.learner_id
      WHERE progress.completed_at IS NOT NULL
      UNION ALL
      SELECT activity_keys.*, attempt.submitted_at
      FROM activity_keys
      JOIN chapters chapter ON chapter.tenant_id = activity_keys.tenant_id AND chapter.course_id = activity_keys.course_id
      JOIN lessons lesson ON lesson.tenant_id = chapter.tenant_id AND lesson.chapter_id = chapter.id
      JOIN assessments assessment ON assessment.tenant_id = lesson.tenant_id AND assessment.lesson_id = lesson.id
      JOIN assessment_attempts attempt ON attempt.tenant_id = assessment.tenant_id
        AND attempt.assessment_id = assessment.id AND attempt.learner_id = activity_keys.learner_id
      WHERE attempt.submission_status = ${
        ASSESSMENT_ATTEMPT_SUBMISSION_STATUSES.SUBMITTED
      } AND attempt.submitted_at IS NOT NULL
    ),
    activity_totals AS (
      SELECT candidate.course_id AS id, candidate.label,
        COUNT(DISTINCT activity.learner_id) FILTER (
          WHERE ${isWithinActivityPeriod(sql`activity.occurred_at`, context)}
        )::int AS active_learners,
        MAX(activity.occurred_at) AS last_activity_at
      FROM activity_candidates candidate
      LEFT JOIN learner_activity activity ON activity.tenant_id = candidate.tenant_id
        AND activity.course_id = candidate.course_id AND activity.occurred_at <= CURRENT_TIMESTAMP
      WHERE candidate.tenant_id = ${context.tenantId}
      GROUP BY candidate.course_id, candidate.label
    ),
    activity_rankings AS (
      SELECT *, ${buildActivityRankingItemJson()} AS item FROM activity_totals
    )`;
}

/** Learner activity timestamps inside the inclusive popularity period, in the report timezone. */
export function isWithinActivityPeriod(
  occurredAt: SQL,
  { period, timezone }: Pick<CourseActivityContext, "period" | "timezone">,
): SQL {
  return sql`${occurredAt} >= (${period.from}::date::timestamp AT TIME ZONE ${timezone})
    AND ${occurredAt} < ((${period.to}::date + 1)::timestamp AT TIME ZONE ${timezone})`;
}

/** One ranked subject (course or path) with its period learners and all-time inactivity. */
export function buildActivityRankingItemJson(): SQL {
  return sql`JSONB_BUILD_OBJECT('id', id, 'label', label, 'activeLearners', active_learners,
    'lastActivityAt', ${toIsoTimestampJson(sql`last_activity_at`)},
    'inactiveDays', CASE WHEN last_activity_at IS NULL THEN NULL ELSE
      GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - last_activity_at)) / 86400))::int END
  )`;
}

/** The most popular and the longest inactive subjects of a rankings CTE. */
export function buildActivityRankingsProjection(rankingsCte: SQL): SQL {
  const limit = REPORT_LIMITS.COURSE_ACTIVITY_RANKING;
  return sql`JSONB_BUILD_OBJECT(
    'popular', COALESCE((SELECT JSONB_AGG(item ORDER BY active_learners DESC, label, id)
      FROM (SELECT * FROM ${rankingsCte} ORDER BY active_learners DESC, label, id LIMIT ${limit}) popular), '[]'::jsonb),
    'inactive', COALESCE((SELECT JSONB_AGG(item ORDER BY last_activity_at ASC NULLS FIRST, label, id)
      FROM (SELECT * FROM ${rankingsCte} ORDER BY last_activity_at ASC NULLS FIRST, label, id LIMIT ${limit}) inactive), '[]'::jsonb)
  )`;
}
