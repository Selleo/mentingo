import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ApiClient } from "../api-client";
import { newsQueryOptions } from "../queries/useNews";
import { NEWS_LIST_QUERY_KEY } from "../queries/useNewsList";

type DeleteNewsLanguageOptions = {
  id: string;
  language: "en" | "pl";
};

export function useDeleteNewsLanguage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, language }: DeleteNewsLanguageOptions) => {
      const response = await ApiClient.api.newsControllerDeleteNewsLanguage(id, { language });
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: newsQueryOptions(variables.id, { language: variables.language }).queryKey,
      });
      queryClient.invalidateQueries({ queryKey: NEWS_LIST_QUERY_KEY });
    },
    onError: (error) => {
      if (error instanceof Error) {
        console.error("Error deleting news language:", error.message);
      } else {
        console.error("Unexpected error while deleting news language.");
      }
    },
  });
}

