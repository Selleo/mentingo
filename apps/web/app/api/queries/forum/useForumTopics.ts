import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import { FORUM_QUERY_KEY } from "./forumQueryKeys";

export type ForumTopicsQuery = NonNullable<
  Parameters<typeof ApiClient.api.forumControllerGetTopics>[0]
>;

export const FORUM_TOPICS_PER_PAGE = 20;

export const forumTopicsQueryOptions = (query: ForumTopicsQuery, { enabled = true } = {}) =>
  queryOptions({
    queryKey: [...FORUM_QUERY_KEY, "topics", query],
    queryFn: async () => {
      const response = await ApiClient.api.forumControllerGetTopics(query);

      return response.data;
    },
    placeholderData: keepPreviousData,
    enabled,
  });

export function useForumTopics(query: ForumTopicsQuery, options?: { enabled?: boolean }) {
  return useQuery(forumTopicsQueryOptions(query, options));
}
