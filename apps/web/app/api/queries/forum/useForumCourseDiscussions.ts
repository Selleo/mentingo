import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import { FORUM_QUERY_KEY } from "./forumQueryKeys";

export type ForumCourseDiscussionsQuery = NonNullable<
  Parameters<typeof ApiClient.api.forumControllerGetCourseDiscussions>[0]
>;

export const FORUM_COURSE_DISCUSSIONS_PER_PAGE = 20;

export const forumCourseDiscussionsQueryOptions = (query: ForumCourseDiscussionsQuery) =>
  queryOptions({
    queryKey: [...FORUM_QUERY_KEY, "course-discussions", query],
    queryFn: async () => {
      const response = await ApiClient.api.forumControllerGetCourseDiscussions(query);

      return response.data;
    },
  });

export function useForumCourseDiscussions(
  query: ForumCourseDiscussionsQuery,
  options?: { enabled?: boolean },
) {
  return useQuery({ ...forumCourseDiscussionsQueryOptions(query), ...options });
}

export function useForumCourseDiscussionsSuspense(query: ForumCourseDiscussionsQuery) {
  return useSuspenseQuery(forumCourseDiscussionsQueryOptions(query));
}
