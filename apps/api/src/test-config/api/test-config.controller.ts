import { Body, Controller, Post } from "@nestjs/common";
import { PERMISSIONS, SUPPORTED_LANGUAGES } from "@repo/shared";
import { Type } from "@sinclair/typebox";
import { Validate } from "nestjs-typebox";

import { UUIDSchema } from "src/common";
import { Public } from "src/common/decorators/public.decorator";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { OnlyStaging } from "src/common/decorators/staging.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { CurrentUserType } from "src/common/types/current-user.type";
import { supportedLanguagesSchema } from "src/courses/schemas/course.schema";

import { TestConfigService } from "../test-config.service";

import type { Static } from "@sinclair/typebox";

const prepareAiMentorStatisticsProgressSchema = Type.Object({
  lessonId: UUIDSchema,
  studentId: UUIDSchema,
  language: Type.Optional(supportedLanguagesSchema),
});
type PrepareAiMentorStatisticsProgressBody = Static<typeof prepareAiMentorStatisticsProgressSchema>;

@Controller("test-config")
export class TestConfigController {
  constructor(private testConfigService: TestConfigService) {}

  @Public()
  @Post("setup")
  @OnlyStaging()
  async setup(): Promise<void> {
    return this.testConfigService.setup();
  }

  @Post("teardown")
  @OnlyStaging()
  async teardown(): Promise<void> {
    return this.testConfigService.teardown();
  }

  @Post("ai-mentor-statistics-progress")
  @RequirePermission(PERMISSIONS.COURSE_STATISTICS)
  @Validate({
    request: [{ type: "body", schema: prepareAiMentorStatisticsProgressSchema }],
  })
  async prepareAiMentorStatisticsProgress(
    @Body() body: PrepareAiMentorStatisticsProgressBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<void> {
    return this.testConfigService.prepareAiMentorStatisticsProgress({
      language: body.language ?? SUPPORTED_LANGUAGES.EN,
      lessonId: body.lessonId,
      studentId: body.studentId,
      actor: currentUser,
    });
  }
}
