import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { invalidateLiveTrainingData } from "~/api/utils/invalidateLiveTrainingData";
import { useToast } from "~/components/ui/use-toast";

import type { AxiosError } from "axios";
import type { UpdateLiveTrainingBody } from "~/api/generated-api";

type UpdateLiveTrainingOptions = {
  id: string;
  data: UpdateLiveTrainingBody;
};

export function useUpdateLiveTraining() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({ id, data }: UpdateLiveTrainingOptions) => {
      const response = await ApiClient.api.liveTrainingControllerUpdateLiveTraining(id, data);

      return response.data;
    },
    onSuccess: async () => {
      await invalidateLiveTrainingData({
        includeCalendar: true,
        includeCoursesAndLessons: true,
        includeHostCandidates: true,
      });

      toast({
        variant: "default",
        description: t("liveTrainingView.edit.toast.success"),
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
