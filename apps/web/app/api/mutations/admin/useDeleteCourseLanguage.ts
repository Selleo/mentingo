import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { COURSE_QUERY_KEY } from "~/api/queries/admin/useBetaCourse";
import { COURSE_TRANSLATIONS_QUERY_KEY } from "~/api/queries/admin/useHasMissingTranslations";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";

import type { SupportedLanguages } from "@repo/shared";
import type { AxiosError } from "axios";

export type DeleteCourseLanguageType = {
  courseId: string;
  language: SupportedLanguages;
};

export function useDeleteCourseLanguage() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (options: DeleteCourseLanguageType) => {
      const { language, courseId } = options;

      const response = await ApiClient.api.courseControllerDeleteLanguage(courseId, { language });

      return response.data;
    },
    onSuccess: async (_, variables) => {
      const { courseId } = variables;

      toast({ description: t("adminCourseView.toast.successfullyDeletedLanguage") });

      await queryClient.invalidateQueries({
        queryKey: [COURSE_QUERY_KEY],
      });

      await queryClient.invalidateQueries({
        queryKey: [COURSE_TRANSLATIONS_QUERY_KEY, { id: courseId }],
      });
    },
    onError: (error: AxiosError) => {
      const apiResponseData = error.response?.data as { message: string };
      toast({
        description: t(apiResponseData.message),
        variant: "destructive",
      });
    },
  });
}
