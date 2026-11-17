import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

import { updateMessageReactionsInCache } from "./courseChatCache";

import type { ToggleMessageReactionBody } from "~/api/generated-api";

export function useToggleCourseChatMessageReaction() {
  const { toast } = useToast();
  const { t } = useTranslation();

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
    onError: (error) => {
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(
          error,
          t,
          t("studentCourseView.courseChat.reactionError"),
          { allowUntranslatedMessage: false },
        ),
      });
    },
  });
}
