import { Inject, Injectable } from "@nestjs/common";
import {
  ANNOUNCEMENT_EMAIL_TEMPLATES,
  ANNOUNCEMENT_STATUSES,
  NOTIFICATION_SOCKET_EVENTS,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";

import { AnnouncementsRepository } from "src/announcements/announcements.repository";
import { DiscussionNotificationsRepository } from "src/discussion-notifications/discussion-notifications.repository";
import { getLocalizedDiscussionReplyTitleAnnouncement } from "src/discussion-notifications/discussion-reply.localizations";
import { ForumRepository } from "src/forum/forum.repository";
import { REALTIME_PUBLISHER, type RealtimePublisher } from "src/websocket/realtime.publisher";
import { getUserRoomName } from "src/websocket/websocket.rooms";

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
    @Inject(REALTIME_PUBLISHER) private readonly realtimePublisher: RealtimePublisher,
  ) {}

  async notifyParticipants(reply: DiscussionReply, filterRecipients: DiscussionRecipientFilter) {
    const notNotified = new Set(reply.mentionedUserIds).add(reply.actorUserId);
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

    for (const recipientId of recipientIds) {
      this.realtimePublisher.emitToRoom(
        NOTIFICATION_SOCKET_EVENTS.CREATED,
        getUserRoomName(recipientId),
        {},
      );
    }
  }
}
