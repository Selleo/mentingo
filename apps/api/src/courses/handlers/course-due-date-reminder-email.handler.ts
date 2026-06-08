import { Logger } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";
import {
  CourseDueDateReminderEmail,
  getCourseDueDateReminderEmailTranslations,
} from "@repo/email-templates";
import {
  ANNOUNCEMENT_EMAIL_TEMPLATES,
  ANNOUNCEMENT_SOURCE_TYPES,
  ANNOUNCEMENT_STATUSES,
} from "@repo/shared";
import { format } from "date-fns";

import { AnnouncementsRepository } from "src/announcements/announcements.repository";
import { EmailService } from "src/common/emails/emails.service";
import { getEmailSubject } from "src/common/emails/translations";
import { processInBatches } from "src/common/utils/processInBatches";
import { AnnouncementPublishedEvent, CourseDueDateReminderEmailEvent } from "src/events";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { COURSE_DUE_DATE_REMINDER_EMAIL_BATCH_SIZE } from "../constants/course-due-date-reminders.constants";

import type { CourseDueDateReminderRecipient } from "../types/course-due-date-reminder.types";

@EventsHandler(CourseDueDateReminderEmailEvent)
export class CourseDueDateReminderEmailHandler
  implements IEventHandler<CourseDueDateReminderEmailEvent>
{
  private readonly logger = new Logger(CourseDueDateReminderEmailHandler.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly announcementsRepository: AnnouncementsRepository,
    private readonly outboxPublisher: OutboxPublisher,
    private readonly tenantRunner: TenantDbRunnerService,
  ) {}

  async handle(event: CourseDueDateReminderEmailEvent) {
    const { recipients } = event.courseDueDateReminderEmailData;

    await processInBatches(recipients, (recipient) => this.sendCourseDueDateReminder(recipient), {
      batchSize: COURSE_DUE_DATE_REMINDER_EMAIL_BATCH_SIZE,
      throwOnError: false,
      onItemError: (error, recipient) => {
        const reason = error instanceof Error ? error.stack : String(error);

        this.logger.error(
          `Course due date reminder failed for student ${recipient.studentId} and course ${recipient.courseId}`,
          reason,
        );
      },
    });
  }

  private async sendCourseDueDateReminder(recipient: CourseDueDateReminderRecipient) {
    await this.sendCourseDueDateReminderEmail(recipient);
    await this.createCourseDueDateReminderAnnouncement(recipient);
  }

  private async sendCourseDueDateReminderEmail(recipient: CourseDueDateReminderRecipient) {
    const formattedDueDate = format(new Date(recipient.dueDate), "dd.MM.yyyy");

    const { text, html } = new CourseDueDateReminderEmail({
      courseName: recipient.courseName,
      courseLink: `${recipient.tenantHost.replace(/\/$/, "")}/course/${recipient.courseId}`,
      dueDate: formattedDueDate,
      daysBeforeDueDate: recipient.daysBeforeDueDate,
      ...recipient.defaultEmailSettings,
    });

    await this.emailService.sendEmailWithLogo(
      {
        to: recipient.studentEmail,
        subject: getEmailSubject(
          "courseDueDateReminderEmail",
          recipient.defaultEmailSettings.language,
          { courseName: recipient.courseName },
        ),
        text,
        html,
      },
      { tenantId: recipient.tenantId },
    );
  }

  private async createCourseDueDateReminderAnnouncement(recipient: CourseDueDateReminderRecipient) {
    const { language } = recipient.defaultEmailSettings;

    const { heading, paragraphs } = getCourseDueDateReminderEmailTranslations(
      language,
      recipient.courseName,
      "",
      recipient.daysBeforeDueDate,
    );

    await this.tenantRunner.runWithTenant(recipient.tenantId, async () => {
      const announcement = await this.announcementsRepository.createAnnouncement({
        groupId: null,
        title: { [language]: heading },
        content: { [language]: paragraphs.join("\n") },
        baseLanguage: language,
        availableLocales: [language],
        authorId: recipient.courseAuthorId,
        status: ANNOUNCEMENT_STATUSES.PUBLISHED,
        scheduledAt: null,
        publishedAt: new Date().toISOString(),
        sendEmail: false,
        emailTemplate: ANNOUNCEMENT_EMAIL_TEMPLATES.DEFAULT,
        sourceType: ANNOUNCEMENT_SOURCE_TYPES.COURSE_DUE_DATE_REMINDER,
        sourceId: recipient.courseId,
      });

      await this.announcementsRepository.createUserAnnouncementRecords(
        [recipient.studentId],
        announcement.id,
      );

      await this.outboxPublisher.publish(
        new AnnouncementPublishedEvent({ announcementId: announcement.id }),
      );
    });
  }
}
