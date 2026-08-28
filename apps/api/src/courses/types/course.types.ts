import type { SupportedLanguages } from "@repo/shared";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { UUIDType } from "src/common";

export type CourseAuthorMetadata = {
  authorId: UUIDType;
  firstName: string | null;
  lastName: string | null;
  jobTitle: string | null;
  description: string | null;
  profilePictureReference: string | null;
};

export type CourseTranslationType = {
  id: string;
  base: string;
  field: AnyPgColumn;
  idColumn: AnyPgColumn;
};

export type CourseTranslationContext = {
  courseTitle?: string;
  chapterTitle?: string;
  lessonTitle?: string;
  lessonDescription?: string;
  questionTitle?: string;
  questionDescription?: string;
  questionOptions?: string;
  optionText?: string;
  aiJudgeTaskGoal?: string;
  aiJudgeCriterionTitle?: string;
  aiJudgeExpectedBehavior?: string;
  aiJudgeScore?: string;
};

export type ContextualCourseTranslationType = {
  data: CourseTranslationType;
  metadata: string;
  context: CourseTranslationContext;
};

export type CreateChapterForCourseData = {
  courseId: UUIDType;
  authorId: UUIDType;
  title: string;
  displayOrder: number;
  language: SupportedLanguages;
  isFreemium?: boolean;
};
