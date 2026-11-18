import { Inject, Injectable } from "@nestjs/common";
import { EMAIL_TEMPLATE_EVENTS } from "@repo/email-templates";
import {
  ANNOUNCEMENT_EMAIL_TEMPLATES,
  ANNOUNCEMENT_SOURCE_TYPES,
  ANNOUNCEMENT_STATUSES,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";

import { AnnouncementsRepository } from "src/announcements/announcements.repository";
import { DatabasePg } from "src/common";
import { EMAIL_BATCH_SIZE } from "src/common/emails/email.constants";
import { EmailService } from "src/common/emails/emails.service";
import { resolveTenantOrigin } from "src/common/helpers/resolveTenantOrigin";
import { processInBatches } from "src/common/utils/processInBatches";
import { getLocalizedUserMentionTitleAnnouncement } from "src/course-chat/chat-mention-localizations/chat-mention-title-localization";
import { UserNotificationsCreatedEvent } from "src/events/announcement/user-notifications-created.event";
import { ForumUserMentionedEvent } from "src/events/forum/forum-user-mentioned.event";
import { getLocalizedForumMentionContentAnnouncement } from "src/forum/forum-mention.localizations";
import { ForumRepository } from "src/forum/forum.repository";
import { NotificationCollectorService } from "src/notifications/services/notification-collector.service";
import { OutboxEventsHandler } from "src/outbox/outbox.decorators";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { DB_ADMIN } from "src/storage/db/db.providers";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import type { UUIDType } from "src/common";
import type { OutboxDeliveryContext, OutboxEventsHandlerOf } from "src/outbox/outbox.types";

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
    private readonly emailService: EmailService,
    private readonly notificationCollectorService: NotificationCollectorService,
    @Inject(DB_ADMIN) private readonly dbAdmin: DatabasePg,
  ) {}

  async handleOutboxEvent(event: ForumUserMentionedEvent, { eventId }: OutboxDeliveryContext) {
    await this.notificationCollectorService.publishCollectedNotifications(eventId, () =>
      this.notifyMentionedUsers(event),
    );
  }

  private async notifyMentionedUsers(event: ForumUserMentionedEvent) {
    const { tenantId, topicId, postId, actorUserId, mentionedUserIds } =
      event.forumUserMentionedData;

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
      await this.captureMentionEmails({
        tenantId,
        topicId,
        postId,
        topicTitle,
        authorFullName,
        mentionedUserIds,
      });
    });
  }

  private async captureMentionEmails(mention: {
    tenantId: UUIDType;
    topicId: UUIDType;
    postId: UUIDType;
    topicTitle: string;
    authorFullName: string;
    mentionedUserIds: UUIDType[];
  }) {
    const { tenantId, topicId, postId, topicTitle, authorFullName, mentionedUserIds } = mention;
    const [post, recipients, tenantOrigin] = await Promise.all([
      this.forumRepository.findPostById(postId),
      this.forumRepository.findMentionEmailRecipients(mentionedUserIds),
      resolveTenantOrigin(this.dbAdmin, tenantId),
    ]);

    if (!post || post.deletedAt || !recipients.length) return;

    await processInBatches(
      recipients,
      async (recipient) => {
        const { language } = await this.emailService.getDefaultEmailProperties(
          tenantId,
          recipient.id,
        );

        await this.notificationCollectorService.captureNotificationRecipient(
          { to: recipient.email },
          {
            tenantId,
            template: {
              event: EMAIL_TEMPLATE_EVENTS.FORUM_MENTION,
              language,
              variables: {
                userEmail: recipient.email,
                userFirstName: recipient.firstName,
                userLastName: recipient.lastName,
                authorFullName,
                topic_title: topicTitle,
                message: post.content,
                topic_link: `${tenantOrigin}/forum/topics/${topicId}`,
              },
            },
          },
        );
      },
      { batchSize: EMAIL_BATCH_SIZE, throwOnError: true },
    );
  }
}
