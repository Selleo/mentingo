import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ARTICLE_QUERY_KEY } from "~/api/queries/useArticle";
import { ARTICLE_SECTION_QUERY_KEY } from "~/api/queries/useArticleSection";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../../api-client";
import { ARTICLES_TOC_QUERY_KEY } from "../../queries/useArticlesToc";

import type { CreateArticleBody } from "../../generated-api";
import type { AxiosError } from "axios";

export function useCreateArticle() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (data: CreateArticleBody) => {
      const response = await ApiClient.api.articlesControllerCreateArticle(data);
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [ARTICLES_TOC_QUERY_KEY] });
      await queryClient.invalidateQueries({ queryKey: [ARTICLE_QUERY_KEY] });
      await queryClient.invalidateQueries({
        queryKey: [ARTICLE_SECTION_QUERY_KEY],
      });
    },
    onError: (error: AxiosError) => {
      const { message } = (error.response?.data ?? {}) as { message?: string };
      toast({ description: message ? t(message) : error.message, variant: "destructive" });
    },
  });
}
