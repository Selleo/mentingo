import { Inject, Injectable } from "@nestjs/common";
import { EMAIL_TEMPLATE_EVENTS } from "@repo/email-templates";
import { SUPPORTED_LANGUAGES, isSupportedLanguage } from "@repo/shared";

import { DatabasePg } from "src/common";
import { EMAIL_BATCH_SIZE } from "src/common/emails/email.constants";
import { resolveTenantOrigin } from "src/common/helpers/resolveTenantOrigin";
import { processInBatches } from "src/common/utils/processInBatches";
import { ForumUserMentionedEvent } from "src/events/forum/forum-user-mentioned.event";
import { getForumTopicPath } from "src/forum/forum.constants";
import { ForumRepository } from "src/forum/forum.repository";
import { NotificationCollectorService } from "src/notifications/services/notification-collector.service";
import { OutboxEventsHandler } from "src/outbox/outbox.decorators";
import { DB_ADMIN } from "src/storage/db/db.providers";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import type { OutboxDeliveryContext, OutboxEventsHandlerOf } from "src/outbox/outbox.types";

@Injectable()
@OutboxEventsHandler(ForumUserMentionedEvent)
export class ForumMentionEmailHandler implements OutboxEventsHandlerOf<ForumUserMentionedEvent> {
  constructor(
    private readonly forumRepository: ForumRepository,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
    private readonly notificationCollectorService: NotificationCollectorService,
    @Inject(DB_ADMIN) private readonly dbAdmin: DatabasePg,
  ) {}

  async handleOutboxEvent(event: ForumUserMentionedEvent, { eventId }: OutboxDeliveryContext) {
    await this.notificationCollectorService.publishCollectedNotifications(eventId, () =>
      this.captureMentionEmails(event),
    );
  }

  private async captureMentionEmails(event: ForumUserMentionedEvent) {
    const { tenantId, topicId, postId, actorUserId, mentionedUserIds } =
      event.forumUserMentionedData;

    if (!mentionedUserIds.length) return;

    await this.tenantDbRunnerService.runWithTenant(tenantId, async () => {
      const [topicTitle, authorFullName, post, mentionedUsers] = await Promise.all([
        this.forumRepository.findTopicTitle(topicId),
        this.forumRepository.findUserFullName(actorUserId),
        this.forumRepository.findPostById(postId),
        this.forumRepository.findEmailRecipients(mentionedUserIds),
      ]);

      const recipients = mentionedUsers.filter((user) => user.mentionEmailsEnabled);

      if (!topicTitle || !authorFullName || !post || post.deletedAt || !recipients.length) return;

      const tenantOrigin = await resolveTenantOrigin(this.dbAdmin, tenantId);

      await processInBatches(
        recipients,
        (recipient) =>
          this.notificationCollectorService.captureNotificationRecipient(
            { to: recipient.email },
            {
              tenantId,
              template: {
                event: EMAIL_TEMPLATE_EVENTS.FORUM_MENTION,
                language:
                  recipient.language && isSupportedLanguage(recipient.language)
                    ? recipient.language
                    : SUPPORTED_LANGUAGES.EN,
                variables: {
                  userEmail: recipient.email,
                  userFirstName: recipient.firstName,
                  userLastName: recipient.lastName,
                  authorFullName,
                  topic_title: topicTitle,
                  message: post.content,
                  topic_link: `${tenantOrigin}${getForumTopicPath(topicId)}`,
                },
              },
            },
          ),
        { batchSize: EMAIL_BATCH_SIZE, throwOnError: true },
      );
    });
  }
}
