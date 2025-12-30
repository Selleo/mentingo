import { Module } from "@nestjs/common";

import { LocalizationModule } from "src/localization/localization.module";

import { ReportController } from "./report.controller";
import { ReportService } from "./report.service";
import { ReportRepository } from "./repositories/report.repository";

@Module({
  imports: [LocalizationModule],
  controllers: [ReportController],
  providers: [ReportRepository, ReportService],
  exports: [ReportService],
})
export class ReportModule {}
