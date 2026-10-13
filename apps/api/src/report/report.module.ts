import { Module } from "@nestjs/common";

import { LocalizationModule } from "src/localization/localization.module";
import { PermissionsModule } from "src/permissions/permissions.module";
import { QueueModule } from "src/queue/queue.module";
import { S3Module } from "src/s3/s3.module";

import { ReportController } from "./report.controller";
import { ReportService } from "./report.service";
import { ReportsConfigurationsService } from "./reports-configurations.service";
import { ReportsExportRenderer } from "./reports-export.renderer";
import { ReportsExportWorker } from "./reports-export.worker";
import { ReportsExportsCron } from "./reports-exports.cron";
import { ReportsExportsService } from "./reports-exports.service";
import { ReportsQueryService } from "./reports-query.service";
import { ReportRepository } from "./repositories/report.repository";
import { ReportsConfigurationsRepository } from "./repositories/reports-configurations.repository";
import { ReportsExportsRepository } from "./repositories/reports-exports.repository";
import { ReportsQueryOptionsRepository } from "./repositories/reports-query.options.repository";
import { ReportsQueryRepository } from "./repositories/reports-query.repository";
import { ReportsQueryScopeRepository } from "./repositories/reports-query.scope.repository";

@Module({
  imports: [LocalizationModule, PermissionsModule, QueueModule, S3Module],
  controllers: [ReportController],
  providers: [
    ReportRepository,
    ReportService,
    ReportsQueryRepository,
    ReportsQueryOptionsRepository,
    ReportsQueryScopeRepository,
    ReportsQueryService,
    ReportsConfigurationsRepository,
    ReportsConfigurationsService,
    ReportsExportsRepository,
    ReportsExportsService,
    ReportsExportsCron,
    ReportsExportRenderer,
    ReportsExportWorker,
  ],
  exports: [ReportService],
})
export class ReportModule {}
