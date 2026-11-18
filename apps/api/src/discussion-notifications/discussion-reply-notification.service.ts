import { Injectable } from "@nestjs/common";
import {
  ANNOUNCEMENT_EMAIL_TEMPLATES,
  ANNOUNCEMENT_STATUSES,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";
import { addMinutes } from "date-fns";

import { AnnouncementsRepository } from "src/announcements/announcements.repository";
import { DISCUSSION_REPLY_DIGEST_DELAY_MINUTES } from "src/discussion-notifications/discussion-notifications.constants";
import { DiscussionNotificationsRepository } from "src/discussion-notifications/discussion-notifications.repository";
import { getLocalizedDiscussionReplyTitleAnnouncement } from "src/discussion-notifications/discussion-reply.localizations";
import { UserNotificationsCreatedEvent } from "src/events/announcement/user-notifications-created.event";
import { ForumRepository } from "src/forum/forum.repository";
import { OutboxPublisher } from "src/outbox/outbox.publisher";

import type { UUIDType } from "src/common";
import type {
  DiscussionRecipientFilter,
  DiscussionReply,
} from "src/discussion-notifications/discussion-notifications.types";

@Injectable()
export class DiscussionReplyNotificationService {
  constructor(
    private readonly discussionNotificationsRepository: DiscussionNotificationsRepository,
    private readonly announcementsRepository: AnnouncementsRepository,
    private readonly forumRepository: ForumRepository,
    private readonly outboxPublisher: OutboxPublisher,
  ) {}

  async notifyParticipants(reply: DiscussionReply, filterRecipients: DiscussionRecipientFilter) {
    const notNotified = new Set([...reply.mentionedUserIds, reply.actorUserId]);
    const followerIds = await this.discussionNotificationsRepository.findFollowerIds(
      reply.threadId,
      reply.replyId,
    );
    const recipientIds = await filterRecipients(
      followerIds.filter((followerId) => !notNotified.has(followerId)),
    );
    const preferences =
      await this.discussionNotificationsRepository.findReplyPreferences(recipientIds);
    const inAppRecipientIds = preferences
      .filter(({ inAppEnabled }) => inAppEnabled)
      .map(({ userId }) => userId);
    const emailRecipients = preferences.filter(({ emailsEnabled }) => emailsEnabled);

    if (!inAppRecipientIds.length && !emailRecipients.length) return;

    const actorFullName = await this.forumRepository.findUserFullName(reply.actorUserId);

    if (!actorFullName) return;

    const announcementId = inAppRecipientIds.length
      ? await this.createReplyAnnouncement(reply, actorFullName, inAppRecipientIds)
      : null;
    const sendAfter = addMinutes(new Date(), DISCUSSION_REPLY_DIGEST_DELAY_MINUTES).toISOString();
    const queueEmails = (inAppEnabled: boolean) =>
      this.discussionNotificationsRepository.queueReplyDigests({
        userIds: emailRecipients
          .filter((recipient) => recipient.inAppEnabled === inAppEnabled)
          .map(({ userId }) => userId),
        threadId: reply.threadId,
        reply: { replyId: reply.replyId, announcementId: inAppEnabled ? announcementId : null },
        sendAfter,
      });

    await queueEmails(true);
    await queueEmails(false);

    if (inAppRecipientIds.length) {
      await this.outboxPublisher.publish(
        new UserNotificationsCreatedEvent({ userIds: inAppRecipientIds }),
      );
    }
  }

  private async createReplyAnnouncement(
    reply: DiscussionReply,
    actorFullName: string,
    recipientIds: UUIDType[],
  ) {
    const announcement = await this.announcementsRepository.createAnnouncement({
      groupId: null,
      title: getLocalizedDiscussionReplyTitleAnnouncement(actorFullName),
      content: reply.content,
      baseLanguage: SUPPORTED_LANGUAGES.EN,
      availableLocales: [...Object.values(SUPPORTED_LANGUAGES)],
      authorId: reply.actorUserId,
      status: ANNOUNCEMENT_STATUSES.PUBLISHED,
      scheduledAt: null,
      publishedAt: null,
      sendEmail: false,
      emailTemplate: ANNOUNCEMENT_EMAIL_TEMPLATES.DEFAULT,
      sourceType: reply.sourceType,
      sourceId: reply.sourceId,
      linkPath: reply.linkPath,
      usersToNotify: recipientIds,
    });

    return announcement.id;
  }
}
