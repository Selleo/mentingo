import { COURSE_CHAT_ALLOWED_REACTIONS } from "@repo/shared";

export const COURSE_CHAT_REACTIONS = COURSE_CHAT_ALLOWED_REACTIONS;

export const COURSE_CHAT_MESSAGES_QUERY_KEY = ["course-chat", "messages"];
export const COURSE_CHAT_REPLIES_QUERY_KEY = ["course-chat", "replies"];
export const COURSE_CHAT_USERS_QUERY_KEY = ["course-chat", "users"];

export const getCourseChatMessagesQueryKey = (courseId: string, page = 1, perPage = 10) => [
  ...COURSE_CHAT_MESSAGES_QUERY_KEY,
  courseId,
  page,
  perPage,
];

export const getCourseChatRepliesQueryKey = (messageId: string, page = 1, perPage = 100) => [
  ...COURSE_CHAT_REPLIES_QUERY_KEY,
  messageId,
  page,
  perPage,
];

export const getInfiniteCourseChatRepliesQueryKey = (messageId: string, perPage = 100) => [
  ...COURSE_CHAT_REPLIES_QUERY_KEY,
  messageId,
  "infinite",
  perPage,
];

export const getCourseChatUsersQueryKey = (courseId: string) => [
  ...COURSE_CHAT_USERS_QUERY_KEY,
  courseId,
];
