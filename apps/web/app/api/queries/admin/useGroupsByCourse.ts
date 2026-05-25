import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import type { SupportedLanguages } from "@repo/shared";

export const GROUPS_BY_COURSE_QUERY_KEY = "groupsByCourse";

export const groupsByCourseQueryOptions = (courseId: string, language?: SupportedLanguages) => ({
  queryKey: [GROUPS_BY_COURSE_QUERY_KEY, { courseId, language }],
  queryFn: async () => {
    const { data } = await ApiClient.api.groupControllerGetGroupsByCourse(courseId, { language });
    return data.data;
  },
  enabled: !!courseId,
});

export const useGroupsByCourseQuery = (courseId: string, language?: SupportedLanguages) => {
  return useQuery(groupsByCourseQueryOptions(courseId, language));
};
