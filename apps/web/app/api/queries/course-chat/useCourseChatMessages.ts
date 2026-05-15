import { queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

export const COURSE_CHAT_MESSAGES_QUERY_KEY = ["course-chat", "messages"];
export const COURSE_CHAT_MESSAGES_PER_PAGE = 10;

export const getCourseChatMessagesQueryKey = (courseId: string, page = 1, perPage = 10) => [
  ...COURSE_CHAT_MESSAGES_QUERY_KEY,
  courseId,
  page,
  perPage,
];

export const courseChatMessagesQueryOptions = (courseId: string, page = 1) =>
  queryOptions({
    enabled: Boolean(courseId),
    queryKey: getCourseChatMessagesQueryKey(courseId, page, COURSE_CHAT_MESSAGES_PER_PAGE),
    queryFn: async () => {
      const response = await ApiClient.api.courseChatControllerGetMessages(courseId, {
        page,
        perPage: COURSE_CHAT_MESSAGES_PER_PAGE,
      });

      return response.data;
    },
  });

export function useCourseChatMessages(courseId: string, page = 1) {
  return useQuery(courseChatMessagesQueryOptions(courseId, page));
}
