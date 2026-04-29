export const COURSE_CHAT_SOCKET_EVENTS = {
  JOIN: "join:course-chat",
  LEAVE: "leave:course-chat",
  MESSAGE_CREATED: "course-chat:message-created",
  THREAD_CREATED: "course-chat:thread-created",
  USER_PRESENCE_CHANGED: "course-chat:user-presence-changed",
  USER_MENTIONED: "course-chat:user-mentioned",
  MESSAGE_REACTIONS_UPDATED: "course-chat:message-reactions-updated",
} as const;

export const COURSE_CHAT_ALLOWED_REACTIONS = ["👍", "❤️", "😂", "🎉", "😮"] as const;

export const getCourseChatRoom = (courseId: string) => `course-chat:${courseId}`;
