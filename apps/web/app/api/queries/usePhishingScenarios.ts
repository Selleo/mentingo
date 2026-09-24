import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";
export function usePhishingScenarios(enabled = true) {
  return useQuery({
    queryKey: ["phishing", "scenarios"],
    queryFn: async () => (await ApiClient.api.phishingControllerListPhishingScenarios()).data.data,
    enabled,
    staleTime: 30000,
  });
}
