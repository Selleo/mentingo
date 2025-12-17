import { useNavigate } from "@remix-run/react";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ARTICLE_SECTION_QUERY_KEY } from "~/api/queries/useArticleSection";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../api-client";
import { ARTICLE_QUERY_KEY } from "../queries/useArticle";
import { ARTICLES_TOC_QUERY_KEY } from "../queries/useArticlesToc";

import type { AxiosError } from "axios";

export function useDeleteArticle() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (id: string) => {
      await ApiClient.api.articlesControllerDeleteArticle(id);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [ARTICLE_QUERY_KEY] });
      await queryClient.invalidateQueries({ queryKey: [ARTICLES_TOC_QUERY_KEY] });
      await queryClient.invalidateQueries({
        queryKey: [ARTICLE_SECTION_QUERY_KEY],
      });

      navigate("/articles");
    },
    onError: (error: AxiosError) => {
      const { message } = error.response?.data as { message: string };

      toast({
        description: t(message),
        variant: "destructive",
      });
    },
  });
}
