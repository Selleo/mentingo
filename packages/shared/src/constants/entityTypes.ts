export const ENTITY_TYPES = {
  COURSE: "course",
  CHAPTER: "chapter",
  LESSON: "lesson",
  QUESTION: "question",
  NEWS: "news",
  ARTICLES: "articles",
  USER: "user",
  CATEGORY: "category",
  ANNOUNCEMENT: "announcement",
  GLOBAL_SETTINGS: "global_settings",
  REWARD_ACHIEVEMENT: "reward_achievement",
} as const;

export type EntityType = (typeof ENTITY_TYPES)[keyof typeof ENTITY_TYPES];
