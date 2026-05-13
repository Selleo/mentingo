import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { RESOURCE_LIBRARY_ASSETS_QUERY_KEY } from "~/api/queries/useResourceLibraryAssets";
import { useToast } from "~/components/ui/use-toast";

import type { SupportedLanguages } from "@repo/shared";
import type { AxiosError } from "axios";
import type { ApiErrorResponse } from "~/api/types";

export type LessonFileUploadOptions = {
  lessonId?: string;
  contextId?: string;
  file: File;
  language: SupportedLanguages;
  title: string;
  description: string;
};

export function useLessonFileUpload() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (options: LessonFileUploadOptions) => {
      const formData = new FormData();

      formData.append("file", options.file);
      formData.append("language", options.language);
      formData.append("title", options.title);
      formData.append("description", options.description);

      if (options.lessonId) {
        formData.append("lessonId", options.lessonId);
      }

      if (options.contextId) {
        formData.append("contextId", options.contextId);
      }

      const response = await ApiClient.api.lessonControllerUploadFileToLesson(options, {
        headers: { "Content-Type": "multipart/form-data" },
        transformRequest: () => {
          return formData;
        },
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RESOURCE_LIBRARY_ASSETS_QUERY_KEY });
    },
    onError: (error: AxiosError) => {
      const apiResponseData = error.response?.data as ApiErrorResponse;

      toast({
        description: t(apiResponseData.message),
        variant: "destructive",
      });
    },
  });
}
