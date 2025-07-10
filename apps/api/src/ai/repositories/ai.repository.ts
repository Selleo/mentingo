import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, inArray, not, sql } from "drizzle-orm";
import { sum } from "drizzle-orm/sql/functions/aggregate";

import { MESSAGE_ROLE, type MessageRole } from "src/ai/ai.type";
import { DatabasePg } from "src/common";
import {
  aiMentorLessons,
  aiMentorThreadMessages,
  aiMentorThreads,
  groups,
  groupUsers,
  lessons,
} from "src/storage/schema";

import type { ThreadBody, ThreadMessageBody } from "src/ai/ai.schema";
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
    const [thread] = await this.db.insert(aiMentorThreads).values(data).returning();
    return thread;
  }

  async createMessage(data: ThreadMessageBody) {
    const [message] = await this.db.insert(aiMentorThreadMessages).values(data).returning();
    return message;
  }

  async findThread(threadId: UUIDType) {
    const [thread] = await this.db
      .select()
      .from(aiMentorThreads)
      .where(eq(aiMentorThreads.id, threadId));
    return thread;
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

  async findMessageHistory(threadId: UUIDType, archived: boolean) {
    const messages = await this.db
      .select({
        role: sql<MessageRole>`${aiMentorThreadMessages.role}`,
        content: aiMentorThreadMessages.content,
      })
      .from(aiMentorThreadMessages)
      .where(
        and(
          eq(aiMentorThreadMessages.threadId, threadId),
          eq(aiMentorThreadMessages.archived, archived),
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
  async updateMessageContent(threadMessageId: string, content: string, tokenCount: number) {
    const [newSummary] = await this.db
      .update(aiMentorThreadMessages)
      .set({ content, tokenCount })
      .where(eq(aiMentorThreadMessages.id, threadMessageId));
    return newSummary;
  }

  async insertMessage(data: ThreadMessageBody) {
    return this.db.insert(aiMentorThreadMessages).values(data).returning();
  }

  async findMentorLessonByThreadId(
    threadId: UUIDType,
  ): Promise<{ title?: string; instructions?: string; conditions?: string }> {
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

  async findGroupsByThreadId(
    threadId: UUIDType,
  ): Promise<{ title?: string; characteristic?: string }> {
    const [groupCharacteristics] = await this.db
      .select({
        title: groups.name,
        characteristic: groups.description,
      })
      .from(groups)
      .innerJoin(groupUsers, eq(groups.id, groupUsers.groupId))
      .innerJoin(aiMentorThreads, eq(aiMentorThreads.userId, groupUsers.userId))
      .where(eq(aiMentorThreads.id, threadId));

    return groupCharacteristics
      ? {
          ...groupCharacteristics,
          characteristic: groupCharacteristics.characteristic ?? undefined,
        }
      : {};
  }
}
