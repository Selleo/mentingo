import { Body, Controller, Get, NotFoundException, Param, Post, UseGuards } from "@nestjs/common";
import { PERMISSIONS } from "@repo/shared";
import { Type } from "@sinclair/typebox";
import { Validate } from "nestjs-typebox";

import { BaseResponse, baseResponse, UUIDSchema, type UUIDType } from "src/common";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { ManagingTenantAdminGuard } from "src/common/guards/managing-tenant-admin.guard";
import { CurrentUserType } from "src/common/types/current-user.type";

import { LEARNING_PATH_ERRORS } from "../constants/learning-path.errors";
import {
  learningPathExportBodySchema,
  learningPathExportCandidatesResponseSchema,
  learningPathExportLinkSchema,
  learningPathExportResponseSchema,
  learningPathJobStatusSchema,
  type LearningPathExportBody,
} from "../learning-path.schema";
import { LearningPathExportService } from "../services/learning-path-export.service";

@Controller("learning-path/master")
@UseGuards(ManagingTenantAdminGuard)
export class LearningPathExportController {
  constructor(private readonly learningPathExportService: LearningPathExportService) {}

  @Post(":learningPathId/export")
  @RequirePermission(PERMISSIONS.LEARNING_PATH_MANAGE)
  @Validate({
    request: [
      { type: "param", name: "learningPathId", schema: UUIDSchema, required: true },
      { type: "body", schema: learningPathExportBodySchema, required: true },
    ],
    response: baseResponse(learningPathExportResponseSchema),
  })
  async exportLearningPath(
    @Param("learningPathId") learningPathId: UUIDType,
    @Body() body: LearningPathExportBody,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return new BaseResponse(
      await this.learningPathExportService.exportLearningPathToTenants(
        learningPathId,
        body.targetTenantIds,
        actor,
      ),
    );
  }

  @Get(":learningPathId/exports")
  @RequirePermission(PERMISSIONS.LEARNING_PATH_MANAGE)
  @Validate({
    request: [{ type: "param", name: "learningPathId", schema: UUIDSchema, required: true }],
    response: baseResponse(Type.Array(learningPathExportLinkSchema)),
  })
  async getLearningPathExports(
    @Param("learningPathId") learningPathId: UUIDType,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return new BaseResponse(
      await this.learningPathExportService.getLearningPathExports(learningPathId, actor),
    );
  }

  @Get(":learningPathId/export-candidates")
  @RequirePermission(PERMISSIONS.LEARNING_PATH_MANAGE)
  @Validate({
    request: [{ type: "param", name: "learningPathId", schema: UUIDSchema, required: true }],
    response: baseResponse(learningPathExportCandidatesResponseSchema),
  })
  async getLearningPathExportCandidates(
    @Param("learningPathId") learningPathId: UUIDType,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return new BaseResponse(
      await this.learningPathExportService.getLearningPathExportCandidates(learningPathId, actor),
    );
  }

  @Get("export-jobs/:jobId")
  @RequirePermission(PERMISSIONS.LEARNING_PATH_MANAGE)
  @Validate({
    request: [{ type: "param", name: "jobId", schema: Type.String(), required: true }],
    response: baseResponse(learningPathJobStatusSchema),
  })
  async getLearningPathJobStatus(@Param("jobId") jobId: string) {
    const status = await this.learningPathExportService.getJobStatus(jobId);
    if (!status) throw new NotFoundException(LEARNING_PATH_ERRORS.EXPORT_JOB_NOT_FOUND);
    return new BaseResponse(status);
  }
}
