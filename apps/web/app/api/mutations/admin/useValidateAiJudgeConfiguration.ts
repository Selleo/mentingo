import { useMutation } from "@tanstack/react-query";
import { isCancel } from "axios";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

import type { ValidateConfigurationBody } from "~/api/generated-api";

export const useValidateAiJudgeConfiguration = () => {
  const { t } = useTranslation();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      data,
      signal,
    }: {
      data: ValidateConfigurationBody;
      signal?: AbortSignal;
    }) => {
      const response =
        await ApiClient.api.aiJudgeConfigurationGenerationControllerValidateConfiguration(data, {
          signal,
        });

      return response.data.data;
    },
    onError: (error) => {
      if (isCancel(error)) return;

      toast({
        description: getTranslatedApiErrorMessage(error, t, t("common.toast.somethingWentWrong")),
        variant: "destructive",
      });
    },
  });
};
