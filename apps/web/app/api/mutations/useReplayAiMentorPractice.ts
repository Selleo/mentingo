import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { getAiMentorPracticeQueryKey } from "~/api/queries/useAiMentorPractice";
import { getAiMentorPracticeTodayQueryKey } from "~/api/queries/useAiMentorPracticeToday";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { toast } from "~/components/ui/use-toast";

export function useReplayAiMentorPractice(practiceId: string) {
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async () => {
      const response = await ApiClient.api.aiControllerReplayPractice(practiceId);
      return response.data.data;
    },
    onError: (error) => {
      toast({
        description: getTranslatedApiErrorMessage(error, t, t("common.toast.somethingWentWrong")),
        variant: "destructive",
      });
    },
    onSuccess: (practice) => {
      queryClient.setQueryData(getAiMentorPracticeQueryKey(practiceId), practice);
      queryClient.setQueryData(getAiMentorPracticeTodayQueryKey(), practice);
    },
  });
}
