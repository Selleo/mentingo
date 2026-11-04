import { useQuery } from "@tanstack/react-query";

import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { ApiClient } from "../api-client";

export const GAMIFICATION_QUERY_KEY = "gamification";

type UseUserGamificationProfileOptions = {
  enabled?: boolean;
  refetchInterval?: number;
};

export function useUserGamificationProfile(
  userId: string | undefined,
  { enabled = true, refetchInterval }: UseUserGamificationProfileOptions = {},
) {
  const language = useLanguageStore((state) => state.language);

  return useQuery({
    queryKey: [GAMIFICATION_QUERY_KEY, userId, language],
    queryFn: async () => {
      const response = await ApiClient.api.gamificationControllerGetUserGamificationProfile(
        userId ?? "",
        { language },
      );

      return response.data.data;
    },
    enabled: enabled && Boolean(userId),
    // Stop polling after an error so a revoked permission does not toast every interval.
    refetchInterval: (query) => (query.state.status === "error" ? false : refetchInterval),
  });
}
