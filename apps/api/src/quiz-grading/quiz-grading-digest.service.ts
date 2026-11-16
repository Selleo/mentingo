import { Inject, Injectable } from "@nestjs/common";
import { AUTOMATION_EVENT_KINDS, SUPPORTED_LANGUAGES, isSupportedLanguage } from "@repo/shared";
import { subHours } from "date-fns";

import { NotificationEvent } from "src/automation-execution/events/notification-event";
import { DatabasePg } from "src/common";
import { resolveTenantOrigin } from "src/common/helpers/resolveTenantOrigin";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { dbAls } from "src/storage/db/db-als.store";
import { DB_ADMIN } from "src/storage/db/db.providers";

import { QUIZ_GRADING_DIGEST_WINDOW_HOURS } from "./quiz-grading-notifications.constants";
import { QuizGradingRepository } from "./quiz-grading.repository";

/** One email per reviewer about answers that joined the grading queue in the last 24 hours. */
@Injectable()
export class QuizGradingDigestService {
  constructor(
    private readonly quizGradingRepository: QuizGradingRepository,
    private readonly outboxPublisher: OutboxPublisher,
    @Inject(DB_ADMIN) private readonly dbAdmin: DatabasePg,
  ) {}

  async sendGradingDigest(now = new Date()) {
    const tenantId = dbAls.getStore()?.tenantId;

    if (!tenantId) throw new Error("Quiz grading digest requires an originating tenant");

    const { newAnswersCount, pendingAnswersCount } =
      await this.quizGradingRepository.countPendingAnswers(
        subHours(now, QUIZ_GRADING_DIGEST_WINDOW_HOURS),
      );

    if (!newAnswersCount) return;

    const reviewers = await this.quizGradingRepository.findDigestReviewers();

    if (!reviewers.length) return;

    const tenantOrigin = await resolveTenantOrigin(this.dbAdmin, tenantId);
    const eventFields = {
      new_answers_count: newAnswersCount,
      pending_answers_count: pendingAnswersCount,
      grading_queue_link: `${tenantOrigin}/quiz-grading`,
    };

    await this.outboxPublisher.publish(
      new NotificationEvent({
        // One digest per tenant and day, so a re-run of the cron does not send it twice.
        occurrenceId: `quiz-grading-digest:${tenantId}:${now.toISOString().slice(0, 10)}`,
        kind: AUTOMATION_EVENT_KINDS.QUIZ_GRADING_DIGEST,
        recipients: reviewers.map((reviewer) => ({
          itemId: reviewer.email,
          email: reviewer.email,
          language:
            reviewer.language && isSupportedLanguage(reviewer.language)
              ? reviewer.language
              : SUPPORTED_LANGUAGES.EN,
          eventFields: {
            userEmail: reviewer.email,
            userFirstName: reviewer.firstName,
            userLastName: reviewer.lastName,
            ...eventFields,
          },
        })),
        items: [{ itemId: tenantId, eventFields }],
      }),
    );
  }
}
