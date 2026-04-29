import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { LeaderboardRow, QueryResponse } from "../generated-api";

type LeaderboardScope = "all-time";

export type { LeaderboardRow };
export type LeaderboardResponse = QueryResponse["data"];

export const leaderboardQueryOptions = (scope: LeaderboardScope = "all-time") => ({
  queryKey: ["leaderboard", scope] as const,
  queryFn: async () => {
    const response = await ApiClient.api.leaderboardControllerQuery({ scope });

    return response.data.data;
  },
});

export function useLeaderboard(scope: LeaderboardScope = "all-time") {
  return useQuery(leaderboardQueryOptions(scope));
}
