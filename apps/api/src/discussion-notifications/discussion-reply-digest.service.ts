import { Inject, Injectable } from "@nestjs/common";
import {
  AUTOMATION_EVENT_KINDS,
  DISCUSSION_SCOPES,
  getCourseDiscussionThreadPath,
} from "@repo/shared";
import { truncate, uniq } from "lodash";

import { NotificationEvent } from "src/automation-execution/events/notification-event";
import { DatabasePg } from "src/common";
import { EmailService } from "src/common/emails/emails.service";
import { resolveTenantOrigin } from "src/common/helpers/resolveTenantOrigin";
import { CourseChatRepository } from "src/course-chat/course-chat.repository";
import {
  DISCUSSION_REPLY_DIGEST_BATCH_SIZE,
  DISCUSSION_REPLY_EXCERPT_LENGTH,
} from "src/discussion-notifications/discussion-notifications.constants";
import { DiscussionNotificationsRepository } from "src/discussion-notifications/discussion-notifications.repository";
import { ForumRepository } from "src/forum/forum.repository";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { SettingsService } from "src/settings/settings.service";
import { dbAls } from "src/storage/db/db-als.store";
import { DB_ADMIN } from "src/storage/db/db.providers";

import type { SupportedLanguages } from "@repo/shared";
import type { NotificationEventData } from "src/automation-execution/events/notification-event";
import type { UUIDType } from "src/common";
import type {
  DiscussionDigestThread,
  DiscussionReplyDigest,
} from "src/discussion-notifications/discussion-notifications.types";

type DiscussionAccess = { forumEnabled: boolean; courseDiscussionsEnabled: boolean };

@Injectable()
export class DiscussionReplyDigestService {
  constructor(
    private readonly discussionNotificationsRepository: DiscussionNotificationsRepository,
    private readonly courseChatRepository: CourseChatRepository,
    private readonly forumRepository: ForumRepository,
    private readonly settingsService: SettingsService,
    private readonly emailService: EmailService,
    private readonly outboxPublisher: OutboxPublisher,
    @Inject("DB") private readonly db: DatabasePg,
    @Inject(DB_ADMIN) private readonly dbAdmin: DatabasePg,
  ) {}

  async sendDueDigests(now = new Date()) {
    const tenantId = dbAls.getStore()?.tenantId;

    if (!tenantId) throw new Error("Discussion reply emails require an originating tenant");

    const [tenantOrigin, globalSettings] = await Promise.all([
      resolveTenantOrigin(this.dbAdmin, tenantId),
      this.settingsService.getGlobalSettings(),
    ]);
    const access = {
      forumEnabled: globalSettings.forumEnabled === true,
      courseDiscussionsEnabled: globalSettings.courseDiscussionsEnabled === true,
    };

    let handledDigests = DISCUSSION_REPLY_DIGEST_BATCH_SIZE;

    while (handledDigests === DISCUSSION_REPLY_DIGEST_BATCH_SIZE) {
      handledDigests = await this.sendDueBatch({ tenantId, tenantOrigin, access, now });
    }
  }

  private async sendDueBatch(params: {
    tenantId: UUIDType;
    tenantOrigin: string;
    access: DiscussionAccess;
    now: Date;
  }) {
    const { tenantId, tenantOrigin, access, now } = params;

    return this.db.transaction(async (trx) => {
      const digests = await this.discussionNotificationsRepository.claimDueDigests(
        now,
        DISCUSSION_REPLY_DIGEST_BATCH_SIZE,
        trx,
      );

      if (!digests.length) return 0;

      for (const digest of digests) {
        const email = await this.buildEmail({ digest, tenantId, tenantOrigin, access });

        if (email) await this.outboxPublisher.publish(new NotificationEvent(email), trx);
      }

      await this.discussionNotificationsRepository.deleteDigests(
        digests.map(({ id }) => id),
        trx,
      );

      return digests.length;
    });
  }

  private async buildEmail(params: {
    digest: DiscussionReplyDigest;
    tenantId: UUIDType;
    tenantOrigin: string;
    access: DiscussionAccess;
  }): Promise<NotificationEventData | null> {
    const { digest, tenantId, tenantOrigin, access } = params;
    const [thread, recipient] = await Promise.all([
      this.discussionNotificationsRepository.findDigestThread(digest.threadId),
      this.discussionNotificationsRepository.findDigestRecipient(digest.userId),
    ]);

    if (!thread || !recipient) return null;
    if (!(await this.canOpenDiscussion(thread, recipient.id, access))) return null;

    const [replyAuthorNames, latestReply] = await Promise.all([
      this.discussionNotificationsRepository.findUnreadReplyAuthorNames(
        recipient.id,
        digest.announcementIds,
      ),
      this.discussionNotificationsRepository.findLatestReplyContent(digest.threadId, recipient.id),
    ]);

    if (!replyAuthorNames.length || !latestReply) return null;

    const { language } = await this.emailService.getDefaultEmailProperties(tenantId, recipient.id);
    const discussionName = await this.findDiscussionName(thread, language);

    if (!discussionName) return null;

    const eventFields = {
      discussion_name: discussionName,
      reply_count: replyAuthorNames.length,
      reply_authors: uniq(replyAuthorNames).join(", "),
      latest_reply: truncate(latestReply, { length: DISCUSSION_REPLY_EXCERPT_LENGTH }),
      discussion_link: `${tenantOrigin}${this.getDiscussionPath(thread, digest.threadId)}`,
    };

    return {
      occurrenceId: `discussion-reply:${digest.id}`,
      kind: AUTOMATION_EVENT_KINDS.DISCUSSION_REPLY,
      recipients: [
        {
          itemId: recipient.email,
          email: recipient.email,
          language,
          eventFields: {
            userEmail: recipient.email,
            userFirstName: recipient.firstName,
            userLastName: recipient.lastName,
            ...eventFields,
          },
        },
      ],
      items: [{ itemId: digest.id, eventFields }],
    };
  }

  private async canOpenDiscussion(
    thread: DiscussionDigestThread,
    userId: UUIDType,
    access: DiscussionAccess,
  ) {
    if (thread.scope === DISCUSSION_SCOPES.GENERAL) {
      if (!access.forumEnabled) return false;

      return (await this.forumRepository.findMentionableUsers([userId])).length > 0;
    }

    if (!access.courseDiscussionsEnabled || !thread.courseId) return false;

    const readerIds = await this.courseChatRepository.getDiscussionReaderIds(thread.courseId, [
      userId,
    ]);

    return readerIds.length > 0;
  }

  private async findDiscussionName(thread: DiscussionDigestThread, language: SupportedLanguages) {
    if (!thread.courseId) return thread.title;

    const course = await this.courseChatRepository.getCourseEmailContext(thread.courseId, language);

    return course?.title ?? null;
  }

  private getDiscussionPath(thread: DiscussionDigestThread, threadId: UUIDType) {
    return thread.courseId
      ? getCourseDiscussionThreadPath(thread.courseId, thread.firstMessageId)
      : `/forum/topics/${threadId}`;
  }
}
