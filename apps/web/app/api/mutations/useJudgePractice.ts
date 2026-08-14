import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { toast } from "~/components/ui/use-toast";

import { getCurrentThreadMessagesQueryKey } from "../queries/useCurrentThreadMessages";

export function useJudgePractice(practiceId: string) {
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({ threadId }: { threadId: string }) => {
      const response = await ApiClient.api.aiControllerJudgeThread(threadId);
      return response.data;
    },
    onError: (error) => {
      toast({
        description: getTranslatedApiErrorMessage(error, t, t("common.toast.somethingWentWrong")),
        variant: "destructive",
      });
    },
    onSuccess: async (_, { threadId }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["aiMentorPractice", practiceId] }),
        queryClient.invalidateQueries({ queryKey: ["aiMentorPractice", "today"] }),
        queryClient.invalidateQueries({ queryKey: getCurrentThreadMessagesQueryKey(threadId) }),
      ]);
    },
  });
}
