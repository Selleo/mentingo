import { queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import { FORUM_QUERY_KEY } from "./forumQueryKeys";

import type { SupportedLanguages } from "@repo/shared";

export const forumTopicQueryOptions = (
  topicId: string,
  language: SupportedLanguages,
  { enabled = true } = {},
) =>
  queryOptions({
    queryKey: [...FORUM_QUERY_KEY, "topic", topicId, language],
    queryFn: async () => {
      const response = await ApiClient.api.forumControllerGetTopic(topicId, { language });

      return response.data.data;
    },
    enabled: enabled && Boolean(topicId),
  });

export function useForumTopic(
  topicId: string,
  language: SupportedLanguages,
  options?: { enabled?: boolean },
) {
  return useQuery(forumTopicQueryOptions(topicId, language, options));
}
