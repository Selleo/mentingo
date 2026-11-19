import { ACTIVITY_LOG_ACTION_TYPES } from "@repo/shared";
import { and, countDistinct, eq, exists, inArray, sql } from "drizzle-orm";
import { QueryBuilder } from "drizzle-orm/pg-core";

import {
  activityLogs,
  aiMentorLessons,
  aiMentorThreads,
  chapters,
  lessons,
} from "src/storage/schema";

import { REPORT_LIMITS, REPORT_STATUS } from "../constants/reports.constants";

import { buildActivityRankingItemJson, isWithinActivityPeriod } from "./reports-course-activity";

import type { CourseActivityContext } from "./reports-course-activity.types";
import type { SQL } from "drizzle-orm";

/**
 * Ranks development paths by learners active on their courses, reusing the course activity
 * signals (`activity_keys`, `learner_activity`), so paths and courses count activity the same way.
 */
export function buildPathActivityCtes(context: CourseActivityContext): SQL {
  const matchedPathsOnly = context.pathView
    ? sql`JOIN filtered matched ON matched.tenant_id = pcf.tenant_id
        AND matched.learner_id = pcf.learner_id AND matched.path_id = pcf.path_id`
    : sql``;
  return sql`
    path_activity_candidates AS (
      SELECT DISTINCT pcf.tenant_id, pcf.path_id, pf.path_title AS label, pcf.learner_id, pcf.course_id
      FROM path_course_facts pcf
      JOIN activity_keys keys ON keys.tenant_id = pcf.tenant_id
        AND keys.learner_id = pcf.learner_id AND keys.course_id = pcf.course_id
      JOIN path_facts pf ON pf.tenant_id = pcf.tenant_id
        AND pf.learner_id = pcf.learner_id AND pf.path_id = pcf.path_id
      ${matchedPathsOnly}
      WHERE pcf.tenant_id = ${context.tenantId}
    ),
    path_activity_totals AS (
      SELECT candidate.path_id AS id, MAX(candidate.label) AS label,
        COUNT(DISTINCT activity.learner_id) FILTER (
          WHERE ${isWithinActivityPeriod(sql`activity.occurred_at`, context)}
        )::int AS active_learners,
        MAX(activity.occurred_at) AS last_activity_at
      FROM path_activity_candidates candidate
      LEFT JOIN learner_activity activity ON activity.tenant_id = candidate.tenant_id
        AND activity.learner_id = candidate.learner_id AND activity.course_id = candidate.course_id
        AND activity.occurred_at <= CURRENT_TIMESTAMP
      GROUP BY candidate.path_id
    ),
    path_activity_rankings AS (
      SELECT *, ${buildActivityRankingItemJson()} AS item FROM path_activity_totals
    )`;
}

const queryBuilder = new QueryBuilder();

/** Matching learners with at least one recorded login. */
function countLoggedInMatchingLearners(tenantId: string): SQL {
  return queryBuilder
    .select({ loggedIn: sql<number>`${countDistinct(activityLogs.actorId)}::int` })
    .from(activityLogs)
    .where(
      and(
        eq(activityLogs.tenantId, tenantId),
        eq(activityLogs.actionType, ACTIVITY_LOG_ACTION_TYPES.LOGIN),
        inArray(activityLogs.actorId, sql`(SELECT learner_id FROM matching_learners)`),
      ),
    )
    .getSQL();
}

/** AI Mentor threads that matching learners started in lessons of their matching courses. */
function countAiMentorConversationsOnMatchingCourses(tenantId: string): SQL {
  return queryBuilder
    .select({ conversations: sql<number>`${countDistinct(aiMentorThreads.id)}::int` })
    .from(aiMentorThreads)
    .innerJoin(
      aiMentorLessons,
      and(
        eq(aiMentorLessons.id, aiMentorThreads.aiMentorLessonId),
        eq(aiMentorLessons.tenantId, aiMentorThreads.tenantId),
      ),
    )
    .innerJoin(
      lessons,
      and(eq(lessons.id, aiMentorLessons.lessonId), eq(lessons.tenantId, aiMentorLessons.tenantId)),
    )
    .innerJoin(
      chapters,
      and(eq(chapters.id, lessons.chapterId), eq(chapters.tenantId, lessons.tenantId)),
    )
    .where(
      and(
        eq(aiMentorThreads.tenantId, tenantId),
        exists(sql`(SELECT 1 FROM activity_keys keys
          WHERE keys.tenant_id = ${aiMentorThreads.tenantId}
            AND keys.learner_id = ${aiMentorThreads.userId}
            AND keys.course_id = ${chapters.courseId})`),
      ),
    )
    .getSQL();
}

/**
 * Monthly active learners over the trailing year, the learning funnel of the matching population
 * and AI Mentor conversations on matching courses.
 */
export function buildLearningInsightsCtes(context: CourseActivityContext): SQL {
  const currentMonth = sql`date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE ${context.timezone})`;
  return sql`
    activity_months AS (
      SELECT month_start FROM generate_series(
        ${currentMonth} - (${REPORT_LIMITS.ACTIVITY_TREND_MONTHS - 1} * INTERVAL '1 month'),
        ${currentMonth}, INTERVAL '1 month') AS month_start
    ),
    activity_trend AS (
      SELECT TO_CHAR(month.month_start, 'YYYY-MM') AS month,
        COUNT(DISTINCT activity.learner_id)::int AS active_learners
      FROM activity_months month
      LEFT JOIN learner_activity activity
        ON date_trunc('month', activity.occurred_at AT TIME ZONE ${
          context.timezone
        }) = month.month_start
      GROUP BY month.month_start
    ),
    learning_funnel AS (
      SELECT (SELECT COUNT(*)::int FROM matching_learners) AS learners,
        (${countLoggedInMatchingLearners(context.tenantId)}) AS logged_in,
        (SELECT COUNT(DISTINCT learner_id)::int FROM filtered
          WHERE status IN (${REPORT_STATUS.IN_PROGRESS}, ${REPORT_STATUS.COMPLETED})) AS started,
        (SELECT COUNT(DISTINCT learner_id)::int FROM filtered
          WHERE status = ${REPORT_STATUS.COMPLETED}) AS completed,
        (${countAiMentorConversationsOnMatchingCourses(
          context.tenantId,
        )}) AS ai_mentor_conversations
    )`;
}

export function buildLearningInsightsProjection(): SQL {
  return sql`JSONB_BUILD_OBJECT(
    'activityTrend', COALESCE((SELECT JSONB_AGG(JSONB_BUILD_OBJECT(
      'month', month, 'activeLearners', active_learners) ORDER BY month) FROM activity_trend), '[]'::jsonb),
    'funnel', (SELECT JSONB_BUILD_OBJECT('learners', learners, 'loggedIn', logged_in,
      'started', started, 'completed', completed) FROM learning_funnel),
    'aiMentorConversations', (SELECT ai_mentor_conversations FROM learning_funnel)
  )`;
}
