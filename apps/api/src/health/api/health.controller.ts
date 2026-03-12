import { Controller, Get, UseGuards } from "@nestjs/common";
import { HealthCheckService, HealthCheck } from "@nestjs/terminus";

import { Public } from "src/common/decorators/public.decorator";
import { PERMISSIONS } from "src/permission/permission.constants";
import { RequirePermission } from "src/permission/permission.decorator";
import { PermissionsGuard } from "src/permission/permission.guard";

@UseGuards(PermissionsGuard)
@Controller("healthcheck")
export class HealthController {
  constructor(private health: HealthCheckService) {}

  @Get()
  @HealthCheck()
  @Public()
  @RequirePermission(PERMISSIONS.HEALTH_READ)
  async check() {
    return this.health.check([]);
  }
}
