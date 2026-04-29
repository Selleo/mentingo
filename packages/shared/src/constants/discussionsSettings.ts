export const ALLOWED_DISCUSSIONS_SETTINGS = {
  DISCUSSIONS_ENABLED: "discussionsEnabled",
} as const;

export type AllowedDiscussionsSettings =
  (typeof ALLOWED_DISCUSSIONS_SETTINGS)[keyof typeof ALLOWED_DISCUSSIONS_SETTINGS];
