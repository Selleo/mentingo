import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { useToast } from "~/components/ui/use-toast";

import type { SupportedLanguages } from "@repo/shared";

type UploadArticleFileOptions = {
  id: string;
  file: File;
  language: SupportedLanguages;
  title: string;
  description: string;
};

export function useUploadArticleFile() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({ id, file, language, title, description }: UploadArticleFileOptions) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("language", language);
      formData.append("title", title);
      formData.append("description", description);

      const response = await ApiClient.api.articlesControllerUploadFileToArticle(
        id,
        { file, language, title, description },
        {
          transformRequest: () => formData,
          headers: { "Content-Type": "multipart/form-data" },
        },
      );

      return response.data;
    },
    onError: (error) => {
      toast({
        description: error instanceof Error ? error.message : t("common.toast.somethingWentWrong"),
        variant: "destructive",
      });
    },
  });
}
