/** Reclaims abandoned native staging without touching applied assets or linked Mentor material. */
import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { IngestionProcessingService } from "src/ingestion/services/ingestion-processing.service";
import { S3Service } from "src/s3/s3.service";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { CourseAuthoringApplicationRepository } from "./course-authoring-application.repository";

const STAGING_RECOVERY_DAYS = 7;

@Injectable()
export class CourseAuthoringStagingCleanupService {
  private readonly logger = new Logger(CourseAuthoringStagingCleanupService.name);
  private scanning = false;

  /** Uses tenant-scoped persistence and the existing S3 client for aged staging cleanup. */
  constructor(
    private readonly tenants: TenantDbRunnerService,
    private readonly ingestion: IngestionProcessingService,
    private readonly receipts: CourseAuthoringApplicationRepository,
    private readonly storage: S3Service,
  ) {}

  /** Deletes one bounded indexed batch of expired staging entries per tenant. */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanExpiredStaging() {
    if (this.scanning) return;
    this.scanning = true;
    const before = new Date(Date.now() - STAGING_RECOVERY_DAYS * 24 * 60 * 60 * 1000);
    try {
      await this.tenants.runForEachTenant(async (tenantId) => {
        try {
          await this.tenants.runWithTenant(tenantId, async () => {
            await this.ingestion.cleanExpiredAuthoringDocuments(before.toISOString());
            const assets = await this.receipts.expiredStagedAssets(tenantId, before);
            for (const asset of assets) {
              await this.receipts.cleanExpiredStagedAsset(tenantId, asset.id, before, (key) =>
                this.storage.deleteFile(key),
              );
            }
          });
        } catch {
          this.logger.warn("A tenant authoring staging scan will retry tomorrow");
        }
      });
    } catch {
      this.logger.warn("Course authoring staging scan will retry tomorrow");
    } finally {
      this.scanning = false;
    }
  }
}
