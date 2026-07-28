import { Inject, Injectable } from "@nestjs/common";
import { COURSE_ENROLLMENT } from "@repo/shared";
import { and, asc, eq, getTableColumns, inArray, not, sql } from "drizzle-orm";
import { sum } from "drizzle-orm/sql/functions/aggregate";

import {
  MESSAGE_ROLE,
  type MessageRole,
  THREAD_STATUS,
  type ThreadStatus,
} from "src/ai/utils/ai.type";
import { DatabasePg } from "src/common";
import { LocalizationService } from "src/localization/localization.service";
import { DB } from "src/storage/db/db.providers";
import {
  aiJudgeBlockingErrors,
  aiJudgeConfigurations,
  aiJudgeCriteria,
  aiJudgeScoreGuidance,
  aiMentorJudgementBlockingErrors,
  aiMentorJudgementCriteria,
  aiMentorJudgements,
  aiMentorConfigurations,
  aiMentorLessons,
  aiMentorRoleplayConfigurations,
  aiMentorTeacherConfigurations,
  aiMentorThreadMessages,
  aiMentorThreads,
  chapters,
  courses,
  groups,
  groupUsers,
  lessons,
  studentCourses,
  studentLessonProgress,
  users,
} from "src/storage/schema";

import type { AiMentorTTSPreset, AiMentorVoiceMode, SupportedLanguages } from "@repo/shared";
import type { SQL } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type {
  AiJudgeBlockingErrorJudgementWrite,
  AiJudgeCriterionJudgementWrite,
  AiJudgeJudgementWrite,
  AiJudgeRubricContext,
} from "src/ai/judge-configuration/judge-configuration.types";
import type {
  AiMentorGroupsBody,
  ThreadBody,
  ThreadMessageBody,
  UpdateThreadBody,
} from "src/ai/utils/ai.schema";
import type { UUIDType } from "src/common";
import type * as schema from "src/storage/schema";

@Injectable()
export class AiRepository {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly localizationService: LocalizationService,
  ) {}

  async findAiMentorLessonIdFromLesson(id: UUIDType) {
    const [aiMentorLessonId] = await this.db
      .select({ aiMentorLessonId: aiMentorLessons.id })
      .from(aiMentorLessons)
      .where(eq(aiMentorLessons.lessonId, id));

    return aiMentorLessonId;
  }

  async findAiMentorVoiceConfigByLessonId(lessonId: UUIDType, language: SupportedLanguages) {
    const [voiceConfig] = await this.db
      .select({
        voiceMode: sql<AiMentorVoiceMode>`${aiMentorLessons.voiceMode}`,
        ttsPreset: sql<AiMentorTTSPreset>`${aiMentorLessons.ttsPreset}`,
        customTtsReference: this.localizationService.getFieldByLanguage(
          aiMentorLessons.customTtsReference,
          language,
        ),
      })
      .from(aiMentorLessons)
      .where(eq(aiMentorLessons.lessonId, lessonId));

    return voiceConfig;
  }

  async findThread(conditions: SQL[]) {
    const [thread] = await this.db
      .select({
        ...getTableColumns(aiMentorThreads),
        userLanguage: sql<SupportedLanguages>`${aiMentorThreads.userLanguage}`,
        status: sql<ThreadStatus>`${aiMentorThreads.status}`,
      })
      .from(aiMentorThreads)
      .where(and(...conditions));

    return thread;
  }

  async findLessonIdByThreadId(threadId: UUIDType) {
    const [lessonId] = await this.db
      .select({ lessonId: lessons.id })
      .from(aiMentorThreads)
      .innerJoin(aiMentorLessons, eq(aiMentorThreads.aiMentorLessonId, aiMentorLessons.id))
      .innerJoin(lessons, eq(lessons.id, aiMentorLessons.lessonId))
      .where(eq(aiMentorThreads.id, threadId));

    return lessonId;
  }

  async createThread(data: ThreadBody) {
    const [thread] = await this.db
      .insert(aiMentorThreads)
      .values(data)
      .returning({
        ...getTableColumns(aiMentorThreads),
        userLanguage: sql<SupportedLanguages>`${aiMentorThreads.userLanguage}`,
        status: sql<ThreadStatus>`${aiMentorThreads.status}`,
      });

    return thread;
  }

  async findThreads(conditions: SQL[]) {
    return this.db
      .select({
        ...getTableColumns(aiMentorThreads),
        status: sql<ThreadStatus>`${aiMentorThreads.status}`,
      })
      .from(aiMentorThreads)
      .innerJoin(aiMentorLessons, eq(aiMentorLessons.id, aiMentorThreads.aiMentorLessonId))
      .where(and(...conditions));
  }

  async getTokenSumForThread(threadId: UUIDType, archived: boolean) {
    const [tokens] = await this.db
      .select({
        total: sum(aiMentorThreadMessages.tokenCount),
      })
      .from(aiMentorThreadMessages)
      .where(
        and(
          eq(aiMentorThreadMessages.threadId, threadId),
          eq(aiMentorThreadMessages.archived, archived),
          not(inArray(aiMentorThreadMessages.role, [MESSAGE_ROLE.SYSTEM, MESSAGE_ROLE.SUMMARY])),
        ),
      );

    return tokens.total;
  }

  async findMessageHistory(threadId: UUIDType, archived?: boolean, role?: MessageRole) {
    const messageHistory = await this.db
      .select({
        id: aiMentorThreadMessages.id,
        role: sql<MessageRole>`${aiMentorThreadMessages.role}`,
        userName: sql<string | null>`${users.firstName} || ' ' || ${users.lastName}`,
        content: aiMentorThreadMessages.content,
      })
      .from(aiMentorThreadMessages)
      .leftJoin(aiMentorThreads, eq(aiMentorThreadMessages.threadId, aiMentorThreads.id))
      .leftJoin(users, eq(aiMentorThreads.userId, users.id))
      .where(
        and(
          eq(aiMentorThreadMessages.threadId, threadId),
          eq(
            aiMentorThreadMessages.archived,
            archived ? archived : aiMentorThreadMessages.archived,
          ),
          not(inArray(aiMentorThreadMessages.role, [MESSAGE_ROLE.SYSTEM, MESSAGE_ROLE.SUMMARY])),
          eq(aiMentorThreadMessages.role, role ? role : aiMentorThreadMessages.role),
        ),
      )
      .orderBy(asc(aiMentorThreadMessages.createdAt));

    return messageHistory;
  }

  async findFirstMessageByRoleAndThread(threadId: UUIDType, role: MessageRole) {
    const [exists] = await this.db
      .select()
      .from(aiMentorThreadMessages)
      .where(
        and(eq(aiMentorThreadMessages.role, role), eq(aiMentorThreadMessages.threadId, threadId)),
      )
      .limit(1);

    return exists ? { ...exists, role: exists.role as MessageRole } : undefined;
  }

  async archiveMessages(threadId: UUIDType) {
    const [archived] = await this.db
      .update(aiMentorThreadMessages)
      .set({ archived: true })
      .where(
        and(
          eq(aiMentorThreadMessages.threadId, threadId),
          not(inArray(aiMentorThreadMessages.role, [MESSAGE_ROLE.SYSTEM, MESSAGE_ROLE.SUMMARY])),
        ),
      )
      .returning();

    return archived;
  }

  async updateSummary(threadId: UUIDType, summary: string, tokenCount: number) {
    const [newSummary] = await this.db
      .update(aiMentorThreadMessages)
      .set({ content: summary, tokenCount: tokenCount })
      .where(
        and(
          eq(aiMentorThreadMessages.role, MESSAGE_ROLE.SUMMARY),
          eq(aiMentorThreadMessages.threadId, threadId),
        ),
      )
      .returning();

    return newSummary;
  }

  async insertMessage(data: ThreadMessageBody) {
    return this.db
      .insert(aiMentorThreadMessages)
      .values({ ...data, createdAt: sql`clock_timestamp()` })
      .returning();
  }

  async findMentorLessonByThreadId(threadId: UUIDType, language: SupportedLanguages) {
    const [lesson] = await this.db
      .select({
        title: this.localizationService.getLocalizedSqlField(lessons.title, language),
        type: aiMentorConfigurations.type,
        openingInstruction: this.localizationService.getLocalizedSqlField(
          aiMentorConfigurations.openingInstruction,
          language,
        ),
        additionalInstructions: this.localizationService.getLocalizedSqlField(
          aiMentorConfigurations.additionalInstructions,
          language,
        ),
        taskGoal: this.localizationService.getLocalizedSqlField(
          aiMentorTeacherConfigurations.taskGoal,
          language,
        ),
        expertise: this.localizationService.getLocalizedSqlField(
          aiMentorTeacherConfigurations.expertise,
          language,
        ),
        contentScope: this.localizationService.getLocalizedSqlField(
          aiMentorTeacherConfigurations.contentScope,
          language,
        ),
        teachingStyle: aiMentorTeacherConfigurations.teachingStyle,
        feedbackGuidance: this.localizationService.getLocalizedSqlField(
          aiMentorTeacherConfigurations.feedbackGuidance,
          language,
        ),
        scenario: this.localizationService.getLocalizedSqlField(
          aiMentorRoleplayConfigurations.scenario,
          language,
        ),
        aiRole: this.localizationService.getLocalizedSqlField(
          aiMentorRoleplayConfigurations.aiRole,
          language,
        ),
        learnerRole: this.localizationService.getLocalizedSqlField(
          aiMentorRoleplayConfigurations.learnerRole,
          language,
        ),
        characterGoal: this.localizationService.getLocalizedSqlField(
          aiMentorRoleplayConfigurations.characterGoal,
          language,
        ),
        difficulty: aiMentorRoleplayConfigurations.difficulty,
        factsAndConstraints: this.localizationService.getLocalizedSqlField(
          aiMentorRoleplayConfigurations.factsAndConstraints,
          language,
        ),
        name: this.localizationService.getLocalizedSqlField(aiMentorLessons.name, language),
        learnerFirstName: users.firstName,
      })
      .from(aiMentorThreads)
      .innerJoin(aiMentorLessons, eq(aiMentorThreads.aiMentorLessonId, aiMentorLessons.id))
      .innerJoin(
        aiMentorConfigurations,
        eq(aiMentorConfigurations.aiMentorLessonId, aiMentorLessons.id),
      )
      .leftJoin(
        aiMentorTeacherConfigurations,
        eq(aiMentorTeacherConfigurations.configurationId, aiMentorConfigurations.id),
      )
      .leftJoin(
        aiMentorRoleplayConfigurations,
        eq(aiMentorRoleplayConfigurations.configurationId, aiMentorConfigurations.id),
      )
      .innerJoin(users, eq(users.id, aiMentorThreads.userId))
      .innerJoin(lessons, eq(lessons.id, aiMentorLessons.lessonId))
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .innerJoin(courses, eq(courses.id, chapters.courseId))
      .where(eq(aiMentorThreads.id, threadId));

    return lesson;
  }

  async findJudgeRubricByThreadId(
    threadId: UUIDType,
    language: SupportedLanguages,
  ): Promise<AiJudgeRubricContext | undefined> {
    const localizedTaskGoal = this.localizationService.getLocalizedSqlField(
      aiJudgeConfigurations.taskGoal,
      language,
    );
    const localizedCriterionTitle = this.localizationService.getLocalizedSqlField(
      aiJudgeCriteria.title,
      language,
    );
    const localizedExpectedBehavior = this.localizationService.getLocalizedSqlField(
      aiJudgeCriteria.expectedBehavior,
      language,
    );
    const localizedGuidanceDescription = this.localizationService.getLocalizedSqlField(
      aiJudgeScoreGuidance.description,
      language,
    );
    const localizedGuidanceExample = this.localizationService.getLocalizedSqlField(
      aiJudgeScoreGuidance.example,
      language,
    );
    const localizedBlockingError = this.localizationService.getLocalizedSqlField(
      aiJudgeBlockingErrors.description,
      language,
    );

    const [context] = await this.db
      .select({
        lessonTitle: this.localizationService.getLocalizedSqlField(lessons.title, language),
        rubric: sql<AiJudgeRubricContext["rubric"]>`
          CASE
            WHEN ${aiJudgeConfigurations.id} IS NULL
              OR ${aiJudgeConfigurations.passingThresholdPercent} IS NULL
            THEN NULL
            ELSE jsonb_build_object(
              'configurationId', ${aiJudgeConfigurations.id},
              'taskGoal', ${localizedTaskGoal},
              'passingThresholdPercent', ${aiJudgeConfigurations.passingThresholdPercent},
              'criteria', COALESCE(
                (
                  SELECT jsonb_agg(
                    jsonb_build_object(
                      'id', ${aiJudgeCriteria.id},
                      'title', ${localizedCriterionTitle},
                      'expectedBehavior', ${localizedExpectedBehavior},
                      'maxScore', ${aiJudgeCriteria.maxScore},
                      'scoreGuidance', COALESCE(
                        (
                          SELECT jsonb_agg(
                            jsonb_build_object(
                              'score', ${aiJudgeScoreGuidance.score},
                              'description', ${localizedGuidanceDescription},
                              'example', NULLIF(${localizedGuidanceExample}, '')
                            )
                            ORDER BY ${aiJudgeScoreGuidance.score}, ${aiJudgeScoreGuidance.createdAt}
                          )
                          FROM ${aiJudgeScoreGuidance}
                          WHERE ${aiJudgeScoreGuidance.criterionId} = ${aiJudgeCriteria.id}
                        ),
                        '[]'::jsonb
                      )
                    )
                    ORDER BY ${aiJudgeCriteria.createdAt}
                  )
                  FROM ${aiJudgeCriteria}
                  WHERE ${aiJudgeCriteria.configurationId} = ${aiJudgeConfigurations.id}
                ),
                '[]'::jsonb
              ),
              'blockingErrors', COALESCE(
                (
                  SELECT jsonb_agg(
                    jsonb_build_object(
                      'id', ${aiJudgeBlockingErrors.id},
                      'description', ${localizedBlockingError}
                    )
                    ORDER BY ${aiJudgeBlockingErrors.createdAt}
                  )
                  FROM ${aiJudgeBlockingErrors}
                  WHERE ${aiJudgeBlockingErrors.configurationId} = ${aiJudgeConfigurations.id}
                ),
                '[]'::jsonb
              )
            )
          END
        `,
      })
      .from(aiMentorThreads)
      .innerJoin(aiMentorLessons, eq(aiMentorThreads.aiMentorLessonId, aiMentorLessons.id))
      .innerJoin(lessons, eq(lessons.id, aiMentorLessons.lessonId))
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .innerJoin(courses, eq(courses.id, chapters.courseId))
      .leftJoin(
        aiJudgeConfigurations,
        eq(aiJudgeConfigurations.aiMentorLessonId, aiMentorLessons.id),
      )
      .where(eq(aiMentorThreads.id, threadId));

    return context;
  }

  async upsertJudgeJudgement(data: AiJudgeJudgementWrite, dbInstance: DatabasePg = this.db) {
    const [judgement] = await dbInstance
      .insert(aiMentorJudgements)
      .values(data)
      .onConflictDoUpdate({
        target: aiMentorJudgements.threadId,
        set: {
          configurationId: data.configurationId,
          language: data.language,
          earnedPoints: data.earnedPoints,
          maxScore: data.maxScore,
          percentage: data.percentage,
          passed: data.passed,
          updatedAt: new Date().toISOString(),
        },
      })
      .returning({ id: aiMentorJudgements.id });

    return judgement;
  }

  deleteJudgeCriterionJudgements(judgementId: UUIDType, dbInstance: DatabasePg = this.db) {
    return dbInstance
      .delete(aiMentorJudgementCriteria)
      .where(eq(aiMentorJudgementCriteria.judgementId, judgementId));
  }

  deleteJudgeBlockingErrorJudgements(judgementId: UUIDType, dbInstance: DatabasePg = this.db) {
    return dbInstance
      .delete(aiMentorJudgementBlockingErrors)
      .where(eq(aiMentorJudgementBlockingErrors.judgementId, judgementId));
  }

  insertJudgeCriterionJudgements(
    data: AiJudgeCriterionJudgementWrite[],
    dbInstance: DatabasePg = this.db,
  ) {
    return dbInstance.insert(aiMentorJudgementCriteria).values(data);
  }

  insertJudgeBlockingErrorJudgements(
    data: AiJudgeBlockingErrorJudgementWrite[],
    dbInstance: DatabasePg = this.db,
  ) {
    return dbInstance.insert(aiMentorJudgementBlockingErrors).values(data);
  }

  async findGroupsByThreadId(
    threadId: UUIDType,
    language?: SupportedLanguages,
  ): Promise<AiMentorGroupsBody> {
    return this.db
      .select({
        name: this.localizationService.getLocalizedSqlField(groups.name, language, groups),
        characteristic: this.localizationService.getLocalizedSqlField(
          groups.characteristic,
          language,
          groups,
        ),
      })
      .from(groups)
      .innerJoin(groupUsers, eq(groups.id, groupUsers.groupId))
      .innerJoin(aiMentorThreads, eq(aiMentorThreads.userId, groupUsers.userId))
      .where(eq(aiMentorThreads.id, threadId));
  }

  async updateThread(threadId: UUIDType, data: UpdateThreadBody) {
    const [thread] = await this.db
      .update(aiMentorThreads)
      .set(data)
      .where(eq(aiMentorThreads.id, threadId))
      .returning({
        ...getTableColumns(aiMentorThreads),
        status: sql<ThreadStatus>`${aiMentorThreads.status}`,
      });

    return thread;
  }

  async setThreadsToArchived(
    lessonId: UUIDType,
    userId: UUIDType,
    dbInstance: PostgresJsDatabase<typeof schema> = this.db,
  ) {
    await dbInstance
      .update(aiMentorThreads)
      .set({ status: THREAD_STATUS.ARCHIVED })
      .where(
        inArray(
          aiMentorThreads.aiMentorLessonId,
          this.db
            .select({ id: aiMentorLessons.id })
            .from(aiMentorLessons)
            .innerJoin(lessons, eq(aiMentorLessons.lessonId, lessons.id))
            .where(and(eq(aiMentorLessons.lessonId, lessonId), eq(aiMentorThreads.userId, userId))),
        ),
      );
  }

  async resetStudentProgressForLesson(
    lessonId: UUIDType,
    userId: UUIDType,
    dbInstance: PostgresJsDatabase<typeof schema> = this.db,
  ) {
    await dbInstance
      .delete(studentLessonProgress)
      .where(
        and(
          eq(studentLessonProgress.lessonId, lessonId),
          eq(studentLessonProgress.studentId, userId),
        ),
      );
  }

  async checkLessonAssignment(id: UUIDType, userId: UUIDType) {
    return this.db
      .select({
        isAssigned: sql<boolean>`CASE WHEN ${studentCourses.status} = ${COURSE_ENROLLMENT.ENROLLED} THEN TRUE ELSE FALSE END`,
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

  async getCourseAuthorByLesson(lessonId: string) {
    const [{ author }] = await this.db
      .select({ author: courses.authorId })
      .from(lessons)
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .innerJoin(courses, eq(chapters.courseId, courses.id))
      .where(eq(lessons.id, lessonId));

    return author;
  }
}
