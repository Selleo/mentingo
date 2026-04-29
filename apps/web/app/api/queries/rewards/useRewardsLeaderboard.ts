import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import type { ApiData, RewardsLeaderboard } from "./types";

export const rewardsLeaderboardQueryKey = (groupId?: string) =>
  ["rewards", "leaderboard", groupId ?? "all"] as const;

export function useRewardsLeaderboard(groupId?: string) {
  return useQuery({
    queryKey: rewardsLeaderboardQueryKey(groupId),
    queryFn: async () => {
      const response = await ApiClient.instance.get<ApiData<RewardsLeaderboard>>(
        "/api/rewards/leaderboard",
        { params: { groupId } },
      );

      return response.data.data;
    },
  });
}
