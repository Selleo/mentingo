import { pipeline } from "node:stream/promises";

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import { PERMISSIONS, SupportedLanguages } from "@repo/shared";
import { Type } from "@sinclair/typebox";
import { Response } from "express";
import { Validate } from "nestjs-typebox";

import { BaseResponse, baseResponse, UUIDSchema } from "src/common";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { PermissionsGuard } from "src/common/guards/permissions.guard";
import { CurrentUserType } from "src/common/types/current-user.type";
import { supportedLanguagesSchema } from "src/courses/schemas/course.schema";

import { ReportService } from "./report.service";
import { ReportsConfigurationsService } from "./reports-configurations.service";
import { ReportsExportsService } from "./reports-exports.service";
import { ReportsQueryService } from "./reports-query.service";
import {
  createReportConfigurationSchema,
  updateReportConfigurationSchema,
  reportConfigurationSchema,
  reportConfigurationsListSchema,
  type CreateReportConfiguration,
  type UpdateReportConfiguration,
  type ReportConfigurationResponse,
  type ReportConfigurationsListResponse,
} from "./schemas/reports-configurations.schema";
import {
  createReportExportSchema,
  reportExportSchema,
  type CreateReportExport,
  type ReportExportResponse,
} from "./schemas/reports-exports.schema";
import {
  reportsQuerySchema,
  reportsResultSchema,
  reportOptionsSchema,
  type ReportsQuery,
  type ReportsResult,
  type ReportOptions,
} from "./schemas/reports.schema";

@UseGuards(PermissionsGuard)
@Controller("report")
export class ReportController {
  constructor(
    private readonly reportService: ReportService,
    private readonly reportsQueryService: ReportsQueryService,
    private readonly reportsConfigurationsService: ReportsConfigurationsService,
    private readonly reportsExportsService: ReportsExportsService,
  ) {}

  @Post("query")
  @RequirePermission(PERMISSIONS.REPORT_READ, PERMISSIONS.MANAGED_GROUP_RESULTS_READ)
  @Validate({
    request: [{ type: "body", schema: reportsQuerySchema }],
    response: baseResponse(reportsResultSchema),
  })
  async runReport(
    @Body() query: ReportsQuery,
    @CurrentUser() actor: CurrentUserType,
  ): Promise<BaseResponse<ReportsResult>> {
    return new BaseResponse(await this.reportsQueryService.getReport(query, actor));
  }

  @Get("options")
  @RequirePermission(PERMISSIONS.REPORT_READ, PERMISSIONS.MANAGED_GROUP_RESULTS_READ)
  @Validate({
    request: [
      { type: "query", name: "language", schema: supportedLanguagesSchema },
      { type: "query", name: "search", schema: Type.Optional(Type.String({ maxLength: 200 })) },
    ],
    response: baseResponse(reportOptionsSchema),
  })
  async getReportOptions(
    @Query("language") language: SupportedLanguages,
    @Query("search") search: string | undefined,
    @CurrentUser() actor: CurrentUserType,
  ): Promise<BaseResponse<ReportOptions>> {
    return new BaseResponse(
      await this.reportsQueryService.getReportOptions(actor, language, search),
    );
  }

  @Get("configurations")
  @RequirePermission(PERMISSIONS.REPORT_READ, PERMISSIONS.MANAGED_GROUP_RESULTS_READ)
  @Validate({ response: baseResponse(reportConfigurationsListSchema) })
  async listReportConfigurations(
    @CurrentUser() actor: CurrentUserType,
  ): Promise<BaseResponse<ReportConfigurationsListResponse>> {
    return new BaseResponse(await this.reportsConfigurationsService.listConfigurations(actor));
  }

  @Post("configurations")
  @RequirePermission(PERMISSIONS.REPORT_READ, PERMISSIONS.MANAGED_GROUP_RESULTS_READ)
  @Validate({
    request: [{ type: "body", schema: createReportConfigurationSchema }],
    response: baseResponse(reportConfigurationSchema),
  })
  async createReportConfiguration(
    @Body() input: CreateReportConfiguration,
    @CurrentUser() actor: CurrentUserType,
  ): Promise<BaseResponse<ReportConfigurationResponse>> {
    return new BaseResponse(
      await this.reportsConfigurationsService.createConfiguration(input, actor),
    );
  }

  @Patch("configurations/:id")
  @RequirePermission(PERMISSIONS.REPORT_READ, PERMISSIONS.MANAGED_GROUP_RESULTS_READ)
  @Validate({
    request: [
      { type: "param", name: "id", schema: UUIDSchema },
      { type: "body", schema: updateReportConfigurationSchema },
    ],
    response: baseResponse(reportConfigurationSchema),
  })
  async updateReportConfiguration(
    @Param("id") id: string,
    @Body() input: UpdateReportConfiguration,
    @CurrentUser() actor: CurrentUserType,
  ): Promise<BaseResponse<ReportConfigurationResponse>> {
    return new BaseResponse(
      await this.reportsConfigurationsService.updateConfiguration(id, input, actor),
    );
  }

  @Delete("configurations/:id")
  @RequirePermission(PERMISSIONS.REPORT_READ, PERMISSIONS.MANAGED_GROUP_RESULTS_READ)
  @Validate({ request: [{ type: "param", name: "id", schema: UUIDSchema }] })
  async deleteReportConfiguration(
    @Param("id") id: string,
    @CurrentUser() actor: CurrentUserType,
  ): Promise<void> {
    await this.reportsConfigurationsService.deleteConfiguration(id, actor);
  }

  @Post("exports")
  @RequirePermission(PERMISSIONS.REPORT_READ, PERMISSIONS.MANAGED_GROUP_RESULTS_READ)
  @Validate({
    request: [{ type: "body", schema: createReportExportSchema }],
    response: baseResponse(reportExportSchema),
  })
  async createReportExport(
    @Body() input: CreateReportExport,
    @CurrentUser() actor: CurrentUserType,
  ): Promise<BaseResponse<ReportExportResponse>> {
    return new BaseResponse(await this.reportsExportsService.createExport(input, actor));
  }

  @Get("exports/:id")
  @RequirePermission(PERMISSIONS.REPORT_READ, PERMISSIONS.MANAGED_GROUP_RESULTS_READ)
  @Validate({
    request: [{ type: "param", name: "id", schema: UUIDSchema }],
    response: baseResponse(reportExportSchema),
  })
  async getReportExport(
    @Param("id") id: string,
    @CurrentUser() actor: CurrentUserType,
  ): Promise<BaseResponse<ReportExportResponse>> {
    return new BaseResponse(await this.reportsExportsService.getExportStatus(id, actor));
  }

  @Get("exports/:id/download")
  @RequirePermission(PERMISSIONS.REPORT_READ, PERMISSIONS.MANAGED_GROUP_RESULTS_READ)
  @Validate({ request: [{ type: "param", name: "id", schema: UUIDSchema }] })
  async downloadReportExport(
    @Param("id") id: string,
    @CurrentUser() actor: CurrentUserType,
    @Res() res: Response,
  ): Promise<void> {
    const file = await this.reportsExportsService.downloadExport(id, actor);
    res.setHeader("Content-Type", file.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${file.fileName}"`);
    res.setHeader("Cache-Control", "private, no-store");
    await pipeline(file.stream, res);
  }

  @Get("summary")
  @RequirePermission(PERMISSIONS.REPORT_READ, PERMISSIONS.MANAGED_GROUP_RESULTS_READ)
  @Validate({
    request: [
      { type: "query", name: "language", schema: supportedLanguagesSchema },
      { type: "query", name: "courseId", schema: Type.Optional(UUIDSchema) },
    ],
  })
  async downloadSummaryReport(
    @Query("language") language: SupportedLanguages,
    @Query("courseId") courseId: string | undefined,
    @Res() res: Response,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<void> {
    const buffer = await this.reportService.generateSummaryReport(language, currentUser, courseId);

    const filename = `summary-report-${new Date().toISOString().split("T")[0]}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", buffer.length);

    res.send(buffer);
  }
}
