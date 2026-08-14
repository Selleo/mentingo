import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { RESOURCE_LIBRARY_ASSETS_QUERY_KEY } from "~/api/queries/useResourceLibraryAssets";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

import type { EditableResourceVisibility, SupportedLanguages } from "@repo/shared";

type UploadArticleFileOptions = {
  id: string;
  file: File;
  language: SupportedLanguages;
  title: string;
  description: string;
  visibility?: EditableResourceVisibility;
};

export function useUploadArticleFile() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({
      id,
      file,
      language,
      title,
      description,
      visibility,
    }: UploadArticleFileOptions) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("language", language);
      formData.append("title", title);
      formData.append("description", description);
      if (visibility) formData.append("visibility", visibility);

      const response = await ApiClient.api.articlesControllerUploadFileToArticle(
        id,
        { file, language, title, description, visibility },
        {
          transformRequest: () => formData,
          headers: { "Content-Type": "multipart/form-data" },
        },
      );

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RESOURCE_LIBRARY_ASSETS_QUERY_KEY });
    },
    onError: (error) => {
      toast({
        description: getTranslatedApiErrorMessage(error, t, t("common.toast.somethingWentWrong")),
        variant: "destructive",
      });
    },
  });
}
