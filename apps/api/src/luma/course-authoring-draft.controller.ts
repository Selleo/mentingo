/** Starts an owner-only authoring session before a course exists. */
import { Body, Controller, Post } from "@nestjs/common";
import { PERMISSIONS } from "@repo/shared";
import { Validate } from "nestjs-typebox";

import { BaseResponse } from "src/common";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { CurrentUserType } from "src/common/types/current-user.type";

import { CourseAuthoringSessionService } from "./course-authoring-session.service";
import {
  authoringSessionResponseSchema,
  createAuthoringSessionSchema,
  CreateAuthoringSessionBody,
} from "./schema/course-authoring-session.schema";

import type { AuthoringSession } from "./schema/course-authoring-session.schema";

@Controller("luma/authoring/drafts")
export class CourseAuthoringDraftController {
  constructor(private readonly courseAuthoringSessionService: CourseAuthoringSessionService) {}

  @Post()
  @RequirePermission(PERMISSIONS.COURSE_AI_GENERATION)
  @Validate({
    request: [{ type: "body", schema: createAuthoringSessionSchema }],
    response: authoringSessionResponseSchema,
  })
  async openAuthoringDraft(
    @Body() input: CreateAuthoringSessionBody,
    @CurrentUser() actor: CurrentUserType,
  ): Promise<BaseResponse<AuthoringSession>> {
    return new BaseResponse(await this.courseAuthoringSessionService.openDraft(input, actor));
  }
}
