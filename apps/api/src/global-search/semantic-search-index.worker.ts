import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import { Worker } from "bullmq";

import { QUEUE_NAMES, QueueService } from "src/queue";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { SemanticSearchIndexService } from "./semantic-search-index.service";

import type { SemanticSearchIndexJob } from "./semantic-search-index.types";

@Injectable()
export class SemanticSearchIndexWorker implements OnModuleDestroy {
  private readonly logger = new Logger(SemanticSearchIndexWorker.name);
  private readonly worker: Worker<SemanticSearchIndexJob>;

  constructor(
    queue: QueueService,
    service: SemanticSearchIndexService,
    tenants: TenantDbRunnerService,
  ) {
    this.worker = new Worker<SemanticSearchIndexJob>(
      QUEUE_NAMES.SEMANTIC_SEARCH_INDEX,
      async (job) => {
        if (job.name !== "index-source" || !job.data.tenantId)
          throw new Error("Invalid semantic indexing job");
        await tenants.runWithTenant(job.data.tenantId, () => service.process(job.data));
      },
      { connection: queue.getConnection(), concurrency: 2 },
    );
    this.worker.on("failed", (job) =>
      this.logger.warn(
        `Semantic indexing job ${job?.id} failed; retry or reconciliation will resume it`,
      ),
    );
    this.worker.on("error", () => this.logger.error("Semantic indexing worker connection failed"));
  }

  async onModuleDestroy() {
    await this.worker.close();
  }
}
