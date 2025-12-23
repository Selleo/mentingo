import { Controller, Get, UseGuards } from "@nestjs/common";

import { AnalyticsSecretGuard } from "src/analytics/decorators/analytics-secret.decorator";
import { AnalyticsService } from "src/analytics/services/analytics.service";
import { Public } from "src/common/decorators/public.decorator";

@UseGuards(AnalyticsSecretGuard)
@Controller("analytics")
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Public()
  @Get("active-users")
  async getActiveUsers() {
    return this.analyticsService.getActiveUsersCount();
  }
}
