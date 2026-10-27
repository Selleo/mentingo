import { sql } from "drizzle-orm";

import { courses, studentCourses } from "src/storage/schema";

export const studentCourseProgressOrderSql = () => sql<number>`CASE
  WHEN ${courses.chapterCount} > 0
    THEN COALESCE(${studentCourses.finishedChapterCount}, 0)::numeric / ${courses.chapterCount}
  ELSE 0
END`;
