import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

export const COURSE_CHAT_MESSAGES_QUERY_KEY = ["course-chat", "messages"];
export const COURSE_CHAT_MESSAGES_PER_PAGE = 10;

export const getCourseChatMessagesQueryKey = (courseId: string, page = 1, perPage = 10) => [
  ...COURSE_CHAT_MESSAGES_QUERY_KEY,
  courseId,
  page,
  perPage,
];

export const courseChatMessagesQueryOptions = (
  courseId: string,
  page = 1,
  threadMessageId?: string,
) =>
  queryOptions({
    queryKey: threadMessageId
      ? [...COURSE_CHAT_MESSAGES_QUERY_KEY, courseId, "thread", threadMessageId]
      : getCourseChatMessagesQueryKey(courseId, page, COURSE_CHAT_MESSAGES_PER_PAGE),
    queryFn: async () => {
      const response = await ApiClient.api.courseChatControllerGetMessages(
        courseId,
        threadMessageId
          ? { aroundMessageId: threadMessageId, perPage: COURSE_CHAT_MESSAGES_PER_PAGE }
          : { page, perPage: COURSE_CHAT_MESSAGES_PER_PAGE },
      );

      return response.data;
    },
  });

export function useCourseChatMessages(courseId: string, page = 1, threadMessageId?: string) {
  return useQuery({
    ...courseChatMessagesQueryOptions(courseId, page, threadMessageId),
    enabled: Boolean(courseId),
  });
}

export function useCourseChatMessagesSuspense(courseId: string, page = 1) {
  return useSuspenseQuery(courseChatMessagesQueryOptions(courseId, page));
}
