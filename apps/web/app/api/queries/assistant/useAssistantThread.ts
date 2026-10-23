import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

export const assistantThreadKey = (threadId: string) => ["assistant", "thread", threadId] as const;
export function useAssistantThread(threadId: string) {
  return useQuery({
    queryKey: assistantThreadKey(threadId),
    queryFn: async () => (await ApiClient.api.assistantControllerGetThread(threadId)).data.data,
    enabled: Boolean(threadId),
    staleTime: 0,
    retry: false,
  });
}
