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
import { allCoursesForContentCreatorSchema } from "src/courses/schemas/course.schema";
import {
  COURSE_ENROLLMENT_SCOPES,
  CourseEnrollmentScope,
  SortCourseFieldsOptions,
  SortEnrolledStudentsOptions,
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
  studentsWithEnrolmentValidation,
} from "src/courses/validations/validations";
import { USER_ROLES, UserRole } from "src/user/schemas/userRoles";

import {
  CreateCoursesEnrollment,
  createCoursesEnrollmentSchema,
} from "./schemas/createCoursesEnrollment";

import type { EnrolledStudent } from "./schemas/enrolledStudent.schema";
import type {
  AllCoursesForContentCreatorResponse,
  AllCoursesResponse,
  AllStudentCoursesResponse,
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
  constructor(private readonly courseService: CourseService) {}

  @Get("all")
  @Roles(USER_ROLES.ADMIN, USER_ROLES.CONTENT_CREATOR)
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

  @Roles(USER_ROLES.ADMIN)
  @Get(":courseId/students")
  @Validate(studentsWithEnrolmentValidation)
  async getStudentsWithEnrollmentDate(
    @Param("courseId") courseId: UUIDType,
    @Query("keyword") keyword: string,
    @Query("sort") sort: SortEnrolledStudentsOptions,
  ): Promise<BaseResponse<EnrolledStudent[]>> {
    const filters: EnrolledStudentFilterSchema = {
      keyword,
      sort,
    };
    return await this.courseService.getStudentsWithEnrollmentDate(courseId, filters);
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
    ],
    response: baseResponse(allCoursesForContentCreatorSchema),
  })
  async getContentCreatorCourses(
    @Query("authorId") authorId: UUIDType,
    @Query("scope") scope: CourseEnrollmentScope = COURSE_ENROLLMENT_SCOPES.ALL,
    @Query("excludeCourseId") excludeCourseId: UUIDType,
    @CurrentUser("userId") currentUserId: UUIDType,
  ): Promise<BaseResponse<AllCoursesForContentCreatorResponse>> {
    const query = { authorId, currentUserId, excludeCourseId, scope };

    return new BaseResponse(await this.courseService.getContentCreatorCourses(query));
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
  @Roles(USER_ROLES.CONTENT_CREATOR, USER_ROLES.ADMIN)
  @Validate({
    request: [{ type: "query", name: "id", schema: UUIDSchema, required: true }],
    response: baseResponse(commonShowBetaCourseSchema),
  })
  async getBetaCourseById(
    @Query("id") id: UUIDType,
    @CurrentUser("userId") currentUserId: UUIDType,
    @CurrentUser("role") currentUserRole: UserRole,
  ): Promise<BaseResponse<CommonShowBetaCourse>> {
    return new BaseResponse(
      await this.courseService.getBetaCourseById(id, currentUserId, currentUserRole),
    );
  }

  @Post()
  @Roles(USER_ROLES.ADMIN, USER_ROLES.CONTENT_CREATOR)
  @Validate({
    request: [{ type: "body", schema: createCourseSchema }],
    response: baseResponse(Type.Object({ id: UUIDSchema, message: Type.String() })),
  })
  async createCourse(
    @Body() createCourseBody: CreateCourseBody,
    @CurrentUser("userId") currentUserId: UUIDType,
  ): Promise<BaseResponse<{ id: UUIDType; message: string }>> {
    const { id } = await this.courseService.createCourse(createCourseBody, currentUserId);

    return new BaseResponse({ id, message: "Pomyślnie utworzono kurs" });
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
    @CurrentUser("userId") currentUserId: UUIDType,
    @CurrentUser("role") currentUserRole: UserRole,
  ): Promise<BaseResponse<{ message: string }>> {
    await this.courseService.updateCourse(
      id,
      updateCourseBody,
      currentUserId,
      currentUserRole,
      image,
    );

    return new BaseResponse({ message: "Pomyślnie zaktualizowano kurs" });
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
  ): Promise<BaseResponse<{ message: string }>> {
    await this.courseService.updateHasCertificate(id, body.hasCertificate);

    return new BaseResponse({ message: "Pomyślnie zaktualizowano kurs" });
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

    return new BaseResponse({ message: "Pomyślnie zapisano na kurs" });
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
  ): Promise<BaseResponse<{ message: string }>> {
    await this.courseService.enrollCourses(courseId, body);

    return new BaseResponse({ message: "Pomyślnie zapisano na kursy" });
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
