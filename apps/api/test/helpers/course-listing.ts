import { COURSE_STATUSES, SUPPORTED_LANGUAGES } from "@repo/shared";
import { eq } from "drizzle-orm";

import { buildJsonbFieldWithMultipleEntries } from "src/common/helpers/sqlHelpers";
import { categories } from "src/storage/schema";

import { createCategoryFactory } from "../factory/category.factory";
import { createCourseSummaryStatsFactory } from "../factory/course-summary-stats.factory";
import { createCourseFactory } from "../factory/course.factory";
import { createStudentCourseFactory } from "../factory/student-course.factory";

import type { truncateTables } from "./test-helpers";
import type { SupportedLanguages } from "@repo/shared";
import type { DatabasePg, UUIDType } from "src/common";
import type { CourseSummaryStatsTest } from "test/factory/course-summary-stats.factory";
import type { CourseTest } from "test/factory/course.factory";
import type { StudentCourseTest } from "test/factory/student-course.factory";

export const COURSE_LISTING_TABLES: Parameters<typeof truncateTables>[1] = [
  "outbox_events",
  "courses_summary_stats",
  "course_slugs",
  "resource_entity",
  "resources",
  "group_manager_groups",
  "group_courses",
  "student_lesson_progress",
  "student_chapter_progress",
  "student_courses",
  "group_users",
  "groups",
  "lessons",
  "chapters",
  "courses",
  "categories",
  "settings",
  "users",
];

type RunInTenant = <T>(fn: () => Promise<T>) => Promise<T>;

export type LocalizedTitles = Partial<Record<SupportedLanguages, string>>;

/** Seeds courses, enrollments and listing statistics through the tenant-scoped (RLS) connection. */
export const createCourseListingHelpers = ({
  db,
  runInTenant,
}: {
  db: DatabasePg;
  runInTenant: RunInTenant;
}) => {
  const arrangeCourse = (course: Partial<CourseTest>) =>
    runInTenant(() =>
      createCourseFactory(db).create({
        status: COURSE_STATUSES.PUBLISHED,
        thumbnailS3Key: null,
        ...course,
      }),
    );

  /** Creates one course per fixture key and returns the created course ids under the same keys. */
  const arrangeCoursesByKey = async <CourseKey extends string>(
    fixtures: Record<CourseKey, Partial<CourseTest>>,
    sharedAttributes: Partial<CourseTest> = {},
  ) => {
    const courseIdEntries: Array<[string, UUIDType]> = [];

    for (const [courseKey, fixture] of Object.entries<Partial<CourseTest>>(fixtures)) {
      const course = await arrangeCourse({ ...sharedAttributes, ...fixture });
      courseIdEntries.push([courseKey, course.id]);
    }

    return Object.fromEntries(courseIdEntries) as Record<CourseKey, UUIDType>;
  };

  const arrangeEnrollment = (
    studentId: UUIDType,
    courseId: UUIDType,
    enrollment: Partial<StudentCourseTest> = {},
  ) =>
    runInTenant(() =>
      createStudentCourseFactory(db).create({ studentId, courseId, ...enrollment }),
    );

  const arrangeLocalizedCategory = (titles: LocalizedTitles) =>
    runInTenant(async () => {
      const category = await createCategoryFactory(db).create();
      const availableLocales = Object.values(SUPPORTED_LANGUAGES).filter(
        (language) => titles[language] !== undefined,
      );

      await db
        .update(categories)
        .set({ title: buildJsonbFieldWithMultipleEntries(titles), availableLocales })
        .where(eq(categories.id, category.id));

      return category;
    });

  const arrangeCourseSummaryStats = (summaryStats: Partial<CourseSummaryStatsTest>) =>
    runInTenant(() => createCourseSummaryStatsFactory(db).create(summaryStats));

  return {
    arrangeCourse,
    arrangeCoursesByKey,
    arrangeEnrollment,
    arrangeLocalizedCategory,
    arrangeCourseSummaryStats,
  };
};
