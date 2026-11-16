import { Module } from "@nestjs/common";

import { BunnyStreamModule } from "src/bunny/bunnyStream.module";
import { FileModule } from "src/file/files.module";
import { LocalizationModule } from "src/localization/localization.module";
import { SettingsModule } from "src/settings/settings.module";

import { CourseScormAssetsService } from "./course-scorm-assets.service";
import { CourseScormExportService } from "./course-scorm-export.service";
import { CourseScormSnapshotRepository } from "./course-scorm-snapshot.repository";
import { CourseScormSnapshotService } from "./course-scorm-snapshot.service";

@Module({
  imports: [BunnyStreamModule, FileModule, LocalizationModule, SettingsModule],
  providers: [
    CourseScormAssetsService,
    CourseScormExportService,
    CourseScormSnapshotRepository,
    CourseScormSnapshotService,
  ],
  exports: [CourseScormExportService],
})
export class CourseScormExportModule {}
