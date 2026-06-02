import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { invalidateLiveTrainingData } from "~/api/utils/invalidateLiveTrainingData";
import { useToast } from "~/components/ui/use-toast";

import type { LiveTrainingResourceRelationshipType, SupportedLanguages } from "@repo/shared";
import type { AxiosError } from "axios";

type UploadLiveTrainingResourceOptions = {
  liveTrainingId: string;
  file: File;
  relationshipType: LiveTrainingResourceRelationshipType;
  language: SupportedLanguages;
};

export function useUploadLiveTrainingResource() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({
      liveTrainingId,
      file,
      relationshipType,
      language,
    }: UploadLiveTrainingResourceOptions) => {
      const response = await ApiClient.api.liveTrainingControllerUploadLiveTrainingResource(
        liveTrainingId,
        {
          file,
          relationshipType,
          language,
        },
      );

      return response.data;
    },
    onSuccess: async () => {
      await invalidateLiveTrainingData({ includeCoursesAndLessons: true });

      toast({
        variant: "default",
        description: t("liveTrainingView.files.toast.uploaded"),
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
