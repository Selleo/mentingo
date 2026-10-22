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

/** Node types in the hierarchical global search result tree. */
export const GLOBAL_SEARCH_RESULT_TYPES = {
  COURSE: "course",
  LESSON: "lesson",
  LEARNING_PATH: "learningPath",
  NEWS: "news",
  ARTICLE: "article",
  QA: "qa",
} as const;

export type GlobalSearchResultType =
  (typeof GLOBAL_SEARCH_RESULT_TYPES)[keyof typeof GLOBAL_SEARCH_RESULT_TYPES];
