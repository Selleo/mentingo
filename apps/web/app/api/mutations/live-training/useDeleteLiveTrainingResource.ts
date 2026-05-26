import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { invalidateLiveTrainingData } from "~/api/utils/invalidateLiveTrainingData";
import { useToast } from "~/components/ui/use-toast";

import type { SupportedLanguages } from "@repo/shared";
import type { AxiosError } from "axios";

type DeleteLiveTrainingResourceOptions = {
  liveTrainingId: string;
  resourceId: string;
  language: SupportedLanguages;
};

export function useDeleteLiveTrainingResource() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({
      liveTrainingId,
      resourceId,
      language,
    }: DeleteLiveTrainingResourceOptions) => {
      const response = await ApiClient.api.liveTrainingControllerDeleteLiveTrainingResource(
        liveTrainingId,
        resourceId,
        { language },
      );

      return response.data;
    },
    onSuccess: async () => {
      await invalidateLiveTrainingData({ includeCoursesAndLessons: true });

      toast({
        variant: "default",
        description: t("liveTrainingView.files.toast.removed"),
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
