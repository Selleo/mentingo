import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiForbiddenResponse,
  ApiHeader,
  ApiOperation,
  ApiUnauthorizedResponse,
  ApiTags,
} from "@nestjs/swagger";
import { type Static, Type } from "@sinclair/typebox";
import { Validate } from "nestjs-typebox";

import {
  baseResponse,
  BaseResponse,
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
import { enrolledCourseGroupsPayload } from "src/courses/schemas/course.schema";
import { createCoursesEnrollmentSchema } from "src/courses/schemas/createCoursesEnrollment";
import {
  allGroupsSchema,
  groupSortFieldsOptions,
  groupsFilterSchema,
} from "src/group/group.schema";
import { GroupService } from "src/group/group.service";
import { GroupSortFieldsOptions, GroupsFilterSchema } from "src/group/group.types";
import { IntegrationApiKeyGuard } from "src/integration/guards/integration-api-key.guard";
import {
  integrationDeleteUserResponseSchema,
  integrationMessageResponseSchema,
  setUserGroupsSchema,
  unenrollGroupsPayloadSchema,
  type SetUserGroupsBody,
  type UnenrollGroupsPayload,
} from "src/integration/schemas/integration.schema";
import { createUserSchema } from "src/user/schemas/createUser.schema";
import { type UpdateUserBody, updateUserSchema } from "src/user/schemas/updateUser.schema";
import {
  allUsersSchema,
  baseUserResponseSchema,
  type AllUsersResponse,
  type UserResponse,
  userSchema,
} from "src/user/schemas/user.schema";
import {
  sortUserFieldsOptions,
  type UsersFilterSchema,
  type SortUserFieldsOptions,
} from "src/user/schemas/userQuery";
import { USER_ROLES, type UserRole } from "src/user/schemas/userRoles";
import { UserService } from "src/user/user.service";

import type { GroupKeywordFilterBody } from "src/group/group.schema";
import type { AllGroupsResponse } from "src/group/group.types";

@ApiHeader({ name: "X-API-Key", required: true })
@ApiHeader({ name: "X-Tenant-Id", required: true })
@ApiTags("Integration")
@ApiUnauthorizedResponse({
  description: "Missing or invalid integration API key / tenant headers.",
})
@ApiForbiddenResponse({
  description: "Authenticated integration key owner is not authorized.",
})
@Public()
@Controller("integration")
@UseGuards(IntegrationApiKeyGuard, RolesGuard)
export class IntegrationController {
  constructor(
    private readonly userService: UserService,
    private readonly groupService: GroupService,
    private readonly courseService: CourseService,
  ) {}

  @Get("users")
  @Roles(USER_ROLES.ADMIN)
  @ApiOperation({ summary: "List users for integration" })
  @Validate({
    request: [
      { type: "query", name: "keyword", schema: Type.String() },
      { type: "query", name: "role", schema: Type.Enum(USER_ROLES) },
      { type: "query", name: "archived", schema: Type.String() },
      { type: "query", name: "page", schema: Type.Number({ minimum: 1 }) },
      { type: "query", name: "perPage", schema: Type.Number() },
      { type: "query", name: "sort", schema: sortUserFieldsOptions },
      { type: "query", name: "groups", schema: groupsFilterSchema },
    ],
    response: paginatedResponse(allUsersSchema),
  })
  async getUsers(
    @Query("keyword") keyword: string,
    @Query("role") role: UserRole,
    @Query("archived") archived: string,
    @Query("page") page: number,
    @Query("perPage") perPage: number,
    @Query("sort") sort: SortUserFieldsOptions,
    @Query("groups") groups: GroupsFilterSchema,
  ): Promise<PaginatedResponse<AllUsersResponse>> {
    const filters: UsersFilterSchema = {
      keyword,
      role,
      archived: archived ? archived === "true" : undefined,
      groups,
    };

    const query = { filters, page, perPage, sort };
    const users = await this.userService.getUsers(query);

    return new PaginatedResponse(users);
  }

  @Get("users/:userId")
  @Roles(USER_ROLES.ADMIN)
  @ApiOperation({ summary: "Get user by ID for integration" })
  @Validate({
    request: [{ type: "param", name: "userId", schema: UUIDSchema }],
    response: baseResponse(userSchema),
  })
  async getUserById(@Param("userId") userId: UUIDType): Promise<BaseResponse<UserResponse>> {
    return new BaseResponse(await this.userService.getUserById(userId));
  }

  @Post("users")
  @Roles(USER_ROLES.ADMIN)
  @ApiOperation({ summary: "Create user via integration API" })
  @Validate({
    request: [{ type: "body", schema: createUserSchema }],
    response: baseResponse(Type.Object({ id: UUIDSchema, message: Type.String() })),
  })
  async createUser(
    @Body() data: Static<typeof createUserSchema>,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<{ id: UUIDType; message: string }>> {
    const user = await this.userService.createUser(data, undefined, currentUser);

    return new BaseResponse({ id: user.id, message: "User created successfully" });
  }

  @Patch("users/:userId")
  @Roles(USER_ROLES.ADMIN)
  @ApiOperation({ summary: "Update user via integration API" })
  @Validate({
    request: [
      { type: "param", name: "userId", schema: UUIDSchema },
      { type: "body", schema: updateUserSchema },
    ],
    response: baseResponse(baseUserResponseSchema),
  })
  async updateUser(
    @Param("userId") userId: UUIDType,
    @Body() data: UpdateUserBody,
    @CurrentUser() currentUser: CurrentUserType,
  ) {
    const updatedUser = await this.userService.updateUser(userId, data, currentUser);
    return new BaseResponse(updatedUser);
  }

  @Delete("users/:userId")
  @Roles(USER_ROLES.ADMIN)
  @ApiOperation({ summary: "Delete user via integration API" })
  @Validate({
    request: [{ type: "param", name: "userId", schema: UUIDSchema }],
    response: baseResponse(integrationDeleteUserResponseSchema),
  })
  async deleteUser(
    @Param("userId") userId: UUIDType,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<{ message: string }>> {
    await this.userService.deleteUser(currentUser, userId);

    return new BaseResponse({ message: "User deleted successfully" });
  }

  @Get("groups")
  @Roles(USER_ROLES.ADMIN)
  @ApiOperation({ summary: "List groups for integration" })
  @Validate({
    request: [
      { type: "query", name: "keyword", schema: Type.String() },
      { type: "query", name: "page", schema: Type.Number({ minimum: 1 }) },
      { type: "query", name: "perPage", schema: Type.Number() },
      { type: "query", name: "sort", schema: groupSortFieldsOptions },
    ],
    response: paginatedResponse(allGroupsSchema),
  })
  async getGroups(
    @Query("keyword") keyword: string,
    @Query("page") page: number,
    @Query("perPage") perPage: number,
    @Query("sort") sort: GroupSortFieldsOptions,
  ): Promise<PaginatedResponse<AllGroupsResponse>> {
    const filters: GroupKeywordFilterBody = {
      keyword,
    };

    const query = { filters, page, perPage, sort };
    const groups = await this.groupService.getAllGroups(query);

    return new PaginatedResponse(groups);
  }

  @Put("users/:userId/groups")
  @Roles(USER_ROLES.ADMIN)
  @ApiOperation({ summary: "Set user groups via integration API" })
  @Validate({
    request: [
      { type: "param", name: "userId", schema: UUIDSchema },
      { type: "body", schema: setUserGroupsSchema },
    ],
    response: baseResponse(integrationMessageResponseSchema),
  })
  async setUserGroups(
    @Param("userId") userId: UUIDType,
    @Body() body: SetUserGroupsBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<{ message: string }>> {
    await this.groupService.setUserGroups(body.groupIds, userId, { actor: currentUser });

    return new BaseResponse({ message: "User groups updated successfully" });
  }

  @Post("courses/:courseId/enroll-users")
  @Roles(USER_ROLES.ADMIN)
  @ApiOperation({ summary: "Enroll users to course via integration API" })
  @Validate({
    request: [
      { type: "param", name: "courseId", schema: UUIDSchema },
      { type: "body", schema: createCoursesEnrollmentSchema },
    ],
    response: baseResponse(integrationMessageResponseSchema),
  })
  async enrollUsers(
    @Param("courseId") courseId: UUIDType,
    @Body() body: Static<typeof createCoursesEnrollmentSchema>,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<{ message: string }>> {
    await this.courseService.enrollCourses(courseId, body, currentUser);

    return new BaseResponse({ message: "Users enrolled successfully" });
  }

  @Delete("courses/:courseId/enroll-users")
  @Roles(USER_ROLES.ADMIN)
  @ApiOperation({ summary: "Unenroll users from course via integration API" })
  @Validate({
    request: [
      { type: "param", name: "courseId", schema: UUIDSchema },
      { type: "body", schema: createCoursesEnrollmentSchema },
    ],
    response: baseResponse(integrationMessageResponseSchema),
  })
  async unenrollUsers(
    @Param("courseId") courseId: UUIDType,
    @Body() body: Static<typeof createCoursesEnrollmentSchema>,
  ): Promise<BaseResponse<{ message: string }>> {
    await this.courseService.unenrollCourse(courseId, body.studentIds);

    return new BaseResponse({ message: "Users unenrolled successfully" });
  }

  @Post("courses/:courseId/enroll-groups")
  @Roles(USER_ROLES.ADMIN)
  @ApiOperation({ summary: "Enroll groups to course via integration API" })
  @Validate({
    request: [
      { type: "param", name: "courseId", schema: UUIDSchema },
      { type: "body", schema: enrolledCourseGroupsPayload },
    ],
    response: baseResponse(integrationMessageResponseSchema),
  })
  async enrollGroups(
    @Param("courseId") courseId: UUIDType,
    @Body() body: Static<typeof enrolledCourseGroupsPayload>,
    @CurrentUser("userId") userId: UUIDType,
    @CurrentUser("role") role: UserRole,
  ): Promise<BaseResponse<{ message: string }>> {
    await this.courseService.enrollGroupsToCourse(courseId, body.groups, userId, role);

    return new BaseResponse({ message: "Groups enrolled successfully" });
  }

  @Delete("courses/:courseId/enroll-groups")
  @Roles(USER_ROLES.ADMIN)
  @ApiOperation({ summary: "Unenroll groups from course via integration API" })
  @Validate({
    request: [
      { type: "param", name: "courseId", schema: UUIDSchema },
      { type: "body", schema: unenrollGroupsPayloadSchema },
    ],
    response: baseResponse(integrationMessageResponseSchema),
  })
  async unenrollGroups(
    @Param("courseId") courseId: UUIDType,
    @Body() body: UnenrollGroupsPayload,
  ): Promise<BaseResponse<{ message: string }>> {
    await this.courseService.unenrollGroupsFromCourse(courseId, body.groupIds);

    return new BaseResponse({ message: "Groups unenrolled successfully" });
  }
}
