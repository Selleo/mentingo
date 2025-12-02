import { forwardRef, Module } from "@nestjs/common";

import { ChapterModule } from "src/chapter/chapter.module";
import { EmailModule } from "src/common/emails/emails.module";
import { FileModule } from "src/file/files.module";
import { LessonModule } from "src/lesson/lesson.module";
import { SettingsModule } from "src/settings/settings.module";
import { StatisticsModule } from "src/statistics/statistics.module";
import { StripeModule } from "src/stripe/stripe.module";
import { UserModule } from "src/user/user.module";

import { CourseController } from "./course.controller";
import { CourseCron } from "./course.cron";
import { CourseService } from "./course.service";

@Module({
  imports: [
    FileModule,
    StatisticsModule,
    ChapterModule,
    LessonModule,
    SettingsModule,
    EmailModule,
    forwardRef(() => StripeModule),
    forwardRef(() => UserModule),
  ],
  controllers: [CourseController],
  providers: [CourseService, CourseCron],
  exports: [CourseService],
})
export class CourseModule {}
