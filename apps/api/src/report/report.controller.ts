import { Controller, Get, Query, Res, UseGuards } from "@nestjs/common";
import { PERMISSIONS, SupportedLanguages } from "@repo/shared";
import { Response } from "express";
import { Validate } from "nestjs-typebox";

import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { PermissionsGuard } from "src/common/guards/permissions.guard";
import { CurrentUser as CurrentUserType } from "src/common/types/current-user.type";
import { supportedLanguagesSchema } from "src/courses/schemas/course.schema";

import { ReportService } from "./report.service";

@UseGuards(PermissionsGuard)
@Controller("report")
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get("summary")
  @RequirePermission(PERMISSIONS.REPORT_READ)
  @Validate({
    request: [{ type: "query", name: "language", schema: supportedLanguagesSchema }],
  })
  async downloadSummaryReport(
    @Query("language") language: SupportedLanguages,
    @Res() res: Response,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<void> {
    const buffer = await this.reportService.generateSummaryReport(language, currentUser);

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
