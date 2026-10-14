import { createHash } from "node:crypto";

import { Injectable } from "@nestjs/common";

import { QUEUE_NAMES, QueueService } from "src/queue";

import {
  SEMANTIC_SEARCH_BATCH_SIZE,
  SEMANTIC_SEARCH_INDEX_VERSION,
  SEMANTIC_SEARCH_MODEL,
} from "./semantic-search-index.constants";
import { SemanticSearchIndexRepository } from "./semantic-search-index.repository";

import type {
  SemanticSearchIndexJob,
  SemanticSearchReconcileOptions,
} from "./semantic-search-index.types";

@Injectable()
export class SemanticSearchIndexQueueService {
  constructor(
    private readonly repository: SemanticSearchIndexRepository,
    private readonly queue: QueueService,
  ) {}

  async reconcile(tenantId: string, options: SemanticSearchReconcileOptions = {}) {
    const limit = Math.min(options.limit ?? SEMANTIC_SEARCH_BATCH_SIZE, 500);
    const sources = await this.repository.findPending(limit, options.offset ?? 0);
    if (options.dryRun) return { pending: sources.length, enqueued: 0 };
    await this.repository.cleanupDeleted();
    const queue = this.queue.getQueue(QUEUE_NAMES.SEMANTIC_SEARCH_INDEX);
    const counts = await queue.getJobCounts("waiting", "active", "delayed");
    let capacity = Math.max(0, 500 - counts.waiting - counts.active - counts.delayed);
    let enqueued = 0;
    for (const source of sources) {
      if (!capacity) break;
      const jobId = createHash("sha256")
        .update(
          JSON.stringify([
            tenantId,
            source.entityType,
            source.entityId,
            source.documentType,
            source.language,
            source.sourceHash,
            source.sourceRevision,
            SEMANTIC_SEARCH_INDEX_VERSION,
            SEMANTIC_SEARCH_MODEL,
          ]),
        )
        .digest("hex");
      const existing = await queue.getJob(jobId);
      if (existing) {
        const state = await existing.getState();
        if (
          state !== "failed" ||
          !existing.finishedOn ||
          Date.now() - existing.finishedOn < 86_400_000
        )
          continue;
        await existing.remove();
      }
      const data: SemanticSearchIndexJob = {
        tenantId,
        entityType: source.entityType,
        entityId: source.entityId,
        documentType: source.documentType,
        language: source.language,
      };
      await this.queue.enqueue(QUEUE_NAMES.SEMANTIC_SEARCH_INDEX, "index-source", data, {
        jobId,
        attempts: 4,
        backoff: { type: "exponential", delay: 30_000 },
        removeOnComplete: true,
        removeOnFail: { age: 86_400, count: 500 },
      });
      enqueued++;
      capacity--;
    }
    return { pending: sources.length, enqueued };
  }
}
