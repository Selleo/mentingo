import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import { GAMIFICATION_QUERY_KEY } from "./useUserGamificationProfile";

export type LeaderboardQuery = NonNullable<
  Parameters<typeof ApiClient.api.leaderboardControllerGetLeaderboard>[0]
>;

export function useLeaderboard(query: LeaderboardQuery, { enabled = true } = {}) {
  return useQuery({
    queryKey: [GAMIFICATION_QUERY_KEY, "leaderboard", query],
    queryFn: async () => {
      const response = await ApiClient.api.leaderboardControllerGetLeaderboard(query);

      return response.data.data;
    },
    enabled,
  });
}
