import { useMutation } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";
import {
  captureAssistantSession,
  inAssistantSession,
  useAssistantScope,
} from "~/api/assistantIdentity";
import { assistantMessagesKey } from "~/api/queries/assistant/useAssistantMessages";
import { assistantThreadKey } from "~/api/queries/assistant/useAssistantThread";
import { assistantThreadsKey } from "~/api/queries/assistant/useAssistantThreads";
import { queryClient } from "~/api/queryClient";

export function useSendAssistantMessage() {
  const scope = useAssistantScope();
  return useMutation({
    onMutate: () => captureAssistantSession(scope),
    retry: false,
    mutationFn: async ({
      threadId,
      body,
    }: {
      threadId: string;
      body: Parameters<typeof ApiClient.api.assistantControllerSendMessage>[1];
    }) =>
      inAssistantSession(
        scope,
        async () => (await ApiClient.api.assistantControllerSendMessage(threadId, body)).data.data,
      ),
    onSuccess: async (result, { threadId }, session) => {
      session!.assertCurrent();
      const scope = session!.scope;
      const messagesKey = assistantMessagesKey(threadId, scope);
      // A newly created thread has no mounted transcript query until navigation.
      // Never replace an existing cache: it may already contain newer streamed output.
      if (queryClient.getQueryData(messagesKey) === undefined) {
        queryClient.setQueryData(messagesKey, {
          pages: [
            {
              items: [result.userMessage, result.assistantMessage],
              page: 1,
              perPage: 50,
              totalItems: 2,
              latestRun: result.run,
            },
          ],
          pageParams: [1],
        });
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: assistantMessagesKey(threadId, scope) }),
        queryClient.invalidateQueries({ queryKey: assistantThreadKey(threadId, scope) }),
        queryClient.invalidateQueries({ queryKey: assistantThreadsKey(scope) }),
      ]);
      session!.assertCurrent();
    },
  });
}
