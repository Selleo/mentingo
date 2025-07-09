import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { sum } from "drizzle-orm/sql/functions/aggregate";

import { MESSAGE_ROLE, type MessageRole } from "src/ai/ai.type";
import { DatabasePg } from "src/common";
import { aiMentorLessons, aiMentorThreadMessages, aiMentorThreads } from "src/storage/schema";

import type { ThreadBody, ThreadMessageBody } from "src/ai/ai.schema";
import type { UUIDType } from "src/common";

@Injectable()
export class AiRepository {
  constructor(@Inject("DB") private readonly db: DatabasePg) {}

  async getLessonIdFromMentorLesson(id: UUIDType) {
    return this.db
      .select({ lessonId: aiMentorLessons.lessonId })
      .from(aiMentorLessons)
      .where(eq(aiMentorLessons.id, id));
  }

  async createThread(data: ThreadBody) {
    const [thread] = await this.db.insert(aiMentorThreads).values(data).returning();
    return thread;
  }

  async createMessage(data: ThreadMessageBody) {
    const [message] = await this.db.insert(aiMentorThreadMessages).values(data).returning();
    return message;
  }

  async getThreadStatus(threadId: UUIDType) {
    const [status] = await this.db
      .select({ status: aiMentorThreads.status })
      .from(aiMentorThreads)
      .where(eq(aiMentorThreads.id, threadId));
    return status;
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
        ),
      );
    return tokens;
  }

  async getMessageHistory(threadId: UUIDType, archived: boolean, role?: MessageRole) {
    const messages = await this.db
      .select()
      .from(aiMentorThreadMessages)
      .where(
        and(
          eq(aiMentorThreadMessages.threadId, threadId),
          eq(aiMentorThreadMessages.archived, archived),
          ...(role &&
          role !== MESSAGE_ROLE.SYSTEM &&
          role !== MESSAGE_ROLE.TOOL &&
          role !== MESSAGE_ROLE.SUMMARY
            ? [eq(aiMentorThreadMessages.role, role)]
            : []),
        ),
      );

    const [lang] = await this.db
      .select({ language: aiMentorThreads.userLanguage })
      .from(aiMentorThreads)
      .where(eq(aiMentorThreads.id, threadId));

    const messageHistory = messages.map<{ role: MessageRole; content: string }>(
      ({ role, content }) => ({ role: role as MessageRole, content }),
    );

    return { data: { messages }, history: messageHistory, language: lang.language };
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
      .where(eq(aiMentorThreadMessages.threadId, threadId))
      .returning();
    return archived;
  }

  async updateSummary(threadId: UUIDType, summary: string, tokenCount: number) {
    const newSummary = await this.db
      .update(aiMentorThreadMessages)
      .set({ content: summary, tokenCount: tokenCount })
      .where(eq(aiMentorThreadMessages.role, MESSAGE_ROLE.SUMMARY));
    return newSummary;
  }
  async updateMessageContent(threadMessageId: string, content: string, tokenCount: number) {
    const newSummary = await this.db
      .update(aiMentorThreadMessages)
      .set({ content, tokenCount })
      .where(eq(aiMentorThreadMessages.id, threadMessageId));
    return newSummary;
  }

  async insertMessage(data: ThreadMessageBody) {
    const newMessage = await this.db.insert(aiMentorThreadMessages).values(data).returning();
    return newMessage;
  }
}
