import { Controller, Post, Query } from "@nestjs/common";
import { PERMISSIONS, SupportedLanguages } from "@repo/shared";
import { Type } from "@sinclair/typebox";
import { Validate } from "nestjs-typebox";

import { baseResponse, BaseResponse, UUIDSchema, UUIDType } from "src/common";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { CurrentUserType } from "src/common/types/current-user.type";
import {
  COURSE_LEARNING_TARGET_FIELDS,
  COURSE_LEARNING_TARGET_SOURCES,
} from "src/course-repetition/course-learning-write.constants";
import { CourseLearningWrite } from "src/course-repetition/course-learning-write.interceptor";
import { supportedLanguagesSchema } from "src/courses/schemas/course.schema";

import { StudentLessonProgressService } from "./studentLessonProgress.service";

@Controller("studentLessonProgress")
export class StudentLessonProgressController {
  constructor(private readonly studentLessonProgressService: StudentLessonProgressService) {}

  @CourseLearningWrite({
    source: COURSE_LEARNING_TARGET_SOURCES.QUERY,
    field: COURSE_LEARNING_TARGET_FIELDS.ID,
  })
  @Post()
  @RequirePermission(PERMISSIONS.LEARNING_PROGRESS_UPDATE, PERMISSIONS.LEARNING_MODE_USE)
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
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<{ message: string }>> {
    await this.studentLessonProgressService.markLessonAsCompleted({
      id,
      studentId: currentUser.userId,
      userPermissions: currentUser.permissions,
      language,
      actor: currentUser,
    });

    return new BaseResponse({ message: "Lesson marked as completed" });
  }
}
