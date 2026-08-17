import {
  DASHBOARD_DEADLINE_RISK_GROUP_SORT_FIELDS,
  DASHBOARD_DEADLINE_RISK_SORT_DIRECTIONS,
  type DashboardDeadlineRiskGroupSortField,
  type DashboardDeadlineRiskSortDirection,
  type DashboardDeadlineRiskType,
  type SupportedLanguages,
} from "@repo/shared";
import { useInfiniteQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { GetDashboardDeadlineRiskGroupsResponse } from "../generated-api";

export type DashboardDeadlineRiskGroup = GetDashboardDeadlineRiskGroupsResponse["data"][number];

export type DashboardDeadlineRiskGroupFilters = {
  urgency?: DashboardDeadlineRiskType;
  search?: string;
  sortBy?: DashboardDeadlineRiskGroupSortField;
  sortDirection?: DashboardDeadlineRiskSortDirection;
};

export function useDashboardDeadlineRiskGroups(
  courseId: string | null,
  language: SupportedLanguages,
  filters: DashboardDeadlineRiskGroupFilters = {},
  enabled = true,
) {
  const normalizedFilters = {
    sortBy: DASHBOARD_DEADLINE_RISK_GROUP_SORT_FIELDS.DUE_DATE,
    sortDirection: DASHBOARD_DEADLINE_RISK_SORT_DIRECTIONS.ASC,
    ...filters,
  };

  return useInfiniteQuery({
    queryKey: ["dashboard", "deadline-risk-groups", courseId, language, normalizedFilters],
    enabled: enabled && Boolean(courseId),
    initialPageParam: 1,
    placeholderData: (previousData, previousQuery) =>
      previousQuery?.queryKey[2] === courseId ? previousData : undefined,
    queryFn: async ({ pageParam }) => {
      if (!courseId) throw new Error("Deadline risk group API is unavailable");
      const response = await ApiClient.api.statisticsControllerGetDashboardDeadlineRiskGroups(
        courseId,
        { language, ...normalizedFilters, page: pageParam, perPage: 20 },
      );
      return response.data;
    },
    getNextPageParam: (lastPage) =>
      lastPage.pagination.page * lastPage.pagination.perPage < lastPage.pagination.totalItems
        ? lastPage.pagination.page + 1
        : undefined,
  });
}
