export const ALLOWED_ARTICLES_SETTINGS = {
  ARTICLES_ENABLED: "articlesEnabled",
  UNREGISTERED_USER_ARTICLES_ACCESSIBILITY: "unregisteredUserArticlesAccessibility",
} as const;

export type AllowedArticlesSettings =
  (typeof ALLOWED_ARTICLES_SETTINGS)[keyof typeof ALLOWED_ARTICLES_SETTINGS];
