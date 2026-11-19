import { Inject, Injectable } from "@nestjs/common";
import {
  ACCOUNT_SETTINGS_PATH,
  AUTOMATION_EVENT_KINDS,
  DISCUSSION_EMAIL_LINK_FIELDS,
  DISCUSSION_UNSUBSCRIBE_TYPES,
  getDiscussionUnsubscribePath,
} from "@repo/shared";

import { DatabasePg } from "src/common";
import { resolveTenantOrigin } from "src/common/helpers/resolveTenantOrigin";
import { DiscussionEmailLinksRepository } from "src/discussion-notifications/discussion-email-links.repository";
import { DISCUSSION_REPLY_THREAD_FIELD } from "src/discussion-notifications/discussion-notifications.constants";
import { DiscussionUnsubscribeTokenService } from "src/discussion-notifications/discussion-unsubscribe-token.service";
import { DB_ADMIN } from "src/storage/db/db.providers";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import type {
  NotificationRecipientFieldsPreparation,
  NotificationRecipientFieldsRequest,
} from "src/automation-execution/automation-execution.types";
import type { DiscussionUnsubscribeClaims } from "src/discussion-notifications/schemas/discussion-unsubscribe.schema";

type DiscussionEmailLink = {
  field: string;
  target: Pick<DiscussionUnsubscribeClaims, "type" | "threadId"> | null;
};

const MENTION_EVENT_KINDS: string[] = [
  AUTOMATION_EVENT_KINDS.FORUM_MENTION,
  AUTOMATION_EVENT_KINDS.COURSE_CHAT_MENTION,
];

@Injectable()
export class DiscussionEmailLinkService implements NotificationRecipientFieldsPreparation {
  constructor(
    private readonly discussionEmailLinksRepository: DiscussionEmailLinksRepository,
    private readonly discussionUnsubscribeTokenService: DiscussionUnsubscribeTokenService,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
    @Inject(DB_ADMIN) private readonly dbAdmin: DatabasePg,
  ) {}

  async prepareRecipientFields(
    request: NotificationRecipientFieldsRequest,
  ): Promise<Record<string, string>> {
    const { eventKind, eventFields, mappedFields, recipientEmail, tenantId } = request;
    const links = this.getEmailLinks(eventKind, eventFields).filter(({ field }) =>
      mappedFields.includes(field),
    );

    if (!links.length) return {};

    const [tenantOrigin, userId] = await Promise.all([
      resolveTenantOrigin(this.dbAdmin, tenantId),
      this.tenantDbRunnerService.runWithTenant(tenantId, () =>
        this.discussionEmailLinksRepository.findActiveUserIdByEmail(recipientEmail),
      ),
    ]);
    const buildUrl = async ({ target }: DiscussionEmailLink) => {
      if (!target || !userId) return `${tenantOrigin}${ACCOUNT_SETTINGS_PATH}`;

      const token = await this.discussionUnsubscribeTokenService.sign({
        tenantId,
        userId,
        ...target,
      });

      return `${tenantOrigin}${getDiscussionUnsubscribePath(token)}`;
    };

    return Object.fromEntries(
      await Promise.all(links.map(async (link) => [link.field, await buildUrl(link)])),
    );
  }

  private getEmailLinks(
    eventKind: string,
    eventFields: Record<string, unknown> | null,
  ): DiscussionEmailLink[] {
    if (MENTION_EVENT_KINDS.includes(eventKind)) {
      return [
        {
          field: DISCUSSION_EMAIL_LINK_FIELDS.UNSUBSCRIBE,
          target: { type: DISCUSSION_UNSUBSCRIBE_TYPES.MENTIONS },
        },
      ];
    }

    if (eventKind !== AUTOMATION_EVENT_KINDS.DISCUSSION_REPLY) return [];

    const threadId = eventFields?.[DISCUSSION_REPLY_THREAD_FIELD];

    return [
      {
        field: DISCUSSION_EMAIL_LINK_FIELDS.UNSUBSCRIBE,
        target: { type: DISCUSSION_UNSUBSCRIBE_TYPES.REPLIES },
      },
      {
        field: DISCUSSION_EMAIL_LINK_FIELDS.UNFOLLOW,
        target:
          typeof threadId === "string"
            ? { type: DISCUSSION_UNSUBSCRIBE_TYPES.THREAD, threadId }
            : null,
      },
    ];
  }
}
