import { useMutation } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import { invalidateCourseChatMessageCreated } from "./courseChatCache";

import type { CreateMessageBody } from "~/api/generated-api";

export function useCreateCourseChatMessage(courseId: string) {
  return useMutation({
    mutationFn: async (payload: CreateMessageBody) => {
      const response = await ApiClient.api.courseChatControllerCreateMessage(courseId, payload);

      return response.data.data;
    },
    onSuccess: (message) => {
      invalidateCourseChatMessageCreated({
        courseId: message.courseId,
        parentMessageId: message.parentMessageId,
      });
    },
  });
}
