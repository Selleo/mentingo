import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, inArray, isNull, lte, ne, sql } from "drizzle-orm";

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
  DiscussionDigestReply,
  DiscussionDigestThread,
  DiscussionReplyDigest,
  DiscussionReplyDigestEntry,
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
          ne(courseChatMessages.id, replyId),
          lte(courseChatMessages.createdAt, sql`(${replyCreatedAt})`),
        ),
      );

    return participants.map(({ userId }) => userId);
  }

  async queueReplyDigests(params: {
    userIds: UUIDType[];
    threadId: UUIDType;
    reply: DiscussionReplyDigestEntry;
    sendAfter: string;
  }) {
    const { userIds, threadId, reply, sendAfter } = params;
    const replies = sql<DiscussionReplyDigestEntry[]>`${JSON.stringify([reply])}::text::jsonb`;

    await this.db
      .insert(discussionReplyDigests)
      .values(userIds.map((userId) => ({ userId, threadId, sendAfter, replies })))
      .onConflictDoUpdate({
        target: [discussionReplyDigests.userId, discussionReplyDigests.threadId],
        set: { replies: sql`${discussionReplyDigests.replies} || excluded.replies` },
      });
  }

  async findDueDigestIds(now: Date, limit: number): Promise<UUIDType[]> {
    const dueDigests = await this.db
      .select({ id: discussionReplyDigests.id })
      .from(discussionReplyDigests)
      .where(lte(discussionReplyDigests.sendAfter, now.toISOString()))
      .orderBy(asc(discussionReplyDigests.sendAfter))
      .limit(limit);

    return dueDigests.map(({ id }) => id);
  }

  async claimDueDigest(
    digestId: UUIDType,
    now: Date,
    transaction: DatabasePg,
  ): Promise<DiscussionReplyDigest | null> {
    const [digest] = await transaction
      .select({
        id: discussionReplyDigests.id,
        userId: discussionReplyDigests.userId,
        threadId: discussionReplyDigests.threadId,
        replies: discussionReplyDigests.replies,
      })
      .from(discussionReplyDigests)
      .where(
        and(
          eq(discussionReplyDigests.id, digestId),
          lte(discussionReplyDigests.sendAfter, now.toISOString()),
        ),
      )
      .for("update", { skipLocked: true });

    return digest ?? null;
  }

  async deleteDigest(digestId: UUIDType, transaction: DatabasePg) {
    await transaction.delete(discussionReplyDigests).where(eq(discussionReplyDigests.id, digestId));
  }

  async postponeDigest(digestId: UUIDType, sendAfter: Date) {
    await this.db
      .update(discussionReplyDigests)
      .set({ sendAfter: sendAfter.toISOString() })
      .where(eq(discussionReplyDigests.id, digestId));
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

  async findUnreadAnnouncementIds(
    userId: UUIDType,
    announcementIds: UUIDType[],
  ): Promise<UUIDType[]> {
    if (!announcementIds.length) return [];

    const unreadAnnouncements = await this.db
      .select({ announcementId: userAnnouncements.announcementId })
      .from(userAnnouncements)
      .innerJoin(announcements, eq(announcements.id, userAnnouncements.announcementId))
      .where(
        and(
          eq(userAnnouncements.userId, userId),
          eq(userAnnouncements.isRead, false),
          inArray(userAnnouncements.announcementId, announcementIds),
          isNull(announcements.deletedAt),
        ),
      );

    return unreadAnnouncements.map(({ announcementId }) => announcementId);
  }

  async findVisibleReplies(replyIds: UUIDType[]): Promise<DiscussionDigestReply[]> {
    if (!replyIds.length) return [];

    return this.db
      .select({
        authorFullName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
        content: courseChatMessages.content,
      })
      .from(courseChatMessages)
      .innerJoin(users, eq(users.id, courseChatMessages.userId))
      .where(and(inArray(courseChatMessages.id, replyIds), isNull(courseChatMessages.deletedAt)))
      .orderBy(asc(courseChatMessages.createdAt), asc(courseChatMessages.id));
  }
}
