import type { SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";

export type GroupStudentEnrollment = {
  studentId: UUIDType;
  groupId: UUIDType;
};

export type GroupCourseEnrollmentValues = {
  groupId: UUIDType;
  courseId: UUIDType;
  enrolledBy: UUIDType | null;
  isMandatory: boolean;
  dueDate: Date | null;
  calendarEventId: UUIDType | null;
};

export type StudentChapterProgressValues = {
  studentId: UUIDType;
  learningStateId: UUIDType | null;
  chapterId: UUIDType;
  courseId: UUIDType;
  completedLessonItemCount: number;
};

export type StudentLessonProgressValues = {
  studentId: UUIDType;
  learningStateId: UUIDType | null;
  lessonId: UUIDType;
  chapterId: UUIDType;
  completedQuestionCount: number;
  quizScore: number | null;
  completedAt: null;
};

export type EnrolledStudentsFilters = {
  courseId: UUIDType;
  keyword?: string;
  groupIds?: UUIDType[];
  language?: SupportedLanguages;
};
