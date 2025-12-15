import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";

import { FileModule } from "src/file/files.module";
import { LocalizationModule } from "src/localization/localization.module";
import { LocalizationService } from "src/localization/localization.service";
import { StatisticsRepository } from "src/statistics/repositories/statistics.repository";

import { StatisticsHandler } from "./handlers/statistics.handler";
import { StatisticsController } from "./statistics.controller";
import { StatisticsCron } from "./statistics.cron";
import { StatisticsService } from "./statistics.service";

@Module({
  imports: [CqrsModule, FileModule, LocalizationModule],
  controllers: [StatisticsController],
  providers: [
    StatisticsHandler,
    StatisticsRepository,
    StatisticsService,
    StatisticsCron,
    LocalizationService,
  ],
  exports: [StatisticsRepository, StatisticsService],
})
export class StatisticsModule {}
