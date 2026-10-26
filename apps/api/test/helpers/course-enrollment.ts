import { LESSON_TYPES, SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { and, eq } from "drizzle-orm";
import { match } from "ts-pattern";

import {
  chapters,
  courseStudentMode,
  studentChapterProgress,
  studentCourses,
  studentLessonProgress,
} from "src/storage/schema";

import { createChapterFactory } from "../factory/chapter.factory";
import { createCourseFactory } from "../factory/course.factory";
import { createGroupFactory } from "../factory/group.factory";
import { createLessonFactory } from "../factory/lesson.factory";
import { createSettingsFactory } from "../factory/settings.factory";
import { createUserFactory } from "../factory/user.factory";

import { cookieFor } from "./test-helpers";

import type { truncateTables } from "./test-helpers";
import type { INestApplication } from "@nestjs/common";
import type { SystemRoleSlug } from "@repo/shared";
import type { DatabasePg, UUIDType } from "src/common";
import type { LessonTypes } from "src/lesson/lesson.type";
import type { CourseTest } from "test/factory/course.factory";
import type { UserWithCredentials } from "test/factory/user.factory";

export const COURSE_ENROLLMENT_TABLES: Parameters<typeof truncateTables>[1] = [
  "course_student_mode",
  "student_lesson_progress",
  "student_chapter_progress",
  "student_courses",
  "group_courses",
  "group_users",
  "groups",
  "lessons",
  "chapters",
  "courses",
  "categories",
  "settings",
  "users",
];

const ENROLLMENT_TEST_PASSWORD = "Password123@";

export type SignedInUser = { user: UserWithCredentials; cookies: string };

export type CourseContentShape = Array<{ lessonTypes: LessonTypes[] }>;

type RunInTenant = <T>(fn: () => Promise<T>) => Promise<T>;

/**
 * Seeds and reads enrollment state through the tenant-scoped (RLS) connection.
 * Every database call runs inside `runInTenant`; HTTP sign-in stays outside the tenant scope.
 */
export const createCourseEnrollmentHelpers = ({
  app,
  db,
  runInTenant,
}: {
  app: INestApplication;
  db: DatabasePg;
  runInTenant: RunInTenant;
}) => {
  const arrangeGlobalSettings = () =>
    runInTenant(() => createSettingsFactory(db).create({ userId: null }));

  const arrangeUser = (roleSlug: SystemRoleSlug) =>
    runInTenant(() => {
      const userFactory = createUserFactory(db).withCredentials({
        password: ENROLLMENT_TEST_PASSWORD,
      });

      return match(roleSlug)
        .with(SYSTEM_ROLE_SLUGS.ADMIN, () => userFactory.withAdminSettings(db).create())
        .with(SYSTEM_ROLE_SLUGS.CONTENT_CREATOR, () =>
          userFactory.withContentCreatorSettings(db).create(),
        )
        .with(SYSTEM_ROLE_SLUGS.TRAINER, () => userFactory.withTrainerSettings(db).create())
        .with(SYSTEM_ROLE_SLUGS.STUDENT, () => userFactory.withUserSettings(db).create())
        .with(SYSTEM_ROLE_SLUGS.GROUP_MANAGER, () =>
          userFactory.create({ roleSlug: SYSTEM_ROLE_SLUGS.GROUP_MANAGER }),
        )
        .exhaustive();
    });

  const arrangeSignedInUser = async (roleSlug: SystemRoleSlug): Promise<SignedInUser> => {
    const user = await arrangeUser(roleSlug);

    return { user, cookies: await cookieFor(user, app) };
  };

  const arrangeGroupWithMembers = (memberIds: UUIDType[]) =>
    runInTenant(() => createGroupFactory(db).withMembers(memberIds).create());

  const arrangeCourseWithContent = ({
    authorId,
    contentShape,
    course: courseOverrides = {},
  }: {
    authorId: UUIDType;
    contentShape: CourseContentShape;
    course?: Partial<CourseTest>;
  }) =>
    runInTenant(async () => {
      const course = await createCourseFactory(db).create({
        authorId,
        status: "published",
        ...courseOverrides,
      });

      const courseChapters = [];

      for (const [chapterIndex, { lessonTypes }] of contentShape.entries()) {
        const chapter = await createChapterFactory(db).create({
          courseId: course.id,
          authorId,
          displayOrder: chapterIndex + 1,
          lessonCount: lessonTypes.length,
        });

        const chapterLessons = [];

        for (const [lessonIndex, type] of lessonTypes.entries()) {
          chapterLessons.push(
            await createLessonFactory(db).create({
              chapterId: chapter.id,
              type,
              displayOrder: lessonIndex + 1,
              thresholdScore: type === LESSON_TYPES.QUIZ ? 0 : null,
            }),
          );
        }

        courseChapters.push({ chapter, lessons: chapterLessons });
      }

      return { course, chapters: courseChapters };
    });

  const findStudentEnrollment = (studentId: UUIDType, courseId: UUIDType) =>
    runInTenant(async () => {
      const [enrollment] = await db
        .select({
          status: studentCourses.status,
          enrolledAt: studentCourses.enrolledAt,
          enrolledByGroupId: studentCourses.enrolledByGroupId,
          paymentId: studentCourses.paymentId,
        })
        .from(studentCourses)
        .where(and(eq(studentCourses.studentId, studentId), eq(studentCourses.courseId, courseId)));

      return enrollment;
    });

  const findStudentCourseProgress = (studentId: UUIDType, courseId: UUIDType) =>
    runInTenant(async () => {
      const chapterProgress = await db
        .select({
          chapterId: studentChapterProgress.chapterId,
          completedLessonCount: studentChapterProgress.completedLessonCount,
          learningStateId: studentChapterProgress.learningStateId,
        })
        .from(studentChapterProgress)
        .where(
          and(
            eq(studentChapterProgress.studentId, studentId),
            eq(studentChapterProgress.courseId, courseId),
          ),
        );

      const lessonProgress = await db
        .select({
          lessonId: studentLessonProgress.lessonId,
          chapterId: studentLessonProgress.chapterId,
          quizScore: studentLessonProgress.quizScore,
          completedAt: studentLessonProgress.completedAt,
          learningStateId: studentLessonProgress.learningStateId,
        })
        .from(studentLessonProgress)
        .innerJoin(chapters, eq(chapters.id, studentLessonProgress.chapterId))
        .where(
          and(eq(studentLessonProgress.studentId, studentId), eq(chapters.courseId, courseId)),
        );

      return { chapterProgress, lessonProgress };
    });

  const findStudentModeCourseIds = (userId: UUIDType) =>
    runInTenant(async () => {
      const rows = await db
        .select({ courseId: courseStudentMode.courseId })
        .from(courseStudentMode)
        .where(eq(courseStudentMode.userId, userId));

      return rows.map(({ courseId }) => courseId);
    });

  return {
    arrangeGlobalSettings,
    arrangeUser,
    arrangeSignedInUser,
    arrangeGroupWithMembers,
    arrangeCourseWithContent,
    findStudentEnrollment,
    findStudentCourseProgress,
    findStudentModeCourseIds,
  };
};
