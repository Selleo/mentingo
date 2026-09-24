import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";
export function usePhishingCampaigns(enabled = true) {
  return useQuery({
    queryKey: ["phishing", "campaigns"],
    queryFn: async () => (await ApiClient.api.phishingControllerListPhishingCampaigns()).data.data,
    enabled,
    staleTime: 30000,
  });
}
