import type { SupportedLanguages } from "@repo/shared";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { UUIDType } from "src/common";

export type CourseTranslationType = {
  id: string;
  base: string;
  field: AnyPgColumn;
  idColumn: AnyPgColumn;
};

export type CreateChapterForCourseData = {
  courseId: UUIDType;
  authorId: UUIDType;
  title: string;
  displayOrder: number;
  language: SupportedLanguages;
  isFreemium?: boolean;
};
