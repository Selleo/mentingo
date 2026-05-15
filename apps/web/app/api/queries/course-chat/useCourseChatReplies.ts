import { queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

export const COURSE_CHAT_REPLIES_QUERY_KEY = ["course-chat", "replies"];
export const COURSE_CHAT_REPLIES_PER_PAGE = 100;

export const getCourseChatRepliesQueryKey = (messageId: string, page = 1, perPage = 100) => [
  ...COURSE_CHAT_REPLIES_QUERY_KEY,
  messageId,
  page,
  perPage,
];

export const courseChatRepliesQueryOptions = (messageId?: string, page = 1) =>
  queryOptions({
    enabled: Boolean(messageId),
    queryKey: getCourseChatRepliesQueryKey(messageId ?? "", page, COURSE_CHAT_REPLIES_PER_PAGE),
    queryFn: async () => {
      const response = await ApiClient.api.courseChatControllerGetReplies(messageId ?? "", {
        page,
        perPage: COURSE_CHAT_REPLIES_PER_PAGE,
      });

      return response.data;
    },
  });

export function useCourseChatReplies(messageId?: string, page = 1) {
  return useQuery(courseChatRepliesQueryOptions(messageId, page));
}
