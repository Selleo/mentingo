export const GLOBAL_SEARCH_MODES = {
  KEYWORD: "keyword",
  HYBRID: "hybrid",
} as const;

export type GlobalSearchMode = (typeof GLOBAL_SEARCH_MODES)[keyof typeof GLOBAL_SEARCH_MODES];

export const GLOBAL_SEARCH_SEMANTIC_STATUSES = {
  READY: "ready",
  UNAVAILABLE: "unavailable",
  PENDING: "pending",
} as const;

export type GlobalSearchSemanticStatus =
  (typeof GLOBAL_SEARCH_SEMANTIC_STATUSES)[keyof typeof GLOBAL_SEARCH_SEMANTIC_STATUSES];
