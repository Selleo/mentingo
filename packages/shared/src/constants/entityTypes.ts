export const ENTITY_TYPES = {
  COURSE: "course",
  CHAPTER: "chapter",
  LESSON: "lesson",
  QUESTION: "question",
  NEWS: "news",
  ARTICLES: "articles",
  LEARNING_PATH: "learning_path",
  QA: "qa",
  USER: "user",
  CATEGORY: "category",
  ANNOUNCEMENT: "announcement",
  GLOBAL_SETTINGS: "global_settings",
  LIVE_TRAINING: "live_training",
} as const;

export type EntityType = (typeof ENTITY_TYPES)[keyof typeof ENTITY_TYPES];
