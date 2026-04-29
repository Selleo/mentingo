import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { LeaderboardGroup, LeaderboardRow, QueryResponse } from "../generated-api";

type LeaderboardScope = "all-time" | "month";

export type { LeaderboardGroup, LeaderboardRow };
export type LeaderboardResponse = QueryResponse["data"];

export const leaderboardQueryOptions = (
  scope: LeaderboardScope = "all-time",
  groupId?: string | null,
) => ({
  queryKey: ["leaderboard", scope, groupId ?? null] as const,
  queryFn: async () => {
    const response = await ApiClient.api.leaderboardControllerQuery({
      scope,
      ...(groupId ? { groupId } : {}),
    });

    return response.data.data;
  },
});

export const leaderboardGroupsQueryOptions = () => ({
  queryKey: ["leaderboard", "groups"] as const,
  queryFn: async () => {
    const response = await ApiClient.api.leaderboardControllerListGroups();

    return response.data.data;
  },
});

export function useLeaderboard(scope: LeaderboardScope = "all-time", groupId?: string | null) {
  return useQuery(leaderboardQueryOptions(scope, groupId));
}

export function useLeaderboardGroups() {
  return useQuery(leaderboardGroupsQueryOptions());
}
