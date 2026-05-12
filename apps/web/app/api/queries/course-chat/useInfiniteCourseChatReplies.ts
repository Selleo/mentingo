import { useInfiniteQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import {
  COURSE_CHAT_REPLIES_QUERY_KEY,
  COURSE_CHAT_REPLIES_PER_PAGE,
} from "./useCourseChatReplies";

import type { InfiniteData } from "@tanstack/react-query";
import type { GetRepliesResponse } from "~/api/generated-api";

export const getInfiniteCourseChatRepliesQueryKey = (messageId: string, perPage = 100) => [
  ...COURSE_CHAT_REPLIES_QUERY_KEY,
  messageId,
  "infinite",
  perPage,
];

export function useInfiniteCourseChatReplies(messageId?: string) {
  return useInfiniteQuery<
    GetRepliesResponse,
    Error,
    InfiniteData<GetRepliesResponse>,
    ReturnType<typeof getInfiniteCourseChatRepliesQueryKey>,
    number
  >({
    enabled: Boolean(messageId),
    queryKey: getInfiniteCourseChatRepliesQueryKey(messageId ?? "", COURSE_CHAT_REPLIES_PER_PAGE),
    queryFn: async ({ pageParam = 1 }) => {
      const response = await ApiClient.api.courseChatControllerGetReplies(messageId ?? "", {
        page: pageParam,
        perPage: COURSE_CHAT_REPLIES_PER_PAGE,
      });

      return response.data;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { page, perPage, totalItems } = lastPage.pagination;
      const nextPage = page + 1;

      return nextPage <= Math.ceil(totalItems / perPage) ? nextPage : undefined;
    },
  });
}
