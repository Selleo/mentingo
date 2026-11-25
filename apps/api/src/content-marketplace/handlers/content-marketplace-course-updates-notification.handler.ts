import { Inject, Injectable } from "@nestjs/common";
import { EMAIL_TEMPLATE_EVENTS } from "@repo/email-templates";
import {
  ANNOUNCEMENT_EMAIL_TEMPLATES,
  ANNOUNCEMENT_SOURCE_TYPES,
  ANNOUNCEMENT_STATUSES,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";
import { mapValues } from "lodash";

import { AnnouncementsRepository } from "src/announcements/announcements.repository";
import { DatabasePg } from "src/common";
import { EMAIL_BATCH_SIZE } from "src/common/emails/email.constants";
import { EmailService } from "src/common/emails/emails.service";
import { resolveTenantOrigin } from "src/common/helpers/resolveTenantOrigin";
import { processInBatches } from "src/common/utils/processInBatches";
import { UserNotificationsCreatedEvent } from "src/events/announcement/user-notifications-created.event";
import { NotificationCollectorService } from "src/notifications/services/notification-collector.service";
import { OutboxEventsHandler } from "src/outbox/outbox.decorators";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { DB_ADMIN } from "src/storage/db/db.providers";

import { getContentMarketplaceCourseUpdateTexts } from "../content-marketplace-course-update.localizations";
import { CONTENT_MARKETPLACE_PAGE_PATH } from "../content-marketplace.constants";
import { ContentMarketplaceCourseUpdatesAvailableEvent } from "../events/content-marketplace-course-updates-available.event";
import { ContentMarketplaceCourseUpdateRepository } from "../repositories/content-marketplace-course-update.repository";

import type {
  ContentMarketplaceCourseUpdateRecipient,
  ContentMarketplaceCourseUpdateTexts,
} from "../content-marketplace.types";
import type { ContentMarketplaceCourseUpdatesAvailableData } from "../events/content-marketplace-course-updates-available.event";
import type { SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";
import type { OutboxDeliveryContext, OutboxEventsHandlerOf } from "src/outbox/outbox.types";

/** Tells the tenant's admins once, in the app and by email, about every marketplace course with a newer version. */
@Injectable()
@OutboxEventsHandler(ContentMarketplaceCourseUpdatesAvailableEvent)
export class ContentMarketplaceCourseUpdatesNotificationHandler
  implements OutboxEventsHandlerOf<ContentMarketplaceCourseUpdatesAvailableEvent>
{
  constructor(
    private readonly contentMarketplaceCourseUpdateRepository: ContentMarketplaceCourseUpdateRepository,
    private readonly announcementsRepository: AnnouncementsRepository,
    private readonly outboxPublisher: OutboxPublisher,
    private readonly emailService: EmailService,
    private readonly notificationCollectorService: NotificationCollectorService,
    @Inject(DB_ADMIN) private readonly dbAdmin: DatabasePg,
  ) {}

  async handleOutboxEvent(
    event: ContentMarketplaceCourseUpdatesAvailableEvent,
    { eventId }: OutboxDeliveryContext,
  ) {
    await this.notificationCollectorService.publishCollectedNotifications(eventId, () =>
      this.notifyAdminsAboutCourseUpdates(event.courseUpdatesAvailableData),
    );
  }

  private async notifyAdminsAboutCourseUpdates({
    tenantId,
    courseUpdates,
  }: ContentMarketplaceCourseUpdatesAvailableData) {
    const courseIds = courseUpdates.map(({ courseId }) => courseId);
    const [admins, updatedCourses] = await Promise.all([
      this.contentMarketplaceCourseUpdateRepository.findCourseUpdateRecipients(tenantId),
      this.contentMarketplaceCourseUpdateRepository.findCourseTitlesByLanguage(courseIds),
    ]);

    if (!admins.length || !updatedCourses.length) return;

    const updateTexts = getContentMarketplaceCourseUpdateTexts(updatedCourses);

    await this.createCourseUpdateAnnouncement(updateTexts, admins);
    await this.captureCourseUpdateEmails(tenantId, updateTexts, updatedCourses.length, admins);
  }

  private async createCourseUpdateAnnouncement(
    updateTexts: Record<SupportedLanguages, ContentMarketplaceCourseUpdateTexts>,
    admins: ContentMarketplaceCourseUpdateRecipient[],
  ) {
    const adminIds = admins.map(({ id }) => id);

    await this.announcementsRepository.createAnnouncement({
      groupId: null,
      title: mapValues(updateTexts, ({ title }) => title),
      content: mapValues(updateTexts, ({ message }) => message),
      baseLanguage: SUPPORTED_LANGUAGES.EN,
      availableLocales: Object.values(SUPPORTED_LANGUAGES),
      authorId: null,
      status: ANNOUNCEMENT_STATUSES.PUBLISHED,
      scheduledAt: null,
      publishedAt: new Date().toISOString(),
      sendEmail: false,
      emailTemplate: ANNOUNCEMENT_EMAIL_TEMPLATES.DEFAULT,
      sourceType: ANNOUNCEMENT_SOURCE_TYPES.CONTENT_MARKETPLACE_COURSE_UPDATE,
      sourceId: null,
      linkPath: CONTENT_MARKETPLACE_PAGE_PATH,
      usersToNotify: adminIds,
    });

    await this.outboxPublisher.publish(new UserNotificationsCreatedEvent({ userIds: adminIds }));
  }

  private async captureCourseUpdateEmails(
    tenantId: UUIDType,
    updateTexts: Record<SupportedLanguages, ContentMarketplaceCourseUpdateTexts>,
    updatedCoursesCount: number,
    admins: ContentMarketplaceCourseUpdateRecipient[],
  ) {
    const tenantOrigin = await resolveTenantOrigin(this.dbAdmin, tenantId);

    await processInBatches(
      admins,
      async (admin) => {
        const { language } = await this.emailService.getDefaultEmailProperties(tenantId, admin.id);
        const { coursesWithNewVersion, allCoursesWithNewVersion } = updateTexts[language];

        return this.notificationCollectorService.captureNotificationRecipient(
          { to: admin.email },
          {
            tenantId,
            template: {
              event: EMAIL_TEMPLATE_EVENTS.CONTENT_MARKETPLACE_COURSE_UPDATE,
              language,
              variables: {
                userEmail: admin.email,
                courses_with_new_version: coursesWithNewVersion,
                all_courses_with_new_version: allCoursesWithNewVersion,
                courses_with_new_version_count: updatedCoursesCount,
                marketplace_link: `${tenantOrigin}${CONTENT_MARKETPLACE_PAGE_PATH}`,
              },
            },
          },
        );
      },
      { batchSize: EMAIL_BATCH_SIZE, throwOnError: true },
    );
  }
}
