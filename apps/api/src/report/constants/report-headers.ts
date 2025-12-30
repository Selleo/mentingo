import type { SupportedLanguages } from "@repo/shared";

export interface ReportHeaders {
  studentName: string;
  groupName: string;
  courseName: string;
  lessonCount: string;
  completedLessons: string;
  progressPercentage: string;
  quizResults: string;
}

export const REPORT_HEADERS: Record<SupportedLanguages, ReportHeaders> = {
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
