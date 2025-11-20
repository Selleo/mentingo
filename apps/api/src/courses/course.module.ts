import { forwardRef, Module } from "@nestjs/common";

import { ChapterModule } from "src/chapter/chapter.module";
import { FileModule } from "src/file/files.module";
import { LessonModule } from "src/lesson/lesson.module";
import { LocalizationModule } from "src/localization/localization.module";
import { LocalizationService } from "src/localization/localization.service";
import { SettingsModule } from "src/settings/settings.module";
import { StatisticsModule } from "src/statistics/statistics.module";
import { StripeModule } from "src/stripe/stripe.module";
import { UserModule } from "src/user/user.module";

import { CourseController } from "./course.controller";
import { CourseService } from "./course.service";

@Module({
  imports: [
    FileModule,
    StatisticsModule,
    ChapterModule,
    LessonModule,
    SettingsModule,
    LocalizationModule,
    forwardRef(() => StripeModule),
    forwardRef(() => UserModule),
  ],
  controllers: [CourseController],
  providers: [CourseService, LocalizationService],
  exports: [CourseService],
})
export class CourseModule {}
