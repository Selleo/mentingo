import { queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

export const COURSE_GENERATION_FILES_QUERY_KEY = "course-generation-files";

export const getCourseGenerationFilesQueryKey = (integrationId: string) =>
  [COURSE_GENERATION_FILES_QUERY_KEY, { integrationId }] as const;

export const courseGenerationFilesQueryOptions = (integrationId: string, enabled = true) =>
  queryOptions({
    enabled: enabled && !!integrationId,
    queryKey: getCourseGenerationFilesQueryKey(integrationId),
    queryFn: async () => {
      const response = await ApiClient.api.lumaControllerGetCourseGenerationFiles(integrationId);

      return response.data;
    },
  });

export function useCourseGenerationFiles(integrationId: string, enabled = true) {
  return useQuery(courseGenerationFilesQueryOptions(integrationId, enabled));
}
