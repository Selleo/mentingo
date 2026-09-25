import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

export function useMcpConsent(consent: string | null) {
  return useQuery({
    queryKey: ["mcpConsent", consent],
    queryFn: async () => {
      const response = await ApiClient.api.mcpConsentControllerGetConsent(consent!);
      return response.data.data;
    },
    enabled: Boolean(consent),
    retry: false,
    staleTime: 0,
  });
}
