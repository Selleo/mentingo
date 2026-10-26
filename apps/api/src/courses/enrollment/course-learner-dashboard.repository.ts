import { Inject, Injectable } from "@nestjs/common";
import {
  COURSE_ENROLLMENT,
  COURSE_LEARNING_STATE_KINDS,
  COURSE_STATUSES,
  STUDENT_DASHBOARD_LIMITS,
  type SupportedLanguages,
} from "@repo/shared";
import { and, asc, desc, eq, inArray, isNotNull, isNull, not, or, sql } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { LocalizationService } from "src/localization/localization.service";
import { DB } from "src/storage/db/db.providers";
import {
  chapters,
  courseLearningStates,
  courses,
  groupCourses,
  groupUsers,
  lessons,
  studentCourses,
  studentLessonProgress,
} from "src/storage/schema";
import { PROGRESS_STATUSES } from "src/utils/types/progress.type";

import { studentCourseProgressOrderSql } from "../utils/course-progress-sql";

@Injectable()
export class CourseLearnerDashboardRepository {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly localizationService: LocalizationService,
  ) {}

  async updateEnrollmentLastOpenedAt(courseId: UUIDType, studentId: UUIDType) {
    const [updatedEnrollment] = await this.db
      .update(studentCourses)
      .set({ lastOpenedAt: sql`CURRENT_TIMESTAMP` })
      .where(
        and(
          eq(studentCourses.courseId, courseId),
          eq(studentCourses.studentId, studentId),
          eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED),
        ),
      )
      .returning({ id: studentCourses.id });

    return updatedEnrollment;
  }

  /** Started or repeated courses, least progressed first. */
  async findContinueLearningCourses(studentId: UUIDType, language: SupportedLanguages) {
    const continueCourseTitle = this.localizationService.getLocalizedSqlField(
      courses.title,
      language,
    );

    return this.db
      .select({
        courseId: courses.id,
        title: continueCourseTitle,
        thumbnailS3Key: courses.thumbnailS3Key,
        completedChapterCount: sql<number>`COALESCE(${courseLearningStates.finishedChapterCount}, ${studentCourses.finishedChapterCount})`,
        courseChapterCount: courses.chapterCount,
      })
      .from(studentCourses)
      .innerJoin(courses, eq(courses.id, studentCourses.courseId))
      .leftJoin(
        courseLearningStates,
        and(
          eq(courseLearningStates.courseId, studentCourses.courseId),
          eq(courseLearningStates.studentId, studentCourses.studentId),
          eq(courseLearningStates.kind, COURSE_LEARNING_STATE_KINDS.REPETITION),
        ),
      )
      .where(
        and(
          eq(studentCourses.studentId, studentId),
          eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED),
          or(
            and(
              eq(studentCourses.progress, PROGRESS_STATUSES.IN_PROGRESS),
              isNull(studentCourses.completedAt),
            ),
            isNotNull(courseLearningStates.finishedChapterCount),
          ),
          inArray(courses.status, [COURSE_STATUSES.PUBLISHED, COURSE_STATUSES.PRIVATE]),
        ),
      )
      .orderBy(
        studentCourseProgressOrderSql(),
        asc(continueCourseTitle),
        desc(studentCourses.lastOpenedAt),
        desc(studentCourses.updatedAt),
      )
      .limit(STUDENT_DASHBOARD_LIMITS.CONTINUE_COURSES);
  }

  /** Unfinished mandatory group courses, earliest due date first. */
  async findRequiredCourses(studentId: UUIDType, language: SupportedLanguages) {
    return this.db
      .select({
        courseId: courses.id,
        title: this.localizationService.getLocalizedSqlField(courses.title, language),
        thumbnailS3Key: courses.thumbnailS3Key,
        dueDate: sql<string | null>`MIN(${groupCourses.dueDate})::TEXT`,
      })
      .from(groupUsers)
      .innerJoin(groupCourses, eq(groupCourses.groupId, groupUsers.groupId))
      .innerJoin(courses, eq(courses.id, groupCourses.courseId))
      .leftJoin(
        studentCourses,
        and(
          eq(studentCourses.studentId, groupUsers.userId),
          eq(studentCourses.courseId, groupCourses.courseId),
        ),
      )
      .where(
        and(
          eq(groupUsers.userId, studentId),
          eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED),
          isNull(studentCourses.completedAt),
          eq(groupCourses.isMandatory, true),
          inArray(courses.status, [COURSE_STATUSES.PUBLISHED, COURSE_STATUSES.PRIVATE]),
        ),
      )
      .groupBy(courses.id)
      .orderBy(sql`MIN(${groupCourses.dueDate}) NULLS LAST`, courses.title)
      .limit(STUDENT_DASHBOARD_LIMITS.REQUIRED_COURSES);
  }

  async findCourseCompletionCounts(studentId: UUIDType) {
    const [completion] = await this.db
      .select({
        total: sql<number>`COUNT(*)::int`,
        completed: sql<number>`COUNT(*) FILTER (WHERE ${studentCourses.completedAt} IS NOT NULL)::int`,
        inProgress: sql<number>`COUNT(*) FILTER (
          WHERE ${studentCourses.completedAt} IS NULL
            AND ${studentCourses.progress} = ${PROGRESS_STATUSES.IN_PROGRESS}
        )::int`,
        notStarted: sql<number>`COUNT(*) FILTER (
          WHERE ${studentCourses.completedAt} IS NULL
            AND ${studentCourses.progress} <> ${PROGRESS_STATUSES.IN_PROGRESS}
        )::int`,
      })
      .from(studentCourses)
      .where(
        and(
          eq(studentCourses.studentId, studentId),
          eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED),
        ),
      );

    return completion;
  }

  /** The first lesson the student has not completed (or passed) in each course. */
  async findNextLessons(courseIds: UUIDType[], studentId: UUIDType, language: SupportedLanguages) {
    if (!courseIds.length) return [];

    return this.db
      .selectDistinctOn([chapters.courseId], {
        courseId: chapters.courseId,
        id: lessons.id,
        title: this.localizationService.getLocalizedSqlField(lessons.title, language),
      })
      .from(lessons)
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .innerJoin(courses, eq(courses.id, chapters.courseId))
      .leftJoin(
        studentLessonProgress,
        and(
          eq(studentLessonProgress.lessonId, lessons.id),
          eq(studentLessonProgress.chapterId, chapters.id),
          eq(studentLessonProgress.studentId, studentId),
        ),
      )
      .where(
        and(
          inArray(chapters.courseId, courseIds),
          not(
            and(
              isNotNull(studentLessonProgress.completedAt),
              or(
                eq(studentLessonProgress.isQuizPassed, true),
                isNull(studentLessonProgress.isQuizPassed),
              ),
            )!,
          ),
        ),
      )
      .orderBy(chapters.courseId, chapters.displayOrder, lessons.displayOrder);
  }
}
