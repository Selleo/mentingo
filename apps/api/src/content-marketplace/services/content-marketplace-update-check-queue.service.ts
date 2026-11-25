import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import { Value } from "@sinclair/typebox/value";
import { Worker, type Job } from "bullmq";

import { QUEUE_NAMES, QueueService } from "src/queue";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { CONTENT_MARKETPLACE_UPDATE_CHECK } from "../content-marketplace.constants";
import { contentMarketplaceUpdateCheckSchema } from "../schemas/content-marketplace.schema";

import { ContentMarketplaceCourseUpdateService } from "./content-marketplace-course-update.service";

import type { ContentMarketplaceUpdateCheck } from "../schemas/content-marketplace.schema";
import type { UUIDType } from "src/common";

/**
 * Runs each tenant's daily marketplace update check as its own job, so a tenant whose plugin
 * calls fail is retried on its own without holding up the others.
 */
@Injectable()
export class ContentMarketplaceUpdateCheckQueueService implements OnModuleDestroy {
  private readonly updateCheckWorker: Worker<ContentMarketplaceUpdateCheck>;

  constructor(
    private readonly queueService: QueueService,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
    private readonly contentMarketplaceCourseUpdateService: ContentMarketplaceCourseUpdateService,
  ) {
    this.updateCheckWorker = new Worker<ContentMarketplaceUpdateCheck>(
      QUEUE_NAMES.CONTENT_MARKETPLACE_UPDATE_CHECKS,
      (job) => this.checkTenantCourseUpdates(job),
      {
        connection: this.queueService.getConnection(),
        concurrency: CONTENT_MARKETPLACE_UPDATE_CHECK.CONCURRENCY,
      },
    );
  }

  /**
   * One check per tenant and cron minute, so API instances firing the same tick share a job.
   * Duplicates would only repeat plugin calls: each version is claimed once either way.
   */
  async enqueueScheduledUpdateCheck(tenantId: UUIDType) {
    const scheduledMinute = Math.floor(
      Date.now() / CONTENT_MARKETPLACE_UPDATE_CHECK.SCHEDULE_SLOT_MS,
    );

    await this.queueService.enqueue(
      QUEUE_NAMES.CONTENT_MARKETPLACE_UPDATE_CHECKS,
      CONTENT_MARKETPLACE_UPDATE_CHECK.JOB_NAME,
      { tenantId } satisfies ContentMarketplaceUpdateCheck,
      {
        jobId: `${tenantId}-${scheduledMinute}`,
        attempts: CONTENT_MARKETPLACE_UPDATE_CHECK.ATTEMPTS,
        backoff: { type: "exponential", delay: CONTENT_MARKETPLACE_UPDATE_CHECK.BACKOFF_DELAY_MS },
        removeOnComplete: { age: CONTENT_MARKETPLACE_UPDATE_CHECK.DEDUPLICATION_WINDOW_SECONDS },
        removeOnFail: { age: CONTENT_MARKETPLACE_UPDATE_CHECK.DEDUPLICATION_WINDOW_SECONDS },
      },
    );
  }

  async onModuleDestroy() {
    await this.updateCheckWorker.close();
  }

  private async checkTenantCourseUpdates(job: Job<ContentMarketplaceUpdateCheck>) {
    if (!Value.Check(contentMarketplaceUpdateCheckSchema, job.data))
      throw new Error("Invalid content marketplace update check");

    const { tenantId } = job.data;

    await this.tenantDbRunnerService.runWithTenant(tenantId, () =>
      this.contentMarketplaceCourseUpdateService.announceAvailableCourseUpdates(tenantId),
    );
  }
}
