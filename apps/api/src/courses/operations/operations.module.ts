import { forwardRef, Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";

import { ChapterModule } from "src/chapter/chapter.module";
import { EnvModule } from "src/env/env.module";
import { FileModule } from "src/file/files.module";
import { LessonModule } from "src/lesson/lesson.module";
import { LocalizationModule } from "src/localization/localization.module";
import { StatisticsModule } from "src/statistics/statistics.module";
import { StripeModule } from "src/stripe/stripe.module";
import { UserModule } from "src/user/user.module";

import { EnrollGroupsToCourseCommand } from "./commands/enroll-groups-to-course.command";
import { UnenrollGroupsFromCoursesCommand } from "./commands/unenroll-groups-from-courses.command";
import { UpdateCourseCommand } from "./commands/update-course-command";
import { GetAllCoursesQuery } from "./queries/get-all-courses.query";
import { GetAvailableCoursesQuery } from "./queries/get-available-courses.query";
import { GetBetaCourseByIdQuery } from "./queries/get-beta-course-by-id.query";
import { GetContentCreatorCoursesQuery } from "./queries/get-content-creator-courses.query";
import { GetCourseQuery } from "./queries/get-course.query";
import { GetCoursesForUserQuery } from "./queries/get-courses-for-user.query";
import { GetStudentsWithEnrollmentDateQuery } from "./queries/get-students-with-enrollment-date.query";


const queryServices = [
  GetAllCoursesQuery,
  GetAvailableCoursesQuery,
  GetBetaCourseByIdQuery,
  GetContentCreatorCoursesQuery,
  GetCourseQuery,
  GetCoursesForUserQuery,
  GetStudentsWithEnrollmentDateQuery,
];

const updaterServices = [
  EnrollGroupsToCourseCommand,
  UnenrollGroupsFromCoursesCommand,
  UpdateCourseCommand,
];

@Module({
  imports: [
    FileModule,
    LocalizationModule,
    LessonModule,
    StatisticsModule,
    EnvModule,
    CqrsModule,
    ChapterModule,  
    forwardRef(() => UserModule),
    forwardRef(() => StripeModule),
  ],
  providers: [...queryServices, ...updaterServices],
  exports: [...queryServices, ...updaterServices],
})
export class OperationsModule {}
