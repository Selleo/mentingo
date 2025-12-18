export const ARTICLE_STATUS = {
  PUBLISHED: "published",
  DRAFT: "draft",
} as const;

export type ArticleStatus = (typeof ARTICLE_STATUS)[keyof typeof ARTICLE_STATUS];
