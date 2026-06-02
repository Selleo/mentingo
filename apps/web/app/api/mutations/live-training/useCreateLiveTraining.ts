import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { invalidateLiveTrainingData } from "~/api/utils/invalidateLiveTrainingData";
import { useToast } from "~/components/ui/use-toast";

import type { CreateLiveTrainingBody } from "~/api/generated-api";

export function useCreateLiveTraining() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (data: CreateLiveTrainingBody) => {
      const response = await ApiClient.api.liveTrainingControllerCreateLiveTraining(data);
      return response.data;
    },
    onSuccess: async () => {
      await invalidateLiveTrainingData({ includeCalendar: true });
      toast({
        variant: "default",
        description: t("calendarView.create.toast.success"),
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(error, t, t("common.toast.somethingWentWrong")),
      });
    },
  });
}
