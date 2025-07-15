import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { and, eq, isNotNull, sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { LESSON_TYPES } from "src/lesson/lesson.type";
import { StatisticsRepository } from "src/statistics/repositories/statistics.repository";
import {
  aiMentorStudentLessonProgress,
  chapters,
  courses,
  lessons,
  studentChapterProgress,
  studentCourses,
  studentLessonProgress,
} from "src/storage/schema";
import { USER_ROLES, type UserRole } from "src/user/schemas/userRoles";
import { PROGRESS_STATUSES } from "src/utils/types/progress.type";

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { ResponseAiJudgeJudgementBody } from "src/ai/utils/ai.schema";
import type { UUIDType } from "src/common";
import type * as schema from "src/storage/schema";
import type { ProgressStatus } from "src/utils/types/progress.type";

@Injectable()
export class StudentLessonProgressService {
  async markLessonAsCompleted(
    id: UUIDType,
    studentId: UUIDType,
    userRole?: UserRole,
    quizCompleted = false,
    completedQuestionCount = 0,
    dbInstance: PostgresJsDatabase<typeof schema> = this.db,
    aiMentorLessonData?: ResponseAiJudgeJudgementBody,
  ) {
    const [accessCourseLessonWithDetails] = await this.checkLessonAssignment(id, studentId);

    if (userRole === USER_ROLES.CONTENT_CREATOR || userRole === USER_ROLES.ADMIN) return;

    if (!accessCourseLessonWithDetails.isAssigned && !accessCourseLessonWithDetails.isFreemium)
      throw new UnauthorizedException("You don't have assignment to this lesson");

    if (accessCourseLessonWithDetails.lessonIsCompleted) return;

    const [lesson] = await this.db
      .select({
        id: lessons.id,
        type: lessons.type,
        chapterId: chapters.id,
        chapterLessonCount: chapters.lessonCount,
        courseId: chapters.courseId,
      })
      .from(lessons)
      .leftJoin(chapters, eq(chapters.id, lessons.chapterId))
      .where(and(eq(lessons.id, id)));

    if (!lesson || !lesson.chapterId || !lesson.courseId || !lesson.chapterLessonCount) {
      throw new NotFoundException(`Lesson with id ${id} not found`);
    }

    if (lesson.type === LESSON_TYPES.QUIZ && !quizCompleted)
      throw new BadRequestException("Quiz not completed");

    if (lesson.type === LESSON_TYPES.AI_MENTOR && !aiMentorLessonData)
      throw new BadRequestException("No AI Mentor Lesson Data given");

    const [lessonProgress] = await dbInstance
      .select()
      .from(studentLessonProgress)
      .where(
        and(eq(studentLessonProgress.lessonId, id), eq(studentLessonProgress.studentId, studentId)),
      );

    let currentLessonProgress;

    if (!lessonProgress) {
      [currentLessonProgress] = await dbInstance
        .insert(studentLessonProgress)
        .values({
          studentId,
          lessonId: lesson.id,
          chapterId: lesson.chapterId,
          completedQuestionCount,
        })
        .returning();
    } else {
      currentLessonProgress = lessonProgress;
    }

    const updateConditions =
      (!lessonProgress?.completedAt && lesson.type !== LESSON_TYPES.AI_MENTOR) ||
      (LESSON_TYPES.AI_MENTOR && !!aiMentorLessonData?.passed);

    if (updateConditions) {
      await dbInstance
        .update(studentLessonProgress)
        .set({ completedAt: sql`now()`, completedQuestionCount })
        .where(
          and(
            eq(studentLessonProgress.lessonId, lesson.id),
            eq(studentLessonProgress.studentId, studentId),
          ),
        );
    }

    if (lesson.type === LESSON_TYPES.AI_MENTOR && aiMentorLessonData) {
      const [existingAiMentorLesson] = await dbInstance
        .select()
        .from(aiMentorStudentLessonProgress)
        .where(eq(aiMentorStudentLessonProgress.studentLessonProgressId, currentLessonProgress.id));

      if (!existingAiMentorLesson) {
        await dbInstance.insert(aiMentorStudentLessonProgress).values({
          ...aiMentorLessonData,
          studentLessonProgressId: currentLessonProgress.id,
        });
      } else {
        await dbInstance
          .update(aiMentorStudentLessonProgress)
          .set(aiMentorLessonData)
          .where(
            eq(aiMentorStudentLessonProgress.studentLessonProgressId, currentLessonProgress.id),
          );
      }
    }

    const isCompletedAsFreemium =
      !accessCourseLessonWithDetails.isAssigned && accessCourseLessonWithDetails.isFreemium;

    await this.updateChapterProgress(
      lesson.courseId,
      lesson.chapterId,
      studentId,
      lesson.chapterLessonCount,
      isCompletedAsFreemium,
      dbInstance,
    );

    if (isCompletedAsFreemium) return;

    await this.checkCourseIsCompletedForUser(lesson.courseId, studentId, dbInstance);
  }

  constructor(
    @Inject("DB") private readonly db: DatabasePg,
    private readonly statisticsRepository: StatisticsRepository,
  ) {}

  private async updateChapterProgress(
    courseId: UUIDType,
    chapterId: UUIDType,
    studentId: UUIDType,
    lessonCount: number,
    completedAsFreemium = false,
    trx?: PostgresJsDatabase<typeof schema>,
  ) {
    const dbInstance = trx ?? this.db;

    const [completedLessonCount] = await dbInstance
      .select({ count: sql<number>`count(*)::INTEGER` })
      .from(studentLessonProgress)
      .where(
        and(
          eq(studentLessonProgress.chapterId, chapterId),
          eq(studentLessonProgress.studentId, studentId),
          isNotNull(studentLessonProgress.completedAt),
        ),
      );

    if (completedLessonCount.count === lessonCount) {
      return await dbInstance
        .insert(studentChapterProgress)
        .values({
          completedLessonCount: completedLessonCount.count,
          completedAt: sql`now()`,
          completedAsFreemium,
          courseId,
          chapterId,
          studentId,
        })
        .onConflictDoUpdate({
          target: [
            studentChapterProgress.studentId,
            studentChapterProgress.chapterId,
            studentChapterProgress.courseId,
          ],
          set: {
            completedLessonCount: completedLessonCount.count,
            completedAt: sql`now()`,
            completedAsFreemium,
          },
        })
        .returning();
    }

    return await dbInstance
      .insert(studentChapterProgress)
      .values({
        completedLessonCount: completedLessonCount.count,
        courseId,
        chapterId,
        studentId,
      })
      .onConflictDoUpdate({
        target: [
          studentChapterProgress.studentId,
          studentChapterProgress.chapterId,
          studentChapterProgress.courseId,
        ],
        set: {
          completedLessonCount: completedLessonCount.count,
        },
      });
  }

  private async checkCourseIsCompletedForUser(
    courseId: UUIDType,
    studentId: UUIDType,
    trx?: PostgresJsDatabase<typeof schema>,
  ) {
    const courseProgress = await this.getCourseCompletionStatus(courseId, studentId, trx);
    const courseFinishedChapterCount = await this.getCourseFinishedChapterCount(
      courseId,
      studentId,
      trx,
    );

    if (courseProgress.courseIsCompleted) {
      await this.updateStudentCourseStats(
        studentId,
        courseId,
        PROGRESS_STATUSES.COMPLETED,
        courseFinishedChapterCount,
        trx,
      );

      return await this.statisticsRepository.updateCompletedAsFreemiumCoursesStats(courseId);
    }

    if (courseProgress.progress !== PROGRESS_STATUSES.COMPLETED) {
      return await this.updateStudentCourseStats(
        studentId,
        courseId,
        PROGRESS_STATUSES.IN_PROGRESS,
        courseFinishedChapterCount,
        trx,
      );
    }
  }

  private async getCourseFinishedChapterCount(
    courseId: UUIDType,
    studentId: UUIDType,
    dbInstance: PostgresJsDatabase<typeof schema> = this.db,
  ) {
    const [finishedChapterCount] = await dbInstance
      .select({
        count: sql<number>`COUNT(DISTINCT ${studentChapterProgress.chapterId})::INTEGER`,
      })
      .from(studentChapterProgress)
      .where(
        and(
          eq(studentChapterProgress.studentId, studentId),
          eq(studentChapterProgress.courseId, courseId),
          isNotNull(studentChapterProgress.completedAt),
        ),
      );

    return finishedChapterCount.count;
  }

  private async getCourseCompletionStatus(
    courseId: UUIDType,
    studentId: UUIDType,
    dbInstance: PostgresJsDatabase<typeof schema> = this.db,
  ) {
    const [courseCompletedStatus] = await dbInstance
      .select({
        courseIsCompleted: sql<boolean>`${studentCourses.finishedChapterCount} = ${courses.chapterCount}`,
        progress: sql<ProgressStatus>`${studentCourses.progress}`,
      })
      .from(studentCourses)
      .leftJoin(courses, and(eq(courses.id, studentCourses.courseId)))
      .where(and(eq(studentCourses.courseId, courseId), eq(studentCourses.studentId, studentId)));

    return {
      courseIsCompleted: courseCompletedStatus.courseIsCompleted,
      progress: courseCompletedStatus.progress,
    };
  }

  private async updateStudentCourseStats(
    studentId: UUIDType,
    courseId: UUIDType,
    progress: ProgressStatus,
    finishedChapterCount: number,
    dbInstance: PostgresJsDatabase<typeof schema> = this.db,
  ) {
    if (progress === PROGRESS_STATUSES.COMPLETED) {
      return await dbInstance
        .update(studentCourses)
        .set({ progress, completedAt: sql`now()`, finishedChapterCount })
        .where(and(eq(studentCourses.studentId, studentId), eq(studentCourses.courseId, courseId)));
    }

    return await dbInstance
      .update(studentCourses)
      .set({ progress, finishedChapterCount })
      .where(and(eq(studentCourses.studentId, studentId), eq(studentCourses.courseId, courseId)));
  }

  private async checkLessonAssignment(
    id: UUIDType,
    userId: UUIDType,
    dbInstance: PostgresJsDatabase<typeof schema> = this.db,
  ) {
    return dbInstance
      .select({
        isAssigned: sql<boolean>`CASE WHEN ${studentCourses.id} IS NOT NULL THEN TRUE ELSE FALSE END`,
        isFreemium: sql<boolean>`CASE WHEN ${chapters.isFreemium} THEN TRUE ELSE FALSE END`,
        lessonIsCompleted: sql<boolean>`CASE WHEN ${studentLessonProgress.completedAt} IS NOT NULL THEN TRUE ELSE FALSE END`,
        chapterId: sql<string>`${chapters.id}`,
        courseId: sql<string>`${chapters.courseId}`,
      })
      .from(lessons)
      .leftJoin(
        studentLessonProgress,
        and(
          eq(studentLessonProgress.lessonId, lessons.id),
          eq(studentLessonProgress.studentId, userId),
        ),
      )
      .leftJoin(chapters, eq(lessons.chapterId, chapters.id))
      .leftJoin(
        studentCourses,
        and(eq(studentCourses.courseId, chapters.courseId), eq(studentCourses.studentId, userId)),
      )
      .where(eq(lessons.id, id));
  }
}
