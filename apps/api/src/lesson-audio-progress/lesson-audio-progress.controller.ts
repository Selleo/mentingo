import { Body, Controller, Post } from "@nestjs/common";
import { PERMISSIONS } from "@repo/shared";
import { Validate } from "nestjs-typebox";

import { baseResponse, BaseResponse } from "src/common";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { CurrentUserType } from "src/common/types/current-user.type";
import {
  COURSE_LEARNING_TARGET_FIELDS,
  COURSE_LEARNING_TARGET_SOURCES,
} from "src/course-repetition/course-learning-write.constants";
import { CourseLearningWrite } from "src/course-repetition/course-learning-write.interceptor";

import { LessonAudioProgressService } from "./lesson-audio-progress.service";
import {
  lessonAudioProgressResponseSchema,
  upsertLessonAudioProgressSchema,
  type LessonAudioProgressResponse,
  type UpsertLessonAudioProgress,
} from "./schemas/lesson-audio-progress.schema";

@Controller("lesson-audio-progress")
export class LessonAudioProgressController {
  constructor(private readonly lessonAudioProgressService: LessonAudioProgressService) {}

  @CourseLearningWrite({
    source: COURSE_LEARNING_TARGET_SOURCES.BODY,
    field: COURSE_LEARNING_TARGET_FIELDS.LESSON_ID,
  })
  @Post()
  @RequirePermission(PERMISSIONS.LEARNING_PROGRESS_UPDATE, PERMISSIONS.LEARNING_MODE_USE)
  @Validate({
    request: [{ type: "body", schema: upsertLessonAudioProgressSchema }],
    response: baseResponse(lessonAudioProgressResponseSchema),
  })
  async upsertLessonAudioProgress(
    @Body() body: UpsertLessonAudioProgress,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<LessonAudioProgressResponse>> {
    const progress = await this.lessonAudioProgressService.upsertProgress(body, currentUser);

    return new BaseResponse(progress);
  }
}
