import { queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import { FORUM_QUERY_KEY } from "./forumQueryKeys";

export const forumUsersQueryOptions = ({ enabled = true } = {}) =>
  queryOptions({
    queryKey: [...FORUM_QUERY_KEY, "users"],
    queryFn: async () => {
      const response = await ApiClient.api.forumControllerGetMentionableUsers();

      return response.data.data;
    },
    enabled,
  });

export function useForumUsers(options?: { enabled?: boolean }) {
  return useQuery(forumUsersQueryOptions(options));
}
