/** Exposes public-page metadata for citation chips in the course-authoring workspace. */
import { Controller, Get, Query } from "@nestjs/common";
import { PERMISSIONS } from "@repo/shared";
import { Validate } from "nestjs-typebox";

import { BaseResponse } from "src/common";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";

import { CourseAuthoringLinkPreviewService } from "./course-authoring-link-preview.service";
import {
  authoringLinkPreviewQuerySchema,
  authoringLinkPreviewResponseSchema,
} from "./schema/course-authoring-link-preview.schema";

import type { AuthoringLinkPreview } from "./schema/course-authoring-link-preview.schema";

@Controller("luma/authoring")
export class CourseAuthoringLinkPreviewController {
  constructor(private readonly linkPreviewService: CourseAuthoringLinkPreviewService) {}

  @Get("link-preview")
  @RequirePermission(PERMISSIONS.COURSE_AI_GENERATION)
  @Validate({
    request: [
      { type: "query", name: "url", schema: authoringLinkPreviewQuerySchema, required: true },
    ],
    response: authoringLinkPreviewResponseSchema,
  })
  async getAuthoringLinkPreview(
    @Query("url") url: string,
  ): Promise<BaseResponse<AuthoringLinkPreview>> {
    return new BaseResponse(await this.linkPreviewService.preview(url));
  }
}
