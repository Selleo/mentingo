import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

import { invalidateCourseChatMessageCreated } from "./courseChatCache";

import type { CreateMessageBody } from "~/api/generated-api";

export function useCreateCourseChatMessage(courseId: string) {
  const { toast } = useToast();
  const { t } = useTranslation();

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
    onError: (error) => {
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(
          error,
          t,
          t("studentCourseView.courseChat.sendError"),
          { allowUntranslatedMessage: false },
        ),
      });
    },
  });
}
