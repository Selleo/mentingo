import { queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import type { GetMasterCourseExportCandidatesResponse } from "~/api/generated-api";

export const MASTER_COURSE_EXPORT_CANDIDATES_QUERY_KEY = [
  "master-course-export-candidates",
  "admin",
] as const;

export const masterCourseExportCandidatesQueryOptions = (courseId: string, enabled = true) =>
  queryOptions({
    queryKey: [...MASTER_COURSE_EXPORT_CANDIDATES_QUERY_KEY, courseId],
    enabled: Boolean(courseId) && enabled,
    queryFn: async (): Promise<GetMasterCourseExportCandidatesResponse> => {
      const response =
        await ApiClient.api.courseControllerGetMasterCourseExportCandidates(courseId);
      return response.data;
    },
    select: (response) => response.data,
  });

export function useMasterCourseExportCandidates(courseId: string, enabled = true) {
  return useQuery(masterCourseExportCandidatesQueryOptions(courseId, enabled));
}
