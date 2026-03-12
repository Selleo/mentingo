import { Controller, Get, UseGuards } from "@nestjs/common";

import { AnalyticsSecretGuard } from "src/analytics/decorators/analytics-secret.decorator";
import { AnalyticsService } from "src/analytics/services/analytics.service";
import { Public } from "src/common/decorators/public.decorator";
import { PERMISSIONS } from "src/permission/permission.constants";
import { RequirePermission } from "src/permission/permission.decorator";
import { PermissionsGuard } from "src/permission/permission.guard";

@UseGuards(AnalyticsSecretGuard)
@UseGuards(PermissionsGuard)
@Controller("analytics")
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Public()
  @Get("active-users")
  @RequirePermission(PERMISSIONS.ANALYTICS_READ)
  async getActiveUsers() {
    return this.analyticsService.getActiveUsersCount();
  }
}
