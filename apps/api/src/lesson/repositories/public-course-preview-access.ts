import { COURSE_ENROLLMENT, COURSE_STATUSES } from "@repo/shared";
import { and, eq, isNull, sql } from "drizzle-orm";

import {
  chapters,
  courses,
  courseStudentMode,
  lessons,
  settings,
  studentCourses,
} from "src/storage/schema";

import type { DatabasePg, UUIDType } from "src/common";

/** Tenant-scoped eligibility for signed-in, unenrolled public course previews. */
export async function hasPublicCoursePreviewAccess(db: DatabasePg, id: UUIDType, userId: UUIDType) {
  const [preview] = await db
    .select({ id: lessons.id })
    .from(lessons)
    .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
    .innerJoin(courses, eq(courses.id, chapters.courseId))
    .innerJoin(settings, and(isNull(settings.userId), eq(settings.tenantId, courses.tenantId)))
    .leftJoin(
      studentCourses,
      and(
        eq(studentCourses.courseId, courses.id),
        eq(studentCourses.studentId, userId),
        eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED),
      ),
    )
    .leftJoin(
      courseStudentMode,
      and(eq(courseStudentMode.courseId, courses.id), eq(courseStudentMode.userId, userId)),
    )
    .where(
      and(
        eq(lessons.id, id),
        eq(courses.status, COURSE_STATUSES.PUBLISHED),
        eq(courses.isArchived, false),
        eq(courses.priceInCents, 0),
        isNull(studentCourses.id),
        isNull(courseStudentMode.id),
        sql`COALESCE((${settings.settings}->>'publicCoursePreviewEnabled')::boolean, false)`,
      ),
    )
    .limit(1);
  return Boolean(preview);
}
