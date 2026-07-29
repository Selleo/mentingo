import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

import type { GenerateAiMentorConfigurationBody } from "~/api/generated-api";

export const useStartAiMentorConfigurationGeneration = () => {
  const { t } = useTranslation();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: GenerateAiMentorConfigurationBody) =>
      (
        await ApiClient.api.aiMentorConfigurationGenerationControllerGenerateAiMentorConfiguration(
          data,
        )
      ).data.data,
    onError: (error) => {
      toast({
        description: getTranslatedApiErrorMessage(error, t, t("common.toast.somethingWentWrong")),
        variant: "destructive",
      });
    },
  });
};
