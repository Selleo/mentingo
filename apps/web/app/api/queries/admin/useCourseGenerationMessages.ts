import { queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

export const COURSE_GENERATION_MESSAGES_QUERY_KEY = "course-generation-messages";

export const getCourseGenerationMessagesQueryKey = (integrationId: string) =>
  [COURSE_GENERATION_MESSAGES_QUERY_KEY, { integrationId }] as const;

export const courseGenerationMessagesQueryOptions = (integrationId: string, enabled = true) =>
  queryOptions({
    enabled: enabled && !!integrationId,
    queryKey: getCourseGenerationMessagesQueryKey(integrationId),
    queryFn: async () => {
      const response = await ApiClient.api.lumaControllerGetCourseGenerationMessages({
        integrationId,
      });

      return response.data;
    },
  });

export function useCourseGenerationMessages(integrationId: string, enabled = true) {
  return useQuery(courseGenerationMessagesQueryOptions(integrationId, enabled));
}
