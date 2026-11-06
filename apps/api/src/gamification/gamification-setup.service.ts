import { Injectable, Logger } from "@nestjs/common";

import { dbAls } from "src/storage/db/db-als.store";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { GamificationQueueService } from "./gamification-queue.service";
import { GamificationService } from "./gamification.service";

@Injectable()
export class GamificationSetupService {
  private readonly logger = new Logger(GamificationSetupService.name);

  constructor(
    private readonly tenantDbRunnerService: TenantDbRunnerService,
    private readonly gamificationService: GamificationService,
    private readonly gamificationQueueService: GamificationQueueService,
  ) {}

  async ensurePredefinedAchievementsForAllTenants() {
    await this.tenantDbRunnerService.runForEachTenant(() =>
      this.ensureTenantPredefinedAchievements(),
    );
  }

  /** A new tenant has no activity yet, so it only needs the achievements, not a backfill. */
  async seedNewTenantPredefinedAchievements() {
    await this.gamificationService.ensurePredefinedAchievements();
  }

  /** Seeds the current tenant and backfills rewards for activity that predates new achievements. */
  async ensureTenantPredefinedAchievements() {
    const tenantId = dbAls.getStore()?.tenantId;

    if (!tenantId) return;

    const insertedCount = await this.gamificationService.ensurePredefinedAchievements();

    if (insertedCount === 0) return;

    this.logger.log(`Seeded ${insertedCount} predefined achievements for tenant ${tenantId}`);
    await this.gamificationQueueService.enqueueRecalculateTenant({ tenantId });
  }
}
