import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { AI_JUDGE_CONFIGURATION_QUERY_KEY } from "~/api/queries/admin/useAiJudgeConfiguration";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

import type { SupportedLanguages } from "@repo/shared";
import type { UpdateTranslationsBody } from "~/api/generated-api";

type UpdateAiJudgeConfigurationTranslationOptions = {
  lessonId: string;
  language: SupportedLanguages;
  data: UpdateTranslationsBody;
};

export const useUpdateAiJudgeConfigurationTranslation = () => {
  const { t } = useTranslation();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      lessonId,
      language,
      data,
    }: UpdateAiJudgeConfigurationTranslationOptions) => {
      const response = await ApiClient.api.aiJudgeConfigurationControllerUpdateTranslations(
        lessonId,
        language,
        data,
      );
      return response.data.data;
    },
    onSuccess: async (_configuration, { lessonId }) => {
      await queryClient.invalidateQueries({
        queryKey: [...AI_JUDGE_CONFIGURATION_QUERY_KEY, lessonId],
      });
      toast({
        description: t("adminCourseView.curriculum.lesson.aiJudge.translationSavedSuccessfully"),
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
