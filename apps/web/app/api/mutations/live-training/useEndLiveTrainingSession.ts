import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { invalidateLiveTrainingData } from "~/api/utils/invalidateLiveTrainingData";
import { useToast } from "~/components/ui/use-toast";

import type { SupportedLanguages } from "@repo/shared";
import type { AxiosError } from "axios";

type EndLiveTrainingSessionOptions = {
  liveTrainingId: string;
  sessionId: string;
  language: SupportedLanguages;
};

export function useEndLiveTrainingSession() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({ liveTrainingId, sessionId, language }: EndLiveTrainingSessionOptions) => {
      const response = await ApiClient.api.liveTrainingSessionsControllerEndSession(
        liveTrainingId,
        sessionId,
        { language },
      );

      return response.data.data;
    },
    onSuccess: async () => {
      await invalidateLiveTrainingData({
        includeCalendar: true,
        includeCoursesAndLessons: true,
        includeSessions: true,
      });

      toast({
        variant: "default",
        description: t("liveTrainingView.sessions.toast.ended"),
      });
    },
    onError: (error: AxiosError) => {
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(error, t, t("common.toast.somethingWentWrong")),
      });
    },
  });
}
