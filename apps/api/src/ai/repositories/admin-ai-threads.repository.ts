import { Inject, Injectable } from "@nestjs/common";
import {
  AI_THREAD_TYPES,
  AI_THREAD_STATUSES,
  ASSISTANT_MESSAGE_ROLES,
  MESSAGE_ROLE,
} from "@repo/shared";
import { and, asc, count, desc, eq, gte, inArray, lt, max, sql } from "drizzle-orm";
import { unionAll } from "drizzle-orm/pg-core";

import { DatabasePg } from "src/common";
import { parsePagination } from "src/common/pagination";
import { LocalizationService } from "src/localization/localization.service";
import { DB } from "src/storage/db/db.providers";
import {
  aiMentorJudgementBlockingErrors,
  aiMentorJudgementCriteria,
  aiMentorJudgements,
  aiMentorLessons,
  aiMentorPracticeSessions,
  aiMentorThreadMessages,
  aiMentorThreads,
  assistantThreads,
  assistantMessages,
  chapters,
  courses,
  lessons,
  users,
} from "src/storage/schema";

import type {
  AdminAiThreadQuery,
  AdminAiThreadSummary,
  AdminAiThreadMessage,
} from "src/ai/admin-ai-threads.schema";
import type { UUIDType } from "src/common";

@Injectable()
export class AdminAiThreadsRepository {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly localizationService: LocalizationService,
  ) {}

  private buildMentorThreadSummariesQuery(adminAiThreadQuery: AdminAiThreadQuery) {
    const lessonTitle = this.localizationService.getLocalizedSqlField(
      lessons.title,
      adminAiThreadQuery.language,
    );
    const courseTitle = this.localizationService.getLocalizedSqlField(
      courses.title,
      adminAiThreadQuery.language,
    );
    const visibleThreadMessageFilter = and(
      eq(aiMentorThreadMessages.threadId, aiMentorThreads.id),
      inArray(aiMentorThreadMessages.role, [MESSAGE_ROLE.USER, MESSAGE_ROLE.MENTOR]),
    );
    const openingMessageQuery = this.db
      .select({ preview: sql<string>`LEFT(${aiMentorThreadMessages.content}, 160)` })
      .from(aiMentorThreadMessages)
      .where(visibleThreadMessageFilter)
      .orderBy(asc(aiMentorThreadMessages.createdAt), asc(aiMentorThreadMessages.id))
      .limit(1);
    const lastMessageActivityQuery = this.db
      .select({ createdAt: max(aiMentorThreadMessages.createdAt) })
      .from(aiMentorThreadMessages)
      .where(visibleThreadMessageFilter);
    const openingPreview = sql<string | null>`(${openingMessageQuery})`;
    return this.db
      .select({
        id: aiMentorThreads.id,
        type: sql<
          AdminAiThreadSummary["type"]
        >`CASE WHEN ${aiMentorThreads.practiceSessionId} IS NOT NULL THEN ${AI_THREAD_TYPES.PRACTICE} ELSE ${AI_THREAD_TYPES.AI_MENTOR} END`.as(
          "source_type",
        ),
        practiceSessionId: aiMentorThreads.practiceSessionId,
        aiMentorLessonId: aiMentorThreads.aiMentorLessonId,
        lessonId: aiMentorLessons.lessonId,
        courseId: chapters.courseId,
        courseTitle: sql<
          string | null
        >`CASE WHEN ${courses.id} IS NOT NULL THEN ${courseTitle} ELSE NULL END`.as("course_title"),
        title:
          sql<string>`COALESCE(NULLIF(${aiMentorPracticeSessions.title}, ''), NULLIF(${lessonTitle}, ''), ${openingPreview}, '')`.as(
            "resolved_title",
          ),
        openingPreview: openingPreview.as("opening_preview"),
        owner: {
          id: sql<string>`${users.id}`.as("owner_id"),
          firstName: users.firstName,
          lastName: users.lastName,
          avatarReference: users.avatarReference,
        },
        status: sql<AdminAiThreadSummary["status"]>`${aiMentorThreads.status}`.as("thread_status"),
        language: aiMentorThreads.userLanguage,
        createdAt: aiMentorThreads.createdAt,
        lastActivityAt:
          sql<string>`COALESCE((${lastMessageActivityQuery}), ${aiMentorThreads.createdAt})`.as(
            "last_activity_at",
          ),
      })
      .from(aiMentorThreads)
      .innerJoin(users, eq(users.id, aiMentorThreads.userId))
      .leftJoin(
        aiMentorPracticeSessions,
        eq(aiMentorPracticeSessions.id, aiMentorThreads.practiceSessionId),
      )
      .leftJoin(aiMentorLessons, eq(aiMentorLessons.id, aiMentorThreads.aiMentorLessonId))
      .leftJoin(lessons, eq(lessons.id, aiMentorLessons.lessonId))
      .leftJoin(chapters, eq(chapters.id, lessons.chapterId))
      .leftJoin(courses, eq(courses.id, chapters.courseId));
  }

  private buildAssistantThreadSummariesQuery() {
    const visibleMessageFilter = and(
      eq(assistantMessages.threadId, assistantThreads.id),
      inArray(assistantMessages.role, Object.values(ASSISTANT_MESSAGE_ROLES)),
    );
    const openingMessageQuery = this.db
      .select({ preview: sql<string>`LEFT(${assistantMessages.text}, 160)` })
      .from(assistantMessages)
      .where(visibleMessageFilter)
      .orderBy(asc(assistantMessages.createdAt), asc(assistantMessages.id))
      .limit(1);
    const lastMessageActivityQuery = this.db
      .select({ createdAt: max(assistantMessages.createdAt) })
      .from(assistantMessages)
      .where(visibleMessageFilter);
    return this.db
      .select({
        id: assistantThreads.id,
        type: sql<AdminAiThreadSummary["type"]>`${AI_THREAD_TYPES.ASSISTANT}`.as("source_type"),
        practiceSessionId: sql<string | null>`NULL`.as("practice_session_id"),
        aiMentorLessonId: sql<string | null>`NULL`.as("ai_mentor_lesson_id"),
        lessonId: sql<string | null>`NULL`.as("lesson_id"),
        courseId: sql<string | null>`NULL`.as("course_id"),
        courseTitle: sql<string | null>`NULL`.as("course_title"),
        title:
          sql<string>`COALESCE(NULLIF(${assistantThreads.title}, ''), (${openingMessageQuery}), '')`.as(
            "resolved_title",
          ),
        openingPreview: sql<string | null>`(${openingMessageQuery})`.as("opening_preview"),
        owner: {
          id: sql<string>`${users.id}`.as("owner_id"),
          firstName: users.firstName,
          lastName: users.lastName,
          avatarReference: users.avatarReference,
        },
        status: sql<
          AdminAiThreadSummary["status"]
        >`CASE WHEN ${assistantThreads.archived} THEN ${AI_THREAD_STATUSES.ARCHIVED} ELSE ${AI_THREAD_STATUSES.ACTIVE} END`.as(
          "thread_status",
        ),
        language: assistantThreads.language,
        createdAt: assistantThreads.createdAt,
        lastActivityAt:
          sql<string>`COALESCE((${lastMessageActivityQuery}), ${assistantThreads.createdAt})`.as(
            "last_activity_at",
          ),
      })
      .from(assistantThreads)
      .innerJoin(users, eq(users.id, assistantThreads.userId));
  }

  private buildThreadSummariesQuery(adminAiThreadQuery: AdminAiThreadQuery) {
    return unionAll(
      this.buildMentorThreadSummariesQuery(adminAiThreadQuery),
      this.buildAssistantThreadSummariesQuery(),
    );
  }

  async getThreadSummaries(adminAiThreadQuery: AdminAiThreadQuery) {
    const { page, perPage } = parsePagination(adminAiThreadQuery.page, adminAiThreadQuery.perPage);
    const adminAiThreadSummaries = this.buildThreadSummariesQuery(adminAiThreadQuery).as(
      "admin_ai_thread_summaries",
    );
    const threadFilters = and(
      adminAiThreadQuery.userId
        ? eq(adminAiThreadSummaries.owner.id, adminAiThreadQuery.userId)
        : undefined,
      adminAiThreadQuery.type
        ? eq(adminAiThreadSummaries.type, adminAiThreadQuery.type)
        : undefined,
      adminAiThreadQuery.status
        ? eq(adminAiThreadSummaries.status, adminAiThreadQuery.status)
        : undefined,
      adminAiThreadQuery.search
        ? sql`${adminAiThreadSummaries.title} ILIKE ${`%${adminAiThreadQuery.search.replace(/[\\%_]/g, "\\$&")}%`}`
        : undefined,
      adminAiThreadQuery.from
        ? gte(adminAiThreadSummaries.createdAt, adminAiThreadQuery.from)
        : undefined,
      adminAiThreadQuery.to
        ? lt(adminAiThreadSummaries.createdAt, adminAiThreadQuery.to)
        : undefined,
    );
    const [data, threadCounts] = await Promise.all([
      this.db
        .select()
        .from(adminAiThreadSummaries)
        .where(threadFilters)
        .orderBy(desc(adminAiThreadSummaries.lastActivityAt), desc(adminAiThreadSummaries.id))
        .limit(perPage)
        .offset((page - 1) * perPage),
      this.db.select({ total: count() }).from(adminAiThreadSummaries).where(threadFilters),
    ]);
    return { data, pagination: { page, perPage, totalItems: threadCounts[0].total } };
  }

  async findThreadSummaryById(threadId: UUIDType, adminAiThreadQuery: AdminAiThreadQuery = {}) {
    const summaries = this.buildThreadSummariesQuery(adminAiThreadQuery).as("thread_summaries");
    const [threadSummary] = await this.db
      .select()
      .from(summaries)
      .where(eq(summaries.id, threadId))
      .limit(1);
    return threadSummary;
  }

  async getThreadMessages(
    threadId: UUIDType,
    page = 1,
    perPage = 100,
    type?: AdminAiThreadSummary["type"],
  ) {
    if (type === AI_THREAD_TYPES.ASSISTANT) {
      return this.getAssistantThreadMessages(threadId, page, perPage);
    }
    const messageFilters = and(
      eq(aiMentorThreadMessages.threadId, threadId),
      inArray(aiMentorThreadMessages.role, [MESSAGE_ROLE.USER, MESSAGE_ROLE.MENTOR]),
    );
    const [data, messageCounts] = await Promise.all([
      this.db
        .select({
          id: aiMentorThreadMessages.id,
          role: sql<AdminAiThreadMessage["role"]>`${aiMentorThreadMessages.role}`,
          content: aiMentorThreadMessages.content,
          createdAt: aiMentorThreadMessages.createdAt,
        })
        .from(aiMentorThreadMessages)
        .where(messageFilters)
        .orderBy(asc(aiMentorThreadMessages.createdAt), asc(aiMentorThreadMessages.id))
        .limit(perPage)
        .offset((page - 1) * perPage),
      this.db.select({ total: count() }).from(aiMentorThreadMessages).where(messageFilters),
    ]);
    return { data, pagination: { page, perPage, totalItems: messageCounts[0].total } };
  }

  private async getAssistantThreadMessages(threadId: UUIDType, page: number, perPage: number) {
    const messageFilters = and(
      eq(assistantMessages.threadId, threadId),
      inArray(assistantMessages.role, Object.values(ASSISTANT_MESSAGE_ROLES)),
    );
    const [data, messageCounts] = await Promise.all([
      this.db
        .select({
          id: assistantMessages.id,
          role: sql<
            AdminAiThreadMessage["role"]
          >`CASE WHEN ${assistantMessages.role} = ${ASSISTANT_MESSAGE_ROLES.USER} THEN ${MESSAGE_ROLE.USER} ELSE ${MESSAGE_ROLE.MENTOR} END`,
          content: assistantMessages.text,
          status: assistantMessages.status,
          createdAt: assistantMessages.createdAt,
        })
        .from(assistantMessages)
        .where(messageFilters)
        .orderBy(asc(assistantMessages.createdAt), asc(assistantMessages.id))
        .limit(perPage)
        .offset((page - 1) * perPage),
      this.db.select({ total: count() }).from(assistantMessages).where(messageFilters),
    ]);
    return { data, pagination: { page, perPage, totalItems: messageCounts[0].total } };
  }

  async findThreadJudgementByThreadId(threadId: UUIDType) {
    const [judgement] = await this.db
      .select()
      .from(aiMentorJudgements)
      .where(eq(aiMentorJudgements.threadId, threadId))
      .limit(1);
    return judgement;
  }

  getThreadJudgementCriteria(judgementId: UUIDType) {
    return this.db
      .select({
        criterionId: aiMentorJudgementCriteria.criterionId,
        title: aiMentorJudgementCriteria.criterionTitle,
        awardedScore: aiMentorJudgementCriteria.awardedPoints,
        maxScore: aiMentorJudgementCriteria.maxScoreAtJudgement,
        status: aiMentorJudgementCriteria.status,
        learnerSafeFeedback: sql<string>`COALESCE(${aiMentorJudgementCriteria.learnerSafeFeedback}, '')`,
      })
      .from(aiMentorJudgementCriteria)
      .where(eq(aiMentorJudgementCriteria.judgementId, judgementId))
      .orderBy(asc(aiMentorJudgementCriteria.createdAt), asc(aiMentorJudgementCriteria.id));
  }

  getThreadJudgementBlockingErrors(judgementId: UUIDType) {
    return this.db
      .select({
        blockingErrorId: aiMentorJudgementBlockingErrors.blockingErrorId,
        description: aiMentorJudgementBlockingErrors.blockingErrorDescription,
        learnerSafeFeedback: aiMentorJudgementBlockingErrors.learnerSafeFeedback,
      })
      .from(aiMentorJudgementBlockingErrors)
      .where(eq(aiMentorJudgementBlockingErrors.judgementId, judgementId))
      .orderBy(
        asc(aiMentorJudgementBlockingErrors.createdAt),
        asc(aiMentorJudgementBlockingErrors.id),
      );
  }
}
