import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, getTableColumns, inArray, not, sql } from "drizzle-orm";
import { sum } from "drizzle-orm/sql/functions/aggregate";

import { MESSAGE_ROLE, type MessageRole, type ThreadStatus } from "src/ai/ai.type";
import { DatabasePg } from "src/common";
import {
  aiMentorLessons,
  aiMentorThreadMessages,
  aiMentorThreads,
  groups,
  groupUsers,
  lessons,
} from "src/storage/schema";

import type {
  AiMentorGroupsBody,
  AiMentorLessonBody,
  ThreadBody,
  ThreadMessageBody,
  UpdateThreadBody,
} from "src/ai/ai.schema";
import type { UUIDType } from "src/common";

@Injectable()
export class AiRepository {
  constructor(@Inject("DB") private readonly db: DatabasePg) {}

  async getAiMentorLessonIdFromLesson(id: UUIDType) {
    const [aiMentorLessonId] = await this.db
      .select({ aiMentorLessonId: aiMentorLessons.id })
      .from(aiMentorLessons)
      .where(eq(aiMentorLessons.lessonId, id));

    return aiMentorLessonId;
  }

  async createThread(data: ThreadBody) {
    const [thread] = await this.db
      .insert(aiMentorThreads)
      .values(data)
      .returning({
        ...getTableColumns(aiMentorThreads),
        status: sql<ThreadStatus>`${aiMentorThreads.status}`,
      });
    return thread;
  }

  async createMessage(data: ThreadMessageBody) {
    const [message] = await this.db.insert(aiMentorThreadMessages).values(data).returning();
    return message;
  }

  async findThread(threadId: UUIDType) {
    const [thread] = await this.db
      .select({
        ...getTableColumns(aiMentorThreads),
        status: sql<ThreadStatus>`${aiMentorThreads.status}`,
      })
      .from(aiMentorThreads)
      .where(eq(aiMentorThreads.id, threadId));
    return thread;
  }

  async findThreadsByLessonId(lessonId: UUIDType) {
    const threads = await this.db
      .select({
        ...getTableColumns(aiMentorThreads),
        status: sql<ThreadStatus>`${aiMentorThreads.status}`,
      })
      .from(aiMentorThreads)
      .innerJoin(aiMentorLessons, eq(aiMentorLessons.id, aiMentorThreads.aiMentorLessonId))
      .where(eq(aiMentorLessons.lessonId, lessonId));

    return threads;
  }
  async findThreadsByLessonIdAndUserId(lessonId: UUIDType, userId: UUIDType) {
    const threads = await this.db
      .select({
        ...getTableColumns(aiMentorThreads),
        status: sql<ThreadStatus>`${aiMentorThreads.status}`,
      })
      .from(aiMentorThreads)
      .innerJoin(aiMentorLessons, eq(aiMentorLessons.id, aiMentorThreads.aiMentorLessonId))
      .where(and(eq(aiMentorLessons.lessonId, lessonId), eq(aiMentorThreads.userId, userId)));

    return threads;
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
    return tokens;
  }

  async findMessageHistory(threadId: UUIDType, archived?: boolean, role?: MessageRole) {
    const messages = await this.db
      .select({
        role: sql<MessageRole>`${aiMentorThreadMessages.role}`,
        content: aiMentorThreadMessages.content,
      })
      .from(aiMentorThreadMessages)
      .where(
        and(
          eq(aiMentorThreadMessages.threadId, threadId),
          eq(
            aiMentorThreadMessages.archived,
            archived ? archived : aiMentorThreadMessages.archived,
          ),
          eq(aiMentorThreadMessages.role, role ? role : aiMentorThreadMessages.role),
        ),
      )
      .orderBy(asc(aiMentorThreadMessages.createdAt));

    return messages;
  }

  async findThreadLanguage(threadId: UUIDType) {
    const [lang] = await this.db
      .select({ language: aiMentorThreads.userLanguage })
      .from(aiMentorThreads)
      .where(eq(aiMentorThreads.id, threadId));

    return lang;
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
      .where(eq(aiMentorThreadMessages.role, MESSAGE_ROLE.SUMMARY));
    return newSummary;
  }

  async insertMessage(data: ThreadMessageBody) {
    return this.db.insert(aiMentorThreadMessages).values(data).returning();
  }

  async findMentorLessonByThreadId(threadId: UUIDType): Promise<AiMentorLessonBody> {
    const [lesson] = await this.db
      .select({
        title: lessons.title,
        instructions: aiMentorLessons.aiMentorInstructions,
        conditions: aiMentorLessons.completionConditions,
      })
      .from(aiMentorThreads)
      .innerJoin(aiMentorLessons, eq(aiMentorThreads.aiMentorLessonId, aiMentorLessons.id))
      .innerJoin(lessons, eq(lessons.id, aiMentorLessons.lessonId))
      .where(eq(aiMentorThreads.id, threadId));
    return lesson;
  }

  async findGroupsByThreadId(threadId: UUIDType): Promise<AiMentorGroupsBody> {
    const groupCharacteristics = await this.db
      .select({
        name: groups.name,
        characteristic: groups.description,
      })
      .from(groups)
      .innerJoin(groupUsers, eq(groups.id, groupUsers.groupId))
      .innerJoin(aiMentorThreads, eq(aiMentorThreads.userId, groupUsers.userId))
      .where(eq(aiMentorThreads.id, threadId));

    return groupCharacteristics;
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
}
