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
import { ApiForbiddenResponse, ApiHeader, ApiUnauthorizedResponse, ApiTags } from "@nestjs/swagger";
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
import { API_HEADERS, ApiEndpointDocs } from "src/common/decorators/api-endpoint-docs.decorator";
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
import { IntegrationTenantOptional } from "src/integration/decorators/tenant-optional.decorator";
import { IntegrationApiKeyGuard } from "src/integration/guards/integration-api-key.guard";
import { IntegrationService } from "src/integration/integration.service";
import {
  integrationDeleteUserResponseSchema,
  integrationMessageResponseSchema,
  integrationTenantsSchema,
  setUserGroupsSchema,
  unenrollGroupsPayloadSchema,
  type IntegrationTenant,
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

@ApiHeader({
  name: "X-API-Key",
  required: true,
  description: "Integration API key used to authenticate every integration request.",
})
@ApiTags("Integration")
@ApiUnauthorizedResponse({
  description: "Missing or invalid integration API key.",
})
@ApiForbiddenResponse({
  description: "Authenticated integration key owner is not authorized.",
})
@Public()
@Controller("integration")
@UseGuards(IntegrationApiKeyGuard, RolesGuard)
export class IntegrationController {
  constructor(
    private readonly integrationService: IntegrationService,
    private readonly userService: UserService,
    private readonly groupService: GroupService,
    private readonly courseService: CourseService,
  ) {}

  @Get("tenants")
  @Roles(USER_ROLES.ADMIN)
  @IntegrationTenantOptional()
  @ApiEndpointDocs({
    summary: "List all tenants for integration selection",
    description:
      "Returns all tenants accessible to the current integration API key.\n\nUse this endpoint first to discover which tenant IDs you can operate on. For the rest of integration endpoints, pass one of those IDs in the X-Tenant-Id header.",
    headers: [
      {
        ...API_HEADERS.X_TENANT_ID,
        required: false,
        description: "Tenant ID is optional for this endpoint.",
      },
    ],
  })
  @Validate({
    response: baseResponse(integrationTenantsSchema),
  })
  async getTenants(
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<IntegrationTenant[]>> {
    return new BaseResponse(await this.integrationService.getTenantsForActor(currentUser));
  }

  @Get("users")
  @Roles(USER_ROLES.ADMIN)
  @ApiEndpointDocs({
    summary: "List users for integration",
    description:
      "Returns users from the tenant selected by X-Tenant-Id.\n\nSupports keyword search, role filtering, archived filtering ('true' or 'false'), group filtering, sorting, and pagination so integrations can sync user directories in batches.",
    headers: [API_HEADERS.X_TENANT_ID],
  })
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
  @ApiEndpointDocs({
    summary: "Get user by ID for integration",
    description:
      "Returns the full current state of a single tenant user by userId.\n\nUse this endpoint when your integration needs an authoritative read before applying updates or enrollment changes.",
    headers: [API_HEADERS.X_TENANT_ID],
  })
  @Validate({
    request: [{ type: "param", name: "userId", schema: UUIDSchema }],
    response: baseResponse(userSchema),
  })
  async getUserById(@Param("userId") userId: UUIDType): Promise<BaseResponse<UserResponse>> {
    return new BaseResponse(await this.userService.getUserById(userId));
  }

  @Post("users")
  @Roles(USER_ROLES.ADMIN)
  @ApiEndpointDocs({
    summary: "Create user via integration API",
    description:
      "Creates a new user inside the tenant selected by X-Tenant-Id.\n\nProvide the user payload in the request body. The response returns the created user ID so your external system can persist the Mentingo mapping.",
    headers: [API_HEADERS.X_TENANT_ID],
  })
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
  @ApiEndpointDocs({
    summary: "Update user via integration API",
    description:
      "Updates an existing tenant user identified by userId.\n\nOnly fields included in the body are modified. Use this endpoint for profile, role, or status synchronization from an external identity source.",
    headers: [API_HEADERS.X_TENANT_ID],
  })
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
  @ApiEndpointDocs({
    summary: "Delete user via integration API",
    description:
      "Deletes the tenant user identified by userId.\n\nUse this when your source-of-truth system has deprovisioned a user and Mentingo access should be removed as part of lifecycle automation.",
    headers: [API_HEADERS.X_TENANT_ID],
  })
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
  @ApiEndpointDocs({
    summary: "List groups for integration",
    description:
      "Returns groups from the tenant selected by X-Tenant-Id.\n\nSupports keyword filtering, sorting, and pagination so your integration can resolve external groups to Mentingo group IDs before assignment or enrollment operations.",
    headers: [API_HEADERS.X_TENANT_ID],
  })
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
  @ApiEndpointDocs({
    summary: "Set user groups via integration API",
    description:
      "Sets the complete group membership for a user in the selected tenant.\n\nThis operation treats the provided groupIds list as the source of truth and updates membership to match it.",
    headers: [API_HEADERS.X_TENANT_ID],
  })
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
  @ApiEndpointDocs({
    summary: "Enroll users to course via integration API",
    description:
      "Enrolls the provided user IDs into the specified course within the selected tenant.\n\nUse this endpoint to synchronize direct, user-level course access from your external system.",
    headers: [API_HEADERS.X_TENANT_ID],
  })
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
  @ApiEndpointDocs({
    summary: "Unenroll users from course via integration API",
    description:
      "Removes the provided user IDs from the specified course within the selected tenant.\n\nUse this endpoint to revoke direct course access when enrollment should no longer apply.",
    headers: [API_HEADERS.X_TENANT_ID],
  })
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
  @ApiEndpointDocs({
    summary: "Enroll groups to course via integration API",
    description:
      "Enrolls members of the provided group IDs into the specified course within the selected tenant.\n\nUse this for group-driven provisioning where course access is managed at group level instead of per user.",
    headers: [API_HEADERS.X_TENANT_ID],
  })
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
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<{ message: string }>> {
    await this.courseService.enrollGroupsToCourse(courseId, body.groups, currentUser);

    return new BaseResponse({ message: "Groups enrolled successfully" });
  }

  @Delete("courses/:courseId/enroll-groups")
  @Roles(USER_ROLES.ADMIN)
  @ApiEndpointDocs({
    summary: "Unenroll groups from course via integration API",
    description:
      "Removes members of the provided group IDs from the specified course within the selected tenant.\n\nUse this for group-driven deprovisioning when course access is no longer required.",
    headers: [API_HEADERS.X_TENANT_ID],
  })
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
