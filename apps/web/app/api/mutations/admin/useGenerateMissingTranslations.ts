import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { COURSE_QUERY_KEY } from "~/api/queries/admin/useBetaCourse";
import { COURSE_TRANSLATIONS_QUERY_KEY } from "~/api/queries/admin/useHasMissingTranslations";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";

import type { SupportedLanguages } from "@repo/shared";
import type { AxiosError } from "axios";

type GenerateTranslationsOptions = {
  courseId: string;
  language: SupportedLanguages;
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
      const { courseId, language } = variables;

      await queryClient.invalidateQueries({
        queryKey: [COURSE_QUERY_KEY, { id: courseId, language }],
      });

      await queryClient.invalidateQueries({
        queryKey: [COURSE_TRANSLATIONS_QUERY_KEY, { id: courseId, language }],
      });

      toast({
        description: t("adminCourseView.toast.translationsGeneratedSuccessfully"),
      });
    },
    onError: (error: AxiosError) => {
      const { message } = error.response?.data as { message: string };

      toast({ description: t(message), variant: "destructive" });
    },
  });
}
