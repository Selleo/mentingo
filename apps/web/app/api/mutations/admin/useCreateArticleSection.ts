import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../../api-client";
import { ARTICLES_TOC_QUERY_KEY } from "../../queries/useArticlesToc";

import type { CreateArticleSectionBody, CreateArticleSectionResponse } from "../../generated-api";
import type { AxiosError } from "axios";

export function useCreateArticleSection() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (data: CreateArticleSectionBody) => {
      const response = await ApiClient.api.articlesControllerCreateArticleSection(data);
      return response.data as CreateArticleSectionResponse;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [ARTICLES_TOC_QUERY_KEY] });
    },
    onError: (error: AxiosError) => {
      const { message } = (error.response?.data ?? {}) as { message?: string };
      toast({ description: message ? t(message) : error.message, variant: "destructive" });
    },
  });
}
