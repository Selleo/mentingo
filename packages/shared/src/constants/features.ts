export const FEATURES = {
  QA: "qa",
  NEWS: "news",
  ARTICLES: "articles",
  MODERN_COURSE_LIST: "modern_course_list",
  CALENDAR: "calendar",
  LIVE_TRAINING: "live_training",
  COURSE_DISCUSSIONS: "course_discussions",
} as const;

export type FeatureKey = (typeof FEATURES)[keyof typeof FEATURES];

export const FEATURE_SETTINGS_KEYS = {
  [FEATURES.QA]: "QAEnabled",
  [FEATURES.NEWS]: "newsEnabled",
  [FEATURES.ARTICLES]: "articlesEnabled",
  [FEATURES.MODERN_COURSE_LIST]: "modernCourseListEnabled",
  [FEATURES.CALENDAR]: "calendarEnabled",
  [FEATURES.LIVE_TRAINING]: "liveTrainingEnabled",
  [FEATURES.COURSE_DISCUSSIONS]: "courseDiscussionsEnabled",
} as const satisfies Record<FeatureKey, string>;

export type FeatureSettingKey = (typeof FEATURE_SETTINGS_KEYS)[keyof typeof FEATURE_SETTINGS_KEYS];

export const FEATURE_UNREGISTERED_ACCESS_KEYS = {
  [FEATURES.NEWS]: "unregisteredUserNewsAccessibility",
  [FEATURES.ARTICLES]: "unregisteredUserArticlesAccessibility",
  [FEATURES.QA]: "unregisteredUserQAAccessibility",
} as const satisfies Partial<Record<FeatureKey, string>>;

export type UnregisteredAccessFeatureKey = keyof typeof FEATURE_UNREGISTERED_ACCESS_KEYS;
