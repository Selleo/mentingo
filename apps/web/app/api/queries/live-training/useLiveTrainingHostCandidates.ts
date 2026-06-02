import { useInfiniteQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import type { GetHostCandidatesResponse } from "~/api/generated-api";

export const LIVE_TRAINING_HOST_CANDIDATES_QUERY_KEY = "live-training-host-candidates";

type LiveTrainingHostCandidatesParams = {
  id: string;
  keyword?: string;
  perPage?: number;
};

type QueryOptions = {
  enabled?: boolean;
};

export const liveTrainingHostCandidatesQueryOptions = (
  { id, keyword, perPage = 20 }: LiveTrainingHostCandidatesParams,
  options: QueryOptions = { enabled: true },
) => ({
  queryKey: [LIVE_TRAINING_HOST_CANDIDATES_QUERY_KEY, id, keyword, perPage],
  queryFn: async ({ pageParam }: { pageParam: number }) => {
    const response = await ApiClient.api.liveTrainingControllerGetHostCandidates(id, {
      page: pageParam,
      perPage,
      ...(keyword && { keyword }),
    });

    return response.data;
  },
  getNextPageParam: (lastPage: GetHostCandidatesResponse) => {
    const loadedItems = lastPage.pagination.page * lastPage.pagination.perPage;

    if (loadedItems >= lastPage.pagination.totalItems) return undefined;

    return lastPage.pagination.page + 1;
  },
  initialPageParam: 1,
  ...options,
});

export function useLiveTrainingHostCandidates(
  params: LiveTrainingHostCandidatesParams,
  options: QueryOptions = { enabled: true },
) {
  return useInfiniteQuery(liveTrainingHostCandidatesQueryOptions(params, options));
}
