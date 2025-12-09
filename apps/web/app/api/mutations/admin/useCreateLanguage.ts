import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { COURSE_QUERY_KEY } from "~/api/queries/admin/useBetaCourse";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";

import type { SupportedLanguages } from "@repo/shared";
import type { AxiosError } from "axios";

type CreateLanguageOptions = {
  language: SupportedLanguages;
  courseId: string;
};

export function useCreateLanguage() {
  const { t } = useTranslation();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (options: CreateLanguageOptions) => {
      const { courseId, language } = options;

      const response = await ApiClient.api.courseControllerCreateLanguage(courseId, { language });

      return response.data;
    },
    onSuccess: async () => {
      toast({ description: t("adminCourseView.createLanguage.success") });

      await queryClient.invalidateQueries({ queryKey: [COURSE_QUERY_KEY] });
    },
    onError: (error: AxiosError) => {
      const { message } = error.response?.data as { message: string };

      toast({ description: t(message), variant: "destructive" });
    },
  });
}
