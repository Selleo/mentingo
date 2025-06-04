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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Type } from "@sinclair/typebox";
import { Validate } from "nestjs-typebox";

import {
  baseResponse,
  BaseResponse,
  nullResponse,
  PaginatedResponse,
  UUIDSchema,
  type UUIDType,
} from "src/common";
import { Public } from "src/common/decorators/public.decorator";
import { Roles } from "src/common/decorators/roles.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { RolesGuard } from "src/common/guards/roles.guard";
import { CourseService } from "src/courses/course.service";
import { allCoursesForTeacherSchema } from "src/courses/schemas/course.schema";
import {
  COURSE_ENROLLMENT_SCOPES,
  CourseEnrollmentScope,
  SortCourseFieldsOptions,
} from "src/courses/schemas/courseQuery";
import { CreateCourseBody, createCourseSchema } from "src/courses/schemas/createCourse.schema";
import {
  commonShowBetaCourseSchema,
  commonShowCourseSchema,
} from "src/courses/schemas/showCourseCommon.schema";
import { UpdateCourseBody, updateCourseSchema } from "src/courses/schemas/updateCourse.schema";
import {
  allCoursesValidation,
  coursesValidation,
  studentCoursesValidation,
} from "src/courses/validations/validations";
import { USER_ROLES, UserRole } from "src/user/schemas/userRoles";

import type {
  AllCoursesForTeacherResponse,
  AllCoursesResponse,
  AllStudentCoursesResponse,
} from "src/courses/schemas/course.schema";
import type { CoursesFilterSchema } from "src/courses/schemas/courseQuery";
import type {
  CommonShowBetaCourse,
  CommonShowCourse,
} from "src/courses/schemas/showCourseCommon.schema";

@Controller("course")
@UseGuards(RolesGuard)
export class CourseController {
  constructor(private readonly courseService: CourseService) {}

  @Get("all")
  @Roles(USER_ROLES.ADMIN, USER_ROLES.TEACHER)
  @Validate(allCoursesValidation)
  async getAllCourses(
    @Query("title") title: string,
    @Query("category") category: string,
    @Query("author") author: string,
    @Query("creationDateRange") creationDateRange: string[],
    @Query("isPublished") isPublished: boolean,
    @Query("sort") sort: SortCourseFieldsOptions,
    @Query("page") page: number,
    @Query("perPage") perPage: number,
    @CurrentUser("userId") currentUserId: UUIDType,
    @CurrentUser("role") currentUserRole: UserRole,
  ): Promise<PaginatedResponse<AllCoursesResponse>> {
    const [creationDateRangeStart, creationDateRangeEnd] = creationDateRange || [];
    const filters: CoursesFilterSchema = {
      title,
      category,
      author,
      isPublished,
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
    };

    const data = await this.courseService.getAllCourses(query);

    return new PaginatedResponse(data);
  }

  @Get("get-student-courses")
  @Validate(studentCoursesValidation)
  async getStudentCourses(
    @Query("title") title: string,
    @Query("category") category: string,
    @Query("author") author: string,
    @Query("creationDateRange[0]") creationDateRangeStart: string,
    @Query("creationDateRange[1]") creationDateRangeEnd: string,
    @Query("page") page: number,
    @Query("perPage") perPage: number,
    @Query("sort") sort: SortCourseFieldsOptions,
    @CurrentUser("userId") currentUserId: UUIDType,
  ): Promise<PaginatedResponse<AllStudentCoursesResponse>> {
    const filters: CoursesFilterSchema = {
      title,
      category,
      author,
      creationDateRange:
        creationDateRangeStart && creationDateRangeEnd
          ? [creationDateRangeStart, creationDateRangeEnd]
          : undefined,
    };
    const query = { filters, page, perPage, sort };

    const data = await this.courseService.getCoursesForUser(query, currentUserId);

    return new PaginatedResponse(data);
  }

  @Get("available-courses")
  @Validate(coursesValidation)
  @Public()
  async getAvailableCourses(
    @Query("title") title: string,
    @Query("category") category: string,
    @Query("author") author: string,
    @Query("creationDateRange[0]") creationDateRangeStart: string,
    @Query("creationDateRange[1]") creationDateRangeEnd: string,
    @Query("page") page: number,
    @Query("perPage") perPage: number,
    @Query("sort") sort: SortCourseFieldsOptions,
    @Query("excludeCourseId") excludeCourseId: UUIDType,
    @CurrentUser("userId") currentUserId?: UUIDType,
  ): Promise<PaginatedResponse<AllStudentCoursesResponse>> {
    const filters: CoursesFilterSchema = {
      title,
      category,
      author,
      creationDateRange:
        creationDateRangeStart && creationDateRangeEnd
          ? [creationDateRangeStart, creationDateRangeEnd]
          : undefined,
    };
    const query = { filters, page, perPage, sort, excludeCourseId };

    const data = await this.courseService.getAvailableCourses(query, currentUserId);

    return new PaginatedResponse(data);
  }

  @Public()
  @Get("teacher-courses")
  @Validate({
    request: [
      { type: "query", name: "authorId", schema: UUIDSchema, required: true },
      {
        type: "query",
        name: "scope",
        schema: Type.Enum(COURSE_ENROLLMENT_SCOPES),
      },
      { type: "query", name: "excludeCourseId", schema: UUIDSchema },
    ],
    response: baseResponse(allCoursesForTeacherSchema),
  })
  async getTeacherCourses(
    @Query("authorId") authorId: UUIDType,
    @Query("scope") scope: CourseEnrollmentScope = COURSE_ENROLLMENT_SCOPES.ALL,
    @Query("excludeCourseId") excludeCourseId: UUIDType,
    @CurrentUser("userId") currentUserId: UUIDType,
  ): Promise<BaseResponse<AllCoursesForTeacherResponse>> {
    const query = { authorId, currentUserId, excludeCourseId, scope };

    return new BaseResponse(await this.courseService.getTeacherCourses(query));
  }

  @Public()
  @Get()
  @Validate({
    request: [{ type: "query", name: "id", schema: UUIDSchema, required: true }],
    response: baseResponse(commonShowCourseSchema),
  })
  async getCourse(
    @Query("id") id: UUIDType,
    @CurrentUser("userId") currentUserId: UUIDType,
  ): Promise<BaseResponse<CommonShowCourse>> {
    return new BaseResponse(await this.courseService.getCourse(id, currentUserId));
  }

  @Get("beta-course-by-id")
  @Roles(USER_ROLES.TEACHER, USER_ROLES.ADMIN)
  @Validate({
    request: [{ type: "query", name: "id", schema: UUIDSchema, required: true }],
    response: baseResponse(commonShowBetaCourseSchema),
  })
  async getBetaCourseById(@Query("id") id: UUIDType): Promise<BaseResponse<CommonShowBetaCourse>> {
    return new BaseResponse(await this.courseService.getBetaCourseById(id));
  }

  @Post()
  @Roles(USER_ROLES.ADMIN, USER_ROLES.TEACHER)
  @Validate({
    request: [{ type: "body", schema: createCourseSchema }],
    response: baseResponse(Type.Object({ id: UUIDSchema, message: Type.String() })),
  })
  async createCourse(
    @Body() createCourseBody: CreateCourseBody,
    @CurrentUser("userId") currentUserId: UUIDType,
  ): Promise<BaseResponse<{ id: UUIDType; message: string }>> {
    const { id } = await this.courseService.createCourse(createCourseBody, currentUserId);

    return new BaseResponse({ id, message: "Course created successfully" });
  }

  @Patch(":id")
  @UseInterceptors(FileInterceptor("image"))
  @Roles(USER_ROLES.TEACHER, USER_ROLES.ADMIN)
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
    @CurrentUser("userId") currentUserId: UUIDType,
  ): Promise<BaseResponse<{ message: string }>> {
    await this.courseService.updateCourse(id, updateCourseBody, image, currentUserId);

    return new BaseResponse({ message: "Course updated successfully" });
  }

  @Post("enroll-course")
  @Roles(USER_ROLES.STUDENT)
  @Validate({
    request: [{ type: "query", name: "id", schema: UUIDSchema }],
    response: baseResponse(Type.Object({ message: Type.String() })),
  })
  async enrollCourse(
    @Query("id") id: UUIDType,
    @CurrentUser("userId") currentUserId: UUIDType,
    @Headers("x-test-key") testKey: string,
  ): Promise<BaseResponse<{ message: string }>> {
    await this.courseService.enrollCourse(id, currentUserId, testKey);

    return new BaseResponse({ message: "Course enrolled successfully" });
  }

  @Delete("unenroll-course")
  @Roles(USER_ROLES.STUDENT)
  @Validate({
    response: nullResponse(),
    request: [{ type: "query", name: "id", schema: UUIDSchema }],
  })
  async unenrollCourse(
    @Query("id") id: UUIDType,
    @CurrentUser("userId") currentUserId: UUIDType,
  ): Promise<null> {
    await this.courseService.unenrollCourse(id, currentUserId);

    return null;
  }
}
