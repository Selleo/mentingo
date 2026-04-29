import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import type { ApiData } from "./types";

export type RewardPointsByDay = {
  date: string;
  points: number;
};

export const rewardPointsByDayQueryKey = (days: number) =>
  ["rewards", "points-by-day", days] as const;

export function useRewardPointsByDay(days = 30) {
  return useQuery({
    queryKey: rewardPointsByDayQueryKey(days),
    queryFn: async () => {
      const response = await ApiClient.instance.get<ApiData<RewardPointsByDay[]>>(
        "/api/rewards/points-by-day",
        { params: { days } },
      );

      return response.data.data;
    },
  });
}
