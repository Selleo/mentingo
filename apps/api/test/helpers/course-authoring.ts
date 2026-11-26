import { eq, inArray, isNull, sql } from "drizzle-orm";

import { setJsonbField } from "src/common/helpers/sqlHelpers";
import { courses, settings } from "src/storage/schema";

import { createCategoryFactory } from "../factory/category.factory";
import { createCourseFactory } from "../factory/course.factory";

import type { truncateTables } from "./test-helpers";
import type { DatabasePg, UUIDType } from "src/common";

export const COURSE_AUTHORING_TABLES: Parameters<typeof truncateTables>[1] = [
  "scorm_packages",
  "course_students_stats",
  "courses_summary_stats",
  "student_lesson_progress",
  "student_chapter_progress",
  "student_courses",
  "resource_entity",
  "resources",
  "lessons",
  "chapters",
  "courses",
  "categories",
  "settings",
  "users",
];

type CourseOverrides = Parameters<ReturnType<typeof createCourseFactory>["create"]>[0];

type RunInTenant = <T>(fn: () => Promise<T>) => Promise<T>;

/** Seeds and reads authored courses through the tenant-scoped (RLS) connection. */
export const createCourseAuthoringHelpers = ({
  db,
  runInTenant,
}: {
  db: DatabasePg;
  runInTenant: RunInTenant;
}) => {
  const arrangeCategory = () => runInTenant(() => createCategoryFactory(db).create());

  const arrangeCourse = (overrides: CourseOverrides = {}) =>
    runInTenant(() => createCourseFactory(db).create({ thumbnailS3Key: null, ...overrides }));

  const findCourse = (courseId: UUIDType) =>
    runInTenant(async () => {
      const [course] = await db.select().from(courses).where(eq(courses.id, courseId));

      return course;
    });

  const findCourseStates = (courseIds: UUIDType[]) =>
    runInTenant(() =>
      db
        .select({
          id: courses.id,
          status: courses.status,
          isArchived: courses.isArchived,
          categoryId: courses.categoryId,
        })
        .from(courses)
        .where(inArray(courses.id, courseIds)),
    );

  const featureCourse = (courseId: UUIDType) =>
    runInTenant(() =>
      db
        .update(settings)
        .set({ settings: setJsonbField(settings.settings, "featuredCourseId", courseId) })
        .where(isNull(settings.userId)),
    );

  const findFeaturedCourseId = () =>
    runInTenant(async () => {
      const [globalSettings] = await db
        .select({
          featuredCourseId: sql<UUIDType | null>`${settings.settings}->>'featuredCourseId'`,
        })
        .from(settings)
        .where(isNull(settings.userId));

      return globalSettings?.featuredCourseId ?? undefined;
    });

  return {
    arrangeCategory,
    arrangeCourse,
    findCourse,
    findCourseStates,
    featureCourse,
    findFeaturedCourseId,
  };
};
