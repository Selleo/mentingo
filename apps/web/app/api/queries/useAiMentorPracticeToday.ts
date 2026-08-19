import { AI_MENTOR_PRACTICE_STATUSES } from "@repo/shared";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { queryClient } from "~/api/queryClient";

import { ApiClient } from "../api-client";

import { getAiMentorPracticeQueryKey } from "./useAiMentorPractice";
import { getCurrentThreadMessagesQueryKey } from "./useCurrentThreadMessages";

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

  const query = useQuery({
    queryKey: getAiMentorPracticeTodayQueryKey(utcDate),
    queryFn: async () => {
      const response = await ApiClient.api.aiControllerGetTodayPractice();
      const practice = response.data.data;

      if (practice) {
        queryClient.setQueryData(getAiMentorPracticeQueryKey(practice.id), practice);
      }

      return practice;
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

  useEffect(() => {
    const threadId = query.data?.threadId;
    if (!threadId) return;

    void queryClient.invalidateQueries({
      queryKey: getCurrentThreadMessagesQueryKey(threadId),
    });
  }, [query.data?.status, query.data?.threadId]);

  return query;
}
