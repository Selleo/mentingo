import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";
export function usePhishingConfiguration(enabled = true) {
  return useQuery({
    queryKey: ["phishing", "configuration"],
    queryFn: async () =>
      (await ApiClient.api.phishingControllerGetPhishingConfiguration()).data.data,
    enabled,
    staleTime: 30000,
  });
}
