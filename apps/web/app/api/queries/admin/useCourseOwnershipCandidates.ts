import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "../../api-client";

export const COURSE_OWNERSHIP_CANDIDATES_QUERY_KEY = ["course-ownership-candidates", "admin"];

interface CourseOwnershipCandidatesOptions {
  id: string;
  enabled?: boolean;
}

export const courseOwnershipCandidatesQueryOptions = ({
  id,
  enabled,
}: CourseOwnershipCandidatesOptions) =>
  queryOptions({
    enabled,
    queryKey: [COURSE_OWNERSHIP_CANDIDATES_QUERY_KEY, { id }],
    queryFn: async () => {
      const response = await ApiClient.api.courseControllerGetCourseOwnership(id);

      return response.data;
    },
    select: (data) => data.data,
  });

export function useCourseOwnershipCandidates({ id, enabled }: CourseOwnershipCandidatesOptions) {
  return useQuery(courseOwnershipCandidatesQueryOptions({ id, enabled }));
}

export function useCourseOwnershipCandidatesSuspense({
  id,
  enabled,
}: CourseOwnershipCandidatesOptions) {
  return useSuspenseQuery(courseOwnershipCandidatesQueryOptions({ id, enabled }));
}
