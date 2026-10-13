import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { AutomationRecoveryAndCleanupService } from "./services/automation-recovery-and-cleanup.service";

@Injectable()
export class AutomationRecoveryAndCleanupCron {
  constructor(
    private readonly automationRecoveryAndCleanupService: AutomationRecoveryAndCleanupService,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async recoverInterruptedAutomationDeliveries(): Promise<void> {
    await this.automationRecoveryAndCleanupService.recoverInterruptedAutomationDeliveries();
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeExpiredAutomationRuns(): Promise<void> {
    await this.automationRecoveryAndCleanupService.purgeExpiredAutomationRuns();
  }
}
