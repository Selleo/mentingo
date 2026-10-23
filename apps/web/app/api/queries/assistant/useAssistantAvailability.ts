import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

export function useAssistantAvailability() {
  return useQuery({
    queryKey: ["assistant", "availability"],
    queryFn: async () => (await ApiClient.api.assistantControllerGetAvailability()).data.data,
    staleTime: 30_000,
  });
}
