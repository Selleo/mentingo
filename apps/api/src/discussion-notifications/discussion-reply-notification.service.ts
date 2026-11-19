import { Injectable } from "@nestjs/common";
import {
  ANNOUNCEMENT_EMAIL_TEMPLATES,
  ANNOUNCEMENT_STATUSES,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";

import { AnnouncementsRepository } from "src/announcements/announcements.repository";
import { DiscussionNotificationsRepository } from "src/discussion-notifications/discussion-notifications.repository";
import { getLocalizedDiscussionReplyTitleAnnouncement } from "src/discussion-notifications/discussion-reply.localizations";
import { UserNotificationsCreatedEvent } from "src/events/announcement/user-notifications-created.event";
import { ForumRepository } from "src/forum/forum.repository";
import { OutboxPublisher } from "src/outbox/outbox.publisher";

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
    const participantIds = await this.discussionNotificationsRepository.findThreadParticipantIds(
      reply.threadId,
    );
    const recipientIds = await filterRecipients(
      participantIds.filter((participantId) => !notNotified.has(participantId)),
    );

    if (!recipientIds.length) return;

    const actorFullName = await this.forumRepository.findUserFullName(reply.actorUserId);

    if (!actorFullName) return;

    await this.announcementsRepository.createAnnouncement({
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

    await this.outboxPublisher.publish(
      new UserNotificationsCreatedEvent({ userIds: recipientIds }),
    );
  }
}
