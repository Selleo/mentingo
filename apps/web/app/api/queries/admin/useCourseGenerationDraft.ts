import { queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

export const COURSE_GENERATION_DRAFT_QUERY_KEY = "course-generation-draft";

export const getCourseGenerationDraftQueryKey = (integrationId: string, draftName: string) =>
  [COURSE_GENERATION_DRAFT_QUERY_KEY, { integrationId, draftName }] as const;

export const courseGenerationDraftQueryOptions = (
  integrationId: string,
  draftName: string,
  enabled = true,
) =>
  queryOptions({
    enabled: enabled && !!integrationId && !!draftName,
    queryKey: getCourseGenerationDraftQueryKey(integrationId, draftName),
    queryFn: async () => {
      const response = await ApiClient.api.lumaControllerGetCourseGenerationDraft({
        integrationId,
        draftName,
      });

      return response.data;
    },
  });

export function useCourseGenerationDraft(integrationId: string, draftName: string, enabled = true) {
  return useQuery(courseGenerationDraftQueryOptions(integrationId, draftName, enabled));
}
