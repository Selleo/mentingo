import { Module } from "@nestjs/common";

import { BunnyStreamModule } from "src/bunny/bunnyStream.module";
import { BunnyStreamService } from "src/bunny/bunnyStream.service";
import { EmailModule } from "src/common/emails/emails.module";
import { FileModule } from "src/file/files.module";
import { LocalizationModule } from "src/localization/localization.module";
import { S3Module } from "src/s3/s3.module";
import { S3Service } from "src/s3/s3.service";
import { StatisticsModule } from "src/statistics/statistics.module";

import { SettingsController } from "./settings.controller";
import { SettingsService } from "./settings.service";

@Module({
  imports: [
    EmailModule,
    FileModule,
    S3Module,
    BunnyStreamModule,
    StatisticsModule,
    LocalizationModule,
  ],
  controllers: [SettingsController],
  providers: [SettingsService, S3Service, BunnyStreamService],
  exports: [SettingsService],
})
export class SettingsModule {}
