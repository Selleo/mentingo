import { forwardRef, Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";

import { CertificatesModule } from "src/certificates/certificates.module";
import { ChapterModule } from "src/chapter/chapter.module";
import { CourseHandler } from "src/courses/handlers/course.handler";
import { EnvModule } from "src/env/env.module";
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
import { EnrollGroupsToCourseCommand } from "./operations/commands/enroll-groups-to-course.command";
import { UnenrollGroupsFromCoursesCommand } from "./operations/commands/unenroll-groups-from-courses.command";
import { UpdateCourseCommand } from "./operations/commands/update-course-command";
import { GetAllCoursesQuery } from "./operations/queries/get-all-courses.query";
import { GetAvailableCoursesQuery } from "./operations/queries/get-available-courses.query";
import { GetBetaCourseByIdQuery } from "./operations/queries/get-beta-course-by-id.query";
import { GetContentCreatorCoursesQuery } from "./operations/queries/get-content-creator-courses.query";
import { GetCourseQuery } from "./operations/queries/get-course.query";
import { GetCoursesForUserQuery } from "./operations/queries/get-courses-for-user.query";
import { GetStudentsWithEnrollmentDateQuery } from "./operations/queries/get-students-with-enrollment-date.query";

const queries = [
  GetAllCoursesQuery,
  GetAvailableCoursesQuery,
  GetBetaCourseByIdQuery,
  GetContentCreatorCoursesQuery,
  GetCourseQuery,
  GetCoursesForUserQuery,
  GetStudentsWithEnrollmentDateQuery,
];

const commands = [
  EnrollGroupsToCourseCommand,
  UnenrollGroupsFromCoursesCommand,
  UpdateCourseCommand,
];

@Module({
  imports: [
    FileModule,
    StatisticsModule,
    ChapterModule,
    LessonModule,
    SettingsModule,
    LocalizationModule,
    CertificatesModule,
    EnvModule,
    CqrsModule,
    forwardRef(() => StripeModule),
    forwardRef(() => UserModule),
  ],
  controllers: [CourseController],
  providers: [CourseService, CourseHandler, LocalizationService, ...queries, ...commands],
  exports: [CourseService],
})
export class CourseModule {}
