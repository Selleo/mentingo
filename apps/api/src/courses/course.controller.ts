import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Headers,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiConsumes } from "@nestjs/swagger";
import {
  ALLOWED_CERTIFICATE_SIGNATURE_FILE_TYPES,
  ALLOWED_LESSON_IMAGE_FILE_TYPES,
  PERMISSIONS,
  SupportedLanguages,
  type PermissionKey,
} from "@repo/shared";
import { Type } from "@sinclair/typebox";
import { Request, Response } from "express";
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
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { ManagingTenantAdminGuard } from "src/common/guards/managing-tenant-admin.guard";
import { getRequestBaseUrl } from "src/common/helpers/getRequestBaseUrl";
import { CurrentUserType } from "src/common/types/current-user.type";
import { CourseScormExportService } from "src/courses/course-scorm-export.service";
import { CourseService } from "src/courses/course.service";
import { MasterCourseService } from "src/courses/master-course.service";
import {
  allCoursesForContentCreatorSchema,
  allStudentCoursesSchema,
  allStudentAiMentorResultsSchema,
  allStudentCourseProgressionSchema,
  allStudentQuizResultsSchema,
  courseAverageQuizScoresSchema,
  enrolledCourseGroupsPayload,
  getCourseStatisticsSchema,
  getLessonSequenceEnabledSchema,
  supportedLanguagesSchema,
  EnrolledCourseGroupsPayload,
  transferCourseOwnershipRequestSchema,
  TransferCourseOwnershipRequestBody,
  courseOwnershipCandidatesResponseSchema,
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
  masterCourseExportBodySchema,
  masterCourseExportCandidatesResponseSchema,
  masterCourseExportLinkSchema,
  masterCourseExportResponseSchema,
  masterCourseJobStatusResponseSchema,
  type MasterCourseExportBody,
  type MasterCourseExportCandidatesResponse,
} from "src/courses/schemas/masterCourse.schema";
import {
  setCourseStudentModeResponseSchema,
  setCourseStudentModeSchema,
  type SetCourseStudentMode,
  type SetCourseStudentModeResponse,
} from "src/courses/schemas/setCourseStudentMode.schema";
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
import { MAX_FILE_SIZE } from "src/file/file.constants";
import { getBaseFileTypePipe } from "src/file/utils/baseFileTypePipe";
import { buildFileTypeRegex } from "src/file/utils/fileTypeRegex";
import { GroupsFilterSchema } from "src/group/group.types";
import {
  LearningTimeService,
  learningTimeStatisticsFilterOptionsSchema,
  learningTimeStatisticsSchema,
  learningTimeStatisticsSortOptions,
  LearningTimeStatisticsSortOptions,
} from "src/learning-time";
import { ValidateMultipartPipe } from "src/utils/pipes/validateMultipartPipe";

import {
  courseLookupResponseSchema,
  type CourseLookupResponse,
} from "./schemas/courseLookupResponse.schema";
import { getCourseSettingsSchema } from "./schemas/coursesSettings.schema";
import {
  CreateCoursesEnrollment,
  createCoursesEnrollmentSchema,
} from "./schemas/createCoursesEnrollment";

import type { GetCourseSettings } from "./schemas/coursesSettings.schema";
import type { EnrolledStudent } from "./schemas/enrolledStudent.schema";
import type {
  AllCoursesForContentCreatorResponse,
  AllCoursesResponse,
  AllStudentAiMentorResultsResponse,
  AllStudentCourseProgressionResponse,
  AllStudentCoursesResponse,
  AllStudentQuizResultsResponse,
  CourseStatisticsResponse,
  LessonSequenceEnabledResponse,
  CourseOwnershipCandidatesResponseBody,
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
export class CourseController {
  constructor(
    private readonly courseService: CourseService,
    private readonly courseScormExportService: CourseScormExportService,
    private readonly learningTimeService: LearningTimeService,
    private readonly masterCourseService: MasterCourseService,
  ) {}

  @Get("all")
  @RequirePermission(PERMISSIONS.COURSE_READ_MANAGEABLE)
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
    @CurrentUser() currentUser: CurrentUserType,
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
      currentUserId: currentUser.userId,
      currentUserPermissions: currentUser.permissions,
      language,
    };

    const data = await this.courseService.getAllCourses(query);

    return new PaginatedResponse(data);
  }

  @Get("get-student-courses")
  @RequirePermission(PERMISSIONS.COURSE_READ_ASSIGNED)
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

  @RequirePermission(PERMISSIONS.COURSE_ENROLLMENT)
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

  @Get("top-courses")
  @Validate({
    request: [
      { type: "query", name: "limit", schema: Type.Optional(Type.Number()) },
      { type: "query", name: "days", schema: Type.Optional(Type.Number()) },
      { type: "query", name: "language", schema: supportedLanguagesSchema },
    ],
    response: baseResponse(allStudentCoursesSchema),
  })
  @Public()
  async getTopCourses(
    @Query("limit") limit: number,
    @Query("days") days: number,
    @Query("language") language: SupportedLanguages,
    @CurrentUser("userId") currentUserId?: UUIDType,
  ): Promise<BaseResponse<AllStudentCoursesResponse>> {
    const data = await this.courseService.getTopCourses({ limit, days, language }, currentUserId);

    return new BaseResponse(data);
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
      { type: "query", name: "id", schema: Type.String(), required: true },
      { type: "query", name: "language", schema: supportedLanguagesSchema },
    ],
    response: baseResponse(commonShowCourseSchema),
  })
  async getCourse(
    @Query("id") idOrSlug: string,
    @Query("language") language: SupportedLanguages,
    @CurrentUser("userId") currentUserId: UUIDType,
    @CurrentUser("permissions") currentUserPermissions: PermissionKey[] = [],
  ): Promise<BaseResponse<CommonShowCourse>> {
    const course = await this.courseService.getCourse(
      idOrSlug,
      currentUserId,
      currentUserPermissions,
      language,
    );
    return new BaseResponse(course);
  }

  @Public()
  @Get("lookup")
  @Validate({
    request: [
      { type: "query", name: "id", schema: Type.String(), required: true },
      { type: "query", name: "language", schema: supportedLanguagesSchema },
    ],
    response: baseResponse(courseLookupResponseSchema),
  })
  async lookupCourse(
    @Query("id") idOrSlug: string,
    @Query("language") language: SupportedLanguages,
    @CurrentUser("userId") currentUserId?: UUIDType,
    @CurrentUser("permissions") currentUserPermissions: PermissionKey[] = [],
  ): Promise<BaseResponse<CourseLookupResponse>> {
    const result = await this.courseService.lookupCourse(
      idOrSlug,
      language,
      currentUserId,
      currentUserPermissions,
    );

    return new BaseResponse(result);
  }

  @Get("beta-course-by-id")
  @RequirePermission(PERMISSIONS.COURSE_READ)
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
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<CommonShowBetaCourse>> {
    return new BaseResponse(await this.courseService.getBetaCourseById(id, language, currentUser));
  }

  @Get("beta-course-missing-translations")
  @RequirePermission(PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN)
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
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<{ hasMissingTranslations: boolean }>> {
    const hasMissingTranslations = await this.courseService.hasMissingTranslations(
      id,
      language,
      currentUser,
    );

    return new BaseResponse({ hasMissingTranslations });
  }

  @Post()
  @RequirePermission(PERMISSIONS.COURSE_CREATE)
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
  @RequirePermission(PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN)
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
    @UploadedFile(
      getBaseFileTypePipe(buildFileTypeRegex(ALLOWED_LESSON_IMAGE_FILE_TYPES)).build({
        fileIsRequired: false,
        errorHttpStatusCode: HttpStatus.BAD_REQUEST,
      }),
    )
    image: Express.Multer.File,
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

  @Delete(":id/trailer")
  @RequirePermission(PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN)
  @Validate({
    request: [{ type: "param", name: "id", schema: UUIDSchema }],
    response: baseResponse(Type.Object({ message: Type.String() })),
  })
  async deleteCourseTrailer(
    @Param("id") id: UUIDType,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<{ message: string }>> {
    const data = await this.courseService.deleteCourseTrailer(id, currentUser);
    return new BaseResponse(data);
  }

  @Patch("update-has-certificate/:id")
  @RequirePermission(PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN)
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
  @UseInterceptors(FileInterceptor("certificateSignature"))
  @ApiConsumes("multipart/form-data")
  @RequirePermission(PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN)
  @Validate({
    request: [
      { type: "param", name: "courseId", schema: UUIDSchema },
      {
        type: "body",
        schema: updateCourseSettingsSchema,
        pipes: [new ValidateMultipartPipe(updateCourseSettingsSchema)],
      },
    ],
    response: baseResponse(Type.Object({ message: Type.String() })),
  })
  async updateCourseSettings(
    @Param("courseId") courseId: UUIDType,
    @Body() body: UpdateCourseSettings,
    @UploadedFile(
      getBaseFileTypePipe(
        buildFileTypeRegex([...ALLOWED_CERTIFICATE_SIGNATURE_FILE_TYPES]),
        MAX_FILE_SIZE,
        true,
      ).build({
        fileIsRequired: false,
        errorHttpStatusCode: HttpStatus.BAD_REQUEST,
      }),
    )
    certificateSignature: Express.Multer.File | null,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<{ message: string }>> {
    await this.courseService.updateCourseSettings(
      courseId,
      body,
      currentUser,
      certificateSignature,
    );

    return new BaseResponse({ message: "Course lesson settings updated successfully" });
  }

  @Get("settings/:courseId")
  @RequirePermission(PERMISSIONS.COURSE_READ_MANAGEABLE)
  @Validate({
    response: baseResponse(getCourseSettingsSchema),
    request: [{ type: "param", name: "courseId", schema: UUIDSchema }],
  })
  async getCourseSettings(
    @Param("courseId") courseId: UUIDType,
  ): Promise<BaseResponse<GetCourseSettings>> {
    const data = await this.courseService.getCourseSettings(courseId);
    return new BaseResponse(data);
  }

  @Patch(":courseId/student-mode")
  @RequirePermission(PERMISSIONS.LEARNING_MODE_USE)
  @Validate({
    request: [
      { type: "param", name: "courseId", schema: UUIDSchema },
      { type: "body", schema: setCourseStudentModeSchema },
    ],
    response: baseResponse(setCourseStudentModeResponseSchema),
  })
  async setCourseStudentMode(
    @Param("courseId") courseId: UUIDType,
    @Body() body: SetCourseStudentMode,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<SetCourseStudentModeResponse>> {
    const data = await this.courseService.setCourseStudentMode(courseId, currentUser, body.enabled);

    return new BaseResponse(data);
  }

  @Get("lesson-sequence-enabled/:courseId")
  @RequirePermission(PERMISSIONS.COURSE_READ)
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
  @RequirePermission(PERMISSIONS.COURSE_ENROLLMENT, PERMISSIONS.LEARNING_PROGRESS_UPDATE)
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
  @RequirePermission(PERMISSIONS.COURSE_ENROLLMENT)
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
  @RequirePermission(PERMISSIONS.COURSE_ENROLLMENT)
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
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<{ message: string }>> {
    await this.courseService.enrollGroupsToCourse(courseId, body.groups, currentUser);

    return new BaseResponse({ message: "Pomyślnie zapisano grupy na kurs" });
  }

  @Delete("/:courseId/unenroll-groups-from-course")
  @RequirePermission(PERMISSIONS.COURSE_ENROLLMENT)
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
  @RequirePermission(PERMISSIONS.COURSE_DELETE)
  @Validate({
    request: [{ type: "param", name: "id", schema: UUIDSchema }],
    response: nullResponse(),
  })
  async deleteCourse(
    @Param("id") id: UUIDType,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<null> {
    await this.courseService.deleteCourse(id, currentUser);

    return null;
  }

  @Delete("deleteManyCourses")
  @RequirePermission(PERMISSIONS.COURSE_DELETE)
  @Validate({
    request: [{ type: "body", schema: Type.Object({ ids: Type.Array(UUIDSchema) }) }],
    response: nullResponse(),
  })
  async deleteManyCourses(
    @Body() body: { ids: UUIDType[] },
    @CurrentUser() currentUser: CurrentUserType,
  ) {
    return await this.courseService.deleteManyCourses(body.ids, currentUser);
  }

  @Delete("unenroll-course")
  @RequirePermission(PERMISSIONS.COURSE_ENROLLMENT)
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
  @RequirePermission(PERMISSIONS.COURSE_STATISTICS)
  @Validate({
    response: baseResponse(getCourseStatisticsSchema),
    request: [
      { type: "param", name: "courseId", schema: UUIDSchema },
      { type: "query", name: "groupId", schema: UUIDSchema },
    ],
  })
  async getCourseStatistics(
    @Param("courseId") courseId: UUIDType,
    @Query("groupId") groupId: UUIDType,
  ): Promise<BaseResponse<CourseStatisticsResponse>> {
    const query = { groupId };

    const data = await this.courseService.getCourseStatistics(courseId, query);

    return new BaseResponse(data);
  }

  @Get(":courseId/statistics/learning-time")
  @RequirePermission(PERMISSIONS.COURSE_STATISTICS)
  @Validate({
    response: paginatedResponse(learningTimeStatisticsSchema),
    request: [
      { type: "param", name: "courseId", schema: UUIDSchema },
      { type: "query", name: "userId", schema: UUIDSchema },
      { type: "query", name: "groupId", schema: UUIDSchema },
      { type: "query", name: "search", schema: Type.String() },
      { type: "query", name: "page", schema: Type.Number() },
      { type: "query", name: "perPage", schema: Type.Number() },
      { type: "query", name: "sort", schema: learningTimeStatisticsSortOptions },
    ],
  })
  async getCourseLearningTimeStatistics(
    @Param("courseId") courseId: UUIDType,
    @Query("userId") userId: UUIDType,
    @Query("groupId") groupId: UUIDType,
    @Query("search") searchQuery: string,
    @Query("page") page: number,
    @Query("perPage") perPage: number,
    @Query("sort") sort: LearningTimeStatisticsSortOptions,
  ) {
    const query = { userId, groupId, page, perPage, sort, searchQuery };
    const data = await this.learningTimeService.getLearningTimeStatistics(courseId, query);

    return new PaginatedResponse(data);
  }

  @Get(":courseId/statistics/learning-time-filter-options")
  @RequirePermission(PERMISSIONS.COURSE_STATISTICS)
  @Validate({
    response: baseResponse(learningTimeStatisticsFilterOptionsSchema),
    request: [{ type: "param", name: "courseId", schema: UUIDSchema }],
  })
  async getCourseLearningStatisticsFilterOptions(@Param("courseId") courseId: UUIDType) {
    const data = await this.learningTimeService.getFilterOptions(courseId);

    return new BaseResponse(data);
  }

  @Get(":courseId/statistics/average-quiz-score")
  @RequirePermission(PERMISSIONS.COURSE_STATISTICS)
  @Validate({
    request: [
      { type: "param", name: "courseId", schema: UUIDSchema },
      { type: "query", name: "groupId", schema: UUIDSchema },
      { type: "query", name: "language", schema: supportedLanguagesSchema },
    ],
    response: baseResponse(courseAverageQuizScoresSchema),
  })
  async getAverageQuizScores(
    @Param("courseId") courseId: UUIDType,
    @Query("groupId") groupId: UUIDType,
    @Query("language") language: SupportedLanguages,
  ) {
    const query = { groupId };

    const averageQuizScores = await this.courseService.getAverageQuizScoreForCourse(
      courseId,
      query,
      language,
    );

    return new BaseResponse(averageQuizScores);
  }

  @Get(":courseId/statistics/students-progress")
  @RequirePermission(PERMISSIONS.COURSE_STATISTICS)
  @Validate({
    request: [
      { type: "param", name: "courseId", schema: UUIDSchema },
      { type: "query", name: "page", schema: Type.Number() },
      { type: "query", name: "perPage", schema: Type.Number() },
      { type: "query", name: "search", schema: Type.String() },
      { type: "query", name: "groupId", schema: UUIDSchema },
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
    @Query("groupId") groupId: UUIDType,
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
      groupId,
    };

    const studentsProgression = await this.courseService.getStudentsProgress(query);

    return new PaginatedResponse(studentsProgression);
  }

  @Get(":courseId/statistics/students-quiz-results")
  @RequirePermission(PERMISSIONS.COURSE_STATISTICS)
  @Validate({
    request: [
      { type: "param", name: "courseId", schema: UUIDSchema },
      { type: "query", name: "page", schema: Type.Number() },
      { type: "query", name: "perPage", schema: Type.Number() },
      { type: "query", name: "quizId", schema: Type.String() },
      { type: "query", name: "groupId", schema: UUIDSchema },
      { type: "query", name: "search", schema: Type.String() },
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
    @Query("groupId") groupId: UUIDType,
    @Query("search") searchQuery: string,
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
      groupId,
      searchQuery,
    };

    const studentQuizResults = await this.courseService.getStudentsQuizResults(query);

    return new PaginatedResponse(studentQuizResults);
  }

  @Get(":courseId/statistics/students-ai-mentor-results")
  @RequirePermission(PERMISSIONS.COURSE_STATISTICS)
  @Validate({
    request: [
      { type: "param", name: "courseId", schema: UUIDSchema },
      { type: "query", name: "page", schema: Type.Number() },
      { type: "query", name: "perPage", schema: Type.Number() },
      { type: "query", name: "lessonId", schema: Type.String() },
      { type: "query", name: "groupId", schema: UUIDSchema },
      { type: "query", name: "search", schema: Type.String() },
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
    @Query("groupId") groupId: UUIDType,
    @Query("search") searchQuery: string,
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
      groupId,
      searchQuery,
    };

    const studentQuizResults = await this.courseService.getStudentsAiMentorResults(query);

    return new PaginatedResponse(studentQuizResults);
  }

  @Post("beta-create-language/:courseId")
  @RequirePermission(PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN)
  @Validate({
    request: [
      { type: "query", name: "language", schema: supportedLanguagesSchema },
      { type: "param", name: "courseId", schema: UUIDSchema },
    ],
  })
  async createLanguage(
    @Query("language") language: SupportedLanguages,
    @Param("courseId") courseId: UUIDType,
    @CurrentUser() currentUser: CurrentUserType,
  ) {
    await this.courseService.createLanguage(courseId, language, currentUser);
  }

  @Delete("language/:courseId")
  @RequirePermission(PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN)
  @Validate({
    request: [
      { type: "param", name: "courseId", schema: UUIDSchema },
      { type: "query", name: "language", schema: supportedLanguagesSchema },
    ],
  })
  async deleteLanguage(
    @Param("courseId") courseId: UUIDType,
    @Query("language") language: SupportedLanguages,
    @CurrentUser() currentUser: CurrentUserType,
  ) {
    return this.courseService.deleteLanguage(courseId, language, currentUser);
  }

  @Post("generate-translations/:courseId")
  @RequirePermission(PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN)
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

  @Post(":courseId/scorm-export")
  @RequirePermission(PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN)
  @Validate({
    request: [
      { type: "param", name: "courseId", schema: UUIDSchema, required: true },
      { type: "query", name: "language", schema: supportedLanguagesSchema },
    ],
  })
  async exportCourseAsScorm(
    @Param("courseId") courseId: UUIDType,
    @Query("language") language: SupportedLanguages | undefined,
    @CurrentUser() currentUser: CurrentUserType,
    @Req() request: Request,
    @Res() res: Response,
  ): Promise<void> {
    const exportedPackage = await this.courseScormExportService.exportCourse(
      courseId,
      currentUser,
      language,
      getRequestBaseUrl(request),
    );

    res.setHeader("Content-Type", exportedPackage.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${exportedPackage.filename}"`);
    exportedPackage.stream.pipe(res);
  }

  @Post("course-ownership/transfer")
  @RequirePermission(PERMISSIONS.COURSE_UPDATE)
  @Validate({
    request: [{ type: "body", schema: transferCourseOwnershipRequestSchema }],
  })
  async transferCourseOwnership(@Body() transferData: TransferCourseOwnershipRequestBody) {
    return this.courseService.transferCourseOwnership(transferData);
  }

  @Post("master/:courseId/export")
  @UseGuards(ManagingTenantAdminGuard)
  @RequirePermission(PERMISSIONS.COURSE_EXPORT)
  @Validate({
    request: [
      { type: "param", name: "courseId", schema: UUIDSchema, required: true },
      { type: "body", schema: masterCourseExportBodySchema, required: true },
    ],
    response: baseResponse(masterCourseExportResponseSchema),
  })
  async exportMasterCourse(
    @Param("courseId") courseId: UUIDType,
    @Body() body: MasterCourseExportBody,
    @CurrentUser() actor: CurrentUserType,
  ) {
    const data = await this.masterCourseService.exportCourseToTenants(courseId, body, actor);
    return new BaseResponse(data);
  }

  @Get("master/:courseId/exports")
  @UseGuards(ManagingTenantAdminGuard)
  @RequirePermission(PERMISSIONS.COURSE_EXPORT)
  @Validate({
    request: [{ type: "param", name: "courseId", schema: UUIDSchema, required: true }],
    response: baseResponse(Type.Array(masterCourseExportLinkSchema)),
  })
  async getMasterCourseExports(
    @Param("courseId") courseId: UUIDType,
    @CurrentUser() actor: CurrentUserType,
  ) {
    const data = await this.masterCourseService.getCourseExports(courseId, actor);
    return new BaseResponse(data);
  }

  @Get("master/:courseId/export-candidates")
  @UseGuards(ManagingTenantAdminGuard)
  @RequirePermission(PERMISSIONS.COURSE_EXPORT)
  @Validate({
    request: [{ type: "param", name: "courseId", schema: UUIDSchema, required: true }],
    response: baseResponse(masterCourseExportCandidatesResponseSchema),
  })
  async getMasterCourseExportCandidates(
    @Param("courseId") courseId: UUIDType,
    @CurrentUser() actor: CurrentUserType,
  ): Promise<BaseResponse<MasterCourseExportCandidatesResponse>> {
    return new BaseResponse(
      await this.masterCourseService.getCourseExportCandidates(courseId, actor),
    );
  }

  @Get("master/export-jobs/:jobId")
  @UseGuards(ManagingTenantAdminGuard)
  @RequirePermission(PERMISSIONS.COURSE_EXPORT)
  @Validate({
    request: [{ type: "param", name: "jobId", schema: Type.String(), required: true }],
    response: baseResponse(masterCourseJobStatusResponseSchema),
  })
  async getMasterCourseJobStatus(@Param("jobId") jobId: string) {
    const status = await this.masterCourseService.getJobStatus(jobId);
    if (!status) throw new NotFoundException("masterCourse.error.jobNotFound");
    return new BaseResponse(status);
  }

  @Get("course-ownership/:courseId")
  @RequirePermission(PERMISSIONS.COURSE_UPDATE)
  @Validate({
    request: [{ type: "param", name: "courseId", schema: UUIDSchema }],
    response: baseResponse(courseOwnershipCandidatesResponseSchema),
  })
  async getCourseOwnership(
    @Param("courseId") courseId: UUIDType,
  ): Promise<BaseResponse<CourseOwnershipCandidatesResponseBody>> {
    return new BaseResponse(await this.courseService.getCourseOwnership(courseId));
  }
}
