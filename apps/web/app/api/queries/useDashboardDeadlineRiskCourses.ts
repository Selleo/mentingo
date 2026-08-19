import { useInfiniteQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { GetDashboardDeadlineRiskCourseSummariesResponse } from "../generated-api";
import type { DashboardDeadlineRiskUrgencyOrder, SupportedLanguages } from "@repo/shared";

export type DashboardDeadlineRiskCourseSummary =
  GetDashboardDeadlineRiskCourseSummariesResponse["data"][number];

export function useDashboardDeadlineRiskCourses(
  language: SupportedLanguages,
  urgencyOrder: DashboardDeadlineRiskUrgencyOrder,
  enabled = true,
) {
  return useInfiniteQuery({
    queryKey: ["dashboard", "deadline-risk-courses", language, urgencyOrder],
    enabled,
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const response =
        await ApiClient.api.statisticsControllerGetDashboardDeadlineRiskCourseSummaries({
          language,
          urgencyOrder,
          page: pageParam,
          perPage: 20,
        });
      return response.data;
    },
    getNextPageParam: (lastPage) =>
      lastPage.pagination.page * lastPage.pagination.perPage < lastPage.pagination.totalItems
        ? lastPage.pagination.page + 1
        : undefined,
  });
}
