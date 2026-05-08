import { Injectable } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";
import { BaseEmailTemplate } from "@repo/email-templates";

import { EmailService } from "src/common/emails/emails.service";
import { getEmailSubject } from "src/common/emails/translations";
import {
  getCourseChatMentionEmailButtonText,
  getCourseChatMentionEmailHeading,
  getCourseChatMentionEmailParagraphs,
} from "src/course-chat/course-chat-email.translations";
import { CourseChatRepository } from "src/course-chat/course-chat.repository";
import { CourseChatUserMentionedEvent } from "src/events/course-chat/course-chat-user-mentioned.event";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

type CourseChatMentionEmailEventType = CourseChatUserMentionedEvent;

const CourseChatMentionEmailEvents = [CourseChatUserMentionedEvent] as const;

@Injectable()
@EventsHandler(...CourseChatMentionEmailEvents)
export class CourseChatMentionEmailHandler
  implements IEventHandler<CourseChatMentionEmailEventType>
{
  constructor(
    private readonly courseChatRepository: CourseChatRepository,
    private readonly emailService: EmailService,
    private readonly tenantRunner: TenantDbRunnerService,
  ) {}

  async handle(event: CourseChatMentionEmailEventType) {
    if (event instanceof CourseChatUserMentionedEvent) {
      return await this.handleUserMentioned(event);
    }
  }

  private async handleUserMentioned(event: CourseChatUserMentionedEvent) {
    const { courseId, actorUserId, messageId, mentionedUserIds } =
      event.courseChatUserMentionedData;
    const uniqueMentionedUserIds = Array.from(new Set(mentionedUserIds)).filter(
      (mentionedUserId) => mentionedUserId !== actorUserId,
    );

    if (!uniqueMentionedUserIds.length) return;

    const [message, recipients] = await Promise.all([
      this.courseChatRepository.getMessageById(messageId),
      this.courseChatRepository.getMentionEmailRecipients(courseId, uniqueMentionedUserIds),
    ]);

    if (!message || !recipients.length) return;

    await Promise.allSettled(
      recipients.map((recipient) =>
        this.tenantRunner.runWithTenant(recipient.tenantId, async () => {
          const defaultEmailSettings = await this.emailService.getDefaultEmailProperties(
            recipient.tenantId,
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
            buttonLink: `${process.env.CORS_ORIGIN}/course/${courseId}?tab=Discussion`,
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
            { tenantId: recipient.tenantId },
          );
        }),
      ),
    );
  }
}
