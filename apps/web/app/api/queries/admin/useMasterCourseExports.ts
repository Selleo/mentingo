import { queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import type { GetMasterCourseExportsResponse } from "~/api/generated-api";

export const MASTER_COURSE_EXPORTS_QUERY_KEY = ["master-course-exports", "admin"] as const;

export type MasterCourseExportLink = GetMasterCourseExportsResponse["data"][number];

export const masterCourseExportsQueryOptions = (courseId: string, enabled = true) =>
  queryOptions({
    queryKey: [...MASTER_COURSE_EXPORTS_QUERY_KEY, courseId],
    enabled: Boolean(courseId) && enabled,
    queryFn: async (): Promise<GetMasterCourseExportsResponse> => {
      const response = await ApiClient.api.courseControllerGetMasterCourseExports(courseId);
      return response.data;
    },
    select: (response) => response.data,
  });

export function useMasterCourseExports(courseId: string, enabled = true) {
  return useQuery(masterCourseExportsQueryOptions(courseId, enabled));
}
