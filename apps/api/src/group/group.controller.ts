import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
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
import { CurrentUser } from "src/common/decorators/user.decorator";
import { CurrentUser as CurrentUserType } from "src/common/types/current-user.type";
import {
  allGroupsSchema,
  baseGroupSchema,
  bulkDeleteGroupsSchema,
  groupSchema,
  upsertGroupSchema,
} from "src/group/group.schema";
import { GroupService } from "src/group/group.service";
import { UpsertGroupBody, GroupSortFieldsOptions } from "src/group/group.types";
import { PERMISSIONS } from "src/permission/permission.constants";
import { RequirePermission } from "src/permission/permission.decorator";

import type { GroupKeywordFilterBody } from "src/group/group.schema";
import type { AllGroupsResponse, GroupResponse } from "src/group/group.types";

@Controller("group")
export class GroupController {
  constructor(private readonly groupService: GroupService) {}

  @Get("all")
  @RequirePermission(PERMISSIONS.GROUP_READ)
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
    const filters: GroupKeywordFilterBody = {
      keyword,
    };
    const query = { filters, page, perPage, sort };

    const groups = await this.groupService.getAllGroups(query);

    return new PaginatedResponse(groups);
  }

  @Get(":groupId")
  @RequirePermission(PERMISSIONS.GROUP_READ)
  @Validate({
    request: [{ type: "param", name: "groupId", schema: UUIDSchema }],
    response: baseResponse(groupSchema),
  })
  async getGroupById(@Param("groupId") userId: UUIDType): Promise<{ data: GroupResponse }> {
    return await this.groupService.getGroupById(userId);
  }

  @Get("/user/:userId")
  @RequirePermission(PERMISSIONS.GROUP_READ)
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
    const filters: GroupKeywordFilterBody = {
      keyword,
    };
    const query = { filters, page, perPage, sort };

    const groups = await this.groupService.getUserGroups(query, userId);

    return new PaginatedResponse(groups);
  }

  @Post()
  @RequirePermission(PERMISSIONS.GROUP_MANAGE)
  @Validate({
    request: [{ type: "body", schema: upsertGroupSchema }],
    response: baseResponse(Type.Object({ id: UUIDSchema, message: Type.String() })),
  })
  async createGroup(
    @Body() createGroupBody: UpsertGroupBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<{ id: UUIDType; message: string }>> {
    const { id } = await this.groupService.createGroup(createGroupBody, currentUser);

    return new BaseResponse({ id, message: "Group created successfully" });
  }

  @Patch(":groupId")
  @RequirePermission(PERMISSIONS.GROUP_MANAGE)
  @Validate({
    request: [
      { type: "param", name: "groupId", schema: Type.String() },
      { type: "body", schema: upsertGroupSchema },
    ],
    response: baseResponse(baseGroupSchema),
  })
  async updateGroup(
    @Param("groupId") groupId: UUIDType,
    @Body() updateGroupBody: UpsertGroupBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<GroupResponse>> {
    const updatedGroup = await this.groupService.updateGroup(groupId, updateGroupBody, currentUser);

    return new BaseResponse(updatedGroup);
  }

  @Delete(":groupId")
  @RequirePermission(PERMISSIONS.GROUP_MANAGE)
  @Validate({
    request: [{ type: "param", name: "groupId", schema: Type.String() }],
    response: baseResponse(Type.Object({ message: Type.String() })),
  })
  async deleteGroup(
    @Param("groupId") groupId: UUIDType,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<{ message: string }>> {
    await this.groupService.deleteGroup(groupId, currentUser);

    return new BaseResponse({
      message: "Group deleted successfully",
    });
  }

  @Delete("")
  @RequirePermission(PERMISSIONS.GROUP_MANAGE)
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

  @Post("set")
  @RequirePermission(PERMISSIONS.GROUP_MANAGE)
  @Validate({
    request: [
      { type: "query", name: "userId", schema: UUIDSchema },
      { type: "body", name: "groupIds", schema: Type.Array(UUIDSchema) },
    ],
    response: baseResponse(Type.Object({ message: Type.String() })),
  })
  async setUserGroups(
    @Query("userId") userId: UUIDType,
    @Body() groupIds: UUIDType[],
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<{ message: string }>> {
    await this.groupService.setUserGroups(groupIds, userId, { actor: currentUser });

    return new BaseResponse({ message: "User assigned successfully" });
  }

  @Get("by-course/:courseId")
  @RequirePermission(PERMISSIONS.GROUP_READ)
  @Validate({
    request: [
      {
        type: "param",
        name: "courseId",
        schema: UUIDSchema,
      },
    ],
    response: baseResponse(Type.Array(baseGroupSchema)),
  })
  async getGroupsByCourse(
    @Param("courseId") courseId: UUIDType,
  ): Promise<
    BaseResponse<Array<{ id: string; name: string; createdAt: string; updatedAt: string }>>
  > {
    const groups = await this.groupService.getGroupsByCourse(courseId);

    return new BaseResponse(groups);
  }
}
