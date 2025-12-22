import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";

import { CertificatesModule } from "src/certificates/certificates.module";
import { LocalizationModule } from "src/localization/localization.module";
import { LocalizationService } from "src/localization/localization.service";
import { StatisticsModule } from "src/statistics/statistics.module";

import { LessonDeletedProgressHandler } from "./handlers/lesson-deleted-progress.handler";
import { StudentLessonProgressController } from "./studentLessonProgress.controller";
import { StudentLessonProgressService } from "./studentLessonProgress.service";

@Module({
  imports: [StatisticsModule, CertificatesModule, LocalizationModule, CqrsModule],
  controllers: [StudentLessonProgressController],
  providers: [StudentLessonProgressService, LocalizationService, LessonDeletedProgressHandler],
  exports: [StudentLessonProgressService],
})
export class StudentLessonProgressModule {}
