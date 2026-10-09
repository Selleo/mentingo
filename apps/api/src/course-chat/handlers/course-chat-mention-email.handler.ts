import { Injectable, Inject } from "@nestjs/common";
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
import { CourseChatRepository } from "src/course-chat/course-chat.repository";
import { CourseChatUserMentionedEvent } from "src/events/course-chat/course-chat-user-mentioned.event";
import { NotificationCollectorService } from "src/notifications/services/notification-collector.service";
import { OutboxNotificationPreparationService } from "src/outbox/outbox-notification-preparation.service";
import { DB_ADMIN } from "src/storage/db/db.providers";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import { UserService } from "src/user/user.service";

import { getLocalizedUserMentionContentAnnouncement } from "../chat-mention-localizations/chat-mention-content-localization";
import { getLocalizedUserMentionTitleAnnouncement } from "../chat-mention-localizations/chat-mention-title-localization";

import type { IEventHandler } from "@nestjs/cqrs";

type CourseChatMentionEmailEventType = CourseChatUserMentionedEvent;

@Injectable()
export class CourseChatMentionEmailHandler
  implements IEventHandler<CourseChatMentionEmailEventType>
{
  constructor(
    private readonly courseChatRepository: CourseChatRepository,
    private readonly announcementRepository: AnnouncementsRepository,
    private readonly emailService: EmailService,
    private readonly userService: UserService,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
    @Inject(DB_ADMIN) private readonly dbAdmin: DatabasePg,
    private readonly notificationCollectorService: NotificationCollectorService,
    private readonly outboxNotificationPreparationService: OutboxNotificationPreparationService,
  ) {}

  onModuleInit() {
    this.outboxNotificationPreparationService.register(async (event) => {
      if (!(event instanceof CourseChatUserMentionedEvent)) {
        return [];
      }

      return this.notificationCollectorService.collectNotificationEvents(() => this.handle(event));
    });
  }

  async handle(event: CourseChatMentionEmailEventType) {
    if (event instanceof CourseChatUserMentionedEvent) {
      return await this.handleUserMentioned(event);
    }
  }

  private async handleUserMentioned(event: CourseChatUserMentionedEvent) {
    const { tenantId, courseId, currentUser, messageId, mentionedUserIds } =
      event.courseChatUserMentionedData;
    const uniqueMentionedUserIds = Array.from(new Set(mentionedUserIds)).filter(
      (mentionedUserId) => mentionedUserId !== currentUser.userId,
    );
    if (!uniqueMentionedUserIds.length) return;

    await this.tenantDbRunnerService.runWithTenant(tenantId, async () => {
      const [message, recipients, tenantOrigin, localizedCourseTitles] = await Promise.all([
        this.courseChatRepository.getMessageById(messageId),
        this.courseChatRepository.getMentionEmailRecipients(courseId, uniqueMentionedUserIds),
        resolveTenantOrigin(this.dbAdmin, tenantId),
        this.courseChatRepository.getLocalizedCourseTitles(courseId),
      ]);

      if (!localizedCourseTitles) return;

      const mentioningUser = await this.userService.getUserById(currentUser.userId);
      const mentioningUserFullName = mentioningUser.firstName + " " + mentioningUser.lastName;

      await this.announcementRepository.createAnnouncement({
        groupId: null,
        title: getLocalizedUserMentionTitleAnnouncement(mentioningUserFullName),
        content: getLocalizedUserMentionContentAnnouncement(localizedCourseTitles),
        baseLanguage: SUPPORTED_LANGUAGES.EN,
        availableLocales: [...Object.values(SUPPORTED_LANGUAGES)],
        authorId: currentUser.userId,
        status: ANNOUNCEMENT_STATUSES.PUBLISHED,
        scheduledAt: null,
        publishedAt: null,
        sendEmail: false,
        emailTemplate: ANNOUNCEMENT_EMAIL_TEMPLATES.DEFAULT,
        sourceType: ANNOUNCEMENT_SOURCE_TYPES.COURSE_CHAT,
        sourceId: courseId,
        usersToNotify: uniqueMentionedUserIds,
      });

      if (!message || !recipients.length) return;

      await processInBatches(
        recipients,
        async (recipient) => {
          const defaultEmailSettings = await this.emailService.getDefaultEmailProperties(
            tenantId,
            recipient.id,
          );
          const courseContext = await this.courseChatRepository.getCourseEmailContext(
            courseId,
            defaultEmailSettings.language,
          );

          if (!courseContext) return;

          await this.notificationCollectorService.captureNotificationRecipient(
            { to: recipient.email },
            {
              tenantId,
              template: {
                event: EMAIL_TEMPLATE_EVENTS.COURSE_CHAT_MENTION,
                language: defaultEmailSettings.language,
                variables: {
                  userEmail: recipient.email,
                  userFirstName: recipient.firstName,
                  userLastName: recipient.lastName ?? "",
                  authorFullName: mentioningUserFullName,
                  course_name: courseContext.title,
                  message: message.content,
                  course_link: `${tenantOrigin}/course/${courseId}?tab=Discussion`,
                },
              },
            },
          );
        },
        { batchSize: EMAIL_BATCH_SIZE, throwOnError: true },
      );
    });
  }
}
