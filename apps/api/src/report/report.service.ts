import { Injectable } from "@nestjs/common";
import writeXlsxFile from "write-excel-file/node";

import { REPORT_HEADERS } from "./constants/report-headers";
import { ReportRepository } from "./repositories/report.repository";

import type { StudentCourseReportRow } from "./repositories/report.repository";
import type { SupportedLanguages } from "@repo/shared";
import type { Schema } from "write-excel-file";

@Injectable()
export class ReportService {
  constructor(private readonly reportRepository: ReportRepository) {}

  async generateSummaryReport(language: SupportedLanguages): Promise<Buffer> {
    const data = await this.reportRepository.getAllStudentCourseData(language);
    const headers = REPORT_HEADERS[language] || REPORT_HEADERS.en;

    const schema: Schema<StudentCourseReportRow> = [
      {
        column: headers.studentName,
        type: String,
        value: (row) => row.studentName,
        width: 25,
        fontWeight: "bold",
        height: 20,
      },
      {
        column: headers.groupName,
        type: String,
        value: (row) => row.groupName || "-",
        width: 20,
        height: 20,
      },
      {
        column: headers.courseName,
        type: String,
        value: (row) => row.courseName,
        width: 35,
        height: 20,
      },
      {
        column: headers.lessonCount,
        type: Number,
        value: (row) => row.lessonCount,
        width: 15,
        height: 20,
      },
      {
        column: headers.completedLessons,
        type: Number,
        value: (row) => row.completedLessons,
        width: 18,
        height: 20,
      },
      {
        column: headers.progressPercentage,
        type: String,
        value: (row) => `${row.progressPercentage}%`,
        width: 12,
        height: 20,
      },
      {
        column: headers.quizResults,
        type: String,
        value: (row) => row.quizResults,
        width: 40,
        height: 20,
      },
    ];

    const buffer = await writeXlsxFile(data, {
      schema,
      sheet: "Summary Report",
      stickyRowsCount: 1,
      buffer: true,
      fontFamily: "Calibri",
      fontSize: 11,
      getHeaderStyle: () => ({
        fontWeight: "bold",
        height: 25,
        backgroundColor: "#E2E8F0",
      }),
    });

    return Buffer.from(buffer);
  }
}
