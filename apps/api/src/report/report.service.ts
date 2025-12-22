import { Injectable } from "@nestjs/common";
import ExcelJS from "exceljs";

import { ReportRepository } from "./repositories/report.repository";

import type { SupportedLanguages } from "@repo/shared";

interface ReportHeaders {
  studentName: string;
  groupName: string;
  courseName: string;
  lessonCount: string;
  completedLessons: string;
  progressPercentage: string;
  quizResults: string;
}

const HEADERS: Record<SupportedLanguages, ReportHeaders> = {
  en: {
    studentName: "Name",
    groupName: "Company (Group)",
    courseName: "Course Name",
    lessonCount: "Lesson Count",
    completedLessons: "Completed Lessons",
    progressPercentage: "Progress (%)",
    quizResults: "Quiz Results (%)",
  },
  pl: {
    studentName: "Imię i nazwisko",
    groupName: "Firma (grupa)",
    courseName: "Nazwa kursu",
    lessonCount: "Liczba lekcji",
    completedLessons: "Ukończone lekcje",
    progressPercentage: "Progres (%)",
    quizResults: "Ostatnie wyniki z quizów (%)",
  },
};

@Injectable()
export class ReportService {
  constructor(private readonly reportRepository: ReportRepository) {}

  async generateSummaryReport(language: SupportedLanguages): Promise<Buffer> {
    const data = await this.reportRepository.getAllStudentCourseData(language);
    const headers = HEADERS[language] || HEADERS.en;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Mentingo LMS";
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet("Summary Report");

    // Define columns with headers
    worksheet.columns = [
      { header: headers.studentName, key: "studentName", width: 25 },
      { header: headers.groupName, key: "groupName", width: 20 },
      { header: headers.courseName, key: "courseName", width: 35 },
      { header: headers.lessonCount, key: "lessonCount", width: 15 },
      { header: headers.completedLessons, key: "completedLessons", width: 18 },
      { header: headers.progressPercentage, key: "progressPercentage", width: 12 },
      { header: headers.quizResults, key: "quizResults", width: 40 },
    ];

    // Style header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE2E8F0" },
    };
    headerRow.alignment = { vertical: "middle", horizontal: "center" };

    // Add data rows
    data.forEach((row) => {
      worksheet.addRow({
        studentName: row.studentName,
        groupName: row.groupName || "-",
        courseName: row.courseName,
        lessonCount: row.lessonCount,
        completedLessons: row.completedLessons,
        progressPercentage: `${row.progressPercentage}%`,
        quizResults: row.quizResults,
      });
    });

    // Auto-filter for all columns
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: data.length + 1, column: 7 },
    };

    // Freeze header row
    worksheet.views = [{ state: "frozen", ySplit: 1 }];

    const buffer = await workbook.xlsx.writeBuffer();

    return Buffer.from(buffer);
  }
}
