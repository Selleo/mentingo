import { Controller, Post, Query } from "@nestjs/common";
import { PERMISSIONS, SupportedLanguages } from "@repo/shared";
import { Type } from "@sinclair/typebox";
import { Validate } from "nestjs-typebox";

import { baseResponse, BaseResponse, UUIDSchema, UUIDType } from "src/common";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { CurrentUserType } from "src/common/types/current-user.type";
import { supportedLanguagesSchema } from "src/courses/schemas/course.schema";
import { gamificationAwardSchema } from "src/gamification/schemas/achievement.schema";

import { StudentLessonProgressService } from "./studentLessonProgress.service";

import type { AwardPointsResult } from "src/gamification/points.service";

@Controller("studentLessonProgress")
export class StudentLessonProgressController {
  constructor(private readonly studentLessonProgressService: StudentLessonProgressService) {}

  @Post()
  @RequirePermission(PERMISSIONS.LEARNING_PROGRESS_UPDATE, PERMISSIONS.LEARNING_MODE_USE)
  @Validate({
    request: [
      { type: "query", name: "id", schema: UUIDSchema, required: true },
      { type: "query", name: "language", schema: supportedLanguagesSchema },
    ],
    response: baseResponse(
      Type.Object({ message: Type.String(), gamification: gamificationAwardSchema }),
    ),
  })
  async markLessonAsCompleted(
    @Query("id") id: UUIDType,
    @Query("language") language: SupportedLanguages,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<{ message: string; gamification: AwardPointsResult }>> {
    const gamification = await this.studentLessonProgressService.markLessonAsCompleted({
      id,
      studentId: currentUser.userId,
      userPermissions: currentUser.permissions,
      language,
      actor: currentUser,
    });

    return new BaseResponse({ message: "Lesson marked as completed", gamification });
  }
}
