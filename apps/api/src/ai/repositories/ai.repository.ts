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
import {
  aiMentorLessons,
  aiMentorThreadMessages,
  aiMentorThreads,
  chapters,
  groups,
  groupUsers,
  lessons,
  studentCourses,
  studentLessonProgress,
  users,
} from "src/storage/schema";

import type { AiMentorType } from "@repo/shared";
import type { SQL } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type {
  AiMentorGroupsBody,
  AiMentorLessonBody,
  ThreadBody,
  ThreadMessageBody,
  UpdateThreadBody,
} from "src/ai/utils/ai.schema";
import type { UUIDType } from "src/common";
import type * as schema from "src/storage/schema";

@Injectable()
export class AiRepository {
  constructor(@Inject("DB") private readonly db: DatabasePg) {}

  async findAiMentorLessonIdFromLesson(id: UUIDType) {
    const [aiMentorLessonId] = await this.db
      .select({ aiMentorLessonId: aiMentorLessons.id })
      .from(aiMentorLessons)
      .where(eq(aiMentorLessons.lessonId, id));

    return aiMentorLessonId;
  }

  async findThread(conditions: SQL[]) {
    const [thread] = await this.db
      .select({
        ...getTableColumns(aiMentorThreads),
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

  async findMessageHistory(
    threadId: UUIDType,
    archived?: boolean,
    role?: MessageRole,
    userId?: UUIDType,
  ) {
    const userCondition = userId ? eq(aiMentorThreads.userId, userId) : undefined;

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
          userCondition,
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
    return this.db.insert(aiMentorThreadMessages).values(data).returning();
  }

  async findMentorLessonByThreadId(threadId: UUIDType): Promise<AiMentorLessonBody> {
    const [lesson] = await this.db
      .select({
        title: lessons.title,
        instructions: aiMentorLessons.aiMentorInstructions,
        conditions: aiMentorLessons.completionConditions,
        type: sql<AiMentorType>`${aiMentorLessons.type}`,
        name: aiMentorLessons.name,
      })
      .from(aiMentorThreads)
      .innerJoin(aiMentorLessons, eq(aiMentorThreads.aiMentorLessonId, aiMentorLessons.id))
      .innerJoin(lessons, eq(lessons.id, aiMentorLessons.lessonId))
      .where(eq(aiMentorThreads.id, threadId));

    return lesson;
  }

  async findGroupsByThreadId(threadId: UUIDType): Promise<AiMentorGroupsBody> {
    return this.db
      .select({
        name: groups.name,
        characteristic: groups.characteristic,
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
}
