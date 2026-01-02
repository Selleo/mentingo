import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { useToast } from "~/components/ui/use-toast";

import type { SupportedLanguages } from "@repo/shared";
import type { AxiosError } from "axios";

export type LessonFileUploadOptions = {
  lessonId: string;
  file: File;
  language: SupportedLanguages;
  title: string;
  description: string;
};

export function useLessonFileUpload() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (options: LessonFileUploadOptions) => {
      const formData = new FormData();

      formData.append("file", options.file);
      formData.append("lessonId", options.lessonId);
      formData.append("language", options.language);
      formData.append("title", options.title);
      formData.append("description", options.description);

      const response = await ApiClient.api.lessonControllerUploadImageToLesson(options, {
        headers: { "Content-Type": "multipart/form-data" },
        transformRequest: () => {
          return formData;
        },
      });
      return response.data;
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
