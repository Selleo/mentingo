import { sql } from "drizzle-orm";

import { chapters, courses, coursesSummaryStats, lessons } from "src/storage/schema";

export const courseLessonCountSql = () => sql<number>`(
  SELECT COUNT(*)::int
  FROM ${lessons}
  INNER JOIN ${chapters} ON ${chapters.id} = ${lessons.chapterId}
  WHERE ${chapters.courseId} = ${courses.id}
)`;

export const courseHasFreeChaptersSql = () => sql<boolean>`
  EXISTS (
    SELECT 1
    FROM ${chapters}
    WHERE ${chapters.courseId} = ${courses.id}
      AND ${chapters.isFreemium} = TRUE
  )
`;

/** Requires `coursesSummaryStats` to be joined in the query. */
export const courseEnrolledParticipantCountSql = () =>
  sql<number>`COALESCE(${coursesSummaryStats.freePurchasedCount} + ${coursesSummaryStats.paidPurchasedCount}, 0)`;
