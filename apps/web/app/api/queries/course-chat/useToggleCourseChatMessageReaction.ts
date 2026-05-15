import { useMutation } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import { updateMessageReactionsInCache } from "./courseChatCache";

import type { ToggleMessageReactionBody } from "~/api/generated-api";

export function useToggleCourseChatMessageReaction() {
  return useMutation({
    mutationFn: async ({
      messageId,
      reaction,
    }: {
      messageId: string;
      reaction: ToggleMessageReactionBody["reaction"];
    }) => {
      const response = await ApiClient.api.courseChatControllerToggleMessageReaction(messageId, {
        reaction,
      });

      return response.data.data;
    },
    onSuccess: (payload) => {
      updateMessageReactionsInCache(payload);
    },
  });
}
