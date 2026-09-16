import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

export function useLiveTrainingRegistrations(id: string, enabled: boolean) {
  return useQuery({
    queryKey: ["live-training-registrations", id],
    queryFn: async () => (await ApiClient.api.liveTrainingControllerGetRegistrations(id)).data.data,
    enabled,
    refetchInterval: enabled ? 5000 : false,
  });
}
