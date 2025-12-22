import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { EventBus } from "@nestjs/cqrs";
import { COURSE_ENROLLMENT } from "@repo/shared";
import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";

import { CertificatesService } from "src/certificates/certificates.service";
import { DatabasePg } from "src/common";
import { setJsonbField } from "src/common/helpers/sqlHelpers";
import { CourseCompletedEvent, LessonCompletedEvent } from "src/events";
import { UserChapterFinishedEvent } from "src/events/user/user-chapter-finished.event";
import { UserCourseFinishedEvent } from "src/events/user/user-course-finished.event";
import { LESSON_TYPES } from "src/lesson/lesson.type";
import { LocalizationService } from "src/localization/localization.service";
import { ENTITY_TYPE } from "src/localization/localization.types";
import { StatisticsRepository } from "src/statistics/repositories/statistics.repository";
import {
  aiMentorStudentLessonProgress,
  chapters,
  courses,
  groups,
  groupUsers,
  lessons,
  studentChapterProgress,
  studentCourses,
  studentLessonProgress,
  users,
} from "src/storage/schema";
import { USER_ROLES, type UserRole } from "src/user/schemas/userRoles";
import { PROGRESS_STATUSES } from "src/utils/types/progress.type";

import type { SupportedLanguages } from "@repo/shared";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { ResponseAiJudgeJudgementBody } from "src/ai/utils/ai.schema";
import type { UUIDType } from "src/common";
import type { CurrentUser } from "src/common/types/current-user.type";
import type * as schema from "src/storage/schema";
import type { ProgressStatus } from "src/utils/types/progress.type";

@Injectable()
export class StudentLessonProgressService {
  constructor(
    @Inject("DB") private readonly db: DatabasePg,
    private readonly statisticsRepository: StatisticsRepository,
    private readonly certificatesService: CertificatesService,
    private readonly eventBus: EventBus,
    private readonly localizationService: LocalizationService,
  ) {}

  async markLessonAsCompleted({
    id,
    studentId,
    userRole,
    actor,
    quizCompleted = false,
    completedQuestionCount = 0,
    dbInstance = this.db,
    aiMentorLessonData,
    language,
    isQuizPassed = false,
  }: {
    id: UUIDType;
    studentId: UUIDType;
    userRole?: UserRole;
    actor?: CurrentUser;
    quizCompleted?: boolean;
    completedQuestionCount?: number;
    dbInstance?: PostgresJsDatabase<typeof schema>;
    aiMentorLessonData?: ResponseAiJudgeJudgementBody;
    language: SupportedLanguages;
    isQuizPassed?: boolean;
  }) {
    if (userRole === USER_ROLES.CONTENT_CREATOR || userRole === USER_ROLES.ADMIN) return;

    const [accessCourseLessonWithDetails] = await this.checkLessonAssignment(id, studentId);

    if (!accessCourseLessonWithDetails.isAssigned && !accessCourseLessonWithDetails.isFreemium)
      throw new UnauthorizedException("You don't have assignment to this lesson");

    if (
      accessCourseLessonWithDetails.lessonIsCompleted ||
      accessCourseLessonWithDetails.attempts > 1
    )
      return;

    if (accessCourseLessonWithDetails.lessonIsCompleted) return;

    const { language: actualLanguage } = await this.localizationService.getBaseLanguage(
      ENTITY_TYPE.LESSON,
      id,
      language,
    );

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

    if (lesson.type === LESSON_TYPES.QUIZ && !quizCompleted) {
      throw new BadRequestException("Quiz not completed");
    }

    if (lesson.type === LESSON_TYPES.AI_MENTOR && !aiMentorLessonData)
      throw new BadRequestException("No AI Mentor Lesson Data given");

    const [lessonProgress] = await dbInstance
      .select()
      .from(studentLessonProgress)
      .where(
        and(eq(studentLessonProgress.lessonId, id), eq(studentLessonProgress.studentId, studentId)),
      );

    const currentLessonProgress = !lessonProgress
      ? (
          await dbInstance
            .insert(studentLessonProgress)
            .values({
              studentId,
              lessonId: lesson.id,
              chapterId: lesson.chapterId,
              completedQuestionCount,
            })
            .onConflictDoUpdate({
              target: [
                studentLessonProgress.studentId,
                studentLessonProgress.lessonId,
                studentLessonProgress.chapterId,
              ],
              set: {
                completedQuestionCount,
              },
            })
            .returning()
        )[0]
      : lessonProgress;

    const shouldUpdate =
      !lessonProgress?.completedAt &&
      (lesson.type !== LESSON_TYPES.AI_MENTOR
        ? lesson.type !== LESSON_TYPES.QUIZ || isQuizPassed
        : !!aiMentorLessonData?.passed);

    let lessonCompleted = false;

    if (shouldUpdate) {
      const updated = await dbInstance
        .update(studentLessonProgress)
        .set({
          completedAt: sql`now
          ()`,
          completedQuestionCount,
        })
        .where(
          and(
            eq(studentLessonProgress.lessonId, lesson.id),
            eq(studentLessonProgress.studentId, studentId),
            isNull(studentLessonProgress.completedAt),
          ),
        )
        .returning();

      lessonCompleted = updated.length > 0;
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

    const resolvedActor = await this.resolveActor(studentId, actor, dbInstance);

    if (lessonCompleted || isQuizPassed) {
      this.eventBus.publish(
        new LessonCompletedEvent({
          userId: studentId,
          courseId: lesson.courseId,
          lessonId: lesson.id,
          actor: resolvedActor,
        }),
      );

      await this.updateChapterProgress(
        lesson.courseId,
        lesson.chapterId,
        studentId,
        lesson.chapterLessonCount,
        isCompletedAsFreemium,
        resolvedActor,
        dbInstance,
      );

      if (isCompletedAsFreemium) return;

      await this.checkCourseIsCompletedForUser(
        lesson.courseId,
        studentId,
        resolvedActor,
        dbInstance,
        actualLanguage,
      );
    }
  }

  async markLessonAsStarted(
    id: UUIDType,
    studentId: UUIDType,
    userRole?: UserRole,
    dbInstance: PostgresJsDatabase<typeof schema> = this.db,
  ) {
    const [accessCourseLessonWithDetails] = await this.checkLessonAssignment(id, studentId);

    if (userRole === USER_ROLES.CONTENT_CREATOR || userRole === USER_ROLES.ADMIN) return;

    if (!accessCourseLessonWithDetails.isAssigned && !accessCourseLessonWithDetails.isFreemium)
      throw new UnauthorizedException("You don't have assignment to this lesson");

    if (accessCourseLessonWithDetails.lessonIsCompleted) return;

    if (!id) {
      throw new NotFoundException(`No lesson id provided`);
    }

    const [lessonProgress] = await dbInstance
      .select()
      .from(studentLessonProgress)
      .where(
        and(eq(studentLessonProgress.lessonId, id), eq(studentLessonProgress.studentId, studentId)),
      );

    if (lessonProgress?.isStarted) return;

    if (!lessonProgress) {
      const [lesson] = await dbInstance.select().from(lessons).where(eq(lessons.id, id));

      await dbInstance.insert(studentLessonProgress).values({
        studentId,
        lessonId: id,
        chapterId: lesson.chapterId,
      });
    }

    if (
      accessCourseLessonWithDetails.lessonType === LESSON_TYPES.QUIZ ||
      accessCourseLessonWithDetails.lessonType === LESSON_TYPES.VIDEO ||
      accessCourseLessonWithDetails.lessonType === LESSON_TYPES.AI_MENTOR
    ) {
      await dbInstance
        .update(studentLessonProgress)
        .set({ isStarted: true })
        .where(
          and(
            eq(studentLessonProgress.lessonId, id),
            eq(studentLessonProgress.studentId, studentId),
          ),
        );
    }
  }

  async updateQuizProgress(
    chapterId: UUIDType,
    lessonId: UUIDType,
    userId: UUIDType,
    completedQuestionCount: number,
    quizScore: number,
    attempts: number,
    isQuizPassed: boolean,
    isCompleted: boolean,
    trx: PostgresJsDatabase<typeof schema> = this.db,
    languageAnswered?: SupportedLanguages | null,
  ) {
    const { language } = await this.localizationService.getBaseLanguage(
      ENTITY_TYPE.LESSON,
      lessonId,
      languageAnswered || undefined,
    );

    const lang = languageAnswered === null ? languageAnswered : language;

    return trx
      .insert(studentLessonProgress)
      .values({
        lessonId,
        chapterId,
        studentId: userId,
        attempts: 1,
        isQuizPassed,
        completedAt: sql`now()`,
        completedQuestionCount,
        quizScore,
        languageAnswered: lang,
      })
      .onConflictDoUpdate({
        target: [
          studentLessonProgress.studentId,
          studentLessonProgress.lessonId,
          studentLessonProgress.chapterId,
        ],
        set: {
          attempts,
          isQuizPassed,
          completedQuestionCount,
          quizScore,
          languageAnswered: lang,
          completedAt: isCompleted ? sql`now()` : null,
        },
      });
  }

  private async updateChapterProgress(
    courseId: UUIDType,
    chapterId: UUIDType,
    studentId: UUIDType,
    lessonCount: number,
    completedAsFreemium = false,
    actor: CurrentUser,
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
      this.eventBus.publish(
        new UserChapterFinishedEvent({ chapterId, courseId, userId: studentId, actor }),
      );

      return dbInstance
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

    return dbInstance
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
    actor: CurrentUser,
    trx?: PostgresJsDatabase<typeof schema>,
    language?: SupportedLanguages,
  ) {
    const courseFinishedChapterCount = await this.getCourseFinishedChapterCount(
      courseId,
      studentId,
      trx,
    );
    const courseProgress = await this.getCourseCompletionStatus(
      courseId,
      studentId,
      courseFinishedChapterCount,
      trx,
    );

    if (courseProgress.courseIsCompleted) {
      await this.updateStudentCourseStats(
        studentId,
        courseId,
        PROGRESS_STATUSES.COMPLETED,
        courseFinishedChapterCount,
        actor,
        trx,
        language,
      );

      const dbInstance = trx ?? this.db;
      const [course] = await dbInstance
        .select({ hasCertificate: courses.hasCertificate })
        .from(courses)
        .where(eq(courses.id, courseId));

      if (course?.hasCertificate)
        return (
          await this.statisticsRepository.updateCompletedAsFreemiumCoursesStats(courseId),
          await this.certificatesService.createCertificate(studentId, courseId, trx)
        );

      return await this.statisticsRepository.updatePaidPurchasedCoursesStats(courseId);
    }

    return await this.updateStudentCourseStats(
      studentId,
      courseId,
      PROGRESS_STATUSES.IN_PROGRESS,
      courseFinishedChapterCount,
      actor,
      trx,
      language,
    );
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
    courseFinishedChapterCount: number,
    dbInstance: PostgresJsDatabase<typeof schema> = this.db,
  ) {
    const [courseCompletedStatus] = await dbInstance
      .select({
        courseIsCompleted: sql<boolean>`${courseFinishedChapterCount} = ${courses.chapterCount}`,
        progress: sql<ProgressStatus>`${studentCourses.progress}`,
      })
      .from(studentCourses)
      .leftJoin(courses, eq(courses.id, studentCourses.courseId))
      .where(and(eq(studentCourses.courseId, courseId), eq(studentCourses.studentId, studentId)));

    return {
      courseIsCompleted: courseCompletedStatus?.courseIsCompleted ?? false,
      progress: courseCompletedStatus?.progress,
    };
  }

  private async updateStudentCourseStats(
    studentId: UUIDType,
    courseId: UUIDType,
    progress: ProgressStatus,
    finishedChapterCount: number,
    actor: CurrentUser,
    dbInstance: PostgresJsDatabase<typeof schema> = this.db,
    language?: SupportedLanguages,
  ) {
    if (progress === PROGRESS_STATUSES.COMPLETED) {
      const [studentCourse] = await dbInstance
        .update(studentCourses)
        .set({
          progress,
          completedAt: sql`NOW()`,
          finishedChapterCount,
          courseCompletionMetadata: setJsonbField(
            studentCourses.courseCompletionMetadata,
            "completed_language",
            language,
          ),
        })
        .where(
          and(
            eq(studentCourses.studentId, studentId),
            eq(studentCourses.courseId, courseId),
            eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED),
          ),
        )
        .returning();

      const courseCompletionDetails = await this.getUserCourseCompletionDetails(
        studentId,
        courseId,
      );

      this.eventBus.publish(new CourseCompletedEvent(courseCompletionDetails));
      this.eventBus.publish(new UserCourseFinishedEvent({ userId: studentId, courseId, actor }));

      return studentCourse;
    }

    return dbInstance
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
        isAssigned: sql<boolean>`CASE WHEN ${studentCourses.status} = ${COURSE_ENROLLMENT.ENROLLED} THEN TRUE ELSE FALSE END`,
        isFreemium: sql<boolean>`CASE WHEN ${chapters.isFreemium} THEN TRUE ELSE FALSE END`,
        attempts: sql<number>`${studentLessonProgress.attempts}`,
        lessonIsCompleted: sql<boolean>`CASE WHEN ${studentLessonProgress.completedAt} IS NOT NULL THEN TRUE ELSE FALSE END`,
        lessonType: lessons.type,
        chapterId: sql<string>`${chapters.id}`,
        courseId: sql<string>`${chapters.courseId}`,
      })
      .from(lessons)
      .leftJoin(users, eq(users.id, userId))
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
      .where(and(eq(lessons.id, id), isNull(users.deletedAt)));
  }

  async getUserCourseCompletionDetails(studentId: UUIDType, courseId: UUIDType) {
    const [courseCompletionDetails] = await this.db
      .select({
        userName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
        courseTitle: this.localizationService.getLocalizedSqlField(courses.title),
        groupName: sql<string>`${groups.name}`,
        completedAt: sql<string>`${studentCourses.completedAt}`,
      })
      .from(studentCourses)
      .leftJoin(users, eq(studentCourses.studentId, users.id))
      .leftJoin(courses, eq(studentCourses.courseId, courses.id))
      .leftJoin(groupUsers, eq(users.id, groupUsers.userId))
      .leftJoin(groups, eq(groupUsers.groupId, groups.id))
      .where(
        and(
          eq(studentCourses.studentId, studentId),
          eq(studentCourses.courseId, courseId),
          eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED),
          isNull(users.deletedAt),
        ),
      );

    return {
      ...courseCompletionDetails,
      courseId,
    };
  }

  private async resolveActor(
    userId: UUIDType,
    actor: CurrentUser | undefined,
    dbInstance: PostgresJsDatabase<typeof schema> = this.db,
  ): Promise<CurrentUser> {
    if (actor) return actor;

    const [user] = await dbInstance
      .select({ userId: users.id, email: users.email, role: users.role })
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return {
      userId: user.userId,
      email: user.email,
      role: user.role as UserRole,
    };
  }

  /**
   * Recalculates chapter and course progress for all enrolled students after a lesson is removed.
   * This ensures that if a student has completed all remaining lessons in a chapter,
   * the chapter (and possibly the course) will be marked as complete.
   */
  async recalculateProgressAfterLessonRemoval(
    chapterId: UUIDType,
    courseId: UUIDType,
    actor: CurrentUser,
  ) {
    // Get the updated lesson count for the chapter
    const [chapterData] = await this.db
      .select({
        lessonCount: chapters.lessonCount,
      })
      .from(chapters)
      .where(eq(chapters.id, chapterId));

    if (!chapterData) {
      return [];
    }

    const lessonCount = chapterData.lessonCount;

    // Get all enrolled students for this course
    const enrolledStudents = await this.db
      .select({
        studentId: studentCourses.studentId,
      })
      .from(studentCourses)
      .where(
        and(
          eq(studentCourses.courseId, courseId),
          eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED),
        ),
      );

    // For each enrolled student, recalculate their chapter progress
    for (const { studentId } of enrolledStudents) {
      // Get the count of completed lessons that still exist in the chapter
      const [completedLessonsData] = await this.db
        .select({ count: sql<number>`count(*)::INTEGER` })
        .from(studentLessonProgress)
        .innerJoin(lessons, eq(lessons.id, studentLessonProgress.lessonId))
        .where(
          and(
            eq(studentLessonProgress.chapterId, chapterId),
            eq(studentLessonProgress.studentId, studentId),
            isNotNull(studentLessonProgress.completedAt),
          ),
        );

      const completedLessonCount = completedLessonsData?.count ?? 0;

      // Update chapter progress
      if (completedLessonCount === lessonCount && lessonCount > 0) {
        // Chapter is now complete - mark it as such
        await this.db
          .insert(studentChapterProgress)
          .values({
            completedLessonCount,
            completedAt: sql`now()`,
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
              completedLessonCount,
              completedAt: sql`now()`,
            },
          });

        // Publish chapter finished event
        this.eventBus.publish(
          new UserChapterFinishedEvent({ chapterId, courseId, userId: studentId, actor }),
        );

        // Check if the course is now complete
        await this.checkCourseIsCompletedForUser(courseId, studentId, actor);
      } else {
        // Update the completed lesson count without marking as complete
        await this.db
          .insert(studentChapterProgress)
          .values({
            completedLessonCount,
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
              completedLessonCount,
            },
          });
      }
    }

    return enrolledStudents.map((s) => s.studentId);
  }

  /**
   * Recalculates chapter and course progress for all enrolled students after a lesson is added.
   * This ensures that if a chapter was previously marked as complete, it becomes incomplete
   * and the finishedChapterCount is decremented.
   * Returns all enrolled students for notification purposes.
   */
  async recalculateProgressAfterLessonAdded(chapterId: UUIDType, courseId: UUIDType) {
    // Get all enrolled students for this course (for notifications)
    const enrolledStudents = await this.db
      .select({
        studentId: studentCourses.studentId,
      })
      .from(studentCourses)
      .where(
        and(
          eq(studentCourses.courseId, courseId),
          eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED),
        ),
      );

    // Find all students who have this chapter marked as completed
    const studentsWithCompletedChapter = await this.db
      .select({
        studentId: studentChapterProgress.studentId,
      })
      .from(studentChapterProgress)
      .innerJoin(
        studentCourses,
        and(
          eq(studentCourses.studentId, studentChapterProgress.studentId),
          eq(studentCourses.courseId, courseId),
          eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED),
        ),
      )
      .where(
        and(
          eq(studentChapterProgress.chapterId, chapterId),
          eq(studentChapterProgress.courseId, courseId),
          isNotNull(studentChapterProgress.completedAt),
        ),
      );

    // For each student with a completed chapter, mark it as incomplete
    for (const { studentId } of studentsWithCompletedChapter) {
      // Clear the completedAt for this chapter
      await this.db
        .update(studentChapterProgress)
        .set({
          completedAt: null,
        })
        .where(
          and(
            eq(studentChapterProgress.chapterId, chapterId),
            eq(studentChapterProgress.studentId, studentId),
            eq(studentChapterProgress.courseId, courseId),
          ),
        );

      // Decrement the finishedChapterCount for the student's course enrollment
      await this.db
        .update(studentCourses)
        .set({
          finishedChapterCount: sql`GREATEST(${studentCourses.finishedChapterCount} - 1, 0)`,
          // If the course was completed, it's no longer complete
          progress: PROGRESS_STATUSES.IN_PROGRESS,
          completedAt: null,
        })
        .where(
          and(
            eq(studentCourses.studentId, studentId),
            eq(studentCourses.courseId, courseId),
            eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED),
          ),
        );
    }

    // Return all enrolled students for notification purposes
    return enrolledStudents.map((s) => s.studentId);
  }
}
