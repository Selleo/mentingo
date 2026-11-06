import { useQuery } from "@tanstack/react-query";

import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { ApiClient } from "../api-client";

import { GAMIFICATION_QUERY_KEY } from "./useUserGamificationProfile";

export function useLeaderboardScopes({ enabled = true } = {}) {
  const language = useLanguageStore((state) => state.language);

  return useQuery({
    queryKey: [GAMIFICATION_QUERY_KEY, "leaderboard-scopes", language],
    queryFn: async () => {
      const response = await ApiClient.api.leaderboardControllerGetLeaderboardScopes({ language });

      return response.data.data;
    },
    enabled,
  });
}
