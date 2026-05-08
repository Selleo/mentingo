import { Inject, Injectable } from "@nestjs/common";
import { COURSE_ENROLLMENT } from "@repo/shared";
import { and, count, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { DEFAULT_PAGE_SIZE } from "src/common/pagination";
import { LocalizationService } from "src/localization/localization.service";
import {
  courses,
  courseChatMessageReactions,
  courseChatMessages,
  courseChatThreads,
  studentCourses,
  users,
} from "src/storage/schema";

import type { SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";

export type CourseChatUserProfileRow = {
  id: UUIDType;
  firstName: string;
  lastName: string;
  avatarReference: string | null;
};

export type CourseChatMessageRow = {
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

export type CourseChatMessageReactionSummaryRow = {
  messageId: UUIDType;
  reaction: string;
  count: number;
  reactedByCurrentUser: boolean;
};

export type CourseChatReplySummaryRow = {
  parentMessageId: UUIDType;
  replyCount: number;
  latestReply: CourseChatMessageRow | null;
};

export type CourseChatReplyParticipantRow = CourseChatUserProfileRow & {
  parentMessageId: UUIDType;
};

export type CourseChatMentionEmailRecipient = {
  id: UUIDType;
  email: string;
  firstName: string;
  tenantId: UUIDType;
};

export type CourseChatEmailContext = {
  title: string;
};

export type CourseChatMessageContext = {
  id: UUIDType;
  threadId: UUIDType;
  courseId: UUIDType;
  userId?: UUIDType;
  parentMessageId: UUIDType | null;
  deletedAt?: string | null;
};

@Injectable()
export class CourseChatRepository {
  constructor(
    @Inject("DB") private readonly db: DatabasePg,
    private readonly localizationService: LocalizationService,
  ) {}

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

  async getTopLevelMessages(courseId: UUIDType, page = 1, perPage = DEFAULT_PAGE_SIZE) {
    const visibleMessages = this.db
      .$with("visible_course_chat_top_level_messages")
      .as(
        this.db
          .select(this.messageSelect())
          .from(courseChatMessages)
          .innerJoin(courseChatThreads, eq(courseChatThreads.id, courseChatMessages.threadId))
          .innerJoin(users, eq(users.id, courseChatMessages.userId))
          .where(this.visibleTopLevelMessagesWhere(courseId)),
      );

    const data = await this.db
      .with(visibleMessages)
      .select()
      .from(visibleMessages)
      .orderBy(desc(visibleMessages.createdAt))
      .limit(perPage)
      .offset((page - 1) * perPage);

    const [{ totalItems }] = await this.db
      .with(visibleMessages)
      .select({ totalItems: count() })
      .from(visibleMessages);

    return {
      data: data.reverse(),
      pagination: { totalItems, page, perPage },
    };
  }

  async getReplies(parentMessageId: UUIDType, page = 1, perPage = DEFAULT_PAGE_SIZE) {
    const visibleReplies = this.db
      .$with("visible_course_chat_replies")
      .as(
        this.db
          .select(this.messageSelect())
          .from(courseChatMessages)
          .innerJoin(courseChatThreads, eq(courseChatThreads.id, courseChatMessages.threadId))
          .innerJoin(users, eq(users.id, courseChatMessages.userId))
          .where(this.visibleRepliesWhere(parentMessageId)),
      );

    const data = await this.db
      .with(visibleReplies)
      .select()
      .from(visibleReplies)
      .orderBy(visibleReplies.createdAt)
      .limit(perPage)
      .offset((page - 1) * perPage);

    const [{ totalItems }] = await this.db
      .with(visibleReplies)
      .select({ totalItems: count() })
      .from(visibleReplies);

    return {
      data,
      pagination: { totalItems, page, perPage },
    };
  }

  async getEnrolledUsers(courseId: UUIDType): Promise<CourseChatUserProfileRow[]> {
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

  private visibleTopLevelMessagesWhere(courseId: UUIDType) {
    return and(
      eq(courseChatMessages.courseId, courseId),
      eq(courseChatThreads.archived, false),
      isNull(courseChatMessages.parentMessageId),
      this.visibleTopLevelMessageCondition(),
    );
  }

  private visibleRepliesWhere(parentMessageId: UUIDType) {
    return and(
      eq(courseChatMessages.parentMessageId, parentMessageId),
      eq(courseChatThreads.archived, false),
      isNull(courseChatMessages.deletedAt),
    );
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

  async getCourseEmailContext(
    courseId: UUIDType,
    language: SupportedLanguages,
  ): Promise<CourseChatEmailContext | null> {
    const [course] = await this.db
      .select({
        title: this.localizationService.getLocalizedSqlField(courses.title, language),
      })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);

    return course ?? null;
  }

  async getMessageById(messageId: UUIDType): Promise<CourseChatMessageRow | null> {
    const [message] = await this.db
      .select(this.messageSelect())
      .from(courseChatMessages)
      .innerJoin(courseChatThreads, eq(courseChatThreads.id, courseChatMessages.threadId))
      .innerJoin(users, eq(users.id, courseChatMessages.userId))
      .where(and(eq(courseChatMessages.id, messageId), isNull(courseChatMessages.deletedAt)))
      .limit(1);

    return message ?? null;
  }

  async createMessage(params: {
    courseId: UUIDType;
    userId: UUIDType;
    content: string;
    parentMessageId?: UUIDType;
    parentMessage?: CourseChatMessageContext;
    dbInstance?: DatabasePg;
  }) {
    const db = params.dbInstance ?? this.db;

    if (!params.parentMessageId) {
      const { messageId } = await this.createTopLevelMessage(params, db);

      return messageId;
    }

    const parentMessage = params.parentMessage;
    if (!parentMessage) {
      throw new Error(`Parent course chat message ${params.parentMessageId} not found`);
    }

    const [message] = await db
      .insert(courseChatMessages)
      .values({
        threadId: parentMessage.threadId,
        courseId: params.courseId,
        userId: params.userId,
        content: params.content,
        parentMessageId: params.parentMessageId,
      })
      .returning({ id: courseChatMessages.id });

    await db
      .update(courseChatThreads)
      .set({ updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(courseChatThreads.id, parentMessage.threadId));

    return message.id;
  }

  async getMessageContext(messageId: UUIDType): Promise<CourseChatMessageContext | null> {
    const [message] = await this.db
      .select({
        id: courseChatMessages.id,
        threadId: courseChatMessages.threadId,
        courseId: courseChatMessages.courseId,
        userId: courseChatMessages.userId,
        parentMessageId: courseChatMessages.parentMessageId,
        deletedAt: courseChatMessages.deletedAt,
      })
      .from(courseChatMessages)
      .innerJoin(courseChatThreads, eq(courseChatThreads.id, courseChatMessages.threadId))
      .where(and(eq(courseChatMessages.id, messageId), eq(courseChatThreads.archived, false)))
      .limit(1);

    return message ?? null;
  }

  async toggleMessageReaction(params: {
    messageId: UUIDType;
    courseId: UUIDType;
    userId: UUIDType;
    reaction: string;
  }): Promise<boolean> {
    const [result] = await this.db.execute(sql<{ reacted: boolean }>`
      WITH deleted AS (
        DELETE FROM course_chat_message_reactions
        WHERE message_id = ${params.messageId}
          AND user_id = ${params.userId}
          AND reaction = ${params.reaction}
        RETURNING id
      ),
      inserted AS (
        INSERT INTO course_chat_message_reactions (message_id, course_id, user_id, reaction)
        SELECT ${params.messageId}, ${params.courseId}, ${params.userId}, ${params.reaction}
        WHERE NOT EXISTS (SELECT 1 FROM deleted)
        ON CONFLICT (user_id, message_id, reaction) DO NOTHING
        RETURNING id
      )
      SELECT EXISTS (SELECT 1 FROM inserted) AS "reacted"
    `);

    return Boolean(result?.reacted);
  }

  async getMessageReactions(
    messageId: UUIDType,
    viewerUserId: UUIDType,
  ): Promise<CourseChatMessageReactionSummaryRow[]> {
    return this.getMessageReactionsForMessages([messageId], viewerUserId);
  }

  async getMessageReactionsForMessages(
    messageIds: UUIDType[],
    viewerUserId: UUIDType,
  ): Promise<CourseChatMessageReactionSummaryRow[]> {
    if (!messageIds.length) return [];

    return this.db
      .select({
        messageId: courseChatMessageReactions.messageId,
        reaction: courseChatMessageReactions.reaction,
        count: sql<number>`COUNT(*)::int`,
        reactedByCurrentUser: sql<boolean>`BOOL_OR(${courseChatMessageReactions.userId} = ${viewerUserId})`,
      })
      .from(courseChatMessageReactions)
      .where(inArray(courseChatMessageReactions.messageId, messageIds))
      .groupBy(courseChatMessageReactions.messageId, courseChatMessageReactions.reaction)
      .orderBy(courseChatMessageReactions.reaction);
  }

  async getReplySummaries(parentMessageIds: UUIDType[]): Promise<CourseChatReplySummaryRow[]> {
    if (!parentMessageIds.length) return [];

    const replyCounts = this.db.$with("course_chat_reply_counts").as(
      this.db
        .select({
          parentMessageId: courseChatMessages.parentMessageId,
          replyCount: count().as("replyCount"),
        })
        .from(courseChatMessages)
        .innerJoin(courseChatThreads, eq(courseChatThreads.id, courseChatMessages.threadId))
        .where(
          and(
            inArray(courseChatMessages.parentMessageId, parentMessageIds),
            eq(courseChatThreads.archived, false),
            isNull(courseChatMessages.deletedAt),
          ),
        )
        .groupBy(courseChatMessages.parentMessageId),
    );

    const rankedReplies = this.db.$with("course_chat_ranked_replies").as(
      this.db
        .select({
          ...this.messageSelect(),
          replyRank: sql<number>`
            ROW_NUMBER() OVER (
              PARTITION BY ${courseChatMessages.parentMessageId}
              ORDER BY ${courseChatMessages.createdAt} DESC
            )
          `.as("replyRank"),
        })
        .from(courseChatMessages)
        .innerJoin(courseChatThreads, eq(courseChatThreads.id, courseChatMessages.threadId))
        .innerJoin(users, eq(users.id, courseChatMessages.userId))
        .where(
          and(
            inArray(courseChatMessages.parentMessageId, parentMessageIds),
            eq(courseChatThreads.archived, false),
            isNull(courseChatMessages.deletedAt),
          ),
        ),
    );

    const rows = await this.db
      .with(replyCounts, rankedReplies)
      .select({
        parentMessageId: replyCounts.parentMessageId,
        replyCount: replyCounts.replyCount,
        id: rankedReplies.id,
        threadId: rankedReplies.threadId,
        courseId: rankedReplies.courseId,
        userId: rankedReplies.userId,
        content: rankedReplies.content,
        latestReplyParentMessageId: rankedReplies.parentMessageId,
        deletedAt: rankedReplies.deletedAt,
        createdAt: rankedReplies.createdAt,
        updatedAt: rankedReplies.updatedAt,
        userIdForProfile: rankedReplies.userIdForProfile,
        userFirstName: rankedReplies.userFirstName,
        userLastName: rankedReplies.userLastName,
        userAvatarReference: rankedReplies.userAvatarReference,
      })
      .from(replyCounts)
      .innerJoin(
        rankedReplies,
        and(
          eq(rankedReplies.parentMessageId, replyCounts.parentMessageId),
          eq(rankedReplies.replyRank, 1),
        ),
      );

    return rows.map((row) => ({
      parentMessageId: row.parentMessageId as UUIDType,
      replyCount: Number(row.replyCount),
      latestReply: {
        id: row.id,
        threadId: row.threadId,
        courseId: row.courseId,
        userId: row.userId,
        content: row.content,
        parentMessageId: row.latestReplyParentMessageId,
        deletedAt: row.deletedAt,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        userIdForProfile: row.userIdForProfile,
        userFirstName: row.userFirstName,
        userLastName: row.userLastName,
        userAvatarReference: row.userAvatarReference,
      },
    }));
  }

  async getReplyParticipants(
    parentMessageIds: UUIDType[],
    limitPerMessage = 3,
  ): Promise<CourseChatReplyParticipantRow[]> {
    if (!parentMessageIds.length) return [];

    const parentIds = sql.join(
      parentMessageIds.map((parentMessageId) => sql`${parentMessageId}`),
      sql`, `,
    );

    return this.db.execute(sql<CourseChatReplyParticipantRow>`
      WITH ranked_participants AS (
        SELECT
          m.parent_message_id AS "parentMessageId",
          u.id AS "id",
          u.first_name AS "firstName",
          u.last_name AS "lastName",
          u.avatar_reference AS "avatarReference",
          ROW_NUMBER() OVER (
            PARTITION BY m.parent_message_id
            ORDER BY MAX(m.created_at) DESC
          ) AS participant_rank
        FROM course_chat_messages m
        INNER JOIN course_chat_threads t ON t.id = m.thread_id
        INNER JOIN users u ON u.id = m.user_id
        WHERE m.parent_message_id IN (${parentIds})
          AND t.archived = false
          AND m.deleted_at IS NULL
        GROUP BY m.parent_message_id, u.id, u.first_name, u.last_name, u.avatar_reference
      )
      SELECT
        "parentMessageId",
        "id",
        "firstName",
        "lastName",
        "avatarReference"
      FROM ranked_participants
      WHERE participant_rank <= ${limitPerMessage}
      ORDER BY "parentMessageId", participant_rank
    `);
  }

  async countReplies(parentMessageId: UUIDType): Promise<number> {
    const [summary] = await this.db
      .select({ totalItems: count() })
      .from(courseChatMessages)
      .where(
        and(
          eq(courseChatMessages.parentMessageId, parentMessageId),
          isNull(courseChatMessages.deletedAt),
        ),
      );

    return summary?.totalItems ?? 0;
  }

  async softDeleteMessage(messageId: UUIDType): Promise<string | null> {
    const [message] = await this.db.transaction(async (trx) => {
      await trx
        .delete(courseChatMessageReactions)
        .where(eq(courseChatMessageReactions.messageId, messageId));

      return trx
        .update(courseChatMessages)
        .set({ deletedAt: sql`CURRENT_TIMESTAMP` })
        .where(eq(courseChatMessages.id, messageId))
        .returning({ deletedAt: courseChatMessages.deletedAt });
    });

    return message?.deletedAt ?? null;
  }

  private messageSelect() {
    return {
      id: sql<UUIDType>`${courseChatMessages.id}`.as("id"),
      threadId: sql<UUIDType>`${courseChatMessages.threadId}`.as("threadId"),
      courseId: sql<UUIDType>`${courseChatMessages.courseId}`.as("courseId"),
      userId: sql<UUIDType>`${courseChatMessages.userId}`.as("userId"),
      content: sql<string>`${courseChatMessages.content}`.as("content"),
      parentMessageId: sql<UUIDType | null>`${courseChatMessages.parentMessageId}`.as(
        "parentMessageId",
      ),
      deletedAt: sql<string | null>`${courseChatMessages.deletedAt}`.as("deletedAt"),
      createdAt: sql<string>`${courseChatMessages.createdAt}`.as("createdAt"),
      updatedAt: sql<string>`${courseChatMessages.updatedAt}`.as("updatedAt"),
      userIdForProfile: sql<UUIDType>`${users.id}`.as("userIdForProfile"),
      userFirstName: sql<string>`${users.firstName}`.as("userFirstName"),
      userLastName: sql<string>`${users.lastName}`.as("userLastName"),
      userAvatarReference: sql<string | null>`${users.avatarReference}`.as("userAvatarReference"),
    };
  }

  private visibleTopLevelMessageCondition() {
    return or(
      isNull(courseChatMessages.deletedAt),
      sql<boolean>`EXISTS (
        SELECT 1
        FROM course_chat_messages replies
        WHERE replies.parent_message_id = course_chat_messages.id
          AND replies.deleted_at IS NULL
      )`,
    );
  }

  private async createTopLevelMessage(
    params: {
      courseId: UUIDType;
      userId: UUIDType;
      content: string;
    },
    db: DatabasePg,
  ) {
    const [thread] = await db
      .insert(courseChatThreads)
      .values({ courseId: params.courseId, createdByUserId: params.userId })
      .returning({ id: courseChatThreads.id });

    const [message] = await db
      .insert(courseChatMessages)
      .values({
        threadId: thread.id,
        courseId: params.courseId,
        userId: params.userId,
        content: params.content,
      })
      .returning({ id: courseChatMessages.id });

    return { threadId: thread.id, messageId: message.id };
  }
}
