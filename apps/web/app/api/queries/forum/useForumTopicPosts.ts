import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import { FORUM_QUERY_KEY } from "./forumQueryKeys";

export const FORUM_POSTS_PER_PAGE = 20;

export const forumTopicPostsQueryOptions = (
  topicId: string,
  page: number,
  { enabled = true } = {},
) =>
  queryOptions({
    queryKey: [...FORUM_QUERY_KEY, "topic", topicId, "posts", page],
    queryFn: async () => {
      const response = await ApiClient.api.forumControllerGetTopicPosts(topicId, {
        page,
        perPage: FORUM_POSTS_PER_PAGE,
      });

      return response.data;
    },
    placeholderData: keepPreviousData,
    enabled: enabled && Boolean(topicId),
  });

export function useForumTopicPosts(topicId: string, page: number, options?: { enabled?: boolean }) {
  return useQuery(forumTopicPostsQueryOptions(topicId, page, options));
}
