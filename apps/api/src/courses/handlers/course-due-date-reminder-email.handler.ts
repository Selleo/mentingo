import { Injectable, Logger } from "@nestjs/common";
import {
  EMAIL_TEMPLATE_EVENTS,
  getCourseDueDateReminderEmailTranslations,
} from "@repo/email-templates";
import {
  ANNOUNCEMENT_EMAIL_TEMPLATES,
  ANNOUNCEMENT_SOURCE_TYPES,
  ANNOUNCEMENT_STATUSES,
} from "@repo/shared";
import { format } from "date-fns";

import { AnnouncementsRepository } from "src/announcements/announcements.repository";
import { EMAIL_BATCH_SIZE } from "src/common/emails/email.constants";
import { EmailService } from "src/common/emails/emails.service";
import { processInBatches } from "src/common/utils/processInBatches";
import { AnnouncementPublishedEvent, CourseDueDateReminderEmailEvent } from "src/events";
import { NotificationCollectorService } from "src/notifications/services/notification-collector.service";
import { OutboxNotificationPreparationService } from "src/outbox/outbox-notification-preparation.service";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import type { CourseDueDateReminderRecipient } from "../types/course-due-date-reminder.types";
import type { IEventHandler } from "@nestjs/cqrs";

@Injectable()
export class CourseDueDateReminderEmailHandler
  implements IEventHandler<CourseDueDateReminderEmailEvent>
{
  private readonly logger = new Logger(CourseDueDateReminderEmailHandler.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly announcementsRepository: AnnouncementsRepository,
    private readonly outboxPublisher: OutboxPublisher,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
    private readonly notificationCollectorService: NotificationCollectorService,
    private readonly outboxNotificationPreparationService: OutboxNotificationPreparationService,
  ) {}

  onModuleInit() {
    this.outboxNotificationPreparationService.register(async (event) => {
      if (!(event instanceof CourseDueDateReminderEmailEvent)) {
        return [];
      }

      return this.notificationCollectorService.collectNotificationEvents(() => this.handle(event));
    });
  }

  async handle(event: CourseDueDateReminderEmailEvent) {
    const { recipients } = event.courseDueDateReminderEmailData;

    await processInBatches(recipients, (recipient) => this.sendCourseDueDateReminder(recipient), {
      batchSize: EMAIL_BATCH_SIZE,
      throwOnError: true,
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

    await this.notificationCollectorService.captureNotificationRecipient(
      { to: recipient.studentEmail },
      {
        tenantId: recipient.tenantId,
        template: {
          event: EMAIL_TEMPLATE_EVENTS.COURSE_DUE_DATE_REMINDER,
          language: recipient.defaultEmailSettings.language,
          variables: {
            userEmail: recipient.studentEmail,
            userFirstName: recipient.studentFirstName,
            userLastName: recipient.studentLastName,
            course_name: recipient.courseName,
            course_link: `${recipient.tenantHost.replace(/\/$/, "")}/course/${recipient.courseId}`,
            due_date: formattedDueDate,
            days_before_due_date: recipient.daysBeforeDueDate,
          },
        },
      },
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

    await this.tenantDbRunnerService.runWithTenant(recipient.tenantId, async () => {
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
        usersToNotify: null,
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
