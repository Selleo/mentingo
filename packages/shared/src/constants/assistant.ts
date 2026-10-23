/** User-visible phases backed by actual Core Assistant runtime operations. */
export const ASSISTANT_RUN_ACTIVITIES = {
  STARTING: "starting",
  THINKING: "thinking",
  SEARCHING: "searching",
  READING: "reading",
  WRITING: "writing",
} as const;

export type AssistantRunActivity =
  (typeof ASSISTANT_RUN_ACTIVITIES)[keyof typeof ASSISTANT_RUN_ACTIVITIES];

/** Canonical entity kinds available in a verified Assistant source preview. */
export const ASSISTANT_SOURCE_TYPES = {
  COURSE: "course",
  LESSON: "lesson",
  USER: "user",
  GROUP: "group",
  CATEGORY: "category",
  ARTICLE: "article",
  NEWS: "news",
  QA: "qa",
  DEVELOPMENT_PATH: "development_path",
  RESOURCE: "resource",
} as const;
export type AssistantSourceType =
  (typeof ASSISTANT_SOURCE_TYPES)[keyof typeof ASSISTANT_SOURCE_TYPES];
