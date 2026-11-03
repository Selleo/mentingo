import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

type Audience = Parameters<typeof ApiClient.api.phishingControllerCountPhishingAudience>[0];

export function usePhishingAudienceCount(audience: Audience | null) {
  return useQuery({
    queryKey: ["phishing", "audience", audience],
    queryFn: async () =>
      (
        await ApiClient.api.phishingControllerCountPhishingAudience({
          userIds: audience!.userIds,
          groupIds: audience!.groupIds,
        })
      ).data.data.count,
    enabled: !!audience,
  });
}
