import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";
import {
  currentAssistantScope,
  inAssistantSession,
  useAssistantScope,
  type AssistantScope,
} from "~/api/assistantIdentity";

export const assistantThreadKey = (
  threadId: string,
  scope: AssistantScope | undefined = currentAssistantScope(),
) => [...(scope ?? ["assistant", "anonymous"]), "thread", threadId] as const;
export function useAssistantThread(threadId: string) {
  const scope = useAssistantScope();
  return useQuery({
    queryKey: assistantThreadKey(threadId, scope),
    queryFn: () =>
      inAssistantSession(
        scope,
        async () => (await ApiClient.api.assistantControllerGetThread(threadId)).data.data,
      ),
    enabled: Boolean(threadId && scope),
    staleTime: 0,
    retry: false,
  });
}
