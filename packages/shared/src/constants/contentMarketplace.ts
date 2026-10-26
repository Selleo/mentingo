export const CONTENT_MARKETPLACE_SORT = {
  RECENT: "recent",
  TITLE: "title",
} as const;

export const CONTENT_MARKETPLACE_DURATIONS = {
  SHORT: "short",
  MEDIUM: "medium",
  LONG: "long",
} as const;

export type ContentMarketplaceSort =
  (typeof CONTENT_MARKETPLACE_SORT)[keyof typeof CONTENT_MARKETPLACE_SORT];

export type ContentMarketplaceDuration =
  (typeof CONTENT_MARKETPLACE_DURATIONS)[keyof typeof CONTENT_MARKETPLACE_DURATIONS];
