import { Controller, Post, Query, UseGuards } from "@nestjs/common";
import { SupportedLanguages } from "@repo/shared";
import { Type } from "@sinclair/typebox";
import { Validate } from "nestjs-typebox";

import { baseResponse, BaseResponse, UUIDSchema, UUIDType } from "src/common";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { supportedLanguagesSchema } from "src/courses/schemas/course.schema";
import { PERMISSIONS, type PermissionKey } from "src/permission/permission.constants";
import { RequirePermission } from "src/permission/permission.decorator";
import { PermissionsGuard } from "src/permission/permission.guard";

import { StudentLessonProgressService } from "./studentLessonProgress.service";

@UseGuards(PermissionsGuard)
@Controller("studentLessonProgress")
export class StudentLessonProgressController {
  constructor(private readonly studentLessonProgressService: StudentLessonProgressService) {}

  @Post()
  @RequirePermission(PERMISSIONS.LEARNING_PROGRESS_UPDATE)
  @Validate({
    request: [
      { type: "query", name: "id", schema: UUIDSchema, required: true },
      { type: "query", name: "language", schema: supportedLanguagesSchema },
    ],
    response: baseResponse(Type.Object({ message: Type.String() })),
  })
  async markLessonAsCompleted(
    @Query("id") id: UUIDType,
    @Query("language") language: SupportedLanguages,
    @CurrentUser("userId") currentUserId: UUIDType,
    @CurrentUser("permissions") userPermissions: PermissionKey[] | undefined,
  ): Promise<BaseResponse<{ message: string }>> {
    await this.studentLessonProgressService.markLessonAsCompleted({
      id,
      studentId: currentUserId,
      userPermissions,
      language,
    });

    return new BaseResponse({ message: "Lesson marked as completed" });
  }
}
