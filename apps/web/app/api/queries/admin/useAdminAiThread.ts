import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import type { SupportedLanguages } from "@repo/shared";

export function useAdminAiThread(threadId: string, language: SupportedLanguages) {
  return useQuery({
    queryKey: ["admin-ai-thread", threadId, language],
    queryFn: async () =>
      (await ApiClient.api.adminAiThreadsControllerGetAdminAiThreadDetails(threadId, { language }))
        .data.data,
  });
}
