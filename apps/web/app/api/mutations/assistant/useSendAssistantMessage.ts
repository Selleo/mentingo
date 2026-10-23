import { useMutation } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";
import { assistantMessagesKey } from "~/api/queries/assistant/useAssistantMessages";
import { assistantThreadKey } from "~/api/queries/assistant/useAssistantThread";
import { assistantThreadsKey } from "~/api/queries/assistant/useAssistantThreads";
import { queryClient } from "~/api/queryClient";

export function useSendAssistantMessage() {
  return useMutation({
    retry: false,
    mutationFn: async ({
      threadId,
      body,
    }: {
      threadId: string;
      body: Parameters<typeof ApiClient.api.assistantControllerSendMessage>[1];
    }) => (await ApiClient.api.assistantControllerSendMessage(threadId, body)).data.data,
    onSuccess: async (result, { threadId }) => {
      const messagesKey = assistantMessagesKey(threadId);
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
        queryClient.invalidateQueries({ queryKey: assistantMessagesKey(threadId) }),
        queryClient.invalidateQueries({ queryKey: assistantThreadKey(threadId) }),
        queryClient.invalidateQueries({ queryKey: assistantThreadsKey }),
      ]);
    },
  });
}
