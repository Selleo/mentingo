import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { TenantsService } from "./tenants.service";

@Injectable()
export class TenantAccessEndCron {
  private readonly logger = new Logger(TenantAccessEndCron.name);

  constructor(private readonly tenantsService: TenantsService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async deactivateTenantsWithEndedAccess() {
    const deactivatedCount = await this.tenantsService.deactivateTenantsWithEndedAccess();

    if (deactivatedCount > 0)
      this.logger.log(`Deactivated ${deactivatedCount} tenants whose access ended.`);
  }
}
