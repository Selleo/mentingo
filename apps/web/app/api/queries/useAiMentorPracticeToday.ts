import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

export const getBrowserTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

export function useAiMentorPracticeToday() {
  const timezone = getBrowserTimezone();

  return useQuery({
    queryKey: ["aiMentorPractice", "today", timezone],
    queryFn: async () => {
      const response = await ApiClient.api.aiControllerGetTodayPractice({ timezone });
      return response.data.data;
    },
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "queued" || status === "processing" ? 2000 : false;
    },
  });
}
