import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { ContentMarketplaceLineageRepository } from "./repositories/content-marketplace-lineage.repository";
import { ContentMarketplaceUpdateCheckQueueService } from "./services/content-marketplace-update-check-queue.service";

@Injectable()
export class ContentMarketplaceUpdateCheckCron {
  constructor(
    private readonly tenantDbRunnerService: TenantDbRunnerService,
    private readonly contentMarketplaceLineageRepository: ContentMarketplaceLineageRepository,
    private readonly contentMarketplaceUpdateCheckQueueService: ContentMarketplaceUpdateCheckQueueService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async queueDailyCourseUpdateChecks(): Promise<void> {
    await this.tenantDbRunnerService.runForEachTenant(async (tenantId) => {
      if (!(await this.contentMarketplaceLineageRepository.hasTrackedCourses())) return;

      await this.contentMarketplaceUpdateCheckQueueService.enqueueScheduledUpdateCheck(tenantId);
    });
  }
}
