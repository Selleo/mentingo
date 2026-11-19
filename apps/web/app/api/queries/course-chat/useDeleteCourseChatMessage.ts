import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

import { updateDeletedMessageInCache } from "./courseChatCache";

export function useDeleteCourseChatMessage() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (messageId: string) => {
      const response = await ApiClient.api.courseChatControllerDeleteMessage(messageId);

      return response.data.data;
    },
    onSuccess: (payload) => {
      updateDeletedMessageInCache(payload);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(
          error,
          t,
          t("studentCourseView.courseChat.deleteError"),
          { allowUntranslatedMessage: false },
        ),
      });
    },
  });
}
