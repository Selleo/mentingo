import type { LessonTypes, SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";

export type McpStudentLessonQuery = {
  courseId?: UUIDType;
  chapterId?: UUIDType;
  lessonId?: UUIDType;
  language: SupportedLanguages;
  query?: string;
  page?: number;
  pageSize?: number;
};

export type McpStudentChapterRow = {
  id: UUIDType;
  courseId: UUIDType;
  title: string;
  displayOrder: number | null;
  lessonCount: number;
};

export type McpStudentLessonRow = {
  id: UUIDType;
  title: string;
  type: LessonTypes;
  displayOrder: number | null;
  chapterId: UUIDType;
  chapterTitle: string;
  courseId: UUIDType;
  courseTitle: string;
  description: string | null;
};
