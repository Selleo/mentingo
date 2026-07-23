import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { AI_JUDGE_CONFIGURATION_QUERY_KEY } from "~/api/queries/admin/useAiJudgeConfiguration";
import { COURSE_TRANSLATIONS_QUERY_KEY } from "~/api/queries/admin/useHasMissingTranslations";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

import type { SupportedLanguages } from "@repo/shared";
import type { UpdateTranslationsBody } from "~/api/generated-api";

type UpdateAiJudgeConfigurationTranslationOptions = {
  courseId: string;
  lessonId: string;
  language: SupportedLanguages;
  data: UpdateTranslationsBody;
};

export const invalidateAiJudgeTranslationQueries = async ({
  courseId,
  lessonId,
  language,
}: Pick<UpdateAiJudgeConfigurationTranslationOptions, "courseId" | "language" | "lessonId">) => {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: [...AI_JUDGE_CONFIGURATION_QUERY_KEY, lessonId],
    }),
    queryClient.invalidateQueries({
      queryKey: [COURSE_TRANSLATIONS_QUERY_KEY, { id: courseId, language }],
    }),
  ]);
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
    onSuccess: async (_configuration, { courseId, language, lessonId }) => {
      await invalidateAiJudgeTranslationQueries({ courseId, language, lessonId });
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
