import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { invalidateLiveTrainingData } from "~/api/utils/invalidateLiveTrainingData";
import { useToast } from "~/components/ui/use-toast";

import type { AxiosError } from "axios";

type DeleteLiveTrainingOptions = {
  id: string;
};

export function useDeleteLiveTraining() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({ id }: DeleteLiveTrainingOptions) => {
      await ApiClient.api.liveTrainingControllerDeleteLiveTraining(id);
    },
    onSuccess: () => {
      void invalidateLiveTrainingData({
        includeCalendar: true,
        includeCoursesAndLessons: true,
      });

      toast({
        variant: "default",
        description: t("liveTrainingView.deleteDialog.toast.success"),
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
