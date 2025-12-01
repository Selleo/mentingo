export type EntityType = "course" | "chapter" | "lesson";

export const ENTITY_TYPE = {
  COURSE: "course",
  CHAPTER: "chapter",
  LESSON: "lesson",
  QUESTION: "question"
} as const;

export type EntityField = "title" | "description";

export const ENTITY_FIELD = {
  TITLE: "title",
  DESCRIPTION: "description",
} as const;
