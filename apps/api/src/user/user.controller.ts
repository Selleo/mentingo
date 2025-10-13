import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express/multer/interceptors/file.interceptor";
import { ApiBody } from "@nestjs/swagger";
import { ApiConsumes } from "@nestjs/swagger/dist/decorators/api-consumes.decorator";
import { Type } from "@sinclair/typebox";
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
import { Public } from "src/common/decorators/public.decorator";
import { Roles } from "src/common/decorators/roles.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { RolesGuard } from "src/common/guards/roles.guard";
import {
  type CreateUserBody,
  createUserSchema,
  importUserResponseSchema,
} from "src/user/schemas/createUser.schema";
import { ValidateMultipartPipe } from "src/utils/pipes/validateMultipartPipe";

import {
  ArchiveUsersSchema,
  archiveUsersSchema,
  archiveUsersSchemaResponse,
} from "./schemas/archiveUsers.schema";
import { type ChangePasswordBody, changePasswordSchema } from "./schemas/changePassword.schema";
import { deleteUsersSchema, type DeleteUsersSchema } from "./schemas/deleteUsers.schema";
import {
  type UpdateUserBody,
  type UpdateUserProfileBody,
  updateUserProfileSchema,
  updateUserSchema,
  UpsertUserDetailsBody,
  upsertUserDetailsSchema,
  BulkAssignUserGroups,
  bulkAssignUsersGroupsSchema,
} from "./schemas/updateUser.schema";
import {
  type AllUsersResponse,
  allUsersSchema,
  type UserDetailsResponse,
  type UserResponse,
  baseUserResponseSchema,
  userDetailsResponseSchema,
  userSchema,
} from "./schemas/user.schema";
import { SortUserFieldsOptions } from "./schemas/userQuery";
import { USER_ROLES, UserRole } from "./schemas/userRoles";
import { UserService } from "./user.service";

import type { ArchiveUsersSchemaResponse } from "./schemas/archiveUsers.schema";
import type { UsersFilterSchema } from "./schemas/userQuery";
import type { Static } from "@sinclair/typebox";

@Controller("user")
@UseGuards(RolesGuard)
export class UserController {
  constructor(private readonly usersService: UserService) {}

  @Get("all")
  @Roles(USER_ROLES.ADMIN)
  @Validate({
    request: [
      { type: "query", name: "keyword", schema: Type.String() },
      { type: "query", name: "role", schema: Type.Enum(USER_ROLES) },
      { type: "query", name: "archived", schema: Type.String() },
      { type: "query", name: "page", schema: Type.Number({ minimum: 1 }) },
      { type: "query", name: "perPage", schema: Type.Number() },
      { type: "query", name: "sort", schema: Type.String() },
      { type: "query", name: "groupId", schema: Type.String() },
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
    @Query("groupId") groupId: string,
  ): Promise<PaginatedResponse<AllUsersResponse>> {
    const filters: UsersFilterSchema = {
      keyword,
      role,
      archived: archived ? archived === "true" : undefined,
      groupId,
    };

    const query = { filters, page, perPage, sort };

    const users = await this.usersService.getUsers(query);

    return new PaginatedResponse(users);
  }

  @Get()
  @Roles(USER_ROLES.ADMIN)
  @Validate({
    request: [{ type: "query", name: "id", schema: UUIDSchema, required: true }],
    response: baseResponse(userSchema),
  })
  async getUserById(@Query("id") id: UUIDType): Promise<BaseResponse<UserResponse>> {
    const user = await this.usersService.getUserById(id);

    return new BaseResponse(user);
  }

  @Get("details")
  @Public()
  @Validate({
    request: [{ type: "query", name: "userId", schema: UUIDSchema, required: true }],
    response: baseResponse(userDetailsResponseSchema),
  })
  async getUserDetails(
    @Query("userId") userId: UUIDType,
    @CurrentUser("role") role: UserRole,
    @CurrentUser("userId") currentUserId: UUIDType,
  ): Promise<BaseResponse<UserDetailsResponse>> {
    const userDetails = await this.usersService.getUserDetails(userId, currentUserId, role);
    return new BaseResponse(userDetails);
  }

  @Patch()
  @Roles(USER_ROLES.ADMIN)
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
    @CurrentUser("userId") currentUserId: UUIDType,
  ): Promise<BaseResponse<Static<typeof baseUserResponseSchema>>> {
    {
      if (currentUserId !== id) {
        throw new ForbiddenException("You can only update your own account");
      }

      await this.usersService.updateUser(id, data);
      const updatedUser = await this.usersService.getUserById(id);

      return new BaseResponse(updatedUser);
    }
  }

  @Patch("details")
  @Roles(USER_ROLES.CONTENT_CREATOR, USER_ROLES.ADMIN)
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
  @UseInterceptors(FileInterceptor("userAvatar"))
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
    @UploadedFile() userAvatar?: Express.Multer.File,
  ): Promise<BaseResponse<{ message: string }>> {
    await this.usersService.updateUserProfile(currentUserId, userInfo.data, userAvatar);

    return new BaseResponse({
      message: "User profile updated successfully",
    });
  }

  @Patch("admin")
  @Roles(USER_ROLES.ADMIN)
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
  ): Promise<BaseResponse<Static<typeof baseUserResponseSchema>>> {
    {
      await this.usersService.updateUser(id, data);
      const updatedUser = await this.usersService.getUserById(id);

      return new BaseResponse(updatedUser);
    }
  }

  @Patch("change-password")
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
      throw new ForbiddenException("You can only update your own account");
    }
    await this.usersService.changePassword(id, data.oldPassword, data.newPassword);

    return null;
  }

  @Delete("user")
  @Roles(USER_ROLES.ADMIN)
  @Validate({
    response: nullResponse(),
    request: [{ type: "query", name: "id", schema: UUIDSchema, required: true }],
  })
  async deleteUser(
    @Query("id") id: UUIDType,
    @CurrentUser("userId") currentUserId: UUIDType,
  ): Promise<null> {
    if (currentUserId !== id) {
      throw new ForbiddenException("You can only delete your own account");
    }

    await this.usersService.deleteUser(id);

    return null;
  }

  @Delete()
  @Roles(USER_ROLES.ADMIN)
  @Validate({
    response: nullResponse(),
    request: [{ type: "body", schema: deleteUsersSchema }],
  })
  async deleteBulkUsers(@Body() data: DeleteUsersSchema): Promise<null> {
    await this.usersService.deleteBulkUsers(data.userIds);

    return null;
  }

  @Patch("bulk/groups")
  @Roles(USER_ROLES.ADMIN)
  @Validate({
    request: [{ type: "body", schema: bulkAssignUsersGroupsSchema }],
  })
  async bulkAssignUsersToGroup(@Body() data: BulkAssignUserGroups) {
    await this.usersService.bulkAssignUsersToGroup(data);

    return new BaseResponse({
      message: "User groups upserted successfully",
    });
  }

  @Patch("bulk/archive")
  @Roles(USER_ROLES.ADMIN)
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

  @Post()
  @Roles(USER_ROLES.ADMIN)
  @Validate({
    response: baseResponse(Type.Object({ id: UUIDSchema, message: Type.String() })),
    request: [{ type: "body", schema: createUserSchema }],
  })
  async createUser(
    @Body() data: CreateUserBody,
  ): Promise<BaseResponse<{ id: UUIDType; message: string }>> {
    const { id } = await this.usersService.createUser(data);

    return new BaseResponse({
      id,
      message: "User created successfully",
    });
  }

  @Post("import")
  @Roles(USER_ROLES.ADMIN)
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
  async importUsers(@UploadedFile() usersFile: Express.Multer.File) {
    const importStats = await this.usersService.importUsers(usersFile);

    return new BaseResponse(importStats);
  }
}
