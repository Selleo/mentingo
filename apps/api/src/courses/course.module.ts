import { forwardRef, Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";

import { AiModule } from "src/ai/ai.module";
import { CertificatesModule } from "src/certificates/certificates.module";
import { ChapterModule } from "src/chapter/chapter.module";
import { EmailModule } from "src/common/emails/emails.module";
import { CourseHandler } from "src/courses/handlers/course.handler";
import { FileModule } from "src/file/files.module";
import { LearningTimeModule } from "src/learning-time/learning-time.module";
import { LessonModule } from "src/lesson/lesson.module";
import { LocalizationModule } from "src/localization/localization.module";
import { LocalizationService } from "src/localization/localization.service";
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
    LearningTimeModule,
    SettingsModule,
    LocalizationModule,
    CertificatesModule,
    EmailModule,
    CqrsModule,
    AiModule,
    forwardRef(() => StripeModule),
    forwardRef(() => UserModule),
  ],
  controllers: [CourseController],
  providers: [CourseService, CourseHandler, LocalizationService, CourseCron],
  exports: [CourseService],
})
export class CourseModule {}
