import { useMutation } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";
import { assistantThreadsKey } from "~/api/queries/assistant/useAssistantThreads";
import { queryClient } from "~/api/queryClient";

export function useCreateAssistantThread() {
  return useMutation({
    retry: false,
    mutationFn: async (body: Parameters<typeof ApiClient.api.assistantControllerCreateThread>[0]) =>
      (await ApiClient.api.assistantControllerCreateThread(body)).data.data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: assistantThreadsKey }),
  });
}
