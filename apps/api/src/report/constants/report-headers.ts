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
    groupName: "Groups",
    courseName: "Course Name",
    lessonCount: "Lesson Count",
    completedLessons: "Completed Lessons",
    progressPercentage: "Progress (%)",
    quizResults: "Latest Quiz Attempt Results (%)",
  },
  pl: {
    studentName: "Imię i nazwisko",
    groupName: "Grupy",
    courseName: "Nazwa kursu",
    lessonCount: "Liczba lekcji",
    completedLessons: "Ukończone lekcje",
    progressPercentage: "Progres (%)",
    quizResults: "Wyniki z ostatnich podejść do quizów",
  },
};
