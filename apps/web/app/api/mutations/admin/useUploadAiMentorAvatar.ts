import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { useToast } from "~/components/ui/use-toast";

import type { AxiosError } from "axios";

type AiMentorAvatarOptions = {
  lessonId: string;
  file: File | null;
};

export function useUploadAiMentorAvatar() {
  const { t } = useTranslation();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (options: AiMentorAvatarOptions) => {
      const formData = new FormData();

      if (options.file) {
        formData.append("file", options.file);
      }

      formData.append("lessonId", options.lessonId);

      const response = await ApiClient.api.lessonControllerUploadAiMentorAvatar(
        {
          lessonId: options.lessonId,
          file: options.file,
        },
        {
          headers: { "Content-Type": "multipart/form-data" },
          transformRequest: () => formData,
        },
      );

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
