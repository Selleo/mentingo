import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { AI_MENTOR_CONFIGURATION_QUERY_KEY } from "~/api/queries/admin/useAiMentorConfiguration";
import { COURSE_TRANSLATIONS_QUERY_KEY } from "~/api/queries/admin/useHasMissingTranslations";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

import type { SupportedLanguages } from "@repo/shared";
import type { UpdateAiMentorConfigurationTranslationsBody } from "~/api/generated-api";

type UpdateAiMentorConfigurationTranslationOptions = {
  courseId: string;
  lessonId: string;
  language: SupportedLanguages;
  data: UpdateAiMentorConfigurationTranslationsBody;
};

export const useUpdateAiMentorConfigurationTranslation = () => {
  const { t } = useTranslation();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      lessonId,
      language,
      data,
    }: UpdateAiMentorConfigurationTranslationOptions) => {
      const response =
        await ApiClient.api.aiMentorConfigurationControllerUpdateAiMentorConfigurationTranslations(
          lessonId,
          language,
          data,
        );
      return response.data.data;
    },
    onSuccess: async (_configuration, { courseId, language, lessonId }) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [...AI_MENTOR_CONFIGURATION_QUERY_KEY, lessonId],
        }),
        queryClient.invalidateQueries({
          queryKey: [COURSE_TRANSLATIONS_QUERY_KEY, { id: courseId, language }],
        }),
      ]);
      toast({
        description: t("adminCourseView.curriculum.lesson.aiMentorConfiguration.translationSaved"),
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
