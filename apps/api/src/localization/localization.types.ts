import type { courses, questionsAndAnswers, news } from "src/storage/schema";

export type EntityType = "course" | "chapter" | "lesson" | "qa" | "news";

export const ENTITY_TYPE = {
  COURSE: "course",
  CHAPTER: "chapter",
  LESSON: "lesson",
  QUESTION: "question",
  QA: "qa",
} as const;

export type EntityField = "title" | "description";

export const ENTITY_FIELD = {
  TITLE: "title",
  DESCRIPTION: "description",
} as const;

export type BaseTable = typeof courses | typeof questionsAndAnswers | typeof news;
