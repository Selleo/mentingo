import { AI_MENTOR_PRACTICE_STATUSES } from "@repo/shared";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { ApiClient } from "../api-client";

export const getAiMentorPracticeTodayQueryKey = (
  utcDate: string = new Date().toISOString().slice(0, 10),
) => ["aiMentorPractice", "today", utcDate] as const;

export function useAiMentorPracticeToday() {
  const [utcDate, setUtcDate] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    const now = new Date();
    const nextUtcDate = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
    const timeout = window.setTimeout(
      () => {
        setUtcDate(new Date().toISOString().slice(0, 10));
      },
      nextUtcDate - now.getTime() + 1000,
    );

    return () => window.clearTimeout(timeout);
  }, [utcDate]);

  return useQuery({
    queryKey: getAiMentorPracticeTodayQueryKey(utcDate),
    queryFn: async () => {
      const response = await ApiClient.api.aiControllerGetTodayPractice();
      return response.data.data;
    },
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === AI_MENTOR_PRACTICE_STATUSES.QUEUED ||
        status === AI_MENTOR_PRACTICE_STATUSES.PROCESSING
        ? 2000
        : false;
    },
    staleTime: 0,
    refetchOnMount: "always",
  });
}
