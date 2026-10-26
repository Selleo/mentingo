import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";
import { inAssistantSession, useAssistantScope } from "~/api/assistantIdentity";

export function useAssistantAvailability() {
  const scope = useAssistantScope();
  return useQuery({
    queryKey: [...(scope ?? ["assistant", "anonymous"]), "availability"],
    enabled: Boolean(scope),
    queryFn: () =>
      inAssistantSession(
        scope,
        async () => (await ApiClient.api.assistantControllerGetAvailability()).data.data,
      ),
    staleTime: 30_000,
  });
}
