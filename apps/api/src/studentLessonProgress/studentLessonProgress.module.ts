import { Module } from "@nestjs/common";

import { CertificatesModule } from "src/certificates/certificates.module";
import { StatisticsModule } from "src/statistics/statistics.module";

import { StudentLessonProgressController } from "./studentLessonProgress.controller";
import { StudentLessonProgressService } from "./studentLessonProgress.service";

@Module({
  imports: [StatisticsModule, CertificatesModule],
  controllers: [StudentLessonProgressController],
  providers: [StudentLessonProgressService],
  exports: [StudentLessonProgressService],
})
export class StudentLessonProgressModule {}
