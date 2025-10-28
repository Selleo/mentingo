import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

export const GROUPS_BY_COURSE_QUERY_KEY = "groupsByCourse";

export const groupsByCourseQueryOptions = (courseId: string) => ({
  queryKey: [GROUPS_BY_COURSE_QUERY_KEY, courseId],
  queryFn: async () => {
    const { data } = await ApiClient.api.groupControllerGetGroupsByCourse(courseId);
    return data.data;
  },
  enabled: !!courseId,
});

export const useGroupsByCourseQuery = (courseId: string) => {
  return useQuery(groupsByCourseQueryOptions(courseId));
};
