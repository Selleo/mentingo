export const COURSE_CHAT_SOCKET_EVENTS = {
  JOIN: "join:course-chat",
  LEAVE: "leave:course-chat",
  MESSAGE_CREATED: "course-chat:message-created",
  USER_PRESENCE_CHANGED: "course-chat:user-presence-changed",
  USER_MENTIONED: "course-chat:user-mentioned",
  MESSAGE_REACTIONS_UPDATED: "course-chat:message-reactions-updated",
  MESSAGE_DELETED: "course-chat:message-deleted",
} as const;

export const COURSE_CHAT_ALLOWED_REACTIONS = ["👍", "❤️", "😂", "🎉", "😮"] as const;

export const getCourseChatRoom = (courseId: string) => `course-chat:${courseId}`;

export const COURSE_DISCUSSION_URL_PARAMS = {
  TAB: "tab",
  TAB_VALUE: "Discussion",
  THREAD: "thread",
} as const;

export const getCourseDiscussionThreadPath = (courseId: string, threadMessageId: string) => {
  const { TAB, TAB_VALUE, THREAD } = COURSE_DISCUSSION_URL_PARAMS;

  return `/course/${courseId}?${TAB}=${TAB_VALUE}&${THREAD}=${threadMessageId}`;
};

/** Course discussion threads and general forum topics share one thread model. */
export const DISCUSSION_SCOPES = {
  GENERAL: "general",
  COURSE: "course",
} as const;

export type DiscussionScope = (typeof DISCUSSION_SCOPES)[keyof typeof DISCUSSION_SCOPES];
