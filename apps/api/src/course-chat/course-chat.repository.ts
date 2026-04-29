import { Inject, Injectable } from "@nestjs/common";
import { COURSE_ENROLLMENT } from "@repo/shared";
import { and, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { DEFAULT_PAGE_SIZE } from "src/common/pagination";
import {
  courses,
  courseChatMessageReactions,
  courseChatMessages,
  courseChatThreads,
  studentCourses,
  users,
} from "src/storage/schema";

import type { UUIDType } from "src/common";
import type {
  CourseChatMessageResponse,
  CourseChatMessageReactionResponse,
  CourseChatThreadResponse,
  CourseChatUserResponse,
} from "src/course-chat/schemas/course-chat.schema";

type CourseChatMessageRow = {
  id: UUIDType;
  threadId: UUIDType;
  courseId: UUIDType;
  userId: UUIDType;
  content: string;
  parentMessageId: UUIDType | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  userIdForProfile: UUIDType;
  userFirstName: string;
  userLastName: string;
  userAvatarReference: string | null;
};

export type CourseChatMentionEmailRecipient = {
  id: UUIDType;
  email: string;
  firstName: string;
  tenantId: UUIDType;
};

export type CourseChatEmailContext = {
  title: Record<string, string>;
  baseLanguage: string;
};

export type CourseChatMessageContext = {
  id: UUIDType;
  threadId: UUIDType;
  courseId: UUIDType;
};

@Injectable()
export class CourseChatRepository {
  constructor(@Inject("DB") private readonly db: DatabasePg) {}

  async isUserEnrolledInCourse(courseId: UUIDType, userId: UUIDType): Promise<boolean> {
    const [enrollment] = await this.db
      .select({ id: studentCourses.id })
      .from(studentCourses)
      .where(
        and(
          eq(studentCourses.courseId, courseId),
          eq(studentCourses.studentId, userId),
          eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED),
        ),
      )
      .limit(1);

    return Boolean(enrollment);
  }

  async getThreads(
    courseId: UUIDType,
    viewerUserId: UUIDType,
    page = 1,
    perPage = DEFAULT_PAGE_SIZE,
  ) {
    const data = await this.db
      .select({
        id: courseChatThreads.id,
        courseId: courseChatThreads.courseId,
        createdByUserId: courseChatThreads.createdByUserId,
        archived: courseChatThreads.archived,
        createdAt: courseChatThreads.createdAt,
        updatedAt: courseChatThreads.updatedAt,
        messageCount: sql<number>`(
          SELECT COUNT(*)::int
          FROM ${courseChatMessages}
          WHERE ${courseChatMessages.threadId} = ${courseChatThreads.id}
            AND ${courseChatMessages.deletedAt} IS NULL
        )`,
        createdById: users.id,
        createdByFirstName: users.firstName,
        createdByLastName: users.lastName,
        createdByAvatarReference: users.avatarReference,
      })
      .from(courseChatThreads)
      .innerJoin(users, eq(users.id, courseChatThreads.createdByUserId))
      .where(and(eq(courseChatThreads.courseId, courseId), eq(courseChatThreads.archived, false)))
      .orderBy(courseChatThreads.createdAt)
      .limit(perPage)
      .offset((page - 1) * perPage);

    const [{ totalItems }] = await this.db
      .select({ totalItems: count() })
      .from(courseChatThreads)
      .where(and(eq(courseChatThreads.courseId, courseId), eq(courseChatThreads.archived, false)));

    const threads = await Promise.all(
      data.map(async (thread): Promise<CourseChatThreadResponse> => {
        const [rootMessage, latestMessage] = await Promise.all([
          this.getRootMessage(thread.id, viewerUserId),
          this.getLatestMessage(thread.id, viewerUserId),
        ]);

        if (!rootMessage) {
          throw new Error(`Course chat thread ${thread.id} has no root message`);
        }

        return this.mapThread(thread, rootMessage, latestMessage);
      }),
    );

    return {
      data: threads,
      pagination: { totalItems, page, perPage },
    };
  }

  async getEnrolledUsers(courseId: UUIDType): Promise<Omit<CourseChatUserResponse, "isOnline">[]> {
    return this.db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        avatarReference: users.avatarReference,
      })
      .from(studentCourses)
      .innerJoin(users, eq(users.id, studentCourses.studentId))
      .where(
        and(
          eq(studentCourses.courseId, courseId),
          eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED),
          isNull(users.deletedAt),
        ),
      )
      .orderBy(users.firstName, users.lastName);
  }

  async getEnrolledUserIds(courseId: UUIDType, userIds: UUIDType[]): Promise<UUIDType[]> {
    if (!userIds.length) return [];

    const rows = await this.db
      .select({ userId: studentCourses.studentId })
      .from(studentCourses)
      .where(
        and(
          eq(studentCourses.courseId, courseId),
          eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED),
          inArray(studentCourses.studentId, userIds),
        ),
      );

    return rows.map(({ userId }) => userId);
  }

  async getMentionEmailRecipients(
    courseId: UUIDType,
    userIds: UUIDType[],
  ): Promise<CourseChatMentionEmailRecipient[]> {
    if (!userIds.length) return [];

    return this.db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        tenantId: users.tenantId,
      })
      .from(studentCourses)
      .innerJoin(users, eq(users.id, studentCourses.studentId))
      .where(
        and(
          eq(studentCourses.courseId, courseId),
          eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED),
          inArray(studentCourses.studentId, userIds),
          isNull(users.deletedAt),
        ),
      );
  }

  async getCourseEmailContext(courseId: UUIDType): Promise<CourseChatEmailContext | null> {
    const [course] = await this.db
      .select({
        title: courses.title,
        baseLanguage: courses.baseLanguage,
      })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);

    return course ? (course as CourseChatEmailContext) : null;
  }

  async getThreadById(
    threadId: UUIDType,
    viewerUserId: UUIDType,
  ): Promise<CourseChatThreadResponse | null> {
    const [thread] = await this.db
      .select({
        id: courseChatThreads.id,
        courseId: courseChatThreads.courseId,
        createdByUserId: courseChatThreads.createdByUserId,
        archived: courseChatThreads.archived,
        createdAt: courseChatThreads.createdAt,
        updatedAt: courseChatThreads.updatedAt,
        messageCount: sql<number>`(
          SELECT COUNT(*)::int
          FROM ${courseChatMessages}
          WHERE ${courseChatMessages.threadId} = ${courseChatThreads.id}
            AND ${courseChatMessages.deletedAt} IS NULL
        )`,
        createdById: users.id,
        createdByFirstName: users.firstName,
        createdByLastName: users.lastName,
        createdByAvatarReference: users.avatarReference,
      })
      .from(courseChatThreads)
      .innerJoin(users, eq(users.id, courseChatThreads.createdByUserId))
      .where(eq(courseChatThreads.id, threadId))
      .limit(1);

    if (!thread) return null;

    const [rootMessage, latestMessage] = await Promise.all([
      this.getRootMessage(thread.id, viewerUserId),
      this.getLatestMessage(thread.id, viewerUserId),
    ]);

    if (!rootMessage) {
      throw new Error(`Course chat thread ${thread.id} has no root message`);
    }

    return this.mapThread(thread, rootMessage, latestMessage);
  }

  async getMessages(
    threadId: UUIDType,
    viewerUserId: UUIDType,
    page = 1,
    perPage = DEFAULT_PAGE_SIZE,
  ) {
    const data = await this.db
      .select(this.messageSelect())
      .from(courseChatMessages)
      .innerJoin(users, eq(users.id, courseChatMessages.userId))
      .where(and(eq(courseChatMessages.threadId, threadId), isNull(courseChatMessages.deletedAt)))
      .orderBy(courseChatMessages.createdAt)
      .limit(perPage)
      .offset((page - 1) * perPage);

    const [{ totalItems }] = await this.db
      .select({ totalItems: count() })
      .from(courseChatMessages)
      .where(and(eq(courseChatMessages.threadId, threadId), isNull(courseChatMessages.deletedAt)));

    return {
      data: await Promise.all(data.map((message) => this.mapMessage(message, viewerUserId))),
      pagination: { totalItems, page, perPage },
    };
  }

  async getMessageById(
    messageId: UUIDType,
    viewerUserId: UUIDType,
  ): Promise<CourseChatMessageResponse | null> {
    const [message] = await this.db
      .select(this.messageSelect())
      .from(courseChatMessages)
      .innerJoin(users, eq(users.id, courseChatMessages.userId))
      .where(eq(courseChatMessages.id, messageId))
      .limit(1);

    return message ? this.mapMessage(message, viewerUserId) : null;
  }

  async createThreadWithMessage(courseId: UUIDType, userId: UUIDType, content: string) {
    return this.db.transaction(async (trx) => {
      const [thread] = await trx
        .insert(courseChatThreads)
        .values({ courseId, createdByUserId: userId })
        .returning({ id: courseChatThreads.id });

      const [message] = await trx
        .insert(courseChatMessages)
        .values({ threadId: thread.id, courseId, userId, content })
        .returning({ id: courseChatMessages.id });

      return { threadId: thread.id, messageId: message.id };
    });
  }

  async createMessage(params: {
    threadId: UUIDType;
    courseId: UUIDType;
    userId: UUIDType;
    content: string;
    parentMessageId?: UUIDType;
  }) {
    return this.db.transaction(async (trx) => {
      const [message] = await trx
        .insert(courseChatMessages)
        .values(params)
        .returning({ id: courseChatMessages.id });

      await trx
        .update(courseChatThreads)
        .set({ updatedAt: sql`CURRENT_TIMESTAMP` })
        .where(eq(courseChatThreads.id, params.threadId));

      return message.id;
    });
  }

  async messageBelongsToThread(messageId: UUIDType, threadId: UUIDType): Promise<boolean> {
    const [message] = await this.db
      .select({ id: courseChatMessages.id })
      .from(courseChatMessages)
      .where(
        and(
          eq(courseChatMessages.id, messageId),
          eq(courseChatMessages.threadId, threadId),
          isNull(courseChatMessages.deletedAt),
        ),
      )
      .limit(1);

    return Boolean(message);
  }

  async getMessageContext(messageId: UUIDType): Promise<CourseChatMessageContext | null> {
    const [message] = await this.db
      .select({
        id: courseChatMessages.id,
        threadId: courseChatMessages.threadId,
        courseId: courseChatMessages.courseId,
      })
      .from(courseChatMessages)
      .where(and(eq(courseChatMessages.id, messageId), isNull(courseChatMessages.deletedAt)))
      .limit(1);

    return message ?? null;
  }

  async toggleMessageReaction(params: {
    messageId: UUIDType;
    courseId: UUIDType;
    userId: UUIDType;
    reaction: string;
  }) {
    await this.db.transaction(async (trx) => {
      const deleted = await trx
        .delete(courseChatMessageReactions)
        .where(
          and(
            eq(courseChatMessageReactions.messageId, params.messageId),
            eq(courseChatMessageReactions.userId, params.userId),
            eq(courseChatMessageReactions.reaction, params.reaction),
          ),
        )
        .returning({ id: courseChatMessageReactions.id });

      if (deleted.length) return;

      await trx.insert(courseChatMessageReactions).values(params);
    });
  }

  async getMessageReactions(
    messageId: UUIDType,
    viewerUserId: UUIDType,
  ): Promise<CourseChatMessageReactionResponse[]> {
    return this.db
      .select({
        reaction: courseChatMessageReactions.reaction,
        count: sql<number>`COUNT(*)::int`,
        reactedByCurrentUser: sql<boolean>`BOOL_OR(${courseChatMessageReactions.userId} = ${viewerUserId})`,
      })
      .from(courseChatMessageReactions)
      .where(eq(courseChatMessageReactions.messageId, messageId))
      .groupBy(courseChatMessageReactions.reaction)
      .orderBy(courseChatMessageReactions.reaction);
  }

  private async getLatestMessage(
    threadId: UUIDType,
    viewerUserId: UUIDType,
  ): Promise<CourseChatMessageResponse | null> {
    const [message] = await this.db
      .select(this.messageSelect())
      .from(courseChatMessages)
      .innerJoin(users, eq(users.id, courseChatMessages.userId))
      .where(and(eq(courseChatMessages.threadId, threadId), isNull(courseChatMessages.deletedAt)))
      .orderBy(desc(courseChatMessages.createdAt))
      .limit(1);

    return message ? this.mapMessage(message, viewerUserId) : null;
  }

  private async getRootMessage(
    threadId: UUIDType,
    viewerUserId: UUIDType,
  ): Promise<CourseChatMessageResponse | null> {
    const [message] = await this.db
      .select(this.messageSelect())
      .from(courseChatMessages)
      .innerJoin(users, eq(users.id, courseChatMessages.userId))
      .where(and(eq(courseChatMessages.threadId, threadId), isNull(courseChatMessages.deletedAt)))
      .orderBy(courseChatMessages.createdAt)
      .limit(1);

    return message ? this.mapMessage(message, viewerUserId) : null;
  }

  private messageSelect() {
    return {
      id: courseChatMessages.id,
      threadId: courseChatMessages.threadId,
      courseId: courseChatMessages.courseId,
      userId: courseChatMessages.userId,
      content: courseChatMessages.content,
      parentMessageId: courseChatMessages.parentMessageId,
      deletedAt: courseChatMessages.deletedAt,
      createdAt: courseChatMessages.createdAt,
      updatedAt: courseChatMessages.updatedAt,
      userIdForProfile: users.id,
      userFirstName: users.firstName,
      userLastName: users.lastName,
      userAvatarReference: users.avatarReference,
    };
  }

  private mapThread(
    thread: {
      id: UUIDType;
      courseId: UUIDType;
      createdByUserId: UUIDType;
      archived: boolean;
      createdAt: string;
      updatedAt: string;
      messageCount: number;
      createdById: UUIDType;
      createdByFirstName: string;
      createdByLastName: string;
      createdByAvatarReference: string | null;
    },
    rootMessage: CourseChatMessageResponse,
    latestMessage: CourseChatMessageResponse | null,
  ): CourseChatThreadResponse {
    return {
      id: thread.id,
      courseId: thread.courseId,
      createdByUserId: thread.createdByUserId,
      archived: thread.archived,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
      messageCount: thread.messageCount,
      createdBy: {
        id: thread.createdById,
        firstName: thread.createdByFirstName,
        lastName: thread.createdByLastName,
        avatarReference: thread.createdByAvatarReference,
      },
      rootMessage,
      latestMessage,
    };
  }

  private async mapMessage(
    message: CourseChatMessageRow,
    viewerUserId: UUIDType,
  ): Promise<CourseChatMessageResponse> {
    return {
      id: message.id,
      threadId: message.threadId,
      courseId: message.courseId,
      userId: message.userId,
      content: message.content,
      parentMessageId: message.parentMessageId,
      deletedAt: message.deletedAt,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
      user: {
        id: message.userIdForProfile,
        firstName: message.userFirstName,
        lastName: message.userLastName,
        avatarReference: message.userAvatarReference,
      },
      reactions: await this.getMessageReactions(message.id, viewerUserId),
    };
  }
}
