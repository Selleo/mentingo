import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { ReportsExportsService } from "./reports-exports.service";

@Injectable()
export class ReportsExportsCron {
  private cleanupInProgress = false;

  constructor(
    private readonly reportsExportsService: ReportsExportsService,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredArtifacts(): Promise<void> {
    if (this.cleanupInProgress) return;
    this.cleanupInProgress = true;
    try {
      await this.tenantDbRunnerService.runForEachTenant((tenantId) =>
        this.reportsExportsService.cleanupExpiredExportArtifactsForTenant(tenantId),
      );
    } finally {
      this.cleanupInProgress = false;
    }
  }
}
