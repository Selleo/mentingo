export const FORUM_TOPIC_SORTS = {
  LAST_ACTIVITY: "lastActivity",
  NEWEST: "newest",
  MOST_REPLIES: "mostReplies",
} as const;

export type ForumTopicSort = (typeof FORUM_TOPIC_SORTS)[keyof typeof FORUM_TOPIC_SORTS];

export const FORUM_TOPIC_TITLE_MAX_LENGTH = 200;
export const FORUM_POST_MAX_LENGTH = 5000;
export const FORUM_SEARCH_MAX_LENGTH = 200;

export const FORUM_SOCKET_EVENTS = {
  JOIN: "join:forum",
  LEAVE: "leave:forum",
  JOIN_TOPIC: "join:forum-topic",
  LEAVE_TOPIC: "leave:forum-topic",
  CHANGED: "forum:changed",
  TOPIC_CHANGED: "forum:topic-changed",
  USER_MENTIONED: "forum:user-mentioned",
} as const;

export const getForumRoom = (tenantId: string) => `forum:${tenantId}`;

export const getForumTopicRoom = (topicId: string) => `forum-topic:${topicId}`;
