import { forwardRef, Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";

import { AiModule } from "src/ai/ai.module";
import { AnnouncementsModule } from "src/announcements/announcements.module";
import { BunnyStreamModule } from "src/bunny/bunnyStream.module";
import { CertificatesModule } from "src/certificates/certificates.module";
import { ChapterModule } from "src/chapter/chapter.module";
import { EmailModule } from "src/common/emails/emails.module";
import { ManagingTenantAdminGuard } from "src/common/guards/managing-tenant-admin.guard";
import { CourseTransferModule } from "src/course-transfer/course-transfer.module";
import { CourseDurationModule } from "src/courses/duration/course-duration.module";
import { CourseHandler } from "src/courses/handlers/course.handler";
import { MasterCourseSyncHandler } from "src/courses/master-course/master-course-sync.handler";
import { FileModule } from "src/file/files.module";
import { SearchIndexModule } from "src/global-search/search-index.module";
import { LearningTimeModule } from "src/learning-time/learning-time.module";
import { LessonModule } from "src/lesson/lesson.module";
import { LocalizationModule } from "src/localization/localization.module";
import { LocalizationService } from "src/localization/localization.service";
import { S3Module } from "src/s3/s3.module";
import { SettingsModule } from "src/settings/settings.module";
import { StatisticsModule } from "src/statistics/statistics.module";
import { StripeModule } from "src/stripe/stripe.module";
import { UserModule } from "src/user/user.module";
import { WebSocketModule } from "src/websocket";

import { CourseAuthorRepository } from "./authors/course-author.repository";
import { CourseAuthorService } from "./authors/course-author.service";
import { CourseCatalogRepository } from "./catalog/course-catalog.repository";
import { CourseCatalogService } from "./catalog/course-catalog.service";
import { CourseMediaUrlService } from "./catalog/course-media-url.service";
import { CourseMediaRepository } from "./catalog/course-media.repository";
import { CourseController } from "./course.controller";
import { CourseCron } from "./course.cron";
import { CourseService } from "./course.service";
import { CourseDetailRepository } from "./detail/course-detail.repository";
import { CourseDetailService } from "./detail/course-detail.service";
import { CourseLessonMediaService } from "./detail/course-lesson-media.service";
import { CourseDueDateNotificationRepository } from "./due-dates/course-due-date-notification.repository";
import { CourseDueDateNotificationService } from "./due-dates/course-due-date-notification.service";
import { CourseDueDateReminderEmailHandler } from "./due-dates/course-due-date-reminder-email.handler";
import { GroupCourseDueDateCalendarService } from "./due-dates/group-course-due-date-calendar.service";
import { CourseDuplicationQueueService } from "./duplication/course-duplication.queue.service";
import { CourseDuplicationRepository } from "./duplication/course-duplication.repository";
import { CourseDuplicationService } from "./duplication/course-duplication.service";
import { CourseDuplicationWorker } from "./duplication/course-duplication.worker";
import { CourseActivitySnapshotService } from "./editing/course-activity-snapshot.service";
import { CourseBulkEditingRepository } from "./editing/course-bulk-editing.repository";
import { CourseBulkEditingService } from "./editing/course-bulk-editing.service";
import { CourseDeletionRepository } from "./editing/course-deletion.repository";
import { CourseDeletionService } from "./editing/course-deletion.service";
import { CourseEditingRepository } from "./editing/course-editing.repository";
import { CourseEditingService } from "./editing/course-editing.service";
import { CourseFeaturePolicyService } from "./editing/course-feature-policy.service";
import { CourseSlugService } from "./editing/course-slug.service";
import { CourseEnrollmentRepository } from "./enrollment/course-enrollment.repository";
import { CourseEnrollmentService } from "./enrollment/course-enrollment.service";
import { CourseLearnerDashboardRepository } from "./enrollment/course-learner-dashboard.repository";
import { CourseLearnerDashboardService } from "./enrollment/course-learner-dashboard.service";
import { CourseStudentModeRepository } from "./enrollment/course-student-mode.repository";
import { CourseStudentModeService } from "./enrollment/course-student-mode.service";
import { MasterCourseQueueService } from "./master-course/master-course.queue.service";
import { MasterCourseRepository } from "./master-course/master-course.repository";
import { MasterCourseService } from "./master-course/master-course.service";
import { MasterCourseWorker } from "./master-course/master-course.worker";
import { CourseScormAssetsService } from "./scorm-export/course-scorm-assets.service";
import { CourseScormExportService } from "./scorm-export/course-scorm-export.service";
import { CourseScormSnapshotRepository } from "./scorm-export/course-scorm-snapshot.repository";
import { CourseScormSnapshotService } from "./scorm-export/course-scorm-snapshot.service";
import { CourseStatisticsRepository } from "./statistics/course-statistics.repository";
import { CourseStatisticsService } from "./statistics/course-statistics.service";
import { CourseTranslationRepository } from "./translations/course-translation.repository";
import { CourseTranslationService } from "./translations/course-translation.service";

@Module({
  imports: [
    CourseTransferModule,
    CourseDurationModule,
    BunnyStreamModule,
    FileModule,
    StatisticsModule,
    forwardRef(() => ChapterModule),
    forwardRef(() => LessonModule),
    LearningTimeModule,
    S3Module,
    SettingsModule,
    LocalizationModule,
    CertificatesModule,
    AnnouncementsModule,
    EmailModule,
    SearchIndexModule,
    CqrsModule,
    AiModule,
    forwardRef(() => StripeModule),
    forwardRef(() => UserModule),
    WebSocketModule,
  ],
  controllers: [CourseController],
  providers: [
    CourseService,
    CourseScormAssetsService,
    CourseScormExportService,
    CourseScormSnapshotRepository,
    CourseScormSnapshotService,
    CourseFeaturePolicyService,
    CourseDuplicationQueueService,
    CourseDuplicationRepository,
    CourseDuplicationService,
    CourseDuplicationWorker,
    CourseSlugService,
    GroupCourseDueDateCalendarService,
    CourseHandler,
    CourseDueDateReminderEmailHandler,
    LocalizationService,
    CourseCron,
    MasterCourseService,
    MasterCourseRepository,
    CourseTranslationRepository,
    CourseTranslationService,
    CourseDueDateNotificationRepository,
    CourseDueDateNotificationService,
    CourseAuthorRepository,
    CourseAuthorService,
    CourseStudentModeRepository,
    CourseStudentModeService,
    CourseStatisticsRepository,
    CourseStatisticsService,
    CourseEnrollmentRepository,
    CourseEnrollmentService,
    CourseEditingRepository,
    CourseActivitySnapshotService,
    CourseEditingService,
    CourseBulkEditingRepository,
    CourseBulkEditingService,
    CourseDeletionRepository,
    CourseDeletionService,
    CourseMediaRepository,
    CourseMediaUrlService,
    CourseCatalogRepository,
    CourseCatalogService,
    CourseLessonMediaService,
    CourseDetailRepository,
    CourseDetailService,
    CourseLearnerDashboardRepository,
    CourseLearnerDashboardService,
    MasterCourseQueueService,
    MasterCourseWorker,
    MasterCourseSyncHandler,
    ManagingTenantAdminGuard,
  ],
  exports: [
    CourseService,
    CourseFeaturePolicyService,
    CourseSlugService,
    CourseTranslationService,
    MasterCourseService,
    MasterCourseRepository,
  ],
})
export class CourseModule {}
