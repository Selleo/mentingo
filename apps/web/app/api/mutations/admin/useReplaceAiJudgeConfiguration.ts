import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { AI_JUDGE_CONFIGURATION_QUERY_KEY } from "~/api/queries/admin/useAiJudgeConfiguration";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

import type { SupportedLanguages } from "@repo/shared";
import type { ReplaceConfigurationBody } from "~/api/generated-api";

type ReplaceAiJudgeConfigurationOptions = {
  lessonId: string;
  language: SupportedLanguages;
  data: ReplaceConfigurationBody;
};

export const useReplaceAiJudgeConfiguration = () => {
  const { t } = useTranslation();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ lessonId, data }: ReplaceAiJudgeConfigurationOptions) => {
      const response = await ApiClient.api.aiJudgeConfigurationControllerReplaceConfiguration(
        lessonId,
        data,
      );
      return response.data.data;
    },
    onSuccess: async (_configuration, { lessonId }) => {
      await queryClient.invalidateQueries({
        queryKey: [...AI_JUDGE_CONFIGURATION_QUERY_KEY, lessonId],
      });
      toast({
        description: t("adminCourseView.curriculum.lesson.aiJudge.configurationSavedSuccessfully"),
      });
    },
    onError: (error) => {
      toast({
        description: getTranslatedApiErrorMessage(error, t, t("common.toast.somethingWentWrong")),
        variant: "destructive",
      });
    },
  });
};
