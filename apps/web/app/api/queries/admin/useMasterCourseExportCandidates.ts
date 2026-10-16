import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import type { GetMasterCourseExportCandidatesResponse } from "~/api/generated-api";
import type { ExportCandidatesSearchParams } from "~/api/queries/admin/exportCandidates.types";

export const MASTER_COURSE_EXPORT_CANDIDATES_QUERY_KEY = [
  "master-course-export-candidates",
  "admin",
] as const;

export const masterCourseExportCandidatesQueryOptions = (
  courseId: string,
  searchParams: ExportCandidatesSearchParams,
  enabled = true,
) =>
  queryOptions({
    queryKey: [...MASTER_COURSE_EXPORT_CANDIDATES_QUERY_KEY, courseId, searchParams],
    enabled: Boolean(courseId) && enabled,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<GetMasterCourseExportCandidatesResponse> => {
      const response = await ApiClient.api.courseControllerGetMasterCourseExportCandidates(
        courseId,
        searchParams,
      );
      return response.data;
    },
  });

export function useMasterCourseExportCandidates(
  courseId: string,
  searchParams: ExportCandidatesSearchParams,
  enabled = true,
) {
  return useQuery(masterCourseExportCandidatesQueryOptions(courseId, searchParams, enabled));
}
