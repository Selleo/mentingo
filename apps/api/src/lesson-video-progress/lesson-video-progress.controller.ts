import { Body, Controller, Post } from "@nestjs/common";
import { PERMISSIONS } from "@repo/shared";
import { Validate } from "nestjs-typebox";

import { baseResponse, BaseResponse } from "src/common";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { CurrentUserType } from "src/common/types/current-user.type";

import { LessonVideoProgressService } from "./lesson-video-progress.service";
import {
  lessonVideoProgressResponseSchema,
  upsertLessonVideoProgressSchema,
  type LessonVideoProgressResponse,
  type UpsertLessonVideoProgress,
} from "./schemas/lesson-video-progress.schema";
@Controller("lesson-video-progress")
export class LessonVideoProgressController {
  constructor(private readonly lessonVideoProgressService: LessonVideoProgressService) {}

  @Post()
  @RequirePermission(PERMISSIONS.LEARNING_PROGRESS_UPDATE, PERMISSIONS.LEARNING_MODE_USE)
  @Validate({
    request: [{ type: "body", schema: upsertLessonVideoProgressSchema }],
    response: baseResponse(lessonVideoProgressResponseSchema),
  })
  async upsertProgress(
    @Body() body: UpsertLessonVideoProgress,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<LessonVideoProgressResponse>> {
    const progress = await this.lessonVideoProgressService.upsertProgress(body, currentUser);

    return new BaseResponse(progress);
  }
}
