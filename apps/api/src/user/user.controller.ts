import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
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
import { Roles } from "src/common/decorators/roles.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { RolesGuard } from "src/common/guards/roles.guard";
import { commonUserSchema } from "src/common/schemas/common-user.schema";
import { type CreateUserBody, createUserSchema } from "src/user/schemas/createUser.schema";

import { type ChangePasswordBody, changePasswordSchema } from "./schemas/changePassword.schema";
import { deleteUsersSchema, type DeleteUsersSchema } from "./schemas/deleteUsers.schema";
import {
  type UpdateUserBody,
  updateUserSchema,
  UpsertUserDetailsBody,
  upsertUserDetailsSchema,
} from "./schemas/updateUser.schema";
import {
  type AllUsersResponse,
  allUsersSchema,
  type UserDetails,
  userDetailsSchema,
  type UserResponse,
} from "./schemas/user.schema";
import { SortUserFieldsOptions } from "./schemas/userQuery";
import { USER_ROLES, UserRole } from "./schemas/userRoles";
import { UserService } from "./user.service";

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
  ): Promise<PaginatedResponse<AllUsersResponse>> {
    const filters: UsersFilterSchema = {
      keyword,
      role,
      archived: archived === "true",
    };

    const query = { filters, page, perPage, sort };

    const users = await this.usersService.getUsers(query);

    return new PaginatedResponse(users);
  }

  @Get()
  @Roles(USER_ROLES.ADMIN)
  @Validate({
    request: [{ type: "query", name: "id", schema: UUIDSchema, required: true }],
    response: baseResponse(commonUserSchema),
  })
  async getUserById(@Query("id") id: UUIDType): Promise<BaseResponse<UserResponse>> {
    const user = await this.usersService.getUserById(id);

    return new BaseResponse(user);
  }

  @Get("details")
  @Roles(...Object.values(USER_ROLES))
  @Validate({
    request: [{ type: "query", name: "userId", schema: UUIDSchema, required: true }],
    response: baseResponse(userDetailsSchema),
  })
  async getUserDetails(
    @Query("userId") userId: UUIDType,
    @CurrentUser("role") role: UserRole,
  ): Promise<BaseResponse<UserDetails>> {
    const userDetails = await this.usersService.getUserDetails(userId, role);
    return new BaseResponse(userDetails);
  }

  @Patch()
  @Roles(USER_ROLES.ADMIN)
  @Validate({
    response: baseResponse(commonUserSchema),
    request: [
      { type: "query", name: "id", schema: UUIDSchema, required: true },
      { type: "body", schema: updateUserSchema },
    ],
  })
  async updateUser(
    @Query("id") id: UUIDType,
    @Body() data: UpdateUserBody,
    @CurrentUser("userId") currentUserId: UUIDType,
  ): Promise<BaseResponse<Static<typeof commonUserSchema>>> {
    {
      if (currentUserId !== id) {
        throw new ForbiddenException("You can only update your own account");
      }

      const updatedUser = await this.usersService.updateUser(id, data);

      return new BaseResponse(updatedUser);
    }
  }

  @Patch("details")
  @Roles(USER_ROLES.TEACHER, USER_ROLES.ADMIN)
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

  @Patch("admin")
  @Roles(USER_ROLES.ADMIN)
  @Validate({
    response: baseResponse(commonUserSchema),
    request: [
      { type: "query", name: "id", schema: UUIDSchema, required: true },
      { type: "body", schema: updateUserSchema },
    ],
  })
  async adminUpdateUser(
    @Query("id") id: UUIDType,
    @Body() data: UpdateUserBody,
  ): Promise<BaseResponse<Static<typeof commonUserSchema>>> {
    {
      const updatedUser = await this.usersService.updateUser(id, data);

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
}
