import { useMutation } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";
import {
  captureAssistantSession,
  inAssistantSession,
  useAssistantScope,
} from "~/api/assistantIdentity";
import { assistantThreadsKey } from "~/api/queries/assistant/useAssistantThreads";
import { queryClient } from "~/api/queryClient";

export function useCreateAssistantThread() {
  const scope = useAssistantScope();
  return useMutation({
    onMutate: () => captureAssistantSession(scope),
    retry: false,
    mutationFn: async (body: Parameters<typeof ApiClient.api.assistantControllerCreateThread>[0]) =>
      inAssistantSession(
        scope,
        async () => (await ApiClient.api.assistantControllerCreateThread(body)).data.data,
      ),
    onSuccess: async (_result, _body, session) => {
      session!.assertCurrent();
      await queryClient.invalidateQueries({ queryKey: assistantThreadsKey(session!.scope) });
      session!.assertCurrent();
    },
  });
}
