import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import type { GetCourseDuplicationJobStatusResponse } from "~/api/generated-api";

export const COURSE_DUPLICATION_JOB_QUERY_KEY = ["course-duplication-job"];

export const courseDuplicationJobStatusQueryOptions = (jobId: string, enabled: boolean) => ({
  queryKey: [COURSE_DUPLICATION_JOB_QUERY_KEY, { jobId }],
  queryFn: async () => {
    const response = await ApiClient.api.courseControllerGetCourseDuplicationJobStatus(jobId);
    return response.data;
  },
  select: (data: GetCourseDuplicationJobStatusResponse) => data.data,
  enabled,
  refetchInterval: (query: { state: { data?: GetCourseDuplicationJobStatusResponse } }) => {
    const state = query.state.data?.data.state;
    return state === "completed" || state === "failed" ? false : 3000;
  },
});

export function useCourseDuplicationJobStatus(jobId: string | null) {
  return useQuery(courseDuplicationJobStatusQueryOptions(jobId ?? "", Boolean(jobId)));
}
