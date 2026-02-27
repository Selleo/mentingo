import { forwardRef, Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";

import { AiModule } from "src/ai/ai.module";
import { CertificatesModule } from "src/certificates/certificates.module";
import { ChapterModule } from "src/chapter/chapter.module";
import { EmailModule } from "src/common/emails/emails.module";
import { ManagingTenantAdminGuard } from "src/common/guards/managing-tenant-admin.guard";
import { CourseHandler } from "src/courses/handlers/course.handler";
import { MasterCourseSyncHandler } from "src/courses/handlers/master-course-sync.handler";
import { FileModule } from "src/file/files.module";
import { LearningTimeModule } from "src/learning-time/learning-time.module";
import { LessonModule } from "src/lesson/lesson.module";
import { LocalizationModule } from "src/localization/localization.module";
import { LocalizationService } from "src/localization/localization.service";
import { LumaModule } from "src/luma/luma.module";
import { SettingsModule } from "src/settings/settings.module";
import { StatisticsModule } from "src/statistics/statistics.module";
import { StripeModule } from "src/stripe/stripe.module";
import { UserModule } from "src/user/user.module";

import { CourseSlugService } from "./course-slug.service";
import { CourseController } from "./course.controller";
import { CourseCron } from "./course.cron";
import { CourseService } from "./course.service";
import { MasterCourseQueueService } from "./master-course.queue.service";
import { MasterCourseRepository } from "./master-course.repository";
import { MasterCourseService } from "./master-course.service";
import { MasterCourseWorker } from "./master-course.worker";

@Module({
  imports: [
    LumaModule,
    FileModule,
    StatisticsModule,
    forwardRef(() => ChapterModule),
    forwardRef(() => LessonModule),
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
  providers: [
    CourseService,
    CourseSlugService,
    CourseHandler,
    LocalizationService,
    CourseCron,
    MasterCourseService,
    MasterCourseRepository,
    MasterCourseQueueService,
    MasterCourseWorker,
    MasterCourseSyncHandler,
    ManagingTenantAdminGuard,
  ],
  exports: [CourseService, CourseSlugService, MasterCourseService],
})
export class CourseModule {}
