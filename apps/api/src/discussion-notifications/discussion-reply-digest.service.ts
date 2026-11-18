import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  AUTOMATION_EVENT_KINDS,
  DISCUSSION_SCOPES,
  SUPPORTED_LANGUAGES,
  getCourseDiscussionThreadPath,
  isSupportedLanguage,
} from "@repo/shared";
import { addMinutes } from "date-fns";
import { truncate, uniq } from "lodash";

import { NotificationEvent } from "src/automation-execution/events/notification-event";
import { DatabasePg } from "src/common";
import { resolveTenantOrigin } from "src/common/helpers/resolveTenantOrigin";
import { CourseChatRepository } from "src/course-chat/course-chat.repository";
import {
  DISCUSSION_REPLY_DIGEST_BATCH_SIZE,
  DISCUSSION_REPLY_DIGEST_DELAY_MINUTES,
  DISCUSSION_REPLY_EXCERPT_LENGTH,
} from "src/discussion-notifications/discussion-notifications.constants";
import { DiscussionNotificationsRepository } from "src/discussion-notifications/discussion-notifications.repository";
import { getForumTopicPath } from "src/forum/forum.constants";
import { ForumRepository } from "src/forum/forum.repository";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { SettingsService } from "src/settings/settings.service";
import { dbAls } from "src/storage/db/db-als.store";
import { DB_ADMIN } from "src/storage/db/db.providers";

import type { SupportedLanguages } from "@repo/shared";
import type { NotificationEventData } from "src/automation-execution/events/notification-event";
import type { UUIDType } from "src/common";
import type { DiscussionEmailRecipient } from "src/course-chat/course-chat.repository.types";
import type {
  DiscussionDigestThread,
  DiscussionReplyDigest,
} from "src/discussion-notifications/discussion-notifications.types";

type DigestRun = {
  tenantOrigin: string;
  forumEnabled: boolean;
  courseDiscussionsEnabled: boolean;
  now: Date;
};

@Injectable()
export class DiscussionReplyDigestService {
  private readonly logger = new Logger(DiscussionReplyDigestService.name);

  constructor(
    private readonly discussionNotificationsRepository: DiscussionNotificationsRepository,
    private readonly courseChatRepository: CourseChatRepository,
    private readonly forumRepository: ForumRepository,
    private readonly settingsService: SettingsService,
    private readonly outboxPublisher: OutboxPublisher,
    @Inject("DB") private readonly db: DatabasePg,
    @Inject(DB_ADMIN) private readonly dbAdmin: DatabasePg,
  ) {}

  async sendDueDigests(now = new Date()) {
    const tenantId = dbAls.getStore()?.tenantId;

    if (!tenantId) throw new Error("Discussion reply emails require an originating tenant");

    let digestIds = await this.findDueDigestIds(now);

    if (!digestIds.length) return;

    const [tenantOrigin, globalSettings] = await Promise.all([
      resolveTenantOrigin(this.dbAdmin, tenantId),
      this.settingsService.getGlobalSettings(),
    ]);
    const run = {
      tenantOrigin,
      forumEnabled: globalSettings.forumEnabled === true,
      courseDiscussionsEnabled: globalSettings.courseDiscussionsEnabled === true,
      now,
    };

    while (digestIds.length) {
      let handledDigests = 0;

      for (const digestId of digestIds) {
        if (await this.sendDigest(digestId, run)) handledDigests++;
      }

      const mayHaveMore =
        handledDigests > 0 && digestIds.length === DISCUSSION_REPLY_DIGEST_BATCH_SIZE;

      digestIds = mayHaveMore ? await this.findDueDigestIds(now) : [];
    }
  }

  private findDueDigestIds(now: Date) {
    return this.discussionNotificationsRepository.findDueDigestIds(
      now,
      DISCUSSION_REPLY_DIGEST_BATCH_SIZE,
    );
  }

  private async sendDigest(digestId: UUIDType, run: DigestRun) {
    try {
      return await this.db.transaction(async (trx) => {
        const digest = await this.discussionNotificationsRepository.claimDueDigest(
          digestId,
          run.now,
          trx,
        );

        if (!digest) return false;

        const email = await this.buildEmail(digest, run);

        if (email) await this.outboxPublisher.publish(new NotificationEvent(email), trx);

        await this.discussionNotificationsRepository.deleteDigest(digest.id, trx);

        return true;
      });
    } catch (error) {
      this.logger.error(
        `Discussion reply email ${digestId} failed and was postponed: ${error}`,
        error instanceof Error ? error.stack : undefined,
      );
      await this.discussionNotificationsRepository.postponeDigest(
        digestId,
        addMinutes(run.now, DISCUSSION_REPLY_DIGEST_DELAY_MINUTES),
      );

      return true;
    }
  }

  private async buildEmail(
    digest: DiscussionReplyDigest,
    run: DigestRun,
  ): Promise<NotificationEventData | null> {
    const thread = await this.discussionNotificationsRepository.findDigestThread(digest.threadId);

    if (!thread) return null;

    const recipient = await this.findDiscussionReader(thread, digest.userId, run);

    if (!recipient) return null;

    const unreadAnnouncementIds = new Set(
      await this.discussionNotificationsRepository.findUnreadAnnouncementIds(
        recipient.id,
        digest.replies.map(({ announcementId }) => announcementId),
      ),
    );
    const replies = await this.discussionNotificationsRepository.findVisibleReplies(
      digest.replies
        .filter(({ announcementId }) => unreadAnnouncementIds.has(announcementId))
        .map(({ replyId }) => replyId),
    );
    const latestReply = replies.at(-1);

    if (!latestReply) return null;

    const language =
      recipient.language && isSupportedLanguage(recipient.language)
        ? recipient.language
        : SUPPORTED_LANGUAGES.EN;
    const discussionName = await this.findDiscussionName(thread, language);

    if (!discussionName) return null;

    const eventFields = {
      discussion_name: discussionName,
      reply_count: replies.length,
      reply_authors: uniq(replies.map(({ authorFullName }) => authorFullName)).join(", "),
      latest_reply: truncate(latestReply.content, { length: DISCUSSION_REPLY_EXCERPT_LENGTH }),
      discussion_link: `${run.tenantOrigin}${this.getDiscussionPath(thread, digest.threadId)}`,
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

  private async findDiscussionReader(
    thread: DiscussionDigestThread,
    userId: UUIDType,
    run: DigestRun,
  ): Promise<DiscussionEmailRecipient | null> {
    if (thread.scope === DISCUSSION_SCOPES.GENERAL) {
      if (!run.forumEnabled) return null;

      const [forumReader] = await this.forumRepository.findEmailRecipients([userId]);

      return forumReader ?? null;
    }

    if (!run.courseDiscussionsEnabled || !thread.courseId) return null;

    const [courseReader] = await this.courseChatRepository.findDiscussionEmailRecipients(
      thread.courseId,
      [userId],
    );

    return courseReader ?? null;
  }

  private async findDiscussionName(thread: DiscussionDigestThread, language: SupportedLanguages) {
    if (!thread.courseId) return thread.title;

    const course = await this.courseChatRepository.getCourseEmailContext(thread.courseId, language);

    return course?.title ?? null;
  }

  private getDiscussionPath(thread: DiscussionDigestThread, threadId: UUIDType) {
    return thread.courseId
      ? getCourseDiscussionThreadPath(thread.courseId, thread.firstMessageId)
      : getForumTopicPath(threadId);
  }
}
