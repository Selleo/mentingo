import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { SupportedLanguages } from "@repo/shared";

export const dashboardIncompleteCoursesQueryOptions = (language: SupportedLanguages) => ({
  queryKey: ["statistics/dashboard/incomplete-courses", { language }],
  queryFn: async () => {
    const response = await ApiClient.api.statisticsControllerGetDashboardIncompleteCourses({
      language,
    });

    return response.data.data;
  },
  staleTime: 1000 * 60,
});

export function useDashboardIncompleteCourses(language: SupportedLanguages) {
  return useQuery(dashboardIncompleteCoursesQueryOptions(language));
}
