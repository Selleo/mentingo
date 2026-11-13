import { Inject, Injectable } from "@nestjs/common";
import { EMAIL_TEMPLATE_EVENTS } from "@repo/email-templates";
import {
  ANNOUNCEMENT_EMAIL_TEMPLATES,
  ANNOUNCEMENT_SOURCE_TYPES,
  ANNOUNCEMENT_STATUSES,
  SUPPORTED_LANGUAGES,
  type LocalizedText,
  type SupportedLanguages,
} from "@repo/shared";
import { escape } from "lodash";

import { AnnouncementsRepository } from "src/announcements/announcements.repository";
import { DatabasePg } from "src/common";
import { EmailService } from "src/common/emails/emails.service";
import { resolveTenantOrigin } from "src/common/helpers/resolveTenantOrigin";
import { QuizAttemptGradedEvent } from "src/events";
import { NotificationCollectorService } from "src/notifications/services/notification-collector.service";
import { OutboxEventsHandler } from "src/outbox/outbox.decorators";
import { dbAls } from "src/storage/db/db-als.store";
import { DB_ADMIN } from "src/storage/db/db.providers";

import {
  QUIZ_GRADED_ANNOUNCEMENT_CONTENTS,
  QUIZ_GRADED_ANNOUNCEMENT_TITLES,
} from "../quiz-grading-notifications.constants";
import { QuizGradingRepository } from "../quiz-grading.repository";

import type { OutboxDeliveryContext, OutboxEventsHandlerOf } from "src/outbox/outbox.types";

const localize = (value: LocalizedText, language: SupportedLanguages, base: SupportedLanguages) =>
  value[language] || value[base] || Object.values(value)[0] || "";

/** Tells the learner, in the app and by email, that a reviewer graded (or re-graded) their attempt. */
@Injectable()
@OutboxEventsHandler(QuizAttemptGradedEvent)
export class QuizAttemptGradedNotificationHandler
  implements OutboxEventsHandlerOf<QuizAttemptGradedEvent>
{
  constructor(
    private readonly quizGradingRepository: QuizGradingRepository,
    private readonly announcementsRepository: AnnouncementsRepository,
    private readonly emailService: EmailService,
    private readonly notificationCollectorService: NotificationCollectorService,
    @Inject(DB_ADMIN) private readonly dbAdmin: DatabasePg,
  ) {}

  async handleOutboxEvent(event: QuizAttemptGradedEvent, { eventId }: OutboxDeliveryContext) {
    await this.notificationCollectorService.publishCollectedNotifications(eventId, () =>
      this.prepareNotifications(event),
    );
  }

  private async prepareNotifications(event: QuizAttemptGradedEvent) {
    const tenantId = dbAls.getStore()?.tenantId;

    if (!tenantId) throw new Error("Quiz grading notifications require an originating tenant");

    const attempt = await this.quizGradingRepository.findGradedAttemptNotificationData(
      event.attemptId,
    );

    if (!attempt) return;

    const lessonPath = `/course/${event.courseId}/lesson/${event.lessonId}`;
    const languages = Object.values(SUPPORTED_LANGUAGES);

    await this.announcementsRepository.createAnnouncement({
      groupId: null,
      title: Object.fromEntries(
        languages.map((language) => [language, QUIZ_GRADED_ANNOUNCEMENT_TITLES[language]]),
      ),
      content: Object.fromEntries(
        languages.map((language) => {
          const lessonName = escape(localize(attempt.lessonTitle, language, attempt.baseLanguage));
          const courseName = escape(localize(attempt.courseTitle, language, attempt.baseLanguage));

          return [
            language,
            QUIZ_GRADED_ANNOUNCEMENT_CONTENTS[language](
              `<a href="${lessonPath}">${lessonName}</a>`,
              courseName,
              event.score,
            ),
          ];
        }),
      ),
      baseLanguage: SUPPORTED_LANGUAGES.EN,
      availableLocales: languages,
      authorId: event.reviewerId,
      status: ANNOUNCEMENT_STATUSES.PUBLISHED,
      scheduledAt: null,
      publishedAt: new Date().toISOString(),
      sendEmail: false,
      emailTemplate: ANNOUNCEMENT_EMAIL_TEMPLATES.DEFAULT,
      sourceType: ANNOUNCEMENT_SOURCE_TYPES.QUIZ_GRADING,
      sourceId: event.attemptId,
      usersToNotify: [attempt.studentId],
    });

    const [{ language }, tenantOrigin] = await Promise.all([
      this.emailService.getDefaultEmailProperties(tenantId, attempt.studentId),
      resolveTenantOrigin(this.dbAdmin, tenantId),
    ]);

    await this.notificationCollectorService.captureNotificationRecipient(
      { to: attempt.email },
      {
        tenantId,
        template: {
          event: EMAIL_TEMPLATE_EVENTS.QUIZ_ATTEMPT_GRADED,
          language,
          variables: {
            userEmail: attempt.email,
            userFirstName: attempt.firstName,
            userLastName: attempt.lastName,
            course_name: localize(attempt.courseTitle, language, attempt.baseLanguage),
            lesson_name: localize(attempt.lessonTitle, language, attempt.baseLanguage),
            score: event.score,
            lesson_link: `${tenantOrigin}${lessonPath}`,
          },
        },
      },
    );
  }
}
