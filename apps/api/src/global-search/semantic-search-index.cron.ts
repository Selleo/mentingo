import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { isSemanticSearchBackgroundIndexingEnabled } from "./semantic-search-index.config";
import { SEMANTIC_SEARCH_BATCH_SIZE } from "./semantic-search-index.constants";
import { SemanticSearchIndexQueueService } from "./semantic-search-index.queue.service";

@Injectable()
export class SemanticSearchIndexCron {
  private readonly logger = new Logger(SemanticSearchIndexCron.name);
  private running = false;
  private nextTenant = 0;
  private readonly offsets = new Map<string, number>();

  constructor(
    private readonly service: SemanticSearchIndexQueueService,
    private readonly tenants: TenantDbRunnerService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async reconcile() {
    if (!isSemanticSearchBackgroundIndexingEnabled()) return;
    if (this.running) return;
    this.running = true;
    try {
      const tenantIds: string[] = [];
      await this.tenants.runForEachTenant(async (tenantId) => {
        tenantIds.push(tenantId);
      });
      if (tenantIds.length) this.nextTenant %= tenantIds.length;
      const ordered = [...tenantIds.slice(this.nextTenant), ...tenantIds.slice(0, this.nextTenant)];
      this.nextTenant++;
      for (const tenantId of ordered) {
        await this.tenants.runWithTenant(tenantId, async () => {
          try {
            const offset = this.offsets.get(tenantId) ?? 0;
            const result = await this.service.reconcile(tenantId, { offset });
            this.offsets.set(
              tenantId,
              result.pending < SEMANTIC_SEARCH_BATCH_SIZE ? 0 : offset + result.pending,
            );
          } catch {
            this.logger.warn(
              `Semantic search reconciliation failed for tenant ${tenantId}; next cycle will retry`,
            );
          }
        });
      }
    } finally {
      this.running = false;
    }
  }
}
