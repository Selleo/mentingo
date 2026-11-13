import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { QuizGradingDigestService } from "./quiz-grading-digest.service";

@Injectable()
export class QuizGradingCron {
  constructor(
    private readonly quizGradingDigestService: QuizGradingDigestService,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async sendGradingDigestPerDay() {
    await this.tenantDbRunnerService.runForEachTenant(async () => {
      await this.quizGradingDigestService.sendGradingDigest();
    });
  }
}
