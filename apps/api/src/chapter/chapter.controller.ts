import { Body, Controller, Delete, Get, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { SupportedLanguages } from "@repo/shared";
import { Type } from "@sinclair/typebox";
import { Validate } from "nestjs-typebox";

import { baseResponse, BaseResponse, UUIDSchema, type UUIDType } from "src/common";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { CurrentUser as CurrentUserType } from "src/common/types/current-user.type";
import { supportedLanguagesSchema } from "src/courses/schemas/course.schema";
import { isTenantManager } from "src/permission/permission-access";
import { PERMISSIONS } from "src/permission/permission.constants";
import { RequirePermission } from "src/permission/permission.decorator";
import { PermissionsGuard } from "src/permission/permission.guard";

import { AdminChapterService } from "./adminChapter.service";
import { ChapterService } from "./chapter.service";
import {
  CreateChapterBody,
  createChapterSchema,
  showChapterSchema,
  UpdateChapterBody,
  updateChapterSchema,
} from "./schemas/chapter.schema";

import type { ChapterResponse } from "./schemas/chapter.schema";
import type { PermissionKey } from "src/permission/permission.constants";

@UseGuards(PermissionsGuard)
@Controller("chapter")
export class ChapterController {
  constructor(
    private readonly chapterService: ChapterService,
    private readonly adminChapterService: AdminChapterService,
  ) {}

  @Get()
  @RequirePermission(PERMISSIONS.COURSE_READ)
  @Validate({
    request: [
      { type: "query", name: "id", schema: UUIDSchema, required: true },
      { type: "query", name: "language", schema: supportedLanguagesSchema },
    ],
    response: baseResponse(showChapterSchema),
  })
  async getChapterWithLesson(
    @Query("id") id: UUIDType,
    @Query("language") language: SupportedLanguages,
    @CurrentUser("permissions") userPermissions: PermissionKey[] | undefined,
    @CurrentUser("userId") userId: UUIDType,
  ): Promise<BaseResponse<ChapterResponse>> {
    return new BaseResponse(
      await this.chapterService.getChapterWithLessons(
        id,
        userId,
        language,
        isTenantManager(userPermissions),
      ),
    );
  }

  @Post("beta-create-chapter")
  @RequirePermission(PERMISSIONS.COURSE_UPDATE)
  @Validate({
    request: [
      {
        type: "body",
        schema: createChapterSchema,
      },
    ],
    response: baseResponse(Type.Object({ id: UUIDSchema, message: Type.String() })),
  })
  async betaCreateChapter(
    @Body() createChapterBody: CreateChapterBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<{ id: UUIDType; message: string }>> {
    const { id } = await this.adminChapterService.createChapterForCourse(
      createChapterBody,
      currentUser,
    );

    return new BaseResponse({ id, message: "Chapter created successfully" });
  }

  @Patch()
  @RequirePermission(PERMISSIONS.COURSE_UPDATE)
  @Validate({
    request: [
      {
        type: "query",
        name: "id",
        schema: UUIDSchema,
      },
      {
        type: "body",
        schema: updateChapterSchema,
      },
    ],
    response: baseResponse(Type.Object({ message: Type.String() })),
  })
  async updateChapter(
    @Query("id") id: UUIDType,
    @Body() updateChapterBody: UpdateChapterBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<{ message: string }>> {
    await this.adminChapterService.updateChapter(id, updateChapterBody, currentUser);

    return new BaseResponse({ message: "Chapter updated successfully" });
  }

  @Patch("chapter-display-order")
  @RequirePermission(PERMISSIONS.COURSE_UPDATE)
  @Validate({
    request: [
      {
        type: "body",
        schema: Type.Object({
          chapterId: UUIDSchema,
          displayOrder: Type.Number(),
        }),
        required: true,
      },
    ],
    response: baseResponse(Type.Object({ message: Type.String() })),
  })
  async updateChapterDisplayOrder(
    @Body()
    body: {
      chapterId: UUIDType;
      displayOrder: number;
    },
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<{ message: string }>> {
    await this.adminChapterService.updateChapterDisplayOrder({
      ...body,
      currentUser,
    });

    return new BaseResponse({
      message: "Chapter display order updated successfully",
    });
  }

  @Delete()
  @RequirePermission(PERMISSIONS.COURSE_UPDATE)
  @Validate({
    request: [{ type: "query", name: "chapterId", schema: UUIDSchema, required: true }],
    response: baseResponse(Type.Object({ message: Type.String() })),
  })
  async removeChapter(
    @Query("chapterId") chapterId: UUIDType,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<{ message: string }>> {
    await this.adminChapterService.removeChapter(chapterId, currentUser);
    return new BaseResponse({
      message: "Lesson removed from course successfully",
    });
  }

  @Patch("freemium-status")
  @RequirePermission(PERMISSIONS.COURSE_UPDATE)
  @Validate({
    request: [
      {
        type: "query",
        name: "chapterId",
        schema: UUIDSchema,
      },
      {
        type: "body",
        schema: Type.Object({
          isFreemium: Type.Boolean(),
        }),
      },
    ],
    response: baseResponse(Type.Object({ message: Type.String() })),
  })
  async updateFreemiumStatus(
    @Query("chapterId") chapterId: UUIDType,
    @Body() body: { isFreemium: boolean },
    @CurrentUser("userId") userId: UUIDType,
    @CurrentUser("permissions") userPermissions: PermissionKey[] | undefined,
  ): Promise<BaseResponse<{ message: string }>> {
    await this.adminChapterService.updateFreemiumStatus(
      chapterId,
      body.isFreemium,
      userId,
      userPermissions,
    );
    return new BaseResponse({
      message: "Course lesson free status updated successfully",
    });
  }
}
