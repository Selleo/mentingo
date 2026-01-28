import { Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";

import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { StatisticsService } from "./statistics.service";

@Injectable()
export class StatisticsCron {
  constructor(
    private readonly statisticsService: StatisticsService,
    private readonly tenantRunner: TenantDbRunnerService,
  ) {}

  @Cron("0 0 * * *")
  async refreshCourseStudentsStats() {
    await this.tenantRunner.runForEachTenant(async () => {
      await this.statisticsService.refreshCourseStudentsStats();
    });
  }
}
