import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { COURSE_ENROLLMENT, PERMISSIONS } from "@repo/shared";
import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";

import { CertificatesService } from "src/certificates/certificates.service";
import { DatabasePg } from "src/common";
import { setJsonbField } from "src/common/helpers/sqlHelpers";
import { CourseCompletedEvent, LessonCompletedEvent } from "src/events";
import { UserAiMentorLessonPassedEvent } from "src/events/user/user-ai-mentor-lesson-passed.event";
import { UserChapterFinishedEvent } from "src/events/user/user-chapter-finished.event";
import { UserCourseFinishedEvent } from "src/events/user/user-course-finished.event";
import { LESSON_TYPES } from "src/lesson/lesson.type";
import { LocalizationService } from "src/localization/localization.service";
import { ENTITY_TYPE } from "src/localization/localization.types";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { StatisticsRepository } from "src/statistics/repositories/statistics.repository";
import {
  aiMentorStudentLessonProgress,
  chapters,
  courseStudentMode,
  courses,
  groups,
  groupUsers,
  lessons,
  permissionRoles,
  permissionRoleRuleSets,
  permissionRuleSetPermissions,
  permissionUserRoles,
  studentChapterProgress,
  studentCourses,
  studentLessonProgress,
  users,
} from "src/storage/schema";
import { PROGRESS_STATUSES } from "src/utils/types/progress.type";

import {
  resolveStoredAiMentorPassed,
  shouldEmitAiMentorLessonPassedEvent,
} from "./ai-mentor-pass-event.utils";

import type { PermissionKey, SupportedLanguages } from "@repo/shared";
import type { ResponseAiJudgeJudgementBody } from "src/ai/utils/ai.schema";
import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { ProgressStatus } from "src/utils/types/progress.type";

@Injectable()
export class StudentLessonProgressService {
  constructor(
    @Inject("DB") private readonly db: DatabasePg,
    private readonly statisticsRepository: StatisticsRepository,
    private readonly certificatesService: CertificatesService,
    private readonly outboxPublisher: OutboxPublisher,
    private readonly localizationService: LocalizationService,
  ) {}

  async markLessonAsCompleted({
    id,
    studentId,
    userPermissions = [],
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
    userPermissions?: PermissionKey[];
    actor?: CurrentUserType;
    quizCompleted?: boolean;
    completedQuestionCount?: number;
    dbInstance?: DatabasePg;
    aiMentorLessonData?: ResponseAiJudgeJudgementBody;
    language: SupportedLanguages;
    isQuizPassed?: boolean;
  }) {
    const [accessCourseLessonWithDetails] = await this.checkLessonAssignment(id, studentId);

    const isLearningModeActive = await this.resolveLearningModeStatusByPermissions(
      id,
      studentId,
      userPermissions,
      dbInstance,
    );

    const canTrackProgress = this.canUseLearnerProgressByPermissions(userPermissions, {
      hasEnrollment: Boolean(accessCourseLessonWithDetails.isAssigned),
      isLearningModeActive,
    });

    if (!canTrackProgress) return;

    if (isLearningModeActive && !accessCourseLessonWithDetails.isAssigned) {
      await this.ensureStudentCourseEnrollment(
        accessCourseLessonWithDetails.courseId,
        studentId,
        dbInstance,
      );

      accessCourseLessonWithDetails.isAssigned = true;
    }

    if (!accessCourseLessonWithDetails.isAssigned && !accessCourseLessonWithDetails.isFreemium)
      throw new UnauthorizedException("You don't have assignment to this lesson");

    const alreadyCompleted = accessCourseLessonWithDetails.lessonIsCompleted;

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

    if (!alreadyCompleted && lesson.type === LESSON_TYPES.QUIZ && !quizCompleted) {
      throw new BadRequestException("Quiz not completed");
    }

    if (!alreadyCompleted && lesson.type === LESSON_TYPES.AI_MENTOR && !aiMentorLessonData)
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
    let aiMentorLessonPassed = false;

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

      const previousPassed = existingAiMentorLesson?.passed;
      const aiMentorProgressData = {
        ...aiMentorLessonData,
        passed: resolveStoredAiMentorPassed(previousPassed, aiMentorLessonData.passed),
      };

      aiMentorLessonPassed = shouldEmitAiMentorLessonPassedEvent(
        previousPassed,
        aiMentorLessonData.passed,
      );

      if (!existingAiMentorLesson) {
        await dbInstance.insert(aiMentorStudentLessonProgress).values({
          ...aiMentorProgressData,
          studentLessonProgressId: currentLessonProgress.id,
        });
      } else {
        await dbInstance
          .update(aiMentorStudentLessonProgress)
          .set(aiMentorProgressData)
          .where(
            eq(aiMentorStudentLessonProgress.studentLessonProgressId, currentLessonProgress.id),
          );
      }
    }

    const isCompletedAsFreemium =
      !accessCourseLessonWithDetails.isAssigned && accessCourseLessonWithDetails.isFreemium;

    const resolvedActor = await this.resolveActor(studentId, actor, dbInstance);

    if (aiMentorLessonPassed) {
      await this.outboxPublisher.publish(
        new UserAiMentorLessonPassedEvent({
          userId: studentId,
          lessonId: lesson.id,
          actor: resolvedActor,
        }),
        dbInstance,
      );
    }

    if (lessonCompleted || isQuizPassed) {
      await this.outboxPublisher.publish(
        new LessonCompletedEvent({
          userId: studentId,
          courseId: lesson.courseId,
          lessonId: lesson.id,
          actor: resolvedActor,
        }),
        dbInstance,
      );
    }

    if (lessonCompleted || isQuizPassed || alreadyCompleted) {
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
    userPermissions: PermissionKey[] = [],
    dbInstance: DatabasePg = this.db,
  ) {
    const [accessCourseLessonWithDetails] = await this.checkLessonAssignment(id, studentId);

    const isLearningModeActive = await this.resolveLearningModeStatusByPermissions(
      id,
      studentId,
      userPermissions,
      dbInstance,
    );

    const canTrackProgress = this.canUseLearnerProgressByPermissions(userPermissions, {
      hasEnrollment: !!accessCourseLessonWithDetails.isAssigned,
      isLearningModeActive,
    });

    if (!canTrackProgress) return;

    if (isLearningModeActive && !accessCourseLessonWithDetails.isAssigned) {
      await this.ensureStudentCourseEnrollment(
        accessCourseLessonWithDetails.courseId,
        studentId,
        dbInstance,
      );

      accessCourseLessonWithDetails.isAssigned = true;
    }

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
      accessCourseLessonWithDetails.lessonType === LESSON_TYPES.CONTENT ||
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

  async recalculateProgressAfterLessonDeletion(
    courseId: UUIDType,
    chapterId: UUIDType,
    actor: ActorUserType,
    dbInstance: DatabasePg = this.db,
  ) {
    const [chapter] = await dbInstance
      .select({ lessonCount: chapters.lessonCount })
      .from(chapters)
      .where(and(eq(chapters.id, chapterId), eq(chapters.courseId, courseId)))
      .limit(1);

    if (!chapter) return;

    const studentsToRecalculate = await dbInstance
      .selectDistinct({ studentId: studentCourses.studentId })
      .from(studentCourses)
      .leftJoin(
        studentChapterProgress,
        and(
          eq(studentChapterProgress.studentId, studentCourses.studentId),
          eq(studentChapterProgress.courseId, studentCourses.courseId),
          eq(studentChapterProgress.chapterId, chapterId),
        ),
      )
      .leftJoin(
        studentLessonProgress,
        and(
          eq(studentLessonProgress.studentId, studentCourses.studentId),
          eq(studentLessonProgress.chapterId, chapterId),
        ),
      )
      .where(
        and(
          eq(studentCourses.courseId, courseId),
          eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED),
          sql<boolean>`${studentChapterProgress.id} IS NOT NULL OR ${studentLessonProgress.id} IS NOT NULL`,
        ),
      );

    for (const { studentId } of studentsToRecalculate) {
      await this.updateChapterProgress(
        courseId,
        chapterId,
        studentId,
        chapter.lessonCount,
        false,
        actor,
        dbInstance,
      );

      await this.checkCourseIsCompletedForUser(courseId, studentId, actor, dbInstance);
    }
  }

  private async resolveLearningModeStatusByPermissions(
    lessonId: UUIDType,
    userId: UUIDType,
    userPermissions: PermissionKey[],
    dbInstance: DatabasePg = this.db,
  ) {
    if (!userPermissions.includes(PERMISSIONS.LEARNING_MODE_USE)) return false;

    return this.isLessonStudentModeEnabled(lessonId, userId, dbInstance);
  }

  private canUseLearnerProgressByPermissions(
    userPermissions: PermissionKey[],
    access: { hasEnrollment: boolean; isLearningModeActive: boolean },
  ) {
    const canUseLearningMode = userPermissions.includes(PERMISSIONS.LEARNING_MODE_USE);
    if (canUseLearningMode) return access.isLearningModeActive;

    return true;
  }

  private async isLessonStudentModeEnabled(
    lessonId: UUIDType,
    userId: UUIDType,
    dbInstance: DatabasePg = this.db,
  ) {
    const [studentModeExists] = await dbInstance
      .select({ id: courseStudentMode.id })
      .from(courseStudentMode)
      .innerJoin(chapters, eq(chapters.courseId, courseStudentMode.courseId))
      .innerJoin(lessons, eq(lessons.chapterId, chapters.id))
      .where(and(eq(courseStudentMode.userId, userId), eq(lessons.id, lessonId)));

    return Boolean(studentModeExists);
  }

  private async ensureStudentCourseEnrollment(
    courseId: UUIDType,
    studentId: UUIDType,
    dbInstance: DatabasePg = this.db,
  ) {
    await dbInstance
      .insert(studentCourses)
      .values({
        studentId,
        courseId,
        enrolledAt: sql`NOW()`,
        status: COURSE_ENROLLMENT.ENROLLED,
      })
      .onConflictDoUpdate({
        target: [studentCourses.studentId, studentCourses.courseId],
        set: {
          enrolledAt: sql`EXCLUDED.enrolled_at`,
          status: sql`EXCLUDED.status`,
        },
      });
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
    trx: DatabasePg = this.db,
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
    actor: ActorUserType,
    trx?: DatabasePg,
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
      await this.outboxPublisher.publish(
        new UserChapterFinishedEvent({ chapterId, courseId, userId: studentId, actor }),
        dbInstance,
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
    actor: ActorUserType,
    trx?: DatabasePg,
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
    dbInstance: DatabasePg = this.db,
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
    dbInstance: DatabasePg = this.db,
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
    actor: ActorUserType,
    dbInstance: DatabasePg = this.db,
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

      await this.outboxPublisher.publish(
        new CourseCompletedEvent(courseCompletionDetails),
        dbInstance,
      );
      await this.outboxPublisher.publish(
        new UserCourseFinishedEvent({ userId: studentId, courseId, actor }),
        dbInstance,
      );

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
    dbInstance: DatabasePg = this.db,
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
    actor: CurrentUserType | undefined,
    dbInstance: DatabasePg = this.db,
  ): Promise<ActorUserType> {
    if (actor) return actor;

    const [user] = await dbInstance
      .select({ userId: users.id, email: users.email, tenantId: users.tenantId })
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      throw new NotFoundException("User not found");
    }

    const userAccessRows = await dbInstance
      .select({
        roleSlug: permissionRoles.slug,
        permission: permissionRuleSetPermissions.permission,
      })
      .from(permissionUserRoles)
      .innerJoin(
        permissionRoles,
        and(
          eq(permissionRoles.id, permissionUserRoles.roleId),
          eq(permissionRoles.tenantId, permissionUserRoles.tenantId),
        ),
      )
      .leftJoin(
        permissionRoleRuleSets,
        and(
          eq(permissionRoleRuleSets.roleId, permissionRoles.id),
          eq(permissionRoleRuleSets.tenantId, permissionRoles.tenantId),
        ),
      )
      .leftJoin(
        permissionRuleSetPermissions,
        and(
          eq(permissionRuleSetPermissions.ruleSetId, permissionRoleRuleSets.ruleSetId),
          eq(permissionRuleSetPermissions.tenantId, permissionRoleRuleSets.tenantId),
        ),
      )
      .where(
        and(
          eq(permissionUserRoles.userId, userId),
          eq(permissionUserRoles.tenantId, user.tenantId),
        ),
      );

    const roleSlugs = Array.from(new Set(userAccessRows.map(({ roleSlug }) => roleSlug)));

    const permissions = Array.from(
      new Set(
        userAccessRows
          .map(({ permission }) => permission)
          .filter((permission): permission is PermissionKey => Boolean(permission)),
      ),
    );

    return {
      userId: user.userId,
      email: user.email,
      roleSlugs,
      permissions,
      tenantId: user.tenantId,
    };
  }
}
