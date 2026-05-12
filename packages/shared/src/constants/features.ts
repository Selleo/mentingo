export const FEATURES = {
  QA: "qa",
  NEWS: "news",
  ARTICLES: "articles",
  MODERN_COURSE_LIST: "modern_course_list",
  CALENDAR: "calendar",
  LIVE_TRAINING: "live_training",
} as const;

export type FeatureKey = (typeof FEATURES)[keyof typeof FEATURES];

export const FEATURE_SETTINGS_KEYS = {
  [FEATURES.QA]: "QAEnabled",
  [FEATURES.NEWS]: "newsEnabled",
  [FEATURES.ARTICLES]: "articlesEnabled",
  [FEATURES.MODERN_COURSE_LIST]: "modernCourseListEnabled",
  [FEATURES.CALENDAR]: "calendarEnabled",
  [FEATURES.LIVE_TRAINING]: "liveTrainingEnabled",
} as const satisfies Record<FeatureKey, string>;

export type FeatureSettingsKey = (typeof FEATURE_SETTINGS_KEYS)[FeatureKey];
