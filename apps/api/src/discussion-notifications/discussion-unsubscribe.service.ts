import { BadRequestException, Injectable } from "@nestjs/common";
import { DISCUSSION_NOTIFICATION_PREFERENCES, DISCUSSION_UNSUBSCRIBE_TYPES } from "@repo/shared";
import { match } from "ts-pattern";

import { CourseChatRepository } from "src/course-chat/course-chat.repository";
import { DiscussionEmailLinksRepository } from "src/discussion-notifications/discussion-email-links.repository";
import { DiscussionUnsubscribeTokenService } from "src/discussion-notifications/discussion-unsubscribe-token.service";
import { SettingsService } from "src/settings/settings.service";
import { dbAls } from "src/storage/db/db-als.store";

import type { DiscussionUnsubscribeResponse } from "src/discussion-notifications/schemas/discussion-unsubscribe.schema";

const INVALID_LINK_ERROR = "discussionNotifications.errors.invalidUnsubscribeLink";

@Injectable()
export class DiscussionUnsubscribeService {
  constructor(
    private readonly discussionUnsubscribeTokenService: DiscussionUnsubscribeTokenService,
    private readonly discussionEmailLinksRepository: DiscussionEmailLinksRepository,
    private readonly courseChatRepository: CourseChatRepository,
    private readonly settingsService: SettingsService,
  ) {}

  async unsubscribe(token: string): Promise<DiscussionUnsubscribeResponse> {
    const claims = await this.discussionUnsubscribeTokenService.verify(token);

    if (!claims || claims.tenantId !== dbAls.getStore()?.tenantId) {
      throw new BadRequestException(INVALID_LINK_ERROR);
    }

    const { userId, type, threadId } = claims;

    if (!(await this.discussionEmailLinksRepository.isActiveUser(userId))) {
      throw new BadRequestException(INVALID_LINK_ERROR);
    }

    await match(type)
      .with(DISCUSSION_UNSUBSCRIBE_TYPES.REPLIES, () =>
        this.settingsService.updateNotificationPreferences(userId, {
          [DISCUSSION_NOTIFICATION_PREFERENCES.REPLY_EMAILS]: false,
        }),
      )
      .with(DISCUSSION_UNSUBSCRIBE_TYPES.MENTIONS, () =>
        this.settingsService.updateNotificationPreferences(userId, {
          [DISCUSSION_NOTIFICATION_PREFERENCES.MENTION_EMAILS]: false,
        }),
      )
      .with(DISCUSSION_UNSUBSCRIBE_TYPES.THREAD, async () => {
        if (!threadId) throw new BadRequestException(INVALID_LINK_ERROR);

        await this.courseChatRepository.unfollowThread(threadId, userId);
      })
      .exhaustive();

    return { type };
  }
}
