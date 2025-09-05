import { Module } from "@nestjs/common";

import { EmailModule } from "src/common/emails/emails.module";
import { StatisticsModule } from "src/statistics/statistics.module";
import { UserModule } from "src/user/user.module";

import { StudentLessonProgressController } from "./studentLessonProgress.controller";
import { StudentLessonProgressService } from "./studentLessonProgress.service";

@Module({
  imports: [StatisticsModule, UserModule, EmailModule],
  controllers: [StudentLessonProgressController],
  providers: [StudentLessonProgressService],
  exports: [StudentLessonProgressService],
})
export class StudentLessonProgressModule {}
