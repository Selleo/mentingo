import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { useToast } from "~/components/ui/use-toast";

import type { AxiosError } from "axios";
import type { GenerateArticlePreviewBody } from "~/api/generated-api";

export function usePreviewArticle() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (data: GenerateArticlePreviewBody) => {
      const response = await ApiClient.api.articlesControllerGenerateArticlePreview(data);
      return response.data.data.parsedContent;
    },
    onError: (error: AxiosError) => {
      const { message } = (error.response?.data ?? {}) as { message?: string };
      toast({ description: message ? t(message) : error.message, variant: "destructive" });
    },
  });
}
