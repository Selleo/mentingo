import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import { Value } from "@sinclair/typebox/value";
import { Worker, type Job } from "bullmq";

import { QUEUE_NAMES, QueueService } from "src/queue";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { CONTENT_MARKETPLACE_EVENT_DELIVERY } from "../content-marketplace.constants";
import { contentMarketplaceEventDeliverySchema } from "../schemas/content-marketplace.schema";

import { ContentMarketplaceClientService } from "./content-marketplace-client.service";

import type { ContentMarketplaceEventDelivery } from "../schemas/content-marketplace.schema";

/**
 * Delivers copy and duplication analytics to the plugin with retries and exponential backoff.
 * The job ID is the event ID, so an event queued twice is delivered once, and the plugin
 * deduplicates redeliveries by the same ID.
 */
@Injectable()
export class ContentMarketplaceEventDeliveryService implements OnModuleDestroy {
  private readonly eventWorker: Worker<ContentMarketplaceEventDelivery>;

  constructor(
    private readonly queueService: QueueService,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
    private readonly contentMarketplaceClientService: ContentMarketplaceClientService,
  ) {
    this.eventWorker = new Worker<ContentMarketplaceEventDelivery>(
      QUEUE_NAMES.CONTENT_MARKETPLACE_EVENTS,
      (job) => this.deliverEvent(job),
      {
        connection: this.queueService.getConnection(),
        concurrency: CONTENT_MARKETPLACE_EVENT_DELIVERY.CONCURRENCY,
      },
    );
  }

  async enqueueEventDelivery(delivery: ContentMarketplaceEventDelivery) {
    await this.queueService.enqueue(
      QUEUE_NAMES.CONTENT_MARKETPLACE_EVENTS,
      CONTENT_MARKETPLACE_EVENT_DELIVERY.JOB_NAME,
      delivery,
      {
        jobId: delivery.event.id,
        attempts: CONTENT_MARKETPLACE_EVENT_DELIVERY.ATTEMPTS,
        backoff: {
          type: "exponential",
          delay: CONTENT_MARKETPLACE_EVENT_DELIVERY.BACKOFF_DELAY_MS,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  }

  async onModuleDestroy() {
    await this.eventWorker.close();
  }

  private async deliverEvent(job: Job<ContentMarketplaceEventDelivery>) {
    if (!Value.Check(contentMarketplaceEventDeliverySchema, job.data))
      throw new Error("Invalid content marketplace event delivery");

    const { tenantId, event } = job.data;

    await this.tenantDbRunnerService.runWithTenant(tenantId, async () => {
      const connection = await this.contentMarketplaceClientService.findTenantConnection();

      if (!connection) throw new Error("Content marketplace is not connected for this tenant");

      await this.contentMarketplaceClientService.sendEvent(connection, event);
    });
  }
}
