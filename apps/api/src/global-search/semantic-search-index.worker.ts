import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import { Worker } from "bullmq";

import { QUEUE_NAMES, QueueService } from "src/queue";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { isSemanticSearchBackgroundIndexingEnabled } from "./semantic-search-index.config";
import { SemanticSearchIndexService } from "./semantic-search-index.service";

import type { SemanticSearchIndexJob } from "./semantic-search-index.types";

@Injectable()
export class SemanticSearchIndexWorker implements OnModuleDestroy {
  private readonly logger = new Logger(SemanticSearchIndexWorker.name);
  private readonly worker?: Worker<SemanticSearchIndexJob>;

  constructor(
    queueService: QueueService,
    semanticSearchIndexService: SemanticSearchIndexService,
    tenantDbRunnerService: TenantDbRunnerService,
  ) {
    if (!isSemanticSearchBackgroundIndexingEnabled()) {
      this.logger.log("Semantic search background indexing is disabled");
      return;
    }
    this.worker = new Worker<SemanticSearchIndexJob>(
      QUEUE_NAMES.SEMANTIC_SEARCH_INDEX,
      async (job) => {
        if (job.name !== "index-source" || !job.data.tenantId)
          throw new Error("Invalid semantic indexing job");
        await tenantDbRunnerService.runWithTenant(job.data.tenantId, () =>
          semanticSearchIndexService.process(job.data),
        );
      },
      { connection: queueService.getConnection(), concurrency: 2 },
    );
    this.worker.on("failed", (job) =>
      this.logger.warn(
        `Semantic indexing job ${job?.id} failed; retry or reconciliation will resume it`,
      ),
    );
    this.worker.on("error", () => this.logger.error("Semantic indexing worker connection failed"));
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }
}
