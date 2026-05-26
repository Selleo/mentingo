import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { PERMISSIONS, type SupportedLanguages } from "@repo/shared";
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
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { CurrentUserType } from "src/common/types/current-user.type";
import {
  allGroupsSchema,
  baseGroupSchema,
  bulkDeleteGroupsSchema,
  createGroupSchema,
  groupBaseLanguageUpdateSchema,
  groupLanguageSchema,
  groupSchema,
  updateGroupSchema,
} from "src/group/group.schema";
import { GroupService } from "src/group/group.service";
import {
  CreateGroupBody,
  GroupSortFieldsOptions,
  GroupBaseLanguageUpdateBody,
  UpdateGroupBody,
} from "src/group/group.types";

import type { GroupKeywordFilterBody } from "src/group/group.schema";
import type { AllGroupsResponse, GroupResponse } from "src/group/group.types";
import type { GroupsByCourseResponse } from "src/group/types/groups-by-course-response.type";

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
      { type: "query", name: "language", schema: Type.Optional(groupLanguageSchema) },
    ],
    response: paginatedResponse(allGroupsSchema),
  })
  async getAllGroups(
    @Query("keyword") keyword: string,
    @Query("page") page: number,
    @Query("perPage") perPage: number,
    @Query("sort") sort: GroupSortFieldsOptions,
    @Query("language") language: SupportedLanguages | undefined,
  ): Promise<PaginatedResponse<AllGroupsResponse>> {
    const filters: GroupKeywordFilterBody = {
      keyword,
    };
    const query = { filters, language, page, perPage, sort };

    const groups = await this.groupService.getAllGroups(query);

    return new PaginatedResponse(groups);
  }

  @Get(":groupId")
  @RequirePermission(PERMISSIONS.GROUP_READ)
  @Validate({
    request: [
      { type: "param", name: "groupId", schema: UUIDSchema },
      { type: "query", name: "language", schema: Type.Optional(groupLanguageSchema) },
    ],
    response: baseResponse(groupSchema),
  })
  async getGroupById(
    @Param("groupId") groupId: UUIDType,
    @Query("language") language: SupportedLanguages | undefined,
  ): Promise<BaseResponse<GroupResponse>> {
    const group = await this.groupService.getGroupById(groupId, language);

    return new BaseResponse(group);
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
      { type: "query", name: "language", schema: Type.Optional(groupLanguageSchema) },
    ],
    response: paginatedResponse(allGroupsSchema),
  })
  async getUserGroups(
    @Param("userId") userId: UUIDType,
    @Query("keyword") keyword: string,
    @Query("page") page: number,
    @Query("perPage") perPage: number,
    @Query("sort") sort: GroupSortFieldsOptions,
    @Query("language") language: SupportedLanguages | undefined,
  ): Promise<PaginatedResponse<AllGroupsResponse>> {
    const filters: GroupKeywordFilterBody = {
      keyword,
    };
    const query = { filters, language, page, perPage, sort };

    const groups = await this.groupService.getUserGroups(query, userId);

    return new PaginatedResponse(groups);
  }

  @Post()
  @RequirePermission(PERMISSIONS.GROUP_MANAGE)
  @Validate({
    request: [{ type: "body", schema: createGroupSchema }],
    response: baseResponse(Type.Object({ id: UUIDSchema, message: Type.String() })),
  })
  async createGroup(
    @Body() createGroupBody: CreateGroupBody,
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
      { type: "body", schema: updateGroupSchema },
    ],
    response: baseResponse(baseGroupSchema),
  })
  async updateGroup(
    @Param("groupId") groupId: UUIDType,
    @Body() updateGroupBody: UpdateGroupBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<GroupResponse>> {
    const updatedGroup = await this.groupService.updateGroup(groupId, updateGroupBody, currentUser);

    return new BaseResponse(updatedGroup);
  }

  @Post(":groupId/language")
  @RequirePermission(PERMISSIONS.GROUP_MANAGE)
  @Validate({
    response: baseResponse(groupSchema),
    request: [
      { type: "param", name: "groupId", schema: UUIDSchema },
      { type: "query", name: "language", schema: groupLanguageSchema },
    ],
  })
  async createLanguage(
    @Param("groupId") groupId: UUIDType,
    @Query("language") language: SupportedLanguages,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<GroupResponse>> {
    const group = await this.groupService.createLanguage(groupId, language, currentUser);

    return new BaseResponse(group);
  }

  @Delete(":groupId/language")
  @RequirePermission(PERMISSIONS.GROUP_MANAGE)
  @Validate({
    response: baseResponse(groupSchema),
    request: [
      { type: "param", name: "groupId", schema: UUIDSchema },
      { type: "query", name: "language", schema: groupLanguageSchema },
    ],
  })
  async deleteLanguage(
    @Param("groupId") groupId: UUIDType,
    @Query("language") language: SupportedLanguages,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<GroupResponse>> {
    const group = await this.groupService.deleteLanguage(groupId, language, currentUser);

    return new BaseResponse(group);
  }

  @Patch(":groupId/base-language")
  @RequirePermission(PERMISSIONS.GROUP_MANAGE)
  @Validate({
    response: baseResponse(groupSchema),
    request: [
      { type: "param", name: "groupId", schema: UUIDSchema },
      { type: "body", schema: groupBaseLanguageUpdateSchema },
    ],
  })
  async updateBaseLanguage(
    @Param("groupId") groupId: UUIDType,
    @Body() body: GroupBaseLanguageUpdateBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<GroupResponse>> {
    const group = await this.groupService.updateBaseLanguage(groupId, body, currentUser);

    return new BaseResponse(group);
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
      { type: "query", name: "language", schema: Type.Optional(groupLanguageSchema) },
    ],
    response: baseResponse(Type.Array(baseGroupSchema)),
  })
  async getGroupsByCourse(
    @Param("courseId") courseId: UUIDType,
    @Query("language") language: SupportedLanguages | undefined,
  ): Promise<BaseResponse<GroupsByCourseResponse>> {
    const groups = await this.groupService.getGroupsByCourse(courseId, language);

    return new BaseResponse(groups);
  }
}
