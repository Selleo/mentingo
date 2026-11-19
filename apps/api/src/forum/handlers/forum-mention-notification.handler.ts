import { Injectable } from "@nestjs/common";
import {
  ANNOUNCEMENT_EMAIL_TEMPLATES,
  ANNOUNCEMENT_SOURCE_TYPES,
  ANNOUNCEMENT_STATUSES,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";

import { AnnouncementsRepository } from "src/announcements/announcements.repository";
import { getLocalizedUserMentionTitleAnnouncement } from "src/course-chat/chat-mention-localizations/chat-mention-title-localization";
import { UserNotificationsCreatedEvent } from "src/events/announcement/user-notifications-created.event";
import { ForumUserMentionedEvent } from "src/events/forum/forum-user-mentioned.event";
import { getLocalizedForumMentionContentAnnouncement } from "src/forum/forum-mention.localizations";
import { ForumRepository } from "src/forum/forum.repository";
import { OutboxEventsHandler } from "src/outbox/outbox.decorators";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import type { OutboxEventsHandlerOf } from "src/outbox/outbox.types";

@Injectable()
@OutboxEventsHandler(ForumUserMentionedEvent)
export class ForumMentionNotificationHandler
  implements OutboxEventsHandlerOf<ForumUserMentionedEvent>
{
  constructor(
    private readonly forumRepository: ForumRepository,
    private readonly announcementsRepository: AnnouncementsRepository,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
    private readonly outboxPublisher: OutboxPublisher,
  ) {}

  async handleOutboxEvent(event: ForumUserMentionedEvent) {
    const { tenantId, topicId, actorUserId, mentionedUserIds } = event.forumUserMentionedData;

    if (!mentionedUserIds.length) return;

    await this.tenantDbRunnerService.runWithTenant(tenantId, async () => {
      const [topicTitle, authorFullName] = await Promise.all([
        this.forumRepository.findTopicTitle(topicId),
        this.forumRepository.findUserFullName(actorUserId),
      ]);

      if (!topicTitle || !authorFullName) return;

      await this.announcementsRepository.createAnnouncement({
        groupId: null,
        title: getLocalizedUserMentionTitleAnnouncement(authorFullName),
        content: getLocalizedForumMentionContentAnnouncement(topicTitle),
        baseLanguage: SUPPORTED_LANGUAGES.EN,
        availableLocales: [...Object.values(SUPPORTED_LANGUAGES)],
        authorId: actorUserId,
        status: ANNOUNCEMENT_STATUSES.PUBLISHED,
        scheduledAt: null,
        publishedAt: null,
        sendEmail: false,
        emailTemplate: ANNOUNCEMENT_EMAIL_TEMPLATES.DEFAULT,
        sourceType: ANNOUNCEMENT_SOURCE_TYPES.FORUM,
        sourceId: topicId,
        usersToNotify: mentionedUserIds,
      });
      await this.outboxPublisher.publish(
        new UserNotificationsCreatedEvent({ userIds: mentionedUserIds }),
      );
    });
  }
}
