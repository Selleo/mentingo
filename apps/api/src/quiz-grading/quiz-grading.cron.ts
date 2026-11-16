import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { QuizGradingDigestService } from "./quiz-grading-digest.service";

@Injectable()
export class QuizGradingCron {
  private readonly logger = new Logger(QuizGradingCron.name);

  constructor(
    private readonly quizGradingDigestService: QuizGradingDigestService,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
  ) {}

  // A failing tenant must not stop the digest of the tenants after it.
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async sendGradingDigestPerDay() {
    await this.tenantDbRunnerService.runForEachTenant(async (tenantId) => {
      try {
        await this.quizGradingDigestService.sendGradingDigest();
      } catch (error) {
        this.logger.error(
          `[tenant=${tenantId}] Quiz grading digest failed: ${error}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    });
  }
}
