import { forwardRef, Module } from "@nestjs/common";

import { CertificatesModule } from "src/certificates/certificates.module";
import { ChapterModule } from "src/chapter/chapter.module";
import { CourseHandler } from "src/courses/handlers/course.handler";
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
import { GetAllCoursesService } from "./operations/queries";
import { GetAvailableCoursesService } from "./operations/queries/get-available-courses.service";
import { GetBetaCourseByIdService } from "./operations/queries/get-beta-course-by-id.service";
import { GetContentCreatorCoursesService } from "./operations/queries/get-content-creator-courses.service";
import { GetCourseService } from "./operations/queries/get-course.service";
import { GetCoursesForUserService } from "./operations/queries/get-courses-for-user.service";
import { GetStudentsWithEnrollmentDateService } from "./operations/queries/get-students-with-enrollment-date.service";
import { EnrollGroupsToCourseService } from "./operations/updaters/enroll-groups-to-course.service";
import { UnenrollGroupsFromCoursesService } from "./operations/updaters/unenroll-groups-from-courses.service";
import { UpdateCourseService } from "./operations/updaters/update-course-service";

@Module({
  imports: [
    FileModule,
    StatisticsModule,
    ChapterModule,
    LessonModule,
    SettingsModule,
    LocalizationModule,
    CertificatesModule,
    forwardRef(() => StripeModule),
    forwardRef(() => UserModule),
  ],
  controllers: [CourseController],
  providers: [
    CourseService,
    CourseHandler,
    LocalizationService,
    GetAllCoursesService,
    GetStudentsWithEnrollmentDateService,
    GetCoursesForUserService,
    GetAvailableCoursesService,
    GetCourseService,
    GetBetaCourseByIdService,
    GetContentCreatorCoursesService,
    UpdateCourseService,
    EnrollGroupsToCourseService,
    UnenrollGroupsFromCoursesService,
  ],
  exports: [CourseService],
})
export class CourseModule {}
