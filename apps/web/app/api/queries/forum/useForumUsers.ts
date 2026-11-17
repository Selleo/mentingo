import { queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

export const FORUM_USERS_QUERY_KEY = ["forum-users"];

export const forumUsersQueryOptions = ({ enabled = true } = {}) =>
  queryOptions({
    queryKey: FORUM_USERS_QUERY_KEY,
    queryFn: async () => {
      const response = await ApiClient.api.forumControllerGetMentionableUsers();

      return response.data.data;
    },
    enabled,
  });

export function useForumUsers(options?: { enabled?: boolean }) {
  return useQuery(forumUsersQueryOptions(options));
}
