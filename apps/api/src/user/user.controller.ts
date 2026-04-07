import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express/multer/interceptors/file.interceptor";
import { ApiBody } from "@nestjs/swagger";
import { ApiConsumes } from "@nestjs/swagger/dist/decorators/api-consumes.decorator";
import { ALLOWED_AVATAR_IMAGE_TYPES, OnboardingPages, PERMISSIONS } from "@repo/shared";
import { Type } from "@sinclair/typebox";
import { memoryStorage } from "multer";
import { Validate } from "nestjs-typebox";

import {
  baseResponse,
  BaseResponse,
  nullResponse,
  PaginatedResponse,
  paginatedResponse,
  UUIDSchema,
  type UUIDType,
} from "src/common";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { hasPermission } from "src/common/permissions/permission.utils";
import { CurrentUser as CurrentUserType } from "src/common/types/current-user.type";
import { ALLOWED_EXCEL_MIME_TYPES, MAX_FILE_SIZE } from "src/file/file.constants";
import { getBaseFileTypePipe } from "src/file/utils/baseFileTypePipe";
import { buildFileTypeRegex } from "src/file/utils/fileTypeRegex";
import { ImageConstraintsValidator } from "src/file/validators/image-constraints.validator";
import { groupsFilterSchema } from "src/group/group.schema";
import { GroupsFilterSchema } from "src/group/group.types";
import {
  type CreateUserBody,
  createUserSchema,
  importUserResponseSchema,
} from "src/user/schemas/createUser.schema";
import {
  AVATAR_ASPECT_RATIO,
  AVATAR_MAX_RESOLUTION,
  AVATAR_MAX_SIZE,
} from "src/user/user.constants";
import { ValidateMultipartPipe } from "src/utils/pipes/validateMultipartPipe";

import {
  ArchiveUsersSchema,
  archiveUsersSchema,
  archiveUsersSchemaResponse,
} from "./schemas/archiveUsers.schema";
import { type ChangePasswordBody, changePasswordSchema } from "./schemas/changePassword.schema";
import { deleteUsersSchema, type DeleteUsersSchema } from "./schemas/deleteUsers.schema";
import {
  BulkAssignUserGroups,
  bulkAssignUsersGroupsSchema,
  BulkUpdateUsersRolesBody,
  bulkUpdateUsersRolesSchema,
  type UpdateUserBody,
  type UpdateUserProfileBody,
  updateUserProfileSchema,
  updateUserSchema,
  UpsertUserDetailsBody,
  upsertUserDetailsSchema,
} from "./schemas/updateUser.schema";
import {
  type AllRolesResponse,
  type AllUsersResponse,
  allRolesSchema,
  allUsersSchema,
  baseUserResponseSchema,
  type UserDetailsResponse,
  userDetailsResponseSchema,
  userOnboardingStatusSchema,
  type UserResponse,
  userSchema,
} from "./schemas/user.schema";
import { sortUserFieldsOptions, SortUserFieldsOptions } from "./schemas/userQuery";
import { UserService } from "./user.service";

import type { ArchiveUsersSchemaResponse } from "./schemas/archiveUsers.schema";
import type { UsersFilterSchema } from "./schemas/userQuery";
import type { Static } from "@sinclair/typebox";

@Controller("user")
export class UserController {
  constructor(private readonly usersService: UserService) {}

  @Get("all")
  @RequirePermission(PERMISSIONS.USER_MANAGE)
  @Validate({
    request: [
      { type: "query", name: "keyword", schema: Type.String() },
      { type: "query", name: "roleSlug", schema: Type.String() },
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
    @Query("roleSlug") roleSlug: string,
    @Query("archived") archived: string,
    @Query("page") page: number,
    @Query("perPage") perPage: number,
    @Query("sort") sort: SortUserFieldsOptions,
    @Query("groups") groups: GroupsFilterSchema,
  ): Promise<PaginatedResponse<AllUsersResponse>> {
    const filters: UsersFilterSchema = {
      keyword,
      roleSlug,
      archived: archived ? archived === "true" : undefined,
      groups,
    };

    const query = { filters, page, perPage, sort };

    const users = await this.usersService.getUsers(query);

    return new PaginatedResponse(users);
  }

  @Get("roles")
  @RequirePermission(PERMISSIONS.USER_MANAGE)
  @Validate({
    response: baseResponse(allRolesSchema),
  })
  async getRoles(
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<AllRolesResponse>> {
    const roles = await this.usersService.getRoles(currentUser.tenantId);
    return new BaseResponse(roles);
  }

  @Get()
  @RequirePermission(PERMISSIONS.USER_MANAGE)
  @Validate({
    request: [{ type: "query", name: "id", schema: UUIDSchema, required: true }],
    response: baseResponse(userSchema),
  })
  async getUserById(@Query("id") id: UUIDType): Promise<BaseResponse<UserResponse>> {
    const user = await this.usersService.getUserById(id);

    return new BaseResponse(user);
  }

  @Get("details")
  @RequirePermission(PERMISSIONS.USER_READ_SELF)
  @Validate({
    request: [{ type: "query", name: "userId", schema: UUIDSchema, required: true }],
    response: baseResponse(userDetailsResponseSchema),
  })
  async getUserDetails(
    @Query("userId") userId: UUIDType,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<UserDetailsResponse>> {
    const userDetails = await this.usersService.getUserDetails(userId, currentUser);
    return new BaseResponse(userDetails);
  }

  @Patch()
  @RequirePermission(PERMISSIONS.ACCOUNT_UPDATE_SELF)
  @Validate({
    response: baseResponse(baseUserResponseSchema),
    request: [
      { type: "query", name: "id", schema: UUIDSchema, required: true },
      { type: "body", schema: updateUserSchema },
    ],
  })
  async updateUser(
    @Query("id") id: UUIDType,
    @Body() data: UpdateUserBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<Static<typeof baseUserResponseSchema>>> {
    {
      if (currentUser.userId !== id) {
        throw new ForbiddenException("common.toast.noAccess");
      }

      const canManageUsers = hasPermission(currentUser.permissions, PERMISSIONS.USER_MANAGE);
      const { roleSlugs, groups, archived } = data;

      if ((roleSlugs !== undefined || archived !== undefined) && !canManageUsers) {
        throw new ForbiddenException("common.toast.noAccess");
      }

      if (groups !== undefined && !canManageUsers) {
        throw new ForbiddenException("common.toast.noAccess");
      }

      await this.usersService.updateUser(id, data, currentUser);
      const updatedUser = await this.usersService.getUserById(id);

      return new BaseResponse(updatedUser);
    }
  }

  @Patch("details")
  @RequirePermission(PERMISSIONS.ACCOUNT_UPDATE_SELF)
  @Validate({
    response: baseResponse(Type.Object({ id: UUIDSchema, message: Type.String() })),
    request: [{ type: "body", schema: upsertUserDetailsSchema }],
  })
  async upsertUserDetails(
    @Body() data: UpsertUserDetailsBody,
    @CurrentUser("userId") currentUserId: UUIDType,
  ): Promise<BaseResponse<{ id: UUIDType; message: string }>> {
    {
      const upsertedUser = await this.usersService.upsertUserDetails(currentUserId, data);

      return new BaseResponse({
        id: upsertedUser.userId,
        message: "User details updated successfully",
      });
    }
  }

  @Patch("profile")
  @RequirePermission(PERMISSIONS.ACCOUNT_UPDATE_SELF)
  @UseInterceptors(FileInterceptor("userAvatar", { storage: memoryStorage() }))
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      anyOf: [
        {
          type: "object",
          properties: {
            userAvatar: {
              type: "string",
              format: "binary",
            },
            data: {
              format: "string",
              type: "string",
            },
          },
        },
      ],
    },
  })
  async updateUserProfile(
    @Body(new ValidateMultipartPipe(updateUserProfileSchema))
    userInfo: { data: UpdateUserProfileBody },
    @CurrentUser("userId") currentUserId: UUIDType,
    @UploadedFile(
      getBaseFileTypePipe(buildFileTypeRegex(ALLOWED_AVATAR_IMAGE_TYPES), AVATAR_MAX_SIZE)
        .addValidator(
          new ImageConstraintsValidator({
            maxResolution: AVATAR_MAX_RESOLUTION,
            aspectRatio: AVATAR_ASPECT_RATIO,
          }),
        )
        .build({ errorHttpStatusCode: HttpStatus.BAD_REQUEST, fileIsRequired: false }),
    )
    userAvatar?: Express.Multer.File,
  ): Promise<BaseResponse<{ message: string }>> {
    await this.usersService.updateUserProfile(currentUserId, userInfo.data, userAvatar);

    return new BaseResponse({
      message: "User profile updated successfully",
    });
  }

  @Patch("admin")
  @RequirePermission(PERMISSIONS.USER_MANAGE)
  @Validate({
    response: baseResponse(baseUserResponseSchema),
    request: [
      { type: "query", name: "id", schema: UUIDSchema, required: true },
      { type: "body", schema: updateUserSchema },
    ],
  })
  async adminUpdateUser(
    @Query("id") id: UUIDType,
    @Body() data: UpdateUserBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<Static<typeof baseUserResponseSchema>>> {
    {
      await this.usersService.updateUser(id, data, currentUser);
      const updatedUser = await this.usersService.getUserById(id);

      return new BaseResponse(updatedUser);
    }
  }

  @Patch("change-password")
  @RequirePermission(PERMISSIONS.ACCOUNT_UPDATE_SELF)
  @Validate({
    response: nullResponse(),
    request: [
      { type: "query", name: "id", schema: UUIDSchema, required: true },
      { type: "body", schema: changePasswordSchema },
    ],
  })
  async changePassword(
    @Query("id") id: UUIDType,
    @Body() data: ChangePasswordBody,
    @CurrentUser("userId") currentUserId: UUIDType,
  ): Promise<null> {
    if (currentUserId !== id) {
      throw new ForbiddenException("common.toast.noAccess");
    }
    await this.usersService.changePassword(id, data);

    return null;
  }

  @Delete()
  @RequirePermission(PERMISSIONS.USER_MANAGE)
  @Validate({
    response: nullResponse(),
    request: [{ type: "body", schema: deleteUsersSchema }],
  })
  async deleteBulkUsers(
    @Body() data: DeleteUsersSchema,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<null> {
    await this.usersService.deleteBulkUsers(currentUser, data.userIds);

    return null;
  }

  @Patch("bulk/groups")
  @RequirePermission(PERMISSIONS.USER_MANAGE)
  @Validate({
    request: [{ type: "body", schema: bulkAssignUsersGroupsSchema }],
  })
  async bulkAssignUsersToGroup(
    @Body() data: BulkAssignUserGroups,
    @CurrentUser() currentUser: CurrentUserType,
  ) {
    await this.usersService.bulkAssignUsersToGroup(data, currentUser);

    return new BaseResponse({
      message: "User groups upserted successfully",
    });
  }

  @Patch("bulk/archive")
  @RequirePermission(PERMISSIONS.USER_MANAGE)
  @Validate({
    request: [{ type: "body", schema: archiveUsersSchema }],
    response: baseResponse(archiveUsersSchemaResponse),
  })
  async archiveBulkUsers(
    @Body() body: ArchiveUsersSchema,
  ): Promise<BaseResponse<ArchiveUsersSchemaResponse>> {
    const archivedUsers = await this.usersService.bulkArchiveUsers(body.userIds);

    return new BaseResponse(archivedUsers);
  }

  @Patch("bulk/roles")
  @RequirePermission(PERMISSIONS.USER_MANAGE)
  @Validate({
    request: [{ type: "body", schema: bulkUpdateUsersRolesSchema }],
  })
  async bulkUpdateUsersRoles(
    @Body() data: BulkUpdateUsersRolesBody,
    @CurrentUser() currentUser: CurrentUserType,
  ) {
    return this.usersService.updateUsersRoles(data, currentUser);
  }

  @Post()
  @RequirePermission(PERMISSIONS.USER_MANAGE)
  @Validate({
    response: baseResponse(Type.Object({ id: UUIDSchema, message: Type.String() })),
    request: [{ type: "body", schema: createUserSchema }],
  })
  async createUser(
    @Body() data: CreateUserBody,
    @CurrentUser() creator: CurrentUserType,
  ): Promise<BaseResponse<{ id: UUIDType; message: string }>> {
    const { id } = await this.usersService.createUser(data, undefined, creator);

    return new BaseResponse({
      id,
      message: "User created successfully",
    });
  }

  @Post("import")
  @RequirePermission(PERMISSIONS.USER_MANAGE)
  @UseInterceptors(FileInterceptor("usersFile"))
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        usersFile: {
          type: "string",
          format: "binary",
        },
      },
    },
  })
  @Validate({
    response: baseResponse(importUserResponseSchema),
  })
  async importUsers(
    @UploadedFile(
      getBaseFileTypePipe(buildFileTypeRegex(ALLOWED_EXCEL_MIME_TYPES), MAX_FILE_SIZE, true).build({
        errorHttpStatusCode: HttpStatus.BAD_REQUEST,
      }),
    )
    usersFile: Express.Multer.File,
    @CurrentUser() creator: CurrentUserType,
  ) {
    const importStats = await this.usersService.importUsers(usersFile, creator);

    return new BaseResponse(importStats);
  }

  @Patch("onboarding-status/reset")
  @RequirePermission(PERMISSIONS.ACCOUNT_UPDATE_SELF)
  @Validate({
    response: baseResponse(userOnboardingStatusSchema),
  })
  async resetOnboardingStatus(@CurrentUser("userId") userId: UUIDType) {
    const onboardingStatus = await this.usersService.resetOnboardingForUser(userId);

    return new BaseResponse(onboardingStatus);
  }

  @Patch("onboarding-status/:page")
  @RequirePermission(PERMISSIONS.ACCOUNT_UPDATE_SELF)
  @Validate({
    response: baseResponse(userOnboardingStatusSchema),
  })
  async markOnboardingComplete(
    @CurrentUser("userId") userId: UUIDType,
    @Param("page") page: OnboardingPages,
  ) {
    const onboardingStatus = await this.usersService.markOnboardingPageAsCompleted(userId, page);

    return new BaseResponse(onboardingStatus);
  }
}
