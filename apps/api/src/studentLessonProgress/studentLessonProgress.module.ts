import { Module } from "@nestjs/common";

import { CertificatesModule } from "src/certificates/certificates.module";
import { LocalizationModule } from "src/localization/localization.module";
import { LocalizationService } from "src/localization/localization.service";
import { StatisticsModule } from "src/statistics/statistics.module";

import { StudentLessonProgressController } from "./studentLessonProgress.controller";
import { StudentLessonProgressService } from "./studentLessonProgress.service";

@Module({
  imports: [StatisticsModule, CertificatesModule, LocalizationModule],
  controllers: [StudentLessonProgressController],
  providers: [StudentLessonProgressService, LocalizationService],
  exports: [StudentLessonProgressService],
})
export class StudentLessonProgressModule {}
