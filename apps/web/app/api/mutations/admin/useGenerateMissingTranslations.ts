import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { AI_JUDGE_CONFIGURATION_QUERY_KEY } from "~/api/queries/admin/useAiJudgeConfiguration";
import { COURSE_QUERY_KEY } from "~/api/queries/admin/useBetaCourse";
import { COURSE_TRANSLATIONS_QUERY_KEY } from "~/api/queries/admin/useHasMissingTranslations";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

import type { SupportedLanguages } from "@repo/shared";

type GenerateTranslationsOptions = {
  courseId: string;
  language: SupportedLanguages;
};

export const invalidateGeneratedTranslationQueries = async ({
  courseId,
  language,
}: GenerateTranslationsOptions) => {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: [COURSE_QUERY_KEY, { id: courseId, language }],
    }),
    queryClient.invalidateQueries({
      queryKey: [COURSE_TRANSLATIONS_QUERY_KEY, { id: courseId, language }],
    }),
    queryClient.invalidateQueries({
      queryKey: AI_JUDGE_CONFIGURATION_QUERY_KEY,
    }),
  ]);
};

export default function useGenerateMissingTranslations() {
  const { t } = useTranslation();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (options: GenerateTranslationsOptions) => {
      const { courseId, language } = options;

      const response = await ApiClient.api.courseControllerGenerateTranslations(courseId, {
        language,
      });

      return response.data;
    },
    onSuccess: async (_, variables) => {
      await invalidateGeneratedTranslationQueries(variables);

      toast({
        description: t("adminCourseView.toast.translationsGeneratedSuccessfully"),
      });
    },
    onError: (error) => {
      toast({
        description: getTranslatedApiErrorMessage(error, t, t("common.toast.somethingWentWrong")),
        variant: "destructive",
      });
    },
  });
}
