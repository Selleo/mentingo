import { Module } from "@nestjs/common";

import { DisallowInSupportModeGuard } from "src/common/guards/disallow-support-mode.guard";

import { DashboardController } from "./dashboard.controller";
import { DashboardRepository } from "./dashboard.repository";
import { DashboardService } from "./dashboard.service";

@Module({
  controllers: [DashboardController],
  providers: [DashboardRepository, DashboardService, DisallowInSupportModeGuard],
  exports: [DashboardRepository, DashboardService],
})
export class DashboardModule {}
