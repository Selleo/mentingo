import { Inject, Injectable } from "@nestjs/common";
import { DISCUSSION_NOTIFICATION_PREFERENCES } from "@repo/shared";
import { and, asc, eq, inArray, isNull, lte, sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { isNotificationPreferenceEnabled } from "src/settings/utils/notification-preference.sql";
import {
  announcements,
  courseChatMessages,
  courseChatThreads,
  discussionReplyDigests,
  discussionThreadFollowers,
  settings,
  userAnnouncements,
  users,
} from "src/storage/schema";

import type { UUIDType } from "src/common";
import type {
  DiscussionDigestReply,
  DiscussionDigestThread,
  DiscussionReplyDigest,
  DiscussionReplyDigestEntry,
  DiscussionReplyPreferences,
} from "src/discussion-notifications/discussion-notifications.types";

@Injectable()
export class DiscussionNotificationsRepository {
  constructor(@Inject("DB") private readonly db: DatabasePg) {}

  async findFollowerIds(threadId: UUIDType, replyId: UUIDType): Promise<UUIDType[]> {
    const replyCreatedAt = this.db
      .select({ createdAt: courseChatMessages.createdAt })
      .from(courseChatMessages)
      .where(eq(courseChatMessages.id, replyId));

    const followers = await this.db
      .select({ userId: discussionThreadFollowers.userId })
      .from(discussionThreadFollowers)
      .where(
        and(
          eq(discussionThreadFollowers.threadId, threadId),
          lte(discussionThreadFollowers.createdAt, sql`(${replyCreatedAt})`),
        ),
      );

    return followers.map(({ userId }) => userId);
  }

  async findReplyPreferences(userIds: UUIDType[]): Promise<DiscussionReplyPreferences[]> {
    if (!userIds.length) return [];

    return this.db
      .select({
        userId: users.id,
        inAppEnabled: isNotificationPreferenceEnabled(
          DISCUSSION_NOTIFICATION_PREFERENCES.REPLY_IN_APP,
        ),
        emailsEnabled: isNotificationPreferenceEnabled(
          DISCUSSION_NOTIFICATION_PREFERENCES.REPLY_EMAILS,
        ),
      })
      .from(users)
      .leftJoin(settings, eq(settings.userId, users.id))
      .where(inArray(users.id, userIds));
  }

  async queueReplyDigests(params: {
    recipients: { userId: UUIDType; reply: DiscussionReplyDigestEntry }[];
    threadId: UUIDType;
    sendAfter: string;
  }) {
    const { recipients, threadId, sendAfter } = params;

    if (!recipients.length) return;

    await this.db
      .insert(discussionReplyDigests)
      .values(
        recipients.map(({ userId, reply }) => ({ userId, threadId, sendAfter, replies: [reply] })),
      )
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
