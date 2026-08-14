import { Inject, Injectable } from "@nestjs/common";
import { AI_MENTOR_ROLEPLAY_DIFFICULTY, AI_MENTOR_TYPE, COURSE_ENROLLMENT } from "@repo/shared";
import { and, asc, eq, getTableColumns, inArray, not, or, sql } from "drizzle-orm";
import { sum } from "drizzle-orm/sql/functions/aggregate";

import {
  AI_MENTOR_PRACTICE_STATUSES,
  type AiPracticeJudgeConfigurationGraph,
} from "src/ai/ai-practice.types";
import {
  buildAiJudgeBlockingErrorEvaluationsSql,
  buildAiJudgeCriterionEvaluationsSql,
} from "src/ai/utils/ai-judge-evaluation.sql";
import { getLocalizedJsonbValueSql } from "src/ai/utils/ai-judge-jsonb.sql";
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
  aiMentorPracticeSessions,
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

import type {
  AiMentorRoleplayDifficulty,
  AiMentorTTSPreset,
  AiMentorType,
  AiMentorVoiceMode,
  SupportedLanguages,
} from "@repo/shared";
import type { SQL } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type {
  AiJudgeBlockingErrorJudgementWrite,
  AiJudgeCriterionJudgementWrite,
  AiJudgeJudgementWrite,
  AiJudgePublicResult,
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
      .leftJoin(aiMentorLessons, eq(aiMentorThreads.aiMentorLessonId, aiMentorLessons.id))
      .leftJoin(lessons, eq(lessons.id, aiMentorLessons.lessonId))
      .where(eq(aiMentorThreads.id, threadId));

    return lessonId ?? { lessonId: null };
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
        title: sql<string>`COALESCE(
          ${this.localizationService.getLocalizedSqlField(lessons.title, language)},
          ${aiMentorPracticeSessions.title}
        )`,
        type: sql<AiMentorType>`COALESCE(
          ${aiMentorConfigurations.type},
          ${AI_MENTOR_TYPE.ROLEPLAY}
        )`,
        openingInstruction: this.localizationService.getLocalizedSqlField(
          aiMentorConfigurations.openingInstruction,
          language,
        ),
        additionalInstructions: sql<string>`COALESCE(
          ${this.localizationService.getLocalizedSqlField(
            aiMentorConfigurations.additionalInstructions,
            language,
          )},
          ${aiMentorPracticeSessions.instructions},
          ''
        )`,
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
        scenario: sql<string>`COALESCE(
          ${this.localizationService.getLocalizedSqlField(
            aiMentorRoleplayConfigurations.scenario,
            language,
          )},
          ${aiMentorPracticeSessions.instructions}
        )`,
        aiRole: sql<string>`COALESCE(
          ${this.localizationService.getLocalizedSqlField(
            aiMentorRoleplayConfigurations.aiRole,
            language,
          )},
          ${aiMentorPracticeSessions.aiMentorName},
          'AI Mentor'
        )`,
        learnerRole: sql<string>`COALESCE(
          ${this.localizationService.getLocalizedSqlField(
            aiMentorRoleplayConfigurations.learnerRole,
            language,
          )},
          'Learner'
        )`,
        characterGoal: sql<string>`COALESCE(
          ${this.localizationService.getLocalizedSqlField(
            aiMentorRoleplayConfigurations.characterGoal,
            language,
          )},
          ${aiMentorPracticeSessions.instructions}
        )`,
        difficulty: sql<AiMentorRoleplayDifficulty>`COALESCE(
          ${aiMentorRoleplayConfigurations.difficulty},
          ${AI_MENTOR_ROLEPLAY_DIFFICULTY.REALISTIC}
        )`,
        factsAndConstraints: this.localizationService.getLocalizedSqlField(
          aiMentorRoleplayConfigurations.factsAndConstraints,
          language,
        ),
        name: sql<string>`COALESCE(
          ${this.localizationService.getLocalizedSqlField(aiMentorLessons.name, language)},
          ${aiMentorPracticeSessions.aiMentorName},
          'AI Mentor'
        )`,
        learnerFirstName: users.firstName,
      })
      .from(aiMentorThreads)
      .leftJoin(aiMentorLessons, eq(aiMentorThreads.aiMentorLessonId, aiMentorLessons.id))
      .leftJoin(
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
      .leftJoin(lessons, eq(lessons.id, aiMentorLessons.lessonId))
      .leftJoin(chapters, eq(chapters.id, lessons.chapterId))
      .leftJoin(courses, eq(courses.id, chapters.courseId))
      .leftJoin(
        aiMentorPracticeSessions,
        eq(aiMentorThreads.practiceSessionId, aiMentorPracticeSessions.id),
      )
      .where(eq(aiMentorThreads.id, threadId));

    return lesson;
  }

  async findPracticeSessionByDate(userId: UUIDType, practiceDate: string) {
    const session = await this.getPracticeSessionQuery(
      and(
        eq(aiMentorPracticeSessions.userId, userId),
        eq(aiMentorPracticeSessions.practiceDate, practiceDate),
      ),
    );

    return session[0];
  }

  async findPracticeSessionById(sessionId: UUIDType) {
    const session = await this.getPracticeSessionQuery(eq(aiMentorPracticeSessions.id, sessionId));

    return session[0];
  }

  private getPracticeSessionQuery(condition: SQL | undefined) {
    return this.db
      .select(this.getPracticeSessionSelection())
      .from(aiMentorPracticeSessions)
      .leftJoin(aiMentorThreads, eq(aiMentorThreads.practiceSessionId, aiMentorPracticeSessions.id))
      .leftJoin(
        aiJudgeConfigurations,
        eq(aiJudgeConfigurations.practiceSessionId, aiMentorPracticeSessions.id),
      )
      .leftJoin(aiMentorJudgements, eq(aiMentorJudgements.threadId, aiMentorThreads.id))
      .where(condition);
  }

  private getPracticeSessionSelection() {
    const practiceCriterionTitle = sql<string>`COALESCE(
      NULLIF(${aiMentorJudgementCriteria.criterionTitle}, ''),
      ${getLocalizedJsonbValueSql(aiJudgeCriteria.title, aiMentorPracticeSessions.language)},
      ''
    )`;

    return {
      ...getTableColumns(aiMentorPracticeSessions),
      threadId: aiMentorThreads.id,
      threadStatus: sql<ThreadStatus | null>`${aiMentorThreads.status}`,
      taskGoal: sql<string | null>`
        ${getLocalizedJsonbValueSql(
          aiJudgeConfigurations.taskGoal,
          aiMentorPracticeSessions.language,
        )}
      `,
      evaluation: sql<AiJudgePublicResult | null>`
        CASE
          WHEN ${aiMentorJudgements.id} IS NULL THEN NULL
          ELSE jsonb_build_object(
            'minScore', CEIL(
              ${aiMentorJudgements.maxScore}
              * ${aiJudgeConfigurations.passingThresholdPercent}
              / 100.0
            )::integer,
            'maxScore', ${aiMentorJudgements.maxScore},
            'score', ${aiMentorJudgements.earnedPoints},
            'percentage', ${aiMentorJudgements.percentage},
            'passed', ${aiMentorJudgements.passed},
            'criteria', ${buildAiJudgeCriterionEvaluationsSql(
              aiMentorJudgements.id,
              practiceCriterionTitle,
              sql`COALESCE(${aiMentorJudgementCriteria.learnerSafeFeedback}, '')`,
            )},
            'blockingErrors', ${buildAiJudgeBlockingErrorEvaluationsSql(aiMentorJudgements.id)}
          )
        END
      `,
    };
  }

  async createPracticeSession(
    data: typeof aiMentorPracticeSessions.$inferInsert,
    dbInstance: DatabasePg = this.db,
  ) {
    const [session] = await dbInstance
      .insert(aiMentorPracticeSessions)
      .values(data)
      .onConflictDoNothing({
        target: [
          aiMentorPracticeSessions.tenantId,
          aiMentorPracticeSessions.userId,
          aiMentorPracticeSessions.practiceDate,
        ],
      })
      .returning();

    return session;
  }

  async updatePracticeSession(
    sessionId: UUIDType,
    data: Partial<typeof aiMentorPracticeSessions.$inferInsert>,
    dbInstance: DatabasePg = this.db,
  ) {
    const [session] = await dbInstance
      .update(aiMentorPracticeSessions)
      .set(data)
      .where(eq(aiMentorPracticeSessions.id, sessionId))
      .returning();

    return session;
  }

  async claimPracticeSessionForGeneration(sessionId: UUIDType) {
    const [session] = await this.db
      .update(aiMentorPracticeSessions)
      .set({ status: AI_MENTOR_PRACTICE_STATUSES.PROCESSING, errorCode: null })
      .where(
        and(
          eq(aiMentorPracticeSessions.id, sessionId),
          eq(aiMentorPracticeSessions.status, AI_MENTOR_PRACTICE_STATUSES.QUEUED),
        ),
      )
      .returning();

    return session;
  }

  async queuePracticeSessionRetry(sessionId: UUIDType, dbInstance: DatabasePg = this.db) {
    const [session] = await dbInstance
      .update(aiMentorPracticeSessions)
      .set({ status: AI_MENTOR_PRACTICE_STATUSES.QUEUED, errorCode: null })
      .where(
        and(
          eq(aiMentorPracticeSessions.id, sessionId),
          eq(aiMentorPracticeSessions.status, AI_MENTOR_PRACTICE_STATUSES.FAILED),
        ),
      )
      .returning();

    return session;
  }

  async insertPracticeJudgeConfigurationGraph(
    graph: AiPracticeJudgeConfigurationGraph,
    dbInstance: DatabasePg = this.db,
  ): Promise<UUIDType> {
    const [configuration] = await dbInstance
      .insert(aiJudgeConfigurations)
      .values(graph.configuration)
      .onConflictDoNothing({ target: aiJudgeConfigurations.practiceSessionId })
      .returning({ id: aiJudgeConfigurations.id });

    if (!configuration) {
      const [existingConfiguration] = await dbInstance
        .select({ id: aiJudgeConfigurations.id })
        .from(aiJudgeConfigurations)
        .where(eq(aiJudgeConfigurations.practiceSessionId, graph.configuration.practiceSessionId));

      if (!existingConfiguration)
        throw new Error("Practice AI Judge configuration was not created");

      return existingConfiguration.id;
    }

    if (graph.criteria.length) await dbInstance.insert(aiJudgeCriteria).values(graph.criteria);
    if (graph.scoreGuidance.length)
      await dbInstance.insert(aiJudgeScoreGuidance).values(graph.scoreGuidance);
    if (graph.blockingErrors.length)
      await dbInstance.insert(aiJudgeBlockingErrors).values(graph.blockingErrors);

    return configuration.id;
  }

  async saveGeneratedPractice(
    sessionId: UUIDType,
    title: string,
    aiMentorName: string,
    instructions: string,
    graph: AiPracticeJudgeConfigurationGraph,
  ) {
    return this.db.transaction(async (trx) => {
      await this.updatePracticeSession(sessionId, { title, aiMentorName, instructions }, trx);
      await this.insertPracticeJudgeConfigurationGraph(graph, trx);
    });
  }

  async resetPracticeConversation(sessionId: UUIDType) {
    return this.db.transaction(async (trx) => {
      await trx.delete(aiMentorThreads).where(eq(aiMentorThreads.practiceSessionId, sessionId));
      const [session] = await trx
        .update(aiMentorPracticeSessions)
        .set({ status: AI_MENTOR_PRACTICE_STATUSES.READY, errorCode: null })
        .where(eq(aiMentorPracticeSessions.id, sessionId))
        .returning();

      return session;
    });
  }

  async findJudgeRubricByThreadId(
    threadId: UUIDType,
    language: SupportedLanguages,
  ): Promise<AiJudgeRubricContext | undefined> {
    const languageSql = sql`${language}`;
    const taskGoal = getLocalizedJsonbValueSql(
      aiJudgeConfigurations.taskGoal,
      languageSql,
      this.localizationService.getLocalizedSqlField(aiJudgeConfigurations.taskGoal, language),
    );
    const criterionTitle = getLocalizedJsonbValueSql(
      aiJudgeCriteria.title,
      languageSql,
      this.localizationService.getLocalizedSqlField(aiJudgeCriteria.title, language),
    );
    const expectedBehavior = getLocalizedJsonbValueSql(
      aiJudgeCriteria.expectedBehavior,
      languageSql,
      this.localizationService.getLocalizedSqlField(aiJudgeCriteria.expectedBehavior, language),
    );
    const guidanceDescription = getLocalizedJsonbValueSql(
      aiJudgeScoreGuidance.description,
      languageSql,
      this.localizationService.getLocalizedSqlField(aiJudgeScoreGuidance.description, language),
    );
    const guidanceExample = getLocalizedJsonbValueSql(
      aiJudgeScoreGuidance.example,
      languageSql,
      this.localizationService.getLocalizedSqlField(aiJudgeScoreGuidance.example, language),
    );
    const blockingError = getLocalizedJsonbValueSql(
      aiJudgeBlockingErrors.description,
      languageSql,
      this.localizationService.getLocalizedSqlField(aiJudgeBlockingErrors.description, language),
    );

    const [context] = await this.db
      .select({
        lessonTitle: sql<string>`COALESCE(
          ${this.localizationService.getLocalizedSqlField(lessons.title, language)},
          ${aiMentorPracticeSessions.title},
          'AI Mentor practice'
        )`,
        rubric: sql<AiJudgeRubricContext["rubric"]>`
          CASE
            WHEN ${aiJudgeConfigurations.id} IS NULL
              OR ${aiJudgeConfigurations.passingThresholdPercent} IS NULL
            THEN NULL
            ELSE jsonb_build_object(
              'configurationId', ${aiJudgeConfigurations.id},
              'taskGoal', ${taskGoal},
              'passingThresholdPercent', ${aiJudgeConfigurations.passingThresholdPercent},
              'criteria', COALESCE(
                (
                  SELECT jsonb_agg(
                    jsonb_build_object(
                      'id', ${aiJudgeCriteria.id},
                      'title', ${criterionTitle},
                      'expectedBehavior', ${expectedBehavior},
                      'maxScore', ${aiJudgeCriteria.maxScore},
                      'scoreGuidance', COALESCE(
                        (
                          SELECT jsonb_agg(
                            jsonb_build_object(
                              'score', ${aiJudgeScoreGuidance.score},
                              'description', ${guidanceDescription},
                              'example', NULLIF(${guidanceExample}, '')
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
                      'description', ${blockingError}
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
      .leftJoin(aiMentorLessons, eq(aiMentorThreads.aiMentorLessonId, aiMentorLessons.id))
      .leftJoin(lessons, eq(lessons.id, aiMentorLessons.lessonId))
      .leftJoin(chapters, eq(chapters.id, lessons.chapterId))
      .leftJoin(courses, eq(courses.id, chapters.courseId))
      .leftJoin(
        aiMentorPracticeSessions,
        eq(aiMentorThreads.practiceSessionId, aiMentorPracticeSessions.id),
      )
      .leftJoin(
        aiJudgeConfigurations,
        or(
          eq(aiJudgeConfigurations.aiMentorLessonId, aiMentorLessons.id),
          eq(aiJudgeConfigurations.practiceSessionId, aiMentorPracticeSessions.id),
        ),
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
