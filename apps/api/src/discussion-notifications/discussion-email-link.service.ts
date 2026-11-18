import { Inject, Injectable } from "@nestjs/common";
import {
  AUTOMATION_EVENT_KINDS,
  DISCUSSION_EMAIL_LINK_FIELDS,
  DISCUSSION_UNSUBSCRIBE_TYPES,
  getDiscussionUnsubscribePath,
} from "@repo/shared";

import { DatabasePg } from "src/common";
import { resolveTenantOrigin } from "src/common/helpers/resolveTenantOrigin";
import { DiscussionEmailLinksRepository } from "src/discussion-notifications/discussion-email-links.repository";
import {
  ACCOUNT_SETTINGS_PATH,
  DISCUSSION_REPLY_THREAD_FIELD,
} from "src/discussion-notifications/discussion-notifications.constants";
import { DiscussionUnsubscribeTokenService } from "src/discussion-notifications/discussion-unsubscribe-token.service";
import { DB_ADMIN } from "src/storage/db/db.providers";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import type { DiscussionEmailLinkRequest } from "src/discussion-notifications/discussion-notifications.types";
import type { DiscussionUnsubscribeClaims } from "src/discussion-notifications/schemas/discussion-unsubscribe.schema";

const MENTION_EVENT_KINDS: string[] = [
  AUTOMATION_EVENT_KINDS.FORUM_MENTION,
  AUTOMATION_EVENT_KINDS.COURSE_CHAT_MENTION,
];

@Injectable()
export class DiscussionEmailLinkService {
  constructor(
    private readonly discussionEmailLinksRepository: DiscussionEmailLinksRepository,
    private readonly discussionUnsubscribeTokenService: DiscussionUnsubscribeTokenService,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
    @Inject(DB_ADMIN) private readonly dbAdmin: DatabasePg,
  ) {}

  async buildLinkFields(request: DiscussionEmailLinkRequest): Promise<Record<string, string>> {
    const { eventKind, eventFields, recipientEmail, tenantId } = request;
    const isReplyEmail = eventKind === AUTOMATION_EVENT_KINDS.DISCUSSION_REPLY;

    if (!isReplyEmail && !MENTION_EVENT_KINDS.includes(eventKind)) return {};

    const [tenantOrigin, userId] = await Promise.all([
      resolveTenantOrigin(this.dbAdmin, tenantId),
      this.tenantDbRunnerService.runWithTenant(tenantId, () =>
        this.discussionEmailLinksRepository.findActiveUserIdByEmail(recipientEmail),
      ),
    ]);
    const settingsUrl = `${tenantOrigin}${ACCOUNT_SETTINGS_PATH}`;
    const buildLink = async (target: Pick<DiscussionUnsubscribeClaims, "type" | "threadId">) => {
      if (!userId) return settingsUrl;

      const token = await this.discussionUnsubscribeTokenService.sign({
        tenantId,
        userId,
        ...target,
      });

      return `${tenantOrigin}${getDiscussionUnsubscribePath(token)}`;
    };

    if (!isReplyEmail) {
      return {
        [DISCUSSION_EMAIL_LINK_FIELDS.UNSUBSCRIBE]: await buildLink({
          type: DISCUSSION_UNSUBSCRIBE_TYPES.MENTIONS,
        }),
      };
    }

    const threadId = eventFields?.[DISCUSSION_REPLY_THREAD_FIELD];

    return {
      [DISCUSSION_EMAIL_LINK_FIELDS.UNSUBSCRIBE]: await buildLink({
        type: DISCUSSION_UNSUBSCRIBE_TYPES.REPLIES,
      }),
      [DISCUSSION_EMAIL_LINK_FIELDS.UNFOLLOW]:
        typeof threadId === "string"
          ? await buildLink({ type: DISCUSSION_UNSUBSCRIBE_TYPES.THREAD, threadId })
          : settingsUrl,
    };
  }
}
