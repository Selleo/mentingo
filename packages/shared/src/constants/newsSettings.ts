export const ALLOWED_NEWS_SETTINGS = {
  NEWS_ENABLED: "newsEnabled",
  UNREGISTERED_USER_NEWS_ACCESSIBILITY: "unregisteredUserNewsAccessibility",
} as const;

export type AllowedNewsSettings =
  (typeof ALLOWED_NEWS_SETTINGS)[keyof typeof ALLOWED_NEWS_SETTINGS];
