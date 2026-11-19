import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { DiscussionReplyDigestService } from "src/discussion-notifications/discussion-reply-digest.service";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

@Injectable()
export class DiscussionReplyDigestCron {
  private readonly logger = new Logger(DiscussionReplyDigestCron.name);

  constructor(
    private readonly discussionReplyDigestService: DiscussionReplyDigestService,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async sendDueDigests() {
    await this.tenantDbRunnerService.runForEachTenant(async (tenantId) => {
      try {
        await this.discussionReplyDigestService.sendDueDigests();
      } catch (error) {
        this.logger.error(
          `[tenant=${tenantId}] Discussion reply emails failed: ${error}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    });
  }
}
