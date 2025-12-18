import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { ARTICLE_QUERY_KEY } from "~/api/queries/useArticle";
import { ARTICLE_SECTION_QUERY_KEY } from "~/api/queries/useArticleSection";
import { ARTICLES_TOC_QUERY_KEY } from "~/api/queries/useArticlesToc";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";

import type { SupportedLanguages } from "@repo/shared";
import type { AxiosError } from "axios";

type AddArticleLanguageOptions = {
  id: string;
  language: SupportedLanguages;
};

export function useAddArticleLanguage() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({ id, language }: AddArticleLanguageOptions) => {
      const response = await ApiClient.api.articlesControllerAddNewLanguage(id, {
        language,
      });
      return response.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [ARTICLES_TOC_QUERY_KEY] });
      await queryClient.invalidateQueries({ queryKey: [ARTICLE_SECTION_QUERY_KEY] });
      await queryClient.invalidateQueries({ queryKey: [ARTICLE_QUERY_KEY] });
    },
    onError: (error: AxiosError) => {
      const { message } = (error.response?.data ?? {}) as { message?: string };
      toast({ description: message ? t(message) : error.message, variant: "destructive" });
    },
  });
}
