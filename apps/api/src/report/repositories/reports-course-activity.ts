import { sql } from "drizzle-orm";

import type { CourseActivityContext } from "./reports-course-activity.types";
import type { SQL } from "drizzle-orm";

/** Retained learner timestamps, not content edits or enrollment dates. No invented visit log. */
export function buildCourseActivityCtes(context: CourseActivityContext): SQL {
  const keys = context.pathView
    ? sql`SELECT DISTINCT pcf.tenant_id, pcf.learner_id, pcf.course_id
        FROM path_course_facts pcf JOIN filtered matched
          ON matched.tenant_id = pcf.tenant_id AND matched.learner_id = pcf.learner_id
          AND matched.path_id = pcf.path_id`
    : sql`SELECT tenant_id, learner_id, course_id FROM filtered_course_keys`;
  return sql`
    activity_keys AS MATERIALIZED (${keys}),
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
      WHERE attempt.submission_status = 'submitted' AND attempt.submitted_at IS NOT NULL
    ),
    activity_totals AS (
      SELECT candidate.course_id AS id, candidate.label,
        COUNT(DISTINCT activity.learner_id) FILTER (
          WHERE activity.occurred_at >= (${context.period.from}::date::timestamp AT TIME ZONE ${context.timezone})
            AND activity.occurred_at < ((${context.period.to}::date + 1)::timestamp AT TIME ZONE ${context.timezone})
        )::int AS active_learners,
        MAX(activity.occurred_at) AS last_activity_at
      FROM activity_candidates candidate
      LEFT JOIN learner_activity activity ON activity.tenant_id = candidate.tenant_id
        AND activity.course_id = candidate.course_id AND activity.occurred_at <= CURRENT_TIMESTAMP
      WHERE candidate.tenant_id = ${context.tenantId}
      GROUP BY candidate.course_id, candidate.label
    ),
    activity_rankings AS (
      SELECT *, JSONB_BUILD_OBJECT('id', id, 'label', label, 'activeLearners', active_learners,
        'lastActivityAt', CASE WHEN last_activity_at IS NULL THEN NULL ELSE
          TO_CHAR(last_activity_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END,
        'inactiveDays', CASE WHEN last_activity_at IS NULL THEN NULL ELSE
          GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - last_activity_at)) / 86400))::int END
      ) AS item FROM activity_totals
    )`;
}

export function buildCourseActivityProjection(): SQL {
  return sql`JSONB_BUILD_OBJECT(
    'popular', COALESCE((SELECT JSONB_AGG(item ORDER BY active_learners DESC, label, id)
      FROM (SELECT * FROM activity_rankings ORDER BY active_learners DESC, label, id LIMIT 8) popular), '[]'::jsonb),
    'inactive', COALESCE((SELECT JSONB_AGG(item ORDER BY last_activity_at ASC NULLS FIRST, label, id)
      FROM (SELECT * FROM activity_rankings ORDER BY last_activity_at ASC NULLS FIRST, label, id LIMIT 8) inactive), '[]'::jsonb)
  )`;
}
