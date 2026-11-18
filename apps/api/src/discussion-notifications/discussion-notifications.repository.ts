import { Inject, Injectable } from "@nestjs/common";
import { and, asc, desc, eq, inArray, isNotNull, isNull, lt, lte, ne, sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import {
  announcements,
  courseChatMessages,
  courseChatThreads,
  discussionReplyDigests,
  userAnnouncements,
  users,
} from "src/storage/schema";

import type { UUIDType } from "src/common";
import type {
  DiscussionDigestRecipient,
  DiscussionDigestThread,
  DiscussionReplyDigest,
} from "src/discussion-notifications/discussion-notifications.types";

@Injectable()
export class DiscussionNotificationsRepository {
  constructor(@Inject("DB") private readonly db: DatabasePg) {}

  async findEarlierParticipantIds(threadId: UUIDType, replyId: UUIDType): Promise<UUIDType[]> {
    const replyCreatedAt = this.db
      .select({ createdAt: courseChatMessages.createdAt })
      .from(courseChatMessages)
      .where(eq(courseChatMessages.id, replyId));

    const participants = await this.db
      .selectDistinct({ userId: courseChatMessages.userId })
      .from(courseChatMessages)
      .where(
        and(
          eq(courseChatMessages.threadId, threadId),
          isNull(courseChatMessages.deletedAt),
          lt(courseChatMessages.createdAt, sql`(${replyCreatedAt})`),
        ),
      );

    return participants.map(({ userId }) => userId);
  }

  async queueReplyDigests(params: {
    userIds: UUIDType[];
    threadId: UUIDType;
    announcementId: UUIDType;
    sendAfter: string;
  }) {
    const { userIds, threadId, announcementId, sendAfter } = params;

    await this.db
      .insert(discussionReplyDigests)
      .values(
        userIds.map((userId) => ({
          userId,
          threadId,
          sendAfter,
          announcementIds: [announcementId],
        })),
      )
      .onConflictDoUpdate({
        target: [discussionReplyDigests.userId, discussionReplyDigests.threadId],
        set: {
          announcementIds: sql`${discussionReplyDigests.announcementIds} || excluded.announcement_ids`,
        },
      });
  }

  async claimDueDigests(
    now: Date,
    limit: number,
    transaction: DatabasePg,
  ): Promise<DiscussionReplyDigest[]> {
    return transaction
      .select({
        id: discussionReplyDigests.id,
        userId: discussionReplyDigests.userId,
        threadId: discussionReplyDigests.threadId,
        announcementIds: discussionReplyDigests.announcementIds,
      })
      .from(discussionReplyDigests)
      .where(lte(discussionReplyDigests.sendAfter, now.toISOString()))
      .orderBy(asc(discussionReplyDigests.sendAfter))
      .limit(limit)
      .for("update", { skipLocked: true });
  }

  async deleteDigests(digestIds: UUIDType[], transaction: DatabasePg) {
    await transaction
      .delete(discussionReplyDigests)
      .where(inArray(discussionReplyDigests.id, digestIds));
  }

  async findDigestThread(threadId: UUIDType): Promise<DiscussionDigestThread | null> {
    const [thread] = await this.db
      .select({
        scope: courseChatThreads.scope,
        courseId: courseChatThreads.courseId,
        title: courseChatThreads.title,
        firstMessageId: courseChatMessages.id,
      })
      .from(courseChatThreads)
      .innerJoin(
        courseChatMessages,
        and(
          eq(courseChatMessages.threadId, courseChatThreads.id),
          isNull(courseChatMessages.parentMessageId),
        ),
      )
      .where(and(eq(courseChatThreads.id, threadId), eq(courseChatThreads.archived, false)))
      .limit(1);

    return thread ?? null;
  }

  async findDigestRecipient(userId: UUIDType): Promise<DiscussionDigestRecipient | null> {
    const [recipient] = await this.db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(users)
      .where(and(eq(users.id, userId), isNull(users.deletedAt), eq(users.archived, false)))
      .limit(1);

    return recipient ?? null;
  }

  async findUnreadReplyAuthorNames(
    userId: UUIDType,
    announcementIds: UUIDType[],
  ): Promise<string[]> {
    if (!announcementIds.length) return [];

    const unreadReplies = await this.db
      .select({ firstName: users.firstName, lastName: users.lastName })
      .from(userAnnouncements)
      .innerJoin(announcements, eq(announcements.id, userAnnouncements.announcementId))
      .innerJoin(users, eq(users.id, announcements.authorId))
      .where(
        and(
          eq(userAnnouncements.userId, userId),
          eq(userAnnouncements.isRead, false),
          inArray(userAnnouncements.announcementId, announcementIds),
          isNull(announcements.deletedAt),
        ),
      )
      .orderBy(asc(announcements.createdAt));

    return unreadReplies.map(({ firstName, lastName }) => `${firstName} ${lastName}`);
  }

  async findLatestReplyContent(threadId: UUIDType, recipientId: UUIDType): Promise<string | null> {
    const [latestReply] = await this.db
      .select({ content: courseChatMessages.content })
      .from(courseChatMessages)
      .where(
        and(
          eq(courseChatMessages.threadId, threadId),
          isNotNull(courseChatMessages.parentMessageId),
          isNull(courseChatMessages.deletedAt),
          ne(courseChatMessages.userId, recipientId),
        ),
      )
      .orderBy(desc(courseChatMessages.createdAt))
      .limit(1);

    return latestReply?.content ?? null;
  }
}
