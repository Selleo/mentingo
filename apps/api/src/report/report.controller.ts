import { Controller, Get, Query, Res, UseGuards } from "@nestjs/common";
import { SupportedLanguages } from "@repo/shared";
import { Response } from "express";
import { Validate } from "nestjs-typebox";

import { Roles } from "src/common/decorators/roles.decorator";
import { RolesGuard } from "src/common/guards/roles.guard";
import { supportedLanguagesSchema } from "src/courses/schemas/course.schema";
import { USER_ROLES } from "src/user/schemas/userRoles";

import { ReportService } from "./report.service";

@UseGuards(RolesGuard)
@Controller("report")
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get("summary")
  @Roles(USER_ROLES.ADMIN)
  @Validate({
    request: [{ type: "query", name: "language", schema: supportedLanguagesSchema }],
  })
  async downloadSummaryReport(
    @Query("language") language: SupportedLanguages,
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.reportService.generateSummaryReport(language);

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
