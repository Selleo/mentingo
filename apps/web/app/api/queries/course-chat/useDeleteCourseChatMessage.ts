import { useMutation } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import { updateDeletedMessageInCache } from "./courseChatCache";

export function useDeleteCourseChatMessage() {
  return useMutation({
    mutationFn: async (messageId: string) => {
      const response = await ApiClient.api.courseChatControllerDeleteMessage(messageId);

      return response.data.data;
    },
    onSuccess: (payload) => {
      updateDeletedMessageInCache(payload);
    },
  });
}
