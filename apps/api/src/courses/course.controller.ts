import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { SupportedLanguages } from "@repo/shared";
import { Type } from "@sinclair/typebox";
import { Request } from "express";
import { Validate } from "nestjs-typebox";

import {
  baseResponse,
  BaseResponse,
  nullResponse,
  paginatedResponse,
  PaginatedResponse,
  UUIDSchema,
  type UUIDType,
} from "src/common";
import { Public } from "src/common/decorators/public.decorator";
import { Roles } from "src/common/decorators/roles.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { RolesGuard } from "src/common/guards/roles.guard";
import { CurrentUser as CurrentUserType } from "src/common/types/current-user.type";
import { CourseService } from "src/courses/course.service";
import {
  allCoursesForContentCreatorSchema,
  allStudentAiMentorResultsSchema,
  allStudentCourseProgressionSchema,
  allStudentQuizResultsSchema,
  courseAverageQuizScoresSchema,
  enrolledCourseGroupsPayload,
  getCourseStatisticsSchema,
  getLessonSequenceEnabledSchema,
  supportedLanguagesSchema,
  EnrolledCourseGroupsPayload,
} from "src/courses/schemas/course.schema";
import {
  COURSE_ENROLLMENT_SCOPES,
  CourseEnrollmentScope,
  SortCourseFieldsOptions,
  SortEnrolledStudentsOptions,
  CoursesStatusOptions,
  sortCourseStudentProgressionOptions,
  SortCourseStudentProgressionOptions,
  sortCourseStudentQuizResultsOptions,
  SortCourseStudentQuizResultsOptions,
  sortCourseStudentAiMentorResultsOptions,
  SortCourseStudentAiMentorResultsOptions,
} from "src/courses/schemas/courseQuery";
import { CreateCourseBody, createCourseSchema } from "src/courses/schemas/createCourse.schema";
import {
  commonShowBetaCourseSchema,
  commonShowCourseSchema,
} from "src/courses/schemas/showCourseCommon.schema";
import { UpdateCourseBody, updateCourseSchema } from "src/courses/schemas/updateCourse.schema";
import {
  updateCourseSettingsSchema,
  type UpdateCourseSettings,
} from "src/courses/schemas/updateCourseSettings.schema";
import {
  allCoursesValidation,
  coursesValidation,
  studentCoursesValidation,
  studentsWithEnrolmentValidation,
} from "src/courses/validations/validations";
import { GroupsFilterSchema } from "src/group/group.types";
import {
  LearningTimeService,
  learningTimeStatisticsFilterOptionsSchema,
  learningTimeStatisticsSchema,
} from "src/learning-time";
import { USER_ROLES, UserRole } from "src/user/schemas/userRoles";

import { coursesSettingsSchema } from "./schemas/coursesSettings.schema";
import {
  CreateCoursesEnrollment,
  createCoursesEnrollmentSchema,
} from "./schemas/createCoursesEnrollment";

import type { EnrolledStudent } from "./schemas/enrolledStudent.schema";
import type { CoursesSettings } from "./types/settings";
import type {
  AllCoursesForContentCreatorResponse,
  AllCoursesResponse,
  AllStudentAiMentorResultsResponse,
  AllStudentCourseProgressionResponse,
  AllStudentCoursesResponse,
  AllStudentQuizResultsResponse,
  CourseStatisticsResponse,
  LessonSequenceEnabledResponse,
} from "src/courses/schemas/course.schema";
import type {
  CoursesFilterSchema,
  EnrolledStudentFilterSchema,
} from "src/courses/schemas/courseQuery";
import type {
  CommonShowBetaCourse,
  CommonShowCourse,
} from "src/courses/schemas/showCourseCommon.schema";

@Controller("course")
@UseGuards(RolesGuard)
export class CourseController {
  constructor(
    private readonly courseService: CourseService,
    private readonly learningTimeService: LearningTimeService,
  ) {}

  @Get("all")
  @Roles(USER_ROLES.ADMIN, USER_ROLES.CONTENT_CREATOR)
  @Validate(allCoursesValidation)
  async getAllCourses(
    @Query("title") title: string,
    @Query("description") description: string,
    @Query("searchQuery") searchQuery: string,
    @Query("category") category: string,
    @Query("author") author: string,
    @Query("creationDateRange") creationDateRange: string[],
    @Query("status") status: CoursesStatusOptions,
    @Query("sort") sort: SortCourseFieldsOptions,
    @Query("page") page: number,
    @Query("perPage") perPage: number,
    @Query("language") language: SupportedLanguages,
    @CurrentUser("userId") currentUserId: UUIDType,
    @CurrentUser("role") currentUserRole: UserRole,
  ): Promise<PaginatedResponse<AllCoursesResponse>> {
    const [creationDateRangeStart, creationDateRangeEnd] = creationDateRange || [];
    const filters: CoursesFilterSchema = {
      title,
      description,
      searchQuery,
      category,
      author,
      status,
      creationDateRange:
        creationDateRangeStart && creationDateRangeEnd
          ? [creationDateRangeStart, creationDateRangeEnd]
          : undefined,
    };

    const query = {
      filters,
      page,
      perPage,
      sort,
      currentUserId,
      currentUserRole,
      language,
    };

    const data = await this.courseService.getAllCourses(query);

    return new PaginatedResponse(data);
  }

  @Get("get-student-courses")
  @Validate(studentCoursesValidation)
  async getStudentCourses(
    @Query("title") title: string,
    @Query("description") description: string,
    @Query("searchQuery") searchQuery: string,
    @Query("category") category: string,
    @Query("author") author: string,
    @Query("creationDateRange[0]") creationDateRangeStart: string,
    @Query("creationDateRange[1]") creationDateRangeEnd: string,
    @Query("page") page: number,
    @Query("perPage") perPage: number,
    @Query("sort") sort: SortCourseFieldsOptions,
    @Query("language") language: SupportedLanguages,
    @CurrentUser("userId") currentUserId: UUIDType,
  ): Promise<PaginatedResponse<AllStudentCoursesResponse>> {
    const filters: CoursesFilterSchema = {
      title,
      description,
      searchQuery,
      category,
      author,
      creationDateRange:
        creationDateRangeStart && creationDateRangeEnd
          ? [creationDateRangeStart, creationDateRangeEnd]
          : undefined,
    };
    const query = { filters, page, perPage, sort, language };

    const data = await this.courseService.getCoursesForUser(query, currentUserId);

    return new PaginatedResponse(data);
  }

  @Roles(USER_ROLES.ADMIN)
  @Get(":courseId/students")
  @Validate(studentsWithEnrolmentValidation)
  async getStudentsWithEnrollmentDate(
    @Param("courseId") courseId: UUIDType,
    @Query("keyword") keyword: string,
    @Query("sort") sort: SortEnrolledStudentsOptions,
    @Query("groups") groups: GroupsFilterSchema,
    @Query("page") page: number,
    @Query("perPage") perPage: number,
  ): Promise<PaginatedResponse<EnrolledStudent[]>> {
    const filters: EnrolledStudentFilterSchema = {
      keyword,
      sort,
      groups,
    };
    const query = { courseId, filters, page, perPage };

    const enrolledStudents = await this.courseService.getStudentsWithEnrollmentDate(query);

    return new PaginatedResponse(enrolledStudents);
  }

  @Get("available-courses")
  @Validate(coursesValidation)
  @Public()
  async getAvailableCourses(
    @Query("title") title: string,
    @Query("description") description: string,
    @Query("searchQuery") searchQuery: string,
    @Query("category") category: string,
    @Query("author") author: string,
    @Query("creationDateRange[0]") creationDateRangeStart: string,
    @Query("creationDateRange[1]") creationDateRangeEnd: string,
    @Query("page") page: number,
    @Query("perPage") perPage: number,
    @Query("sort") sort: SortCourseFieldsOptions,
    @Query("excludeCourseId") excludeCourseId: UUIDType,
    @Query("language") language: SupportedLanguages,
    @CurrentUser("userId") currentUserId?: UUIDType,
  ): Promise<PaginatedResponse<AllStudentCoursesResponse>> {
    const filters: CoursesFilterSchema = {
      title,
      description,
      searchQuery,
      category,
      author,
      creationDateRange:
        creationDateRangeStart && creationDateRangeEnd
          ? [creationDateRangeStart, creationDateRangeEnd]
          : undefined,
    };
    const query = { filters, page, perPage, sort, excludeCourseId, language };

    const data = await this.courseService.getAvailableCourses(query, currentUserId);

    return new PaginatedResponse(data);
  }

  @Public()
  @Get("content-creator-courses")
  @Validate({
    request: [
      { type: "query", name: "authorId", schema: UUIDSchema, required: true },
      {
        type: "query",
        name: "scope",
        schema: Type.Enum(COURSE_ENROLLMENT_SCOPES),
      },
      { type: "query", name: "excludeCourseId", schema: UUIDSchema },
      { type: "query", name: "title", schema: Type.String() },
      { type: "query", name: "description", schema: Type.String() },
      { type: "query", name: "searchQuery", schema: Type.String() },
      { type: "query", name: "language", schema: supportedLanguagesSchema },
    ],
    response: baseResponse(allCoursesForContentCreatorSchema),
  })
  async getContentCreatorCourses(
    @Query("authorId") authorId: UUIDType,
    @Query("scope") scope: CourseEnrollmentScope = COURSE_ENROLLMENT_SCOPES.ALL,
    @Query("excludeCourseId") excludeCourseId: UUIDType,
    @Query("title") title: string,
    @Query("description") description: string,
    @Query("searchQuery") searchQuery: string,
    @Query("language") language: SupportedLanguages,
    @CurrentUser("userId") currentUserId: UUIDType,
  ): Promise<BaseResponse<AllCoursesForContentCreatorResponse>> {
    const query = {
      authorId,
      currentUserId,
      excludeCourseId,
      scope,
      title,
      description,
      searchQuery,
      language,
    };

    return new BaseResponse(await this.courseService.getContentCreatorCourses(query));
  }

  @Public()
  @Get()
  @Validate({
    request: [
      { type: "query", name: "id", schema: UUIDSchema, required: true },
      { type: "query", name: "language", schema: supportedLanguagesSchema },
    ],
    response: baseResponse(commonShowCourseSchema),
  })
  async getCourse(
    @Query("id") id: UUIDType,
    @Query("language") language: SupportedLanguages,
    @CurrentUser("userId") currentUserId: UUIDType,
  ): Promise<BaseResponse<CommonShowCourse>> {
    return new BaseResponse(await this.courseService.getCourse(id, currentUserId, language));
  }

  @Get("beta-course-by-id")
  @Roles(USER_ROLES.CONTENT_CREATOR, USER_ROLES.ADMIN)
  @Validate({
    request: [
      { type: "query", name: "id", schema: UUIDSchema, required: true },
      { type: "query", name: "language", schema: supportedLanguagesSchema },
    ],
    response: baseResponse(commonShowBetaCourseSchema),
  })
  async getBetaCourseById(
    @Query("id") id: UUIDType,
    @Query("language") language: SupportedLanguages,
    @CurrentUser("userId") currentUserId: UUIDType,
    @CurrentUser("role") currentUserRole: UserRole,
  ): Promise<BaseResponse<CommonShowBetaCourse>> {
    return new BaseResponse(
      await this.courseService.getBetaCourseById(id, language, currentUserId, currentUserRole),
    );
  }

  @Get("beta-course-missing-translations")
  @Roles(USER_ROLES.CONTENT_CREATOR, USER_ROLES.ADMIN)
  @Validate({
    request: [
      { type: "query", name: "id", schema: UUIDSchema, required: true },
      { type: "query", name: "language", schema: supportedLanguagesSchema },
    ],
    response: baseResponse(Type.Object({ hasMissingTranslations: Type.Boolean() })),
  })
  async hasMissingTranslations(
    @Query("id") id: UUIDType,
    @Query("language") language: SupportedLanguages,
    @CurrentUser("userId") currentUserId: UUIDType,
    @CurrentUser("role") currentUserRole: UserRole,
  ): Promise<BaseResponse<{ hasMissingTranslations: boolean }>> {
    const hasMissingTranslations = await this.courseService.hasMissingTranslations(
      id,
      language,
      currentUserId,
      currentUserRole,
    );

    return new BaseResponse({ hasMissingTranslations });
  }

  @Post()
  @Roles(USER_ROLES.ADMIN, USER_ROLES.CONTENT_CREATOR)
  @Validate({
    request: [{ type: "body", schema: createCourseSchema }],
    response: baseResponse(Type.Object({ id: UUIDSchema, message: Type.String() })),
  })
  async createCourse(
    @Body() createCourseBody: CreateCourseBody,
    @CurrentUser() currentUser: CurrentUserType,
    @Req() request: Request,
  ): Promise<BaseResponse<{ id: UUIDType; message: string }>> {
    const isPlaywrightTest = request.headers["x-playwright-test"];

    const { id } = await this.courseService.createCourse(
      createCourseBody,
      currentUser,
      !!isPlaywrightTest,
    );
    return new BaseResponse({ id, message: "Course created successfully" });
  }

  @Patch(":id")
  @UseInterceptors(FileInterceptor("image"))
  @Roles(USER_ROLES.CONTENT_CREATOR, USER_ROLES.ADMIN)
  @Validate({
    request: [
      { type: "param", name: "id", schema: UUIDSchema },
      { type: "body", schema: updateCourseSchema },
    ],
    response: baseResponse(Type.Object({ message: Type.String() })),
  })
  async updateCourse(
    @Param("id") id: UUIDType,
    @Body() updateCourseBody: UpdateCourseBody,
    @UploadedFile() image: Express.Multer.File,
    @CurrentUser() currentUser: CurrentUserType,
    @Req() request: Request,
  ): Promise<BaseResponse<{ message: string }>> {
    const isPlaywrightTest = request.headers["x-playwright-test"];

    await this.courseService.updateCourse(
      id,
      updateCourseBody,
      currentUser,
      !!isPlaywrightTest,
      image,
    );

    return new BaseResponse({ message: "Course updated successfully" });
  }

  @Patch("update-has-certificate/:id")
  @Roles(USER_ROLES.ADMIN, USER_ROLES.CONTENT_CREATOR)
  @Validate({
    request: [
      { type: "param", name: "id", schema: UUIDSchema },
      { type: "body", schema: Type.Object({ hasCertificate: Type.Boolean() }) },
    ],
    response: baseResponse(Type.Object({ message: Type.String() })),
  })
  async updateHasCertificate(
    @Param("id") id: UUIDType,
    @Body() body: { hasCertificate: boolean },
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<{ message: string }>> {
    await this.courseService.updateHasCertificate(id, body.hasCertificate, currentUser);

    return new BaseResponse({ message: "Course with certificate updated successfully" });
  }

  @Patch("settings/:courseId")
  @Roles(USER_ROLES.ADMIN, USER_ROLES.CONTENT_CREATOR)
  @Validate({
    request: [
      { type: "param", name: "courseId", schema: UUIDSchema },
      { type: "body", schema: updateCourseSettingsSchema },
    ],
    response: baseResponse(Type.Object({ message: Type.String() })),
  })
  async updateCourseSettings(
    @Param("courseId") courseId: UUIDType,
    @Body() body: UpdateCourseSettings,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<{ message: string }>> {
    await this.courseService.updateCourseSettings(courseId, body, currentUser);

    return new BaseResponse({ message: "Course lesson settings updated successfully" });
  }

  @Get("settings/:courseId")
  @Roles(USER_ROLES.ADMIN, USER_ROLES.CONTENT_CREATOR)
  @Validate({
    response: baseResponse(coursesSettingsSchema),
    request: [{ type: "param", name: "courseId", schema: UUIDSchema }],
  })
  async getCourseSettings(
    @Param("courseId") courseId: UUIDType,
  ): Promise<BaseResponse<CoursesSettings>> {
    const data = await this.courseService.getCourseSettings(courseId);
    return new BaseResponse(data);
  }

  @Get("lesson-sequence-enabled/:courseId")
  @Roles(USER_ROLES.ADMIN, USER_ROLES.CONTENT_CREATOR, USER_ROLES.STUDENT)
  @Validate({
    response: baseResponse(getLessonSequenceEnabledSchema),
    request: [{ type: "param", name: "courseId", schema: UUIDSchema }],
  })
  async getLessonSequenceEnabled(
    @Param("courseId") courseId: UUIDType,
  ): Promise<BaseResponse<LessonSequenceEnabledResponse>> {
    const data = await this.courseService.getCourseSequenceEnabled(courseId);

    return new BaseResponse(data);
  }

  @Post("enroll-course")
  @Roles(USER_ROLES.STUDENT)
  @Validate({
    request: [{ type: "query", name: "id", schema: UUIDSchema }],
    response: baseResponse(Type.Object({ message: Type.String() })),
  })
  async enrollCourse(
    @Query("id") id: UUIDType,
    @CurrentUser() currentUser: CurrentUserType,
    @Headers("x-test-key") testKey: string,
  ): Promise<BaseResponse<{ message: string }>> {
    await this.courseService.enrollCourse(id, currentUser.userId, testKey, undefined, currentUser);

    return new BaseResponse({ message: "Course enrolled successfully" });
  }

  @Post("/:courseId/enroll-courses")
  @Roles(USER_ROLES.ADMIN)
  @Validate({
    request: [
      {
        type: "param",
        name: "courseId",
        schema: UUIDSchema,
      },
      {
        type: "body",
        schema: createCoursesEnrollmentSchema,
      },
    ],
    response: baseResponse(Type.Object({ message: Type.String() })),
  })
  async enrollCourses(
    @Param("courseId") courseId: UUIDType,
    @Body() body: CreateCoursesEnrollment,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<{ message: string }>> {
    await this.courseService.enrollCourses(courseId, body, currentUser);

    return new BaseResponse({ message: "Courses enrolled successfully" });
  }

  @Post("/:courseId/enroll-groups-to-course")
  @Roles(USER_ROLES.ADMIN)
  @Validate({
    request: [
      {
        type: "param",
        name: "courseId",
        schema: UUIDSchema,
      },
      {
        type: "body",
        schema: enrolledCourseGroupsPayload,
      },
    ],
    response: baseResponse(Type.Object({ message: Type.String() })),
  })
  async enrollGroupsToCourse(
    @Param("courseId") courseId: UUIDType,
    @Body() body: EnrolledCourseGroupsPayload,
    @CurrentUser("userId") currentUserId: UUIDType,
    @CurrentUser("role") currentUserRole: UserRole,
  ): Promise<BaseResponse<{ message: string }>> {
    await this.courseService.enrollGroupsToCourse(
      courseId,
      body.groups,
      currentUserId,
      currentUserRole,
    );

    return new BaseResponse({ message: "Pomyślnie zapisano grupy na kurs" });
  }

  @Delete("/:courseId/unenroll-groups-from-course")
  @Roles(USER_ROLES.ADMIN)
  @Validate({
    request: [
      {
        type: "param",
        name: "courseId",
        schema: UUIDSchema,
      },
      {
        type: "body",
        schema: Type.Object({ groupIds: Type.Array(UUIDSchema) }),
      },
    ],
    response: baseResponse(Type.Object({ message: Type.String() })),
  })
  async unenrollGroupsFromCourse(
    @Param("courseId") courseId: UUIDType,
    @Body() body: { groupIds: UUIDType[] } = { groupIds: [] },
  ): Promise<BaseResponse<{ message: string }>> {
    await this.courseService.unenrollGroupsFromCourse(courseId, body.groupIds);

    return new BaseResponse({
      message: "adminCourseView.enrolled.toast.groupsUnenrolledSuccessfully",
    });
  }

  @Delete("deleteCourse/:id")
  @Roles(USER_ROLES.ADMIN)
  @Validate({
    request: [{ type: "param", name: "id", schema: UUIDSchema }],
    response: nullResponse(),
  })
  async deleteCourse(
    @Param("id") id: UUIDType,
    @CurrentUser("role") currentUserRole: UserRole,
  ): Promise<null> {
    await this.courseService.deleteCourse(id, currentUserRole);

    return null;
  }

  @Delete("deleteManyCourses")
  @Roles(USER_ROLES.ADMIN)
  @Validate({
    request: [{ type: "body", schema: Type.Object({ ids: Type.Array(UUIDSchema) }) }],
    response: nullResponse(),
  })
  async deleteManyCourses(
    @Body() body: { ids: UUIDType[] },
    @CurrentUser("role") currentUserRole: UserRole,
  ) {
    return await this.courseService.deleteManyCourses(body.ids, currentUserRole);
  }

  @Delete("unenroll-course")
  @Roles(USER_ROLES.ADMIN)
  @Validate({
    response: nullResponse(),
    request: [
      { type: "query", name: "courseId", schema: UUIDSchema },
      { type: "query", name: "userIds", schema: Type.Array(UUIDSchema) },
    ],
  })
  async unenrollCourses(
    @Query("courseId") courseId: UUIDType,
    @Query("userIds") userIds: UUIDType[],
  ): Promise<null> {
    await this.courseService.unenrollCourse(courseId, userIds);

    return null;
  }

  @Get(":courseId/statistics")
  @Roles(USER_ROLES.ADMIN, USER_ROLES.CONTENT_CREATOR)
  @Validate({
    response: baseResponse(getCourseStatisticsSchema),
    request: [{ type: "param", name: "courseId", schema: UUIDSchema }],
  })
  async getCourseStatistics(
    @Param("courseId") courseId: UUIDType,
  ): Promise<BaseResponse<CourseStatisticsResponse>> {
    const data = await this.courseService.getCourseStatistics(courseId);

    return new BaseResponse(data);
  }

  @Get(":courseId/statistics/learning-time")
  @Roles(USER_ROLES.ADMIN, USER_ROLES.CONTENT_CREATOR)
  @Validate({
    response: baseResponse(learningTimeStatisticsSchema),
    request: [
      { type: "param", name: "courseId", schema: UUIDSchema },
      { type: "query", name: "userId", schema: UUIDSchema },
      { type: "query", name: "groupId", schema: UUIDSchema },
    ],
  })
  async getCourseLearningTimeStatistics(
    @Param("courseId") courseId: UUIDType,
    @Query("userId") userId: UUIDType,
    @Query("groupId") groupId: UUIDType,
  ) {
    const query = { userId, groupId };
    const data = await this.learningTimeService.getLearningTimeStatistics(courseId, query);

    return new BaseResponse(data);
  }

  @Get(":courseId/statistics/learning-time-filter-options")
  @Roles(USER_ROLES.ADMIN, USER_ROLES.CONTENT_CREATOR)
  @Validate({
    response: baseResponse(learningTimeStatisticsFilterOptionsSchema),
    request: [{ type: "param", name: "courseId", schema: UUIDSchema }],
  })
  async getCourseLearningStatisticsFilterOptions(@Param("courseId") courseId: UUIDType) {
    const data = await this.learningTimeService.getFilterOptions(courseId);

    return new BaseResponse(data);
  }

  @Get(":courseId/statistics/average-quiz-score")
  @Roles(USER_ROLES.ADMIN, USER_ROLES.CONTENT_CREATOR)
  @Validate({
    request: [
      { type: "param", name: "courseId", schema: UUIDSchema },
      { type: "query", name: "language", schema: supportedLanguagesSchema },
    ],
    response: baseResponse(courseAverageQuizScoresSchema),
  })
  async getAverageQuizScores(
    @Param("courseId") courseId: UUIDType,
    @Query("language") language: SupportedLanguages,
  ) {
    const averageQuizScores = await this.courseService.getAverageQuizScoreForCourse(
      courseId,
      language,
    );

    return new BaseResponse(averageQuizScores);
  }

  @Get(":courseId/statistics/students-progress")
  @Roles(USER_ROLES.ADMIN, USER_ROLES.CONTENT_CREATOR)
  @Validate({
    request: [
      { type: "param", name: "courseId", schema: UUIDSchema },
      { type: "query", name: "page", schema: Type.Number() },
      { type: "query", name: "perPage", schema: Type.Number() },
      { type: "query", name: "search", schema: Type.String() },
      {
        type: "query",
        name: "sort",
        schema: sortCourseStudentProgressionOptions,
      },
      { type: "query", name: "language", schema: supportedLanguagesSchema },
    ],
    response: paginatedResponse(allStudentCourseProgressionSchema),
  })
  async getCourseStudentsProgress(
    @Param("courseId") courseId: UUIDType,
    @Query("page") page: number,
    @Query("perPage") perPage: number,
    @Query("search") searchQuery: string,
    @Query("sort") sort: SortCourseStudentProgressionOptions,
    @Query("language") language: SupportedLanguages,
  ): Promise<PaginatedResponse<AllStudentCourseProgressionResponse>> {
    const query = {
      courseId,
      page,
      perPage,
      searchQuery,
      sort,
      language,
    };

    const studentsProgression = await this.courseService.getStudentsProgress(query);

    return new PaginatedResponse(studentsProgression);
  }

  @Get(":courseId/statistics/students-quiz-results")
  @Roles(USER_ROLES.ADMIN, USER_ROLES.CONTENT_CREATOR)
  @Validate({
    request: [
      { type: "param", name: "courseId", schema: UUIDSchema },
      { type: "query", name: "page", schema: Type.Number() },
      { type: "query", name: "perPage", schema: Type.Number() },
      { type: "query", name: "quizId", schema: Type.String() },
      {
        type: "query",
        name: "sort",
        schema: sortCourseStudentQuizResultsOptions,
      },
      { type: "query", name: "language", schema: supportedLanguagesSchema },
    ],
    response: paginatedResponse(allStudentQuizResultsSchema),
  })
  async getCourseStudentsQuizResults(
    @Param("courseId") courseId: UUIDType,
    @Query("page") page: number,
    @Query("perPage") perPage: number,
    @Query("quizId") quizId: string,
    @Query("sort") sort: SortCourseStudentQuizResultsOptions,
    @Query("language") language: SupportedLanguages,
  ): Promise<PaginatedResponse<AllStudentQuizResultsResponse>> {
    const query = {
      courseId,
      page,
      perPage,
      quizId,
      sort,
      language,
    };

    const studentQuizResults = await this.courseService.getStudentsQuizResults(query);

    return new PaginatedResponse(studentQuizResults);
  }

  @Get(":courseId/statistics/students-ai-mentor-results")
  @Roles(USER_ROLES.ADMIN, USER_ROLES.CONTENT_CREATOR)
  @Validate({
    request: [
      { type: "param", name: "courseId", schema: UUIDSchema },
      { type: "query", name: "page", schema: Type.Number() },
      { type: "query", name: "perPage", schema: Type.Number() },
      { type: "query", name: "lessonId", schema: Type.String() },
      {
        type: "query",
        name: "sort",
        schema: sortCourseStudentAiMentorResultsOptions,
      },
      { type: "query", name: "language", schema: supportedLanguagesSchema },
    ],
    response: paginatedResponse(allStudentAiMentorResultsSchema),
  })
  async getCourseStudentsAiMentorResults(
    @Param("courseId") courseId: UUIDType,
    @Query("page") page: number,
    @Query("perPage") perPage: number,
    @Query("lessonId") lessonId: string,
    @Query("sort") sort: SortCourseStudentAiMentorResultsOptions,
    @Query("language") language: SupportedLanguages,
  ): Promise<PaginatedResponse<AllStudentAiMentorResultsResponse>> {
    const query = {
      courseId,
      page,
      perPage,
      lessonId,
      sort,
      language,
    };

    const studentQuizResults = await this.courseService.getStudentsAiMentorResults(query);

    return new PaginatedResponse(studentQuizResults);
  }

  @Post("beta-create-language/:courseId")
  @Roles(USER_ROLES.ADMIN, USER_ROLES.CONTENT_CREATOR)
  @Validate({
    request: [
      { type: "query", name: "language", schema: supportedLanguagesSchema },
      { type: "param", name: "courseId", schema: UUIDSchema },
    ],
  })
  async createLanguage(
    @Query("language") language: SupportedLanguages,
    @Param("courseId") courseId: UUIDType,
    @CurrentUser("role") role: UserRole,
    @CurrentUser("userId") userId: UUIDType,
  ) {
    await this.courseService.createLanguage(courseId, language, userId, role);
  }

  @Delete("language/:courseId")
  @Roles(USER_ROLES.ADMIN, USER_ROLES.CONTENT_CREATOR)
  @Validate({
    request: [
      { type: "param", name: "courseId", schema: UUIDSchema },
      { type: "query", name: "language", schema: supportedLanguagesSchema },
    ],
  })
  async deleteLanguage(
    @Param("courseId") courseId: UUIDType,
    @Query("language") language: SupportedLanguages,
    @CurrentUser("role") role: UserRole,
    @CurrentUser("userId") userId: UUIDType,
  ) {
    return this.courseService.deleteLanguage(courseId, language, role, userId);
  }

  @Post("generate-translations/:courseId")
  @Roles(USER_ROLES.ADMIN, USER_ROLES.CONTENT_CREATOR)
  @Validate({
    request: [
      {
        type: "query",
        name: "language",
        schema: supportedLanguagesSchema,
      },
      { type: "param", name: "courseId", schema: UUIDSchema },
    ],
  })
  async generateTranslations(
    @Query("language") language: SupportedLanguages,
    @Param("courseId") courseId: UUIDType,
    @CurrentUser() currentUser: CurrentUserType,
  ) {
    return this.courseService.generateMissingTranslations(courseId, language, currentUser);
  }
}
