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

export const ENTITY_TYPES_KEYS = {
  // [ENTITY_TYPES.COURSE]: "courseEnabled",
  // [ENTITY_TYPES.CHAPTER]: "chapterEnabled",
  // [ENTITY_TYPES.LESSON]: "lessonEnabled",
  // [ENTITY_TYPES.QUESTION]: "questionEnabled",
  [ENTITY_TYPES.NEWS]: "newsEnabled",
  [ENTITY_TYPES.ARTICLES]: "articlesEnabled",
  [ENTITY_TYPES.LEARNING_PATH]: "learningPathsEnabled",
  [ENTITY_TYPES.QA]: "QAEnabled",
  // [ENTITY_TYPES.USER]: "userEnabled",
  // [ENTITY_TYPES.CATEGORY]: "categoryEnabled",
  // [ENTITY_TYPES.ANNOUNCEMENT]: "announcementEnabled",
  // [ENTITY_TYPES.GLOBAL_SETTINGS]: "globalSettingsEnabled",
  [ENTITY_TYPES.LIVE_TRAINING]: "liveTrainingEnabled",
} as const;

export type FeatureFlaggedEntityType = keyof typeof ENTITY_TYPES_KEYS;

export type EntityTypesKey = (typeof ENTITY_TYPES_KEYS)[keyof typeof ENTITY_TYPES_KEYS];

export const UNREGISTERED_ACCESS_KEYS = {
  [ENTITY_TYPES.NEWS]: "unregisteredUserNewsAccessibility",
  [ENTITY_TYPES.ARTICLES]: "unregisteredUserArticlesAccessibility",
  [ENTITY_TYPES.QA]: "unregisteredUserQAAccessibility",
} as const satisfies Partial<Record<FeatureFlaggedEntityType, string>>;

export type UnregisteredAccessEntityType = keyof typeof UNREGISTERED_ACCESS_KEYS;

export type UnregisteredAccessKey =
  (typeof UNREGISTERED_ACCESS_KEYS)[keyof typeof UNREGISTERED_ACCESS_KEYS];
