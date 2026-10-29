import { Inject, Injectable } from "@nestjs/common";
import { COURSE_ENROLLMENT, type SupportedLanguages } from "@repo/shared";
import { and, eq, isNotNull, sql } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { getGroupManagerCourseScopeCondition } from "src/common/permissions/group-manager-scope.utils";
import { activeLearningState } from "src/course-repetition/course-learning-state.sql";
import { LESSON_TYPES } from "src/lesson/lesson.type";
import { LocalizationService } from "src/localization/localization.service";
import { DB } from "src/storage/db/db.providers";
import {
  assessmentQuestions,
  assessments,
  categories,
  chapters,
  courses,
  groupCourses,
  lessons,
  studentChapterProgress,
  studentCourses,
  studentLessonProgress,
} from "src/storage/schema";
import { PROGRESS_STATUSES } from "src/utils/types/progress.type";

import { localizedLearningOutcomesSql } from "../utils/course-learning-outcomes-sql";
import { courseHasFreeChaptersSql } from "../utils/course-summary-sql";

import type { CurrentUserType } from "src/common/types/current-user.type";
import type { LessonForChapterSchema } from "src/lesson/lesson.schema";
import type { ProgressStatus } from "src/utils/types/progress.type";

@Injectable()
export class CourseDetailRepository {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly localizationService: LocalizationService,
  ) {}

  async runInTransaction<T>(callback: (trx: DatabasePg) => Promise<T>) {
    return this.db.transaction(callback);
  }

  async findCourseAuthorId(courseId: UUIDType) {
    const [course] = await this.db
      .select({ authorId: courses.authorId })
      .from(courses)
      .where(eq(courses.id, courseId));

    return course?.authorId;
  }

  async isCourseInGroupManagerScope(courseId: UUIDType, currentUser: CurrentUserType) {
    const managedCourses = await this.db
      .select({ id: courses.id })
      .from(courses)
      .where(
        and(
          eq(courses.id, courseId),
          getGroupManagerCourseScopeCondition(currentUser, courses.id, []),
        ),
      );

    return managedCourses.length > 0;
  }

  async hasActiveEnrollment(courseId: UUIDType, studentId: UUIDType) {
    const enrollments = await this.db
      .select({ id: studentCourses.id })
      .from(studentCourses)
      .where(
        and(
          eq(studentCourses.courseId, courseId),
          eq(studentCourses.studentId, studentId),
          eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED),
        ),
      )
      .limit(1);

    return enrollments.length > 0;
  }

  /** Editors read the exact language; everyone else falls back to the base language. */
  async findCourseDetail(
    courseId: UUIDType,
    userId: UUIDType,
    language: SupportedLanguages,
    useExactLanguage: boolean,
  ) {
    const [course] = await this.db
      .select({
        id: courses.id,
        title: useExactLanguage
          ? this.localizationService.getFieldByLanguage(courses.title, language)
          : this.localizationService.getLocalizedSqlField(courses.title, language),
        thumbnailS3Key: sql<string>`${courses.thumbnailS3Key}`,
        category: this.localizationService.getLocalizedSqlField(
          categories.title,
          language,
          categories,
        ),
        showAuthorSection: courses.showAuthorSection,
        thumbnailPositionY: courses.thumbnailPositionY,
        description: useExactLanguage
          ? this.localizationService.getFieldByLanguage(courses.description, language)
          : this.localizationService.getLocalizedSqlField(courses.description, language),
        learningOutcomes: localizedLearningOutcomesSql(language, !useExactLanguage),
        courseChapterCount: courses.chapterCount,
        completedChapterCount: sql<number>`CASE WHEN ${studentCourses.status} = ${COURSE_ENROLLMENT.ENROLLED} THEN COALESCE(${studentCourses.finishedChapterCount}, 0) ELSE 0 END`,
        enrolled: sql<boolean>`CASE WHEN ${studentCourses.status} = ${COURSE_ENROLLMENT.ENROLLED} THEN TRUE ELSE FALSE END`,
        status: courses.status,
        courseType: courses.courseType,
        isArchived: courses.isArchived,
        priceInCents: courses.priceInCents,
        currency: courses.currency,
        authorId: courses.authorId,
        authorMetadata: courses.authorMetadata,
        hasCertificate: courses.hasCertificate,
        hasFreeChapter: courseHasFreeChaptersSql(),
        stripeProductId: courses.stripeProductId,
        stripePriceId: courses.stripePriceId,
        availableLocales: sql<SupportedLanguages[]>`${courses.availableLocales}`,
        baseLanguage: sql<SupportedLanguages>`${courses.baseLanguage}`,
        dueDate: sql<string | null>`TO_CHAR(${groupCourses.dueDate}, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`,
        originType: courses.originType,
        isContentReadonly: sql<boolean>`${courses.originType} = 'exported'`,
      })
      .from(courses)
      .leftJoin(categories, eq(courses.categoryId, categories.id))
      .leftJoin(
        studentCourses,
        and(eq(courses.id, studentCourses.courseId), eq(studentCourses.studentId, userId)),
      )
      .leftJoin(
        groupCourses,
        and(
          eq(groupCourses.courseId, courses.id),
          eq(groupCourses.groupId, studentCourses.enrolledByGroupId),
        ),
      )
      .where(eq(courses.id, courseId));

    return course;
  }

  /** Chapters with the student's progress; lessons of paid chapters are blocked until enrolled. */
  async findCourseChaptersWithProgress(
    courseId: UUIDType,
    userId: UUIDType,
    language: SupportedLanguages,
    isEnrolled: boolean,
  ) {
    return this.db
      .select({
        id: chapters.id,
        title: this.localizationService.getLocalizedSqlField(chapters.title, language),
        isSubmitted: sql<boolean>`
          EXISTS (
            SELECT 1
            FROM ${studentChapterProgress}
            JOIN ${studentCourses} ON ${studentCourses.courseId} = ${courseId} AND ${
              studentCourses.studentId
            } = ${studentChapterProgress.studentId}
            WHERE ${studentChapterProgress.chapterId} = ${chapters.id}
              AND ${studentChapterProgress.courseId} = ${courseId}
              AND ${studentChapterProgress.studentId} = ${userId}
              AND ${studentChapterProgress.completedAt} IS NOT NULL
              AND ${activeLearningState(studentChapterProgress.learningStateId)}
              AND ${studentCourses.status} = ${COURSE_ENROLLMENT.ENROLLED}
          )::BOOLEAN`,
        lessonCount: chapters.lessonCount,
        quizCount: sql<number>`
          (SELECT COUNT(*)
          FROM ${lessons}
          WHERE ${lessons.chapterId} = ${chapters.id}
            AND ${lessons.type} = ${LESSON_TYPES.QUIZ})::INTEGER`,
        completedLessonCount: sql<number>`CASE WHEN ${studentCourses.status} = ${COURSE_ENROLLMENT.ENROLLED} THEN COALESCE(${studentChapterProgress.completedLessonCount}, 0) ELSE 0 END`,
        chapterProgress: sql<ProgressStatus>`
          CASE
          WHEN ${studentCourses.status} = ${COURSE_ENROLLMENT.NOT_ENROLLED} THEN ${
            PROGRESS_STATUSES.NOT_STARTED
          }
            WHEN ${studentChapterProgress.completedAt} IS NOT NULL THEN ${
              PROGRESS_STATUSES.COMPLETED
            }
            WHEN ${studentChapterProgress.completedLessonCount} > 0 OR EXISTS (
              SELECT 1
              FROM ${studentLessonProgress}
              WHERE ${studentLessonProgress.chapterId} = ${chapters.id}
                AND ${studentLessonProgress.studentId} = ${userId}
                AND ${studentLessonProgress.isStarted} = TRUE
                AND ${activeLearningState(studentLessonProgress.learningStateId)}
            ) THEN ${PROGRESS_STATUSES.IN_PROGRESS}
            ELSE ${PROGRESS_STATUSES.NOT_STARTED}
          END
        `,
        isFreemium: chapters.isFreemium,
        displayOrder: sql<number>`${chapters.displayOrder}`,
        lessons: sql<LessonForChapterSchema>`
          COALESCE(
            (
              SELECT json_agg(lesson_data)
              FROM (
                SELECT
                  ${lessons.id} AS id,
                  ${this.localizationService.getLocalizedSqlField(
                    lessons.title,
                    language,
                  )} AS title,
                  ${lessons.type} AS type,
                  ${lessons.displayOrder} AS "displayOrder",
                  ${lessons.isExternal} AS "isExternal",
                  CASE
                    WHEN (${chapters.isFreemium} = FALSE AND ${isEnrolled} = FALSE) THEN ${
                      PROGRESS_STATUSES.BLOCKED
                    }
                    WHEN ${studentLessonProgress.completedAt} IS NOT NULL AND (${
                      studentLessonProgress.isQuizPassed
                    } IS TRUE OR ${studentLessonProgress.isQuizPassed} IS NULL) THEN ${
                      PROGRESS_STATUSES.COMPLETED
                    }
                    WHEN ${studentLessonProgress.isStarted} THEN  ${PROGRESS_STATUSES.IN_PROGRESS}
                    ELSE  ${PROGRESS_STATUSES.NOT_STARTED}
                  END AS status,
                  CASE
                    WHEN ${lessons.type} = ${LESSON_TYPES.QUIZ} THEN COUNT(${
                      assessmentQuestions.id
                    })
                    ELSE NULL
                  END AS "quizQuestionCount"
                FROM ${lessons}
                LEFT JOIN ${studentLessonProgress} ON ${lessons.id} = ${
                  studentLessonProgress.lessonId
                }
                  AND ${studentLessonProgress.studentId} = ${userId}
                  AND ${activeLearningState(studentLessonProgress.learningStateId)}
                LEFT JOIN ${assessments} ON ${assessments.lessonId} = ${lessons.id}
                LEFT JOIN ${assessmentQuestions} ON ${assessments.id} = ${
                  assessmentQuestions.assessmentId
                }
                LEFT JOIN ${courses} ON ${courses.id} = ${chapters.courseId}
                WHERE ${lessons.chapterId} = ${chapters.id}
                GROUP BY
                  ${lessons.id},
                  ${lessons.type},
                  ${lessons.displayOrder},
                  ${lessons.title},
                  ${studentLessonProgress.completedAt},
                  ${studentLessonProgress.completedQuestionCount},
                  ${studentLessonProgress.isStarted},
                  ${chapters.isFreemium},
                  ${studentLessonProgress.isQuizPassed},
                  ${courses.availableLocales},
                  ${courses.baseLanguage}
                ORDER BY ${lessons.displayOrder}
              ) AS lesson_data
            ),
            '[]'::json
          )
        `,
      })
      .from(chapters)
      .leftJoin(
        studentChapterProgress,
        and(
          eq(studentChapterProgress.chapterId, chapters.id),
          eq(studentChapterProgress.studentId, userId),
          activeLearningState(studentChapterProgress.learningStateId),
        ),
      )
      .leftJoin(
        studentCourses,
        and(eq(studentCourses.courseId, courseId), eq(studentCourses.studentId, userId)),
      )
      .innerJoin(courses, eq(courses.id, chapters.courseId))
      .where(and(eq(chapters.courseId, courseId), isNotNull(chapters.title)))
      .orderBy(chapters.displayOrder);
  }

  async findCourseVisibility(courseId: UUIDType, userId?: UUIDType) {
    const [course] = await this.db
      .select({
        id: courses.id,
        status: courses.status,
        isArchived: courses.isArchived,
        authorId: courses.authorId,
        enrolled:
          userId !== undefined
            ? sql<boolean>`CASE WHEN ${studentCourses.status} = ${COURSE_ENROLLMENT.ENROLLED} THEN TRUE ELSE FALSE END`
            : sql<boolean>`FALSE`,
      })
      .from(courses)
      .leftJoin(
        studentCourses,
        userId !== undefined
          ? and(eq(studentCourses.courseId, courses.id), eq(studentCourses.studentId, userId))
          : sql`FALSE`,
      )
      .where(eq(courses.id, courseId))
      .limit(1);

    return course;
  }

  async findAuthoringCourse(courseId: UUIDType, language: SupportedLanguages) {
    const [course] = await this.db
      .select({
        id: courses.id,
        title: this.localizationService.getFieldByLanguage(courses.title, language),
        thumbnailS3Key: sql<string>`COALESCE(${courses.thumbnailS3Key}, '')`,
        category: this.localizationService.getLocalizedSqlField(
          categories.title,
          language,
          categories,
        ),
        categoryId: categories.id,
        description: this.localizationService.getFieldByLanguage(courses.description, language),
        courseChapterCount: courses.chapterCount,
        status: courses.status,
        priceInCents: courses.priceInCents,
        currency: courses.currency,
        authorId: courses.authorId,
        hasCertificate: courses.hasCertificate,
        availableLocales: sql<SupportedLanguages[]>`${courses.availableLocales}`,
        baseLanguage: sql<SupportedLanguages>`${courses.baseLanguage}`,
        originType: courses.originType,
        isContentReadonly: sql<boolean>`${courses.originType} = 'exported'`,
        courseType: courses.courseType,
        sourceCourseId: courses.sourceCourseId,
        sourceTenantId: courses.sourceTenantId,
      })
      .from(courses)
      .innerJoin(categories, eq(courses.categoryId, categories.id))
      .where(and(eq(courses.id, courseId)));

    return course;
  }

  async findAuthoringChapters(courseId: UUIDType, language: SupportedLanguages) {
    return this.db
      .select({
        id: chapters.id,
        title: this.localizationService.getFieldByLanguage(chapters.title, language),
        displayOrder: sql<number>`${chapters.displayOrder}`,
        lessonCount: chapters.lessonCount,
        updatedAt: chapters.updatedAt,
        isFree: chapters.isFreemium,
        lessons: sql<LessonForChapterSchema>`
          COALESCE(
            (
              SELECT array_agg(${lessons.id} ORDER BY ${lessons.displayOrder})
              FROM ${lessons}
              WHERE ${lessons.chapterId} = ${chapters.id}
            ),
            '{}'
          )
        `,
      })
      .from(chapters)
      .innerJoin(courses, eq(courses.id, chapters.courseId))
      .where(and(eq(chapters.courseId, courseId), isNotNull(chapters.title)))
      .orderBy(chapters.displayOrder);
  }

  async findCourseEmailData(courseId: UUIDType, language?: SupportedLanguages) {
    const [courseData] = await this.db
      .select({
        courseName: this.localizationService.getLocalizedSqlField(courses.title, language),
        hasCertificate: courses.hasCertificate,
      })
      .from(courses)
      .where(eq(courses.id, courseId));

    return courseData;
  }

  async findChapterName(chapterId: UUIDType, language?: SupportedLanguages) {
    const [{ chapterName }] = await this.db
      .select({
        chapterName: this.localizationService.getLocalizedSqlField(chapters.title, language),
      })
      .from(chapters)
      .innerJoin(courses, eq(courses.id, chapters.courseId))
      .where(eq(chapters.id, chapterId));

    return chapterName;
  }
}
