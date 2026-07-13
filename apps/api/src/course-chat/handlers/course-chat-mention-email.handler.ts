import { Inject, Injectable } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";
import { BaseEmailTemplate } from "@repo/email-templates";
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
import { getEmailSubject } from "src/common/emails/translations";
import { resolveTenantOrigin } from "src/common/helpers/resolveTenantOrigin";
import { processInBatches } from "src/common/utils/processInBatches";
import {
  getCourseChatMentionEmailButtonText,
  getCourseChatMentionEmailHeading,
  getCourseChatMentionEmailParagraphs,
} from "src/course-chat/course-chat-email.translations";
import { CourseChatRepository } from "src/course-chat/course-chat.repository";
import { CourseService } from "src/courses/course.service";
import { CourseChatUserMentionedEvent } from "src/events/course-chat/course-chat-user-mentioned.event";
import { DB_ADMIN } from "src/storage/db/db.providers";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import { UserService } from "src/user/user.service";

import { GetLocalizedUserMentionContentAnnouncement } from "../chat-mention-localizations/chat-mention-content-localization";
import { GetLocalizedUserMentionTitleAnnouncement } from "../chat-mention-localizations/chat-mention-title-localization";

type CourseChatMentionEmailEventType = CourseChatUserMentionedEvent;

const CourseChatMentionEmailEvents = [CourseChatUserMentionedEvent] as const;

@Injectable()
@EventsHandler(...CourseChatMentionEmailEvents)
export class CourseChatMentionEmailHandler
  implements IEventHandler<CourseChatMentionEmailEventType>
{
  constructor(
    private readonly courseChatRepository: CourseChatRepository,
    private readonly announcementRepository: AnnouncementsRepository,
    private readonly emailService: EmailService,
    private readonly userService: UserService,
    private readonly courseService: CourseService,
    private readonly tenantRunner: TenantDbRunnerService,
    @Inject(DB_ADMIN) private readonly dbAdmin: DatabasePg,
  ) {}

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

    await this.tenantRunner.runWithTenant(tenantId, async () => {
      const [message, recipients, tenantOrigin] = await Promise.all([
        this.courseChatRepository.getMessageById(messageId),
        this.courseChatRepository.getMentionEmailRecipients(courseId, uniqueMentionedUserIds),
        resolveTenantOrigin(this.dbAdmin, tenantId),
      ]);

      const mentioningUser = await this.userService.getUserById(currentUser.userId);
      const mentioningUserFullName = mentioningUser.firstName + " " + mentioningUser.lastName;
      const courseData = await this.courseService.getCourseEmailData(courseId);

      await this.announcementRepository.createAnnouncement({
        groupId: null,
        title: GetLocalizedUserMentionTitleAnnouncement(mentioningUserFullName),
        content: GetLocalizedUserMentionContentAnnouncement(courseData.courseName),
        baseLanguage: SUPPORTED_LANGUAGES.EN,
        availableLocales: [...Object.values(SUPPORTED_LANGUAGES)],
        authorId: currentUser.userId,
        status: ANNOUNCEMENT_STATUSES.PUBLISHED,
        scheduledAt: null,
        publishedAt: null,
        sendEmail: false,
        emailTemplate: ANNOUNCEMENT_EMAIL_TEMPLATES.DEFAULT,
        sourceType: ANNOUNCEMENT_SOURCE_TYPES.COURSE_CHAT,
        sourceId: null,
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

          const authorName = `${message.userFirstName} ${message.userLastName}`;
          const { text, html } = new BaseEmailTemplate({
            heading: getCourseChatMentionEmailHeading(defaultEmailSettings.language),
            paragraphs: getCourseChatMentionEmailParagraphs(defaultEmailSettings.language, {
              recipientName: recipient.firstName,
              authorName,
              courseName: courseContext.title,
              messageContent: message.content,
            }),
            buttonText: getCourseChatMentionEmailButtonText(defaultEmailSettings.language),
            buttonLink: `${tenantOrigin}/course/${courseId}?tab=Discussion`,
            ...defaultEmailSettings,
          });

          await this.emailService.sendEmailWithLogo(
            {
              to: recipient.email,
              subject: getEmailSubject("courseChatMentionEmail", defaultEmailSettings.language, {
                courseName: courseContext.title,
              }),
              text,
              html,
            },
            { tenantId },
          );
        },
        { batchSize: EMAIL_BATCH_SIZE, throwOnError: false },
      );
    });
  }
}
