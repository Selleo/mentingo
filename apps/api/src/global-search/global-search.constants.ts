import { ENTITY_TYPES } from "@repo/shared";

export const GLOBAL_SEARCH_MIN_QUERY_LENGTH = 3;

export const SEARCH_ENTITY_TYPES = {
  COURSE: ENTITY_TYPES.COURSE,
  LESSON: ENTITY_TYPES.LESSON,
  LEARNING_PATH: ENTITY_TYPES.LEARNING_PATH,
  NEWS: ENTITY_TYPES.NEWS,
  ARTICLE: ENTITY_TYPES.ARTICLES,
  QA: ENTITY_TYPES.QA,
} as const;

export const SEARCH_DOCUMENT_TYPES = {
  TITLE: "title",
  DESCRIPTION: "description",
  SUMMARY: "summary",
  CONTENT: "content",
  QUESTION_TITLE: "question_title",
  QUESTION_DESCRIPTION: "question_description",
  QUESTION_SOLUTION_EXPLANATION: "question_solution_explanation",
  ANSWER_OPTION: "answer_option",
  RESOURCE: "resource",
} as const;

export const SEARCH_DOCUMENT_WEIGHTS = {
  A: "A",
  B: "B",
  C: "C",
  D: "D",
} as const;

export function getSearchLanguageConfig(_language: string) {
  return "simple";
}
