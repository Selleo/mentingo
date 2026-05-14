import { useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import type { GetActivityLogsResponse } from "~/api/generated-api";

export type ActivityLogsSearchParams = {
  keyword?: string;
  email?: string;
  from?: string;
  to?: string;
  page?: number;
  perPage?: number;
};

type QueryOptions = {
  enabled?: boolean;
};

export const ACTIVITY_LOGS_QUERY_KEY = "activity-logs";

export const activityLogsQueryOptions = (
  searchParams?: ActivityLogsSearchParams,
  options: QueryOptions = { enabled: true },
) => ({
  queryKey: [ACTIVITY_LOGS_QUERY_KEY, searchParams],
  queryFn: async () => {
    const { data } = await ApiClient.api.activityLogsControllerGetActivityLogs({
      ...(searchParams?.page && { page: searchParams.page }),
      ...(searchParams?.perPage && { perPage: searchParams.perPage }),
      ...(searchParams?.keyword && { keyword: searchParams.keyword }),
      ...(searchParams?.email && { email: searchParams.email }),
      ...(searchParams?.from && { from: searchParams.from }),
      ...(searchParams?.to && { to: searchParams.to }),
    });
    return data;
  },
  select: (response: GetActivityLogsResponse) => response,
  ...options,
});

export function useActivityLogsQuery(
  searchParams?: ActivityLogsSearchParams,
  options?: QueryOptions,
) {
  return useQuery(activityLogsQueryOptions(searchParams, options));
}

export function useActivityLogsQuerySuspense(
  searchParams?: ActivityLogsSearchParams,
  options?: QueryOptions,
) {
  return useSuspenseQuery(activityLogsQueryOptions(searchParams, options));
}
