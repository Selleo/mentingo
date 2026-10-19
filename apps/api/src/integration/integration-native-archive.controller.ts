import { Controller, Get, Param, Post, Res, UseGuards } from "@nestjs/common";
import {
  ApiForbiddenResponse,
  ApiHeader,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { PERMISSIONS } from "@repo/shared";
import { Type } from "@sinclair/typebox";
import { Response } from "express";
import { Validate } from "nestjs-typebox";

import { baseResponse, BaseResponse, UUIDSchema, type UUIDType } from "src/common";
import { API_HEADERS, ApiEndpointDocs } from "src/common/decorators/api-endpoint-docs.decorator";
import { Public } from "src/common/decorators/public.decorator";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { PermissionsGuard } from "src/common/guards/permissions.guard";
import { CurrentUserType } from "src/common/types/current-user.type";
import {
  nativeArchiveJobResponseSchema,
  nativeArchiveStatusResponseSchema,
} from "src/native-archive/schemas/native-archive.schema";
import { streamNativeArchiveDownload } from "src/native-archive/utils/native-archive-download.utils";

import { IntegrationKeyTenant } from "./decorators/integration-key-tenant.decorator";
import { IntegrationApiKeyGuard } from "./guards/integration-api-key.guard";
import { IntegrationKeyTenantContext } from "./integration.types";
import { IntegrationCourseExportService } from "./services/integration-course-export.service";

@ApiHeader({
  name: "X-API-Key",
  required: true,
  description: "Integration API key used to authenticate every integration request.",
})
@ApiTags("Integration")
@ApiUnauthorizedResponse({
  description: "Missing or invalid integration API key.",
})
@ApiForbiddenResponse({
  description: "Authenticated integration key owner is not authorized.",
})
@Public()
@Controller("integration")
@UseGuards(IntegrationApiKeyGuard, PermissionsGuard)
export class IntegrationNativeArchiveController {
  constructor(private readonly integrationCourseExportService: IntegrationCourseExportService) {}

  @Post("courses/:courseId/native-archive")
  @RequirePermission(PERMISSIONS.INTEGRATION_API_USE)
  @ApiEndpointDocs({
    summary: "Start a native archive export of a course",
    description:
      "Queues a native archive (mentingo-package zip) export of a course in the tenant selected by X-Tenant-Id and returns the job id. Poll GET /integration/native-archive/jobs/:jobId until the job completes, then download the archive.\n\nRequires a managing tenant key whose owner has the course export permission.",
    headers: [API_HEADERS.X_TENANT_ID],
  })
  @Validate({
    request: [{ type: "param", name: "courseId", schema: UUIDSchema, required: true }],
    response: baseResponse(nativeArchiveJobResponseSchema),
  })
  async startCourseArchiveExport(
    @Param("courseId") courseId: UUIDType,
    @CurrentUser() actor: CurrentUserType,
    @IntegrationKeyTenant() keyTenant: IntegrationKeyTenantContext,
  ) {
    return new BaseResponse(
      await this.integrationCourseExportService.startCourseArchiveExport(
        courseId,
        actor,
        keyTenant,
      ),
    );
  }

  @Get("native-archive/jobs/:jobId")
  @RequirePermission(PERMISSIONS.INTEGRATION_API_USE)
  @ApiEndpointDocs({
    summary: "Get a native archive export job",
    description:
      "Returns the state of a native archive export started with this integration key in the tenant selected by X-Tenant-Id. Finished archives can be downloaded for 24 hours.",
    headers: [API_HEADERS.X_TENANT_ID],
  })
  @Validate({
    request: [{ type: "param", name: "jobId", schema: Type.String(), required: true }],
    response: baseResponse(nativeArchiveStatusResponseSchema),
  })
  async getCourseArchiveExportStatus(
    @Param("jobId") jobId: string,
    @CurrentUser() actor: CurrentUserType,
    @IntegrationKeyTenant() keyTenant: IntegrationKeyTenantContext,
  ) {
    return new BaseResponse(
      await this.integrationCourseExportService.getCourseArchiveExportStatus(
        jobId,
        actor,
        keyTenant,
      ),
    );
  }

  @Get("native-archive/jobs/:jobId/download")
  @RequirePermission(PERMISSIONS.INTEGRATION_API_USE)
  @ApiEndpointDocs({
    summary: "Download a native archive",
    description:
      "Streams the zip of a completed native archive export started with this integration key in the tenant selected by X-Tenant-Id. The body is the archive itself, not a JSON envelope.",
    headers: [API_HEADERS.X_TENANT_ID],
  })
  @ApiProduces("application/zip")
  @Validate({
    request: [{ type: "param", name: "jobId", schema: Type.String(), required: true }],
  })
  async downloadCourseArchive(
    @Param("jobId") jobId: string,
    @CurrentUser() actor: CurrentUserType,
    @IntegrationKeyTenant() keyTenant: IntegrationKeyTenantContext,
    @Res() response: Response,
  ) {
    const file = await this.integrationCourseExportService.getCourseArchiveStream(
      jobId,
      actor,
      keyTenant,
    );

    streamNativeArchiveDownload(file, response);
  }
}
