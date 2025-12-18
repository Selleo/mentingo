import type {
  courses,
  questionsAndAnswers,
  news,
  articles,
  articleSections,
} from "src/storage/schema";

export const ENTITY_TYPE = {
  COURSE: "course",
  CHAPTER: "chapter",
  LESSON: "lesson",
  QUESTION: "question",
  QA: "qa",
  NEWS: "news",
  ARTICLES: "articles",
} as const;

export type EntityType = (typeof ENTITY_TYPE)[keyof typeof ENTITY_TYPE];

export type EntityField = "title" | "description";

export const ENTITY_FIELD = {
  TITLE: "title",
  DESCRIPTION: "description",
} as const;

export type BaseTable =
  | typeof courses
  | typeof questionsAndAnswers
  | typeof articles
  | typeof news
  | typeof articleSections;
