import { Controller, Get, Query, Res, UseGuards } from "@nestjs/common";
import { PERMISSIONS, SupportedLanguages } from "@repo/shared";
import { Type } from "@sinclair/typebox";
import { Response } from "express";
import { Validate } from "nestjs-typebox";

import { UUIDSchema } from "src/common";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { PermissionsGuard } from "src/common/guards/permissions.guard";
import { CurrentUserType } from "src/common/types/current-user.type";
import { supportedLanguagesSchema } from "src/courses/schemas/course.schema";

import { ReportService } from "./report.service";

@UseGuards(PermissionsGuard)
@Controller("report")
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

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
