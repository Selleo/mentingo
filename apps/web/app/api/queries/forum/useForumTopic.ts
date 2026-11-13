import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";

import { ApiClient } from "~/api/api-client";

import { FORUM_QUERY_KEY } from "./forumQueryKeys";

import type { SupportedLanguages } from "@repo/shared";

const MISSING_TOPIC_STATUSES = [400, 404];

export const forumTopicQueryOptions = (topicId: string, language: SupportedLanguages) =>
  queryOptions({
    queryKey: [...FORUM_QUERY_KEY, "topic", topicId, language],
    queryFn: async () => {
      try {
        const response = await ApiClient.api.forumControllerGetTopic(topicId, { language });

        return response.data.data;
      } catch (error) {
        const status = isAxiosError(error) ? error.response?.status : undefined;

        if (status && MISSING_TOPIC_STATUSES.includes(status)) return null;

        throw error;
      }
    },
  });

export function useForumTopicSuspense(topicId: string, language: SupportedLanguages) {
  return useSuspenseQuery(forumTopicQueryOptions(topicId, language));
}
