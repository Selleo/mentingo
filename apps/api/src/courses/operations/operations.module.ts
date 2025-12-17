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

import { GetAllCoursesService } from "./queries/get-all-courses.service";
import { GetAvailableCoursesService } from "./queries/get-available-courses.service";
import { GetBetaCourseByIdService } from "./queries/get-beta-course-by-id.service";
import { GetContentCreatorCoursesService } from "./queries/get-content-creator-courses.service";
import { GetCourseService } from "./queries/get-course.service";
import { GetCoursesForUserService } from "./queries/get-courses-for-user.service";
import { GetStudentsWithEnrollmentDateService } from "./queries/get-students-with-enrollment-date.service";
import { EnrollGroupsToCourseService } from "./updaters/enroll-groups-to-course.service";
import { UnenrollGroupsFromCoursesService } from "./updaters/unenroll-groups-from-courses.service";
import { UpdateCourseService } from "./updaters/update-course-service";


const queryServices = [
  GetAllCoursesService,
  GetAvailableCoursesService,
  GetBetaCourseByIdService,
  GetContentCreatorCoursesService,
  GetCourseService,
  GetCoursesForUserService,
  GetStudentsWithEnrollmentDateService,
];

const updaterServices = [
  EnrollGroupsToCourseService,
  UnenrollGroupsFromCoursesService,
  UpdateCourseService,
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
