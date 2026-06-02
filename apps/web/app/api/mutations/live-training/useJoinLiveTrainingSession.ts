import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { invalidateLiveTrainingData } from "~/api/utils/invalidateLiveTrainingData";
import { useToast } from "~/components/ui/use-toast";

import type { SupportedLanguages } from "@repo/shared";
import type { AxiosError } from "axios";

type JoinLiveTrainingSessionOptions = {
  liveTrainingId: string;
  language: SupportedLanguages;
};

export function useJoinLiveTrainingSession() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({ liveTrainingId, language }: JoinLiveTrainingSessionOptions) => {
      const response = await ApiClient.api.liveTrainingSessionsControllerJoinCurrentSession(
        liveTrainingId,
        { language },
      );

      return response.data.data;
    },
    onSuccess: async () => {
      await invalidateLiveTrainingData({ includeSessions: true });
    },
    onError: (error: AxiosError) => {
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(error, t, t("common.toast.somethingWentWrong")),
      });
    },
  });
}
