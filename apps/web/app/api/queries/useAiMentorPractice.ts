import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

export function useAiMentorPractice(id: string) {
  return useQuery({
    queryKey: ["aiMentorPractice", id],
    queryFn: async () => {
      const response = await ApiClient.api.aiControllerGetPractice(id);
      return response.data.data;
    },
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "queued" || status === "processing" ? 2000 : false;
    },
  });
}
