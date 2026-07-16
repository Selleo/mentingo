import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import { PermissionsBackfillService } from "src/permissions/permissions-backfill.service";
import { DatabaseMigrationService } from "src/storage/db/database-migration.service";

@Injectable()
export class AppStartupService implements OnModuleInit {
  private readonly logger = new Logger(AppStartupService.name);

  constructor(
    private readonly databaseMigrationService: DatabaseMigrationService,
    private readonly permissionsBackfillService: PermissionsBackfillService,
  ) {}

  async onModuleInit() {
    if (this.shouldSkipStartupMaintenance()) {
      this.logger.warn("Skipping startup database maintenance");
      return;
    }

    await this.databaseMigrationService.runMigrations();

    const { insertedCount, tenantCount } =
      await this.permissionsBackfillService.backfillMissingPermissionsForAllTenants();

    if (insertedCount > 0) {
      this.logger.warn(
        `Backfilled ${insertedCount} missing permission rows across ${tenantCount} tenants`,
      );
      return;
    }

    this.logger.log(`Permission backfill found no missing rows across ${tenantCount} tenants`);
  }

  private shouldSkipStartupMaintenance() {
    return Boolean(process.env.JEST_WORKER_ID) || process.env.BUILD_VERIFICATION === "true";
  }
}
