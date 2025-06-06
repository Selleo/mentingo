import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { Type } from "@sinclair/typebox";
import { Validate } from "nestjs-typebox";

import {
  BaseResponse,
  baseResponse,
  paginatedResponse,
  PaginatedResponse,
  UUIDSchema,
  type UUIDType,
} from "src/common";
import { Roles } from "src/common/decorators/roles.decorator";
import { RolesGuard } from "src/common/guards/roles.guard";
import {
  allGroupsSchema,
  baseGroupSchema,
  bulkDeleteGroupsSchema,
  groupSchema,
} from "src/group/group.schema";
import { GroupService } from "src/group/group.service";
import { UpsertGroupBody, GroupSortFieldsOptions } from "src/group/group.types";
import { USER_ROLES } from "src/user/schemas/userRoles";

import type { AllGroupsResponse, GroupsFilterSchema, GroupResponse } from "src/group/group.types";

@Controller("group")
@UseGuards(RolesGuard)
export class GroupController {
  constructor(private readonly groupService: GroupService) {}

  @Get("all")
  @Roles(USER_ROLES.ADMIN)
  @Validate({
    request: [
      { type: "query", name: "keyword", schema: Type.String() },
      { type: "query", name: "page", schema: Type.Number({ minimum: 1 }) },
      { type: "query", name: "perPage", schema: Type.Number() },
      { type: "query", name: "sort", schema: Type.String() },
    ],
    response: paginatedResponse(allGroupsSchema),
  })
  async getAllGroups(
    @Query("keyword") keyword: string,
    @Query("page") page: number,
    @Query("perPage") perPage: number,
    @Query("sort") sort: GroupSortFieldsOptions,
  ): Promise<PaginatedResponse<AllGroupsResponse>> {
    const filters: GroupsFilterSchema = {
      keyword,
    };
    const query = { filters, page, perPage, sort };

    const groups = await this.groupService.getAllGroups(query);

    return new PaginatedResponse(groups);
  }

  @Get(":groupId")
  @Roles(USER_ROLES.ADMIN)
  @Validate({
    request: [{ type: "param", name: "groupId", schema: UUIDSchema }],
    response: baseResponse(groupSchema),
  })
  async getGroupById(@Param("groupId") userId: UUIDType): Promise<{ data: GroupResponse }> {
    return await this.groupService.getGroupById(userId);
  }

  @Get("/user/:userId")
  @Roles(USER_ROLES.ADMIN)
  @Validate({
    request: [
      { type: "param", name: "userId", schema: UUIDSchema },
      { type: "query", name: "keyword", schema: Type.String() },
      { type: "query", name: "page", schema: Type.Number({ minimum: 1 }) },
      { type: "query", name: "perPage", schema: Type.Number() },
      { type: "query", name: "sort", schema: Type.String() },
    ],
    response: paginatedResponse(allGroupsSchema),
  })
  async getUserGroups(
    @Param("userId") userId: UUIDType,
    @Query("keyword") keyword: string,
    @Query("page") page: number,
    @Query("perPage") perPage: number,
    @Query("sort") sort: GroupSortFieldsOptions,
  ): Promise<PaginatedResponse<AllGroupsResponse>> {
    const filters: GroupsFilterSchema = {
      keyword,
    };
    const query = { filters, page, perPage, sort };

    const groups = await this.groupService.getUserGroups(query, userId);

    return new PaginatedResponse(groups);
  }

  @Post()
  @Roles(USER_ROLES.ADMIN)
  @Validate({
    request: [{ type: "body", schema: baseGroupSchema }],
    response: baseResponse(Type.Object({ id: UUIDSchema, message: Type.String() })),
  })
  async createGroup(
    @Body() createGroupBody: UpsertGroupBody,
  ): Promise<BaseResponse<{ id: UUIDType; message: string }>> {
    const { id } = await this.groupService.createGroup(createGroupBody);

    return new BaseResponse({ id, message: "Group created successfully" });
  }

  @Patch(":groupId")
  @Roles(USER_ROLES.ADMIN)
  @Validate({
    request: [
      { type: "param", name: "groupId", schema: Type.String() },
      { type: "body", schema: baseGroupSchema },
    ],
    response: baseResponse(baseGroupSchema),
  })
  async updateGroup(
    @Query("groupId") groupId: UUIDType,
    @Body() updateGroupBody: UpsertGroupBody,
  ): Promise<BaseResponse<GroupResponse>> {
    const updatedGroup = await this.groupService.updateGroup(groupId, updateGroupBody);

    return new BaseResponse(updatedGroup);
  }

  @Delete(":groupId")
  @Roles(USER_ROLES.ADMIN)
  @Validate({
    request: [{ type: "param", name: "groupId", schema: Type.String() }],
    response: baseResponse(Type.Object({ message: Type.String() })),
  })
  async deleteGroup(
    @Query("groupId") groupId: UUIDType,
  ): Promise<BaseResponse<{ message: string }>> {
    await this.groupService.deleteGroup(groupId);

    return new BaseResponse({
      message: "Group deleted successfully",
    });
  }

  @Delete("")
  @Roles(USER_ROLES.ADMIN)
  @Validate({
    request: [{ type: "body", schema: bulkDeleteGroupsSchema }],
    response: baseResponse(Type.Object({ message: Type.String() })),
  })
  async bulkDeleteGroups(@Body() groupIds: UUIDType[]): Promise<BaseResponse<{ message: string }>> {
    await this.groupService.bulkDeleteGroups(groupIds);

    return new BaseResponse({
      message: "Groups deleted successfully",
    });
  }

  @Post("assign")
  @Roles(USER_ROLES.ADMIN)
  @Validate({
    request: [
      { type: "query", name: "userId", schema: UUIDSchema },
      { type: "query", name: "groupId", schema: UUIDSchema },
    ],
    response: baseResponse(Type.Object({ message: Type.String() })),
  })
  async assignUserToGroup(
    @Query("userId") userId: UUIDType,
    @Query("groupId") groupId: UUIDType,
  ): Promise<BaseResponse<{ message: string }>> {
    await this.groupService.assignUserToGroup(groupId, userId);

    return new BaseResponse({ message: "User assigned successfully" });
  }

  @Delete("unassign")
  @Roles(USER_ROLES.ADMIN)
  @Validate({
    request: [
      { type: "query", name: "userId", schema: UUIDSchema },
      { type: "query", name: "groupId", schema: UUIDSchema },
    ],
    response: baseResponse(Type.Object({ message: Type.String() })),
  })
  async unassignUserFromGroup(
    @Query("userId") userId: UUIDType,
    @Query("groupId") groupId: UUIDType,
  ): Promise<BaseResponse<{ message: string }>> {
    await this.groupService.unassignUserFromGroup(groupId, userId);

    return new BaseResponse({ message: "User unassigned successfully" });
  }
}
