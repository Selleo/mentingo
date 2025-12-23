import { Module } from "@nestjs/common";

import { AnalyticsSecretGuard } from "src/analytics/decorators/analytics-secret.decorator";
import { AnalyticsRepository } from "src/analytics/repositories/analytics.repository";
import { AnalyticsService } from "src/analytics/services/analytics.service";

import { AnalyticsController } from "./analytics.controller";

@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AnalyticsRepository, AnalyticsSecretGuard],
})
export class AnalyticsModule {}
