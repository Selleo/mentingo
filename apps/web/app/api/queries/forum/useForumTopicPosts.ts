import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import { FORUM_QUERY_KEY } from "./forumQueryKeys";

export const FORUM_POSTS_PER_PAGE = 20;

export const forumTopicPostsQueryOptions = (topicId: string, page: number) =>
  queryOptions({
    queryKey: [...FORUM_QUERY_KEY, "topic", topicId, "posts", page],
    queryFn: async () => {
      const response = await ApiClient.api.forumControllerGetTopicPosts(topicId, {
        page,
        perPage: FORUM_POSTS_PER_PAGE,
      });

      return response.data;
    },
  });

export function useForumTopicPostsSuspense(topicId: string, page: number) {
  return useSuspenseQuery(forumTopicPostsQueryOptions(topicId, page));
}
