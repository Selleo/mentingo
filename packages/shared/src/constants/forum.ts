export const FORUM_TOPIC_SORTS = {
  LAST_ACTIVITY: "lastActivity",
  NEWEST: "newest",
  MOST_REPLIES: "mostReplies",
} as const;

export type ForumTopicSort = (typeof FORUM_TOPIC_SORTS)[keyof typeof FORUM_TOPIC_SORTS];

export const FORUM_TOPIC_TITLE_MAX_LENGTH = 200;
export const FORUM_POST_MAX_LENGTH = 5000;
export const FORUM_SEARCH_MAX_LENGTH = 200;
